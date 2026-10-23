import { escapeHtml } from '../utils.js';

// 地图标记的公共外观：高德使用 HTML 内容，百度使用同款 SVG 图标

export function pinHtml(item, selected) {
    return `<div class="pin${selected ? ' is-selected' : ''}" style="--pin:${item.color}">
        <span class="pin-head"><span class="pin-num">${item.number}</span></span>
        ${item.name ? `<span class="pin-label">${escapeHtml(item.name)}</span>` : ''}
    </div>`;
}

export function pinSvg(item, selected) {
    const scale = selected ? 1.2 : 1;
    const width = Math.round(30 * scale);
    const height = Math.round(40 * scale);
    const digits = String(item.number).length;
    const fontSize = digits > 3 ? 9 : digits > 2 ? 10 : 12;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 30 40">
        <path d="M15 39C15 39 28 24.5 28 14.5A13 13 0 0 0 2 14.5C2 24.5 15 39 15 39Z" fill="${item.color}" stroke="#fff" stroke-width="2"/>
        <text x="15" y="18.5" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${item.number}</text>
    </svg>`;
    return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height };
}

// 标记签名：用于判断标记是否需要更新
export const pinKey = (item, selected) => `${item.number}|${item.color}|${item.name}|${item.lng}|${item.lat}|${selected ? 1 : 0}`;
