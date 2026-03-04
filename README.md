# 地图标注系统

基于高德/百度地图的轻量级地址标注与可视化系统，支持批量导入Excel数据并在地图上展示标记点。默认使用高德地图，支持后端配置切换。

## ✨ 功能特性

- 📍 **批量地址标注**：支持Excel文件批量导入地址数据
- 🗺️ **双地图引擎**：支持高德地图（默认）和百度地图，后端配置一键切换
- 🎯 **地理编码**：自动将地址转换为地图坐标
- 💾 **数据持久化**：使用SQLite轻量级数据库存储
- 🐳 **容器化部署**：Docker容器化部署，开箱即用
- 📱 **响应式设计**：支持桌面和移动端访问

## 🏗️ 技术架构

### 前端
- HTML5 + CSS3 + JavaScript
- 高德地图 JS API 2.0（默认）/ 百度地图 JavaScript API
- 响应式布局设计

### 后端
- Node.js + Express
- SQLite数据库（better-sqlite3）
- Multer文件上传
- xlsx Excel文件解析

### 部署
- Docker + Docker Compose
- Nginx反向代理（可选）

## 📋 系统要求

- Node.js 18+
- Docker & Docker Compose（容器化部署）
- 高德地图API密钥 或 百度地图API密钥

## 🚀 快速开始

### 1. 获取地图API密钥

**高德地图（默认）**：访问 [高德开放平台](https://console.amap.com/dev/key/app) 申请API密钥，选择"Web端(JS API)"类型

**百度地图（备选）**：访问 [百度地图开放平台](https://lbsyun.baidu.com/apiconsole/key) 申请API密钥

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置地图服务商和API密钥：

```env
PORT=3000
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# 地图服务商：amap（高德，默认）或 baidu（百度）
MAP_PROVIDER=amap

# 高德地图API配置
AMAP_API_KEY=your_amap_api_key_here
AMAP_SECURITY_KEY=your_amap_security_key_here

# 百度地图API配置（使用百度地图时需要）
BAIDU_MAP_API_KEY=your_baidu_map_api_key_here
```

### 3. 使用Docker部署（推荐）

```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

服务将在 `http://localhost:18000` 启动

### 4. 本地开发部署

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式（热重载）
npm run dev
```

服务将在 `http://localhost:3000` 启动

## � 切换地图服务商

修改 `.env` 文件中的 `MAP_PROVIDER` 即可切换地图引擎：

```env
# 使用高德地图（默认）
MAP_PROVIDER=amap

# 切换到百度地图
MAP_PROVIDER=baidu
```

修改后重启服务即可生效。

## �📖 使用指南

### Excel文件格式

Excel文件需包含以下列（表头名称必须匹配）：

| 列名 | 说明 | 必填 | 示例 |
|------|------|------|------|
| name | 名称 | 否 | 杭州西湖国宾馆 |
| address | 地址 | 是 | 杭州市西湖区杨公堤18号 |
| type | 类型 | 否 | 豪华湖景大床房 |
| lng | 经度 | 否 | 120.130953 |
| lat | 纬度 | 否 | 30.246273 |

**示例Excel数据：**

```
| name         | address              | type       | lng        | lat       |
|--------------|----------------------|------------|------------|----------|
| 西湖国宾馆    | 杭州市西湖区杨公堤18号 | 酒店       | 120.130953 | 30.246273 |
| 香格里拉饭店  | 杭州市西湖区北山路78号 | 酒店       | 120.147835 | 30.261654 |
```

### 操作步骤

1. **上传Excel文件**：点击"上传文件"按钮，选择包含地址数据的Excel文件
2. **自动解析**：系统自动解析Excel并提取地址信息
3. **地理编码**：系统调用地图API将地址转换为坐标（如果Excel中未提供坐标）
4. **地图展示**：所有地址自动显示在地图上，可点击查看详情
5. **数据持久化**：地址数据自动保存到SQLite数据库

## 🗂️ 项目结构

```
.
├── server.js              # Express服务器主文件
├── config.js              # 配置文件（含地图服务商切换）
├── models/
│   └── db.js             # SQLite数据库模型
├── utils/
│   └── logger.js         # 日志工具
├── public/
│   ├── index.html        # 前端页面（动态加载地图SDK）
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       └── main.js       # 前端逻辑（高德/百度适配器）
├── uploads/              # 文件上传目录
├── data/                 # SQLite数据库文件目录
├── logs/                 # 日志文件目录
├── docker-compose.yml    # Docker Compose配置
├── Dockerfile            # Docker镜像配置
├── .dockerignore        # Docker忽略文件
├── .gitignore           # Git忽略文件
├── .env.example         # 环境变量示例
└── package.json         # NPM依赖配置
```

## 🔧 API接口

### 上传Excel文件

```http
POST /upload
Content-Type: multipart/form-data

file: Excel文件
```

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "name": "西湖国宾馆",
      "address": "杭州市西湖区杨公堤18号",
      "type": "酒店",
      "lng": 120.130953,
      "lat": 30.246273
    }
  ]
}
```

### 获取所有地址

```http
GET /addresses
```

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "西湖国宾馆",
      "address": "杭州市西湖区杨公堤18号",
      "type": "酒店",
      "lng": 120.130953,
      "lat": 30.246273,
      "created_at": "2024-01-09T10:30:00.000Z",
      "updated_at": "2024-01-09T10:30:00.000Z"
    }
  ]
}
```

