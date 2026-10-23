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
