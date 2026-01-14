const config = {
    server: {
        port: process.env.PORT || 8080,
        // 日志配置
        logLevel: process.env.LOG_LEVEL || 'info',
        logFile: process.env.LOG_FILE || './logs/app.log'
    },
    database: {
        // SQLite数据库文件路径
        path: process.env.DB_PATH || './data/map_annotation.db'
    },
    baiduMap: {
        // 从环境变量获取百度地图API密钥
        apiKey: process.env.BAIDU_MAP_API_KEY || 'your_default_api_key_here',
        // 百度地图API配置
        apiVersion: '3.0',
        // 地理编码服务配置
        geocoding: {
            retryTimes: 3,
            retryDelay: 1000
        }
    }
};

module.exports = config;
