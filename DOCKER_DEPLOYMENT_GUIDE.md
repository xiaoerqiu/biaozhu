# Docker部署指南与常见问题解决

## 部署到其他Docker服务器的步骤

### 1. 准备工作
- 确保目标服务器已安装Docker和Docker Compose
- 将项目代码复制到目标服务器

### 2. 构建和启动容器
```bash
# 在项目根目录下执行
docker-compose up -d --build
```

### 3. 验证服务状态
```bash
# 查看容器运行状态
docker-compose ps

# 查看容器日志
docker-compose logs -f web
```

## 常见问题与解决方案

### 问题：控制台显示 500 Internal Server Error

#### 错误表现
- 浏览器控制台显示 `Failed to load resource: the server responded with a status of 500`
- 访问 `/addresses` 接口返回 500 错误

#### 可能原因
1. **MongoDB连接问题**：web服务无法连接到MongoDB服务

#### 解决方案

##### 1. 检查MongoDB服务是否正常运行
```bash
docker-compose ps
```
确保mongodb服务状态为`Up`

##### 2. 检查网络连接
在不同的Docker环境中，服务之间的网络连接方式可能有所不同。确保在`docker-compose.yml`中正确配置了服务依赖和网络设置：

```yaml
services:
  web:
    # ...
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/map_annotation
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - app-network

  mongodb:
    # ...
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

##### 3. 修改MongoDB连接URI
如果您使用的是外部MongoDB服务或不同的服务名称，需要相应地修改连接URI：

在`config.js`中：
```javascript
mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/map_annotation',
    // ...
}
```

可以通过环境变量设置正确的MongoDB URI：
```yaml
services:
  web:
    environment:
      - MONGODB_URI=mongodb://your-mongodb-host:27017/map_annotation
```

##### 4. 增加连接重试和超时设置
在某些网络环境下，可能需要增加连接超时和重试次数：

```javascript
// 在config.js中增加超时设置
mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/map_annotation',
    options: {
        connectTimeoutMS: 60000,         // 增加到60秒
        socketTimeoutMS: 120000,         // 增加到120秒
        serverSelectionTimeoutMS: 60000, // 增加到60秒
        // ...
    }
}
```

##### 5. 检查容器日志
查看web和mongodb容器的日志，寻找更具体的错误信息：

```bash
docker-compose logs -f web
docker-compose logs -f mongodb
```

## 其他常见问题

### 数据持久化
确保正确配置了数据卷，以便在容器重启后保留数据：

```yaml
services:
  mongodb:
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

### 端口冲突
如果目标服务器上的端口已被占用，可以修改端口映射：

```yaml
services:
  web:
    ports:
      - "8080:3000"  # 将主机的8080端口映射到容器的3000端口
```

### 容器间通信
在Docker环境中，服务之间应通过服务名而非IP地址通信。确保在代码中使用服务名作为主机名。

## 部署后的维护

### 更新应用
```bash
# 拉取最新代码后
docker-compose down
docker-compose up -d --build
```

### 备份数据
```bash
# 备份MongoDB数据
docker exec -it biaozhu_mongodb_1 mongodump --out /data/backup
```

### 查看应用状态
```bash
# 查看应用健康状态
curl http://localhost:3000/health
```