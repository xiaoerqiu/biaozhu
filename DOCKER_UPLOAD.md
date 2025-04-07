# 将Docker镜像上传到DockerHub的步骤

## 前提条件
1. 已经在 [DockerHub](https://hub.docker.com) 注册账号
2. 本地已经构建好Docker镜像
3. 已安装Docker Desktop或Docker CLI

## 详细步骤

### 1. 登录DockerHub
```bash
docker login
```
输入你的DockerHub用户名和密码

### 2. 查看本地镜像
```bash
docker images
```
找到你要上传的镜像ID或名称

### 3. 给镜像打标签
```bash
docker tag map-annotation-system:latest 你的用户名/map-annotation-system:latest
```
注意：
- `map-annotation-system` 是当前项目的镜像名
- `你的用户名` 替换为你的DockerHub用户名
- `latest` 是版本标签，你也可以使用其他版本号

### 4. 推送镜像到DockerHub
```bash
docker push 你的用户名/map-annotation-system:latest
```

### 5. 验证上传
- 登录 [DockerHub](https://hub.docker.com)
- 在你的仓库中应该能看到刚刚上传的镜像

## 使用示例
假设你的DockerHub用户名是 `example`：
```bash
# 登录DockerHub
docker login

# 给本地镜像打标签
docker tag map-annotation-system:latest example/map-annotation-system:latest

# 推送到DockerHub
docker push example/map-annotation-system:latest
```

## 注意事项
1. 确保有足够的网络带宽，因为Docker镜像可能比较大
2. 如果遇到权限问题，确保已经正确登录DockerHub
3. 推送大型镜像时可能需要一些时间，请耐心等待
4. 建议在推送前优化镜像大小，删除不必要的文件