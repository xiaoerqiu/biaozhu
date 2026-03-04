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
    // 地图服务商：'amap'（高德）或 'baidu'（百度），默认高德
    mapProvider: process.env.MAP_PROVIDER || 'amap',
    // 高德地图配置
    amap: {
        apiKey: process.env.AMAP_API_KEY || 'your_amap_api_key_here',
        securityJsCode: process.env.AMAP_SECURITY_KEY || '',
    },
    // 百度地图配置
    baiduMap: {
        apiKey: process.env.BAIDU_MAP_API_KEY || 'your_default_api_key_here',
        apiVersion: '3.0',
        geocoding: {
            retryTimes: 3,
            retryDelay: 1000
        }
    }
};

module.exports = config;
