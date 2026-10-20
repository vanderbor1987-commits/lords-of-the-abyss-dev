/* ==========================================================
   LORDS OF THE ABYSS — МАСТЕР-ПАНЕЛЬ (data-admin.js)
   v1.2 (2026-10-20): +Генератор персональных промокодов (ownerVkId + vipDays + expiresAt)
   
   Назначение: локальный админ-инструмент для QA и live-ops.
   Даёт разработчику GUI с кнопками начисления ресурсов,
   прокачки героев, телепортации по этажам и т.д.
   
   ЗАЩИТА (3 уровня):
     1. vk_user_id должен совпадать с ADMIN_VK_ID
     2. В URL должен быть параметр ?admin=1
     3. Панель видна только если оба условия выполнены
   
   При обычном заходе (без ?admin=1) — ни кнопки, ни window.admin
   в глобальной области нет. Игрок не может вызвать функции.
   
   Использование:
     Открыть игру с ?admin=1 под своим VK-аккаунтом.
     В правом нижнем углу появится кнопка ⚙.
     Тап → откроется панель с командами.
   
   Безопасность:
     Даже если кто-то узнает ADMIN_VK_ID и попробует подделать
     URL — VK Bridge вернёт настоящий user_id, и проверка провалится.
     Подделать launch params без валидной подписи VK невозможно.
   ========================================================== */

const ADMIN_VK_ID = '12216517';

// Флаг активной админ-сессии (устанавливается только после успешной проверки)
let isAdminSession = false;

// Единый вход: вызывается из engine.js после получения user_id
// (см. PlatformBridge.initVKHandshake) и при загрузке, если user_id из URL.
function ensureAdminAccess() {
    if (isAdminSession) return;

    // FIX-ADMIN-VK: VK Games перезаписывает URL iframe на launch params,
    // полностью выкидывая кастомные параметры (?admin=1 физически не доезжает
    // до нашего скрипта). Для VK-контекста полагаемся только на vk_user_id —
    // защита железная, т.к. user_id подписан sign и валидируется через P9
    // (Cloudflare Worker, APP_SECRET). Подделать ID без секрета невозможно.
    // Для standalone (GH Pages, localhost) ?admin=1 ОБЯЗАТЕЛЕН — там нет подписи,
    // и любой может подставить vk_user_id=12216517 в URL вручную.
    const isVk = (typeof isRunningInsideVK === 'function') ? isRunningInsideVK() : false;
    const urlHasAdmin = window.location.search.includes('admin=1');

    if (!isVk && !urlHasAdmin) return;

    const currentId = (typeof getCurrentVkUserId === 'function') ? getCurrentVkUserId() : '';
    if (currentId !== ADMIN_VK_ID) {
        console.warn('[Admin] Access denied: user_id mismatch');
        return;
    }

    isAdminSession = true;
    devLog('[Admin] Session activated for', currentId);

    // Показываем кнопку
    const btn = document.getElementById('btn-admin-panel');
    if (btn) btn.style.display = 'flex';

    // Регистрируем глобальный API (доступен только в admin-сессии)
    registerAdminAPI();
}

