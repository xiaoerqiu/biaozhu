import { escapeHtml, icon } from '../utils.js';

let current = null;

export function closeMenu() {
    if (!current) return;
    current.remove();
    current = null;
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('blur', closeMenu);
}

function onOutside(e) {
    if (current && !current.contains(e.target)) closeMenu();
}

function onKeydown(e) {
    const items = [...current.querySelectorAll('.menu-item')];
    const index = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
        e.stopPropagation();
        closeMenu();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? index + 1 : index - 1;
        items[(next + items.length) % items.length].focus();
    }
}

/**
 * 弹出菜单
 * @param {{ x: number, y: number } | HTMLElement} anchor 坐标（右键菜单）或锚点元素（下拉菜单）
 * @param {Array<{ label: string, icon?: string, danger?: boolean, onClick: Function } | '-'>} items
 */
export function openMenu(anchor, items) {
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map((item, i) => item === '-'
        ? '<div class="menu-divider" role="separator"></div>'
        : `<button type="button" role="menuitem" class="menu-item${item.danger ? ' is-danger' : ''}" data-index="${i}">
                ${item.icon ? icon(item.icon) : ''}<span>${escapeHtml(item.label)}</span>
           </button>`).join('');

    menu.addEventListener('click', (e) => {
        const btn = e.target.closest('.menu-item');
        if (!btn) return;
        closeMenu();
        items[Number(btn.dataset.index)].onClick();
    });

    document.body.appendChild(menu);
    current = menu;

    const rect = menu.getBoundingClientRect();
    let x;
    let y;
    if (anchor instanceof HTMLElement) {
        const a = anchor.getBoundingClientRect();
        x = a.right - rect.width;
        y = a.bottom + 6;
    } else {
        ({ x, y } = anchor);
    }
    x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    y = y + rect.height > window.innerHeight - 8 ? Math.max(8, y - rect.height) : y;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.querySelector('.menu-item')?.focus();
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('blur', closeMenu);
}
