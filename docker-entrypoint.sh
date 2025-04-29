#!/bin/sh

echo "等待MongoDB服务启动..."
while ! node -e "require('mongoose').connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).then(() => process.exit(0)).catch(() => process.exit(1))"; do
  echo "等待MongoDB连接..."
  sleep 1
done
echo "MongoDB已就绪，启动应用..."
npm start 