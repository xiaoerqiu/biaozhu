/**
 * MongoDB连接健康检查脚本
 * 用于Docker环境中检测MongoDB连接状态
 */

const mongoose = require('mongoose');
const config = require('../config');

// 设置超时时间较短，以便快速检测
const options = {
  ...config.mongodb.options,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000
};

console.log('正在检查MongoDB连接...');
console.log(`尝试连接到: ${config.mongodb.uri}`);

mongoose.connect(config.mongodb.uri, options)
  .then(() => {
    console.log('MongoDB连接成功!');
    process.exit(0); // 成功退出
  })
  .catch(err => {
    console.error('MongoDB连接失败:', err.message);
    console.error('详细错误信息:', err);
    process.exit(1); // 失败退出
  });