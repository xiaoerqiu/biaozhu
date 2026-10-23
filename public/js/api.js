import { CONFIG } from './config.js';

export class ApiError extends Error {}

async function request(url, { method = 'GET', body } = {}) {
    const options = { method, headers: {} };
    if (body instanceof FormData) {
        options.body = body;
    } else if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(url, options);
    } catch {
        throw new ApiError('网络连接失败，请检查网络后重试');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new ApiError(data.error || `请求失败（${res.status}）`);
    }
    return data;
}

export const api = {
    getMapConfig: () => request(CONFIG.API.MAP_KEY),

    listAddresses: async () => (await request(CONFIG.API.ADDRESSES)).data,

    createAddress: async (payload) => (await request(CONFIG.API.ADDRESSES, { method: 'POST', body: payload })).data,

    updateAddress: async (id, payload) => (await request(`${CONFIG.API.ADDRESSES}/${id}`, { method: 'PUT', body: payload })).data,

    deleteAddress: (id) => request(`${CONFIG.API.ADDRESSES}/${id}`, { method: 'DELETE' }),

    clearAddresses: () => request(CONFIG.API.ADDRESSES, { method: 'DELETE' }),

    saveLocations: (locations) => request(CONFIG.API.LOCATIONS, { method: 'PATCH', body: locations }),

    upload: (file, mode) => {
        const form = new FormData();
        form.append('file', file);
        return request(`${CONFIG.API.UPLOAD}?mode=${mode}`, { method: 'POST', body: form });
    }
};
