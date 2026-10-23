const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 创建日志目录
const logDir = path.dirname(path.resolve(config.server.logFile));
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 配置日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
);

// 创建日志记录器
const logger = winston.createLogger({
    level: config.server.logLevel,
    format: logFormat,
    transports: [
        // 控制台输出
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' }),
        // 记录所有级别的日志到文件
        new winston.transports.File({
            filename: path.resolve(config.server.logFile),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // 单独记录错误日志
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

module.exports = logger;
