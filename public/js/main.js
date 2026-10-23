import { CONFIG } from './config.js';
import { api } from './api.js';
import { store } from './store.js';
import { geocodeQueue } from './geocoder.js';
import { loadMapSdk, watchAmapAuthErrors } from './map/loader.js';
import { AMapAdapter } from './map/amap.js';
import { BaiduAdapter } from './map/baidu.js';
import { Sidebar } from './ui/sidebar.js';
import { toast } from './ui/toast.js';
import { openMenu, closeMenu } from './ui/menu.js';
import { confirmDialog, isDialogOpen } from './ui/dialog.js';
import { openAddressForm } from './ui/addressForm.js';
import { chooseFile, importFile, setupDropZone } from './ui/importer.js';
import { copyText, downloadUrl, escapeHtml, formatCoords, icon, isMobile } from './utils.js';

const $ = (selector) => document.querySelector(selector);

const els = {
    stats: $('#stats'),
    mapEl: $('#map'),
    mapStatus: $('#map-status'),
    pickBanner: $('#pick-banner'),
    btnExport: $('#btn-export')
};

let mapView = null;
// 加载/导入后自动缩放到全部标记，用户主动选中地址后停止
let autoFit = false;
let pickResolver = null;
// 等待定位完成后需要聚焦的地址ID
let focusWhenLocated = null;
// 地图加载失败时无法地理编码
let mapFailed = false;
let watchingAuth = false;
let authFailed = false;

// ========== 侧边栏 ==========

const sidebar = new Sidebar($('#sidebar'), {
    onSelect: (id) => selectAddress(id),
    onEdit: (id) => editAddress(id),
    onDelete: (id) => deleteAddress(id),
    onMenu: (id, anchor) => showItemMenu(id, anchor),
    onFilter: (typeFilter) => {
        store.set({ typeFilter });
        if (!store.filtered.some((item) => item.id === store.state.selectedId)) clearSelection();
        // 切换筛选后缩放到筛选结果
        requestAnimationFrame(() => mapView?.fitView());
    }
});

store.subscribe((state, prev) => {
    sidebar.render();
    renderHeader();
    syncMap(state, prev);
});

function renderHeader() {
    const { total, located } = store.stats;
    els.stats.innerHTML = total
        ? `<b>${total}</b> 个地点<span class="sep"></span><b>${located}</b> 已定位`
        : '';
    els.btnExport.disabled = total === 0;
}

// ========== 地图 ==========

async function initMap() {
    showMapStatus('loading');
    try {
        const cfg = await api.getMapConfig();
        if (!cfg.apiKey) {
            mapFailed = true;
            geocodeQueue.abandon();
            showMapStatus('error', '未配置地图 API 密钥', `请在 .env 中设置 ${cfg.provider === 'amap' ? 'AMAP_API_KEY' : 'BAIDU_MAP_API_KEY'} 后重启服务`, false);
            return;
        }
        if (cfg.provider === 'amap' && !watchingAuth) {
            watchingAuth = true;
            watchAmapAuthErrors(onMapAuthError);
        }
        await loadMapSdk(cfg);
        const Adapter = cfg.provider === 'amap' ? AMapAdapter : BaiduAdapter;
        mapView = new Adapter(els.mapEl, { onMarkerClick, onMapClick });
        // 密钥校验错误可能在初始化过程中就已触发，保留错误提示
        if (authFailed) return;
        mapFailed = false;
        document.body.dataset.provider = cfg.provider;
        showMapStatus(null);
        geocodeQueue.attach(mapView);
        enqueueUnlocated();
        syncMap(store.state, null);
        if (!store.state.loading && store.stats.total === 0) mapView.centerOnCity();
        else autoFitNow();
    } catch (error) {
        mapFailed = true;
        geocodeQueue.abandon();
        showMapStatus('error', '地图加载失败', error.message, true);
    }
}

// 密钥校验失败：地图和地理编码都不可用，提示具体原因
function onMapAuthError(code, message) {
    authFailed = true;
    mapFailed = true;
    geocodeQueue.abandon();
    const detail = code === 'INVALID_USER_DOMAIN' ? `${message}（当前域名：${location.hostname}）` : message;
    showMapStatus('error', `高德地图密钥校验失败：${code}`, detail, false);
}

