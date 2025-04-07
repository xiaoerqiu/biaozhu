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

# 从构建阶段复制所有文件
COPY --from=builder /app .

# 只安装生产依赖
RUN npm install --omit=dev && npm cache clean --force

# 创建 uploads 目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]