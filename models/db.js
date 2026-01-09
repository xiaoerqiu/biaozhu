const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 确保data目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化SQLite数据库
const dbPath = path.join(dataDir, 'map_annotation.db');
const db = new Database(dbPath, { verbose: console.log });

// 创建地址表
db.exec(`
    CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        type TEXT,
        lng REAL,
        lat REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 创建索引
db.exec('CREATE INDEX IF NOT EXISTS idx_address ON addresses(address)');
db.exec('CREATE INDEX IF NOT EXISTS idx_created_at ON addresses(created_at)');

// 准备SQL语句
const statements = {
    // 插入地址
    insertAddress: db.prepare(`
        INSERT INTO addresses (name, address, type, lng, lat)
        VALUES (@name, @address, @type, @lng, @lat)
    `),
    
    // 批量插入地址
    insertMany: db.transaction((addresses) => {
        const insert = statements.insertAddress;
        for (const addr of addresses) {
            insert.run(addr);
        }
    }),
    
    // 查询所有地址
    findAll: db.prepare('SELECT * FROM addresses ORDER BY created_at DESC'),
    
    // 根据ID查询
    findById: db.prepare('SELECT * FROM addresses WHERE id = ?'),
    
    // 更新地址
    updateAddress: db.prepare(`
        UPDATE addresses 
        SET name = @name, address = @address, type = @type, 
            lng = @lng, lat = @lat, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
    `),
    
    // 删除地址
    deleteAddress: db.prepare('DELETE FROM addresses WHERE id = ?'),
    
    // 删除所有地址
    deleteAll: db.prepare('DELETE FROM addresses'),
    
    // 统计数量
    count: db.prepare('SELECT COUNT(*) as count FROM addresses')
};

// 导出数据库操作方法
module.exports = {
    db,
    
    // 插入单个地址
    insertAddress: (data) => {
        const info = statements.insertAddress.run(data);
        return statements.findById.get(info.lastInsertRowid);
    },
    
    // 批量插入地址
    insertMany: (addresses) => {
        statements.insertMany(addresses);
        return statements.count.get().count;
    },
    
    // 查询所有地址
    findAll: () => statements.findAll.all(),
    
    // 根据ID查询
    findById: (id) => statements.findById.get(id),
    
    // 更新地址
    updateAddress: (id, data) => {
        statements.updateAddress.run({ id, ...data });
        return statements.findById.get(id);
    },
    
    // 删除地址
    deleteAddress: (id) => {
        const info = statements.deleteAddress.run(id);
        return info.changes > 0;
    },
    
    // 删除所有地址
    deleteAll: () => {
        const info = statements.deleteAll.run();
        return info.changes;
    },
    
    // 统计数量
    count: () => statements.count.get().count,
    
    // 关闭数据库
    close: () => db.close()
};
