# Docker部署指南

本指南详细说明如何使用Docker和Docker Compose部署地图标绘系统。

## 前置要求

- Docker (版本20.10+)
- Docker Compose (版本2.0+)
- 百度地图API密钥

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd biaozhu
```

### 2. 配置环境变量

创建`.env`文件（可选，也可直接在docker-compose.yml中配置）：

```bash
# 服务端口
PORT=8080

# 百度地图API密钥
BAIDU_MAP_API_KEY=your_baidu_map_api_key_here

# 数据库文件路径
DB_PATH=./data/map_annotation.db

# 日志级别
LOG_LEVEL=info
```

### 3. 启动服务

```bash
# 构建并启动
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f web
```

### 4. 访问应用

打开浏览器访问：`http://localhost:18000`

## 详细配置

### Docker Compose配置说明

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "18000:8080"  # 主机端口:容器端口
    environment:
      - NODE_ENV=production
      - PORT=8080
      - BAIDU_MAP_API_KEY=${BAIDU_MAP_API_KEY}
    volumes:
      - ./data:/app/data        # SQLite数据库持久化
      - ./uploads:/app/uploads  # 上传文件持久化
      - ./logs:/app/logs        # 日志文件持久化
    restart: always
    healthcheck:
      test: ["CMD", "node", "scripts/healthcheck.js"]
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3
```

### 数据持久化

项目使用本地目录挂载实现数据持久化：

| 本地目录 | 容器目录 | 用途 |
|---------|---------|------|
| `./data` | `/app/data` | SQLite数据库文件 |
| `./uploads` | `/app/uploads` | 用户上传的Excel文件 |
| `./logs` | `/app/logs` | 应用日志文件 |

**重要**: 确保这些目录存在且有正确的权限：

```bash
mkdir -p data uploads logs
chmod 755 data uploads logs
```

### 健康检查

容器配置了健康检查机制，定期检测SQLite数据库连接状态：

- **检查间隔**: 30秒
- **超时时间**: 10秒
- **启动等待**: 20秒
- **重试次数**: 3次

查看健康状态：

```bash
docker-compose ps
# 或
docker inspect --format='{{.State.Health.Status}}' biaozhu_web_1
```

## 常用操作

### 启动服务

```bash
# 前台启动（查看实时日志）
docker-compose up

# 后台启动
docker-compose up -d

# 重新构建并启动
docker-compose up -d --build
```

### 停止服务

```bash
# 停止服务
docker-compose stop

# 停止并删除容器
docker-compose down

# 停止并删除容器和卷（⚠️ 会删除所有数据）
docker-compose down -v
```

### 查看日志

```bash
# 实时查看日志
docker-compose logs -f

# 查看最后100行日志
docker-compose logs --tail=100

# 只查看web服务日志
docker-compose logs -f web
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启web服务
docker-compose restart web
```

### 进入容器

```bash
# 进入web容器的bash
docker-compose exec web sh

# 在容器中执行命令
docker-compose exec web node scripts/healthcheck.js
```

## 故障排查

### 问题1：服务无法启动

#### 检查日志
```bash
docker-compose logs web
```

#### 常见原因
1. **端口占用**: 检查18000端口是否被占用
   ```bash
   lsof -i :18000
   ```

2. **数据库文件权限**: 确保data目录可写
   ```bash
   ls -la ./data
   chmod 755 ./data
   ```

3. **环境变量缺失**: 检查BAIDU_MAP_API_KEY是否配置
   ```bash
   docker-compose config | grep BAIDU_MAP_API_KEY
   ```

### 问题2：数据无法持久化

#### 检查卷挂载
```bash
docker inspect biaozhu_web_1 | grep -A 10 Mounts
```

#### 验证数据目录
```bash
# 检查数据库文件
ls -lh ./data/map_annotation.db

# 检查数据库完整性
sqlite3 ./data/map_annotation.db "PRAGMA integrity_check;"
```

### 问题3：健康检查失败

#### 手动运行检查脚本
```bash
docker-compose exec web node scripts/healthcheck.js
```

#### 查看详细健康状态
```bash
docker inspect --format='{{json .State.Health}}' biaozhu_web_1 | jq
```

## 生产环境部署建议

### 1. 使用环境变量文件

创建`.env.production`：
```bash
NODE_ENV=production
PORT=8080
BAIDU_MAP_API_KEY=your_production_api_key
LOG_LEVEL=warn
```

启动时指定环境文件：
```bash
docker-compose --env-file .env.production up -d
```

### 2. 配置反向代理

使用Nginx作为反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:18000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 启用HTTPS

使用Let's Encrypt获取SSL证书：

```bash
sudo certbot --nginx -d your-domain.com
```

### 4. 配置日志轮转

在`docker-compose.yml`中添加日志配置：

```yaml
services:
  web:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5. 定期备份数据

创建备份脚本：

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
cp ./data/map_annotation.db $BACKUP_DIR/map_annotation_$DATE.db

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz ./uploads

# 保留最近7天的备份
find $BACKUP_DIR -type f -mtime +7 -delete

echo "备份完成: $DATE"
```

添加到crontab：
```bash
# 每天凌晨2点执行备份
0 2 * * * /path/to/backup.sh
```

## 性能优化

### 1. 调整容器资源限制

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 2. 启用应用层缓存

在Nginx中配置静态文件缓存：

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 监控和维护

### 监控容器状态

```bash
# 查看资源使用
docker stats biaozhu_web_1

# 查看容器详细信息
docker inspect biaozhu_web_1
```

### 定期维护

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune

# 查看磁盘使用
docker system df
```

## 更多帮助

- 查看[故障排查指南](TROUBLESHOOTING.md)
- 提交Issue到GitHub
- 查看Docker官方文档

---

**注意**: 本指南假设您使用的是SQLite数据库。所有配置都已针对SQLite进行优化。