function registerAdminAPI() {
    window.admin = {
        grant: adminGrant,
        unlockAll: adminUnlockAll,
        maxHeroes: adminMaxHeroes,
        maxBuildings: adminMaxBuildings,
        skipFtue: adminSkipFtue,
        resetFtue: adminResetFtue,
        teleport: adminTeleport,
        setLeague: adminSetLeague,
        addVip: adminAddVip,
        resetSeason: adminResetSeason,
        showState: adminShowState,
        promo: {
            openGenerator: openAdminPromoGenerator,
            generate: adminPromoGenerate,
            copy: adminPromoCopy,
            list: adminPromoList
        },
        preview: {
            season: adminPreviewSeasonCeremony,
            leviathan: adminPreviewLeviathanTriumph,
            ascension: adminPreviewAscensionRitual,
            epicQuoteSSS: adminPreviewEpicQuoteSSS,
            firstPurchase: adminPreviewFirstPurchase,
            mastery: adminPreviewMasteryAwakening,
            offline: adminPreviewOfflineIncome,
            arenaInbox: adminPreviewArenaInbox,
            trailDaily: adminPreviewTrailDaily,
            trailMeta: adminPreviewTrailMeta,
            trailHelp: adminPreviewTrailHelp,
            heroSSS: adminPreviewHeroSSS,
            playerInspect: adminPreviewPlayerInspect,
            battleHub: adminPreviewBattleHub,
            chronicles: adminPreviewChroniclesArchive,
            chronicle100: adminPreviewChronicle100,
            promo: adminPreviewPromo,
            legal: adminPreviewLegalDoc,
            closeAll: _adminPreviewCloseAll
        },
        // resetAll удалён в v5.3.18 — полный сброс только через ☰ Главное меню.
    };
    devLog('[Admin] window.admin registered');
}

// === УТИЛИТЫ ===

function adminRefreshUI() {
    // v5.3.20 FIX-ROSTER-CACHE: сбрасываем сигнатуры тяжёлых рендеров Штаба,
    // чтобы admin-команды (grant resources, max heroes, max buildings) сразу
    // отобразились в UI. Без сброса renderCards/renderFormationSlots могли
    // скипнуться из-за совпадения сигнатур (например, admin.grant('gold', 1M)
    // не меняет ни один из параметров сигнатуры formation).
    if (typeof _lastRenderCardsSig !== 'undefined') _lastRenderCardsSig = '';
    if (typeof _lastRenderFormationSig !== 'undefined') _lastRenderFormationSig = '';
    if (typeof _lastRenderCodexSig !== 'undefined') _lastRenderCodexSig = '';
    // v5.3.66: сброс sig Тропы — иначе renderTrailUI скипался после admin-команд.
    if (typeof _lastTrailRenderSig !== 'undefined') _lastTrailRenderSig = '';
    if (typeof renderTrailUI === 'function') renderTrailUI();
    if (typeof saveGame === 'function') saveGame(true);
    if (typeof renderCards === 'function') renderCards();
    if (typeof renderFormationSlots === 'function') renderFormationSlots();
    if (typeof renderUI === 'function') renderUI();
    if (typeof renderQuests === 'function') renderQuests();
    if (typeof renderArena === 'function') renderArena();
    if (typeof renderDungeon === 'function') renderDungeon();
    if (typeof renderRaidBossUI === 'function') renderRaidBossUI();
}

function adminToast(msg) {
    if (typeof pushToast === 'function') pushToast(`[ADMIN] ${msg}`);
}

// === КОМАНДЫ ===

function adminGrant(type, amount) {
    if (!isAdminSession) return;
    const n = Math.max(0, Math.floor(amount || 0));
    switch (type) {
        case 'gold':
            gState.gold += n;
            gState.lifetimeGold += n;
            break;
        case 'crystals':
            gState.crystals += n;
            break;
        case 'relics':
            gState.relics += n;
            break;
        case 'tickets':
            gState.tickets += n;
            break;
        default:
            return adminToast('Unknown resource: ' + type);
    }
    adminRefreshUI();
    adminToast(`+${n} ${type}`);
}

function adminUnlockAll() {
    if (!isAdminSession) return;
    if (typeof HEROES_CATALOG === 'undefined') return;
    let count = 0;
    Object.keys(HEROES_CATALOG).forEach(id => {
        if (!gState.deck[id]) {
            gState.deck[id] = { stars: 1, lvl: 1 };
            count++;
        }
    });
    adminRefreshUI();
    adminToast(`Unlocked ${count} heroes (total: ${Object.keys(gState.deck).length})`);
}

