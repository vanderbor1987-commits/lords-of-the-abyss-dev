/* ==========================================================
   LORDS OF THE ABYSS — VK LAUNCH PARAMS VALIDATOR
   Cloudflare Worker • Web Crypto (HMAC-SHA256)
   
   Задача (P9): валидация подписи параметров запуска VK Mini Apps
   в соответствии с п. 1.2.2 правил VK Mini Apps (ред. 17.03.2026).
   
   Алгоритм:
     1. Из query string извлекаются все vk_* параметры + sign.
     2. sign удаляется из набора.
     3. Оставшиеся vk_* сортируются по алфавиту.
     4. Формируется строка вида key1=value1&key2=value2...
     5. HMAC-SHA256(APP_SECRET, sorted_query) → base64url без padding.
     6. Constant-time сравнение с присланным sign.
     7. Проверка vk_ts (не старше 3600 секунд).
   
   Env vars (задаются через wrangler secret put):
     APP_SECRET — защищённый ключ приложения из VK Console.
   ========================================================== */

const TS_WINDOW_SEC = 3600; // Рекомендация VK: подпись валидна 1 час[reference:2]

export default {
    async fetch(request, env, ctx) {
        // CORS preflight — VK iframe ходит с https://*.vk.com и https://prod-app*.vk-apps.com
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders()
            });
        }

        if (request.method !== 'POST') {
            return json({ valid: false, reason: 'method_not_allowed' }, 405);
        }

        if (!env.APP_SECRET || typeof env.APP_SECRET !== 'string') {
            return json({ valid: false, reason: 'server_misconfigured' }, 500);
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return json({ valid: false, reason: 'bad_json' }, 400);
        }

        const rawQuery = body && typeof body.query === 'string' ? body.query : '';
        if (!rawQuery) {
            return json({ valid: false, reason: 'empty_query' }, 400);
        }

        const result = await validateVkSignature(rawQuery, env.APP_SECRET);
        return json(result, 200);
    }
};

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

function json(obj, status) {
    return new Response(JSON.stringify(obj), {
        status: status || 200,
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
    });
}

async function validateVkSignature(rawQuery, appSecret) {
    // 1. Парсим query в массив [key, value]. URLSearchParams корректно декодирует
    //    %-encoding, но VK шлёт уже декодированные значения — двойного декодирования нет.
    const params = new URLSearchParams(rawQuery);
    const allPairs = [];
    for (const [k, v] of params.entries()) {
        allPairs.push([k, v]);
    }

    // 2. Извлекаем sign и удаляем его из набора
    let sign = null;
    const signPairs = [];
    for (const [k, v] of allPairs) {
        if (k === 'sign') {
            sign = v;
        } else {
            signPairs.push([k, v]);
        }
    }

    if (!sign) {
        return { valid: false, reason: 'no_sign' };
    }

    // 3. Сортируем по ключу по алфавиту (побайтово, UTF-16 code units)
    signPairs.sort((a, b) => a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0));

    // 4. Собираем строку key=value&key=value...
    const sortedQuery = signPairs
        .map(([k, v]) => `${k}=${v}`)
        .join('&');

    // 5. HMAC-SHA256 → base64url без padding
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuf = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(sortedQuery)
    );
    const computedSign = base64UrlNoPad(new Uint8Array(signatureBuf));

    // 6. Constant-time сравнение. Длины должны совпадать, иначе сразу false.
    if (computedSign.length !== sign.length) {
        return { valid: false, reason: 'sign_length_mismatch' };
    }
    let mismatch = 0;
    for (let i = 0; i < computedSign.length; i++) {
        mismatch |= computedSign.charCodeAt(i) ^ sign.charCodeAt(i);
    }
    if (mismatch !== 0) {
        return { valid: false, reason: 'sign_mismatch' };
    }

    // 7. Проверка vk_ts (если есть)
    const vkTsRaw = params.get('vk_ts');
    if (vkTsRaw) {
        const vkTs = parseInt(vkTsRaw, 10);
        if (Number.isFinite(vkTs)) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (nowSec - vkTs > TS_WINDOW_SEC) {
                return { valid: false, reason: 'sign_expired' };
            }
        }
    }

    return { valid: true };
}

// base64url без padding — формат VK sign
function base64UrlNoPad(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}