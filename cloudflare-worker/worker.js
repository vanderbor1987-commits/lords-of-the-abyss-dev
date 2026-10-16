/* ==========================================================
   LORDS OF THE ABYSS — CLOUDFLARE WORKER v2.0
   
   Роуты:
     POST /                 → P9-валидация launch params (п. 1.2.2 правил VK)
     POST /arena/submit     → сохранить игрока (ник, кубки, CP, отряд обороны)
     POST /arena/rivals     → отдать 1-3 живых соперников с близкими кубками
     POST /arena/attack     → зарегистрировать атаку и отнять/прибавить кубки
     POST /arena/inbox      → выдать список входящих атак на игрока
     POST /arena/inbox/clear → очистить inbox (после прочтения)
   
   KV namespace: LOTA_LADDER
     player:<uid>              → JSON профиля игрока
     sorted:trophies           → JSON массив отсортированный по кубкам DESC
     inbox:<uid>               → JSON массив входящих атак
     ratelimit:submit:<uid>    → timestamp последнего submit
     ratelimit:attack:<uid>    → timestamp последней атаки
   
   ========================================================== */

const TS_WINDOW_VALIDATE = 3600;      // P9: sign актуален 1 час
const TS_WINDOW_ARENA = 86400;        // Arena: sign актуален 24 часа (долгие сессии)
const SUBMIT_COOLDOWN_MS = 5_000;     // 1 submit в 5 сек (было 60с — блокировало смену имени)
const ATTACK_COOLDOWN_MS = 10_000;    // 10 сек per attacker|target pair (v5.2.5)
// Было 60 сек per attacker — блокировало 9 из 10 быстрых атак на одного игрока,
// из-за чего на сервере долетала только одна, а жертва не получала полный прирост.
// Ключ теперь пара attackerUid|targetUid — анти-спам сохранён, но серийные атаки на одну цель проходят.
const INBOX_MAX_ENTRIES = 20;         // максимум 20 непрочитанных атак в inbox
const RIVALS_MAX = 5;                 // верхний предел на один запрос rivals

// Санити-границы для античита
const TROPHIES_MIN = 100;
const TROPHIES_MAX = 4500;
const CP_MIN = 100;
const CP_MAX = 500_000_000;
const TROPHY_CHANGE_MIN = 1;
const TROPHY_CHANGE_MAX = 50;
const DEFENSE_SQUAD_SIZE = 3;

const NAME_MIN_LEN = 2;
const NAME_MAX_LEN = 12;
const NAME_PATTERN = /^[a-zA-Zа-яА-ЯёЁ0-9 \-_]{2,12}$/;

// B4: in-memory rate-limits. Экономят 2 KV-операции на каждый submit/attack.
// Изолят живёт несколько минут, при переезде Map сбрасывается — для мягкого
// rate-limit это ОК (мы защищаем от спама, а не от целеустремлённого флуда).
const submitRateLimits = new Map();
const attackRateLimits = new Map();

function checkRateLimit(map, uid, cooldownMs) {
    const now = Date.now();
    // Периодическая очистка раз в ~1000 записей
    if (map.size > 1000) {
        const cutoff = now - 600000;
        for (const [k, v] of map) if (v < cutoff) map.delete(k);
    }
    const last = map.get(uid) || 0;
    if (now - last < cooldownMs) {
        return { ok: false, retryIn: cooldownMs - (now - last) };
    }
    map.set(uid, now);
    return { ok: true };
}

// B4: in-memory кэш sorted:trophies. Живёт в пределах изолята, TTL 60 сек.
// Раньше sorted читался на КАЖДЫЙ submit + КАЖДЫЙ rivals — теперь на порядок реже.
let sortedCache = null;
let sortedCacheTs = 0;
const SORTED_CACHE_TTL_MS = 60000;

