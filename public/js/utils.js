import { CONFIG } from './config.js';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

// 转义后高亮搜索关键字
export function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const pattern = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(pattern, 'gi'), (m) => `<mark>${m}</mark>`);
}

export function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const hasCoords = (item) => Number.isFinite(item.lng) && Number.isFinite(item.lat);

export const formatCoords = (item) => `${item.lng.toFixed(6)}, ${item.lat.toFixed(6)}`;

export const icon = (name, size = 16) =>
    `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

/** 按类型首次出现的顺序分配稳定颜色 */
export function buildTypeColors(addresses) {
    const colors = new Map();
    for (const item of addresses) {
        if (item.type && !colors.has(item.type)) {
            colors.set(item.type, CONFIG.TYPE_COLORS[colors.size % CONFIG.TYPE_COLORS.length]);
        }
    }
    return (type) => (type && colors.get(type)) || CONFIG.UNTYPED_COLOR;
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // 非 HTTPS 环境下 clipboard API 不可用，退回 execCommand
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        textarea.remove();
        return ok;
    }
}

export function downloadUrl(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export const isMobile = () => window.matchMedia(`(max-width: ${CONFIG.UI.MOBILE_BREAKPOINT}px)`).matches;