function adminMaxHeroes() {
    if (!isAdminSession) return;
    if (typeof HEROES_CATALOG === 'undefined') return;
    let count = 0;
    Object.keys(gState.deck).forEach(id => {
        if (HEROES_CATALOG[id]) {
            gState.deck[id].stars = 10;
            gState.deck[id].lvl = 300;
            // Мастерство: помечаем как пробуждённое, иначе UI блокирует >200
            if (typeof markMasteryAwakened === 'function') {
                markMasteryAwakened(id);
            }
            count++;
        }
    });
    adminRefreshUI();
    adminToast(`MAX: ${count} heroes`);
}

function adminMaxBuildings() {
    if (!isAdminSession) return;
    gState.buildings.keep = 50;
    gState.buildings.mine = 50;
    gState.buildings.barracks = 50;
    gState.highestKeep = Math.max(gState.highestKeep || 1, 50);
    adminRefreshUI();
    adminToast('Buildings MAX (50/50/50)');
}

function adminSkipFtue() {
    if (!isAdminSession) return;
    if (typeof skipFtue === 'function') {
        skipFtue(false);
        adminToast('FTUE skipped');
    }
}

function adminResetFtue() {
    if (!isAdminSession) return;
    if (typeof resetFtue === 'function') {
        resetFtue(false);
        adminToast('FTUE reset');
    }
}

function adminTeleport(floor) {
    if (!isAdminSession) return;
    const f = Math.max(1, Math.floor(floor || 1));
    gState.dungeonFloor = f;
    gState.dungeonStamina = 10;
    adminRefreshUI();
    adminToast(`Teleported to floor ${f}`);
}

function adminSetLeague(leagueId) {
    if (!isAdminSession) return;
    const valid = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    if (!valid.includes(leagueId)) return adminToast('Invalid league: ' + leagueId);
    gState.arenaLeague = leagueId;
    // Подгоняем кубки под лигу
    const trophies = { bronze: 200, silver: 900, gold: 1600, platinum: 2400, diamond: 3200 };
    gState.trophies = trophies[leagueId];
    gState.arenaActiveRivals = null;
    gState.arenaTopTenBots = null;
    adminRefreshUI();
    adminToast(`League: ${leagueId}, trophies: ${trophies[leagueId]}`);
}

function adminAddVip(days) {
    if (!isAdminSession) return;
    const d = Math.max(1, Math.floor(days || 30));
    const ms = d * 24 * 3600 * 1000;
    const base = Math.max(Date.now(), gState.vipUntil || 0);
    gState.vipUntil = base + ms;
    adminRefreshUI();
    adminToast(`+${d} days VIP`);
}

function adminResetSeason() {
    if (!isAdminSession) return;
    gState.arenaSeasonWeekId = '';
    gState.arenaSeasonNumber = 1;
    gState.pendingSeasonCeremony = null;
    gState.arenaActiveRivals = null;
    gState.arenaTopTenBots = null;
    gState.ladderSwaps = {};
    adminRefreshUI();
    adminToast('Season reset — reload page to trigger ceremony');
}

function adminShowState() {
    if (!isAdminSession) return;
    console.log('[ADMIN] gState:', JSON.parse(JSON.stringify(gState)));
    adminToast('State printed to console');
}

// v5.3.18: adminResetAll удалена. Раньше была вторая точка сброса прогресса
// (мастер-панель + Главное меню), обе правили облако параллельно — при случайном
// одновременном использовании создавали race. Единственный источник сброса
// теперь executeHardReset из Главного меню (инженерно надёжнее, ждёт облако 6 сек).

// === UI ===

function openAdminPanel() {
    if (!isAdminSession) return;
    const m = document.getElementById('admin-panel-modal');
    if (m) m.style.display = 'flex';
}

function closeAdminPanel() {
    const m = document.getElementById('admin-panel-modal');
    if (m) m.style.display = 'none';
}

// Телепорт: ввод этажа через prompt (быстро, не плодим поля ввода)
function adminTeleportPrompt() {
    if (!isAdminSession) return;
    const v = window.prompt('Floor (1-500):', String(gState.dungeonFloor || 1));
    if (v === null) return;
    adminTeleport(parseInt(v, 10));
}

