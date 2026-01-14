/**
 * SQLite数据库健康检查脚本
 * 用于Docker环境中检测数据库连接状态
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 获取数据库路径
const dbPath = path.resolve(__dirname, '..', config.database.path);

console.log('正在检查SQLite数据库连接...');
console.log(`数据库路径: ${dbPath}`);

try {
    // 检查数据库文件是否存在
    if (!fs.existsSync(dbPath)) {
        console.error('❌ 数据库文件不存在');
        process.exit(1);
    }

    // 尝试连接数据库
    const db = new Database(dbPath, { readonly: true });
    
    // 执行简单查询测试连接
    const result = db.prepare('SELECT 1 as test').get();
    
    if (result && result.test === 1) {
        console.log('✅ SQLite数据库连接成功!');
        db.close();
        process.exit(0); // 成功退出
    } else {
        console.error('❌ 数据库查询失败');
        db.close();
        process.exit(1);
    }
} catch (err) {
    console.error('❌ SQLite连接失败:', err.message);
    console.error('详细错误信息:', err);
    process.exit(1); // 失败退出
}