function showMapStatus(type, title = '', detail = '', retry = false) {
    els.mapStatus.hidden = !type;
    if (type === 'loading') {
        els.mapStatus.innerHTML = '<div class="map-status-box"><span class="spinner"></span>地图加载中…</div>';
    } else if (type === 'error') {
        els.mapStatus.innerHTML = `<div class="map-status-box is-error">
            ${icon('alert-circle', 28)}
            <b>${escapeHtml(title)}</b>
            <span>${escapeHtml(detail)}</span>
            ${retry ? '<button type="button" class="btn btn-primary btn-sm" data-retry>重新加载</button>' : ''}
        </div>`;
        els.mapStatus.querySelector('[data-retry]')?.addEventListener('click', initMap);
    }
}

function syncMap(state, prev) {
    if (!mapView) return;
    mapView.setMarkers(store.filtered.filter((item) => item.located), state.selectedId);

    // 地理编码队列结束后自动缩放
    if (prev?.geoProgress && !state.geoProgress) autoFitNow();

    // 新增/编辑的地址定位完成后，自动跳转过去
    if (focusWhenLocated !== null) {
        const item = store.getItem(focusWhenLocated);
        if (!item || item.geo === 'failed') {
            focusWhenLocated = null;
            if (item) toast('未能根据地址自动定位，可编辑地址或在地图上手动选点', { type: 'error', duration: 5000 });
        } else if (item.located) {
            focusWhenLocated = null;
            selectAddress(item.id);
        }
    }
}

function autoFitNow() {
    if (autoFit && mapView) mapView.fitView();
}

function onMarkerClick(id) {
    selectAddress(id, { pan: false });
}

function onMapClick(point) {
    if (pickResolver) {
        finishPick(point);
    } else if (store.state.selectedId !== null) {
        clearSelection();
    }
}

function navUrl(item) {
    const name = encodeURIComponent(item.name || item.address);
    return mapView?.provider === 'baidu'
        ? `https://api.map.baidu.com/marker?location=${item.lat},${item.lng}&title=${name}&content=${encodeURIComponent(item.address)}&output=html&coord_type=bd09ll&src=webapp.biaozhu`
        : `https://uri.amap.com/marker?position=${item.lng},${item.lat}&name=${name}&coordinate=gaode&callnative=0`;
}

function infoHtml(item) {
    return `<div class="iw">
        <div class="iw-head">
            <span class="iw-num" style="--c:${item.color}">${item.number}</span>
            <div class="iw-titles">
                <div class="iw-title">${escapeHtml(item.name || '未命名地点')}</div>
                ${item.type ? `<span class="tag" style="--c:${item.color}">${escapeHtml(item.type)}</span>` : ''}
            </div>
            <button type="button" class="icon-btn iw-close" data-iw="close" aria-label="关闭">${icon('x')}</button>
        </div>
        <div class="iw-row">${icon('map-pin', 14)}<span>${escapeHtml(item.address)}</span></div>
        <div class="iw-row iw-coord">${icon('crosshair', 14)}<span>${formatCoords(item)}</span>
            <button type="button" class="btn-link" data-iw="copy">复制</button></div>
        <div class="iw-actions">
            <button type="button" class="btn btn-sm" data-iw="edit">${icon('edit', 14)}编辑</button>
            <a class="btn btn-sm" href="${navUrl(item)}" target="_blank" rel="noopener">${icon('navigation', 14)}导航</a>
            <button type="button" class="btn btn-sm btn-text is-danger" data-iw="delete">${icon('trash', 14)}删除</button>
        </div>
    </div>`;
}

// 信息窗口内的按钮（事件委托）
els.mapEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-iw]');
    const id = store.state.selectedId;
    if (!btn || id === null) return;
    const item = store.getItem(id);
    switch (btn.dataset.iw) {
        case 'close': clearSelection(); break;
        case 'edit': editAddress(id); break;
        case 'delete': deleteAddress(id); break;
        case 'copy':
            if (await copyText(`${item.lng},${item.lat}`)) toast('坐标已复制', { type: 'success' });
            break;
    }
});

// ========== 选中 ==========

function selectAddress(id, { pan = true } = {}) {
    const item = store.getItem(id);
    if (!item) return;
    autoFit = false;
    store.set({ selectedId: id });
    sidebar.scrollToSelected();
    if (isMobile() && pan) setSheetOpen(false);
    if (!mapView) return;

    if (item.located) {
        if (pan) mapView.focus(item.lng, item.lat);
        mapView.openInfo(item.lng, item.lat, infoHtml(item));
    } else {
        mapView.closeInfo();
        const message = item.geo === 'pending' ? '正在获取该地址的坐标，请稍候' : '该地址尚未定位，可编辑地址或在地图上手动选点';
        toast(message, { type: 'info' });
    }
}

function clearSelection() {
    mapView?.closeInfo();
    store.set({ selectedId: null });
}