// Выбор лиги через подмодалку с картинками (заменяет prompt из v1.0)
function openAdminLeaguePicker() {
    if (!isAdminSession) return;
    const m = document.getElementById('admin-league-modal');
    if (m) m.style.display = 'flex';
}

function closeAdminLeaguePicker() {
    const m = document.getElementById('admin-league-modal');
    if (m) m.style.display = 'none';
}

function pickAdminLeague(leagueId) {
    if (!isAdminSession) return;
    adminSetLeague(leagueId);
    closeAdminLeaguePicker();
}

// Автозапуск при загрузке страницы: если в URL есть ?admin=1,
// проверяем доступ (user_id через bridge может прийти позже — см. patч A1).
(function initAdminOnLoad() {
    if (typeof window === 'undefined') return;
    // FIX-ADMIN-VK: этот IIFE выполняется ДО engine.js, где объявлена
    // isRunningInsideVK(). Используем безопасную эвристику — к моменту
    // срабатывания setTimeout (500ms/2000ms) engine.js уже загружен,
    // и ensureAdminAccess() проверит точные условия сам.
    const urlHasAdmin = window.location.search.includes('admin=1');
    const likelyInVk = (window.parent !== window)
        || window.location.search.includes('vk_app_id')
        || window.location.search.includes('vk_user_id');

    if (!urlHasAdmin && !likelyInVk) return;
    // Первая попытка — вдруг user_id уже в URL (standalone)
    setTimeout(() => {
        if (typeof ensureAdminAccess === 'function') ensureAdminAccess();
    }, 500);
    // Вторая попытка — через 2 секунды, если bridge ответил позже
    setTimeout(() => {
        if (typeof ensureAdminAccess === 'function') ensureAdminAccess();
    }, 2000);
})();

// ===== ПРЕВЬЮ ЭКРАНОВ (v1.1) =====
// Read-only показ редких модалок. Все inline onclick внутри перехватываются,
// критичное состояние gState откатывается после закрытия.

function _adminPreviewIntercept(modalId, restoreFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return adminToast('Modal not found: ' + modalId);
    const btns = modal.querySelectorAll('button[onclick]');
    btns.forEach(btn => {
        if (btn.classList.contains('admin-preview-close-btn')) return;
        const oc = btn.getAttribute('onclick');
        if (!oc) return;
        btn._adminOldOnclick = oc;
        btn.setAttribute('onclick', '');
        btn._adminHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            _adminPreviewClose(modalId, restoreFn);
        };
        btn.addEventListener('click', btn._adminHandler);
    });
    if (!modal.querySelector('.admin-preview-close-btn')) {
        const cb = document.createElement('button');
        cb.className = 'admin-preview-close-btn';
        cb.textContent = '✖ ЗАКРЫТЬ ПРЕВЬЮ';
        cb.style.cssText = 'position:absolute;top:6px;left:50%;transform:translateX(-50%);z-index:2147483000;background:linear-gradient(180deg,#dc2626,#7f1d1d);color:#fff;border:2px solid #fca5a5;border-radius:8px;padding:8px 16px;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.95);letter-spacing:0.5px;font-family:Inter,sans-serif;';
        cb.onclick = (e) => {
            e.stopPropagation();
            _adminPreviewClose(modalId, restoreFn);
        };
        modal.appendChild(cb);
    }
    modal.style.setProperty('display', 'flex', 'important');
}

function _adminPreviewClose(modalId, restoreFn) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.querySelectorAll('button').forEach(btn => {
            if (btn._adminOldOnclick) {
                btn.removeEventListener('click', btn._adminHandler);
                btn.setAttribute('onclick', btn._adminOldOnclick);
                delete btn._adminOldOnclick;
                delete btn._adminHandler;
            }
            if (btn.classList.contains('admin-preview-close-btn')) btn.remove();
        });
    }
    if (typeof restoreFn === 'function') {
        try { restoreFn(); } catch (e) { console.error('[Admin] Preview restore error:', e); }
    }
}

