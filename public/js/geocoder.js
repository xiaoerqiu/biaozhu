import { CONFIG } from './config.js';
import { api } from './api.js';
import { store } from './store.js';
import { sleep } from './utils.js';

export class RetryableGeocodeError extends Error {}

/**
 * 地理编码队列：串行限速请求，失败自动重试，结果批量回写服务器
 */
export class GeocodeQueue {
    constructor() {
        this.map = null;
        this.queue = [];
        this.running = false;
        this.pendingSaves = [];
        this.progress = { done: 0, total: 0 };
    }

    attach(mapAdapter) {
        this.map = mapAdapter;
        this._run();
    }

    // 加入队列；已在队列中的地址更新为最新地址文本
    enqueue(items) {
        const queued = new Map(this.queue.map((job) => [job.id, job]));
        const fresh = [];
        for (const item of items) {
            const job = queued.get(item.id);
            if (job) {
                job.address = item.address;
                job.attempts = 0;
            } else {
                fresh.push(item);
            }
        }
        store.setGeoStatus(items.map((item) => item.id), 'pending');
        if (!fresh.length) return;

        this.queue.push(...fresh.map((item) => ({ id: item.id, address: item.address, attempts: 0 })));
        this.progress.total += fresh.length;
        this._emitProgress();
        this._run();
    }

    // 地图不可用时放弃排队中的任务，恢复为“未定位”状态
    abandon() {
        store.setGeoStatus(this.queue.map((job) => job.id), null);
        this.reset();
    }

    // 清空队列（数据被整体替换时调用）
    reset() {
        this.queue = [];
        this.progress = { done: 0, total: 0 };
        this._emitProgress();
    }

    async _run() {
        if (this.running || !this.map) return;
        this.running = true;

        while (this.queue.length) {
            const job = this.queue.shift();
            // 地址在排队期间被删除或修改，跳过
            const current = store.state.addresses.find((a) => a.id === job.id);
            if (!current || current.address !== job.address) {
                this._finishJob();
                continue;
            }

            try {
                const { lng, lat } = await this._geocode(job.address);
                store.setLocation(job.id, lng, lat);
                this.pendingSaves.push({ id: job.id, lng, lat });
                this._finishJob();
            } catch (error) {
                if (error instanceof RetryableGeocodeError && job.attempts < CONFIG.GEOCODE.MAX_RETRIES) {
                    job.attempts++;
                    this.queue.push(job);
                    await sleep(CONFIG.GEOCODE.RETRY_DELAY * job.attempts);
                } else {
                    store.setGeoStatus([job.id], 'failed');
                    this._finishJob();
                }
            }

            if (this.pendingSaves.length >= CONFIG.GEOCODE.FLUSH_SIZE) this._flush();
            await sleep(CONFIG.GEOCODE.INTERVAL);
        }

        this._flush();
        this.running = false;
        this.progress = { done: 0, total: 0 };
        this._emitProgress();
    }

    // 高德对部分无法解析的地址不会触发回调，需超时兜底，否则队列会永久阻塞
    _geocode(address) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('TIMEOUT')), CONFIG.GEOCODE.TIMEOUT);
        });
        return Promise.race([this.map.geocode(address), timeout]).finally(() => clearTimeout(timer));
    }

    _finishJob() {
        this.progress.done++;
        this._emitProgress();
    }

    _emitProgress() {
        const { done, total } = this.progress;
        store.set({ geoProgress: total > 0 && done < total ? { done, total } : null });
    }

    _flush() {
        if (!this.pendingSaves.length) return;
        const batch = this.pendingSaves;
        this.pendingSaves = [];
        // 回写失败不影响前端展示，下次加载会重新编码
        api.saveLocations(batch).catch((error) => console.warn('坐标回写失败:', error));
    }
}

export const geocodeQueue = new GeocodeQueue();
