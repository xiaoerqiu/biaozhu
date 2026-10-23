# 地图标注系统

基于高德/百度地图的轻量级地址标注与可视化系统：导入 Excel 地址表，自动定位并在地图上展示、检索和维护标记点。默认使用高德地图，支持后端配置切换。

## ✨ 功能特性

- 📥 **Excel 批量导入**：点击或直接拖拽文件到页面，支持 `.xlsx / .xls / .csv`，可选择「追加」或「替换」现有数据
- 🈶 **中英文表头**：自动识别 `地址/address`、`名称/name`、`类型/type`、`经度/lng`、`纬度/lat` 等常见列名
- 🎯 **自动定位**：未提供坐标的地址自动地理编码（限速队列 + 失败重试），结果回写数据库，下次打开无需重复定位
- 🗺️ **双地图引擎**：高德地图（默认）/ 百度地图，后端配置一键切换
- 🎨 **可视化标记**：编号标记按类型着色，悬停显示名称，信息窗口支持编辑、删除、复制坐标、一键导航
- 🔍 **搜索与筛选**：按名称/地址/类型实时搜索并高亮，按类型或「未定位」快速筛选，地图自动缩放到筛选结果
- ✏️ **地址维护**：新增、编辑、删除（支持撤销），可在地图上点选位置并自动反查地址
- 📤 **导出与模板**：一键导出全部数据为 Excel（可直接重新导入），提供标准导入模板下载
- ⌨️ **键盘操作**：`/` 搜索、`↑ ↓` 切换、`Enter` 定位、`N` 新增、`E` 编辑、`Delete` 删除、`Esc` 取消
- 📱 **移动端适配**：手机上地图全屏，列表为可上拉的底部抽屉
- 🐳 **容器化部署**：Docker 部署，SQLite 持久化

## 🏗️ 技术架构

| 层 | 技术 |
|----|------|
| 前端 | 原生 HTML/CSS/JavaScript（ES Modules，无需构建），高德 JS API 2.0 / 百度地图 JS API GL |
| 后端 | Node.js 18+、Express、better-sqlite3、Multer（内存存储）、xlsx、winston |
| 部署 | Docker / Docker Compose |

## 🚀 快速开始

### 1. 获取地图 API 密钥

