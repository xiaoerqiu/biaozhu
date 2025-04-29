/**
 * MongoDB连接测试脚本
 * 用于Docker环境中测试MongoDB连接并提供详细的诊断信息
 */

const mongoose = require('mongoose');
const config = require('../config');

// 获取MongoDB URI
const uri = process.env.MONGODB_URI || config.mongodb.uri;

console.log('===== MongoDB连接测试 =====');
console.log(`尝试连接到: ${uri}`);
console.log('连接选项:', JSON.stringify(config.mongodb.options, null, 2));

// 设置更短的超时时间用于测试
const testOptions = {
  ...config.mongodb.options,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000
};

// 尝试解析MongoDB URI
try {
  const uriParts = uri.split('://');
  const protocol = uriParts[0];
  const hostPart = uriParts[1].split('/')[0];
  
  console.log('\n连接信息分析:');
  console.log(`- 协议: ${protocol}`);
  console.log(`- 主机/端口: ${hostPart}`);
  
  // 如果是mongodb://mongodb:27017格式，尝试解析主机名
  if (hostPart.includes(':')) {
    const [host, port] = hostPart.split(':');
    console.log(`- 主机名: ${host}`);
    console.log(`- 端口: ${port}`);
    
    // 尝试DNS查询
    const dns = require('dns');
    dns.lookup(host, (err, address) => {
      if (err) {
        console.log(`\n主机名解析失败: ${err.message}`);
      } else {
        console.log(`\n主机名解析成功: ${host} -> ${address}`);
      }
    });
  }
} catch (e) {
  console.log('URI解析失败:', e.message);
}

// 尝试连接
console.log('\n开始连接测试...');
mongoose.connect(uri, testOptions)
  .then(() => {
    console.log('\n✅ MongoDB连接成功!');
    // 尝试执行简单查询
    return mongoose.connection.db.admin().ping();
  })
  .then(() => {
    console.log('✅ 数据库ping测试成功!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ MongoDB连接失败!');
    console.error(`错误类型: ${err.name}`);
    console.error(`错误信息: ${err.message}`);
    
    if (err.name === 'MongoServerSelectionError') {
      console.error('\n可能的原因:');
      console.error('1. MongoDB服务未运行');
      console.error('2. MongoDB服务运行但端口未开放');
      console.error('3. 网络连接问题');
      console.error('4. Docker容器间网络隔离问题');
      
      console.error('\n建议解决方案:');
      console.error('- 确保MongoDB容器正在运行: docker-compose ps');
      console.error('- 检查MongoDB日志: docker-compose logs mongodb');
      console.error('- 确保docker-compose.yml中的服务名称正确');
      console.error('- 尝试使用IP地址替代服务名');
    }
    
    process.exit(1);
  });