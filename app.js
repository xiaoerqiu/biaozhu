const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./models/db');
const apiRouter = require('./routes/api');

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRouter);

// 健康检查端点
app.get('/health', (req, res) => {
    try {
        res.json({ status: 'ok', database: 'sqlite', records: db.count() });
    } catch (error) {
        res.status(503).json({ status: 'error', database: 'sqlite', error: error.message });
    }
});

module.exports = app;
