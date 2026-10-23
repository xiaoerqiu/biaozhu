const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const xlsx = require('xlsx');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biaozhu-test-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.LOG_FILE = path.join(tmpDir, 'app.log');

const app = require('../app');
const db = require('../models/db');

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    server.close();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

const request = async (method, url, body) => {
    const options = { method, headers: {} };
    if (body instanceof FormData) {
        options.body = body;
    } else if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const res = await fetch(baseUrl + url, options);
    const type = res.headers.get('content-type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
};

const excelForm = (rows, filename = 'data.xlsx') => {
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(rows), 'Sheet1');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const form = new FormData();
    form.append('file', new Blob([buffer]), filename);
    return form;
};

test('导入Excel：支持中文表头、校验坐标、返回带ID的数据', async () => {
    const form = excelForm([
        { 名称: '西湖国宾馆', 地址: '杭州市西湖区杨公堤18号', 房型: '湖景房', 经度: 120.13, 纬度: 30.24 },
        { 名称: '坐标越界', 地址: '杭州市上城区湖滨路28号', 经度: 999, 纬度: 30 },
        { 名称: '无地址', 地址: '' }
    ]);
    const { status, body } = await request('POST', '/api/upload', form);
    assert.equal(status, 200);
    assert.equal(body.imported, 2);
    assert.equal(body.skipped, 1);
    assert.equal(body.data.length, 2);
    assert.ok(body.data.every((row) => Number.isInteger(row.id)));
    assert.equal(body.data[0].type, '湖景房');
    assert.equal(body.data[1].lng, null);
});

test('导入Excel：append 模式追加，replace 模式替换', async () => {
    const append = await request('POST', '/api/upload?mode=append', excelForm([{ address: '上海市浦东新区世纪大道1号' }]));
    assert.equal(append.body.data.length, 3);

    const replace = await request('POST', '/api/upload', excelForm([{ address: '北京市东城区东长安街1号' }]));
    assert.equal(replace.body.data.length, 1);
});

test('导入Excel：缺少地址列或文件类型错误时返回400', async () => {
    const noAddress = await request('POST', '/api/upload', excelForm([{ name: 'x' }]));
    assert.equal(noAddress.status, 400);
    assert.match(noAddress.body.error, /地址/);

    const form = new FormData();
    form.append('file', new Blob(['hello']), 'notes.txt');
    const wrongType = await request('POST', '/api/upload', form);
    assert.equal(wrongType.status, 400);
    assert.equal(db.count(), 1, '失败的导入不应影响现有数据');
});

test('地址增删改与坐标回写', async () => {
    const created = await request('POST', '/api/addresses', { name: '<b>测试</b>', address: '杭州市', type: '酒店' });
    assert.equal(created.status, 201);
    const id = created.body.data.id;

    const located = await request('PATCH', '/api/addresses/locations', [
        { id, lng: 120.1, lat: 30.2 },
        { id, lng: 'bad', lat: 1 }
    ]);
    assert.equal(located.body.updated, 1);

    const updated = await request('PUT', `/api/addresses/${id}`, { name: '新名称', address: '杭州市西湖区', lng: null, lat: null });
    assert.equal(updated.body.data.name, '新名称');
    assert.equal(updated.body.data.lng, null);

    assert.equal((await request('PUT', `/api/addresses/${id}`, { address: '' })).status, 400);
    assert.equal((await request('PUT', '/api/addresses/99999', { address: 'x' })).status, 404);
    assert.equal((await request('DELETE', `/api/addresses/${id}`)).status, 200);
    assert.equal((await request('DELETE', `/api/addresses/${id}`)).status, 404);
});

test('导出与模板可重新导入', async () => {
    const exported = await request('GET', '/api/export');
    assert.equal(exported.status, 200);
    const rows = xlsx.utils.sheet_to_json(xlsx.read(Buffer.from(exported.body)).Sheets['地址数据']);
    assert.equal(rows.length, db.count());

    const template = await request('GET', '/api/template');
    const form = new FormData();
    form.append('file', new Blob([template.body]), 'template.xlsx');
    const imported = await request('POST', '/api/upload', form);
    assert.equal(imported.body.imported, 2);
});

test('清空数据与健康检查', async () => {
    const cleared = await request('DELETE', '/api/addresses');
    assert.equal(cleared.body.success, true);
    const health = await request('GET', '/health');
    assert.deepEqual(health.body, { status: 'ok', database: 'sqlite', records: 0 });
});