function _adminPreviewCloseAll() {
    const ids = ['season-verdict-modal','leviathan-triumph-overlay','ascension-ritual-overlay','epic-quote-overlay','first-purchase-modal','mastery-awakening-modal','offline-modal','arena-inbox-modal','trail-daily-modal','trail-meta-modal','trail-help-modal','battle-hub-modal','chronicles-archive-modal','chronicle-modal','card-inspect-modal','player-inspect-modal','legal-doc-modal','promo-modal'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });
}

// --- ТРИУМФЫ ---

function adminPreviewSeasonCeremony() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof previewSeasonCeremony !== 'function') return adminToast('previewSeasonCeremony unavailable');
    try { previewSeasonCeremony(); } catch (e) { console.error(e); return adminToast('Error'); }
    const saved = gState.pendingSeasonCeremony;
    gState.pendingSeasonCeremony = null;
    _adminPreviewIntercept('season-verdict-modal', () => {
        gState.pendingSeasonCeremony = saved;
    });
}

function adminPreviewLeviathanTriumph() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openLeviathanTriumphOverlay !== 'function') return adminToast('Not available');
    const savedRelic = gState.lastRaidRelicGot;
    gState.lastRaidRelicGot = true;
    try { openLeviathanTriumphOverlay(); } catch (e) { console.error(e); gState.lastRaidRelicGot = savedRelic; return adminToast('Error'); }
    _adminPreviewIntercept('leviathan-triumph-overlay', () => {
        gState.lastRaidRelicGot = savedRelic;
        try { isLeviathanTriumphInProgress = false; } catch (_e) {}
        const vortex = document.getElementById('leviathan-triumph-vortex');
        const flash = document.getElementById('leviathan-triumph-flash');
        const card = document.getElementById('leviathan-triumph-card');
        if (vortex) vortex.classList.remove('active');
        if (flash) flash.classList.remove('active');
        if (card) card.classList.remove('revealed');
    });
}

function adminPreviewAscensionRitual() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof executeGrandAscensionRitual !== 'function') return adminToast('Not available');
    const snap = {
        relics: gState.relics, relicsFromAscend: gState.relicsFromAscend,
        gold: gState.gold, army: gState.army,
        buildings: JSON.parse(JSON.stringify(gState.buildings || {})),
        ftueAscendDone: gState.ftueAscendDone
    };
    try { executeGrandAscensionRitual(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('ascension-ritual-overlay', () => {
        gState.relics = snap.relics;
        gState.relicsFromAscend = snap.relicsFromAscend;
        gState.gold = snap.gold;
        gState.army = snap.army;
        gState.buildings = snap.buildings;
        gState.ftueAscendDone = snap.ftueAscendDone;
        try { isAscendingInProgress = false; } catch (_e) {}
        try { window.isAscendingInProgress = false; } catch (_e) {}
        const vortex = document.getElementById('ritual-vortex-bg');
        const flash = document.getElementById('ritual-supernova-flash');
        const card = document.getElementById('ritual-content-card');
        if (vortex) vortex.classList.remove('active');
        if (flash) flash.classList.remove('active');
        if (card) card.classList.remove('revealed');
    });
}

function adminPreviewEpicQuoteSSS() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof showEpicQuote !== 'function') return adminToast('Not available');
    const hero = (typeof HEROES_CATALOG !== 'undefined' && HEROES_CATALOG['sss_und_v'])
        ? HEROES_CATALOG['sss_und_v']
        : (typeof HEROES_CATALOG !== 'undefined' ? Object.values(HEROES_CATALOG)[0] : null);
    if (!hero) return adminToast('No hero');
    try { showEpicQuote(hero); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('epic-quote-overlay', () => {
        try { window.epicSpotlightQueue = []; } catch (_e) {}
        const o = document.getElementById('epic-quote-overlay');
        if (o) o.style.opacity = '0';
    });
}