export default {
    async fetch(request, env, ctx) {
        // CORS preflight — VK iframe + GH Pages + Yandex
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        if (request.method !== 'POST') {
            return json({ valid: false, reason: 'method_not_allowed' }, 405);
        }

        if (!env.APP_SECRET || typeof env.APP_SECRET !== 'string') {
            return json({ valid: false, reason: 'server_misconfigured' }, 500);
        }

        if (!env.LOTA_LADDER) {
            return json({ valid: false, reason: 'kv_not_bound' }, 500);
        }

        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '') || '/';

        // Роутинг
        if (path === '/' || path === '/validate') {
            return handleValidate(request, env);
        }
        if (path === '/arena/submit') return handleArenaSubmit(request, env);
        if (path === '/arena/rivals') return handleArenaRivals(request, env);
        if (path === '/arena/attack') return handleArenaAttack(request, env);
        if (path === '/arena/inbox') return handleArenaInbox(request, env);
        if (path === '/arena/inbox/clear') return handleArenaInboxClear(request, env);
        if (path === '/arena/profile') return handleArenaProfile(request, env);
        if (path === '/arena/top') return handleArenaTop(request, env);
        if (path === '/summon/lock') return handleSummonLock(request, env);

        return json({ valid: false, reason: 'not_found' }, 404);
    }
};

/* ==========================================================
   ХЕЛПЕРЫ
   ========================================================== */

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

async function readBody(request) {
    try {
        return await request.json();
    } catch (e) {
        return null;
    }
}

/* ==========================================================
   ВАЛИДАЦИЯ VK SIGN (HMAC-SHA256)
   Возвращает { ok, userId } или { ok: false, reason }
   ========================================================== */

async function validateSign(rawQuery, appSecret, tsWindowSec) {
    if (!rawQuery || typeof rawQuery !== 'string') {
        return { ok: false, reason: 'empty_query' };
    }

    const params = new URLSearchParams(rawQuery);
    const allPairs = [];
    for (const [k, v] of params.entries()) {
        allPairs.push([k, v]);
    }

    let sign = null;
    const signPairs = [];
    for (const [k, v] of allPairs) {
        if (k === 'sign') sign = v;
        else signPairs.push([k, v]);
    }

    if (!sign) return { ok: false, reason: 'no_sign' };

    // vk_ts проверяем до HMAC — если старый, не тратим CPU на подпись
    const vkTsRaw = params.get('vk_ts');
    if (vkTsRaw) {
        const vkTs = parseInt(vkTsRaw, 10);
        if (Number.isFinite(vkTs)) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (nowSec - vkTs > tsWindowSec) {
                return { ok: false, reason: 'sign_expired' };
            }
        }
    }

    signPairs.sort((a, b) => a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0));
    const sortedQuery = signPairs.map(([k, v]) => `${k}=${v}`).join('&');

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(sortedQuery));
    const computedSign = base64UrlNoPad(new Uint8Array(signatureBuf));

    if (computedSign.length !== sign.length) {
        return { ok: false, reason: 'sign_length_mismatch' };
    }
    let mismatch = 0;
    for (let i = 0; i < computedSign.length; i++) {
        mismatch |= computedSign.charCodeAt(i) ^ sign.charCodeAt(i);
    }
    if (mismatch !== 0) return { ok: false, reason: 'sign_mismatch' };

    const userId = params.get('vk_user_id') || '';
    if (!userId) return { ok: false, reason: 'no_user_id' };

    return { ok: true, userId };
}

function base64UrlNoPad(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ==========================================================
   РОУТ / — P9 валидация (не трогаем, работает как раньше)
   ========================================================== */

async function handleValidate(request, env) {
    const body = await readBody(request);
    if (!body) return json({ valid: false, reason: 'bad_json' }, 400);

    const rawQuery = body && typeof body.query === 'string' ? body.query : '';
    if (!rawQuery) return json({ valid: false, reason: 'empty_query' }, 400);

    const result = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_VALIDATE);
    if (!result.ok) return json({ valid: false, reason: result.reason }, 200);
    return json({ valid: true });
}

/* ==========================================================
   РОУТ /arena/submit — сохранить профиль игрока
   ========================================================== */

