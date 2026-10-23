export const CONFIG = {
    API: {
        MAP_KEY: '/api/map-key',
        ADDRESSES: '/api/addresses',
        LOCATIONS: '/api/addresses/locations',
        UPLOAD: '/api/upload',
        EXPORT: '/api/export',
        TEMPLATE: '/api/template'
    },

    MAP: {
        LOAD_TIMEOUT: 15000,
        FOCUS_ZOOM: 16,
        LOCATE_ZOOM: 14,
        DEFAULT_ZOOM: 11,
        // 默认中心（北京）。不指定时高德按 IP 定位，开代理时可能落到境外导致地图空白
        DEFAULT_CENTER: [116.397428, 39.90923]
    },

    GEOCODE: {
        // 高德个人开发者密钥并发上限较低，串行 + 间隔请求，避免 QPS 超限被静默丢弃
        INTERVAL: 350,
        MAX_RETRIES: 3,
        RETRY_DELAY: 1200,
        // 单次请求超时（视为无法定位，不重试）
        TIMEOUT: 6000,
        // 每累计多少条结果回写一次服务器
        FLUSH_SIZE: 10
    },

    UPLOAD: {
        MAX_FILE_SIZE: 10 * 1024 * 1024,
        EXTENSIONS: ['.xlsx', '.xls', '.csv']
    },

    UI: {
        TOAST_DURATION: 3000,
        UNDO_DURATION: 8000,
        SEARCH_DEBOUNCE: 120,
        MOBILE_BREAKPOINT: 768
    },

    // 类型颜色（按类型首次出现的顺序分配）
    TYPE_COLORS: ['#1677ff', '#f5222d', '#13a8a8', '#fa8c16', '#722ed1', '#52c41a', '#eb2f96', '#2f54eb', '#d48806', '#08979c'],
    UNTYPED_COLOR: '#8c8c8c'
};
