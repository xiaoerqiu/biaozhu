# 地图标注系统

一个基于百度地图的地址标注可视化系统，支持上传Excel文件批量标注地点位置。

## 功能特性

- ✅ **Excel文件解析** - 支持上传.xlsx/.xls格式文件
- 🗺️ **地图标注** - 自动在百度地图上标注地址位置
- 📍 **位置可视化** - 直观显示多个地点的相对位置关系
- 🏷️ **信息展示** - 显示酒店名称、地址、房型等详细信息
- 💾 **数据持久化** - MongoDB存储，支持数据恢复
- 📱 **响应式设计** - 支持PC和移动端访问

## 技术栈

- **后端**: Node.js + Express
- **数据库**: MongoDB
- **地图服务**: 百度地图API
- **文件解析**: xlsx
- **日志**: Winston

## 前置要求

- Node.js >= 14.0
- MongoDB >= 4.0
- 百度地图API密钥（[申请地址](https://lbsyun.baidu.com/apiconsole/key)）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

```env
# MongoDB连接地址
MONGODB_URI=mongodb://localhost:27017/map_annotation

# 服务器端口
PORT=3000

# 百度地图API密钥（必填）
BAIDU_MAP_API_KEY=your_actual_api_key_here
```

### 3. 启动MongoDB

确保MongoDB服务已启动：

```bash
# Linux/Mac
sudo systemctl start mongod
# 或使用 Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. 启动应用

```bash
# 生产模式
npm start

# 开发模式（自动重启）
npm run dev
```

### 5. 访问应用

打开浏览器访问：`http://localhost:3000`

## Excel文件格式

Excel文件需包含以下列（列名可自定义，但必须包含地址信息）：

| 列名 | 说明 | 必填 |
|------|------|------|
| name | 酒店/地点名称 | 否 |
| address | 详细地址 | **是** |
| type | 房型/类型 | 否 |
| contact | 联系人 | 否 |
| phone | 联系电话 | 否 |

**示例数据：**

```
name,address,type,contact,phone
杭州西湖宾馆,浙江省杭州市西湖区北山街37号,豪华双床房,张三,13800138000
杭州黄龙饭店,浙江省杭州市西湖区曙光路120号,标准大床房,李四,13900139000
```

## 使用说明

1. **上传Excel文件**
   - 点击右侧「上传Excel文件」按钮
   - 选择符合格式的Excel文件
   - 系统自动解析并在地图上标注

2. **查看地址列表**
   - 右侧面板显示所有地址
   - 点击地址卡片可定位到地图
   - 支持分页浏览

3. **地图交互**
   - 点击标记点查看详细信息
   - 拖拽和缩放地图
   - 自动调整视野以显示所有标记点

4. **隐藏/显示列表**
   - 点击抽屉切换按钮控制列表显示
   - 移动端自动适配

## 项目结构

```
.
├── server.js              # Express服务器入口
├── config.js              # 配置文件
├── package.json           # 依赖配置
├── .env.example           # 环境变量模板
├── models/
│   └── address.js         # MongoDB数据模型
├── utils/
│   └── logger.js          # 日志工具
├── public/
│   ├── index.html         # 前端页面
│   ├── css/               # 样式文件
│   └── js/
│       └── main.js        # 前端逻辑
├── uploads/               # 临时文件目录
└── logs/                  # 日志目录
```

## API接口

### 上传Excel文件

```http
POST /upload
Content-Type: multipart/form-data

file: [Excel文件]
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "name": "酒店名称",
      "address": "详细地址",
      "type": "房型"
    }
  ]
}
```

### 获取地址列表

```http
GET /addresses
```

**响应：**
```json
{
  "success": true,
  "data": [/* 地址数组 */]
}
```

### 获取地图API密钥

```http
GET /api/map-key
```

**响应：**
```json
{
  "success": true,
  "apiKey": "your_api_key"
}
```

### 健康检查

```http
GET /health
```

## Docker部署

### 使用Docker Compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 手动构建

```bash
# 构建镜像
docker build -t map-annotation-system .

# 运行容器
docker run -d -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/map_annotation \
  -e BAIDU_MAP_API_KEY=your_api_key \
  map-annotation-system
```

## 常见问题

### 1. MongoDB连接失败

**问题**: `MongoDB 连接失败`

**解决**:
- 确认MongoDB服务已启动
- 检查`.env`中的`MONGODB_URI`配置
- 查看日志文件：`logs/error.log`

### 2. 地图无法显示

**问题**: 地图区域空白

**解决**:
- 检查百度地图API密钥是否正确
- 确认API密钥的配额未超限
- 打开浏览器控制台查看错误信息

### 3. 地址无法标注

**问题**: 上传Excel后地图上没有标记

**解决**:
- 确认Excel中的地址列名为`address`
- 检查地址格式是否完整（需包含省市区）
- 查看浏览器控制台的地理编码错误

### 4. Excel解析失败

**问题**: `文件处理失败`

**解决**:
- 确认文件格式为`.xlsx`或`.xls`
- 检查Excel文件是否包含`address`列
- 文件大小不要超过10MB

## 开发指南

### 添加新字段

1. 修改 `models/address.js` 添加字段定义
2. 更新前端 `main.js` 的显示逻辑
3. 调整 `public/index.html` 的UI展示

### 自定义地图样式

编辑 `public/css/map-styles.css` 文件。

### 修改日志配置

编辑 `utils/logger.js` 调整日志级别和输出路径。

## 性能优化

- 批量导入：默认每批100条数据
- 请求队列：限制地理编码QPS为30
- 连接池：MongoDB连接池大小50
- 日志轮转：单个日志文件最大5MB

## 安全建议

- ⚠️ **不要**将`.env`文件提交到Git仓库
- ⚠️ 定期更换百度地图API密钥
- ⚠️ 生产环境使用环境变量而非配置文件
- ⚠️ 启用MongoDB认证机制

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

如有问题，请提交Issue或联系开发团队。
