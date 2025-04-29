/**
 * MongoDB连接问题高级诊断脚本
 * 提供详细的网络和连接诊断信息
 */

const mongoose = require('mongoose');
const dns = require('dns');
const net = require('net');
const config = require('../config');
const { exec } = require('child_process');

// 获取MongoDB URI
const uri = process.env.MONGODB_URI || config.mongodb.uri;

console.log('===== MongoDB连接高级诊断 =====');
console.log(`当前连接URI: ${uri}`);

// 解析URI
function parseMongoURI(uri) {
  try {
    const uriParts = uri.split('://');
    const protocol = uriParts[0];
    const restParts = uriParts[1].split('/');
    const hostPart = restParts[0];
    const database = restParts[1] ? restParts[1].split('?')[0] : '';
    
    let host, port, auth;
    
    if (hostPart.includes('@')) {
      auth = hostPart.split('@')[0];
      const hostPortPart = hostPart.split('@')[1];
      [host, port] = hostPortPart.includes(':') ? hostPortPart.split(':') : [hostPortPart, '27017'];
    } else {
      [host, port] = hostPart.includes(':') ? hostPart.split(':') : [hostPart, '27017'];
      auth = null;
    }
    
    return { protocol, host, port: parseInt(port), database, auth };
  } catch (e) {
    console.error('URI解析失败:', e.message);
    return null;
  }
}

// 测试TCP连接
async function testTCPConnection(host, port) {
  return new Promise((resolve) => {
    console.log(`测试TCP连接到 ${host}:${port}...`);
    const socket = new net.Socket();
    let connected = false;
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      connected = true;
      console.log(`✅ 成功建立TCP连接到 ${host}:${port}`);
      socket.end();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ 连接超时: ${host}:${port}`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (err) => {
      console.log(`❌ 连接错误: ${err.message}`);
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

// 测试DNS解析
async function testDNSResolution(hostname) {
  return new Promise((resolve) => {
    console.log(`测试DNS解析: ${hostname}...`);
    dns.lookup(hostname, (err, address) => {
      if (err) {
        console.log(`❌ DNS解析失败: ${err.message}`);
        resolve(null);
      } else {
        console.log(`✅ DNS解析成功: ${hostname} -> ${address}`);
        resolve(address);
      }
    });
  });
}

// 测试Docker网络
async function testDockerNetwork() {
  return new Promise((resolve) => {
    console.log('测试Docker网络配置...');
    exec('hostname', (err, stdout) => {
      if (err) {
        console.log('❌ 无法获取容器主机名');
        resolve(false);
        return;
      }
      
      const hostname = stdout.trim();
      console.log(`当前容器主机名: ${hostname}`);
      
      // 尝试ping mongodb服务
      exec('ping -c 2 mongodb', (err, stdout, stderr) => {
        if (err) {
          console.log('❌ 无法ping通mongodb服务');
          console.log(stderr);
          
          // 尝试使用IP地址
          console.log('尝试使用Docker默认网桥IP...');
          exec('ping -c 2 172.17.0.1', (err, stdout, stderr) => {
            if (err) {
              console.log('❌ 无法ping通Docker默认网桥IP');
              resolve(false);
            } else {
              console.log('✅ 可以ping通Docker默认网桥IP');
              console.log('建议使用IP地址替代服务名');
              resolve(true);
            }
          });
        } else {
          console.log('✅ 可以ping通mongodb服务');
          resolve(true);
        }
      });
    });
  });
}

// 主诊断流程
async function diagnose() {
  const parsedURI = parseMongoURI(uri);
  if (!parsedURI) {
    console.log('无法继续诊断，URI解析失败');
    process.exit(1);
  }
  
  console.log('\n连接信息:');
  console.log(`- 协议: ${parsedURI.protocol}`);
  console.log(`- 主机: ${parsedURI.host}`);
  console.log(`- 端口: ${parsedURI.port}`);
  console.log(`- 数据库: ${parsedURI.database}`);
  console.log(`- 认证: ${parsedURI.auth ? '已配置' : '未配置'}`);
  
  // 测试DNS解析
  const resolvedIP = await testDNSResolution(parsedURI.host);
  
  // 测试TCP连接
  let tcpSuccess = false;
  if (resolvedIP) {
    tcpSuccess = await testTCPConnection(resolvedIP, parsedURI.port);
  } else {
    // 如果DNS解析失败，尝试直接用主机名连接
    tcpSuccess = await testTCPConnection(parsedURI.host, parsedURI.port);
  }
  
  // 测试Docker网络
  const dockerNetworkOK = await testDockerNetwork();
  
  console.log('\n===== 诊断摘要 =====');
  console.log(`DNS解析: ${resolvedIP ? '✅ 成功' : '❌ 失败'}`);
  console.log(`TCP连接: ${tcpSuccess ? '✅ 成功' : '❌ 失败'}`);
  console.log(`Docker网络: ${dockerNetworkOK ? '✅ 正常' : '❌ 异常'}`);
  
  if (!resolvedIP || !tcpSuccess || !dockerNetworkOK) {
    console.log('\n===== 建议解决方案 =====');
    
    if (!resolvedIP) {
      console.log('1. DNS解析问题:');
      console.log('   - 在docker-compose.yml中为web服务添加dns_search配置');
      console.log('   - 使用IP地址替代服务名，例如: mongodb://172.17.0.1:27017/map_annotation');
    }
    
    if (!tcpSuccess) {
      console.log('2. 连接问题:');
      console.log('   - 确保MongoDB服务正在运行: docker-compose ps');
      console.log('   - 检查MongoDB日志: docker-compose logs mongodb');
      console.log('   - 确保MongoDB端口已正确映射并可访问');
    }
    
    if (!dockerNetworkOK) {
      console.log('3. Docker网络问题:');
      console.log('   - 检查docker-compose.yml中的网络配置');
      console.log('   - 尝试创建自定义网络并明确指定');
      console.log('   - 重建容器: docker-compose down && docker-compose up -d');
    }
    
    console.log('\n4. 通用解决方案:');
    console.log('   - 修改docker-compose.yml中的MONGODB_URI为: mongodb://172.17.0.1:27017/map_annotation');
    console.log('   - 确保MongoDB容器先于web容器启动');
    console.log('   - 完全重建所有容器: docker-compose down && docker-compose up -d --build');
  } else {
    // 如果网络诊断都正常，尝试连接MongoDB
    try {
      console.log('\n尝试连接MongoDB...');
      await mongoose.connect(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
      });
      console.log('✅ MongoDB连接成功!');
      await mongoose.connection.close();
    } catch (err) {
      console.log(`❌ MongoDB连接失败: ${err.message}`);
      console.log('\n可能是MongoDB认证或数据库配置问题，请检查:');
      console.log('- MongoDB是否需要认证');
      console.log('- 数据库名称是否正确');
      console.log('- MongoDB版本兼容性');
    }
  }
}

// 执行诊断
diagnose().then(() => {
  console.log('\n诊断完成');
  process.exit(0);
}).catch(err => {
  console.error('诊断过程出错:', err);
  process.exit(1);
});