// --- ОСОБЫЕ УСЛОВИЯ ---

function adminPreviewFirstPurchase() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openFirstPurchaseModal !== 'function') return adminToast('Not available');
    try { openFirstPurchaseModal(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('first-purchase-modal', null);
}

function adminPreviewMasteryAwakening() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openMasteryModal !== 'function') return adminToast('Not available');
    const deckIds = Object.keys(gState.deck || {});
    if (deckIds.length === 0) return adminToast('No heroes in deck');
    const hid = deckIds[deckIds.length - 1];
    const savedAwakened = gState.masteryAwakened && gState.masteryAwakened[hid];
    if (gState.masteryAwakened) delete gState.masteryAwakened[hid];
    try { openMasteryModal(hid); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('mastery-awakening-modal', () => {
        if (savedAwakened && gState.masteryAwakened) gState.masteryAwakened[hid] = savedAwakened;
        try { pendingMasteryHeroId = null; } catch (_e) {}
    });
}

function adminPreviewOfflineIncome() {
    if (!isAdminSession) return;
    closeAdminPanel();
    const saved = (typeof pendingOfflineGold !== 'undefined') ? pendingOfflineGold : 0;
    try { pendingOfflineGold = 50000; } catch (_e) {}
    const goldEl = document.getElementById('offline-m-gold');
    if (goldEl) goldEl.innerHTML = '+50 000 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const modal = document.getElementById('offline-modal');
    if (!modal) return adminToast('Offline modal not found');
    _adminPreviewIntercept('offline-modal', () => {
        try { pendingOfflineGold = saved; } catch (_e) {}
        try { isClaimingOffline = false; } catch (_e) {}
    });
}

function adminPreviewArenaInbox() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof renderArenaInbox !== 'function') return adminToast('Not available');
    const savedRevenge = window.revengeFromInbox;
    const savedPending = gState.pendingInboxAttacks;
    if (typeof savedRevenge === 'function') {
        window.revengeFromInbox = () => adminToast('Revenge disabled in preview');
    }
    const now = Math.floor(Date.now() / 1000);
    gState.pendingInboxAttacks = [
        { attackerUid: 'demo_1', attackerName: 'DemoAttacker1', result: 'win', trophyChange: -15, ts: now - 3600 },
        { attackerUid: 'demo_2', attackerName: 'DemoAttacker2', result: 'loss', trophyChange: 12, ts: now - 7200 },
        { attackerUid: 'demo_3', attackerName: 'DemoAttacker3', result: 'win', trophyChange: -18, ts: now - 10800 }
    ];
    try { renderArenaInbox(); } catch (e) {
        console.error(e);
        if (typeof savedRevenge === 'function') window.revengeFromInbox = savedRevenge;
        gState.pendingInboxAttacks = savedPending;
        return adminToast('Error');
    }
    _adminPreviewIntercept('arena-inbox-modal', () => {
        gState.pendingInboxAttacks = savedPending;
        if (typeof savedRevenge === 'function') window.revengeFromInbox = savedRevenge;
    });
}

// --- ТРОПА БЕЗДНЫ ---

function adminPreviewTrailDaily() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openTrailDailyModal !== 'function') return adminToast('Not available');
    try { openTrailDailyModal(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('trail-daily-modal', null);
}

function adminPreviewTrailMeta() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openTrailMetaModal !== 'function') return adminToast('Not available');
    try { openTrailMetaModal(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('trail-meta-modal', null);
}

function adminPreviewTrailHelp() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openTrailHelp !== 'function') return adminToast('Not available');
    try { openTrailHelp(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('trail-help-modal', null);
}

// --- ИНСПЕКТОРЫ ---

function adminPreviewHeroSSS() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openCardInspect !== 'function') return adminToast('Not available');
    const hid = (typeof HEROES_CATALOG !== 'undefined' && HEROES_CATALOG['sss_und_v']) ? 'sss_und_v' : (typeof HEROES_CATALOG !== 'undefined' ? Object.keys(HEROES_CATALOG)[0] : null);
    if (!hid) return adminToast('No hero catalog');
    try { openCardInspect(hid); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('card-inspect-modal', () => {
        try { activeInspectHeroId = null; } catch (_e) {}
    });
}

