# Docker部署问题排查指南

## 常见问题：网页报错 "Failed to load resource: the server responded with a status of 500"

### 问题描述

部署后，浏览器控制台显示错误信息：`Failed to load resource: the server responded with a status of 500`，通常是在访问`/addresses`接口时出现。这表明服务器端发生了内部错误，无法正常返回地址数据。

### 可能原因

1. **MongoDB连接问题**：应用无法连接到MongoDB数据库服务
2. **数据库服务未完全启动**：应用启动时，MongoDB服务可能尚未准备好接受连接
3. **网络配置问题**：Docker容器间网络通信受阻
4. **数据库认证失败**：如果MongoDB配置了认证，但连接字符串中的凭据不正确

### 解决方案

#### 1. 检查MongoDB服务状态

```bash
docker-compose ps
```

确保mongodb服务状态为`Up`。如果不是，可以尝试重启服务：

```bash
docker-compose restart mongodb
```

#### 2. 检查MongoDB连接日志

```bash
docker-compose logs mongodb
```

查看是否有错误信息或异常。

#### 3. 检查应用服务日志

```bash
docker-compose logs web
```

查找与MongoDB连接相关的错误信息。

#### 4. 运行MongoDB连接测试

我们提供了测试脚本来诊断MongoDB连接问题：

```bash
docker-compose exec web node scripts/check-mongodb.js
```

这将提供基本的连接诊断信息。

#### 4.1 运行高级诊断脚本

如果基本连接测试无法解决问题，请使用我们的高级诊断脚本：

```bash
docker-compose exec web node scripts/diagnose-mongodb.js
```

这个脚本会提供更详细的网络诊断信息，包括：
- DNS解析测试
- TCP连接测试
- Docker网络配置检查
- 具体的解决方案建议

#### 5. 修改MongoDB连接URI

如果您使用的是外部MongoDB服务或不同的服务名称，需要相应地修改连接URI：

在`docker-compose.yml`中：

```yaml
services:
  web:
    environment:
      - MONGODB_URI=mongodb://your-mongodb-host:27017/map_annotation
```

**重要提示**：如果遇到持续的连接问题，尝试使用Docker默认网桥IP地址替代服务名：

```yaml
services:
  web:
    environment:
      - MONGODB_URI=mongodb://172.17.0.1:27017/map_annotation
```

这可以解决Docker容器间DNS解析问题。

#### 6. 确保容器启动顺序正确

在`docker-compose.yml`中，我们已经配置了依赖关系和健康检查，确保web服务在MongoDB准备好后才启动：

```yaml
depends_on:
  mongodb:
    condition: service_healthy
```

如果您修改了这些配置，请确保恢复它们。

#### 7. 重建并重启所有服务

有时候，完全重建容器可以解决问题：

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## 其他常见问题

### 上传Excel文件失败

#### 可能原因

1. 文件格式不正确
2. 文件太大
3. `uploads`目录权限问题

#### 解决方案

1. 确保Excel文件格式正确，包含必要的列（如`address`列）
2. 检查`uploads`目录是否存在且有正确的权限：

```bash
docker-compose exec web ls -la /app/uploads
```

### 地图无法显示

#### 可能原因

1. 百度地图API密钥无效或未正确配置
2. 网络连接问题

#### 解决方案

1. 检查百度地图API密钥配置：

```bash
docker-compose exec web cat config.js | grep apiKey
```

2. 在`docker-compose.yml`中设置正确的API密钥：

```yaml
services:
  web:
    environment:
      - BAIDU_MAP_API_KEY=your_api_key_here
```

## 如何获取更多帮助

如果上述解决方案无法解决您的问题，请提供以下信息寻求帮助：

1. 完整的错误日志：`docker-compose logs > logs.txt`
2. 系统环境信息：Docker版本、操作系统等
3. 您对`docker-compose.yml`和`Dockerfile`的任何修改