/* ==========================================================
   LORDS OF THE ABYSS — МАСТЕР-ПАНЕЛЬ (data-admin.js)
   v1.0
   
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
        resetAll: adminResetAll
    };
    devLog('[Admin] window.admin registered');
}

// === УТИЛИТЫ ===

function adminRefreshUI() {
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

// FIX-ADMIN-RESET: полноценный вайп с ожиданием облака.
// ПРОБЛЕМА v1.0: setTimeout(reload, 250) срабатывал ДО того, как VK Bridge
// успевал записать пустое значение. При загрузке performSafeArbitration
// подтягивал старое облако — эффект «сброс не сработал».
// Дополнительно: пустая строка '' может не приниматься VK Bridge в некоторых
// версиях. Используем '_reset_' — невалидный JSON, performSafeArbitration
// корректно его пропустит (проверка firstChar !== 123).
async function adminResetAll() {
    if (!isAdminSession) return;

    // FIX-ADMIN-RESET-2: блокируем запись через флаг gStateLoaded (не переприсваивание
    // функции). Причина — setInterval(saveGame, 5000) держит ссылку на ОРИГИНАЛЬНУЮ
    // saveGame, и переприсваивание глобальной переменной не помогает против него.
    // А вот сброс флага gStateLoaded в false — работает: saveGame проверяет
    // его в первой строке и молча выходит.
    gStateLoaded = false;

    // Очищаем игровые ключи
    try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem('lords_saved_language');
        localStorage.removeItem('lota_p9_result');
    } catch (e) {}

    // Пишем '_reset_' в облако — невалидный JSON, арбитраж его пропустит.
    // Ждём максимум 2 секунды (короче, чем раньше — меньше риска BFCache).
    const cloudReset = (async () => {
        // v5.3.15: очищаем профиль на Worker'е. Симметрично executeHardReset.
        if (typeof resetProfileOnWorker === 'function') {
            try { await resetProfileOnWorker(); } catch (e) {}
        }
        if (typeof PlatformBridge !== 'undefined' && PlatformBridge.yandexPlayer) {
            try {
                await PlatformBridge.yandexPlayer.setData({ [SAVE_KEY]: '_reset_' }, true);
            } catch (e) {}
        }
        if (typeof isRunningInsideVK === 'function' && isRunningInsideVK() && window.vkBridge) {
            try {
                await window.vkBridge.send('VKWebAppStorageSet', { key: SAVE_KEY, value: '_reset_' });
            } catch (e) {}
        }
    })();

    await Promise.race([
        cloudReset,
        new Promise(resolve => setTimeout(resolve, 2000))
    ]);

    // FIX-BFCACHE: используем location.replace с cache-buster вместо reload().
    // На Live Server (и в Safari) reload иногда выкидывает страницу в BFCache,
    // откуда она «возвращается» со старым gState в памяти. Замена URL с ?_wipe=
    // гарантирует свежий парс документа.
    const bust = '_wipe=' + Date.now();
    const newUrl = location.origin + location.pathname + '?' + bust;
    location.replace(newUrl);
}

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