function adminPreviewPlayerInspect() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof inspectPlayer !== 'function') return adminToast('Not available');
    const demoSquad = ['sss_und_v','sss_dem_v','sss_lig_r'].filter(id => HEROES_CATALOG && HEROES_CATALOG[id]);
    if (demoSquad.length < 3) {
        const allIds = Object.keys(HEROES_CATALOG || {});
        for (let i = 0; demoSquad.length < 3 && i < allIds.length; i++) {
            if (!demoSquad.includes(allIds[i])) demoSquad.push(allIds[i]);
        }
    }
    try { inspectPlayer('Demonstration Lord', 123456, demoSquad); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('player-inspect-modal', null);
}

// --- ПРОЧЕЕ ---

function adminPreviewBattleHub() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openBattleHubModal !== 'function') return adminToast('Not available');
    try { openBattleHubModal(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('battle-hub-modal', null);
}

function adminPreviewChroniclesArchive() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openChroniclesArchiveModal !== 'function') return adminToast('Not available');
    try { openChroniclesArchiveModal(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('chronicles-archive-modal', null);
}

function adminPreviewChronicle100() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openChronicleModal !== 'function') return adminToast('Not available');
    try { openChronicleModal(100, true); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('chronicle-modal', null);
}

function adminPreviewPromo() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openPromoModal !== 'function') return adminToast('Not available');
    try { openPromoModal(); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('promo-modal', null);
}

function adminPreviewLegalDoc() {
    if (!isAdminSession) return;
    closeAdminPanel();
    if (typeof openLegalDocument !== 'function') return adminToast('Not available');
    try { openLegalDocument('terms'); } catch (e) { console.error(e); return adminToast('Error'); }
    _adminPreviewIntercept('legal-doc-modal', null);
}

// ===== ГЕНЕРАТОР ПЕРСОНАЛЬНЫХ ПРОМОКОДОВ (v1.2) =====
// Полный flow:
//   1. Открыть модалку → ввести VK ID + награды + срок.
//   2. Сгенерировать → runtime PROMO_CODES[code] = {...} (можно тестировать сразу же).
//   3. Скопировать готовый JS → вставить в data-promo.js → задеплоить.
//   4. Игрок введёт код → получит награды → код сгорит (одноразовый).
// localStorage['lota_generated_promos'] хранит историю для повторного копирования.

const _ADMIN_PROMO_HISTORY_KEY = 'lota_generated_promos';

