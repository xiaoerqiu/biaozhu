import { CONFIG } from '../config.js';
import { store, FILTER_UNLOCATED } from '../store.js';
import { debounce, escapeHtml, highlight, icon } from '../utils.js';

/**
 * 侧边栏：搜索、类型筛选、地址列表
 * 只负责渲染与交互事件，业务操作通过 handlers 回调交给 main.js
 */
export class Sidebar {
    constructor(root, handlers) {
        this.root = root;
        this.handlers = handlers;
        this.cards = new Map(); // id -> { el, key }

        this.searchInput = root.querySelector('#search');
        this.clearBtn = root.querySelector('#search-clear');
        this.chipsEl = root.querySelector('#chips');
        this.metaEl = root.querySelector('#list-meta');
        this.listEl = root.querySelector('#address-list');
        this.emptyEl = root.querySelector('#list-empty');
        this.onboardEl = root.querySelector('#onboarding');

        this._bindEvents();
    }

    _bindEvents() {
        const applyQuery = debounce((value) => store.set({ query: value }), CONFIG.UI.SEARCH_DEBOUNCE);
        this.searchInput.addEventListener('input', () => {
            this.clearBtn.hidden = !this.searchInput.value;
            applyQuery(this.searchInput.value);
        });
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.searchInput.value) {
                e.stopPropagation();
                this.clearSearch();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._focusCard(0);
            } else if (e.key === 'Enter') {
                const first = store.filtered[0];
                if (first) this.handlers.onSelect(first.id);
            }
        });
        this.clearBtn.onclick = () => {
            this.clearSearch();
            this.searchInput.focus();
        };

        this.chipsEl.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            const value = chip.dataset.type || null;
            this.handlers.onFilter(store.state.typeFilter === value ? null : value);
        });

        this.listEl.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (!card) return;
            const id = Number(card.dataset.id);
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'edit') this.handlers.onEdit(id);
            else if (action === 'more') this.handlers.onMenu(id, e.target.closest('button'));
            else this.handlers.onSelect(id);
        });

        this.listEl.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.card');
            if (!card) return;
            e.preventDefault();
            this.handlers.onMenu(Number(card.dataset.id), { x: e.clientX, y: e.clientY });
        });

        this.listEl.addEventListener('keydown', (e) => {
            const card = e.target.closest('.card');
            if (!card || e.target !== card) return;
            const index = [...this.listEl.children].indexOf(card);
            const id = Number(card.dataset.id);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const next = index + (e.key === 'ArrowDown' ? 1 : -1);
                if (next < 0) this.searchInput.focus();
                else this._focusCard(next);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handlers.onSelect(id);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.handlers.onDelete(id);
            } else if (e.key === 'e') {
                this.handlers.onEdit(id);
            } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                e.preventDefault();
                this.handlers.onMenu(id, card.querySelector('[data-action="more"]'));
            }
        });
    }

    clearSearch() {
        this.searchInput.value = '';
        this.clearBtn.hidden = true;
        store.set({ query: '' });
    }

    focusSearch() {
        this.searchInput.focus();
        this.searchInput.select();
    }

    _focusCard(index) {
        const card = this.listEl.children[index];
        if (!card) return;
        card.focus({ preventScroll: true });
        this._scrollIntoList(card, 'auto');
    }

    scrollToSelected() {
        const entry = this.cards.get(store.state.selectedId);
        if (entry) this._scrollIntoList(entry.el, 'smooth');
    }

    // 只滚动列表容器（scrollIntoView 会连带滚动页面，移动端抽屉收起时会把整页顶上去）
    _scrollIntoList(el, behavior) {
        const list = this.listEl;
        const top = el.offsetTop - list.offsetTop;
        const bottom = top + el.offsetHeight;
        if (top < list.scrollTop) {
            list.scrollTo({ top: top - 8, behavior });
        } else if (bottom > list.scrollTop + list.clientHeight) {
            list.scrollTo({ top: bottom - list.clientHeight + 8, behavior });
        }
    }

    render() {
        const { state, stats, filtered, types } = store;
        const hasData = stats.total > 0;

        this.root.classList.toggle('is-empty', !hasData && !state.loading);
        this.root.classList.toggle('is-loading', state.loading);
        this.onboardEl.hidden = hasData || state.loading;

        this._renderChips(types, stats, state.typeFilter);
        this._renderMeta(filtered.length, stats, state);
        this._renderList(filtered, state);

        const filtering = state.query.trim() || state.typeFilter;
        this.emptyEl.hidden = !(hasData && filtered.length === 0);
        if (!this.emptyEl.hidden) {
            this.emptyEl.innerHTML = `${icon('search', 28)}<p>没有匹配的地址</p>
                ${filtering ? '<button type="button" class="btn btn-link" data-reset>清除筛选条件</button>' : ''}`;
            this.emptyEl.querySelector('[data-reset]')?.addEventListener('click', () => {
                this.clearSearch();
                this.handlers.onFilter(null);
            });
        }
    }

    _renderChips(types, stats, active) {
        if (!stats.total) {
            this.chipsEl.innerHTML = '';
            return;
        }
        const chip = (value, label, count, color, extraClass = '') => `
            <button type="button" class="chip${active === value ? ' is-active' : ''} ${extraClass}"
                data-type="${escapeHtml(value ?? '')}" aria-pressed="${active === value}">
                ${color ? `<i class="chip-dot" style="background:${color}"></i>` : ''}
                <span>${escapeHtml(label)}</span><span class="chip-count">${count}</span>
            </button>`;
        const html = [
            chip(null, '全部', stats.total),
            stats.unlocated ? chip(FILTER_UNLOCATED, '未定位', stats.unlocated, null, 'chip-warn') : '',
            ...types.map((t) => chip(t.type, t.type, t.count, t.color))
        ].join('');
        if (html !== this._chipsHtml) {
            this.chipsEl.innerHTML = html;
            this._chipsHtml = html;
        }
    }

    _renderMeta(shown, stats, state) {
        if (!stats.total) {
            this.metaEl.innerHTML = '';
            return;
        }
        const countText = shown === stats.total ? `共 ${stats.total} 条` : `显示 ${shown} / ${stats.total} 条`;
        let progress = '';
        if (state.geoProgress) {
            const { done, total } = state.geoProgress;
            progress = `<span class="geo-progress" title="正在根据地址获取坐标">
                <span class="spinner spinner-sm"></span>正在定位 ${done}/${total}
                <span class="progress-bar"><span style="width:${Math.round((done / total) * 100)}%"></span></span>
            </span>`;
        }
        this.metaEl.innerHTML = `<span>${countText}</span>${progress}`;
    }

    _renderList(items, state) {
        const query = state.query.trim();
        const keep = new Set();
        const tabTarget = items.find((i) => i.id === state.selectedId)?.id ?? items[0]?.id;

        items.forEach((item, index) => {
            keep.add(item.id);
            const selected = item.id === state.selectedId;
            const key = [item.number, item.name, item.address, item.type, item.color, item.located, item.geo, selected, query].join('|');
            let entry = this.cards.get(item.id);
            if (!entry) {
                const el = document.createElement('li');
                el.className = 'card';
                el.dataset.id = item.id;
                el.setAttribute('role', 'option');
                entry = { el, key: null };
                this.cards.set(item.id, entry);
            }
            if (entry.key !== key) {
                entry.el.innerHTML = this._cardHtml(item, query);
                entry.el.classList.toggle('is-selected', selected);
                entry.el.setAttribute('aria-selected', String(selected));
                entry.key = key;
            }
            entry.el.tabIndex = item.id === tabTarget ? 0 : -1;
            // 仅在位置不对时移动节点，避免打断焦点
            if (this.listEl.children[index] !== entry.el) {
                this.listEl.insertBefore(entry.el, this.listEl.children[index] || null);
            }
        });

        for (const [id, entry] of this.cards) {
            if (!keep.has(id)) {
                entry.el.remove();
                this.cards.delete(id);
            }
        }
    }

    _cardHtml(item, query) {
        let status = '';
        if (item.geo === 'pending') status = '<span class="badge badge-info"><span class="spinner spinner-xs"></span>定位中</span>';
        else if (item.geo === 'failed') status = `<span class="badge badge-warn">${icon('alert-circle', 12)}定位失败</span>`;
        else if (!item.located) status = '<span class="badge badge-muted">未定位</span>';

        const tag = item.type
            ? `<span class="tag" style="--c:${item.color}">${highlight(item.type, query)}</span>`
            : '';

        return `
            <span class="card-num" style="--c:${item.color}">${item.number}</span>
            <div class="card-body">
                <div class="card-title">${item.name ? highlight(item.name, query) : '<span class="muted">未命名地点</span>'}</div>
                <div class="card-addr">${highlight(item.address, query)}</div>
                ${tag || status ? `<div class="card-meta">${tag}${status}</div>` : ''}
            </div>
            <div class="card-actions">
                <button type="button" class="icon-btn" data-action="edit" title="编辑" aria-label="编辑" tabindex="-1">${icon('edit')}</button>
                <button type="button" class="icon-btn" data-action="more" title="更多操作" aria-label="更多操作" tabindex="-1">${icon('more')}</button>
            </div>`;
    }
}
