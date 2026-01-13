FROM node:18-alpine

WORKDIR /app

# 安装编译工具（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++ sqlite

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖（包括原生模块编译）
RUN npm install --build-from-source

# 复制项目文件
COPY . .

# 创建必要的目录
RUN mkdir -p uploads data logs

# 清理构建工具减小镜像体积（可选）
RUN apk del make g++ && rm -rf /var/cache/apk/*

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
