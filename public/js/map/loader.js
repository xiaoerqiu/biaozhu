import { CONFIG } from '../config.js';

const SDK = {
    amap: {
        global: () => window.AMap,
        url: (key) =>
            `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}` +
            '&plugin=AMap.Geocoder,AMap.Geolocation,AMap.CitySearch,AMap.Scale&callback=__onMapSdkLoaded'
    },
    baidu: {
        global: () => window.BMapGL,
        url: (key) => `https://api.map.baidu.com/api?type=webgl&v=1.0&ak=${encodeURIComponent(key)}&callback=__onMapSdkLoaded`
    }
};

let scriptEl = null;

// 高德密钥校验失败时没有事件，只会输出 console.error，后续瓦片与服务请求全部静默失败
const AMAP_AUTH_ERRORS = {
    INVALID_USER_DOMAIN: '当前域名不在该 Key 的域名白名单中，请在高德控制台的 Key 设置里添加当前域名（或清空白名单）',
    INVALID_USER_KEY: 'API Key 无效，请检查 AMAP_API_KEY 配置',
    USERKEY_PLAT_NOMATCH: 'Key 类型不匹配，请使用「Web端(JS API)」类型的 Key',
    INVALID_USER_SCODE: '安全密钥错误，请检查 AMAP_SECURITY_KEY 配置',
    USER_KEY_RECYCLED: 'Key 已被删除，请重新申请',
    DAILY_QUERY_OVER_LIMIT: '今日调用量已超出配额',
    ACCESS_TOO_FREQUENT: '访问过于频繁，请稍后重试'
};

/**
 * 监听高德密钥校验错误
 * @param {(code: string, message: string) => void} onError
 */
export function watchAmapAuthErrors(onError) {
    const original = console.error;
    let reported = false;
    console.error = (...args) => {
        original.apply(console, args);
        if (reported) return;
        const text = args.map(String).join(' ');
        const code = Object.keys(AMAP_AUTH_ERRORS).find((key) => text.includes(key));
        if (code) {
            reported = true;
            onError(code, AMAP_AUTH_ERRORS[code]);
        }
    };
}

/**
 * 动态加载地图 SDK，通过 SDK 的 callback 参数判断加载完成，超时则失败
 */
export function loadMapSdk({ provider, apiKey, securityJsCode }) {
    const sdk = SDK[provider];
    if (sdk.global()) return Promise.resolve();

    if (provider === 'amap' && securityJsCode) {
        window._AMapSecurityConfig = { securityJsCode };
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => fail('地图服务加载超时，请检查网络连接'), CONFIG.MAP.LOAD_TIMEOUT);

        function fail(message) {
            clearTimeout(timer);
            window.__onMapSdkLoaded = undefined;
            scriptEl?.remove();
            scriptEl = null;
            reject(new Error(message));
        }

        window.__onMapSdkLoaded = () => {
            clearTimeout(timer);
            if (sdk.global()) resolve();
            else fail('地图服务初始化失败，请检查 API 密钥配置');
        };

        scriptEl?.remove();
        scriptEl = document.createElement('script');
        scriptEl.src = sdk.url(apiKey);
        scriptEl.async = true;
        scriptEl.onerror = () => fail('地图脚本加载失败，请检查网络连接');
        document.head.appendChild(scriptEl);
    });
}
