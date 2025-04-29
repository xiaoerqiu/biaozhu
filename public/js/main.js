// 初始化地图
let map = null;
let markers = [];

// 请求队列管理器
class RequestQueue {
    constructor(qps = 30) {
        this.qps = qps;
        this.queue = [];
        this.tokens = qps;
        this.lastRefillTime = Date.now();
        this.processing = false;
    }

    enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            this.refillTokens();
            if (this.tokens > 0) {
                const { task, resolve, reject } = this.queue.shift();
                this.tokens--;
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.processing = false;
    }

    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefillTime;
        const tokensToAdd = Math.floor(timePassed * (this.qps / 1000));

        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.qps, this.tokens + tokensToAdd);
            this.lastRefillTime = now;
        }
    }
}

const requestQueue = new RequestQueue(30);
let currentInfoWindow = null;

let currentPage = 1;
let itemsPerPage = 10;
let totalItems = 0;
let addresses = [];

// 适配新版结构
function renderAddressList() {
    const addressList = document.getElementById('address-list');
    addressList.innerHTML = '';
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, addresses.length);
    for (let i = start; i < end; i++) {
        const item = addresses[i];
        const li = document.createElement('li');
        li.className = 'ma-address-card';
        li.innerHTML = `<div class="ma-card-title">${item.name || ''}</div><div class="ma-card-desc">${item.address || ''}</div>`;
        li.onclick = () => {
            if (markers[i]) {
                map.centerAndZoom(markers[i].getPosition(), 16);
                markers[i].setAnimation(window.BMAP_ANIMATION_BOUNCE);
                setTimeout(() => markers[i].setAnimation(null), 1400);
            }
        };
        addressList.appendChild(li);
    }
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = Math.max(1, Math.ceil(addresses.length / itemsPerPage));
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === Math.ceil(addresses.length / itemsPerPage);
}

function showUploadStatus(message, type) {
    const status = document.getElementById('upload-status');
    status.textContent = message;
    status.style.display = message ? 'block' : 'none';
    status.style.color = type === 'error' ? '#ff4d4f' : '#1677ff';
}

function markAddressesOnMap(addresses) {
    if (!map) return;
    map.clearOverlays();
    markers = [];
    const geocoder = new BMap.Geocoder();
    let points = [];
    addresses.forEach((item, idx) => {
        function addMarker(point) {
            const marker = new BMap.Marker(point);
            // 新增酒店名称label
            if (item.name) {
                const label = new BMap.Label(item.name, {
                    offset: new BMap.Size(20, -10),
                    style: {
                        color: '#1677ff',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        background: 'rgba(255,255,255,0.9)',
                        border: '1px solid #e6f4ff',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        boxShadow: '0 2px 8px rgba(22,119,255,0.08)'
                    }
                });
                marker.setLabel(label);
            }
            // 点击弹窗显示酒店信息
            const infoHtml = `
                <div style='font-size:15px;font-weight:bold;margin-bottom:6px;'>酒店名称：${item.name || ''}</div>
                <div style='margin-bottom:4px;'><b>酒店位置：</b>${item.address || ''}</div>
                <div><b>房型：</b>${item.type || '无'}</div>
            `;
            const infoWindow = new BMap.InfoWindow(infoHtml, {
                width: 260,
                title: item.name || '酒店信息',
                enableMessage: false
            });
            marker.addEventListener('click', function() {
                map.openInfoWindow(infoWindow, point);
            });
            map.addOverlay(marker);
            markers[idx] = marker;
            points.push(point);
        }
        if (item.lng && item.lat) {
            const point = new BMap.Point(item.lng, item.lat);
            addMarker(point);
        } else if (item.address) {
            geocoder.getPoint(item.address, (point) => {
                if (point) addMarker(point);
            }, '中国');
        }
    });
    // 自动调整视野
    setTimeout(() => {
        if (points.length > 0) {
            map.setViewport(points);
        }
    }, 800);
}

// 地址列表抽屉按钮逻辑
function initDrawerToggle() {
    const drawer = document.getElementById('drawerList');
    const btn = document.getElementById('drawerToggleBtn');
    let hidden = false;
    
    // 初始状态：抽屉显示，箭头指向右（收起）
    btn.querySelector('svg').style.transform = 'rotate(0deg)';

    btn.onclick = function() {
        hidden = !hidden;
        if (hidden) {
            drawer.classList.add('drawer-hidden');
            // 抽屉隐藏，箭头指向左（展开）
            btn.querySelector('svg').style.transform = 'rotate(180deg)';
        } else {
            drawer.classList.remove('drawer-hidden');
            // 抽屉显示，箭头指向右（收起）
            btn.querySelector('svg').style.transform = 'rotate(0deg)';
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadStoredAddresses();
    initDrawerToggle();

    // 上传按钮
    document.getElementById('upload-btn').onclick = () => {
        document.getElementById('excel-file').click();
    };
    document.getElementById('excel-file').onchange = function() {
        const file = this.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        showUploadStatus('正在上传并解析文件...', 'info');
        fetch('/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    addresses = res.data;
                    currentPage = 1;
                    renderAddressList();
                    markAddressesOnMap(addresses);
                    showUploadStatus('上传并解析成功', 'info');
                } else {
                    showUploadStatus(res.error || '上传失败', 'error');
                }
            })
            .catch(() => showUploadStatus('上传失败', 'error'));
    };

    // 分页
    document.getElementById('prev-page').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderAddressList();
        }
    };
    document.getElementById('next-page').onclick = () => {
        if (currentPage < Math.ceil(addresses.length / itemsPerPage)) {
            currentPage++;
            renderAddressList();
        }
    };
});

function loadStoredAddresses() {
    fetch('/addresses').then(res => res.json()).then(res => {
        if (res.success) {
            addresses = res.data;
            currentPage = 1;
            renderAddressList();
            markAddressesOnMap(addresses);
        }
    });
}

function initMap() {
    try {
        map = new BMap.Map('map-container');
        const point = new BMap.Point(120.153576, 30.287459);
        map.centerAndZoom(point, 12);
        map.enableScrollWheelZoom();
        map.addControl(new BMap.NavigationControl());
        map.addControl(new BMap.ScaleControl());
    } catch (error) {
        console.error('地图初始化失败:', error);
    }
}