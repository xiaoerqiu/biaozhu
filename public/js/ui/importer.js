import { CONFIG } from '../config.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { openDialog } from './dialog.js';
import { toast } from './toast.js';
import { escapeHtml } from '../utils.js';

const fileInput = Object.assign(document.createElement('input'), {
    type: 'file',
    accept: CONFIG.UPLOAD.EXTENSIONS.join(','),
    hidden: true
});
document.body.appendChild(fileInput);

/** 打开系统文件选择器 */
export function chooseFile(onFile) {
    fileInput.onchange = () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (file) onFile(file);
    };
    fileInput.click();
}

function validate(file) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!CONFIG.UPLOAD.EXTENSIONS.includes(ext)) {
        return `不支持的文件类型，请选择 ${CONFIG.UPLOAD.EXTENSIONS.join(' / ')} 文件`;
    }
    if (file.size > CONFIG.UPLOAD.MAX_FILE_SIZE) {
        return `文件过大，最大支持 ${CONFIG.UPLOAD.MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
}

// 已有数据时让用户选择替换或追加
async function askMode(file) {
    const total = store.stats.total;
    let mode = null;
    await openDialog({
        title: '导入地址',
        size: 'sm',
        content: `
            <p class="dialog-message">即将导入 <b>${escapeHtml(file.name)}</b>，当前已有 ${total} 条地址。</p>
            <div class="radio-cards" role="radiogroup">
                <label class="radio-card">
                    <input type="radio" name="mode" value="append" checked>
                    <span><b>追加</b><small>保留现有数据，新数据添加到末尾</small></span>
                </label>
                <label class="radio-card">
                    <input type="radio" name="mode" value="replace">
                    <span><b>替换</b><small>删除现有 ${total} 条地址后导入</small></span>
                </label>
            </div>`,
        actions: [
            { label: '取消', value: null },
            { label: '开始导入', value: 'ok', variant: 'primary' }
        ],
        onAction(value, body) {
            if (value === 'ok') mode = body.querySelector('input[name="mode"]:checked').value;
        }
    });
    return mode;
}

/**
 * 导入文件
 * @returns {Promise<object|null>} 服务器返回结果，取消或失败返回 null
 */
export async function importFile(file) {
    const error = validate(file);
    if (error) {
        toast(error, { type: 'error' });
        return null;
    }

    let mode = 'replace';
    if (store.stats.total > 0) {
        mode = await askMode(file);
        if (!mode) return null;
    }

    const t = toast(`正在导入 ${file.name}…`, { type: 'loading' });
    try {
        const result = await api.upload(file, mode);
        const skipped = result.skipped ? `，跳过 ${result.skipped} 条无地址数据` : '';
        t.update(`成功导入 ${result.imported} 条地址${skipped}`, { type: 'success', duration: 4000 });
        return result;
    } catch (err) {
        t.update(err.message, { type: 'error', duration: 5000 });
        return null;
    }
}

/** 拖拽文件到页面任意位置导入 */
export function setupDropZone(overlay, onFile) {
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

    window.addEventListener('dragenter', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth++;
        overlay.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
        if (hasFiles(e)) e.preventDefault();
    });
    window.addEventListener('dragleave', () => {
        depth = Math.max(0, depth - 1);
        if (depth === 0) overlay.hidden = true;
    });
    window.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth = 0;
        overlay.hidden = true;
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
    });
}