// ========== 增删改 ==========

const errorToast = (error) => toast(error.message || '操作失败，请稍后重试', { type: 'error' });

function addAddress() {
    openAddressForm({
        item: null,
        types: store.types.map((t) => t.type),
        pickPoint: mapView ? pickOnMap : null,
        onSubmit: async (payload) => {
            try {
                const created = await api.createAddress(payload);
                store.upsert(created);
                toast('已添加地址', { type: 'success' });
                afterChange(created);
            } catch (error) {
                errorToast(error);
                throw error;
            }
        }
    });
}

function editAddress(id) {
    const item = store.getItem(id);
    if (!item) return;
    openAddressForm({
        item,
        types: store.types.map((t) => t.type),
        pickPoint: mapView ? pickOnMap : null,
        onSubmit: async (payload) => {
            try {
                const updated = await api.updateAddress(id, payload);
                store.upsert(updated);
                toast('已保存', { type: 'success' });
                afterChange(updated);
            } catch (error) {
                errorToast(error);
                throw error;
            }
        }
    });
}

// 新增/编辑后：无坐标则加入定位队列，有坐标则选中并定位
function afterChange(record) {
    if (record.lng === null || record.lat === null) {
        focusWhenLocated = mapView ? record.id : null;
        if (!mapFailed) geocodeQueue.enqueue([record]);
        mapView?.closeInfo();
        store.set({ selectedId: record.id });
        sidebar.scrollToSelected();
    } else {
        selectAddress(record.id);
    }
}

async function deleteAddress(id) {
    const item = store.getItem(id);
    if (!item) return;
    try {
        await api.deleteAddress(id);
    } catch (error) {
        errorToast(error);
        return;
    }
    if (store.state.selectedId === id) mapView?.closeInfo();
    store.remove(id);

    const { name, address, type, lng, lat } = item;
    toast(`已删除「${name || address}」`, {
        type: 'success',
        action: {
            label: '撤销',
            onClick: async () => {
                try {
                    store.upsert(await api.createAddress({ name, address, type, lng, lat }));
                    toast('已恢复', { type: 'success' });
                } catch (error) {
                    errorToast(error);
                }
            }
        }
    });
}

function showItemMenu(id, anchor) {
    const item = store.getItem(id);
    if (!item) return;
    openMenu(anchor, [
        item.located && { label: '在地图中查看', icon: 'map-pin', onClick: () => selectAddress(id) },
        { label: '编辑', icon: 'edit', onClick: () => editAddress(id) },
        { label: '复制地址', icon: 'copy', onClick: async () => (await copyText(item.address)) && toast('地址已复制', { type: 'success' }) },
        mapView && item.geo !== 'pending' && {
            label: item.located ? '重新定位' : '获取坐标',
            icon: 'refresh',
            onClick: () => geocodeQueue.enqueue([item])
        },
        '-',
        { label: '删除', icon: 'trash', danger: true, onClick: () => deleteAddress(id) }
    ].filter(Boolean));
}

// ========== 地图选点 ==========

function pickOnMap() {
    return new Promise((resolve) => {
        pickResolver = resolve;
        mapView.setPicking(true);
        els.pickBanner.hidden = false;
        if (isMobile()) setSheetOpen(false);
    });
}

async function finishPick(point) {
    const resolve = pickResolver;
    pickResolver = null;
    els.pickBanner.hidden = true;
    mapView.setPicking(false);
    if (!point) return resolve(null);

    mapView.showPickPoint(point.lng, point.lat);
    const address = await mapView.reverseGeocode(point.lng, point.lat).catch(() => '');
    setTimeout(() => mapView.clearPickPoint(), 1500);
    resolve({ ...point, address });
}

els.pickBanner.querySelector('[data-cancel]').onclick = () => finishPick(null);

// ========== 导入导出 ==========

async function handleFile(file) {
    const result = await importFile(file);
    if (!result) return;
    geocodeQueue.reset();
    mapView?.closeInfo();
    store.replaceAll(result.data);
    sidebar.clearSearch();
    enqueueUnlocated();
    autoFit = true;
    requestAnimationFrame(autoFitNow);
}

function enqueueUnlocated() {
    if (mapFailed) return;
    const pending = store.items.filter((item) => !item.located && item.geo !== 'pending');
    if (pending.length) geocodeQueue.enqueue(pending);
}

