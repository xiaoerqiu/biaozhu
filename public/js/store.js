import { buildTypeColors, hasCoords } from './utils.js';

// 特殊筛选：仅显示未定位的地址
export const FILTER_UNLOCATED = '__unlocated__';

/**
 * 应用状态：地址数据、筛选条件、选中项、地理编码状态
 * 任何修改通过 set() 触发订阅者重新渲染
 */
class Store {
    constructor() {
        this.state = {
            addresses: [],
            loading: true,
            query: '',
            typeFilter: null,
            selectedId: null,
            // id -> 'pending' | 'failed'
            geoStatus: new Map(),
            geoProgress: null // { done, total }
        };
        this.listeners = new Set();
        this._derive();
    }

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    set(patch) {
        const prev = this.state;
        this.state = { ...prev, ...patch };
        if (patch.addresses || patch.query !== undefined || patch.typeFilter !== undefined || patch.geoStatus) {
            this._derive();
        }
        for (const fn of this.listeners) fn(this.state, prev);
    }

    // 计算衍生数据：序号、颜色、类型统计、筛选结果
    _derive() {
        const { addresses, query, typeFilter, geoStatus } = this.state;
        const colorOf = buildTypeColors(addresses);
        const typeCounts = new Map();
        let located = 0;

        this.items = addresses.map((item, i) => {
            if (item.type) typeCounts.set(item.type, (typeCounts.get(item.type) || 0) + 1);
            const ok = hasCoords(item);
            if (ok) located++;
            return { ...item, number: i + 1, color: colorOf(item.type), located: ok, geo: geoStatus.get(item.id) || null };
        });

        const q = query.trim().toLowerCase();
        this.filtered = this.items.filter((item) => {
            if (typeFilter === FILTER_UNLOCATED && item.located) return false;
            if (typeFilter && typeFilter !== FILTER_UNLOCATED && item.type !== typeFilter) return false;
            if (!q) return true;
            return [item.name, item.address, item.type].some((v) => v && v.toLowerCase().includes(q));
        });

        this.types = [...typeCounts.entries()].map(([type, count]) => ({ type, count, color: colorOf(type) }));
        this.stats = { total: addresses.length, located, unlocated: addresses.length - located };
    }

    getItem(id) {
        return this.items.find((item) => item.id === id) || null;
    }

    // —— 数据修改辅助方法 ——

    replaceAll(addresses) {
        this.set({ addresses, selectedId: null, geoStatus: new Map(), typeFilter: null });
    }

    upsert(record) {
        const exists = this.state.addresses.some((a) => a.id === record.id);
        const addresses = exists
            ? this.state.addresses.map((a) => (a.id === record.id ? record : a))
            : [...this.state.addresses, record];
        const geoStatus = new Map(this.state.geoStatus);
        geoStatus.delete(record.id);
        this.set({ addresses, geoStatus });
    }

    remove(id) {
        const geoStatus = new Map(this.state.geoStatus);
        geoStatus.delete(id);
        this.set({
            addresses: this.state.addresses.filter((a) => a.id !== id),
            selectedId: this.state.selectedId === id ? null : this.state.selectedId,
            geoStatus
        });
    }

    setLocation(id, lng, lat) {
        const geoStatus = new Map(this.state.geoStatus);
        geoStatus.delete(id);
        this.set({
            addresses: this.state.addresses.map((a) => (a.id === id ? { ...a, lng, lat } : a)),
            geoStatus
        });
    }

    setGeoStatus(ids, status) {
        const geoStatus = new Map(this.state.geoStatus);
        for (const id of ids) {
            if (status) geoStatus.set(id, status);
            else geoStatus.delete(id);
        }
        this.set({ geoStatus });
    }
}

export const store = new Store();
