const path = require('path');

// 未配置时 .env.example 中的占位值，视为未设置
const PLACEHOLDER_KEYS = new Set([
    '',
    'your_amap_api_key_here',
    'your_amap_security_key_here',
    'your_baidu_map_api_key_here',
    'your_default_api_key_here'
]);

const readKey = (value) => (PLACEHOLDER_KEYS.has(value || '') ? '' : value);

const config = {
    server: {
        port: process.env.PORT || 8080,
        logLevel: process.env.LOG_LEVEL || 'info',
        logFile: process.env.LOG_FILE || './logs/app.log'
    },
    database: {
        // SQLite数据库文件路径（相对路径基于项目根目录）
        path: path.resolve(__dirname, process.env.DB_PATH || './data/map_annotation.db')
    },
    upload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['.xlsx', '.xls', '.csv'],
        maxRows: 5000
    },
    // 地图服务商：'amap'（高德）或 'baidu'（百度），默认高德
    mapProvider: process.env.MAP_PROVIDER === 'baidu' ? 'baidu' : 'amap',
    // 高德地图配置
    amap: {
        apiKey: readKey(process.env.AMAP_API_KEY),
        securityJsCode: readKey(process.env.AMAP_SECURITY_KEY)
    },
    // 百度地图配置
    baiduMap: {
        apiKey: readKey(process.env.BAIDU_MAP_API_KEY)
    }
};

module.exports = config;
