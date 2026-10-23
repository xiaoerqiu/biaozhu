/**
 * Docker 健康检查：请求服务的 /health 端点
 * 比直接读取数据库文件更准确，能同时发现进程卡死、端口未监听等问题
 */
const http = require('http');

const port = process.env.PORT || 8080;

const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 5000 }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log(`✅ 服务正常: ${body}`);
            process.exit(0);
        }
        console.error(`❌ 健康检查失败（HTTP ${res.statusCode}）: ${body}`);
        process.exit(1);
    });
});

req.on('timeout', () => {
    console.error('❌ 健康检查超时');
    req.destroy();
    process.exit(1);
});

req.on('error', (err) => {
    console.error('❌ 无法连接服务:', err.message);
    process.exit(1);
});
