const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 确保数据库目录存在
const dbPath = config.database.path;
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// 初始化SQLite数据库（仅在 LOG_LEVEL=debug 时输出SQL语句）
const db = new Database(dbPath, {
    verbose: config.server.logLevel === 'debug' ? console.log : undefined
});
db.pragma('journal_mode = WAL');

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
    insertAddress: db.prepare(`
        INSERT INTO addresses (name, address, type, lng, lat)
        VALUES (@name, @address, @type, @lng, @lat)
    `),

    // 按导入顺序展示：id 升序
    findAll: db.prepare('SELECT * FROM addresses ORDER BY id ASC'),

    findById: db.prepare('SELECT * FROM addresses WHERE id = ?'),

    updateAddress: db.prepare(`
        UPDATE addresses
        SET name = @name, address = @address, type = @type,
            lng = @lng, lat = @lat, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
    `),

    updateLocation: db.prepare(`
        UPDATE addresses SET lng = @lng, lat = @lat, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
    `),

    deleteAddress: db.prepare('DELETE FROM addresses WHERE id = ?'),

    deleteAll: db.prepare('DELETE FROM addresses'),

    count: db.prepare('SELECT COUNT(*) as count FROM addresses')
};

const insertMany = db.transaction((addresses) => {
    for (const addr of addresses) {
        statements.insertAddress.run(addr);
    }
});

const replaceAll = db.transaction((addresses) => {
    statements.deleteAll.run();
    insertMany(addresses);
});

const updateLocations = db.transaction((locations) => {
    let changed = 0;
    for (const loc of locations) {
        changed += statements.updateLocation.run(loc).changes;
    }
    return changed;
});

// 导出数据库操作方法
module.exports = {
    db,

    // 插入单个地址，返回完整记录
    insertAddress: (data) => {
        const info = statements.insertAddress.run(data);
        return statements.findById.get(info.lastInsertRowid);
    },

    // 批量插入地址（追加）
    insertMany: (addresses) => insertMany(addresses),

    // 清空后批量插入（原子操作，失败时保留旧数据）
    replaceAll: (addresses) => replaceAll(addresses),

    findAll: () => statements.findAll.all(),

    findById: (id) => statements.findById.get(id),

    updateAddress: (id, data) => {
        const info = statements.updateAddress.run({ id, ...data });
        return info.changes > 0 ? statements.findById.get(id) : null;
    },

    // 批量回写地理编码结果，返回更新条数
    updateLocations: (locations) => updateLocations(locations),

    deleteAddress: (id) => statements.deleteAddress.run(id).changes > 0,

    deleteAll: () => statements.deleteAll.run().changes,

    count: () => statements.count.get().count,

    close: () => db.close()
};
