const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../models/db');
const config = require('../config');
const logger = require('../utils/logger');
const excel = require('../services/excel');

const router = express.Router();

// 上传文件只在内存中解析，不落盘
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (config.upload.allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new HttpError(400, `不支持的文件类型，请上传 ${config.upload.allowedExtensions.join(' / ')} 文件`));
        }
    }
});

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const parseId = (value) => {
    const id = Number.parseInt(value, 10);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '无效的地址ID');
    return id;
};

const sendFile = (res, buffer, filename) => {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
};

// 获取地图配置（支持高德/百度切换）
router.get('/map-key', (req, res) => {
    if (config.mapProvider === 'amap') {
        res.json({
            success: true,
            provider: 'amap',
            apiKey: config.amap.apiKey,
            securityJsCode: config.amap.securityJsCode
        });
    } else {
        res.json({
            success: true,
            provider: 'baidu',
            apiKey: config.baiduMap.apiKey
        });
    }
});

// 获取所有地址
router.get('/addresses', (req, res) => {
    res.json({ success: true, data: db.findAll() });
});

// 新增单个地址
router.post('/addresses', (req, res) => {
    const record = excel.normalizeRecord(req.body || {});
    if (!record) throw new HttpError(400, '地址不能为空');
    const created = db.insertAddress(record);
    logger.info(`新增地址: ID=${created.id}`);
    res.status(201).json({ success: true, data: created });
});

// 批量回写地理编码坐标：[{ id, lng, lat }]
router.patch('/addresses/locations', (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [];
    const locations = [];
    for (const item of items) {
        const id = Number.parseInt(item && item.id, 10);
        const { lng, lat } = excel.normalizeCoords(item && item.lng, item && item.lat);
        if (Number.isInteger(id) && lng !== null) locations.push({ id, lng, lat });
    }
    const updated = locations.length ? db.updateLocations(locations) : 0;
    res.json({ success: true, updated });
});

// 更新单个地址
router.put('/addresses/:id', (req, res) => {
    const id = parseId(req.params.id);
    const record = excel.normalizeRecord(req.body || {});
    if (!record) throw new HttpError(400, '地址不能为空');

    const updated = db.updateAddress(id, record);
    if (!updated) throw new HttpError(404, '地址不存在');
    logger.info(`地址更新成功: ID=${id}`);
    res.json({ success: true, data: updated });
});

// 删除单个地址
router.delete('/addresses/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!db.deleteAddress(id)) throw new HttpError(404, '地址不存在');
    logger.info(`地址删除成功: ID=${id}`);
    res.json({ success: true });
});

// 清空全部地址
router.delete('/addresses', (req, res) => {
    const deleted = db.deleteAll();
    logger.info(`已清空${deleted}条地址`);
    res.json({ success: true, deleted });
});

// 导入Excel：mode=replace（默认，替换现有数据）| append（追加）
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) throw new HttpError(400, '没有上传文件');
    const mode = req.query.mode === 'append' ? 'append' : 'replace';

    let parsed;
    try {
        parsed = excel.parseWorkbook(req.file.buffer, { maxRows: config.upload.maxRows });
    } catch (error) {
        logger.warn(`文件解析失败: ${error.message}`);
        throw new HttpError(400, '文件解析失败，请确认是有效的 Excel 文件');
    }

    if (parsed.missingAddressColumn) {
        throw new HttpError(400, '未找到“地址”列，请检查表头（支持 address / 地址）');
    }
    if (parsed.records.length === 0) {
        throw new HttpError(400, '文件中没有有效的地址数据');
    }

    if (mode === 'replace') db.replaceAll(parsed.records);
    else db.insertMany(parsed.records);

    logger.info(`导入${parsed.records.length}条地址（${mode}），跳过${parsed.skipped}条`);
    res.json({
        success: true,
        mode,
        imported: parsed.records.length,
        skipped: parsed.skipped,
        data: db.findAll()
    });
});

// 导出全部地址为Excel
router.get('/export', (req, res) => {
    const date = new Date().toISOString().slice(0, 10);
    sendFile(res, excel.buildWorkbook(db.findAll()), `地址数据-${date}.xlsx`);
});

// 下载导入模板
router.get('/template', (req, res) => {
    sendFile(res, excel.buildTemplate(), '地址导入模板.xlsx');
});

router.use((req, res) => {
    res.status(404).json({ success: false, error: '接口不存在' });
});

// 统一错误处理
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? `文件过大，最大支持 ${config.upload.maxFileSize / 1024 / 1024}MB`
            : `文件上传失败: ${err.message}`;
        return res.status(400).json({ success: false, error: message });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, error: '请求数据格式错误' });
    }
    const status = err.status || 500;
    if (status >= 500) logger.error(err);
    res.status(status).json({ success: false, error: status >= 500 ? '服务器内部错误' : err.message });
});

module.exports = router;
