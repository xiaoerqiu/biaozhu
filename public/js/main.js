// 初始化地图
let map = null;
let markers = [];
let selectedCardIndex = -1; // 当前选中的卡片索引
let geolocation = null; // 定位控件

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

// ========== 弹窗和右键菜单 ==========

// 创建右键菜单
function createContextMenu() {
    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'ma-context-menu';
    menu.innerHTML = `
        <div class="ma-menu-item" data-action="edit">
            <span>✏️</span> 编辑
        </div>
        <div class="ma-menu-item ma-menu-danger" data-action="delete">
            <span>🗑️</span> 删除
        </div>
    `;
    menu.style.display = 'none';
    document.body.appendChild(menu);
    return menu;
}

// 创建编辑弹窗
function createEditModal() {
    const modal = document.createElement('div');
    modal.id = 'edit-modal';
    modal.className = 'ma-modal-overlay';
    modal.innerHTML = `
        <div class="ma-modal">
            <div class="ma-modal-header">
                <h3>编辑地址</h3>
                <button class="ma-modal-close" onclick="closeEditModal()">&times;</button>
            </div>
            <div class="ma-modal-body">
                <div class="ma-form-group">
                    <label>名称</label>
                    <input type="text" id="edit-name" placeholder="请输入名称">
                </div>
                <div class="ma-form-group">
                    <label>地址</label>
                    <input type="text" id="edit-address" placeholder="请输入地址">
                </div>
                <div class="ma-form-group">
                    <label>类型/房型</label>
                    <input type="text" id="edit-type" placeholder="请输入类型">
                </div>
            </div>
            <div class="ma-modal-footer">
                <button class="ma-btn ma-btn-default" onclick="closeEditModal()">取消</button>
                <button class="ma-btn ma-btn-primary" onclick="saveEdit()">保存</button>
            </div>
        </div>
    `;
    modal.style.display = 'none';
    document.body.appendChild(modal);
    return modal;
}

// 创建删除确认弹窗
function createDeleteModal() {
    const modal = document.createElement('div');
    modal.id = 'delete-modal';
    modal.className = 'ma-modal-overlay';
    modal.innerHTML = `
        <div class="ma-modal ma-modal-sm">
            <div class="ma-modal-header">
                <h3>确认删除</h3>
                <button class="ma-modal-close" onclick="closeDeleteModal()">&times;</button>
            </div>
            <div class="ma-modal-body">
                <p class="ma-delete-warning">⚠️ 确定要删除这条地址吗？</p>
                <p class="ma-delete-info" id="delete-info"></p>
            </div>
            <div class="ma-modal-footer">
                <button class="ma-btn ma-btn-default" onclick="closeDeleteModal()">取消</button>
                <button class="ma-btn ma-btn-danger" onclick="confirmDelete()">确认删除</button>
            </div>
        </div>
    `;
    modal.style.display = 'none';
    document.body.appendChild(modal);
    return modal;
}

let contextMenu = null;
let editModal = null;
let deleteModal = null;
let currentEditIndex = -1;
let currentDeleteIndex = -1;

// 显示右键菜单
function showContextMenu(e, index) {
    e.preventDefault();
    e.stopPropagation();
    
    currentEditIndex = index;
    currentDeleteIndex = index;
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    
    // 确保菜单不超出视口
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = (e.pageX - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = (e.pageY - rect.height) + 'px';
    }
}

// 隐藏右键菜单
function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

// 打开编辑弹窗
function openEditModal(index) {
    currentEditIndex = index;
    const item = addresses[index];
    
    document.getElementById('edit-name').value = item.name || '';
    document.getElementById('edit-address').value = item.address || '';
    document.getElementById('edit-type').value = item.type || '';
    
    editModal.style.display = 'flex';
    hideContextMenu();
}

// 关闭编辑弹窗
function closeEditModal() {
    editModal.style.display = 'none';
    currentEditIndex = -1;
}

