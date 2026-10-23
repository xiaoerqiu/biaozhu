const xlsx = require('xlsx');

// 表头别名：兼容英文列名和常见中文列名（不区分大小写、忽略空格）
const COLUMN_ALIASES = {
    name: ['name', '名称', '名字', '酒店', '酒店名称', '地点', '地点名称', '标题'],
    address: ['address', '地址', '详细地址', '位置'],
    type: ['type', '类型', '房型', '分类', '类别', '标签'],
    lng: ['lng', 'lon', 'long', 'longitude', '经度'],
    lat: ['lat', 'latitude', '纬度']
};

// 导出与模板使用的表头（可直接重新导入）
const EXPORT_HEADERS = [
    ['name', '名称'],
    ['address', '地址'],
    ['type', '类型'],
    ['lng', '经度'],
    ['lat', '纬度']
];

const normalizeHeader = (header) => String(header).replace(/\s+/g, '').toLowerCase();

const aliasLookup = new Map();
for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
        aliasLookup.set(normalizeHeader(alias), field);
    }
}

const toText = (value) => (value === undefined || value === null ? '' : String(value).trim());

const toNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

/**
 * 校验坐标：经度 -180~180，纬度 -90~90，任一无效则视为无坐标（交由前端地理编码）
 */
function normalizeCoords(lng, lat) {
    const x = toNumber(lng);
    const y = toNumber(lat);
    if (x === null || y === null) return { lng: null, lat: null };
    if (Math.abs(x) > 180 || Math.abs(y) > 90 || (x === 0 && y === 0)) {
        return { lng: null, lat: null };
    }
    return { lng: x, lat: y };
}

/**
 * 规范化单条地址记录，地址为空时返回 null
 */
function normalizeRecord(raw) {
    const address = toText(raw.address);
    if (!address) return null;
    return {
        name: toText(raw.name),
        address,
        type: toText(raw.type),
        ...normalizeCoords(raw.lng, raw.lat)
    };
}

/**
 * 解析Excel/CSV文件内容
 * @returns {{ records: object[], skipped: number, missingAddressColumn: boolean }}
 */
function parseWorkbook(buffer, { maxRows = Infinity } = {}) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
        return { records: [], skipped: 0, missingAddressColumn: true };
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const columnMap = {};
    for (const header of headers) {
        const field = aliasLookup.get(normalizeHeader(header));
        if (field && !columnMap[field]) columnMap[field] = header;
    }

    if (!columnMap.address) {
        return { records: [], skipped: rows.length, missingAddressColumn: true };
    }

    const records = [];
    let skipped = 0;
    for (const row of rows.slice(0, maxRows)) {
        const raw = {};
        for (const [field, header] of Object.entries(columnMap)) {
            raw[field] = row[header];
        }
        const record = normalizeRecord(raw);
        if (record) records.push(record);
        else skipped++;
    }
    skipped += Math.max(0, rows.length - maxRows);

    return { records, skipped, missingAddressColumn: false };
}

function buildWorkbook(rows) {
    const data = rows.map((row) => {
        const out = {};
        for (const [field, label] of EXPORT_HEADERS) {
            out[label] = row[field] ?? '';
        }
        return out;
    });
    const sheet = xlsx.utils.json_to_sheet(data, { header: EXPORT_HEADERS.map(([, label]) => label) });
    sheet['!cols'] = [{ wch: 24 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, '地址数据');
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

const TEMPLATE_ROWS = [
    { name: '西湖国宾馆', address: '杭州市西湖区杨公堤18号', type: '酒店', lng: 120.130953, lat: 30.246273 },
    { name: '杭州香格里拉饭店', address: '杭州市西湖区北山街78号', type: '酒店', lng: '', lat: '' }
];

module.exports = {
    parseWorkbook,
    normalizeRecord,
    normalizeCoords,
    buildWorkbook,
    buildTemplate: () => buildWorkbook(TEMPLATE_ROWS)
};
