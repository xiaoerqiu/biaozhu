FROM node:20-alpine

WORKDIR /app

# 安装编译工具（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++ sqlite

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖（包括原生模块编译）
RUN npm install --build-from-source

# 复制项目文件
COPY . .

# 创建必要的目录并设置权限
RUN mkdir -p /app/uploads /app/data /app/logs && \
    chmod -R 755 /app/uploads /app/data /app/logs

# 声明需要持久化的卷（云平台会识别这些目录）
VOLUME ["/app/data", "/app/uploads", "/app/logs"]

# 清理构建工具减小镜像体积
RUN apk del make g++ && rm -rf /var/cache/apk/*

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node scripts/healthcheck.js || exit 1

# 启动应用
CMD ["npm", "start"]