// 保存编辑
async function saveEdit() {
    if (currentEditIndex < 0) return;
    
    const item = addresses[currentEditIndex];
    const name = document.getElementById('edit-name').value.trim();
    const address = document.getElementById('edit-address').value.trim();
    const type = document.getElementById('edit-type').value.trim();
    
    if (!address) {
        showUploadStatus('地址不能为空', 'error');
        return;
    }
    
    try {
        showUploadStatus('正在保存...', 'loading', true);
        
        const response = await fetch(`/addresses/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, address, type, lng: item.lng, lat: item.lat })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 更新本地数据
            addresses[currentEditIndex] = { ...addresses[currentEditIndex], name, address, type };
            renderAddressList();
            markAddressesOnMap(addresses);
            closeEditModal();
            showUploadStatus('保存成功', 'success');
        } else {
            showUploadStatus(result.error || '保存失败', 'error');
        }
    } catch (error) {
        showUploadStatus('保存失败，请检查网络', 'error');
    }
}

// 打开删除确认弹窗
function openDeleteModal(index) {
    currentDeleteIndex = index;
    const item = addresses[index];
    
    document.getElementById('delete-info').textContent = `${item.name || '未命名'} - ${item.address || '无地址'}`;
    deleteModal.style.display = 'flex';
    hideContextMenu();
}

// 关闭删除弹窗
function closeDeleteModal() {
    deleteModal.style.display = 'none';
    currentDeleteIndex = -1;
}

// 确认删除
async function confirmDelete() {
    if (currentDeleteIndex < 0) return;
    
    const item = addresses[currentDeleteIndex];
    
    try {
        showUploadStatus('正在删除...', 'loading', true);
        
        const response = await fetch(`/addresses/${item.id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 从本地数据中移除
            addresses.splice(currentDeleteIndex, 1);
            
            // 调整页码
            const maxPage = Math.max(1, Math.ceil(addresses.length / itemsPerPage));
            if (currentPage > maxPage) {
                currentPage = maxPage;
            }
            
            selectedCardIndex = -1;
            renderAddressList();
            markAddressesOnMap(addresses);
            closeDeleteModal();
            showUploadStatus('删除成功', 'success');
        } else {
            showUploadStatus(result.error || '删除失败', 'error');
        }
    } catch (error) {
        showUploadStatus('删除失败，请检查网络', 'error');
    }
}

// ========== 地址列表渲染 ==========

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
        
        // 左键点击 - 定位到地图
        li.onclick = () => {
            selectedCardIndex = i;
            updateSelectedCard();
            
            if (markers[i]) {
                map.centerAndZoom(markers[i].getPosition(), 16);
                markers[i].setAnimation(window.BMAP_ANIMATION_BOUNCE);
                setTimeout(() => markers[i].setAnimation(null), 1400);
            }
        };
        
        // 右键点击 - 显示菜单
        li.oncontextmenu = (e) => showContextMenu(e, i);
        
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
    
    if (uploadStatusTimer) {
        clearTimeout(uploadStatusTimer);
        uploadStatusTimer = null;
    }
    
    if (message && type === 'success') {
        uploadStatusTimer = setTimeout(() => {
            status.style.display = 'none';
            uploadStatusTimer = null;
        }, 3000);
    }
}

// ========== 地图相关 ==========