function _adminPromoHistoryLoad() {
    try {
        const raw = localStorage.getItem(_ADMIN_PROMO_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function _adminPromoHistorySave(list) {
    try { localStorage.setItem(_ADMIN_PROMO_HISTORY_KEY, JSON.stringify(list.slice(-50))); } catch (e) {}
}

function openAdminPromoGenerator() {
    if (!isAdminSession) return;
    const m = document.getElementById('admin-promo-generator-modal');
    if (!m) return adminToast('Модалка генератора не найдена');
    const resultBox = document.getElementById('admin-promo-result');
    if (resultBox) resultBox.style.display = 'none';
    const fld = document.getElementById('promo-gen-vk-id');
    if (fld) fld.value = '';
    const defaults = { 'promo-gen-gold': '', 'promo-gen-crystals': '', 'promo-gen-relics': '', 'promo-gen-tickets': '', 'promo-gen-vip': '' };
    Object.keys(defaults).forEach(id => { const el = document.getElementById(id); if (el) el.value = defaults[id]; });
    const exp = document.getElementById('promo-gen-expires');
    if (exp) exp.value = '0';
    m.style.display = 'flex';
}

function closeAdminPromoGenerator() {
    const m = document.getElementById('admin-promo-generator-modal');
    if (m) m.style.display = 'none';
}

function _adminPromoGenCode(vkId) {
    const rand = Math.random().toString(36).toUpperCase().slice(2, 8);
    const uidSuffix = String(vkId).slice(-4);
    return `PERS_${rand}_${uidSuffix}`;
}

function adminPromoGenerate() {
    if (!isAdminSession) return;
    const vkIdEl = document.getElementById('promo-gen-vk-id');
    const vkId = vkIdEl ? String(vkIdEl.value || '').trim() : '';
    if (!vkId || !/^\d{4,20}$/.test(vkId)) {
        return adminToast('Укажи корректный VK ID (цифры)');
    }
    const num = (id) => {
        const el = document.getElementById(id);
        const v = el ? parseInt(el.value, 10) : 0;
        return (Number.isFinite(v) && v > 0) ? v : 0;
    };
    const gold = num('promo-gen-gold');
    const crystals = num('promo-gen-crystals');
    const relics = num('promo-gen-relics');
    const tickets = num('promo-gen-tickets');
    const vipDays = num('promo-gen-vip');
    if (gold + crystals + relics + tickets + vipDays === 0) {
        return adminToast('Заполни хотя бы одну награду');
    }
    const expDays = num('promo-gen-expires');
    const expiresAt = expDays > 0 ? Date.now() + expDays * 24 * 3600 * 1000 : null;

    let code = _adminPromoGenCode(vkId);
    let attempts = 0;
    while ((typeof PROMO_CODES !== 'undefined' && PROMO_CODES[code]) && attempts < 20) {
        code = _adminPromoGenCode(vkId);
        attempts++;
    }

    const promoObj = {
        ownerVkId: vkId,
        title: { RU: 'Персональный дар', EN: 'Personal Gift' }
    };
    if (gold) promoObj.gold = gold;
    if (crystals) promoObj.crystals = crystals;
    if (relics) promoObj.relics = relics;
    if (tickets) promoObj.tickets = tickets;
    if (vipDays) promoObj.vipDays = vipDays;
    if (expiresAt) promoObj.expiresAt = expiresAt;

    // Runtime-инъекция: можно сразу протестировать без деплоя
    if (typeof PROMO_CODES !== 'undefined') PROMO_CODES[code] = promoObj;

    // Готовый JS-фрагмент для вставки в data-promo.js
    const jsFragment = `    // Персональный код (VK ID: ${vkId})${expiresAt ? ' • истекает ' + new Date(expiresAt).toLocaleString() : ''}
    '${code}': ${JSON.stringify(promoObj, null, 4).replace(/^/gm, '    ').trim()},`;

    const resultBox = document.getElementById('admin-promo-result');
    const resultText = document.getElementById('admin-promo-result-text');
    if (resultText) resultText.value = jsFragment;
    if (resultBox) resultBox.style.display = 'block';

    // История
    const hist = _adminPromoHistoryLoad();
    hist.push({ code, vkId, promo: promoObj, createdAt: Date.now() });
    _adminPromoHistorySave(hist);

    adminToast(`Код ${code} сгенерирован (runtime active)`);
}

function adminPromoCopy() {
    if (!isAdminSession) return;
    const ta = document.getElementById('admin-promo-result-text');
    if (!ta || !ta.value) return adminToast('Нечего копировать');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(() => adminToast('Скопировано')).catch(() => {
            try { ta.select(); document.execCommand('copy'); adminToast('Скопировано (fallback)'); } catch (e) { adminToast('Ошибка копирования'); }
        });
    } else {
        try { ta.select(); document.execCommand('copy'); adminToast('Скопировано (fallback)'); } catch (e) { adminToast('Ошибка копирования'); }
    }
}

function adminPromoList() {
    if (!isAdminSession) return;
    const hist = _adminPromoHistoryLoad();
    if (hist.length === 0) return adminToast('История пуста');
    console.log('[ADMIN] Generated promos:', hist);
    adminToast(`История: ${hist.length} кодов (console)`);
}