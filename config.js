const config = {
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/map_annotation',
        options: {
            // MongoDB 连接配置
            connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT) || 30000,
            socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT) || 60000,
            serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT) || 30000,
            heartbeatFrequencyMS: 1000,
            // 连接池配置
            maxPoolSize: 50,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            // 读写重试
            retryWrites: true,
            retryReads: true,
            // 额外的稳定性配置
            keepAlive: true,
            keepAliveInitialDelay: 300000,
            // 认证配置
            authSource: 'admin',
            // 副本集配置（如果需要）
            replicaSet: process.env.MONGODB_REPLICA_SET || undefined
        }
    },
    server: {
        port: process.env.PORT || 3000,
        // 批量导入时的批次大小
        batchSize: 100,
        // 日志配置
        logLevel: process.env.LOG_LEVEL || 'info',
        logFile: process.env.LOG_FILE || './logs/app.log'
    },
    baiduMap: {
        // 从环境变量获取百度地图API密钥，如果没有则使用默认值
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