// 初始化地图
let map = null;
let markers = [];
let selectedCardIndex = -1; // 当前选中的卡片索引

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

// 渲染空状态提示
function renderEmptyState() {
    return `
        <div class="ma-empty-state">
            <div class="ma-empty-icon">📍</div>
            <div class="ma-empty-title">暂无地址数据</div>
            <div class="ma-empty-desc">请点击上方按钮上传Excel文件</div>
        </div>
    `;
}

// 渲染地址列表
function renderAddressList() {
    const addressList = document.getElementById('address-list');
    addressList.innerHTML = '';
    
    // 空状态处理
    if (addresses.length === 0) {
        addressList.innerHTML = renderEmptyState();
        document.getElementById('current-page').textContent = '0';
        document.getElementById('total-pages').textContent = '0';
        document.getElementById('prev-page').disabled = true;
        document.getElementById('next-page').disabled = true;
        return;
    }
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, addresses.length);
    
    for (let i = start; i < end; i++) {
        const item = addresses[i];
        const li = document.createElement('li');
        const isSelected = i === selectedCardIndex;
        li.className = `ma-address-card ${isSelected ? 'ma-card-selected' : ''}`;
        li.dataset.index = i;
        
        // 添加序号和类型标签
        const typeTag = item.type ? `<span class="ma-type-tag">${item.type}</span>` : '';
        
        li.innerHTML = `
            <div class="ma-card-header">
                <span class="ma-card-index">${i + 1}</span>
                ${typeTag}
            </div>
            <div class="ma-card-title">${item.name || '未命名地点'}</div>
            <div class="ma-card-desc">${item.address || '暂无地址'}</div>
        `;
        
        li.onclick = () => {
            // 更新选中状态
            selectedCardIndex = i;
            updateSelectedCard();
            
            // 地图操作
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
    document.getElementById('next-page').disabled = currentPage >= Math.ceil(addresses.length / itemsPerPage);
}

// 更新选中卡片的样式
function updateSelectedCard() {
    document.querySelectorAll('.ma-address-card').forEach(card => {
        const index = parseInt(card.dataset.index);
        if (index === selectedCardIndex) {
            card.classList.add('ma-card-selected');
        } else {
            card.classList.remove('ma-card-selected');
        }
    });
}

let uploadStatusTimer = null;

// 显示上传状态（支持loading动画）
function showUploadStatus(message, type, showSpinner = false) {
    const status = document.getElementById('upload-status');
    
    const spinnerHtml = showSpinner ? '<span class="ma-spinner"></span>' : '';
    const iconHtml = type === 'error' ? '❌ ' : (type === 'success' ? '✅ ' : '');
    
    status.innerHTML = `${spinnerHtml}${iconHtml}${message}`;
    status.style.display = message ? 'flex' : 'none';
    status.className = `ma-upload-status ma-status-${type}`;
    
    // 清除之前的定时器
    if (uploadStatusTimer) {
        clearTimeout(uploadStatusTimer);
        uploadStatusTimer = null;
    }
    
    // 成功消息3秒后自动隐藏
    if (message && type === 'success') {
        uploadStatusTimer = setTimeout(() => {
            status.style.display = 'none';
            uploadStatusTimer = null;
        }, 3000);
    }
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
                // 更新选中状态
                selectedCardIndex = idx;
                updateSelectedCard();
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
    // 显示地图加载提示
    showMapLoading(true);
    
    // 等待百度地图API加载完成后初始化地图
    window.onBaiduMapLoaded(() => {
        initMap();
        showMapLoading(false);
        loadStoredAddresses();
    });
    
    initDrawerToggle();

    // 上传按钮
    document.getElementById('upload-btn').onclick = () => {
        document.getElementById('excel-file').click();
    };
    
    document.getElementById('excel-file').onchange = function() {
        const file = this.files[0];
        if (!file) return;
        
        // 重置文件输入，允许重复上传同一文件
        const fileInput = this;
        
        const formData = new FormData();
        formData.append('file', file);
        
        // 显示加载状态
        showUploadStatus('正在上传并解析文件...', 'loading', true);
        
        fetch('/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    addresses = res.data;
                    currentPage = 1;
                    selectedCardIndex = -1; // 重置选中状态
                    renderAddressList();
                    markAddressesOnMap(addresses);
                    // 显示成功统计
                    showUploadStatus(`上传成功！共导入 ${addresses.length} 条地址`, 'success');
                } else {
                    showUploadStatus(res.error || '上传失败，请检查文件格式', 'error');
                }
            })
            .catch(() => showUploadStatus('上传失败，请检查网络连接', 'error'))
            .finally(() => {
                fileInput.value = ''; // 清空文件输入
            });
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

// 显示/隐藏地图加载提示
function showMapLoading(show) {
    let loader = document.getElementById('map-loader');
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'map-loader';
            loader.className = 'ma-map-loader';
            loader.innerHTML = '<span class="ma-spinner"></span><span>地图加载中...</span>';
            document.getElementById('map-container').appendChild(loader);
        }
        loader.style.display = 'flex';
    } else if (loader) {
        loader.style.display = 'none';
    }
}

function loadStoredAddresses() {
    fetch('/addresses').then(res => res.json()).then(res => {
        if (res.success) {
            addresses = res.data;
            currentPage = 1;
            renderAddressList();
            markAddressesOnMap(addresses);
        }
    }).catch(() => {
        // 加载失败时显示空状态
        renderAddressList();
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
        showUploadStatus('地图加载失败，请刷新页面重试', 'error');
    }
}