async function clearAll() {
    const ok = await confirmDialog({
        title: '清空全部数据',
        message: `将永久删除全部 <b>${store.stats.total}</b> 条地址，此操作无法撤销。建议先导出备份。`,
        okText: '清空',
        danger: true
    });
    if (!ok) return;
    try {
        await api.clearAddresses();
        geocodeQueue.reset();
        mapView?.closeInfo();
        store.replaceAll([]);
        toast('已清空全部数据', { type: 'success' });
    } catch (error) {
        errorToast(error);
    }
}

// ========== 顶部操作栏 ==========

const pickFile = () => chooseFile(handleFile);

$('#btn-add').onclick = addAddress;
$('#btn-import').onclick = pickFile;
els.btnExport.onclick = () => downloadUrl(CONFIG.API.EXPORT);
$('#btn-more').onclick = (e) => {
    const { total, unlocated } = store.stats;
    openMenu(e.currentTarget, [
        { label: '下载导入模板', icon: 'file', onClick: () => downloadUrl(CONFIG.API.TEMPLATE) },
        mapView && unlocated > 0 && { label: `重新定位未定位地址（${unlocated}）`, icon: 'refresh', onClick: enqueueUnlocated },
        total > 0 && '-',
        total > 0 && { label: '清空全部数据', icon: 'trash', danger: true, onClick: clearAll }
    ].filter(Boolean));
};

// 空状态引导
$('#onboarding').addEventListener('click', (e) => {
    const action = e.target.closest('[data-onboard]')?.dataset.onboard;
    if (action === 'import') pickFile();
    else if (action === 'add') addAddress();
    else if (action === 'template') downloadUrl(CONFIG.API.TEMPLATE);
});

setupDropZone($('#drop-overlay'), handleFile);

// ========== 地图控件 / 布局 ==========

$('#map-controls').addEventListener('click', async (e) => {
    const action = e.target.closest('[data-map]')?.dataset.map;
    if (!action) return;
    if (!mapView) {
        toast('地图尚未加载', { type: 'error' });
        return;
    }
    if (action === 'zoom-in') mapView.zoomIn();
    else if (action === 'zoom-out') mapView.zoomOut();
    else if (action === 'fit') {
        if (store.filtered.some((i) => i.located)) mapView.fitView();
        else toast('暂无可显示的标记', { type: 'info' });
    } else if (action === 'locate') {
        const t = toast('正在定位…', { type: 'loading' });
        try {
            const { address, approximate, reason } = await mapView.locate();
            if (approximate) {
                t.update(`无法获取精确位置，已定位到所在城市「${address}」。${reason}`, { type: 'info', duration: 8000 });
            } else {
                t.update(address ? `当前位置：${address}` : '已定位到当前位置', { type: 'success' });
            }
        } catch (error) {
            t.update(error.message || '定位失败，请检查浏览器定位权限', { type: 'error', duration: 6000 });
        }
    }
});

$('#sidebar-toggle').onclick = () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    $('#sidebar-toggle').setAttribute('aria-expanded', String(!collapsed));
    $('#sidebar-toggle').title = collapsed ? '展开列表' : '收起列表';
    // 等待过渡结束后通知地图容器尺寸变化
    setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
};

function setSheetOpen(open) {
    document.body.classList.toggle('sheet-open', open);
    $('#sheet-handle').setAttribute('aria-expanded', String(open));
}

$('#sheet-handle').onclick = () => setSheetOpen(!document.body.classList.contains('sheet-open'));
$('#search').addEventListener('focus', () => isMobile() && setSheetOpen(true));

// ========== 快捷键 ==========

// 使用捕获阶段：地图容器获得焦点后会拦截键盘事件
window.addEventListener('keydown', (e) => {
    if (isDialogOpen()) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

    if (e.key === 'Escape') {
        if (pickResolver) finishPick(null);
        else if (store.state.selectedId !== null) clearSelection();
        closeMenu();
    } else if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k'))) {
        e.preventDefault();
        if (isMobile()) setSheetOpen(true);
        sidebar.focusSearch();
    } else if (!typing && e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        addAddress();
    }
}, true);

// ========== 启动 ==========

async function loadAddresses() {
    store.set({ loading: true });
    try {
        const addresses = await api.listAddresses();
        store.set({ addresses, loading: false });
        enqueueUnlocated();
        autoFit = true;
        if (mapView) {
            if (addresses.length) autoFitNow();
            else mapView.centerOnCity();
        }
    } catch (error) {
        store.set({ loading: false });
        toast(error.message, { type: 'error', action: { label: '重试', onClick: loadAddresses } });
    }
}

sidebar.render();
renderHeader();
// 地图与数据并行加载，列表不必等待地图
initMap();
loadAddresses();
