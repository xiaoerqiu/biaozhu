# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖并生成正确的 package-lock.json
RUN npm install

# 复制项目文件
COPY . .

# 生产阶段
FROM node:18-alpine

WORKDIR /app

# 从构建阶段复制package*.json文件
COPY --from=builder /app/package*.json ./

# 从构建阶段复制node_modules目录，确保所有依赖都被正确复制
COPY --from=builder /app/node_modules ./node_modules

# 复制其他应用文件
COPY --from=builder /app .

# 复制启动脚本
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 确保xlsx模块被正确安装
RUN npm list xlsx || npm install xlsx

# 创建 uploads 目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 使用启动脚本启动应用
CMD ["/app/docker-entrypoint.sh"]