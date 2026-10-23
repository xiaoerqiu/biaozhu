import { escapeHtml, icon } from '../utils.js';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

let openCount = 0;
export const isDialogOpen = () => openCount > 0;

/**
 * 模态对话框：Esc / 点击遮罩关闭，焦点锁定在对话框内，关闭后焦点返回触发元素
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.content           对话框主体 HTML
 * @param {Array}  options.actions           [{ label, value, variant: 'primary'|'danger'|'default' }]
 * @param {Function} [options.onOpen]        (bodyEl, dialog) => void
 * @param {Function} [options.onAction]      (value, bodyEl, dialog) => false | Promise<false> 时保持打开
 * @param {'sm'|'md'} [options.size]
 * @returns {Promise<any>} 关闭时的 value，取消为 null
 */
export function openDialog({ title, content, actions = [], onOpen, onAction, size = 'md' }) {
    return new Promise((resolve) => {
        const trigger = document.activeElement;
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.innerHTML = `
            <div class="dialog dialog-${size}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
                <header class="dialog-header">
                    <h2 id="dialog-title">${escapeHtml(title)}</h2>
                    <button type="button" class="icon-btn" data-dismiss aria-label="关闭">${icon('x', 18)}</button>
                </header>
                <div class="dialog-body">${content}</div>
                <footer class="dialog-footer">
                    ${actions.map((a, i) => `<button type="button" class="btn btn-${a.variant || 'default'}" data-index="${i}">${escapeHtml(a.label)}</button>`).join('')}
                </footer>
            </div>`;

        const body = overlay.querySelector('.dialog-body');
        let busy = false;

        const dialog = {
            el: overlay,
            close(value = null) {
                document.removeEventListener('keydown', onKeydown, true);
                overlay.classList.add('is-leaving');
                setTimeout(() => overlay.remove(), 150);
                openCount--;
                if (trigger && document.contains(trigger)) trigger.focus();
                resolve(value);
            },
            // 临时隐藏（例如在地图上选点时）
            hide() { overlay.hidden = true; },
            show() {
                overlay.hidden = false;
                focusFirst();
            },
            setBusy(state) {
                busy = state;
                overlay.querySelectorAll('.dialog-footer .btn').forEach((b) => { b.disabled = state; });
            }
        };

        const run = async (action) => {
            if (busy) return;
            const result = onAction ? await onAction(action.value, body, dialog) : undefined;
            if (result !== false) dialog.close(action.value);
        };

        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay && !busy) dialog.close();
        });
        overlay.querySelector('[data-dismiss]').onclick = () => !busy && dialog.close();
        overlay.querySelectorAll('.dialog-footer .btn').forEach((btn) => {
            btn.onclick = () => run(actions[Number(btn.dataset.index)]);
        });

        // 表单内回车触发主操作
        const primary = actions.find((a) => a.variant === 'primary' || a.variant === 'danger');
        body.addEventListener('submit', (e) => {
            e.preventDefault();
            if (primary) run(primary);
        });

        function focusFirst() {
            // 危险操作默认聚焦“取消”，避免误按回车
            const footerBtn = overlay.querySelector('.dialog-footer .btn-danger')
                ? overlay.querySelector('.dialog-footer .btn:first-child')
                : overlay.querySelector('.dialog-footer .btn:last-child');
            const target = body.querySelector('[autofocus]') || body.querySelector(FOCUSABLE) || footerBtn;
            target?.focus();
        }

        function onKeydown(e) {
            if (overlay.hidden) return;
            if (e.key === 'Escape') {
                e.stopPropagation();
                if (!busy) dialog.close();
            } else if (e.key === 'Tab') {
                const items = [...overlay.querySelectorAll(FOCUSABLE)];
                const first = items[0];
                const last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        document.addEventListener('keydown', onKeydown, true);
        document.body.appendChild(overlay);
        openCount++;
        onOpen?.(body, dialog);
        focusFirst();
    });
}

/**
 * 确认对话框
 * @returns {Promise<boolean>}
 */
export async function confirmDialog({ title, message, okText = '确定', danger = false }) {
    const result = await openDialog({
        title,
        size: 'sm',
        content: `<p class="dialog-message">${message}</p>`,
        actions: [
            { label: '取消', value: false },
            { label: okText, value: true, variant: danger ? 'danger' : 'primary' }
        ]
    });
    return result === true;
}
