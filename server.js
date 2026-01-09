require('dotenv').config();
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./models/db');
const config = require('./config');
const logger = require('./utils/logger');

// 初始化数据库
logger.info('SQLite数据库初始化完成');

const app = express();
const port = config.server.port;

// 启用CORS和body-parser中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 添加获取百度地图API密钥的端点
app.get('/api/map-key', (req, res) => {
    res.json({
        success: true,
        apiKey: config.baiduMap.apiKey
    });
});

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 创建uploads目录
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 获取所有已存储的地址
app.get('/addresses', (req, res) => {
    try {
        logger.info('正在获取地址数据...');
        const addresses = db.findAll();
        logger.info(`成功获取${addresses.length}条地址数据`);
        res.json({
            success: true,
            data: addresses
        });
    } catch (error) {
        logger.error('获取地址数据失败:', error);
        res.status(500).json({ success: false, error: '获取地址数据失败: ' + error.message });
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    try {
        const count = db.count();
        res.status(200).json({ 
            status: 'ok', 
            database: 'sqlite', 
            records: count 
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error', 
            database: 'sqlite', 
            error: error.message 
        });
    }
});

// 处理Excel文件上传
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        // 删除临时文件
        fs.unlinkSync(req.file.path);

        // 验证数据格式
        const validData = data.filter(item => item.address).map(item => ({
            name: item.name || '',
            address: item.address,
            type: item.type || '',
            lng: item.lng || null,
            lat: item.lat || null
        }));

        // 清除旧数据
        const deletedCount = db.deleteAll();
        logger.info(`已清除${deletedCount}条旧数据`);

        // 直接返回数据给前端
        res.json({
            success: true,
            data: validData
        });

        // 批量导入数据到数据库
        try {
            const insertedCount = db.insertMany(validData);
            logger.info(`成功导入${insertedCount}条数据到SQLite数据库`);
        } catch (dbError) {
            logger.error('数据导入失败:', dbError);
        }

    } catch (error) {
        logger.error('文件处理错误:', error);
        res.status(500).json({ error: '文件处理失败: ' + error.message });
    }
});

// 启动服务器
app.listen(port, () => {
    logger.info(`服务器运行在 http://localhost:${port}`);
    logger.info(`数据库类型: SQLite`);
    logger.info(`当前记录数: ${db.count()}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信号，准备关闭服务...');
    try {
        db.close();
        logger.info('SQLite数据库连接已关闭');
    } catch (error) {
        logger.error('关闭SQLite数据库连接失败:', error);
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('收到 SIGINT 信号，准备关闭服务...');
    try {
        db.close();
        logger.info('SQLite数据库连接已关闭');
    } catch (error) {
        logger.error('关闭SQLite数据库连接失败:', error);
    }
    process.exit(0);
});
