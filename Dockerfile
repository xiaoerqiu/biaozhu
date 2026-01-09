# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖
RUN npm install

# 复制项目文件
COPY . .

# 生产阶段
FROM node:18-alpine

WORKDIR /app

# 安装 Python 和编译工具（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++

# 从构建阶段复制package*.json文件
COPY --from=builder /app/package*.json ./

# 从构建阶段复制node_modules目录
COPY --from=builder /app/node_modules ./node_modules

# 复制其他应用文件
COPY --from=builder /app .

# 创建必要的目录
RUN mkdir -p uploads data logs

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