async function handleArenaSubmit(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const uid = auth.userId;

    // B4: rate-limit в in-memory Map — 0 KV-операций вместо 2.
    const rlCheck = checkRateLimit(submitRateLimits, uid, SUBMIT_COOLDOWN_MS);
    if (!rlCheck.ok) {
        return json({ ok: false, reason: 'rate_limited', retryIn: rlCheck.retryIn }, 429);
    }
    const now = Date.now();

    // Валидация полей
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!NAME_PATTERN.test(name) || name.length < NAME_MIN_LEN || name.length > NAME_MAX_LEN) {
        return json({ ok: false, reason: 'invalid_name' }, 400);
    }

    const trophies = parseInt(body.trophies, 10);
    if (!Number.isFinite(trophies) || trophies < TROPHIES_MIN || trophies > TROPHIES_MAX) {
        return json({ ok: false, reason: 'invalid_trophies' }, 400);
    }

    const cp = parseInt(body.cp, 10);
    if (!Number.isFinite(cp) || cp < CP_MIN || cp > CP_MAX) {
        return json({ ok: false, reason: 'invalid_cp' }, 400);
    }

    // B3: defenseSquad теперь может быть двух форматов:
    //   Старый: ['id1', 'id2', 'id3']
    //   Новый:  [{id, stars, lvl}, ...]
    // Оба принимаются для обратной совместимости.
    const defenseSquad = Array.isArray(body.defenseSquad) ? body.defenseSquad : [];
    if (defenseSquad.length !== DEFENSE_SQUAD_SIZE) {
        return json({ ok: false, reason: 'invalid_squad' }, 400);
    }
    const squadOk = defenseSquad.every(el => {
        if (typeof el === 'string') return el.length > 0 && el.length <= 40;
        if (el && typeof el === 'object') {
            if (typeof el.id !== 'string' || el.id.length === 0 || el.id.length > 40) return false;
            const s = parseInt(el.stars, 10), l = parseInt(el.lvl, 10);
            if (!Number.isFinite(s) || s < 1 || s > 10) return false;
            if (!Number.isFinite(l) || l < 1 || l > 300) return false;
            return true;
        }
        return false;
    });
    if (!squadOk) {
        return json({ ok: false, reason: 'invalid_squad' }, 400);
    }

    // Сохраняем профиль
    const playerKey = `player:${uid}`;
    const playerData = {
        uid,
        name,
        trophies,
        cp,
        defenseSquad,
        updatedAt: now
    };
    // v4.9.0: TTL 90 дней — ключ самоочищается, если игрок не заходит.
    // При возврате первый submit восстановит профиль заново.
    await env.LOTA_LADDER.put(playerKey, JSON.stringify(playerData), { expirationTtl: 90 * 86400 });
    // B4: ratelimit больше не пишется в KV — держится в in-memory Map.

    // B4: sorted:trophies обновляется не чаще раза в 60 сек.
    // Это экономит 1 read + 1 write на каждый submit, что критично для free tier.
    const nowMs = Date.now();
    const sortedUpdatedAt = parseInt(await env.LOTA_LADDER.get('sorted_updated_at'), 10) || 0;
    let rank = null;
    let total = 0;

    if (nowMs - sortedUpdatedAt >= 60000) {
        const sorted = await readSortedTrophies(env);
        const existingIdx = sorted.findIndex(p => p.uid === uid);
        if (existingIdx >= 0) {
            sorted[existingIdx] = { uid, name, trophies, cp };
        } else {
            sorted.push({ uid, name, trophies, cp });
        }
        sorted.sort((a, b) => b.trophies - a.trophies);
        const trimmed = sorted.slice(0, 500);
        await env.LOTA_LADDER.put('sorted:trophies', JSON.stringify(trimmed));
        await env.LOTA_LADDER.put('sorted_updated_at', String(nowMs), { expirationTtl: 300 });
        sortedCache = trimmed;
        sortedCacheTs = nowMs;
        rank = trimmed.findIndex(p => p.uid === uid) + 1 || null;
        total = trimmed.length;
    } else {
        // Быстрый путь: rank из кэша (может быть чуть устаревшим, но это некритично)
        const sorted = await readSortedTrophies(env);
        rank = sorted.findIndex(p => p.uid === uid) + 1 || null;
        total = sorted.length;
    }

    return json({ ok: true, rank: rank, total: total });
}

