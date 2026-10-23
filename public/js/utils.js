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

// 粗略判断是否在中国范围内（高德/百度仅覆盖国内地图数据）
export const isInChina = (lng, lat) => lng >= 73.4 && lng <= 135.1 && lat >= 3.8 && lat <= 53.6;

/**
 * 校验定位结果，返回 null 表示可用，否则返回给用户的提示
 */
export function checkLocateResult(lng, lat) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return '定位失败，未获取到有效坐标';
    if (!isInChina(lng, lat)) {
        return `定位结果不在国内（${lng.toFixed(2)}, ${lat.toFixed(2)}），可能是代理/VPN 导致，请关闭后重试`;
    }
    return null;
}

/**
 * 将定位失败原因转为可读提示
 */
export function describeLocateError(raw = '') {
    if (!window.isSecureContext) return '当前页面不是 HTTPS，浏览器禁止获取位置，请通过 HTTPS 或 localhost 访问';
    if (/denied|permission/i.test(raw)) return '浏览器未授权定位，请在地址栏左侧的网站设置中允许“位置”权限';
    if (/timeout/i.test(raw)) return '定位超时，请稍后重试';
    return '定位失败，请检查系统和浏览器的定位权限';
}

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
