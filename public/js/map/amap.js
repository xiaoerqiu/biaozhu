import { CONFIG } from '../config.js';
import { RetryableGeocodeError } from '../geocoder.js';
import { checkLocateResult, describeLocateError } from '../utils.js';
import { pinHtml, pinKey } from './markers.js';

/**
 * 高德地图适配器（JS API 2.0）
 */
export class AMapAdapter {
    constructor(container, { onMarkerClick, onMapClick }) {
        this.provider = 'amap';
        this.markers = new Map(); // id -> { marker, key }
        this.map = new AMap.Map(container, {
            center: CONFIG.MAP.DEFAULT_CENTER,
            zoom: CONFIG.MAP.DEFAULT_ZOOM,
            viewMode: '2D',
            resizeEnable: true
        });
        this.map.addControl(new AMap.Scale({ position: 'LB' }));
        this.map.on('click', (e) => onMapClick({ lng: e.lnglat.getLng(), lat: e.lnglat.getLat() }));
        this.onMarkerClick = onMarkerClick;
        this.geocoder = new AMap.Geocoder();
        this.infoWindow = new AMap.InfoWindow({ isCustom: true, anchor: 'bottom-center', offset: new AMap.Pixel(0, -46) });
    }

    setMarkers(items, selectedId) {
        const keep = new Set();
        const added = [];
        for (const item of items) {
            keep.add(item.id);
            const selected = item.id === selectedId;
            const key = pinKey(item, selected);
            const entry = this.markers.get(item.id);
            if (entry && entry.key === key) continue;
            if (entry) {
                entry.marker.setContent(pinHtml(item, selected));
                entry.marker.setPosition([item.lng, item.lat]);
                entry.marker.setzIndex(selected ? 200 : 100);
                entry.key = key;
                continue;
            }
            const marker = new AMap.Marker({
                position: [item.lng, item.lat],
                content: pinHtml(item, selected),
                anchor: 'bottom-center',
                zIndex: selected ? 200 : 100
            });
            marker.on('click', () => this.onMarkerClick(item.id));
            this.markers.set(item.id, { marker, key });
            added.push(marker);
        }
        if (added.length) this.map.add(added);

        for (const [id, entry] of this.markers) {
            if (!keep.has(id)) {
                this.map.remove(entry.marker);
                this.markers.delete(id);
            }
        }
    }

    fitView() {
        const markers = [...this.markers.values()].map((e) => e.marker);
        if (markers.length) this.map.setFitView(markers, false, [80, 80, 80, 80], CONFIG.MAP.FOCUS_ZOOM);
    }

    focus(lng, lat) {
        this.map.setZoomAndCenter(Math.max(this.map.getZoom(), CONFIG.MAP.FOCUS_ZOOM), [lng, lat]);
    }

    zoomIn() { this.map.zoomIn(); }

    zoomOut() { this.map.zoomOut(); }

    openInfo(lng, lat, html) {
        this.infoWindow.setContent(html);
        this.infoWindow.open(this.map, [lng, lat]);
    }

    closeInfo() { this.infoWindow.close(); }

    setPicking(active) {
        this.map.setDefaultCursor(active ? 'crosshair' : 'default');
    }

    showPickPoint(lng, lat) {
        if (!this.pickMarker) {
            this.pickMarker = new AMap.Marker({ content: '<div class="pick-dot"></div>', anchor: 'center', zIndex: 300 });
        }
        this.pickMarker.setPosition([lng, lat]);
        this.map.add(this.pickMarker);
    }

    clearPickPoint() {
        if (this.pickMarker) this.map.remove(this.pickMarker);
    }

    // 无数据时根据 IP 定位到所在城市
    centerOnCity() {
        this._localCity().then((result) => {
            if (result && this.markers.size === 0) this.map.setCity(result.city);
        });
    }

    geocode(address) {
        return new Promise((resolve, reject) => {
            this.geocoder.getLocation(address, (status, result) => {
                if (status === 'complete' && result.geocodes?.length) {
                    const { lng, lat } = result.geocodes[0].location;
                    resolve({ lng, lat });
                } else if (status === 'error' && /QPS|OVER_LIMIT|TIMEOUT|NETWORK/i.test(String(result))) {
                    reject(new RetryableGeocodeError(String(result)));
                } else {
                    reject(new Error(typeof result === 'string' ? result : 'NO_DATA'));
                }
            });
        });
    }

    reverseGeocode(lng, lat) {
        return new Promise((resolve) => {
            this.geocoder.getAddress([lng, lat], (status, result) => {
                resolve(status === 'complete' ? result.regeocode.formattedAddress : '');
            });
        });
    }

    /**
     * 定位当前位置；精确定位不可用时退回到 IP 所在城市
     * @returns {Promise<{ address: string, approximate?: boolean, reason?: string }>}
     */
    async locate() {
        let reason;
        try {
            const result = await this._browserPosition();
            const { lng, lat } = result.position;
            // 境外坐标（常见于开启代理时）没有地图数据，直接跳转会显示空白地图
            reason = checkLocateResult(lng, lat);
            if (!reason) {
                this._showMe(lng, lat, result.accuracy);
                this.map.setZoomAndCenter(CONFIG.MAP.LOCATE_ZOOM, [lng, lat]);
                return { address: result.formattedAddress || '' };
            }
        } catch (error) {
            reason = error.message;
        }

        const city = await this._localCity();
        if (!city) throw new Error(reason);
        this.meOverlays?.forEach((o) => this.map.remove(o));
        this.map.setBounds(city.bounds);
        return { address: city.city, approximate: true, reason };
    }

    _browserPosition() {
        return new Promise((resolve, reject) => {
            new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000 }).getCurrentPosition((status, result) => {
                if (status === 'complete') resolve(result);
                else reject(new Error(describeLocateError(result?.message)));
            });
        });
    }

    // IP 定位所在城市；高德在部分网络环境下不会回调，需超时兜底
    _localCity() {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 5000);
            new AMap.CitySearch().getLocalCity((status, result) => {
                clearTimeout(timer);
                resolve(status === 'complete' && result.info === 'OK' && result.bounds ? result : null);
            });
        });
    }

    _showMe(lng, lat, accuracy) {
        this.meOverlays?.forEach((o) => this.map.remove(o));
        this.meOverlays = [
            new AMap.Circle({
                center: [lng, lat], radius: accuracy || 50, strokeColor: '#1677ff', strokeWeight: 1,
                strokeOpacity: 0.4, fillColor: '#1677ff', fillOpacity: 0.08, bubble: true
            }),
            new AMap.Marker({ position: [lng, lat], content: '<div class="me-dot"></div>', anchor: 'center', zIndex: 150 })
        ];
        this.map.add(this.meOverlays);
    }
}