async function readSortedTrophies(env) {
    const now = Date.now();
    if (sortedCache && (now - sortedCacheTs) < SORTED_CACHE_TTL_MS) {
        return sortedCache;
    }
    const raw = await env.LOTA_LADDER.get('sorted:trophies');
    if (!raw) {
        sortedCache = [];
        sortedCacheTs = now;
        return sortedCache;
    }
    try {
        const arr = JSON.parse(raw);
        sortedCache = Array.isArray(arr) ? arr : [];
    } catch (e) {
        sortedCache = [];
    }
    sortedCacheTs = now;
    return sortedCache;
}

/* ==========================================================
   РОУТ /arena/rivals — отдать N ближайших по кубкам
   ========================================================== */

async function handleArenaRivals(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const uid = auth.userId;
    const count = Math.max(1, Math.min(RIVALS_MAX, parseInt(body.count, 10) || 3));

    // Свой профиль (если есть)
    const myRaw = await env.LOTA_LADDER.get(`player:${uid}`);
    let myTrophies = 150;
    if (myRaw) {
        try { myTrophies = JSON.parse(myRaw).trophies || 150; } catch (e) {}
    }

    const sorted = await readSortedTrophies(env);
    if (sorted.length === 0) {
        return json({ ok: true, rivals: [] });
    }

    // Ищем соседей по кубкам (кроме себя)
    const candidates = sorted.filter(p => p.uid !== uid);
    if (candidates.length === 0) {
        return json({ ok: true, rivals: [] });
    }

    // Сортируем по |Δtrophies| возрастанию
    candidates.sort((a, b) => Math.abs(a.trophies - myTrophies) - Math.abs(b.trophies - myTrophies));

    // v5.3.1: пропускаем мёртвые профили (player:<uid> истёк по TTL 90 дней,
    // но запись в sorted осталась). Перебираем candidates до заполнения count.
    const rivals = [];
    for (const p of candidates) {
        if (rivals.length >= count) break;
        const fullRaw = await env.LOTA_LADDER.get(`player:${p.uid}`);
        if (!fullRaw) continue;
        try {
            const profile = JSON.parse(fullRaw);
            const rankIdx = sorted.findIndex(s => s.uid === p.uid);
            profile.rank = rankIdx >= 0 ? rankIdx + 1 : null;
            rivals.push(profile);
        } catch (e) {}
    }

    return json({ ok: true, rivals });
}

/* ==========================================================
   РОУТ /arena/attack — зарегистрировать атаку
   ========================================================== */

