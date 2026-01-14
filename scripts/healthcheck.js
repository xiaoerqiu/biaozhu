/**
 * SQLite数据库健康检查脚本
 * 用于Docker环境中检测数据库连接状态
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库路径 - 与 models/db.js 保持一致
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'map_annotation.db');

console.log('正在检查SQLite数据库连接...');
console.log(`数据库路径: ${dbPath}`);

try {
    // 检查数据库文件是否存在
    // 注意：首次启动时，数据库可能还未创建，这是正常的
    if (!fs.existsSync(dbPath)) {
        console.log('⚠️ 数据库文件尚未创建（首次启动时正常）');
        // 检查data目录是否存在且可写
        if (!fs.existsSync(dataDir)) {
            console.log('📁 数据目录不存在，尝试创建...');
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✅ 数据目录创建成功');
        }
        // 首次启动允许通过健康检查
        console.log('✅ 健康检查通过（等待应用创建数据库）');
        process.exit(0);
    }

    // 尝试连接数据库
    const db = new Database(dbPath, { readonly: true });
    
    // 执行简单查询测试连接
    const result = db.prepare('SELECT 1 as test').get();
    
    if (result && result.test === 1) {
        // 获取记录数
        const countResult = db.prepare('SELECT COUNT(*) as count FROM addresses').get();
        console.log(`✅ SQLite数据库连接成功! 当前记录数: ${countResult ? countResult.count : 0}`);
        db.close();
        process.exit(0); // 成功退出
    } else {
        console.error('❌ 数据库查询失败');
        db.close();
        process.exit(1);
    }
} catch (err) {
    // 如果是表不存在的错误，说明数据库刚创建，表还没建立
    if (err.message && err.message.includes('no such table')) {
        console.log('⚠️ 数据库表尚未创建（首次启动时正常）');
        console.log('✅ 健康检查通过（等待应用初始化）');
        process.exit(0);
    }
    
    console.error('❌ SQLite连接失败:', err.message);
    console.error('详细错误信息:', err);
    process.exit(1); // 失败退出
}