function markAddressesOnMap(addresses) {
    if (!map) return;
    map.clearOverlays();
    markers = [];
    const geocoder = new BMap.Geocoder();
    let points = [];
    
    addresses.forEach((item, idx) => {
        function addMarker(point) {
            const marker = new BMap.Marker(point);
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
            
            const infoHtml = `
                <div style='font-size:15px;font-weight:bold;margin-bottom:6px;'>名称：${item.name || ''}</div>
                <div style='margin-bottom:4px;'><b>地址：</b>${item.address || ''}</div>
                <div><b>类型：</b>${item.type || '无'}</div>
            `;
            const infoWindow = new BMap.InfoWindow(infoHtml, {
                width: 260,
                title: item.name || '地址信息',
                enableMessage: false
            });
            
            marker.addEventListener('click', function() {
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
    
    setTimeout(() => {
        if (points.length > 0) {
            map.setViewport(points);
        }
    }, 800);
}

// 定位到当前位置
function locateCurrentPosition() {
    if (!map) return;
    
    showUploadStatus('正在定位...', 'loading', true);
    
    const geolocation = new BMap.Geolocation();
    geolocation.getCurrentPosition(function(r) {
        if (this.getStatus() === BMAP_STATUS_SUCCESS) {
            map.panTo(r.point);
            map.setZoom(14);
            
            // 添加当前位置标记
            const marker = new BMap.Marker(r.point);
            map.addOverlay(marker);
            
            const circle = new BMap.Circle(r.point, r.accuracy, {
                strokeColor: '#1677ff',
                strokeWeight: 2,
                strokeOpacity: 0.5,
                fillColor: '#1677ff',
                fillOpacity: 0.1
            });
            map.addOverlay(circle);
            
            showUploadStatus(`已定位到：${r.address.province}${r.address.city}`, 'success');
        } else {
            showUploadStatus('定位失败，请检查定位权限', 'error');
        }
    }, { enableHighAccuracy: true });
}

// 添加定位按钮到地图
function addLocationButton() {
    const btn = document.createElement('div');
    btn.className = 'ma-location-btn';
    btn.innerHTML = '📍';
    btn.title = '定位到当前位置';
    btn.onclick = locateCurrentPosition;
    
    document.getElementById('map-container').appendChild(btn);
}

// 地址列表抽屉按钮逻辑
function initDrawerToggle() {
    const drawer = document.getElementById('drawerList');
    const btn = document.getElementById('drawerToggleBtn');
    let hidden = false;
    
    btn.querySelector('svg').style.transform = 'rotate(0deg)';

    btn.onclick = function() {
        hidden = !hidden;
        if (hidden) {
            drawer.classList.add('drawer-hidden');
            btn.querySelector('svg').style.transform = 'rotate(180deg)';
        } else {
            drawer.classList.remove('drawer-hidden');
            btn.querySelector('svg').style.transform = 'rotate(0deg)';
        }
    };
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
    // 创建弹窗和菜单
    contextMenu = createContextMenu();
    editModal = createEditModal();
    deleteModal = createDeleteModal();
    
    // 点击其他地方隐藏右键菜单
    document.addEventListener('click', hideContextMenu);
    
    // 右键菜单点击事件
    contextMenu.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.ma-menu-item');
        if (!menuItem) return;
        
        const action = menuItem.dataset.action;
        if (action === 'edit') {
            openEditModal(currentEditIndex);
        } else if (action === 'delete') {
            openDeleteModal(currentDeleteIndex);
        }
    });
    
    // 显示地图加载提示
    showMapLoading(true);
    
    // 等待百度地图API加载完成后初始化地图
    window.onBaiduMapLoaded(() => {
        initMap();
        addLocationButton();
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
        
        const fileInput = this;
        const formData = new FormData();
        formData.append('file', file);
        
        showUploadStatus('正在上传并解析文件...', 'loading', true);
        
        fetch('/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    addresses = res.data;
                    currentPage = 1;
                    selectedCardIndex = -1;
                    renderAddressList();
                    markAddressesOnMap(addresses);
                    showUploadStatus(`上传成功！共导入 ${addresses.length} 条地址`, 'success');
                } else {
                    showUploadStatus(res.error || '上传失败，请检查文件格式', 'error');
                }
            })
            .catch(() => showUploadStatus('上传失败，请检查网络连接', 'error'))
            .finally(() => {
                fileInput.value = '';
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
        renderAddressList();
    });
}

function initMap() {
    try {
        map = new BMap.Map('map-container');
        
        // 使用IP定位获取当前省份
        const localCity = new BMap.LocalCity();
        localCity.get((result) => {
            const cityName = result.name;
            map.centerAndZoom(cityName, 10);
        });
        
        map.enableScrollWheelZoom();
        map.addControl(new BMap.NavigationControl());
        map.addControl(new BMap.ScaleControl());
        
    } catch (error) {
        console.error('地图初始化失败:', error);
        showUploadStatus('地图加载失败，请刷新页面重试', 'error');
    }
}