- **高德地图（默认）**：在 [高德开放平台](https://console.amap.com/dev/key/app) 申请，类型选择「Web端(JS API)」，同时获取安全密钥
- **百度地图（备选）**：在 [百度地图开放平台](https://lbsyun.baidu.com/apiconsole/key) 申请浏览器端 AK

### 2. 配置环境变量

```bash
cp .env.example .env
```

```env
PORT=3000
LOG_LEVEL=info

# 地图服务商：amap（高德，默认）或 baidu（百度）
MAP_PROVIDER=amap

AMAP_API_KEY=your_amap_api_key_here
AMAP_SECURITY_KEY=your_amap_security_key_here

BAIDU_MAP_API_KEY=your_baidu_map_api_key_here

# 可选：数据库文件路径（默认 ./data/map_annotation.db）
# DB_PATH=./data/map_annotation.db
```

### 3. 本地运行

```bash
npm install
npm start        # 生产模式
npm run dev      # 开发模式（热重载）
npm test         # 运行接口测试
```

### 4. Docker 部署

```bash
docker-compose up -d       # 构建并启动，访问 http://localhost:18000
docker-compose logs -f     # 查看日志
docker-compose down        # 停止
```

`docker-compose.yml` 会从同目录的 `.env` 读取地图密钥并传入容器；`.env` 本身不会打包进镜像。

## 📖 使用指南

### Excel 格式

读取第一个工作表，表头支持中文或英文（不区分大小写）：

| 字段 | 可识别的表头 | 必填 | 示例 |
|------|-------------|------|------|
| 地址 | `address` `地址` `详细地址` `位置` | ✅ | 杭州市西湖区杨公堤18号 |
| 名称 | `name` `名称` `酒店名称` `地点名称` … | | 西湖国宾馆 |
| 类型 | `type` `类型` `房型` `分类` `标签` … | | 湖景房 |
| 经度 | `lng` `lon` `longitude` `经度` | | 120.130953 |
| 纬度 | `lat` `latitude` `纬度` | | 30.246273 |

- 地址为空的行会被跳过；超出范围的坐标会被忽略并改为自动定位
- 坐标需与所用地图的坐标系一致（高德为 GCJ-02，百度为 BD-09）
- 单个文件最大 10MB、5000 行（可在 `config.js` 中调整）
- 页面右上角「更多 → 下载导入模板」可获取标准模板

### 操作说明

1. **导入**：点击「导入 Excel」或将文件拖到页面任意位置；已有数据时可选择追加或替换
2. **自动定位**：列表顶部显示定位进度，定位失败的地址会标记「定位失败」，可通过编辑地址或「在地图上选点」修正
3. **查看**：点击列表项或地图标记，地图定位到该点并弹出信息窗口
4. **筛选**：顶部搜索框实时过滤；点击类型标签按类型筛选，「未定位」标签可快速找到需处理的地址
5. **维护**：悬停列表项显示编辑/更多按钮，也可右键打开菜单；删除后可在提示中「撤销」
6. **导出**：点击「导出」下载当前全部数据

## 🗂️ 项目结构

```text
.
├── server.js                 # 启动入口（监听端口、优雅关闭）
├── app.js                    # Express 应用（静态资源、路由挂载、健康检查）
├── config.js                 # 配置（端口、数据库、上传限制、地图服务商）
├── routes/
│   └── api.js                # /api 接口与统一错误处理
├── services/
│   └── excel.js              # Excel 解析（表头别名、坐标校验）、导出与模板生成
├── models/
│   └── db.js                 # SQLite 数据访问
├── utils/
│   └── logger.js             # 日志
├── scripts/
│   └── healthcheck.js        # Docker 健康检查
├── test/
│   └── api.test.js           # 接口测试（node:test）
└── public/
    ├── index.html
    ├── css/
    │   ├── base.css          # 设计变量、重置、按钮
    │   ├── components.css    # 卡片、标签、对话框、提示、菜单、地图标记、信息窗口
    │   └── layout.css        # 页面布局与响应式
    └── js/
        ├── main.js           # 应用入口，协调各模块
        ├── config.js         # 前端配置常量
        ├── api.js            # 接口请求封装
        ├── store.js          # 应用状态与派生数据（筛选、统计、颜色）
        ├── geocoder.js       # 地理编码队列（限速、重试、超时、批量回写）
        ├── utils.js          # 转义、高亮、复制等工具函数
        ├── map/
        │   ├── loader.js     # 地图 SDK 动态加载（含超时处理）
        │   ├── amap.js       # 高德地图适配器
        │   ├── baidu.js      # 百度地图适配器
        │   └── markers.js    # 标记外观
        └── ui/
            ├── sidebar.js    # 侧边栏：搜索、筛选、列表
            ├── addressForm.js# 新增/编辑对话框
            ├── importer.js   # 文件导入与拖拽
            ├── dialog.js     # 通用对话框
            ├── menu.js       # 下拉/右键菜单
            └── toast.js      # 轻提示
```

两个地图适配器实现相同的接口（`setMarkers`、`focus`、`fitView`、`openInfo`、`geocode`、`reverseGeocode`、`locate` 等），新增地图服务商只需新增一个适配器。

## 🔧 API 接口

所有接口返回 JSON，失败时为 `{ "success": false, "error": "原因" }`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/map-key` | 获取地图服务商与密钥 |
| GET | `/api/addresses` | 获取全部地址 |
| POST | `/api/addresses` | 新增地址，body：`{ name, address, type, lng, lat }` |
| PUT | `/api/addresses/:id` | 更新地址 |
| DELETE | `/api/addresses/:id` | 删除地址 |
| DELETE | `/api/addresses` | 清空全部地址 |
| PATCH | `/api/addresses/locations` | 批量回写坐标，body：`[{ id, lng, lat }]` |
| POST | `/api/upload?mode=append\|replace` | 导入 Excel（字段名 `file`），默认 `replace` |
| GET | `/api/export` | 导出全部地址为 Excel |
| GET | `/api/template` | 下载导入模板 |
| GET | `/health` | 健康检查 |

**导入响应示例：**

```json
{
  "success": true,
  "mode": "append",
  "imported": 15,
  "skipped": 1,
  "data": [
    { "id": 1, "name": "西湖国宾馆", "address": "杭州市西湖区杨公堤18号", "type": "酒店",
      "lng": 120.130953, "lat": 30.246273, "created_at": "...", "updated_at": "..." }
  ]
}
```

## 📊 数据库

**addresses 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键（自增） |
| name | TEXT | 名称 |
| address | TEXT | 地址（必填） |
| type | TEXT | 类型 |
| lng | REAL | 经度 |
| lat | REAL | 纬度 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

数据库文件位于 `data/map_annotation.db`，Docker 部署时通过 `./data` 卷持久化。

## 🛠️ 故障排查

- **地图显示「未配置地图 API 密钥」**：检查 `.env` 中对应服务商的密钥并重启服务
- **地图加载失败/超时**：高德需确认密钥类型为「Web端(JS API)」且安全密钥正确；百度需确认 AK 开通了 JavaScript API；检查网络后点击「重新加载」
- **部分地址定位失败**：补充省市区等完整信息后重新编辑，或在编辑窗口中「在地图上选点」
- **查看日志**：`logs/app.log`、`logs/error.log`，或 `docker-compose logs -f`；设置 `LOG_LEVEL=debug` 可输出 SQL 语句

更多内容见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 与 [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)。

## 📄 许可证

MIT License
