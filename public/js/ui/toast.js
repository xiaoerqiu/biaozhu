import { CONFIG } from '../config.js';
import { escapeHtml, icon } from '../utils.js';

const ICONS = { success: 'check-circle', error: 'alert-circle', info: 'info', loading: null };

let container = null;

/**
 * 轻提示
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'info'|'loading', duration?: number, action?: { label: string, onClick: Function } }} options
 * @returns {{ close: Function, update: Function }}
 */
export function toast(message, { type = 'info', duration, action } = {}) {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toasts';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }

    const el = document.createElement('div');
    let timer = null;
    let remaining = 0;

    const startTimer = () => {
        clearTimeout(timer);
        if (remaining > 0) timer = setTimeout(close, remaining);
    };
    // 鼠标悬停时暂停计时，方便点击“撤销”等操作
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', startTimer);

    const close = () => {
        clearTimeout(timer);
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 200);
    };

    const update = (nextMessage, next = {}) => {
        const nextType = next.type || type;
        el.className = `toast toast-${nextType}`;
        const mark = ICONS[nextType] ? icon(ICONS[nextType], 18) : '<span class="spinner"></span>';
        el.innerHTML = `${mark}<span class="toast-text">${escapeHtml(nextMessage)}</span>`;
        const nextAction = next.action ?? (next.type ? null : action);
        if (nextAction) {
            const btn = document.createElement('button');
            btn.className = 'toast-action';
            btn.textContent = nextAction.label;
            btn.onclick = () => {
                close();
                nextAction.onClick();
            };
            el.appendChild(btn);
        }
        remaining = next.duration ?? (nextType === 'loading' ? 0 : nextAction ? CONFIG.UI.UNDO_DURATION : CONFIG.UI.TOAST_DURATION);
        startTimer();
    };

    update(message, { type, duration, action });
    container.appendChild(el);
    return { close, update };
}
