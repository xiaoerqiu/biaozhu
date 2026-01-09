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

// 模拟酒店数据 - 杭州西湖周边
const mockHotelData = [
    { name: '杭州西湖国宾馆', address: '杭州市西湖区杨公堤18号', type: '豪华湖景大床房', lng: 120.130953, lat: 30.246273 },
    { name: '杭州香格里拉饭店', address: '杭州市西湖区北山路78号', type: '高级园景双床房', lng: 120.147835, lat: 30.261654 },
    { name: '浙江西子宾馆', address: '杭州市西湖区南山路37号', type: '西湖景观套房', lng: 120.148521, lat: 30.241876 },
    { name: '杭州柏悦酒店', address: '杭州市上城区湖滨路28号', type: '豪华城景房', lng: 120.169324, lat: 30.251432 },
    { name: '杭州JW万豪酒店', address: '杭州市西湖区湖墅南路28号', type: '行政大床房', lng: 120.163287, lat: 30.283654 },
    { name: '杭州雷迪森龙井庄园', address: '杭州市西湖区龙井路190号', type: '龙井茶园别墅', lng: 120.117532, lat: 30.228976 },
    { name: '杭州西溪悦榕庄', address: '杭州市西湖区紫金港路21号', type: '水上别墅', lng: 120.062145, lat: 30.276543 },
    { name: '杭州泛海钓鱼台酒店', address: '杭州市江干区钱江路1366号', type: '总统套房', lng: 120.221876, lat: 30.246789 },
    { name: '杭州凯悦酒店', address: '杭州市上城区湖滨路28号', type: '湖景套房', lng: 120.168754, lat: 30.249321 },
    { name: '杭州法云安缦', address: '杭州市西湖区法云弄22号', type: '法云村舍', lng: 120.099876, lat: 30.234567 }
];

document.addEventListener('DOMContentLoaded', () => {
    // 等待百度地图API加载完成后初始化地图
    window.onBaiduMapLoaded(() => {
        initMap();
        // 加载模拟数据展示
        addresses = mockHotelData;
        renderAddressList();
        markAddressesOnMap(addresses);
        console.log('已加载模拟酒店数据:', addresses.length, '条');
    });
    
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