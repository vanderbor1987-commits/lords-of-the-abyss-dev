/* ==========================================================
   LORDS OF THE ABYSS — CLOUDFLARE WORKER v2.1
   + Добавлен суточный рейтинг Тропы Бездны
   ========================================================== */

const TS_WINDOW_VALIDATE = 3600;
const TS_WINDOW_ARENA = 86400;
const SUBMIT_COOLDOWN_MS = 5_000;
const ATTACK_COOLDOWN_MS = 10_000;
const INBOX_MAX_ENTRIES = 20;
const RIVALS_MAX = 5;

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

const submitRateLimits = new Map();
const attackRateLimits = new Map();

function checkRateLimit(map, uid, cooldownMs) {
    const now = Date.now();
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

let sortedCache = null;
let sortedCacheTs = 0;
const SORTED_CACHE_TTL_MS = 60000;

export default {
    async fetch(request, env, ctx) {
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

        if (path === '/' || path === '/validate') return handleValidate(request, env);
        if (path === '/arena/submit') return handleArenaSubmit(request, env);
        if (path === '/arena/rivals') return handleArenaRivals(request, env);
        if (path === '/arena/attack') return handleArenaAttack(request, env);
        if (path === '/arena/inbox') return handleArenaInbox(request, env);
        if (path === '/arena/inbox/clear') return handleArenaInboxClear(request, env);
        if (path === '/arena/profile') return handleArenaProfile(request, env);
        if (path === '/arena/top') return handleArenaTop(request, env);
        if (path === '/summon/lock') return handleSummonLock(request, env);
        if (path === '/profile/reset') return handleProfileReset(request, env);
        
        // НОВЫЕ РОУТЫ ДЛЯ ТРОПЫ
        if (path === '/trail/submit') return handleTrailSubmit(request, env);
        if (path === '/trail/daily') return handleTrailDaily(request, env);

        return json({ valid: false, reason: 'not_found' }, 404);
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

async function readBody(request) {
    try {
        return await request.json();
    } catch (e) {
        return null;
    }
}

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
        'raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
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
   ТРОПА БЕЗДНЫ — СУТОЧНЫЙ РЕЙТИНГ
   ========================================================== */
async function handleTrailSubmit(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    
    const uid = auth.userId;
    const score = parseInt(body.score, 10);
    const depth = parseInt(body.depth, 10);
    if (!Number.isFinite(score) || score < 0 || !Number.isFinite(depth) || depth < 1) {
        return json({ ok: false, reason: 'invalid_score' }, 400);
    }
    
    const name = String(body.name || '???').slice(0, 12);
    const today = new Date().toISOString().slice(0, 10);
    const key = `trail:daily:${today}`;
    
    const raw = await env.LOTA_LADDER.get(key);
    let entries = [];
    if (raw) { 
        try { entries = JSON.parse(raw) || []; } catch(e) { entries = []; } 
    }
    
    // v5.3.97: проверяем, не пытается ли игрок перезаписать свой рекорд меньшим значением
    const existingIdx = entries.findIndex(e => e.uid === uid);
    if (existingIdx >= 0 && score <= entries[existingIdx].score) {
        return json({ ok: true, rank: existingIdx + 1, entries: entries, unchanged: true });
    }
    
    // Убираем старую запись этого игрока (если новый рекорд выше)
    if (existingIdx >= 0) {
        entries.splice(existingIdx, 1);
    }
    
    // Если мест уже 5 и score не выше 5-го места — не пишем (экономия KV)
    if (entries.length >= 5 && score <= entries[4].score) {
        return json({ ok: true, rank: null, entries: entries });
    }
    
    entries.push({ uid, name, score, depth, ts: Date.now() });
    entries.sort((a, b) => b.score - a.score);
    entries = entries.slice(0, 5);
    
    await env.LOTA_LADDER.put(key, JSON.stringify(entries), { expirationTtl: 2 * 86400 });
    const rank = entries.findIndex(e => e.uid === uid) + 1;
    return json({ ok: true, rank, entries });
}

async function handleTrailDaily(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    
    const today = new Date().toISOString().slice(0, 10);
    const key = `trail:daily:${today}`;
    const raw = await env.LOTA_LADDER.get(key);
    let entries = [];
    if (raw) { 
        try { entries = JSON.parse(raw) || []; } catch(e) { entries = []; } 
    }
    return json({ ok: true, entries });
}

/* ==========================================================
   АРЕНА И ЛАДДЕР
   ========================================================== */
async function handleArenaSubmit(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    const uid = auth.userId;
    const rlCheck = checkRateLimit(submitRateLimits, uid, SUBMIT_COOLDOWN_MS);
    if (!rlCheck.ok) return json({ ok: false, reason: 'rate_limited', retryIn: rlCheck.retryIn }, 429);
    
    const now = Date.now();
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
    const defenseSquad = Array.isArray(body.defenseSquad) ? body.defenseSquad : [];
    if (defenseSquad.length !== DEFENSE_SQUAD_SIZE) return json({ ok: false, reason: 'invalid_squad' }, 400);
    
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
    if (!squadOk) return json({ ok: false, reason: 'invalid_squad' }, 400);
    
    const playerKey = `player:${uid}`;
    const playerData = { uid, name, trophies, cp, defenseSquad, suspicious: !!body.suspicious, updatedAt: now };
    await env.LOTA_LADDER.put(playerKey, JSON.stringify(playerData), { expirationTtl: 90 * 86400 });
    
    const nowMs = Date.now();
    const sortedUpdatedAt = parseInt(await env.LOTA_LADDER.get('sorted_updated_at'), 10) || 0;
    let rank = null, total = 0;
    
    if (nowMs - sortedUpdatedAt >= 60000) {
        const sorted = await readSortedTrophies(env);
        const existingIdx = sorted.findIndex(p => p.uid === uid);
        if (existingIdx >= 0) sorted[existingIdx] = { uid, name, trophies, cp };
        else sorted.push({ uid, name, trophies, cp });
        sorted.sort((a, b) => b.trophies - a.trophies);
        const trimmed = sorted.slice(0, 500);
        await env.LOTA_LADDER.put('sorted:trophies', JSON.stringify(trimmed));
        await env.LOTA_LADDER.put('sorted_updated_at', String(nowMs), { expirationTtl: 300 });
        sortedCache = trimmed;
        sortedCacheTs = nowMs;
        rank = trimmed.findIndex(p => p.uid === uid) + 1 || null;
        total = trimmed.length;
    } else {
        const sorted = await readSortedTrophies(env);
        rank = sorted.findIndex(p => p.uid === uid) + 1 || null;
        total = sorted.length;
    }
    return json({ ok: true, rank: rank, total: total });
}

async function readSortedTrophies(env) {
    const now = Date.now();
    if (sortedCache && (now - sortedCacheTs) < SORTED_CACHE_TTL_MS) return sortedCache;
    const raw = await env.LOTA_LADDER.get('sorted:trophies');
    if (!raw) { sortedCache = []; sortedCacheTs = now; return sortedCache; }
    try {
        const arr = JSON.parse(raw);
        sortedCache = Array.isArray(arr) ? arr : [];
    } catch (e) { sortedCache = []; }
    sortedCacheTs = now;
    return sortedCache;
}

async function handleArenaRivals(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    const uid = auth.userId;
    const count = Math.max(1, Math.min(RIVALS_MAX, parseInt(body.count, 10) || 3));
    
    const myRaw = await env.LOTA_LADDER.get(`player:${uid}`);
    let myTrophies = 150;
    if (myRaw) { try { myTrophies = JSON.parse(myRaw).trophies || 150; } catch (e) {} }
    
    const sorted = await readSortedTrophies(env);
    if (sorted.length === 0) return json({ ok: true, rivals: [] });
    
    const candidates = sorted.filter(p => p.uid !== uid);
    if (candidates.length === 0) return json({ ok: true, rivals: [] });
    candidates.sort((a, b) => Math.abs(a.trophies - myTrophies) - Math.abs(b.trophies - myTrophies));
    
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
    
    if (!targetUid || targetUid === attackerUid) return json({ ok: false, reason: 'invalid_target' }, 400);
    if (!result) return json({ ok: false, reason: 'invalid_result' }, 400);
    if (!Number.isFinite(clientTrophyChange) || clientTrophyChange < TROPHY_CHANGE_MIN || clientTrophyChange > TROPHY_CHANGE_MAX) {
        return json({ ok: false, reason: 'invalid_trophy_change' }, 400);
    }
    
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
    
    const _attackPairKey = attackerUid + '|' + targetUid;
    const rlAttackCheck = checkRateLimit(attackRateLimits, _attackPairKey, ATTACK_COOLDOWN_MS);
    if (!rlAttackCheck.ok) return json({ ok: false, reason: 'rate_limited', retryIn: rlAttackCheck.retryIn }, 429);
    
    const now = Date.now();
    const attackerRaw = await env.LOTA_LADDER.get(`player:${attackerUid}`);
    let attackerName = 'Неизвестный';
    if (attackerRaw) { try { attackerName = JSON.parse(attackerRaw).name || attackerName; } catch (e) {} }
    
    const targetRaw = await env.LOTA_LADDER.get(`player:${targetUid}`);
    if (!targetRaw) return json({ ok: false, reason: 'target_not_found' }, 404);
    let targetData;
    try { targetData = JSON.parse(targetRaw); } catch (e) { return json({ ok: false, reason: 'target_corrupted' }, 500); }
    
    const delta = result === 'win' ? -trophyChange : trophyChange;
    const newTrophies = Math.max(TROPHIES_MIN, Math.min(TROPHIES_MAX, (targetData.trophies || 150) + delta));
    targetData.trophies = newTrophies;
    targetData.updatedAt = now;
    await env.LOTA_LADDER.put(`player:${targetUid}`, JSON.stringify(targetData));
    
    const sorted = await readSortedTrophies(env);
    const idx = sorted.findIndex(p => p.uid === targetUid);
    if (idx >= 0) {
        sorted[idx].trophies = newTrophies;
        sorted.sort((a, b) => b.trophies - a.trophies);
        const trimmed = sorted.slice(0, 500);
        await env.LOTA_LADDER.put('sorted:trophies', JSON.stringify(trimmed));
        await env.LOTA_LADDER.put('sorted_updated_at', String(now), { expirationTtl: 300 });
        sortedCache = trimmed;
        sortedCacheTs = now;
    }
    
    const inboxKey = `inbox:${targetUid}`;
    const inboxRaw = await env.LOTA_LADDER.get(inboxKey);
    let inbox = [];
    if (inboxRaw) { try { inbox = JSON.parse(inboxRaw) || []; } catch (e) { inbox = []; } }
    inbox.unshift({ attackerUid, attackerName, result, trophyChange: delta, ts: Math.floor(now / 1000) });
    inbox = inbox.slice(0, INBOX_MAX_ENTRIES);
    await env.LOTA_LADDER.put(inboxKey, JSON.stringify(inbox), { expirationTtl: 30 * 86400 });
    
    return json({ ok: true, actualDelta: trophyChange });
}

async function handleArenaInbox(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    
    const uid = auth.userId;
    const inboxRaw = await env.LOTA_LADDER.get(`inbox:${uid}`);
    let inbox = [];
    if (inboxRaw) { try { inbox = JSON.parse(inboxRaw) || []; } catch (e) { inbox = []; } }
    return json({ ok: true, attacks: inbox });
}

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

async function handleArenaProfile(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    
    const targetUid = String(body.targetUid || '');
    if (!targetUid || targetUid.length > 40) return json({ ok: false, reason: 'invalid_target' }, 400);
    
    const raw = await env.LOTA_LADDER.get(`player:${targetUid}`);
    if (!raw) return json({ ok: false, reason: 'not_found' }, 404);
    try { return json({ ok: true, player: JSON.parse(raw) }); } 
    catch (e) { return json({ ok: false, reason: 'corrupted' }, 500); }
}

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

async function handleProfileReset(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    
    const uid = auth.userId;
    await env.LOTA_LADDER.delete(`player:${uid}`);
    await env.LOTA_LADDER.delete(`inbox:${uid}`);
    await env.LOTA_LADDER.delete(`summon_lock:${uid}`);
    
    const sorted = await readSortedTrophies(env);
    const filtered = sorted.filter(p => p.uid !== uid);
    await env.LOTA_LADDER.put('sorted:trophies', JSON.stringify(filtered));
    await env.LOTA_LADDER.put('sorted_updated_at', String(Date.now()), { expirationTtl: 300 });
    return json({ ok: true });
}

const SUMMON_LOCK_TTL_MS = 60_000;

async function handleSummonLock(request, env) {
    const body = await readBody(request);
    if (!body) return json({ ok: false, reason: 'bad_json' }, 400);
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    const auth = await validateSign(rawQuery, env.APP_SECRET, TS_WINDOW_ARENA);
    if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);
    
    const uid = auth.userId;
    const deviceId = String(body.deviceId || '').slice(0, 64);
    if (!deviceId || deviceId.length < 4) return json({ ok: false, reason: 'no_device_id' }, 400);
    
    const key = `summon_lock:${uid}`;
    const now = Date.now();
    const raw = await env.LOTA_LADDER.get(key);
    
    if (raw) {
        try {
            const lock = JSON.parse(raw);
            if (lock && lock.deviceId && lock.ts) {
                const age = now - lock.ts;
                if (lock.deviceId !== deviceId && age < SUMMON_LOCK_TTL_MS) {
                    return json({ ok: false, reason: 'summon_locked', retryIn: SUMMON_LOCK_TTL_MS - age }, 200);
                }
            }
        } catch (e) {}
    }
    await env.LOTA_LADDER.put(key, JSON.stringify({ deviceId, ts: now }), { expirationTtl: 120 });
    return json({ ok: true });
}