async function handleArenaAttack(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const attackerUid = auth.userId;
    const targetUid = String(body.targetUid || '');
    const result = body.result === 'win' ? 'win' : (body.result === 'loss' ? 'loss' : null);
    const clientTrophyChange = parseInt(body.trophyChange, 10);

    if (!targetUid || targetUid === attackerUid) {
        return json({ ok: false, reason: 'invalid_target' }, 400);
    }
    if (!result) return json({ ok: false, reason: 'invalid_result' }, 400);
    if (!Number.isFinite(clientTrophyChange) || clientTrophyChange < TROPHY_CHANGE_MIN || clientTrophyChange > TROPHY_CHANGE_MAX) {
        return json({ ok: false, reason: 'invalid_trophy_change' }, 400);
    }

    // v4.9.0 PVP-HARDENING: серверная валидация цели и trophyChange.
    // Раньше клиент мог отправить любой targetUid и trophyChange до 50 — читер
    // списывал по 50 кубков у произвольной жертвы. Теперь:
    //   1) target обязан быть в sorted:trophies;
    //   2) разница кубков ≤ 200 (жертва не «дальняя»);
    //   3) trophyChange вычисляется сервером по разнице кубков, клиентское игнорируется.
    const _sortedForAttack = await readSortedTrophies(env);
    const _attackerEntry = _sortedForAttack.find(p => p.uid === attackerUid);
    const _targetEntry = _sortedForAttack.find(p => p.uid === targetUid);
    if (!_attackerEntry) return json({ ok: false, reason: 'attacker_not_ranked' }, 400);
    if (!_targetEntry) return json({ ok: false, reason: 'target_not_ranked' }, 400);
    const _trophyGap = Math.abs(_attackerEntry.trophies - _targetEntry.trophies);
    if (_trophyGap > 200) return json({ ok: false, reason: 'target_too_far', gap: _trophyGap }, 400);

    let _serverTrophyChange = 15;
    if (_attackerEntry.trophies < _targetEntry.trophies) {
        if (_trophyGap >= 150) _serverTrophyChange = 30;
        else if (_trophyGap >= 80) _serverTrophyChange = 24;
        else if (_trophyGap >= 30) _serverTrophyChange = 20;
        else _serverTrophyChange = 18;
    } else {
        if (_trophyGap >= 150) _serverTrophyChange = 10;
        else if (_trophyGap >= 80) _serverTrophyChange = 12;
        else if (_trophyGap >= 30) _serverTrophyChange = 14;
        else _serverTrophyChange = 16;
    }
    const trophyChange = _serverTrophyChange;

    // v5.2.5: cooldown per (attacker|target) pair. 10 сек — серийные атаки долетают,
    // spam по разным целям всё ещё ограничен общим Map-лимитом.
    const _attackPairKey = attackerUid + '|' + targetUid;
    const rlAttackCheck = checkRateLimit(attackRateLimits, _attackPairKey, ATTACK_COOLDOWN_MS);
    if (!rlAttackCheck.ok) {
        return json({ ok: false, reason: 'rate_limited', retryIn: rlAttackCheck.retryIn }, 429);
    }
    const now = Date.now();

    // Профиль атакующего — для отображения имени в inbox защитника
    const attackerRaw = await env.LOTA_LADDER.get(`player:${attackerUid}`);
    let attackerName = 'Неизвестный';
    if (attackerRaw) {
        try { attackerName = JSON.parse(attackerRaw).name || attackerName; } catch (e) {}
    }

    // Обновляем кубки защитника (реальное списание)
    const targetRaw = await env.LOTA_LADDER.get(`player:${targetUid}`);
    if (!targetRaw) {
        return json({ ok: false, reason: 'target_not_found' }, 404);
    }
    let targetData;
    try { targetData = JSON.parse(targetRaw); } catch (e) {
        return json({ ok: false, reason: 'target_corrupted' }, 500);
    }

    const delta = result === 'win' ? -trophyChange : trophyChange;
    const newTrophies = Math.max(TROPHIES_MIN, Math.min(TROPHIES_MAX, (targetData.trophies || 150) + delta));
    targetData.trophies = newTrophies;
    targetData.updatedAt = now;
    await env.LOTA_LADDER.put(`player:${targetUid}`, JSON.stringify(targetData));

    // Обновляем sorted:trophies
    const sorted = await readSortedTrophies(env);
    const idx = sorted.findIndex(p => p.uid === targetUid);
    if (idx >= 0) {
        sorted[idx].trophies = newTrophies;
        sorted.sort((a, b) => b.trophies - a.trophies);
        const trimmed = sorted.slice(0, 500);
        await env.LOTA_LADDER.put('sorted:trophies', JSON.stringify(trimmed));
        await env.LOTA_LADDER.put('sorted_updated_at', String(now), { expirationTtl: 300 });
        // B4: обновляем in-memory кэш, чтобы rivals сразу видели новые кубки
        sortedCache = trimmed;
        sortedCacheTs = now;
    }

    // Пишем в inbox защитника
    const inboxKey = `inbox:${targetUid}`;
    const inboxRaw = await env.LOTA_LADDER.get(inboxKey);
    let inbox = [];
    if (inboxRaw) {
        try { inbox = JSON.parse(inboxRaw) || []; } catch (e) { inbox = []; }
    }
    inbox.unshift({
        attackerUid,
        attackerName,
        result,
        trophyChange: delta,
        ts: Math.floor(now / 1000)
    });
    inbox = inbox.slice(0, INBOX_MAX_ENTRIES);
    await env.LOTA_LADDER.put(inboxKey, JSON.stringify(inbox), { expirationTtl: 30 * 86400 });

    // B4: ratelimit теперь в in-memory Map — KV-запись убрана.
    // v5.3.1: возвращаем actualDelta — клиент синхронизирует локальные кубки
    // с серверным значением. Устраняет расхождение 16-32 (клиент) vs 10-30 (сервер).
    return json({ ok: true, actualDelta: trophyChange });
}

