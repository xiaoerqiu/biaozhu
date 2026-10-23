import { CONFIG } from '../config.js';
import { checkLocateResult, describeLocateError, isInChina } from '../utils.js';
import { pinKey, pinSvg } from './markers.js';

const LABEL_STYLE = {
    color: '#1f1f1f',
    fontSize: '12px',
    fontWeight: '600',
    background: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '3px 8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
};

/**
 * 百度地图适配器（JS API GL）
 */
export class BaiduAdapter {
    constructor(container, { onMarkerClick, onMapClick }) {
        this.provider = 'baidu';
        this.markers = new Map(); // id -> { marker, key }
        this.map = new BMapGL.Map(container);
        this.map.centerAndZoom(new BMapGL.Point(...CONFIG.MAP.DEFAULT_CENTER), CONFIG.MAP.DEFAULT_ZOOM);
        this.map.enableScrollWheelZoom(true);
        this.map.addControl(new BMapGL.ScaleControl({ anchor: BMAP_ANCHOR_BOTTOM_LEFT }));
        this.map.addEventListener('click', (e) => {
            // 点击标记时百度也会触发地图 click，忽略覆盖物上的点击
            if (e.overlay) return;
            onMapClick({ lng: e.latlng.lng, lat: e.latlng.lat });
        });
        this.onMarkerClick = onMarkerClick;
        this.geocoder = new BMapGL.Geocoder();
        this.selectedLabel = null;
    }

    _icon(item, selected) {
        const { url, width, height } = pinSvg(item, selected);
        return new BMapGL.Icon(url, new BMapGL.Size(width, height), { anchor: new BMapGL.Size(width / 2, height) });
    }

    setMarkers(items, selectedId) {
        const keep = new Set();
        let selectedItem = null;
        for (const item of items) {
            keep.add(item.id);
            const selected = item.id === selectedId;
            if (selected) selectedItem = item;
            const key = pinKey(item, selected);
            const entry = this.markers.get(item.id);
            if (entry && entry.key === key) continue;

            const point = new BMapGL.Point(item.lng, item.lat);
            if (entry) {
                entry.marker.setIcon(this._icon(item, selected));
                entry.marker.setPosition(point);
                entry.marker.setZIndex?.(selected ? 200 : 100);
                entry.key = key;
                continue;
            }
            const marker = new BMapGL.Marker(point, { icon: this._icon(item, selected) });
            marker.addEventListener('click', () => this.onMarkerClick(item.id));
            this.map.addOverlay(marker);
            this.markers.set(item.id, { marker, key });
        }

        for (const [id, entry] of this.markers) {
            if (!keep.has(id)) {
                this.map.removeOverlay(entry.marker);
                this.markers.delete(id);
            }
        }

        // 百度标记无法用 CSS 悬停显示名称，仅为选中项显示名称标签
        if (this.selectedLabel) this.map.removeOverlay(this.selectedLabel);
        this.selectedLabel = null;
        if (selectedItem?.name) {
            this.selectedLabel = new BMapGL.Label(selectedItem.name, {
                position: new BMapGL.Point(selectedItem.lng, selectedItem.lat),
                offset: new BMapGL.Size(20, -40)
            });
            this.selectedLabel.setStyle(LABEL_STYLE);
            this.map.addOverlay(this.selectedLabel);
        }
    }

    fitView() {
        const points = [...this.markers.values()].map((e) => e.marker.getPosition());
        if (points.length) this.map.setViewport(points, { margins: [80, 80, 80, 80], zoomFactor: -1 });
    }

    focus(lng, lat) {
        this.map.centerAndZoom(new BMapGL.Point(lng, lat), Math.max(this.map.getZoom(), CONFIG.MAP.FOCUS_ZOOM));
    }

    zoomIn() { this.map.zoomIn(); }

    zoomOut() { this.map.zoomOut(); }

    openInfo(lng, lat, html) {
        const infoWindow = new BMapGL.InfoWindow(html, { width: 300, offset: new BMapGL.Size(0, -40), enableAutoPan: true });
        this.map.openInfoWindow(infoWindow, new BMapGL.Point(lng, lat));
    }

    closeInfo() { this.map.closeInfoWindow(); }

    setPicking(active) {
        this.map.setDefaultCursor(active ? 'crosshair' : 'default');
    }

    showPickPoint(lng, lat) {
        this.clearPickPoint();
        this.pickMarker = new BMapGL.Marker(new BMapGL.Point(lng, lat));
        this.map.addOverlay(this.pickMarker);
    }

    clearPickPoint() {
        if (this.pickMarker) this.map.removeOverlay(this.pickMarker);
        this.pickMarker = null;
    }

    centerOnCity() {
        this._localCity().then((result) => {
            if (result && this.markers.size === 0) this.map.centerAndZoom(result.name, CONFIG.MAP.DEFAULT_ZOOM);
        });
    }

    // IP 定位所在城市（境外结果视为失败），超时兜底
    _localCity() {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 5000);
            new BMapGL.LocalCity().get((result) => {
                clearTimeout(timer);
                const center = result?.center;
                resolve(center && isInChina(center.lng, center.lat) ? result : null);
            });
        });
    }

    geocode(address) {
        return new Promise((resolve, reject) => {
            this.geocoder.getPoint(address, (point) => {
                if (point) resolve({ lng: point.lng, lat: point.lat });
                else reject(new Error('NO_DATA'));
            }, '中国');
        });
    }

    reverseGeocode(lng, lat) {
        return new Promise((resolve) => {
            this.geocoder.getLocation(new BMapGL.Point(lng, lat), (result) => resolve(result?.address || ''));
        });
    }

    /**
     * 定位当前位置；精确定位不可用时退回到 IP 所在城市
     * @returns {Promise<{ address: string, approximate?: boolean, reason?: string }>}
     */
    async locate() {
        let reason;
        try {
            const r = await this._browserPosition();
            reason = checkLocateResult(r.point.lng, r.point.lat);
            if (!reason) {
                this.map.centerAndZoom(r.point, CONFIG.MAP.LOCATE_ZOOM);
                return { address: r.address ? `${r.address.province || ''}${r.address.city || ''}` : '' };
            }
        } catch (error) {
            reason = error.message;
        }

        const city = await this._localCity();
        if (!city) throw new Error(reason);
        this.map.centerAndZoom(city.name, CONFIG.MAP.DEFAULT_ZOOM);
        return { address: city.name, approximate: true, reason };
    }

    _browserPosition() {
        return new Promise((resolve, reject) => {
            new BMapGL.Geolocation().getCurrentPosition(function (r) {
                const status = this.getStatus();
                if (status === BMAP_STATUS_SUCCESS) return resolve(r);
                const reason = status === window.BMAP_STATUS_PERMISSION_DENIED ? 'permission denied'
                    : status === window.BMAP_STATUS_TIMEOUT ? 'timeout' : '';
                reject(new Error(describeLocateError(reason)));
            }, { enableHighAccuracy: true });
        });
    }
}
