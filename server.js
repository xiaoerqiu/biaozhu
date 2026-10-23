require('dotenv').config();
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./models/db');
const app = require('./app');

const port = config.server.port;

const server = app.listen(port, () => {
    logger.info(`服务器运行在 http://localhost:${port}`);
    logger.info(`地图服务商: ${config.mapProvider === 'amap' ? '高德' : '百度'}`);
    logger.info(`数据库: ${config.database.path}（当前记录数: ${db.count()}）`);
    const apiKey = config.mapProvider === 'amap' ? config.amap.apiKey : config.baiduMap.apiKey;
    if (!apiKey) {
        logger.warn('未配置地图API密钥，地图将无法加载，请检查 .env 配置');
    }
});

// 优雅关闭
function shutdown(signal) {
    logger.info(`收到 ${signal} 信号，准备关闭服务...`);
    server.close(() => {
        try {
            db.close();
            logger.info('SQLite数据库连接已关闭');
        } catch (error) {
            logger.error('关闭SQLite数据库连接失败:', error);
        }
        process.exit(0);
    });
    // 兜底：5 秒内未完成则强制退出
    setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