### 获取地图配置

```http
GET /api/map-key
```

**响应（高德地图）：**

```json
{
  "success": true,
  "provider": "amap",
  "apiKey": "your_amap_key",
  "securityJsCode": "your_security_key"
}
```

**响应（百度地图）：**

```json
{
  "success": true,
  "provider": "baidu",
  "apiKey": "your_baidu_key"
}
```

### 健康检查

```http
GET /health
```

**响应：**

```json
{
  "status": "ok",
  "database": "sqlite",
  "records": 10
}
```

## 🐳 Docker部署详解

### 构建镜像

```bash
docker build -t map-annotation .
```

### 运行容器

```bash
docker run -d \
  -p 18000:3000 \
  -e MAP_PROVIDER=amap \
  -e AMAP_API_KEY=your_amap_key \
  -e AMAP_SECURITY_KEY=your_security_key \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --name map-annotation \
  map-annotation
```

### 数据持久化

Docker volumes挂载以下目录实现数据持久化：

- `./uploads` - 上传的Excel文件
- `./data` - SQLite数据库文件
- `./logs` - 应用日志

## 📊 数据库

### SQLite数据库结构

**addresses表：**

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

**索引：**
- `idx_address` - 地址索引
- `idx_created_at` - 创建时间索引

## 🔐 安全性

- 文件上传大小限制
- 输入数据验证
- API密钥环境变量隔离
- Docker容器隔离运行

## 🛠️ 故障排查

### 地图无法显示

1. 检查地图API密钥是否正确配置
2. **高德地图**：确认密钥类型为"Web端(JS API)"，安全密钥已正确填写
3. **百度地图**：确认API密钥的服务权限包含"JavaScript API"
4. 检查浏览器控制台错误信息

### 地址无法标注

1. 确认地址格式正确（包含省市区详细信息）
2. 检查网络连接是否正常
3. 查看服务器日志：`docker-compose logs -f`

### 数据库问题

1. 确认data目录存在且有写权限
2. 检查数据库文件：`ls -la data/`
3. 查看SQLite数据库：`sqlite3 data/map_annotation.db "SELECT * FROM addresses"`

## 📝 开发说明

### 依赖管理

```bash
# 安装依赖
npm install

# 更新依赖
npm update

# 审计安全问题
npm audit fix
```

### 日志级别

支持的日志级别：`error`, `warn`, `info`, `debug`

在 `.env` 文件中配置：

```env
LOG_LEVEL=info
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [高德开放平台](https://lbs.amap.com/)
- [高德地图 JS API 2.0 文档](https://lbs.amap.com/api/javascript-api-v2/summary)
- [百度地图开放平台](https://lbsyun.baidu.com/)
- [百度地图JavaScript API文档](https://lbsyun.baidu.com/cms/jsapi/reference/jsapi_reference_3_0.html)
- [Express框架](https://expressjs.com/)
- [SQLite](https://www.sqlite.org/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

## 📧 联系方式

如有问题或建议，欢迎通过GitHub Issues联系。