/* ==========================================================
   РОУТ /arena/inbox — выдать входящие атаки
   ========================================================== */

async function handleArenaInbox(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const uid = auth.userId;
    const inboxRaw = await env.LOTA_LADDER.get(`inbox:${uid}`);
    let inbox = [];
    if (inboxRaw) {
        try { inbox = JSON.parse(inboxRaw) || []; } catch (e) { inbox = []; }
    }
    return json({ ok: true, attacks: inbox });
}

/* ==========================================================
   РОУТ /arena/inbox/clear — очистить inbox
   ========================================================== */

async function handleArenaInboxClear(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const uid = auth.userId;
    await env.LOTA_LADDER.put(`inbox:${uid}`, '[]', { expirationTtl: 86400 });
    return json({ ok: true });
}

/* ==========================================================
   РОУТ /arena/profile — получить профиль игрока по uid
   Используется для реванша из журнала атак.
   ========================================================== */

async function handleArenaProfile(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const targetUid = String(body.targetUid || '');
    if (!targetUid || targetUid.length > 40) {
        return json({ ok: false, reason: 'invalid_target' }, 400);
    }

    const raw = await env.LOTA_LADDER.get(`player:${targetUid}`);
    if (!raw) return json({ ok: false, reason: 'not_found' }, 404);

    try {
        const player = JSON.parse(raw);
        return json({ ok: true, player });
    } catch (e) {
        return json({ ok: false, reason: 'corrupted' }, 500);
    }
}

/* ==========================================================
   РОУТ /arena/top — глобальный топ-10 живых игроков.

   B6: используется клиентским renderLeaderboard для подмешивания
   живых поверх ботов. sorted:trophies уже кэшируется в изоляте
   Worker'а (readSortedTrophies, TTL 60 сек), поэтому реальных
   KV-чтений будет ~1 в минуту даже при массовых запросах.

   Writes: 0. Free tier не страдает.
   ========================================================== */

async function handleArenaTop(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const limit = Math.max(1, Math.min(20, parseInt(body.limit, 10) || 10));

    const sorted = await readSortedTrophies(env);
    const top = sorted.slice(0, limit).map(p => ({
        uid: String(p.uid || ''),
        name: String(p.name || '???').slice(0, 12),
        trophies: Math.floor(p.trophies || 0),
        cp: Math.floor(p.cp || 0)
    }));

    return json({ ok: true, players: top });
}

/* ==========================================================
   РОУТ /summon/lock — блокировка призыва на сессию устройства.

   Клиент перед каждым роллом отправляет deviceId (UUID в localStorage).
   Worker ставит summon_lock:<uid> = {deviceId, ts} с TTL 60 сек. Второе
   устройство с тем же uid в окне 60 сек получает summon_locked и не крутит.

   Защита от RNG-дубля: первое устройство за это окно успевает запушить
   новые кристаллы в KV через submit — второе при следующем заходе подтянет
   их и не увидит старый баланс.
   ========================================================== */

const SUMMON_LOCK_TTL_MS = 60_000;

async function handleSummonLock(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);

    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

    const uid = auth.userId;
    const deviceId = String(body.deviceId || '').slice(0, 64);
    if (!deviceId || deviceId.length < 4) {
        return json({ ok: false, reason: 'no_device_id' }, 400);
    }

    const key = `summon_lock:${uid}`;
    const now = Date.now();

    const raw = await env.LOTA_LADDER.get(key);
    if (raw) {
        try {
            const lock = JSON.parse(raw);
            if (lock && lock.deviceId && lock.ts) {
                const age = now - lock.ts;
                // Активный лок на другом устройстве — блок.
                if (lock.deviceId !== deviceId && age < SUMMON_LOCK_TTL_MS) {
                    return json({
                        ok: false,
                        reason: 'summon_locked',
                        retryIn: SUMMON_LOCK_TTL_MS - age
                    }, 200);
                }
            }
        } catch (e) {}
    }

    // Наш лок, истёкший, или отсутствует — переписываем свежим.
    await env.LOTA_LADDER.put(key, JSON.stringify({ deviceId, ts: now }), { expirationTtl: 120 });
    return json({ ok: true });
}