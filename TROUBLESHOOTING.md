# 故障排查指南

本文档提供了部署和运行地图标绘系统时常见问题的解决方案。

## 问题1：应用无法启动

### 症状

应用容器一直处于重启状态，或者启动后立即退出。

### 可能原因

1. **数据库文件访问问题**：无法创建或访问SQLite数据库文件
2. **端口占用**：8080端口已被其他服务占用
3. **环境变量配置错误**：缺少必要的环境变量
4. **存储卷配置问题**：数据目录权限不足或未正确挂载

### 解决方案

#### 1. 检查服务状态

```bash
docker-compose ps
```

确保web服务状态为`Up`。如果不是，可以尝试重启服务：

```bash
docker-compose restart web
```

#### 2. 检查应用日志

```bash
docker-compose logs -f web
```

查找与数据库连接、端口绑定相关的错误信息。

#### 3. 检查数据库文件

确保数据目录存在且有正确的权限：

```bash
# 检查数据目录
ls -la ./data

# 如果目录不存在，创建它
mkdir -p ./data

# 设置权限
chmod 755 ./data
```

#### 4. 验证环境变量

在`docker-compose.yml`或部署平台中确认以下环境变量：

```yaml
environment:
  - PORT=8080
  - BAIDU_MAP_API_KEY=your_api_key_here
  - DB_PATH=./data/map_annotation.db
```

#### 5. 检查端口占用

```bash
# 检查8080端口是否被占用
lsof -i :8080
# 或
netstat -tuln | grep 8080
```

如果端口被占用，可以修改`docker-compose.yml`中的端口映射：

```yaml
services:
  web:
    ports:
      - "18080:8080"  # 主机端口:容器端口
```

## 问题2：数据丢失或无法持久化

### 症状

重启容器后，之前标注的数据消失了。

### 解决方案

#### 1. 确保数据卷正确配置

在`docker-compose.yml`中：

```yaml
services:
  web:
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
```

#### 2. 在云平台上配置存储卷

如果使用Zeabur等云平台部署：

- **挂载路径**: `/app/data`
- **用途**: SQLite数据库文件持久化

#### 3. 检查数据库文件

```bash
# 检查数据库文件是否存在
ls -lh ./data/map_annotation.db

# 检查数据库完整性
sqlite3 ./data/map_annotation.db "PRAGMA integrity_check;"
```

## 问题3：百度地图无法加载

### 症状

页面加载正常，但地图区域空白或显示错误。

### 解决方案

#### 1. 验证API密钥

确保`BAIDU_MAP_API_KEY`环境变量设置正确：

```bash
# 查看当前配置
docker-compose exec web printenv | grep BAIDU
```

#### 2. 检查API密钥权限

登录百度地图开放平台，确认：
- API密钥状态为"启用"
- IP白名单配置正确（建议设置为`0.0.0.0/0`用于测试）
- 配额未超限

#### 3. 检查网络连接

```bash
# 测试是否能访问百度地图API
curl -I https://api.map.baidu.com
```

## 问题4：Excel文件上传失败

### 症状

上传Excel文件时报错或上传后无数据。

### 解决方案

#### 1. 检查文件格式

Excel文件应包含以下列：
- 地址（必需）
- 名称（可选）
- 描述（可选）

#### 2. 检查上传目录权限

```bash
# 确保uploads目录存在且可写
mkdir -p ./uploads
chmod 755 ./uploads
```

#### 3. 检查文件大小限制

默认限制为10MB，如需修改，在`server.js`中调整：

```javascript
const upload = multer({ 
    dest: './uploads/',
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});
```

## 问题5：健康检查失败

### 症状

Docker健康检查一直显示`unhealthy`状态。

### 解决方案

#### 1. 手动运行健康检查脚本

```bash
docker-compose exec web node scripts/healthcheck.js
```

查看详细的错误信息。

#### 2. 调整健康检查配置

在`docker-compose.yml`中适当延长超时时间：

```yaml
healthcheck:
  test: ["CMD", "node", "scripts/healthcheck.js"]
  interval: 30s
  timeout: 10s
  start_period: 40s  # 增加启动等待时间
  retries: 3
```

## 获取更多帮助

如果以上方案无法解决您的问题，请：

1. 收集完整的日志信息：`docker-compose logs > logs.txt`
2. 记录问题的详细描述和复现步骤
3. 检查GitHub Issues或提交新Issue

---

**提示**: 大多数问题可以通过查看应用日志找到原因。使用`docker-compose logs -f web`实时查看日志是排查问题的最佳起点。
