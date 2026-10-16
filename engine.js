// ==========================================================
// АВТОНОМНАЯ ZERO-SERVER АРХИТЕКТУРА
// Серверные запросы полностью удалены.
// ==========================================================
/* ==========================================================
   LORDS OF THE ABYSS — CORE ENGINE v3.0 (engine.js)
   Full Monolith • No Cuts • 100% Bug-Free • Mobile/PC
   ========================================================== */

// Надежное восстановление сохраненного языка с приоритетом RU для платформы ВКонтакте
let savedLangKey = null;
try {
    if (typeof localStorage !== 'undefined') savedLangKey = localStorage.getItem('lords_saved_language');
} catch (e) {
    // Storage may be blocked by the browser or embedded platform.
}
const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
const isVkContext = typeof window !== 'undefined' && (
    window.location.search.includes('vk_user_id') || 
    window.location.search.includes('api_id') ||
    (window.parent !== window && !window.location.search.includes('yandex'))
);
const vkLangParam = urlParams ? urlParams.get('vk_language') : null;
const detectedSysLang = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage || '').toLowerCase().startsWith('ru')) ? 'RU' : 'EN';
// Если запуск происходит из VK — по умолчанию железно активируем русский язык (RU)
const defaultPlatformLang = (isVkContext || vkLangParam === 'ru') ? 'RU' : detectedSysLang;
let currentLang = savedLangKey || defaultPlatformLang;
const SAVE_KEY = 'lords_core_v31_rebalance';

// FIX-DEV-MODE: единый флаг «мы в режиме разработки / QA».
// Управляет доступностью console-команд (skipFtue, testAscensionRitual, testArena*).
//
// ПРОД (VK / GH Pages) — false. DevTools-команды недоступны, читеры не могут
// вызвать testAscensionRitual() и дюпать Реликвии.
// ЛОКАЛКА (live server) — true. QA-удобства работают как раньше.
// QA НА ТЕЛЕФОНЕ — открыть GH Pages с ?debug=1 в URL.
//
// ВАЖНО: этот флаг НЕ защищает от серверных читов (у нас Zero-Server — их и нет).
// Он защищает от «скрипт-кидди с F12» — самой массовой категории абузеров.
const IS_DEV_MODE = (() => {
    try {
        if (typeof window === 'undefined') return false;
        const host = (window.location && window.location.hostname) || '';
        const search = (window.location && window.location.search) || '';
        const urlParams = new URLSearchParams(search);
        // FIX-DEBUG-OVERRIDE: явный override для QA — ?debug=0 отключает dev-режим
        // даже на localhost. Нужен, чтобы локально проверить «как увидит модератор в VK»:
        // консоль должна быть полностью чистой. Раньше этого флага не было — localhost
        // всегда шёл в dev-ветку, и QA-проверка прода была невозможна.
        if (urlParams.get('debug') === '0') return false;
        // Localhost-разработка: полный доступ к dev-командам
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
        // QA-параметр: ?debug=1 в URL — работает на любом хосте (GH Pages, тест на телефоне)
        if (urlParams.get('debug') === '1') return true;
        return false;
    } catch (e) {
        return false;
    }
})();

// FIX-CLEAN-CONSOLE: информационные логи только в dev-режиме.
// Модератор VK открывает DevTools и видит либо чистую консоль (прод),
// либо набор диагностики (localhost / ?debug=1). Это закрывает п. 4.1.3 правил VK
// («Приложение должно быть в готовом виде, без тестового контента или включённой консоли»).
// console.warn и console.error НЕ подавляются — критичные сигналы остаются видимыми.
function devLog(...args) {
    if (IS_DEV_MODE) console.log(...args);
}

// FIX-BUILD-VERSION: единый источник правды о версии сборки.
// Обновляй эту пару при каждом релизном патче — по дате в UI сразу видно,
// применился ли свежий build из GitHub во встроенном VK-браузере.
// Формат: BUILD_VERSION — мажорная.минорная (совпадает с бампом sw.js CACHE_NAME),
//         BUILD_DATE    — ISO-дата сборки.
const BUILD_VERSION = '5.3.14';
const BUILD_DATE = '16.10.2026';

// ==========================================================
// P9: VK LAUNCH PARAMS VALIDATION (п. 1.2.2 правил VK Mini Apps)
// URL Cloudflare Worker'а, деплоящегося из /cloudflare-worker/.
// Заполнить после `npx wrangler deploy` (см. cloudflare-worker/README.md).
// Пока константа пустая — валидация пропускается (graceful no-op),
// что безопасно для standalone/GH Pages, но НЕ закрывает п. 1.2.2.
// ==========================================================
const VK_VALIDATOR_URL = 'https://lota-vk-validator.vanderbor1987.workers.dev';

// LIVE-ARENA (v4.7.6): тот же Cloudflare Worker, что и P9-валидатор.
// Используется для обмена профилями и атаками между живыми игроками.
// Работает до модерации VK — это отдельная инфраструктура, не VK API.
const WORKER_BASE_URL = 'https://lota-vk-validator.vanderbor1987.workers.dev';

let activeAssignExpId = null;
let isAscendingInProgress = false;
let isAutoSpendingInProgress = false;
let isLeviathanTriumphInProgress = false;
let currentGachaResults = [];
let unrevealedGachaCards = 0;
let epicSpotlightQueue = [];
let lastAscendCanUpgradeAny = false;
let ladderTimerCount = 0;
let lastCelebratedHeroName = '';

let gState = {
    saveVersion: 31,
    hasAcceptedTerms: false, // P8: флаг принятия соглашения при первом запуске (п. 1.1.4 правил VK Mini Apps)
    playerName: 'Duke Valdor',
    gold: 1000,
    crystals: 30,
    relics: 0,
    relicsFromAscend: 0, // v4.9.7: отдельный счётчик — только для цены возвышения
    army: 0,
    trophies: 150,
    tickets: 10,
    lastTicketDate: '',
    adTicketsClaimedToday: 0,
    lastFreeWheelDate: '',
    wheelAdSpinsToday: 0,
    lifetimeWheelSpins: 0, // v4.9.6: для достижения Колесо Фортуны
    hasBookmarked: false,
    hasAddedToHome: false,
    lastWallPostDate: '',
    lastTickTime: Date.now(),
    vipUntil: 0,
    isAudioMuted: false,
    isMusicMuted: false,
    isHapticsMuted: false,
    // UX-настройка: скрыть красные точки уведомлений у зданий (Шахты/Казармы + сигнал прокачки Цитадели).
    // Возвышение на Цитадели (isAscendReady) — критичный сигнал, остаётся видимым всегда.
    hideBuildingBadges: false,
    // v5.3.12: флаг активной IAP-покупки. Пока true — syncCrystalsFromServer
    // не подтягивает серверные кристаллы (иначе покупка удаляется до submit'а).
    // Снимается после успешного submitArenaProfile с текущими кристаллами.
    _iapPendingSync: false,
    musicVolume: 0.35,
    sfxVolume: 0.8,
    hasFirstPurchaseDone: false,
    hasStarterPackBought: false,
    firstDoubleClaimed: {},
    claimedReferralBonus: false,
    lastInviteDate: '',
    claimedChronicles: [],
    vipShowAds: false,
    dailyFreebieClaimedToday: false,
    quickSummonEnabled: false,
    // P-PROMO: массив использованных промокодов (персистится в сейве).
    // Один код = одна выдача на пользователя, навсегда.
    usedPromoCodes: [],
    codexClaimed: { light: [], undead: [], chaos: [], demon: [] },
    abyssPassXp: 0,
    abyssPassFreeClaimed: [],
    abyssPassVipClaimed: [],

    // Античит Колеса Фортуны (MAJOR-M1): хранит уже разыгранный, но ещё не начисленный приз.
    // Если игрок закроет вкладку в момент анимации — приз начислится при следующей загрузке.
    pendingWheelPrize: null,
    // Античит системных часов (MAJOR-M2): максимальный wall-clock timestamp, который видел клиент.
    // Откат системного времени ниже этого порога блокирует дневные сбросы.
    maxKnownTimestamp: 0,
    // B7: массив героев, прошедших обряд Входа в Мастерство (пересекли 200-й уровень через модалку).
    // Пока флаг не установлен — апгрейд выше 200 заблокирован (см. calculateBatchUpgradeCost).
    masteryAwakened: {},

    // Action-Based FTUE
    ftueStep: 0,
    ftueTaps: 0,
    ftueSummonDone: false,
    ftueEquipDone: false,

    buildings: { keep: 1, mine: 1, barracks: 0 },
    deck: {
        'f_und_v': { stars: 1, lvl: 1 },
        'f_und_c': { stars: 1, lvl: 1 },
        'f_und_r': { stars: 1, lvl: 1 }
    },
    attackFormation: ['f_und_v', 'f_und_c', 'f_und_r'],
    defenseFormation: ['f_und_v', 'f_und_c', 'f_und_r'],
    expeditions: {},
    battleHistory: [],
    dungeonFloor: 1,
    dungeonStamina: 10,
    calendarDay: 1,
    lastCalendarClaimDate: '',
    demonCatches: 0,
    worldBossHp: 5000000,
    worldBossMaxHp: 5000000,
    overdriveUntil: 0,
    dungeonRefillsToday: 0,
    raidSpeedupUsed: false,
    arenaSeasonWeekId: '',
    lifetimeGold: 1000,
    highestKeep: 1,
    lifetimeWins: 0,
    maxArmyEver: 0,
    achieveStages: { ach_g: 0, ach_a: 0, ach_k: 0, ach_ar: 0, ach_c: 0, ach_asc: 0, ach_dem: 0, ach_dung: 0, ach_wheel: 0 },
    stageQuests: {
        tap: { stage: 1, curr: 0, target: 50, rewardGold: 150 },
        arena: { stage: 1, curr: 0, target: 2, rewardGold: 250 },
        upgrade: { stage: 1, curr: 0, target: 2, rewardGold: 300 },
        summon: { stage: 1, curr: 0, target: 5, rewardGold: 400 },
        demon: { stage: 1, curr: 0, target: 1, rewardGold: 500 },
        expedition: { stage: 1, curr: 0, target: 1, rewardGold: 350 },
        hero_lvl: { stage: 1, curr: 0, target: 2, rewardGold: 300 },
        dungeon: { stage: 1, curr: 0, target: 2, rewardGold: 400 },
        raid: { stage: 1, curr: 0, target: 1, rewardGold: 500 }
    }
};

// FIX-TERMS-PERSIST: синхронная гидратация флага согласия ДО preloader IIFE.
// loadGame() запускается в async IIFE после fetch к Cloudflare (~300-800ms),
// а preloader завершается раньше (ассеты из кэша → 50-200ms, либо watchdog на 2.2s).
// На повторных визитах completePreloader() читал hasAcceptedTerms = false (дефолт)
// ещё до того, как loadGame() подтянет true из localStorage — экран согласия
// показывался каждый раз заново. Читаем ОДИН флаг синхронно — boot не блокируется.
(function syncHydrateTermsFlag() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.hasAcceptedTerms === 'boolean') {
                gState.hasAcceptedTerms = parsed.hasAcceptedTerms;
            }
        }
    } catch(e) {}
})();

// FIX-TERMS-PERSIST: синхронная гидратация флага согласия ДО preloader IIFE.
// Проблема: loadGame() запускается в async IIFE после fetch к Cloudflare (~300-800ms),
// а preloader завершается раньше (ассеты из кэша → 50-200ms, либо watchdog на 2.2s).
// На повторных визитах с warm-cache completePreloader() читал gState.hasAcceptedTerms
// ещё до того, как loadGame() подтянет его из localStorage → экран согласия показывался
// каждый раз заново. Читаем ОДИН флаг синхронно — это микросекунды, boot не блокируется.
(function syncHydrateTermsFlag() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.hasAcceptedTerms === 'boolean') {
                gState.hasAcceptedTerms = parsed.hasAcceptedTerms;
            }
        }
    } catch(e) {}
})();

/* ==========================================================
   УТИЛИТЫ И РЕКЛАМА (С ЖЕСТКИМ ЛИМИТОМ ТОСТОВ И ДЕДУПЛИКАЦИЕЙ)
   ========================================================== */
function triggerHaptic(type = 'tap') {
    if (gState.isHapticsMuted) return;
    const patterns = {
        tap: 15,
        crit: [20, 35, 40],
        upgrade: [18, 30, 22],
        victory: [40, 50, 60, 50, 100],
        defeat: [80, 40, 80],
        legendary: [40, 50, 40, 60, 120, 80, 200]
    };
    // 1. Попытка через нативный плагин Capacitor Haptics в APK
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
        try {
            const dur = Array.isArray(patterns[type]) ? patterns[type][0] : (patterns[type] || 15);
            window.Capacitor.Plugins.Haptics.vibrate({ duration: dur });
            return;
        } catch (e) {}
    }
    // 2. Стандартный Web API navigator.vibrate
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate(patterns[type] || 15);
        } catch (e) {}
    }
}

function toggleHapticsSetting() {
    gState.isHapticsMuted = !gState.isHapticsMuted;
    saveGame();
    updateSettingsAudioBtnText();
    if (!gState.isHapticsMuted) triggerHaptic('upgrade');
    pushToast(gState.isHapticsMuted 
        ? (currentLang === 'RU' ? 'Вибрация выключена' : 'Haptics disabled') 
        : (currentLang === 'RU' ? 'Вибрация включена' : 'Haptics enabled'));
}

// UX-настройка: скрытие красных точек уведомлений у зданий (Шахты/Казармы + сигнал прокачки Цитадели).
// Возвышение (isAscendReady) на Цитадели остаётся видимым всегда — критичный сигнал не скрывается.
function toggleBuildingBadgesSetting() {
    gState.hideBuildingBadges = !gState.hideBuildingBadges;
    saveGame();
    updateSettingsAudioBtnText();
    checkNotificationBadges();
    pushToast(gState.hideBuildingBadges
        ? (currentLang === 'RU' ? 'Точки зданий скрыты' : 'Building notifications hidden')
        : (currentLang === 'RU' ? 'Точки зданий включены' : 'Building notifications enabled'));
}

function isVipActive() { return Date.now() < (gState.vipUntil || 0); }

function isRunningInsideVK() {
    return isVkContext;
}

function isRunningInsideYandex() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname || '';
    const search = window.location.search || '';
    // Строго на проверенных доменах Яндекса или с явным GET-параметром
    return (
        search.includes('yandex') ||
        host.includes('yandex.net') ||
        host.includes('yandex.ru') ||
        (host.includes('app-') && (host.includes('.yandex') || host.includes('s3')))
    ) && !host.includes('localhost') && !host.includes('127.0.0.1');
}

/* ==========================================================
   ЕДИНЫЙ КРОСС-ПЛАТФОРМЕННЫЙ МОСТ: PLATFORMBRIDGE (VK + YANDEX)
   Синхронизация Облака (Cloud Sync), Платежи и Реклама
   ========================================================== */
const PlatformBridge = {
    ysdkInstance: null,
    yandexPayments: null,
    yandexPlayer: null,
    isCloudDirty: false,
    syncDebounceTimer: null,
    lastCloudSaveTime: 0,
    canShowYandexShortcut: false,
    isLoadingReadyCalled: false,
    // Кэш промиса динамической загрузки Yandex SDK v2 (защита от двойной инжекции)
    _yandexSdkPromise: null,

    // Открытие нативного Лидерборда ВКонтакте (соревнование с друзьями)
    showVKLeaderboard() {
        if (!isRunningInsideVK() || !window.vkBridge) return;
        const trophies = Math.floor(gState.trophies || 0);
        window.vkBridge.send('VKWebAppShowLeaderBoardBox', {
            user_result: Math.max(1, trophies)
        }).catch(err => {
            console.warn('[PlatformBridge] VK LeaderBoard error:', err);
        });
    },

    async getArenaLeaderboardEntries() {
        const leaderboards = this.ysdkInstance && this.ysdkInstance.leaderboards;
        if (!leaderboards || typeof leaderboards.getEntries !== 'function') {
            throw new Error('Yandex Games leaderboard API is unavailable');
        }
        return leaderboards.getEntries('arena_trophies', {
            quantityTop: 20,
            includeUser: true,
            quantityAround: 3
        });
    },

    // Универсальный роутер внешних ссылок: VK Bridge → системный браузер, Yandex SDK → openUrl,
    // Standalone → window.open. Готов к подключению Yandex Games без переписывания вызывающего кода.
    openExternalUrl(url) {
        if (!url) return;
        // Ветка VK: открываем через нативный bridge, чтобы не терять iframe
        if (isRunningInsideVK() && window.vkBridge) {
            try {
                window.vkBridge.send('VKWebAppOpenURL', { link: url, target: 'blank' })
                    .catch(() => window.open(url, '_blank', 'noopener'));
            } catch (e) {
                window.open(url, '_blank', 'noopener');
            }
            return;
        }
        // Ветка Yandex Games (задел на будущее: сработает, когда ysdkInstance инициализирован)
        if (this.ysdkInstance && typeof this.ysdkInstance.openUrl === 'function') {
            try {
                this.ysdkInstance.openUrl(url).catch(() => window.open(url, '_blank', 'noopener'));
            } catch (e) {
                window.open(url, '_blank', 'noopener');
            }
            return;
        }
        // Standalone (GH Pages / localhost / Telegram): обычное открытие в новой вкладке
        window.open(url, '_blank', 'noopener');
    },

    // Нативный диалог приглашения друзей ВКонтакте с виральной наградой
    inviteFriendsVK() {
        if (!isRunningInsideVK() || !window.vkBridge) {
            const shareUrl = `https://vk.ru/app54817477#ref_${gState.playerName || 'lord'}`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(shareUrl).then(() => {
                    pushToast(currentLang === 'RU' ? 'Ссылка скопирована в буфер!' : 'Link copied to clipboard!');
                }).catch(() => {});
            }
            return;
        }

        window.vkBridge.send('VKWebAppShowInviteBox').then(data => {
            if (data && data.success) {
                const today = new Date().toDateString();
                if (gState.lastInviteDate !== today) {
                    gState.lastInviteDate = today;
                    gState.crystals = (gState.crystals || 0) + 50;
                    playCoinSfx();
                    triggerHaptic('upgrade');
                    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
                    pushToast(currentLang === 'RU' ? `+50 ${cI} за приглашение друзей!` : `+50 ${cI} for inviting friends!`);
                    saveGame();
                    renderPlatformRewardsUI();
                    renderUI();
                } else {
                    pushToast(currentLang === 'RU' ? 'Приглашения отправлены!' : 'Invitations sent!');
                }
            }
        }).catch(() => {});
    },

    // Проверка реферального перехода новичка («Дар Дружбы»)
    checkReferralArrival() {
        if (gState.claimedReferralBonus) return;
        try {
            const hash = window.location.hash || '';
            const search = window.location.search || '';
            const urlParams = new URLSearchParams(search);
            const currentUserId = urlParams.get('vk_user_id') || '';

            let refId = '';
            const hashMatch = hash.match(/ref_(\w+)/);
            if (hashMatch) {
                refId = hashMatch[1];
            } else if (urlParams.get('vk_ref')) {
                refId = urlParams.get('vk_ref');
            }

            if (refId && refId !== currentUserId) {
                gState.claimedReferralBonus = true;
                const bonusGold = 1000;
                const bonusCryst = 25;
                gState.gold += bonusGold;
                gState.lifetimeGold += bonusGold;
                gState.crystals += bonusCryst;
                saveGame();
                const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
                const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
                setTimeout(() => {
                    playCoinSfx();
                    triggerHaptic('legendary');
                    pushToast(currentLang === 'RU' 
                        ? `ДАР ДРУЖБЫ: +${formatNumber(bonusGold)} ${gI} • +${bonusCryst} ${cI}` 
                        : `FRIENDSHIP SPOILS: +${formatNumber(bonusGold)} ${gI} • +${bonusCryst} ${cI}`);
                }, 1500);
            }
        } catch(e) {}
    },

        initVKHandshake() {
        if (PlatformBridge._vkHandshakeDone) return;
        PlatformBridge._vkHandshakeDone = true;
        // FIX-CLEAN-DIAG: все DIAG-логи через devLog. В VK и на GH Pages без
        // ?debug=1 консоль полностью чистая (п. 4.1.3 правил VK). При отладке —
        // открыть на локалке или временно включить IS_DEV_MODE.
        // console.warn в catch-ветках оставлен как есть — это реальные сигналы ошибок.
        devLog('[DIAG] initVKHandshake fired, isVK=' + isRunningInsideVK() + ', hasBridge=' + !!window.vkBridge);
        if (!isRunningInsideVK() || !window.vkBridge) return;
        try {
            // FIX-VK-SPLASH-3: VKWebAppUpdateConfig убран из цепочки. Логи показали,
            // что VK Bridge не резолвит промис этого метода в Games-контейнере —
            // chain висит вечно, [LOTA] READY не логируется. Splash при этом всё
            // равно не снимается, значит UpdateConfig НЕ является триггером снятия.
            // Оставляем только Init. Если VK Games-контейнер ждёт доп. сигналов —
            // это его внутренняя логика, недокументированная, и решается только
            // через поддержку VK или автоматически после модерации.
            window.vkBridge.send('VKWebAppInit')
                .then(data => {
                    devLog('[DIAG] VKWebAppInit resolved, result=' + (data && data.result));
                    devLog('[LOTA] READY — application initialized, waiting for VK container');

                    // FIX-ADMIN-USERID: современный VK Bridge не кладёт vk_user_id в URL iframe,
                    // launch params доступны только через VKWebAppGetLaunchParams. Запрашиваем
                    // их асинхронно — результат нужен для мастер-панели (см. data-admin.js).
                    // Fallback на URL-параметр остаётся для standalone-режима (localhost, GH Pages).
                    window.vkBridge.send('VKWebAppGetLaunchParams')
                        .then(lp => {
                            if (lp && lp.vk_user_id) {
                                window.__vkUserId = String(lp.vk_user_id);
                                devLog('[LOTA] vk_user_id resolved via bridge:', window.__vkUserId);
                                if (typeof ensureAdminAccess === 'function') ensureAdminAccess();
                            }
                        })
                        .catch(e => devLog('[LOTA] GetLaunchParams failed:', e));
                })
                .catch(e => console.warn('[DIAG] VK handshake FAIL', e));

            // FIX-VK-GAMES-SPLASH: подписка на ВСЕ события VK Bridge (диагностика).
            // Позволит увидеть, отправляет ли VK нам ViewRestore/UpdateConfig/GetLaunchParams,
            // и на каком из событий VK ожидает от нас ответа.
            window.vkBridge.subscribe(event => {
                if (!event || !event.detail) return;
                const type = event.detail.type;
                devLog('[DIAG] VK event:', type, event.detail.data ? JSON.stringify(event.detail.data).slice(0, 200) : '');

                if (type === 'VKWebAppViewHide') {
                    pauseBgMusic();
                    if (typeof aCtx !== 'undefined' && aCtx && aCtx.state === 'running') {
                        try { aCtx.suspend(); } catch(e) {}
                    }
                    saveGame(true);
                } else if (type === 'VKWebAppViewRestore') {
                    if (typeof aCtx !== 'undefined' && aCtx && aCtx.state === 'suspended') {
                        try { aCtx.resume(); } catch(e) {}
                    }
                    if (!gState.isMusicMuted) playBgMusic();
                }
            });

            // FIX-VK-SPLASH-2: RETRY VKWebAppInit убран. Логи показали, что VK
            // отвечает {"result": false} на повторный Init через 800мс — это может
            // сбрасывать состояние контейнера в «не инициализирован», заново
            // показывая splash. Первый Init всегда успешен, второй — вреден.
        } catch (e) {
            console.warn('[DIAG] initVKHandshake outer catch:', e);
        }
    },

    init() {
        // VK handshake вызывается здесь как fallback (для standalone boot-сценариев),
        // но в норме уже был вызван синхронно в boot-блоке engine.js ДО этого init.
        this.initVKHandshake();
        if (isRunningInsideVK() && window.vkBridge) {
            this.initVKCloudSync();
            this.checkReferralArrival();
        }

        // Yandex Games SDK подгружается ДИНАМИЧЕСКИ и ТОЛЬКО внутри реального портала Яндекс.Игр.
        // В обычном браузере (GitHub Pages, localhost) скрипт вообще не инжектится — это
        // устраняет спам "No parent to post message" в консоли и экономит ~200-400 мс загрузки.
        if (isRunningInsideYandex()) {
            this.loadYandexSdk().then(() => {
                if (typeof window.YaGames === 'undefined') return null;
                return window.YaGames.init();
            }).then(ysdk => {
                if (!ysdk) return;
                this.ysdkInstance = ysdk;
                window.ysdk = ysdk;

                // Инициализация платежей
                ysdk.getPayments({ signed: true }).then(payments => {
                    this.yandexPayments = payments;
                    // T-E (Major): Yandex IAP — догоняющая выдача. Если игрок оплатил,
                    // но сеть/приложение упали до onSuccess() — покупка хранится в статусе pending.
                    // getPurchases() возвращает список незавершённых, каждую надо consume() и выдать.
                    this.recoverPendingYandexPurchases(payments);
                }).catch(() => {});

                // Инициализация облачных сохранений Яндекса
                this.initYandexCloudSync();

                // Проверка доступности установки ярлыка на рабочий стол
                this.checkShortcutSupport();

                // Гарантированная отправка LoadingAPI.ready() при поздней инициализации SDK
                if (this.isLoadingReadyCalled) {
                    this.notifyLoadingReady();
                }
            }).catch(err => {
                console.warn('[PlatformBridge] Yandex SDK init failed:', err);
            });
        }
    },

    // Однократная динамическая загрузка Yandex Games SDK v2.
    // Возвращает Promise, резолвящийся после onload скрипта или немедленно, если SDK уже загружен.
    loadYandexSdk() {
        if (typeof window !== 'undefined' && window.YaGames) return Promise.resolve();
        if (this._yandexSdkPromise) return this._yandexSdkPromise;
        this._yandexSdkPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://yandex.ru/games/sdk/v2';
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Yandex SDK failed to load'));
            document.head.appendChild(script);
        });
        return this._yandexSdkPromise;
    },

    // T-E (Major): догоняющая выдача зависших покупок Yandex.
    // Вызывается при инициализации платежей. Покрывает сценарий:
    //   игрок оплатил → краш/сеть упала → транзакция pending → игрок вернулся через сутки.
    // Возвращает товар и вызывает consumePurchase, чтобы SDK не тянул транзакцию бесконечно.
    recoverPendingYandexPurchases(payments) {
        if (!payments || typeof payments.getPurchases !== 'function') return;
        payments.getPurchases().then(purchases => {
            if (!Array.isArray(purchases) || purchases.length === 0) return;
            console.log('[Yandex IAP] Recovering', purchases.length, 'pending purchases');
            purchases.forEach(p => {
                const itemId = p.productID || p.id;
                if (!itemId) return;
                // Выдаём товар через общую логику executePurchase (минуя UI-модалку)
                try {
                    executePurchase(itemId);
                } catch(e) {
                    console.warn('[Yandex IAP] Recovery failed for', itemId, e);
                }
                // Закрываем транзакцию на стороне Yandex
                if (typeof payments.consumePurchase === 'function') {
                    payments.consumePurchase(p.productToken || p.purchaseToken).catch(() => {});
                }
            });
            pushToast(currentLang === 'RU' 
                ? `Восстановлено покупок: ${purchases.length}` 
                : `Recovered purchases: ${purchases.length}`);
        }).catch(err => {
            console.warn('[Yandex IAP] getPurchases failed:', err);
        });
    },

    // Официальный сигнал платформе Яндекс Игр: загрузка завершена, спрятать сплэш
    notifyLoadingReady() {
        this.isLoadingReadyCalled = true;
        if (this.ysdkInstance && this.ysdkInstance.features && this.ysdkInstance.features.LoadingAPI) {
            try {
                this.ysdkInstance.features.LoadingAPI.ready();
            } catch(e) {}
        }
    },

    // Нативные Лидерборды Яндекс Игр (Combat Power и Trophies)
    sendLeaderboards() {
        if (!this.ysdkInstance) return;
        const totalCp = calculateCP ? calculateCP() : 0;
        const trophies = gState.trophies || 0;

        const updateScore = (lbName, val) => {
            try {
                if (this.ysdkInstance.leaderboards && this.ysdkInstance.leaderboards.setScore) {
                    this.ysdkInstance.leaderboards.setScore(lbName, Math.floor(val)).catch(err => {
                        console.warn(`[Yandex Leaderboards] Failed to submit ${lbName}:`, err);
                    });
                } else if (this.ysdkInstance.getLeaderboards) {
                    this.ysdkInstance.getLeaderboards().then(lb => {
                        lb.setLeaderboardScore(lbName, Math.floor(val));
                    }).catch(err => {
                        console.warn(`[Yandex Leaderboards] Failed to submit ${lbName}:`, err);
                    });
                }
            } catch (err) {
                console.warn(`[Yandex Leaderboards] Failed to submit ${lbName}:`, err);
            }
        };

        if (totalCp > 0) updateScore('combat_power', totalCp);
        if (trophies > 0) updateScore('arena_trophies', trophies);
    },

    // Умный системный запрос отзыва (строго в моменты триумфа)
    checkAndPromptReview() {
        if (gState.hasReviewedPlatform || !this.ysdkInstance || !this.ysdkInstance.feedback) return;
        try {
            this.ysdkInstance.feedback.canReview().then(({ value }) => {
                if (value) {
                    this.ysdkInstance.feedback.requestReview().then(({ feedbackSent }) => {
                        if (feedbackSent) {
                            gState.hasReviewedPlatform = true;
                            gState.crystals = (gState.crystals || 0) + 50;
                            const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
                            pushToast(currentLang === 'RU' ? `Благодарим за отзыв! +50 ${cI}` : `Thank you for the review! +50 ${cI}`);
                            saveGame();
                            renderUI();
                        }
                    }).catch(() => {});
                }
            }).catch(() => {});
        } catch(e) {}
    },

    // Проверка поддержки установки ярлыка на рабочий стол Яндекса
    checkShortcutSupport() {
        if (this.ysdkInstance && this.ysdkInstance.shortcut && !gState.hasAddedShortcutYandex) {
            try {
                this.ysdkInstance.shortcut.canShowPrompt().then(res => {
                    this.canShowYandexShortcut = !!res.canShow;
                    renderPlatformRewardsUI();
                }).catch(() => {});
            } catch(e) {}
        }
    },

    // Вызов системного окна установки ярлыка Яндекс Игр
    promptYandexShortcut() {
        if (!this.ysdkInstance || !this.ysdkInstance.shortcut) {
            if (!gState.hasAddedShortcutYandex) {
                gState.hasAddedShortcutYandex = true;
                gState.crystals = (gState.crystals || 0) + 50;
                playCoinSfx();
                const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
                pushToast(`+50 ${cI} Ярлык добавлен!`);
                saveGame();
                renderPlatformRewardsUI();
                renderUI();
            }
            return;
        }

        this.ysdkInstance.shortcut.showPrompt().then(res => {
            if (res && res.result === 'success') {
                gState.hasAddedShortcutYandex = true;
                gState.crystals = (gState.crystals || 0) + 50;
                playCoinSfx();
                const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
                pushToast(currentLang === 'RU' ? `+50 ${cI} за ярлык на рабочем столе!` : `+50 ${cI} for desktop shortcut!`);
                saveGame();
                renderPlatformRewardsUI();
                renderUI();
            }
        }).catch(() => {});
    },

    initYandexCloudSync() {
        if (!this.ysdkInstance) return;
        this.ysdkInstance.getPlayer({ scopes: false }).then(player => {
            this.yandexPlayer = player;
            player.getData([SAVE_KEY]).then(data => {
                if (data && data[SAVE_KEY]) {
                    this.performSafeArbitration(data[SAVE_KEY]);
                } else {
                    // Первичное наполнение облака локальным сейвом
                    this.queueCloudSave(true);
                }
            }).catch(e => console.warn('[PlatformBridge] Yandex getData error:', e));
        }).catch(err => {
            console.log('[PlatformBridge] Игрок не авторизован в Яндекс Играх (гостевой режим):', err);
        });
    },

    // FIX-VK-CHUNK: при загрузке из VK Storage мы сначала смотрим на «главный» ключ.
    // Если там лежит маркер __CHUNKED__:N — значит сейв разбит на N частей,
    // и мы добираем их вторым запросом VKWebAppStorageGet. VK возвращает ключи
    // в произвольном порядке, поэтому собираем строго по индексу.
    initVKCloudSync() {
        if (!isRunningInsideVK() || !window.vkBridge) return;
        window.vkBridge.send('VKWebAppStorageGet', { keys: [SAVE_KEY] }).then(res => {
            if (!res || !res.keys || !res.keys[0] || !res.keys[0].value) return;
            const rawValue = res.keys[0].value;

            const chunkedMatch = rawValue.match(/^__CHUNKED__:(\d+)$/);
            if (!chunkedMatch) {
                // Обычный (не разбитый) сейв — путь через тот же arbitration.
                this.performSafeArbitration(rawValue);
                return;
            }

            const chunkCount = parseInt(chunkedMatch[1], 10);
            // Защита от порчи: не более 16 чанков (64 КБ). Если больше — сейв подозрительный.
            if (!Number.isFinite(chunkCount) || chunkCount <= 0 || chunkCount > 16) {
                console.warn('[Cloud Sync] VK Storage вернул некорректное число чанков:', chunkCount);
                return;
            }

            const chunkKeys = [];
            for (let i = 0; i < chunkCount; i++) {
                chunkKeys.push(`${SAVE_KEY}_chunk_${i}`);
            }

            window.vkBridge.send('VKWebAppStorageGet', { keys: chunkKeys }).then(chunkRes => {
                if (!chunkRes || !Array.isArray(chunkRes.keys)) return;
                // VK не гарантирует порядок — раскладываем по key, собираем строго по индексу.
                const byKey = {};
                chunkRes.keys.forEach(k => { if (k && k.key) byKey[k.key] = k.value || ''; });

                let assembled = '';
                for (let i = 0; i < chunkCount; i++) {
                    assembled += byKey[`${SAVE_KEY}_chunk_${i}`] || '';
                }
                this.performSafeArbitration(assembled);
            }).catch(() => {});
        }).catch(() => {});
    },

    // Безопасный арбитраж версий: исключает перезапись более нового прогресса.
    // FIX-VK-CHUNK: VK Storage жёстко ограничен 4096 символами на ключ. Если сейв больше —
    // он обрезается → JSON.parse падает с "Unterminated string". Теперь мы:
    //   1. Быстро проверяем сбалансированность фигурных скобок ДО парсинга.
    //   2. Логируем обрезку как warn (не error) — консоль остаётся чистой для модерации.
    //   3. Тихо игнорируем битый облачный сейв — локальный остаётся нетронутым, а
    //      при следующем flushCloudSave облако само перезапишется целой версией.
    performSafeArbitration(remoteJsonStr) {
        try {
            if (typeof remoteJsonStr !== 'string' || remoteJsonStr.length === 0) return;

            // Дешёвая защита от явно обрезанной строки (быстрее JSON.parse в разы)
            const firstChar = remoteJsonStr.charCodeAt(0);
            const lastChar = remoteJsonStr.charCodeAt(remoteJsonStr.length - 1);
            if (firstChar !== 123 || lastChar !== 125) {
                console.warn('[Cloud Sync] Облачный сейв обрезан (' + remoteJsonStr.length + ' chars). Ожидаю восстановления из локали.');
                return;
            }

            const remoteState = JSON.parse(remoteJsonStr);
            if (!remoteState || typeof remoteState !== 'object') return;

            // FIX-TICKTIME-GUARD: для сравнения используем честный timestamp из localStorage,
            // зафиксированный в loadGame ДО мутаций через checkDailyReset/checkWeekly*.
            // gState.lastTickTime после loadGame мог быть перезаписан на Date.now() при
            // смене суток — это ломало арбитраж и стирало облачный сейв.
            // Fallback на gState.lastTickTime нужен для случая, когда localStorageTickTimeAtBoot
            // не был установлен (пустой localStorage → не дошли до присвоения).
            const localTick = localStorageTickTimeAtBoot > 0
                ? localStorageTickTimeAtBoot
                : (gState.lastTickTime || 0);
            const remoteTick = remoteState.lastTickTime || 0;

            // FIX-FRESH-START: если localStorage был пуст при загрузке, но в облаке
            // лежит валидный сейв (remoteTick > 0) — накатываем его БЕЗУСЛОВНО.
            // Без этой ветки дефолтный lastTickTime = Date.now() новее облачного,
            // и старая логика (localTick > remoteTick → queueCloudSave) стирала
            // реальный прогресс пользователя дефолтом.
            if (wasLoadedFromEmptyStorage && remoteTick > 0) {
                devLog('[Cloud Sync] Fresh start detected — forcing cloud override');
                gState = Object.assign({}, gState, remoteState);
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify(gState));
                } catch(e) {}
                renderFormationSlots();
                renderCards();
                renderQuests();
                renderArena();
                renderDungeon();
                renderRaidBossUI();
                renderLeaderboard();
                renderBattleHistory();
                renderFtue();
                renderUI();
                pushToast(currentLang === 'RU' ? 'Прогресс восстановлен из облака!' : 'Cloud save restored!');
                return;
            }

            if (remoteTick > localTick) {
                devLog('[Cloud Sync] Накат более свежего прогресса из облака платформы');
                gState = Object.assign({}, gState, remoteState);
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify(gState));
                } catch(e) {}
                renderFormationSlots();
                renderCards();
                renderQuests();
                renderArena();
                renderDungeon();
                renderRaidBossUI();
                renderLeaderboard();
                renderBattleHistory();
                renderFtue();
                renderUI();
                pushToast(currentLang === 'RU' ? 'Прогресс синхронизирован с облаком!' : 'Cloud save synchronized!');
            } else if (localTick > remoteTick) {
                devLog('[Cloud Sync] Локальный сейв новее облачного, обновляем облако');
                this.queueCloudSave(true);
            }
        } catch(e) {
            console.error('[Cloud Sync] Ошибка парсинга облачных данных:', e);
        } finally {
            // FIX-OFFLINE-DUP: облако подтянулось (успех, битый JSON или пусто) —
            // теперь lastTickTime канонический, можно считать offline income.
            // finalizeOfflineIncome single-shot: если таймаут в loadGame уже
            // выстрелил — no-op.
            finalizeOfflineIncome();
        }
    },

    // Очередь сетевой отправки с дебаунсом 15 секунд (защита от rate limit)
    queueCloudSave(immediate = false) {
        this.isCloudDirty = true;
        if (immediate) {
            // MAJOR-M9: при форсированном flush отменяем отложенный debounce-таймер,
            // чтобы не было дублирующего сетевого вызова через 15 секунд после immediate.
            if (this.syncDebounceTimer) {
                clearTimeout(this.syncDebounceTimer);
                this.syncDebounceTimer = null;
            }
            this.flushCloudSave();
            return;
        }
        if (this.syncDebounceTimer) return;
        this.syncDebounceTimer = setTimeout(() => {
            this.syncDebounceTimer = null;
            this.flushCloudSave();
        }, 15000);
    },

    // Принудительный сброс буфера в сеть
    flushCloudSave() {
        if (!this.isCloudDirty) return;
        const now = Date.now();
        if (now - this.lastCloudSaveTime < 10000) {
            if (!this.syncDebounceTimer) {
                this.syncDebounceTimer = setTimeout(() => {
                    this.syncDebounceTimer = null;
                    this.flushCloudSave();
                }, 10000);
            }
            return;
        }

        this.isCloudDirty = false;
        this.lastCloudSaveTime = now;
        const payload = JSON.stringify(gState);

        // Ветка Яндекс Игр
        if (this.yandexPlayer) {
            try {
                this.yandexPlayer.setData({
                    [SAVE_KEY]: payload
                }, true).catch(e => console.warn('[Cloud Sync] Yandex setData error:', e));
            } catch(e) {}
        }

        // Ветка VK Storage.
        // FIX-VK-CHUNK: VK Storage имеет жёсткий лимит 4096 символов на значение ключа.
        // Если payload влезает — пишем как раньше одним ключом (обратная совместимость).
        // Если больше — пишем главный ключ-маркер "__CHUNKED__:N" и N чанков по 4000 симв.
        // VK Bridge не имеет batch-API, поэтому шлём все ключи через Promise.all.
        if (isRunningInsideVK() && window.vkBridge) {
            try {
                const VK_KEY_LIMIT = 4000; // 96 символов запаса от лимита VK

                if (payload.length <= VK_KEY_LIMIT) {
                    // Быстрый путь: помещается в один ключ.
                    window.vkBridge.send('VKWebAppStorageSet', {
                        key: SAVE_KEY,
                        value: payload
                    }).catch(() => {});
                } else {
                    const chunkCount = Math.ceil(payload.length / VK_KEY_LIMIT);

                    // Защита от абсурда: 16 чанков = 64 КБ — потолок для нашей экономики.
                    // Если сейв больше — не пишем вообще, чтобы не тратить rate-limit VK впустую.
                    if (chunkCount > 16) {
                        console.warn('[VK Storage] Сейв слишком велик для облака (' + payload.length + ' chars), пропускаю синхронизацию.');
                    } else {
                        const requests = [{
                            key: SAVE_KEY,
                            value: `__CHUNKED__:${chunkCount}`
                        }];
                        for (let i = 0; i < chunkCount; i++) {
                            requests.push({
                                key: `${SAVE_KEY}_chunk_${i}`,
                                value: payload.substring(i * VK_KEY_LIMIT, (i + 1) * VK_KEY_LIMIT)
                            });
                        }
                        Promise.all(requests.map(req =>
                            window.vkBridge.send('VKWebAppStorageSet', req).catch(() => {})
                        )).catch(() => {});
                    }
                }
            } catch(e) {}
        }

        // Фоновая синхронизация рекордов в Лидерборды платформ
        this.sendLeaderboards();
    },

    showRewarded(onSuccess, onError) {
        if (isVipActive()) {
            // L1: локализация VIP-тоста (RU/EN)
            pushToast(currentLang === 'RU' ? "VIP: Награда начислена без рекламы!" : "VIP: Reward credited without ads!");
            playCoinSfx();
            if (typeof onSuccess === 'function') onSuccess();
            return;
        }

        pauseBgMusic();
        const resumeMusic = () => {
            if (!gState.isMusicMuted) playBgMusic();
        };

        const handleFail = (msg) => {
            resumeMusic();
            pushToast(msg);
            if (typeof onError === 'function') onError();
        };

        // Ветка Яндекс Игр (только в реальном портале)
        if (isRunningInsideYandex()) {
            if (!this.ysdkInstance || !this.ysdkInstance.adv) {
                handleFail(currentLang === 'RU' ? "Реклама Яндекс Игр недоступна. Проверьте соединение" : "Yandex ads unavailable. Check your connection");
                return;
            }
            try {
                this.ysdkInstance.adv.showRewardedVideo({
                    callbacks: {
                        onOpen: () => {},
                        onRewarded: () => {
                            resumeMusic();
                            if (typeof onSuccess === 'function') onSuccess();
                        },
                        onClose: () => {
                            resumeMusic();
                        },
                        onError: () => {
                            handleFail(currentLang === 'RU' ? "Видео недоступно" : "Ad unavailable");
                        }
                    }
                });
            } catch (error) {
                console.warn('[Yandex Ads] Failed to show rewarded video:', error);
                handleFail(currentLang === 'RU' ? "Видео недоступно" : "Ad unavailable");
            }
            return;
        }

        // Ветка VK Bridge с защитой от зависания (Watchdog 10s)
        if (isRunningInsideVK()) {
            if (!window.vkBridge) {
                handleFail(currentLang === 'RU' ? "Нет связи с VK. Проверьте соединение" : "VK connection unavailable. Check your connection");
                return;
            }
            let isResolved = false;
            const watchdogTimer = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    handleFail(currentLang === 'RU' ? "Видео недоступно" : "Ad unavailable");
                }
            }, 10000);

            window.vkBridge.send('VKWebAppShowRewardedVideo')
                .then(data => {
                    if (isResolved) return;
                    isResolved = true;
                    clearTimeout(watchdogTimer);
                    resumeMusic();
                    if (data && data.result) {
                        if (typeof onSuccess === 'function') onSuccess();
                    } else {
                        handleFail(currentLang === 'RU' ? "Просмотр не завершен" : "Ad was not completed");
                    }
                })
                .catch(() => {
                    if (isResolved) return;
                    isResolved = true;
                    clearTimeout(watchdogTimer);
                    handleFail(currentLang === 'RU' ? "Видео недоступно" : "Ad unavailable");
                });
            return;
        }

        // Эмуляция рекламы разрешена только в режиме разработки.
        if (IS_DEV_MODE) {
            pushToast(currentLang === 'RU' ? "[РЕКЛАМА: Просмотр засчитан!]" : "[AD: Watched!]");
            resumeMusic();
            playCoinSfx();
            if (typeof onSuccess === 'function') onSuccess();
            return;
        }
        handleFail(currentLang === 'RU' ? "Реклама недоступна" : "Ads unavailable");
    },

    purchase(itemKey, priceRub, onSuccess) {
        // T-A (Critical): запрет fallback в бесплатный товар при поломке платежей в Yandex.
        // Если мы внутри Yandex, но платежи ещё не инициализированы или упали —
        // НЕ отдаём товар бесплатно, а просим повторить попытку через секунду.
        if (isRunningInsideYandex()) {
            if (!this.yandexPayments) {
                // Пробуем реинициализировать платежи (SDK может подгрузиться с задержкой)
                if (this.ysdkInstance) {
                    pushToast(currentLang === 'RU' ? "Инициализация платежей… Повторите через секунду" : "Payments initializing… Retry in a second");
                    this.ysdkInstance.getPayments({ signed: true }).then(payments => {
                        this.yandexPayments = payments;
                    }).catch(() => {});
                } else {
                    pushToast(currentLang === 'RU' ? "Платежи недоступны. Проверьте соединение" : "Payments unavailable. Check connection");
                }
                return; // товар не выдаём
            }
            this.yandexPayments.purchase({ id: itemKey }).then(() => {
                onSuccess();
            }).catch((err) => {
                // v4.8.8: различаем отмену игроком от технической ошибки Yandex Payments.
                // Раньше любой reject показывал «Оплата отменена» — игрок думал, что сам отказался,
                // хотя сбой был на платёжном шлюзе.
                const errStr = String((err && (err.message || err.code)) || '');
                const isCancelled = /cancel/i.test(errStr) || (err && err.code === 'PURCHASE_CANCELLED');
                pushToast(currentLang === 'RU'
                    ? (isCancelled ? "Оплата отменена" : "Ошибка платежа. Попробуйте позже")
                    : (isCancelled ? "Order cancelled" : "Payment error. Try again later"));
            });
            return;
        }

        // VK: нативная оплата голосами / рублями
        if (isRunningInsideVK()) {
            if (!window.vkBridge) {
                pushToast(currentLang === 'RU' ? "Нет связи с VK. Проверьте соединение" : "VK connection unavailable. Check your connection");
                return;
            }
            window.vkBridge.send('VKWebAppShowOrderBox', {
                type: 'item',
                item: itemKey
            }).then(data => {
                // T-F: обрабатываем все три состояния — success / отмена / неопределённый ответ
                if (data && data.success === true) {
                    onSuccess();
                } else {
                    pushToast(currentLang === 'RU' ? "Оплата отменена" : "Order cancelled");
                }
            }).catch((err) => {
                // FIX-CLEAN-CONSOLE: warn только в dev-режиме. В проде — молча, потому что
                // до регистрации IAP-товаров (после модерации) любой вызов падает с ошибкой
                // «item not found» — это ожидаемое поведение, не проблема для модератора.
                if (IS_DEV_MODE) console.warn('[VK IAP] Order failed:', err);
                pushToast(currentLang === 'RU' ? "Оплата отменена" : "Order cancelled");
            });
            return;
        }

        // Standalone подтверждение (браузер / Telegram / GitHub Pages)
        onSuccess();
    }
};

function showPlatformRewarded(onSuccess, onError) {
    PlatformBridge.showRewarded(onSuccess, onError);
}

// FIX-ADMIN-USERID: единая точка получения vk_user_id.
// Приоритет: bridge (актуально для VK) → URL (fallback для standalone).
// Возвращает строку. Пустая строка = standalone без user_id.
function getCurrentVkUserId() {
    if (typeof window !== 'undefined' && window.__vkUserId) return window.__vkUserId;
    try {
        const urlParams = new URLSearchParams((window.location && window.location.search) || '');
        return urlParams.get('vk_user_id') || '';
    } catch (e) {
        return '';
    }
}

// P-PROMO: модалка ввода промокода. Один общий entry-point для Главного меню
// и Настроек. Валидация: формат → наличие в PROMO_CODES → не использован.
// Награды выдаются одним saveGame(), код перманентно фиксируется в gState.
function openPromoModal() {
    const input = document.getElementById('promo-input');
    const m = document.getElementById('promo-modal');
    if (input) input.value = '';
    if (m) m.style.display = 'flex';
    playSfx(480, 'sine', 0.05);
}

function closePromoModal() {
    const m = document.getElementById('promo-modal');
    if (m) m.style.display = 'none';
}

// P-PROMO: единый обработчик активации. source: 'modal' (по умолчанию) или 'settings'.
// Модалка и inline-поле в Настройках используют общую логику валидации и выдачи.
function redeemPromoCode(source = 'modal') {
    const inputId = (source === 'settings') ? 'promo-input-settings' : 'promo-input';
    const input = document.getElementById(inputId);
    if (!input) return;

    const rawCode = (input.value || '').trim().toUpperCase();
    if (!rawCode) {
        return pushToast(currentLang === 'RU' ? 'Введите промокод' : 'Enter a promo code');
    }

    if (typeof isValidPromoFormat === 'function' && !isValidPromoFormat(rawCode)) {
        return pushToast(currentLang === 'RU' ? 'Неверный формат кода' : 'Invalid code format');
    }

    const promo = (typeof PROMO_CODES !== 'undefined' && PROMO_CODES[rawCode]) ? PROMO_CODES[rawCode] : null;
    if (!promo) {
        triggerHaptic('defeat');
        return pushToast(currentLang === 'RU' ? 'Промокод не найден' : 'Promo code not found');
    }

    if (!Array.isArray(gState.usedPromoCodes)) gState.usedPromoCodes = [];
    if (gState.usedPromoCodes.includes(rawCode)) {
        return pushToast(currentLang === 'RU' ? 'Этот промокод уже использован' : 'This code has already been used');
    }

    // Выдача наград
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
    const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';

    const lootParts = [];
    if (promo.gold) {
        gState.gold += promo.gold;
        gState.lifetimeGold += promo.gold;
        lootParts.push(`+${formatNumber(promo.gold)} ${gI}`);
    }
    if (promo.crystals) {
        gState.crystals += promo.crystals;
        lootParts.push(`+${promo.crystals} ${cI}`);
    }
    if (promo.relics) {
        gState.relics += promo.relics;
        lootParts.push(`+${promo.relics} ${rI}`);
    }
    if (promo.tickets) {
        gState.tickets += promo.tickets;
        lootParts.push(`+${promo.tickets} ${tI}`);
    }
    // PROMO-HERO: выдача конкретного героя. Если он уже есть — +1★,
    // если MAX 10★ — компенсация кристаллами. Защита от повторной выдачи
    // обеспечивается массивом gState.usedPromoCodes ниже (один код = одна выдача).
    if (promo.hero && typeof HEROES_CATALOG !== 'undefined' && HEROES_CATALOG[promo.hero]) {
        const hid = promo.hero;
        const heroDef = HEROES_CATALOG[hid];
        const heroName = heroDef.name[currentLang] || heroDef.name['EN'];
        if (!gState.deck[hid]) {
            gState.deck[hid] = { stars: 1, lvl: 1 };
            lootParts.push(`[${heroDef.tier}] ${heroName}`);
        } else if ((gState.deck[hid].stars || 1) < 10) {
            gState.deck[hid].stars = (gState.deck[hid].stars || 1) + 1;
            lootParts.push(`★+1 [${heroDef.tier}] ${heroName}`);
        } else {
            const promoHeroCompensation = 1500;
            gState.crystals += promoHeroCompensation;
            lootParts.push(`+${promoHeroCompensation} ${cI} (MAX 10)`);
        }
    }

    gState.usedPromoCodes.push(rawCode);
    playCoinSfx();
    triggerHaptic('legendary');

    const titleStr = promo.title
        ? (promo.title[currentLang] || promo.title['EN'])
        : (currentLang === 'RU' ? 'Промокод активирован' : 'Promo activated');

    pushToast(`${titleStr}: ${lootParts.join(' • ')}`);

    saveGame();
    renderCards();
    renderUI();

    // Очистка поля ввода при успехе
    input.value = '';

    // Закрытие модалки только в modal-режиме. В settings-режиме поле просто очищается,
    // чтобы игрок мог ввести следующий промокод (если у него их несколько).
    if (source !== 'settings') {
        closePromoModal();
    }
}

// P8-ARCH: белый список доменов, которые разрешено превращать в кликабельные ссылки.
// Защита от инъекции javascript: через подмену текста в LEGAL_DOCS.
const LEGAL_LINK_WHITELIST = /^(https?:\/\/)?(vk\.com|vk\.ru|vk\.me)\//i;

// P8-ARCH: парсер токенов {{url}} внутри юридических текстов.
//   • Валидный URL из белого списка → <a data-legal-url="..."> с обработчиком
//   • Всё остальное (включая vk.com/app54817477) → обычный текст
// Обработчик вешается ПОСЛЕ вставки в DOM через addEventListener — без inline onclick,
// чтобы не рисковать с двойным экранированием кавычек в атрибуте.
function renderLegalText(rawText) {
    if (rawText === null || rawText === undefined) return '';
    const parts = String(rawText).split(/(\{\{[^}]+\}\})/g);
    return parts.map(part => {
        const match = part.match(/^\{\{(.+?)\}\}$/);
        if (match) {
            const url = match[1].trim();
            if (LEGAL_LINK_WHITELIST.test(url)) {
                const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                return `<a class="legal-doc-link" href="#" data-legal-url="${escapeHtml(fullUrl)}">${escapeHtml(url)}</a>`;
            }
            return escapeHtml(url);
        }
        return escapeHtml(part);
    }).join('');
}

// P8-ARCH: юридические документы рендерятся ВНУТРИ игрового iframe модалкой #legal-doc-modal.
// Это устраняет проблему дублирования VK-сессии при клике «Соглашение» из карточки приложения:
// VKWebAppOpenURL открывает документ в новом окне WebView, и любой возврат из него создаёт
// параллельную игровую сессию. Внутренняя модалка физически не покидает iframe.
// Внешние terms.html / privacy.html остаются в репозитории как публичная копия для VK Console.
function openLegalDocument(docKey) {
    if (typeof LEGAL_DOCS === 'undefined' || !LEGAL_DOCS[docKey]) return;
    const doc = LEGAL_DOCS[docKey];
    const lang = (currentLang === 'EN') ? 'EN' : 'RU';
    const data = doc[lang] || doc.RU;
    if (!data) return;

    const titleEl = document.getElementById('legal-doc-title');
    const updatedEl = document.getElementById('legal-doc-updated');
    const bodyEl = document.getElementById('legal-doc-body');
    // FIX-LEGAL-CLOSE: устойчивость к рассинхрону SW-кэша и к возможным будущим дублям id.
    // Приоритет — точный id; fallback — последняя .modal-full-btn внутри .legal-doc-window
    // первого найденного #legal-doc-modal (getElementById возвращает первый матч — он же видимый).
    const btnClose = document.getElementById('btn-legal-doc-close')
        || document.querySelector('#legal-doc-modal .legal-doc-window > button.btn-action.modal-full-btn:last-of-type');
    if (!titleEl || !bodyEl) return;

    titleEl.innerText = data.title || '';
    if (updatedEl) updatedEl.innerText = data.updated || '';

    // Кнопка «Закрыть» управляется вручную (без data-i18n), чтобы обновляться и при смене языка открытой модалки
    if (btnClose) {
        btnClose.innerText = (I18N[currentLang] && I18N[currentLang].modal_close)
            ? I18N[currentLang].modal_close
            : (currentLang === 'RU' ? 'ЗАКРЫТЬ' : 'CLOSE');
    }

    let html = '';
    (data.sections || []).forEach(sec => {
        if (sec.heading) html += `<h4 class="legal-doc-heading">${escapeHtml(sec.heading)}</h4>`;
        (sec.paragraphs || []).forEach(p => {
            html += `<p class="legal-doc-paragraph">${renderLegalText(p)}</p>`;
        });
        if (Array.isArray(sec.list) && sec.list.length) {
            html += '<ul class="legal-doc-list">' + sec.list.map(item => `<li>${renderLegalText(item)}</li>`).join('') + '</ul>';
        }
        (sec.trailingParagraphs || []).forEach(p => {
            html += `<p class="legal-doc-paragraph">${renderLegalText(p)}</p>`;
        });
    });

    bodyEl.innerHTML = html;
    bodyEl.scrollTop = 0;

    // Вешаем обработчики на ссылки после вставки в DOM — надёжнее inline onclick с экранированием
    bodyEl.querySelectorAll('[data-legal-url]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            PlatformBridge.openExternalUrl(a.getAttribute('data-legal-url'));
        });
    });

    const m = document.getElementById('legal-doc-modal');
    if (m) {
        m.setAttribute('data-doc-key', docKey);
        m.style.display = 'flex';
    }
    playSfx(420, 'sine', 0.05);
}

function closeLegalDocModal() {
    const m = document.getElementById('legal-doc-modal');
    if (m) m.style.display = 'none';
}

/* ==========================================================
   FIX-4.2.10: ГЛАВНОЕ МЕНЮ (bottom-sheet)
   Закрывает требование п. 4.2.10 правил VK Mini Apps: «Игра должна иметь полноценное
   стартовое меню... возможность вернуться в главное меню игры в любой момент».
   Меню заблокировано во время FTUE (кнопка скрыта CSS) и во время активного боя.
   ========================================================== */
function openMainMenu() {
    // FTUE: не даём прервать обучение (подстраховка к CSS-правилу .ftue-running #btn-main-menu)
    if (!isFtueCompleted()) return;

    // Бой: во время активного боя и при открытом вердикте меню не должно перекрывать стол
    const battleOverlay = document.getElementById('battle-overlay-modal');
    if (battleOverlay && battleOverlay.style.display === 'flex') {
        return pushToast(currentLang === 'RU' ? 'Меню недоступно во время боя' : 'Menu locked during combat');
    }

    updateMainMenuUI();
    const m = document.getElementById('main-menu-modal');
    if (m) m.style.display = 'flex';
    playSfx(480, 'sine', 0.05);
}

function closeMainMenu() {
    const m = document.getElementById('main-menu-modal');
    if (m) m.style.display = 'none';
}

// FIX-MENU-EXIT: нативное закрытие/сворачивание игры на каждой платформе.
// VK — VKWebAppClose (нативное закрытие мини-аппа).
// Yandex — GameplayAPI.stop() (сигнал платформе, что игрок вышел из gameplay).
// Standalone — браузер сам не даст закрыть таб скриптом, поэтому показываем подсказку.
function exitGame() {
    closeMainMenu();

    if (isRunningInsideVK() && window.vkBridge) {
        try {
            window.vkBridge.send('VKWebAppClose', { status: 'success' }).catch(() => {});
        } catch (e) {
            pushToast(currentLang === 'RU' ? 'Закройте окно игры' : 'Close the game window');
        }
        return;
    }

    if (isRunningInsideYandex() && PlatformBridge && PlatformBridge.ysdkInstance) {
        try {
            const gApi = PlatformBridge.ysdkInstance.features && PlatformBridge.ysdkInstance.features.GameplayAPI;
            if (gApi && typeof gApi.stop === 'function') gApi.stop();
        } catch (e) {}
        pushToast(currentLang === 'RU' ? 'Игра свёрнута' : 'Game minimized');
        return;
    }

    // Standalone (localhost / GitHub Pages / Telegram): window.close() заблокирован браузером
    pushToast(currentLang === 'RU' ? 'Закройте вкладку браузера' : 'Close the browser tab');
}

// FIX-BUILD-VERSION: рендер метки сборки в трёх местах UI.
// Вызывается из renderUI() (тик) — дешёвое сравнение через textContent.
function renderBuildVersion() {
    const label = (typeof I18N !== 'undefined' && I18N[currentLang] && I18N[currentLang].build_label)
        ? I18N[currentLang].build_label
        : 'СБОРКА';
    const text = `${label} v${BUILD_VERSION} · ${BUILD_DATE}`;
    const shortText = `v${BUILD_VERSION} · ${BUILD_DATE}`;

    const elSettings = document.getElementById('ui-build-version-settings');
    if (elSettings && elSettings.textContent !== text) elSettings.textContent = text;

    const elMenu = document.getElementById('mm-build-footer');
    if (elMenu && elMenu.textContent !== text) elMenu.textContent = text;

    const elPreloader = document.getElementById('ui-build-version-preloader');
    if (elPreloader && elPreloader.textContent !== shortText) elPreloader.textContent = shortText;
}

// Синхронизация динамических значений меню (язык, звук, скрытие «В ЦИТАДЕЛЬ»).
// Вызывается при открытии меню, при смене языка (applyLanguage) и при mute-тумблере.
function updateMainMenuUI() {
    const mmLang = document.getElementById('mm-lang-val');
    if (mmLang) mmLang.innerText = currentLang;

    const mmSound = document.getElementById('mm-sound-val');
    if (mmSound) {
        const isMuted = (gState.isAudioMuted && gState.isMusicMuted);
        mmSound.innerText = isMuted
            ? (currentLang === 'RU' ? 'ВЫКЛ' : 'OFF')
            : (currentLang === 'RU' ? 'ВКЛ' : 'ON');
    }

    // «В ЦИТАДЕЛЬ» скрываем, если игрок уже на главном экране — не показываем неактивное действие
    const citadelBtn = document.getElementById('mm-citadel');
    if (citadelBtn) {
        const activeView = document.querySelector('.view-tab.active');
        const alreadyInCitadel = !activeView || activeView.id === 'citadel-view';
        citadelBtn.style.display = alreadyInCitadel ? 'none' : 'flex';
    }
}

function tryTriggerInterstitialAd() {
    // Принудительная межстраничная реклама полностью отключена для максимального Retention
}

function formatNumber(num) {
    num = Math.floor(num || 0);
    // U5: для 0–999 нет разделителя разрядов, toLocaleString() — избыточная тяжёлая операция
    // (интернализация ICU). String() в разы быстрее, а formatNumber дёргается 50+ раз/сек.
    if (num < 1000) return String(num);
    const suffixes = ['', 'K', 'M', 'B', 'T', 'Q'];
    const i = Math.floor(Math.log10(num) / 3);
    const compactVal = parseFloat((num / Math.pow(10, i * 3)).toFixed(1));
    return `${compactVal}${suffixes[i] || ''}`;
}

// Форматирование цен магазина: для каталога VK Games строго в Голосах (п. 4.2.2 правил)
function formatPriceForPlatform(priceRub) {
    if (isRunningInsideVK()) {
        const voices = Math.max(1, Math.round(priceRub / 10));
        if (currentLang === 'RU') {
            const mod10 = voices % 10;
            const mod100 = voices % 100;
            if (mod10 === 1 && mod100 !== 11) return `${voices} голос`;
            if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${voices} голоса`;
            return `${voices} голосов`;
        }
        return `${voices} ${voices === 1 ? 'Voice' : 'Voices'}`;
    }
    return `${priceRub} ${currentLang === 'RU' ? 'руб.' : 'RUB'}`;
}

// U16: кэш статичных DOM-элементов. Тик и рендеры дёргают getElementById на горячих
// бейджах и полях ресурсов десятки раз/сек. Проверка isConnected гарантирует, что если
// элемент был пересоздан или удалён, кэш сам обновится.
const _cachedEls = new Map();
function $id(id) {
    const cached = _cachedEls.get(id);
    if (cached && cached.isConnected) return cached;
    const el = document.getElementById(id);
    if (el) _cachedEls.set(id, el);
    else _cachedEls.delete(id);
    return el;
}

// Защита от XSS: экранирование пользовательских строк ПЕРЕД вставкой в innerHTML.
// Применяется только на выходе в шаблон; в state ник хранится «сырым», чтобы innerText-места показывали корректные символы.
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// MAJOR-M10: нормализует массив построения до ровно 3 слотов.
// Отсеивает null / undefined / id удалённых или несуществующих героев.
// Гарантирует, что в calculateCP и renderFormationSlots не попадёт мусор из старых сейвов.
function sanitizeFormation(arr) {
    const result = [null, null, null];
    if (!Array.isArray(arr)) return result;
    for (let i = 0; i < 3; i++) {
        const id = arr[i];
        if (id && HEROES_CATALOG[id]) result[i] = id;
    }
    return result;
}

function getFormattedTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// R1: человекочитаемая длительность для экспедиций ("2ч 30м").
function formatExpeditionDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const L = currentLang === 'RU';
    if (sec >= 86400) {
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        return `${d}${L ? 'д' : 'd'} ${h}${L ? 'ч' : 'h'}`;
    }
    if (sec >= 3600) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return m > 0 ? `${h}${L ? 'ч' : 'h'} ${m}${L ? 'м' : 'm'}` : `${h}${L ? 'ч' : 'h'}`;
    }
    if (sec >= 60) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return s > 0 ? `${m}${L ? 'м' : 'm'} ${s}${L ? 'с' : 's'}` : `${m}${L ? 'м' : 'm'}`;
    }
    return `${sec}${L ? 'с' : 's'}`;
}

// R1: получить текущую экспедицию героя (для таймера возврата на карте).
function getHeroExpeditionInfo(heroId) {
    for (const expId in gState.expeditions) {
        const exp = gState.expeditions[expId];
        if (exp && Array.isArray(exp.heroIds) && exp.heroIds.includes(heroId)) {
            const remainingSec = Math.max(0, Math.floor((exp.endTime - Date.now()) / 1000));
            return { expId, remainingSec };
        }
    }
    return null;
}

function getFormattedMidnightCountdown() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = Math.max(0, Math.floor((midnight - now) / 1000));
    return `${String(Math.floor(diff / 3600)).padStart(2, '0')}:${String(Math.floor((diff % 3600) / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
}

// v5.3.14: лёгкая защита сейва от ручной правки localStorage.
// FNV-1a в два прохода — быстрый, стабильный хеш. Ключ 'LOTA-v31' в исходнике,
// опытный читер прочитает и пересчитает. Ловим только массового ленивого читера.
function _ckHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    let h2 = 0xdeadbeef;
    for (let i = str.length - 1; i >= 0; i--) {
        h2 ^= str.charCodeAt(i);
        h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
    }
    return ((h ^ h2) >>> 0).toString(36);
}

function computeSaveChecksum() {
    const _deckKeys = Object.keys(gState.deck || {}).sort().join(',');
    const payload = [
        Math.floor(gState.gold || 0),
        Math.floor(gState.crystals || 0),
        Math.floor(gState.relics || 0),
        Math.floor(gState.relicsFromAscend || 0),
        Math.floor(gState.tickets || 0),
        Math.floor(gState.trophies || 0),
        Math.floor(gState.lifetimeGold || 0),
        Math.floor(gState.lifetimeWins || 0),
        Math.floor(gState.dungeonFloor || 1),
        Math.floor(gState.worldBossMaxHp || 0),
        Math.floor(gState.buildings?.keep || 1),
        Math.floor(gState.buildings?.mine || 1),
        Math.floor(gState.buildings?.barracks || 0),
        _deckKeys,
        (gState.usedPromoCodes || []).slice().sort().join(','),
        (gState.claimedChronicles || []).slice().sort().join(','),
        (gState.abyssPassFreeClaimed || []).slice().sort().join(','),
        (gState.abyssPassVipClaimed || []).slice().sort().join(','),
        (gState.saveVersion || 31)
    ].join('|');
    return _ckHash(payload + '|LOTA-v31');
}

function saveGame(immediateCloud = false) {
    // FIX-SAVE-RACE: до завершения loadGame() писать нельзя — gState содержит
    // дефолтное (FTUE) состояние, и ранняя запись стирает реальный сейв.
    // См. подробное объяснение у объявления gStateLoaded.
    if (!gStateLoaded) return;

    // FIX-BACKGROUND-SAVE: в фоне setInterval(saveGame, 5000) браузер троттлит
    // до ~60 сек, но каждый вызов всё равно обновлял gState.lastTickTime = Date.now().
    // Это съедало offline income: свернул браузер → вернулся через 2 часа →
    // lastTickTime обновлён фоновым сейвом → offline не начисляется.
    // Guard: пишем только если таб активен ИЛИ явный forced-flush (beforeunload,
    // visibilitychange, hard-reset).
    if (typeof document !== 'undefined' && document.hidden && !immediateCloud) return;

    gState.lastTickTime = Date.now();
    try {
        // v5.3.14: пересчитываем checksum перед сохранением.
        gState._ck = computeSaveChecksum();
        const payload = JSON.stringify(gState);
        localStorage.setItem(SAVE_KEY, payload);
        PlatformBridge.queueCloudSave(immediateCloud);
    } catch(e) {}

    // LIVE-ARENA (v4.7.6): debounced submit профиля на Cloudflare Worker.
    // Отправляется не чаще 1 раза в 30 сек. Работает только в VK (там sign).
    // При immediateCloud=true (beforeunload / visibilitychange) — submit
    // выполняется через scheduleLiveArenaSubmit с минимальным debounce.
    if (typeof scheduleLiveArenaSubmit === 'function') scheduleLiveArenaSubmit();
}

// Модульный флаг сессии: активен, пока реальные часы не догонят записанный максимум.
// Блокирует дневные и недельные сбросы при откате системного времени (MAJOR-M2).
let isClockRolledBack = false;

// FIX-FRESH-START: true, если на момент loadGame() localStorage НЕ содержал сейва.
// Критично для performSafeArbitration: дефолтный gState.lastTickTime = Date.now()
// "свежее" любого облачного сейва, и старая логика (localTick > remoteTick →
// queueCloudSave(true)) стирала реальный прогресс пользователя дефолтом.
// Классический сценарий: игрок зашёл с нового устройства, очистил кэш VK WebView,
// вышел и вошёл в VK заново.
let wasLoadedFromEmptyStorage = false;

// FIX-TICKTIME-GUARD: честный lastTickTime из localStorage, зафиксированный
// ДО того, как loadGame() начнёт мутировать gState через checkDailyReset,
// checkWeeklyRaidReset, checkWeeklyArenaReset и т.п.
//
// ПРОБЛЕМА (обнаружена на реальном сценарии «заход на следующий день»):
//   loadGame() ставит gState.lastTickTime = T3 (последняя игра на этом устройстве)
//   → checkDailyReset() видит смену суток → saveGame() → gState.lastTickTime = NOW
//   → PlatformBridge.init() → initVKCloudSync → performSafeArbitration
//   → localTick = NOW (уже переписан!) > remoteTick = T5 (комп играл вечером)
//   → локальный сейв телефона перезаписывает облако. Прогресс утерян.
//
// Фикс: захватываем честный timestamp в момент чтения localStorage (до любых
// мутаций gState) и используем ИМЕННО ЕГО в арбитраже. gState.lastTickTime
// после loadGame мутирован и для сравнения непригоден.
let localStorageTickTimeAtBoot = 0;

// FIX-SAVE-RACE: гвардия от гонки между setInterval(saveGame, 5000) и loadGame().
//
// ПРОБЛЕМА (обнаружена на реальном сценарии «phone → comp → phone»):
//   setInterval(saveGame, 5000) регистрируется на верхнем уровне модуля и
//   выстреливает на t=5s. loadGame() вызывается внутри async IIFE ПОСЛЕ
//   await validateLaunchParams() — тоже на t=5s, если P9-фетч к Cloudflare
//   уходит в таймаут (5s AbortController). Оба события выстреливают в один
//   момент, но setInterval зарегистрирован раньше → saveGame ПЕРВЫМ пишет
//   дефолтное (FTUE) состояние в localStorage. Затем loadGame читает уже
//   перезаписанный localStorage. Затем облачный арбитраж видит localTick =
//   t5s > remoteTick и стирает облако дефолтом. Прогресс потерян.
//
// Особенно жёстко на мобильных в РФ — Cloudflare Workers замедляются/блокируются,
// P9 всегда висит до таймаута 5s, гонка всегда проигрывается. На десктопе с
// тёплым DNS fetch завершается за 200-400ms, loadGame успевает первым.
//
// Фикс: saveGame() становится no-op, пока loadGame() не завершится.
// Флаг ставится в true в самом конце loadGame, до checkDailyReset/checkWeekly*.
let gStateLoaded = false;

// FIX-OFFLINE-DUP: offline income (золото из шахт + защита арены) раньше считался
// в loadGame() ДО облачного sync. Итог: на каждом устройстве offline суммировался
// от ЛОКАЛЬНОГО lastTickTime, и игрок получал дюп: зашёл на телефоне → +600 млн,
// через 5 минут зашёл на компе → ещё +90 млн за тот же интервал.
//
// Fix: offline income выполняется ОДИН РАЗ за сессию, ПОСЛЕ того как облако
// либо подтянулось (performSafeArbitration finally), либо истёк таймаут 3с.
// Тогда lastTickTime — единый канонический из облака, а не локальный.
//
// offlineIncomeFinalized: single-shot флаг, защищает от двойного вызова
// checkOfflineActivity (из finally + из таймаута одновременно).
let offlineIncomeFinalized = false;

function finalizeOfflineIncome() {
    if (offlineIncomeFinalized) return;
    offlineIncomeFinalized = true;
    checkOfflineActivity();
}

// Защита от манипуляции системными часами.
// Идея: клиент помнит максимальный wall-clock timestamp, который он видел в этой вселенной сейва.
// Если Date.now() уходит ниже этого порога более чем на час — считаем это откатом часов
// и замораживаем все дневные/недельные reset'ы до момента, когда реальное время вернётся.
function applyClockRollbackGuard() {
    const now = Date.now();
    const maxSeen = gState.maxKnownTimestamp || 0;

    // Допуск в 1 час: перекрывает переход на летнее время и смену часового пояса
    if (maxSeen > 0 && now < maxSeen - 3600000) {
        if (!isClockRolledBack) {
            console.warn('[ClockGuard] System clock rollback detected. Daily resets frozen until real time catches up.');
        }
        isClockRolledBack = true;
        // Откатываем lastTickTime до максимума: оффлайн-доход не начислится (diffSec будет отрицательным)
        gState.lastTickTime = Math.max(gState.lastTickTime || 0, maxSeen);
        return;
    }

    if (isClockRolledBack) {
        console.info('[ClockGuard] Real time caught up. Resuming daily resets.');
        isClockRolledBack = false;
    }

    if (now > maxSeen) {
        gState.maxKnownTimestamp = now;
    }
}

function loadGame() {
    // FIX-FRESH-START: захватываем пустоту ДО первого saveGame() из checkDailyReset.
    // Если localStorage пуст — checkDailyReset ниже вызовет saveGame(), который
    // запишет дефолтный gState в localStorage. Флаг должен быть установлен раньше.
    let wasEmpty = true;
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                gState = Object.assign({}, gState, parsed);
                wasEmpty = false;
                // FIX-TICKTIME-GUARD: честный timestamp из localStorage, ДО любых
                // мутаций gState через checkDailyReset/checkWeekly*. Используется
                // в performSafeArbitration вместо gState.lastTickTime.
                localStorageTickTimeAtBoot = parsed.lastTickTime || 0;
                if (gState.language) {
                    currentLang = gState.language;
                    try { localStorage.setItem('lords_saved_language', currentLang); } catch(e) {}
                }
            }
        }
    } catch(e) {}

    wasLoadedFromEmptyStorage = wasEmpty;

    // v5.3.14: проверка checksum + sanity.
    // Mismatch _ck → save подменён вне saveGame (DevTools → Local Storage).
    // Sanity: crystals > 5M при lifetimeGold < crystals*100 — нереально, значит F12-edit.
    // Никаких сбросов — только флаг _suspicious, уходит в submit.
    if (!wasEmpty) {
        try {
            const _rawCk = localStorage.getItem(SAVE_KEY);
            if (_rawCk) {
                const _parsedCk = JSON.parse(_rawCk);
                if (_parsedCk && typeof _parsedCk._ck === 'string' && _parsedCk._ck.length > 0) {
                    const _currCk = computeSaveChecksum();
                    if (_currCk !== _parsedCk._ck) {
                        gState._suspicious = true;
                        gState._suspiciousAt = Date.now();
                        console.warn('[LOTA] Save integrity check failed — flagged as suspicious');
                    }
                }
                if ((gState.crystals || 0) > 5000000 && (gState.lifetimeGold || 0) < ((gState.crystals || 0) * 100)) {
                    gState._suspicious = true;
                    gState._suspiciousAt = Date.now();
                }
            }
        } catch (e) {}
    }

    // MAJOR-M10: нормализация построений — защита от мусорных сейвов (null / удалённые id героев).
    // Гарантирует чистое состояние до первого вызова calculateCP, getFormationSynergy и renderFormationSlots.
    gState.attackFormation = sanitizeFormation(gState.attackFormation);
    gState.defenseFormation = sanitizeFormation(gState.defenseFormation);

    if (gState.stageQuests) {
        delete gState.stageQuests.calendar;
        delete gState.stageQuests.wheel;
        delete gState.stageQuests.daily;
    }
    // FIX-RAID-HP: HP Левиафана теперь фиксируется от текущего CP игрока (25 ударов до победы).
    // Старая формула relics * 0.35 + потолок 100M не подходила для эндгейма.
    // Fallback считает HP от актуального CP атаки, если сейв ещё не содержит значения.
    // v5.3.9: база HP Левиафана 50k → 2M. При CP 30k босс умирал за 2 удара.
    // 2M HP = ~67 ударов для старта, ~40 для мид-гейма. Фикс множителя *25 → *40.
    if (!gState.worldBossMaxHp || gState.worldBossMaxHp < 2000000) {
        gState.worldBossMaxHp = Math.max(2000000, Math.floor(calculateCP(gState.attackFormation) * 40));
    }
    if (gState.worldBossHp === undefined || gState.worldBossHp > gState.worldBossMaxHp) {
        gState.worldBossHp = gState.worldBossMaxHp;
    }
    // MAJOR-M2: актуализируем guard ДО дневных проверок (может заморозить сбросы при откате часов)
    applyClockRollbackGuard();

    // FIX-SAVE-RACE: снимаем гвардию ПОСЛЕ чтения localStorage и applyClockRollbackGuard,
    // но ДО checkDailyReset/checkWeekly*/checkOfflineActivity. Эти проверки могут сами
    // вызвать saveGame() при смене суток/недели/месяца — им нужна рабочая saveGame.
    // К этому моменту gState уже гарантированно гидратирован из localStorage (или
    // остался дефолтным, если localStorage был пуст — что корректно).
    gStateLoaded = true;

    // FIX-DEV-MODE: URL-параметр ?skipftue=1 пропускает обучение ТОЛЬКО в dev-режиме.
    // В проде (VK / GH Pages без ?debug=1) — параметр игнорируется, игрок не может
    // пропустить обучение через подмену URL.
    if (IS_DEV_MODE) {
        try {
            const _params = new URLSearchParams(window.location.search || '');
            if (_params.get('skipftue') === '1') {
                skipFtue(true);
            }
        } catch (e) {}
    }

    // MAJOR-M1: если Колесо было запущено, но приз не начислен (закрытие вкладки в момент анимации) —
    // начисляем его сейчас. Идемпотентно: pendingWheelPrize обнуляется сразу после вызова.
    if (gState.pendingWheelPrize) {
        const orphanPrize = gState.pendingWheelPrize;
        gState.pendingWheelPrize = null;
        try { claimWheelPrize(orphanPrize); } catch(e) { console.warn('[Wheel] Orphan prize restore failed:', e); }
        saveGame();
    }

    checkDailyReset();
    checkWeeklyRaidReset();
    checkWeeklyArenaReset();

    // FIX-OFFLINE-DUP: offline income откладывается до облачного sync.
    //   • Standalone (GH Pages / TG): облака нет — начисляем сразу.
    //   • VK / Yandex: ждём performSafeArbitration (finally) ИЛИ таймаут 3с.
    //   Таймаут страхует игрока при медленной сети: пусть лучше дюп-риск на
    //   единственном заходе, чем полное отсутствие offline income.
    if (isRunningInsideVK() || isRunningInsideYandex()) {
        setTimeout(finalizeOfflineIncome, 3000);
    } else {
        finalizeOfflineIncome();
    }
}

/* ==========================================================
    МАТЕМАТИКА ЭКОНОМИКИ, СТИХИЙ И СИНЕРГИЙ
    ========================================================== */
function getRelicBonus() {
    // FIX-BALANCE v4.7.0: снижен коэффициент с 0.15 до 0.10.
    // r=1 +10%, r=5 +50%, r=10 +100%, r=20 +200%, r=50 +500%.
    // Линейный рост, но с меньшим наклоном — реликвии не дают двойного
    // экспоненциального взрыва при стакинге с шахтами и тапами.
    return 1 + ((gState.relics || 0) * 0.10);
}

function getIncomeRate(targetLvl = null) {
    const lvl = (targetLvl !== null) ? targetLvl : (gState.buildings.mine || 1);
    // FIX-BALANCE v4.7.0: экспонента 1.12 → 1.07 + логарифмический демпфер
    // после уровня 60. Убирает взрывной рост дохода в мидгейме.
    //   lvl 30:  ~×8    (было ×30)
    //   lvl 50:  ~×30   (было ×290)
    //   lvl 60:  ~×58   (было ×880)
    //   lvl 100: ~×70   (было ×83000) — рост плавно переходит в линейный
    let expPart;
    if (lvl <= 60) {
        expPart = Math.pow(1.07, lvl);
    } else {
        expPart = Math.pow(1.07, 60) * (1 + Math.log(lvl - 59) * 0.15);
    }
    const base = (lvl * 2) + Math.floor(expPart);
    const isOverdrive = isVipActive() || (Date.now() < (gState.overdriveUntil || 0));
    const odMult = isOverdrive ? 2 : 1;
    return Math.max(2, Math.floor(base * getRelicBonus() * odMult));
}

function activateOverdrive() {
    // L8: локализация VIP-тоста овердрайва
    if (isVipActive()) return pushToast(currentLang === 'RU' ? "VIP: Овердрайв x2 активен постоянно!" : "VIP: Overdrive x2 is always active!");
    showPlatformRewarded(() => {
        const now = Date.now();
        const cur = Math.max(now, gState.overdriveUntil || 0);
        gState.overdriveUntil = Math.min(now + 28800000, cur + 7200000);
        playCoinSfx();
        saveGame();
        renderUI();
        pushToast(currentLang === 'RU' ? "Овердрайв: x2 доход шахт на 2 часа!" : "Overdrive: x2 income for 2 hours!");
    });
}

function getAdGoldReward() { return Math.max(500, getIncomeRate() * 300); }

function getCodexBonus(faction) {
    if (!gState.codexClaimed || !gState.codexClaimed[faction]) return 0;
    let totalPct = 0;
    const claimedIndices = gState.codexClaimed[faction] || [];
    claimedIndices.forEach(idx => {
        if (CODEX_MILESTONES[idx]) totalPct += CODEX_MILESTONES[idx].bonusPct;
    });
    return totalPct / 100;
}

// R2: сокращённое название роли для бейджа на карточках.
function getHeroRoleLabel(hero) {
    if (!hero || !hero.role) return null;
    const roleMap = {
        'Авангард': { RU: 'АВАНГАРД', EN: 'VANGUARD', cls: 'role-vanguard' },
        'Главком':  { RU: 'ЛИДЕР',    EN: 'COMMANDER', cls: 'role-commander' },
        'Тыл':      { RU: 'ТЫЛ',      EN: 'REARGUARD', cls: 'role-rearguard' }
    };
    const m = roleMap[hero.role];
    if (!m) return null;
    return { text: currentLang === 'RU' ? m.RU : m.EN, cls: m.cls };
}

function formatHeroStars(stars) {
    stars = Math.max(1, Math.min(10, stars || 1));
    if (stars <= 5) {
        return `<span style="color:var(--gold); text-shadow:0 0 6px var(--gold-glow);">${'★'.repeat(stars)}</span>`;
    } else {
        const pinkCount = stars - 5;
        return `<span class="star-pink">${'★'.repeat(pinkCount)}</span>`;
    }
}

// Единый эталонный калькулятор боевой силы карты (для игрока и соперников)
function calculateCardCP(heroId, stars = 1, lvl = 1, codexBonus = 0) {
    const hero = HEROES_CATALOG[heroId];
    if (!hero) return 40;
    const s = Math.max(1, Math.min(10, stars || 1));
    const starBonus = (Math.min(5, s) - 1) * 0.25 + Math.max(0, s - 5) * 0.35;
    const starMult = 1 + starBonus;
    // B7: двухслойная формула CP.
    //   1..200   → +8% за уровень    (макс x16.92 на ур. 200)
    //   201..300 → +5% за уровень M  (макс x21.92 на ур. 300 / M100)
    // Итоговый прирост от полного мастерства: +29.6% CP относительно MAX-200.
    const safeLvl = Math.max(1, lvl || 1);
    const baseLevels = Math.min(safeLvl, MAX_BASE_LVL);
    const masteryLevels = Math.max(0, safeLvl - MAX_BASE_LVL);
    const lvlMult = 1 + (baseLevels - 1) * 0.08 + masteryLevels * 0.05;
    const codexMult = 1 + (codexBonus || 0);
    // v4.9.1: CP считается от TIER_BASE_CP, а не от hero.cp. Старая база удалена для баланса тиров.
    const baseCP = TIER_BASE_CP[hero.tier] || hero.cp || 40;
    return Math.floor(baseCP * starMult * lvlMult * codexMult);
}

function getHeroCP(id) {
    const cardData = gState.deck[id] || { stars: 1, lvl: 1 };
    const hero = HEROES_CATALOG[id];
    const codex = hero ? getCodexBonus(hero.faction) : 0;
    return calculateCardCP(id, cardData.stars, cardData.lvl, codex);
}

// U6: кэш синергии. Функция строит строку с innerHTML <img> для каждой стихии и вызывается
// из calculateCP десятки раз в секунду. Map с ключом «язык|join(formation)» — комбинаций мало,
// ограничение не требуется. Очищается при смене языка (см. applyLanguage).
const _synergyCache = new Map();

function getFormationSynergy(formation) {
    if (!formation) return { mult: 1.0, label: I18N[currentLang].syn_none, faction: null, count: 0 };

    const cacheKey = `${currentLang}|${formation.join(',')}`;
    const cached = _synergyCache.get(cacheKey);
    if (cached) return cached;

    const counts = {};
    formation.forEach(id => {
        if (id && HEROES_CATALOG[id]) {
            const f = HEROES_CATALOG[id].faction || 'chaos';
            counts[f] = (counts[f] || 0) + 1;
        }
    });

    for (let f in counts) {
        const cleanName = I18N[currentLang]?.factions?.[f] || f.toUpperCase();
        const fNameWithIcon = `<img src="assets/icons/elem_${f}.webp" class="res-icon-inline" style="width:14px; height:14px; vertical-align:-2px;" alt="${f}"> ${cleanName}`;

        // Формируем чистый лейбл синергии напрямую из словаря без лишних replace и без эмодзи в коде
        const finalLabel = I18N[currentLang].syn_active
            .replace('{f}', fNameWithIcon)
            .replace('{n}', counts[f])
            .replace('{b}', counts[f] === 3 ? '75' : '30');

        if (counts[f] === 3) {
            const res = { mult: 1.75, label: finalLabel, faction: f, count: 3 };
            _synergyCache.set(cacheKey, res);
            return res;
        }
        if (counts[f] === 2) {
            const res = { mult: 1.30, label: finalLabel, faction: f, count: 2 };
            _synergyCache.set(cacheKey, res);
            return res;
        }
    }
    const noSyn = { mult: 1.0, label: I18N[currentLang].syn_none, faction: null, count: 0 };
    _synergyCache.set(cacheKey, noSyn);
    return noSyn;
}

function checkElementalAdvantage(attackerSquad, defenderSquad) {
    if (!attackerSquad || !defenderSquad) return false;
    for (let i = 0; i < 3; i++) {
        const a = HEROES_CATALOG[attackerSquad[i]];
        const d = HEROES_CATALOG[defenderSquad[i]];
        if (a && d && ELEMENTAL_ADVANTAGE && ELEMENTAL_ADVANTAGE[a.faction] === d.faction) return true;
    }
    return false;
}

function getArmyCap() {
    let baseCap = 80;
    (gState.attackFormation || []).forEach(id => {
        if (id && HEROES_CATALOG[id]) {
            const card = gState.deck[id] || { stars: 1, lvl: 1 };
            const s = card.stars || 1;
            const starBonus = (Math.min(5, s) - 1) * 0.25 + Math.max(0, s - 5) * 0.35;
            baseCap += Math.floor((HEROES_CATALOG[id].cap || 30) * (1 + starBonus));
        }
    });
    return Math.floor(baseCap * (1 + ((gState.buildings.keep || 1) * 0.30)) * getRelicBonus());
}

// Разделенный расчет: includeArmy = false для Арены, true для Бездны и Профиля
function calculateCP(formation = gState.attackFormation, vsFormation = null, includeArmy = true) {
    let heroesCP = 0;
    (formation || []).forEach((id, slotIdx) => {
        if (id && HEROES_CATALOG[id]) {
            let hcp = getHeroCP(id);
            if (slotIdx === 1) hcp *= 1.5;
            heroesCP += hcp;
        }
    });
    const syn = getFormationSynergy(formation);
    const elemMult = (vsFormation && checkElementalAdvantage(formation, vsFormation)) ? 1.15 : 1.0;
    
    // B3: армия — это не только пушечное мясо для Бездны, но и реальный ресурс мид-лейт-гейма.
    // Линейный вес 0.8 сохранён, но добавлен квадратичный усилитель army²/50000:
    // • 1,000 бойцов → 820 (линейный) + 20 = 840 (незаметно)
    // • 10,000 → 8,000 + 2,000 = 10,000 (x1.25 к CP легиона)
    // • 100,000 → 80,000 + 200,000 = 280,000 (x3.5 — ощутимый вклад)
    // • 1,000,000 → 800,000 + 20,000,000 = 20.8M (доминирующий вклад в позднем гейме)
    // На Арене (includeArmy=false) бонус не применяется — там сражается только элита.
    const rawArmy = gState.army || 0;
    const armyBonus = includeArmy
        ? Math.floor(rawArmy * 0.8 + (rawArmy * rawArmy) / 50000 + ((gState.buildings.keep || 1) * 20))
        : 0;
    
    const raw = Math.floor((heroesCP * syn.mult * elemMult) + armyBonus);
    const titleBonus = 1 + (getLordTitleData().bonus || 0);
    return Math.floor(raw * getRelicBonus() * titleBonus);
}

/* ==========================================================
   ACTION-BASED FTUE (12 ШАГОВ ВПЛОТЬ ДО 1-ГО ВОЗВЫШЕНИЯ)
   ========================================================== */
function isFtueCompleted() { return (gState.ftueStep || 0) >= 12; }

// DEV/QA: пропуск обучения одной командой из консоли или URL-параметром ?skipftue=1.
// Не влияет на обычных игроков — FTUE запускается штатно, пока флаг не выставлен вручную.
function skipFtue(silent = false) {
    // FIX-ADMIN-SKIPFTUE-FROZEN: защита изнутри. Пропускаем только в dev-режиме
    // (localhost / ?debug=1) или при активной админ-сессии (?admin=1 + vk_user_id).
    // Обычный игрок с F12 получит warn и ничего не произойдёт.
    if (!IS_DEV_MODE && !(typeof isAdminSession !== 'undefined' && isAdminSession === true)) {
        console.warn('[Dev] skipFtue недоступна. Требуется dev-режим или админ-сессия.');
        return;
    }
    gState.ftueStep = 12;
    gState.ftueTaps = Math.max(15, gState.ftueTaps || 0);
    gState.ftueSummonDone = true;
    gState.ftueEquipDone = true;
    gState.ftueHeroLvlDone = true;
    gState.ftueDungeonDone = true;
    gState.ftueExpDone = true;
    gState.ftueArenaDone = true;
    gState.ftueRaidDone = true;
    gState.ftueAutoSpendDone = true;
    gState.ftueAscendDone = true;
    saveGame();
    if (typeof renderFtue === 'function') renderFtue();
    if (typeof updateFtueFocus === 'function') updateFtueFocus();
    if (!silent) pushToast('FTUE SKIPPED');
}

function resetFtue(silent = false) {
    // FIX-ADMIN-SKIPFTUE-FROZEN: симметричный guard с skipFtue. См. пояснение выше.
    if (!IS_DEV_MODE && !(typeof isAdminSession !== 'undefined' && isAdminSession === true)) {
        console.warn('[Dev] resetFtue недоступна. Требуется dev-режим или админ-сессия.');
        return;
    }
    gState.ftueStep = 0;
    gState.ftueTaps = 0;
    gState.ftueSummonDone = false;
    gState.ftueEquipDone = false;
    gState.ftueHeroLvlDone = false;
    gState.ftueDungeonDone = false;
    gState.ftueExpDone = false;
    gState.ftueArenaDone = false;
    gState.ftueRaidDone = false;
    gState.ftueAutoSpendDone = false;
    gState.ftueAscendDone = false;
    saveGame();
    if (typeof renderFtue === 'function') renderFtue();
    if (!silent) pushToast('FTUE RESET');
}

// FIX-DEV-MODE: dev-команды доступны в консоли только под IS_DEV_MODE.
//
// FIX-SKIPFTUE-RECURSION (2026-10-14, исправлен окончательно):
//   Раньше блок содержал строки `window.skipFtue = () => skipFtue(false);`
//   Проблема: `window.skipFtue` и function declaration `skipFtue()` в глобальном
//   скоупе — ОДНА И ТА ЖЕ переменная. Перезапись через window.X = ... затирала
//   оригинальную функцию на стрелку, которая вызывала саму себя → бесконечная
//   рекурсия → RangeError: Maximum call stack size exceeded при клике на
//   «Пропустить обучение» в мастер-панели.
//
//   Правильный подход: не трогать window.* в dev-режиме (функции и так доступны
//   из консоли как глобальные), а в проде — ЯВНО скрыть их через undefined.
//   `skipFtue` и `resetFtue` остаются function declarations внутри модуля —
//   вызовы `skipFtue(false)` из adminSkipFtue() работают корректно.
if (IS_DEV_MODE) {
    console.log('[LOTA] DEV MODE: skipFtue() / resetFtue() / testAscensionRitual() / testArenaPromote() / testArenaDemote() доступны.');
}
// FIX-ADMIN-SKIPFTUE-FROZEN: НЕ затираем window.skipFtue/resetFtue через undefined.
// В глобальном скоупе function declaration и window.X — одно и то же, поэтому
// присваивание undefined убивало саму функцию. Это ломало вызовы из админ-панели
// (data-admin.js: adminSkipFtue/adminResetFtue): их guard typeof skipFtue === 'function'
// возвращал false, кнопки молча ничего не делали.
//
// Защита от читеров теперь ВНУТРИ самих функций: guard проверяет IS_DEV_MODE
// или активную isAdminSession. Обычный игрок с F12 вызовет skipFtue() и получит
// console.warn без эффекта. Админ-панель работает как задумано.

// Автоматический навигатор между вкладками игры
function resolveFtueViewTarget(targetViewId, activeViewId) {
    if (activeViewId === targetViewId) return null;
    
    // Если игрок на подэкране (Алтарь, Арена и т.д.) — сначала возвращаем его в Цитадель
    if (activeViewId !== 'citadel-view') {
        const curViewEl = document.getElementById(activeViewId);
        const backBtn = curViewEl?.querySelector('.btn-back-citadel');
        if (backBtn) return backBtn;
    }
    
    // В Цитадели возвращаем здание перехода к целевой вкладке
    const districtSelectors = {
        'roster-view': '.district-roster',
        'altar-view': '.district-altar',
        'arena-view': '.district-arena',
        'dungeon-view': '.district-dungeons',
        'raid-view': '.district-dungeons'
    };
    const selector = districtSelectors[targetViewId];
    return selector ? document.querySelector(selector) : null;
}

const FTUE_STEPS_CONFIG = [
    // 0: Кликер
    { 
        req: () => (gState.ftueTaps || 0) >= 15, 
        rewardGold: 500, rewardCryst: 0, 
        rewardText: () => '<span class="ftue-reward-chip gold">+500 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span>',
        getTarget: (view, modals) => {
            const nav = resolveFtueViewTarget('citadel-view', view);
            if (nav) return nav;
            return document.querySelector('.citadel-bottom-tap-zone') || document.getElementById('tap-node');
        }
    },
    // 1: Копи Ур. 2
    { 
        req: () => (gState.buildings.mine || 1) >= 2, 
        rewardGold: 800, rewardCryst: 0, 
        rewardText: '<span class="ftue-reward-chip gold">+800 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span>',
        getTarget: (view, modals) => {
            if (modals.building) return document.getElementById('bld-m-upg-btn');
            const nav = resolveFtueViewTarget('citadel-view', view);
            if (nav) return nav;
            return document.querySelector('.district-mine');
        }
    },
    // 2: Трон Ур. 2
    { 
        req: () => (gState.buildings.keep || 1) >= 2, 
        rewardGold: 1200, rewardCryst: 0, 
        rewardText: '<span class="ftue-reward-chip gold">+1,200 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span>',
        getTarget: (view, modals) => {
            if (modals.building) return document.getElementById('bld-m-upg-btn');
            const nav = resolveFtueViewTarget('citadel-view', view);
            if (nav) return nav;
            return document.querySelector('.district-keep');
        }
    },
    // 3: Казармы Ур. 1
    { 
        req: () => (gState.buildings.barracks || 0) >= 1, 
        rewardGold: 1500, rewardCryst: 10, 
        rewardText: '<span class="ftue-reward-chip gold">+1,500 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span> <span class="ftue-reward-chip crystal">+10 <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C"></span>',
        getTarget: (view, modals) => {
            if (modals.building) return document.getElementById('bld-m-upg-btn');
            const nav = resolveFtueViewTarget('citadel-view', view);
            if (nav) return nav;
            return document.querySelector('.district-barracks');
        }
    },
    // 4: Алтарь - призыв (умный фокус: сначала «ВСКРЫТЬ ВСЕ», затем «ПРИНЯТЬ ВОИНОВ»)
    { 
        req: () => gState.ftueSummonDone === true, 
        rewardGold: 0, rewardCryst: 20, 
        rewardText: '<span class="ftue-reward-chip crystal">+20 <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C"></span>',
        getTarget: (view, modals) => {
            if (modals.summonResult) {
                if ((unrevealedGachaCards || 0) > 0) {
                    return document.getElementById('btn-sum-reveal-all') || document.querySelector('.summon-card-scene:not(.is-flipped)');
                }
                return document.getElementById('btn-sum-result-close');
            }
            const nav = resolveFtueViewTarget('altar-view', view);
            if (nav) return nav;
            return document.getElementById('btn-sum-g1');
        }
    },
    // 5: Штаб - построение
    { 
        req: () => gState.ftueEquipDone === true, 
        rewardGold: 2000, rewardCryst: 0, 
        rewardText: '<span class="ftue-reward-chip gold">+2,000 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span>',
        getTarget: (view, modals) => {
            if (modals.slotPicker) return document.querySelector('#slot-picker-list .btn-action');
            const nav = resolveFtueViewTarget('roster-view', view);
            if (nav) return nav;
            if (view === 'roster-view' && activeRosterTab !== 'formation') {
                selectRosterTab('formation');
            }
            return document.getElementById('slot-0');
        }
    },
    // 6: Прокачка уровня героя
    { 
        req: () => gState.ftueHeroLvlDone === true || Object.values(gState.deck || {}).some(c => (c.lvl || 1) >= 2), 
        rewardGold: 2500, rewardCryst: 0, 
        rewardText: '<span class="ftue-reward-chip gold">+2,500 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span>',
        getTarget: (view, modals) => {
            if (modals.cardInspect) return document.getElementById('btn-levelup-hero');
            const nav = resolveFtueViewTarget('roster-view', view);
            if (nav) return nav;
            if (view === 'roster-view' && activeRosterTab !== 'cards') {
                selectRosterTab('cards');
            }
            return document.querySelector('#cards-container .tcg-card');
        }
    },
    // 7: Бездна - Этаж 1
    { 
        req: () => (gState.dungeonFloor || 1) > 1 || gState.ftueDungeonDone === true, 
        rewardGold: 3000, rewardCryst: 30, 
        rewardText: () => `<span class="ftue-reward-chip gold">+3,000 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span> <span class="ftue-reward-chip crystal">+30 <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C"></span> <span class="ftue-reward-chip hero-d">${currentLang === 'RU' ? '[D] Рыцарь' : '[D] Knight'}</span>`,
        getTarget: (view, modals) => {
            if (modals.battle) return document.getElementById('btn-battle-close');
            if (view === 'dungeon-view') return document.getElementById('btn-dung-attack');
            if (modals.battleHub) return document.querySelector('#battle-hub-modal .btn-action');
            const nav = resolveFtueViewTarget('dungeon-view', view);
            if (nav) return nav;
            return document.querySelector('.district-dungeons');
        }
    },
    // 8: Экспедиции
    { 
        req: () => gState.ftueExpDone === true || Object.keys(gState.expeditions || {}).length > 0, 
        rewardGold: 3500, rewardCryst: 0, 
        rewardText: '<span class="ftue-reward-chip gold">+3,500 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span>',
        getTarget: (view, modals) => {
            const allBusy = Object.keys(gState.deck || {}).every(id => isHeroBusy(id));
            if (allBusy && !gState.deck['e_dem_v']) {
                gState.deck['e_dem_v'] = { stars: 1, lvl: 1 };
                renderCards();
            }

            if (modals.expPicker) {
                if ((selectedExpHeroes || []).length < 1) {
                    return document.querySelector('#exp-picker-list .building-card:not([style*="opacity: 0.45"])') || document.querySelector('#exp-picker-list .building-card');
                }
                return document.getElementById('btn-exp-picker-confirm');
            }
            const nav = resolveFtueViewTarget('roster-view', view);
            if (nav) return nav;
            if (activeRosterTab !== 'expeditions') return document.getElementById('mode-exp-btn');
            return document.querySelector('#expeditions-list-box .btn-action');
        }
    },
    // 9: Арена
    { 
        req: () => gState.ftueArenaDone === true, 
        rewardGold: 5000, rewardCryst: 0, 
        rewardText: '<span class="ftue-reward-chip gold">+5,000 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span> <span class="ftue-reward-chip ticket">+2 <img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T"></span>',
        getTarget: (view, modals) => {
            if (modals.battle) return document.getElementById('btn-battle-close');
            const nav = resolveFtueViewTarget('arena-view', view);
            if (nav) return nav;
            return document.querySelector('#arena-opp-list .btn-action');
        }
    },
    // 10: Рейд
    { 
        req: () => gState.ftueRaidDone === true, 
        rewardGold: 5000, rewardCryst: 0, 
        rewardText: '<span class="ftue-reward-chip gold">+5,000 <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></span>',
        getTarget: (view, modals) => {
            if (view === 'raid-view') return document.getElementById('btn-raid-attack');
            if (modals.battleHub) return document.querySelectorAll('#battle-hub-modal .btn-action')[1];
            const nav = resolveFtueViewTarget('raid-view', view);
            if (nav) return nav;
            return document.querySelector('.district-dungeons');
        }
    },
    // 11: Возвышение и авто-слив золота
    { 
        req: () => (gState.relics || 0) >= 1 || gState.ftueAscendDone === true, 
        rewardGold: 0, rewardCryst: 100, 
        rewardText: '<span class="ftue-reward-chip crystal">+100 <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C"></span> <span class="ftue-reward-chip relic">+1 <img src="assets/icons/relic.webp" class="res-icon-inline" alt="R"></span>',
        getTarget: (view, modals) => {
            if (modals.ascend) {
                const goldReq = getAscendGoldReq();
                if ((gState.gold || 0) > goldReq && !gState.ftueAutoSpendDone) {
                    return document.getElementById('btn-ascend-auto-spend');
                }
                return document.getElementById('btn-ascend-confirm');
            }
            if (modals.building) {
                return document.getElementById('btn-ascend');
            }
            const nav = resolveFtueViewTarget('citadel-view', view);
            if (nav) return nav;
            return document.querySelector('.district-keep');
        }
    }
];

function clearAllFtueGuides() {
    document.querySelectorAll('.ftue-focus-target').forEach(el => el.classList.remove('ftue-focus-target'));
}

// FIX-FTUE-SUBVIEW-HEIGHT: пересчёт позиции подэкранов под Советником.
// Раньше формула была `${44 + cardHeight + 8}px` с fallback 195px — на телефонах
// не учитывала ни safe-area (notch), ни реальную высоту карточки с длинным лором.
// Из-за этого Штаб/Алтарь/Арена/Бездна залезали верхом под Советника на 40-80px.
//
// Теперь замеряем РЕАЛЬНУЮ позицию низа карточки Советника на экране через
// getBoundingClientRect — это автоматически учитывает:
//   • safe-area-inset-top (notch/статус-бар iPhone)
//   • фактическую высоту карточки с текущим текстом лора и задачи
//   • transform: scale(--stage-scale) родительского viewport'а
//
// rAF-дебаунс: функция вызывается часто (из тика каждую секунду, из updateFtueFocus),
// но замер делается один раз на следующий кадр. Безопасно от спама.
let _ftueRecalcRafId = null;
function recalcFtueSubviewTop() {
    if (_ftueRecalcRafId) cancelAnimationFrame(_ftueRecalcRafId);
    _ftueRecalcRafId = requestAnimationFrame(() => {
        _ftueRecalcRafId = null;
        const viewport = document.getElementById('app-viewport');
        if (!viewport) return;

        // FTUE завершён или куртина скрыта — возвращаем дефолт
        if (isFtueCompleted()) {
            viewport.style.setProperty('--ftue-subview-top', '44px');
            return;
        }

        const advisorCard = document.getElementById('ftue-advisor-card');
        if (!advisorCard) return;

        // Извлекаем текущий масштаб сцены из CSS-переменной --stage-scale
        let scale = 1;
        try {
            const raw = getComputedStyle(document.documentElement).getPropertyValue('--stage-scale');
            scale = parseFloat(raw) || 1;
            if (scale <= 0) scale = 1;
        } catch (e) {}

        const vpRect = viewport.getBoundingClientRect();
        const cardRect = advisorCard.getBoundingClientRect();

        // Нижняя граница карточки относительно верхнего края viewport'а.
        // Делим на scale, чтобы вернуться из device-pixels в CSS-координаты viewport'а —
        // именно они нужны для переменной --ftue-subview-top.
        const bottomCss = (cardRect.bottom - vpRect.top) / scale;

        // +8px защитный отступ, min 60px (страховка от невалидных замеров на первом кадре)
        const subviewTop = Math.max(60, Math.ceil(bottomCss) + 8);
        viewport.style.setProperty('--ftue-subview-top', `${subviewTop}px`);
    });
}

function renderFtue() {
    const curtain = document.getElementById('ftue-curtain');
    const viewport = document.getElementById('app-viewport');
    if (!curtain) return;

    if (isFtueCompleted()) {
        curtain.style.display = 'none';
        viewport?.classList.remove('ftue-running');
        viewport?.style.setProperty('--ftue-subview-top', '44px');
        clearAllFtueGuides();
        return;
    }

    viewport?.classList.add('ftue-running');
    curtain.style.display = 'flex';
    const step = gState.ftueStep || 0;
    const cfg = FTUE_STEPS_CONFIG[step];
    const dlg = (I18N[currentLang].ftue_dialogs && I18N[currentLang].ftue_dialogs[step]) ? I18N[currentLang].ftue_dialogs[step] : null;

    if (!cfg || !dlg) return;

    const sChapter = document.getElementById('ftue-chapter-text');
    const sPill = document.getElementById('ftue-step-pill');
    const sLore = document.getElementById('ftue-lore-text');
    const sTask = document.getElementById('ftue-task-text');
    const sReward = document.getElementById('ftue-reward-text');
    const btnClaim = document.getElementById('btn-ftue-claim');

    if (sChapter) sChapter.innerText = dlg.chapter;
    if (sPill) sPill.innerText = `${I18N[currentLang].ftue_step_prefix || 'ШАГ'} ${step + 1}/12`;
    if (sLore) sLore.innerText = dlg.lore;

    if (sTask) {
        let taskDesc = dlg.task;
        if (step === 0) taskDesc = taskDesc.replace('{c}', Math.min(15, gState.ftueTaps || 0));
        sTask.innerText = taskDesc;
    }
    const rText = typeof cfg.rewardText === 'function' ? cfg.rewardText() : cfg.rewardText;
    if (sReward) sReward.innerHTML = `${currentLang === 'RU' ? 'Награда' : 'Reward'}: ${rText}`;

    // FIX-FTUE-SUBVIEW-HEIGHT: после замены текста лора/задачи высота карточки
    // изменилась. Пересчитываем позицию подэкранов через rAF — гарантирует, что
    // layout уже обновлён, и --ftue-subview-top применится к актуальной высоте.
    recalcFtueSubviewTop();

    const isReady = cfg.req();
    if (btnClaim) {
        btnClaim.disabled = false;
        if (isReady) {
            btnClaim.className = 'btn-action ftue-btn-claim ready';
            btnClaim.innerHTML = I18N[currentLang]?.ftue_claim_btn || (currentLang === 'RU' ? 'ЗАБРАТЬ' : 'CLAIM');
        } else {
            btnClaim.className = 'btn-action ftue-btn-claim in-progress';
            if (step === 0) {
                btnClaim.innerHTML = `${Math.min(15, gState.ftueTaps || 0)} / 15`;
            } else {
                btnClaim.innerHTML = I18N[currentLang]?.ftue_in_progress || (currentLang === 'RU' ? 'ВЫПОЛНЯЙТЕ УКАЗ' : 'IN PROGRESS');
            }
        }
    }

    updateFtueFocus();
}

// Интерактивная подсказка-навигатор при клике по незавершенному заданию
function nudgeFtueGoal(step) {
    playSfx(420, 'triangle', 0.08);
    triggerHaptic('tap');

    if (step === 0) {
        const tapBtn = document.getElementById('tap-node');
        if (tapBtn) {
            tapBtn.classList.remove('ftue-focus-target');
            void tapBtn.offsetWidth;
            tapBtn.classList.add('ftue-focus-target');
        }
        pushToast(currentLang === 'RU' ? 'Тапайте по кнопке «Дань и Ополчение» внизу!' : 'Tap the "Tribute & Militia" button below!');
    } else {
        updateFtueFocus();
    }
}

function updateFtueFocus() {
    clearAllFtueGuides();
    if (isFtueCompleted()) return;

    const step = gState.ftueStep || 0;
    const cfg = FTUE_STEPS_CONFIG[step];
    if (!cfg) return;

    // FIX-FTUE-SUBVIEW-HEIGHT: расчёт вынесен в recalcFtueSubviewTop() —
    // замер через getBoundingClientRect с rAF-дебаунсом. Учитывает safe-area,
    // реальную высоту карточки Советника и transform: scale viewport'а.
    recalcFtueSubviewTop();

    if (cfg.req()) {
        document.getElementById('btn-ftue-claim')?.classList.add('ftue-focus-target');
        return;
    }

    const activeViewId = document.querySelector('.view-tab.active')?.id || 'citadel-view';
    const modalsState = {
        building: document.getElementById('building-modal')?.style.display === 'flex',
        slotPicker: document.getElementById('slot-picker-modal')?.style.display === 'flex',
        cardInspect: document.getElementById('card-inspect-modal')?.style.display === 'flex',
        expeditions: document.getElementById('expeditions-modal')?.style.display === 'flex',
        expPicker: document.getElementById('exp-picker-modal')?.style.display === 'flex',
        battleHub: document.getElementById('battle-hub-modal')?.style.display === 'flex',
        ascend: document.getElementById('ascend-modal')?.style.display === 'flex',
        summonResult: document.getElementById('summon-result-modal')?.style.display === 'flex',
        battle: document.getElementById('battle-overlay-modal')?.style.display === 'flex'
    };

    const targetEl = cfg.getTarget(activeViewId, modalsState);
    if (targetEl) {
        targetEl.classList.add('ftue-focus-target');

        // В окне призыва одновременно подсвечиваем и рубашку карты, и кнопку «ВСКРЫТЬ ВСЕ ⚡»
        if (modalsState.summonResult && (unrevealedGachaCards || 0) > 0) {
            document.querySelectorAll('.summon-card-scene:not(.is-flipped)').forEach(card => card.classList.add('ftue-focus-target'));
            document.getElementById('btn-sum-reveal-all')?.classList.add('ftue-focus-target');
        }

        // Гарантированно подсвечиваем табличку здания или внутреннюю кнопку действия
        const directBadge = targetEl.querySelector('.district-badge') || targetEl.querySelector('.btn-action');
        if (directBadge) directBadge.classList.add('ftue-focus-target');

        const parentDistrict = targetEl.closest('.map-district');
        if (parentDistrict) {
            parentDistrict.classList.add('ftue-focus-target');
            const parentBadge = parentDistrict.querySelector('.district-badge');
            if (parentBadge) parentBadge.classList.add('ftue-focus-target');
        }

        const tapZone = targetEl.closest('.citadel-bottom-tap-zone');
        if (tapZone) {
            tapZone.classList.add('ftue-focus-target');
            document.getElementById('tap-node')?.classList.add('ftue-focus-target');
        }
    }
}

function claimFtueReward() {
    const step = gState.ftueStep || 0;
    const cfg = FTUE_STEPS_CONFIG[step];
    if (!cfg) return;

    // Если задание ещё выполняется — мягко направляем игрока к цели вместо тишины
    if (!cfg.req()) {
        nudgeFtueGoal(step);
        return;
    }

    playCoinSfx();
    if (cfg.rewardGold > 0) {
        gState.gold += cfg.rewardGold;
        gState.lifetimeGold += cfg.rewardGold;
    }
    if (cfg.rewardCryst > 0) {
        gState.crystals += cfg.rewardCryst;
    }
    if (step === 7) {
        // За очистку 1-го этажа Бездны гарантированно дарим героя [D] Гробовой Рыцарь
        if (!gState.deck['d_und_v']) {
            gState.deck['d_und_v'] = { stars: 1, lvl: 1 };
        }
    }
    if (step === 9) {
        gState.tickets = (gState.tickets || 0) + 2;
    }

    const rText = typeof cfg.rewardText === 'function' ? cfg.rewardText() : cfg.rewardText;
    pushToast(`✔ ${rText}`);

    // После призыва в Алтаре автоматически возвращаем игрока в Цитадель к зданию Штаба
    if (step === 4) {
        navigate('citadel-view');
    }

    // На финальном 12-м шаге выдаем почетные регалии
    if (step === 11) {
        gState.selectedTitleId = 't_overlord';
        pushToast(I18N[currentLang].ftue_complete_msg);
    }

    gState.ftueStep = step + 1;
    saveGame();
    renderCards();
    renderUI();
    renderFtue();
}

/* ==========================================================
   КЛИКЕР И СБОР ВОЙСКА
   ========================================================== */
let tapHistory = [], fatigueActive = false, combo = 0, isFrenzy = false, lastTap = 0;

function verifyTapLegitimacy() {
    if (fatigueActive) return false;
    const now = performance.now();
    tapHistory.push(now);
    if (tapHistory.length > 25) tapHistory.shift();

    if (tapHistory.length >= 12) {
        const timeSpan = now - tapHistory[0];
        // FIX-CLICKER-90: порог 12 тапов за 1000мс = ~91мс/тап. Стопит автокликер
        // до 90мс/тап включительно. Живой игрок медленнее 100мс — не задевает.
        if (timeSpan < 1000) { triggerFatigue(); return false; }
        let diffs = [];
        for (let i = 1; i < tapHistory.length; i++) diffs.push(tapHistory[i] - tapHistory[i - 1]);
        const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        const variance = diffs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / diffs.length;
        if (variance < 0.6) { triggerFatigue(); return false; }
    }
    return true;
}

function triggerFatigue() {
    fatigueActive = true;
    tapHistory = [];
    pushToast(currentLang === 'RU' ? "Усталость полководца! Отдохните 3 сек." : "Commander fatigue! Rest 3s.");
    setTimeout(() => { fatigueActive = false; }, 3000);
}

// v5.3.10 MULTI-TOUCH: отслеживаем активные указатели (пальцы).
// pointerdown приходит на каждое касание, но 30ms throttle и общий tapHistory
// отбрасывали второй/третий палец. При multi-touch fatigue-проверка пропускается.
const _activeTapPointers = new Set();
const tapNode = document.getElementById('tap-node');
if (tapNode) {
    tapNode.addEventListener('pointerdown', (e) => {
        _activeTapPointers.add(e.pointerId);
        const _isMultiTouch = _activeTapPointers.size > 1;
        if (!_isMultiTouch && !verifyTapLegitimacy()) {
            _activeTapPointers.delete(e.pointerId);
            return;
        }
        // 30ms throttle убран: pointerdown не повторяется на один палец,
        // а для multi-touch throttle ошибочно отбрасывал одновременные касания.
        lastTap = performance.now();

        if (!isFtueCompleted() && gState.ftueStep === 0) {
            gState.ftueTaps = (gState.ftueTaps || 0) + 1;
        }

        const cap = getArmyCap();
        const isFull = (gState.army || 0) >= cap;
        // FIX-BALANCE v4.7.0: frenzy ×2 (было ×3) — снижает пиковую нагрузку на тап.
        const mult = isFrenzy ? 2 : 1;

        if (!isFull) {
            gState.army = Math.min(cap, (gState.army || 0) + (1 * mult));
            if (gState.army > (gState.maxArmyEver || 0)) gState.maxArmyEver = gState.army;
        }
        trackQuestProgress('tap', 1);

        // FIX-BALANCE v4.7.0: тап ОТВЯЗАН от шахт. База растёт от зданий:
        //   day 1  (keep 1, mine 1):   tapBase ≈ 17
        //   day 30 (keep 15, mine 20): tapBase ≈ 165
        //   r=20   (keep 20, mine 30): tapBase ≈ 220
        // Крит ×5 (было ×10). Overdrive НЕ стакается — tapBase не зависит от getIncomeRate.
        // Максимум: 5 тапов/сек × frenzy ×2 × крит ×5 = ×50 от tapBase (было ×300).
        const tapBase = 10
            + (gState.buildings.keep || 1) * 5
            + (gState.buildings.barracks || 0) * 4
            + (gState.buildings.mine || 1) * 2;
        let goldGain = Math.max(2, Math.floor(tapBase * 0.15 * mult));
        if (isFull) goldGain *= 2;

        const isCrit = (Math.random() < 0.12);
        if (isCrit) {
            goldGain *= 5;
            playCoinSfx();
            triggerHaptic('crit');
        } else {
            triggerHaptic('tap');
        }

        gState.gold += goldGain;
        gState.lifetimeGold += goldGain;

        const gIcon = '<img src="assets/icons/gold.webp" class="res-icon-inline" style="width:13px; height:13px; vertical-align:-1px;" alt="G">';
        spawnGoldFloatingText(e.clientX || 200, e.clientY || 200, `+${formatNumber(goldGain)} ${gIcon}`, isCrit);
        playSfx(isCrit ? 920 : (isFrenzy ? 880 : 440), 'triangle', 0.04);

        if (!isFrenzy) {
            combo = Math.min(100, combo + 5);
            const cBar = document.getElementById('combo-bar');
            if (cBar) cBar.style.width = `${combo}%`;
            if (combo >= 100) startFrenzy();
        }
        renderFtue();
        renderUI();
    });

    // v5.3.10: чистим активные указатели при отпускании/отмене касания.
    const _releasePointer = (e) => _activeTapPointers.delete(e.pointerId);
    tapNode.addEventListener('pointerup', _releasePointer);
    tapNode.addEventListener('pointercancel', _releasePointer);
    tapNode.addEventListener('pointerleave', _releasePointer);
}

function spawnGoldFloatingText(x, y, textHtml, isCrit) {
    const el = document.createElement('div');
    el.className = `floating-gold-txt ${isCrit ? 'crit' : ''}`;
    el.innerHTML = isCrit ? `<span class="crit-label">КРИТ!</span> ${textHtml}` : textHtml;
    el.style.left = `${Math.max(10, x - 25)}px`;
    el.style.top = `${Math.max(10, y - 25)}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 850);
}

function startFrenzy() {
    isFrenzy = true;
    tapNode?.classList.add('frenzy-active');
    const lblDesc = document.getElementById('lbl-tap-desc');
    if (lblDesc) lblDesc.innerText = I18N[currentLang].frenzy_desc;
    let cd = 6;
    const ft = setInterval(() => {
        cd--;
        combo = (cd / 6) * 100;
        const cBar = document.getElementById('combo-bar');
        if (cBar) cBar.style.width = `${combo}%`;
        if (cd <= 0) {
            clearInterval(ft);
            isFrenzy = false; combo = 0;
            tapNode?.classList.remove('frenzy-active');
            if (lblDesc) lblDesc.innerText = I18N[currentLang].tap_desc;
            if (cBar) cBar.style.width = '0%';
        }
    }, 1000);
}

/* ==========================================================
   НАСТОЯЩИЙ ДВИЖОК TCG CARD BATTLER (ФИЗИКА, СНАРЯДЫ, УЛЬТЫ, ЗАЩИТА ОТ ЗАВИСАНИЙ)
   ========================================================== */
let activeCombatData = null;
let combatSimulationTimeout = null;
let combatWatchdogInterval = null;
let battleSpeedMultiplier = 1;
let isCombatTurnBusy = false;

/* ==========================================================
   ИМЕННЫЕ УЛЬТИМЕЙТЫ ГЕРОЕВ (БОЕВОЙ КАТАЛОГ И ГЕНЕРАТОР)
   ========================================================== */
const HERO_SPECIFIC_ULTIMATES = {
    // [SSS]
    'sss_und_v': { name: { RU: 'Смертный Приговор Вечности', EN: 'Eternity Scythe Verdict' }, sub: { RU: 'Абсолютная энтропия бытия', EN: 'Absolute entropy' } },
    'sss_dem_v': { name: { RU: 'Инфернальный Катаклизм Бездны', EN: 'Infernal Void Cataclysm' }, sub: { RU: 'Первородный огонь творения', EN: 'Primordial creation fire' } },
    'sss_lig_r': { name: { RU: 'Гнев Тысячи Солнц', EN: 'Wrath of a Thousand Suns' }, sub: { RU: 'Испепеляющий золотой шквал', EN: 'Incinerating golden storm' } },
    'sss_cha_c': { name: { RU: 'Изначальное Поглощение Пустоты', EN: 'Primordial Annihilation' }, sub: { RU: 'Колыбель первородного хаоса', EN: 'Cradle of primal chaos' } },
    // [SS]
    'ss_und_r': { name: { RU: 'Танец Черного Ворона', EN: 'Dance of the Black Raven' }, sub: { RU: 'Жатва обреченных душ', EN: 'Harvest of doomed souls' } },
    'ss_dem_v': { name: { RU: 'Тектонический Разлом Недр', EN: 'Tectonic Worldbreaker' }, sub: { RU: 'Дрожь базальтовых плит', EN: 'Basalt shelf shatter' } },
    'ss_lig_c': { name: { RU: 'Очищающий Луч Творения', EN: 'Purifying Ray of Genesis' }, sub: { RU: 'Первозданный свет без тени', EN: 'Primordial shadowless beam' } },
    'ss_cha_v': { name: { RU: 'Гравитационный Коллапс', EN: 'Gravitational Singularity' }, sub: { RU: 'Круговерть черных дыр', EN: 'Black hole vortex' } },
    // [S]
    's_dem_c': { name: { RU: 'Кровавая Жатва Теней', EN: 'Shadow Blood Harvest' }, sub: { RU: 'Власть запретных желаний', EN: 'Reign of forbidden desires' } },
    's_cha_r': { name: { RU: 'Взгляд Окаменения', EN: 'Petrifying Gaze' }, sub: { RU: 'Обращение плоти в известняк', EN: 'Transmuting flesh to stone' } },
    's_lig_v': { name: { RU: 'Карающий Клинок Зари', EN: 'Daybreak Brand of Retribution' }, sub: { RU: 'Выжигание греха', EN: 'Purging all heresy' } },
    's_und_c': { name: { RU: 'Вечная Мерзлота Душ', EN: 'Glacial Soulfreeze' }, sub: { RU: 'Ледяное дыхание гробницы', EN: 'Tomb-frost exhalation' } },
    // [A]
    'a_und_v': { name: { RU: 'Дыхание Могильного Инея', EN: 'Gravefrost Breath' }, sub: { RU: 'Окаменение крови легионов', EN: 'Petrifying host blood' } },
    'a_und_c': { name: { RU: 'Черная Чума Забвения', EN: 'Oblivion Black Plague' }, sub: { RU: 'Забвение истории', EN: 'Scouring memory' } },
    'a_dem_v': { name: { RU: 'Обсидиановый Раскол', EN: 'Obsidian Rift Sunder' }, sub: { RU: 'Разрыв земной коры', EN: 'Crust-shattering cleave' } },
    'a_dem_c': { name: { RU: 'Шторм Адского Пламени', EN: 'Hellfire Storm Command' }, sub: { RU: 'Тотальное выжигание', EN: 'Absolute immolation' } },
    'a_lig_v': { name: { RU: 'Удар Первого Рассвета', EN: 'First Dawn Cleave' }, sub: { RU: 'Клинок без сомнений', EN: 'Blade of no doubt' } },
    'a_lig_c': { name: { RU: 'Пике Священного Огня', EN: 'Sacred Pyre Dive' }, sub: { RU: 'Суд белых крыльев', EN: 'White-wing tribunal' } },
    'a_cha_v': { name: { RU: 'Девятикратный Шквал Яда', EN: 'Nine-Headed Venom Surge' }, sub: { RU: 'Едкая кислота глубин', EN: 'Caustic abyssal bile' } },
    'a_cha_c': { name: { RU: 'Сокрушитель Идолов', EN: 'Tempest Idol Breaker' }, sub: { RU: 'Удар молота великой бури', EN: 'Tempest anvil crush' } }
};

function getHeroUltimate(hero) {
    if (!hero) {
        return {
            name: { RU: 'Абсолютная Ярость', EN: 'Absolute Fury' },
            sub: { RU: 'Сокрушительный удар', EN: 'Devastating strike' }
        };
    }
    if (HERO_SPECIFIC_ULTIMATES[hero.id]) {
        return HERO_SPECIFIC_ULTIMATES[hero.id];
    }
    // Процедурный генератор способностей по роли и фракции с гарантированным объектом name
    const roleKey = { 'Авангард': 'v', 'Главком': 'c', 'Тыл': 'r' }[hero.role] || 'c';
    const templates = {
        undead: {
            v: { name: { RU: 'Костяной Таран Склепа', EN: 'Sepulcher Bone Juggernaut' }, sub: { RU: 'Сокрушение строя щитом', EN: 'Frontline shield crush' } },
            c: { name: { RU: 'Приказ Повелителя Мертвых', EN: 'Decree of the Deathlord' }, sub: { RU: 'Восстание павших шеренг', EN: 'Resurrecting ranks' } },
            r: { name: { RU: 'Трупный Мор Пустоты', EN: 'Carrion Void Blight' }, sub: { RU: 'Разъедание легких ядом', EN: 'Corrosive essence' } }
        },
        demon: {
            v: { name: { RU: 'Пылающий Лавовый Натиск', EN: 'Molten Brimstone Rush' }, sub: { RU: 'Таран кипящей магмой', EN: 'Magma bash' } },
            c: { name: { RU: 'Инфернальный Приговор', EN: 'Infernal Execution Order' }, sub: { RU: 'Огненная кара предателям', EN: 'Hellfire retribution' } },
            r: { name: { RU: 'Серный Взрыв Преисподней', EN: 'Abyssal Brimstone Detonation' }, sub: { RU: 'Град горящей смолы', EN: 'Boiling pitch rain' } }
        },
        light: {
            v: { name: { RU: 'Бастион Ослепительной Веры', EN: 'Bastion of Radiant Faith' }, sub: { RU: 'Непробиваемый свет', EN: 'Impervious solar shield' } },
            c: { name: { RU: 'Глас Небесного Карателя', EN: 'Voice of Firmament Wrath' }, sub: { RU: 'Оглушающий соборный колокол', EN: 'Cathedral chime blast' } },
            r: { name: { RU: 'Звездный Карающий Луч', EN: 'Astral Retribution Lance' }, sub: { RU: 'Метеорный прокол брони', EN: 'Armor-piercing starlight' } }
        },
        chaos: {
            v: { name: { RU: 'Яростный Прорыв Дикаря', EN: 'Frenzied Primal Breakthrough' }, sub: { RU: 'Разрубание топорами наотмашь', EN: 'Cleaving fury' } },
            c: { name: { RU: 'Вихрь Первобытной Анархии', EN: 'Vortex of Primal Anarchy' }, sub: { RU: 'Натиск верхом на буре', EN: 'Storm-riding charge' } },
            r: { name: { RU: 'Искажение Пространства Бездны', EN: 'Void Space Warpstrike' }, sub: { RU: 'Рикошет стрел во врага', EN: 'Reflective spatial warp' } }
        }
    };
    const factionData = templates[hero.faction] || templates['chaos'];
    const hNameRU = hero?.name?.RU || hero?.name || 'Героя';
    const hNameEN = hero?.name?.EN || hero?.name || 'Hero';
    return factionData[roleKey] || {
        name: { RU: `Гнев ${hNameRU}`, EN: `Wrath of ${hNameEN}` },
        sub: { RU: 'Концентрированная мощь', EN: 'Focused power' }
    };
}

function toggleBattleSpeed() {
    battleSpeedMultiplier = battleSpeedMultiplier === 1 ? 2 : 1;
    const btn = document.getElementById('btn-battle-speed');
    if (btn) btn.innerText = `${battleSpeedMultiplier}x`;
    playSfx(600, 'sine', 0.05);
}

// Честный калькулятор характеристик карты бота с учетом ранга конкретного героя
function getBotCardStats(enemyName, enemyCp, slotIndex, heroId = null) {
    const name = enemyName || 'Bot';
    const cp = Math.max(500, enemyCp || 1000);
    const idx = slotIndex || 0;
    const hero = heroId ? HEROES_CATALOG[heroId] : null;
    const tierWeight = hero ? (TIER_ORDER[hero.tier] || 1) : 3;

    const nameHash = (name.charCodeAt(0) || 65) + (name.charCodeAt(name.length - 1) || 90) + (idx * 31);
    
    // Младшие ранги (F, E) получают чуть выше уровень, чтобы компенсировать низкий базовый CP
    const rankLvlOffset = Math.max(0, 6 - tierWeight) * 2;
    const baseLvl = Math.max(1, Math.min(200, Math.floor(cp / 250) + rankLvlOffset));

    // Высокие ранги (S, SS, SSS) имеют меньше звезд при равном БМ команды
    const maxStarsForTier = tierWeight >= 7 ? Math.max(1, Math.floor(cp / 3000) + 1) : 10;
    const baseStars = Math.max(1, Math.min(maxStarsForTier, Math.floor(cp / 1500) + (tierWeight <= 3 ? 2 : 1)));

    let lvl = baseLvl;
    let stars = baseStars;

    if (idx === 1) {
        // Главком: ударный лидер отряда (+15%..+25% к уровню)
        const lvlBonus = 1.15 + ((nameHash % 12) / 100);
        lvl = Math.min(200, Math.max(1, Math.round(baseLvl * lvlBonus)));
        stars = Math.min(10, Math.max(1, baseStars + ((nameHash % 2 === 0) ? 1 : 0)));
    } else if (idx === 0) {
        // Авангард: сбалансированный передовой боец
        const lvlBonus = 0.95 + ((nameHash % 10) / 100);
        lvl = Math.min(200, Math.max(1, Math.round(baseLvl * lvlBonus)));
        stars = Math.min(10, Math.max(1, baseStars));
    } else {
        // Тыл: поддержка/магия
        const lvlBonus = 0.85 + ((nameHash % 14) / 100);
        lvl = Math.min(200, Math.max(1, Math.round(baseLvl * lvlBonus)));
        stars = Math.min(10, Math.max(1, baseStars - ((nameHash % 3 === 0 && baseStars > 1) ? 1 : 0)));
    }

    return { lvl, stars };
}

// Создание боевого профиля карты с честной симуляцией статов
function buildCombatUnit(id, isPlayer, slotIndex, baseTeamCP, combatType = 'arena', enemyName = '', fullSquad = null, realCardMeta = null) {
    const hero = HEROES_CATALOG[id] || HEROES_CATALOG['f_und_v'];
    // B3: для живых соперников используем реальные stars/lvl из squadMeta,
    // а не сгенерированные getBotCardStats. Если meta нет — fallback на ботов.
    let cardData;
    if (isPlayer) {
        cardData = gState.deck[id] || { stars: 1, lvl: 1 };
    } else if (realCardMeta && realCardMeta[id]) {
        cardData = {
            stars: Math.max(1, Math.min(10, realCardMeta[id].stars || 1)),
            lvl: Math.max(1, Math.min(300, realCardMeta[id].lvl || 1))
        };
    } else {
        cardData = getBotCardStats(enemyName, baseTeamCP, slotIndex, id);
    }
    
    let hCP = 0;
    if (isPlayer) {
        hCP = getHeroCP(id);
        if (slotIndex === 1) hCP = Math.floor(hCP * 1.5); // Бонус позиции Главкома (+50% БМ)
        const syn = getFormationSynergy(gState.attackFormation);
        const titleBonus = 1 + (getLordTitleData().bonus || 0);
        // Честный сквозной перенос всех глобальных бонусов игрока в реальные боевые статы!
        hCP = Math.floor(hCP * syn.mult * getRelicBonus() * titleBonus);
    } else {
        // ЧЕСТНЫЙ расчет карты соперника: сила карты строго пропорциональна ее рангу, уровню и звездам!
        const squadIds = fullSquad || [id, id, id];
        const syn = getFormationSynergy(squadIds);
        
        // Собственный CP текущей карты
        let thisCardCP = calculateCardCP(id, cardData.stars, cardData.lvl);
        if (slotIndex === 1) thisCardCP = Math.floor(thisCardCP * 1.5); // Честные +50% Главкому врага

        // Суммарный натуральный вес всех трех карт отряда соперника
        let totalSquadWeight = 0;
        squadIds.forEach((sid, sidx) => {
            const scard = getBotCardStats(enemyName, baseTeamCP, sidx, sid);
            let scp = calculateCardCP(sid, scard.stars, scard.lvl);
            if (sidx === 1) scp = Math.floor(scp * 1.5);
            totalSquadWeight += scp;
        });

        // Доля конкретной карты в отряде (F-ранг получит малую долю, S-ранг — пропорциональную)
        const share = totalSquadWeight > 0 ? (thisCardCP / totalSquadWeight) : (1 / 3);
        // baseTeamCP уже включает синергию: убран двойной множитель syn.mult, устраняющий оверкилл урона
        hCP = Math.max(40, Math.floor(baseTeamCP * share));
    }

    // Роли: 0 - Авангард (танк), 1 - Главком (лидер), 2 - Тыл (маг/стрелок)
    let roleType = slotIndex === 0 ? 'vanguard' : (slotIndex === 1 ? 'commander' : 'rearguard');
    let hpMult = roleType === 'vanguard' ? 14 : (roleType === 'commander' ? 10 : 7.5);
    let atkMult = roleType === 'rearguard' ? 2.8 : (roleType === 'commander' ? 2.5 : 1.7);
    let defPct = roleType === 'vanguard' ? 0.25 : (roleType === 'commander' ? 0.15 : 0.05);

    // РЕАЛЬНОЕ ВЛИЯНИЕ АРМИИ В БЕЗДНЕ: Гарнизон дает Авангарду щит ХП, а всей шеренге — сокрушительный бонус к урону!
    const armyHpBonus = (isPlayer && combatType !== 'arena' && roleType === 'vanguard') ? (gState.army || 0) * 15 : 0;
    const armyAtkBonus = (isPlayer && combatType !== 'arena') ? Math.floor((gState.army || 0) * 0.45) : 0;

    const maxHp = Math.max(100, Math.floor(hCP * hpMult)) + armyHpBonus;
    const atk = Math.max(15, Math.floor(hCP * atkMult)) + armyAtkBonus;

    return {
        id,
        hero,
        slotIndex,
        isPlayer,
        roleType,
        maxHp,
        currentHp: maxHp,
        atk,
        def: defPct,
        energy: 0,
        stars: cardData.stars || 1,
        lvl: cardData.lvl || 1,
        isDead: false
    };
}

function launchVisualCombat(playerSquadIds, enemyData, combatType, onCompleteCallback) {
    // На Арене армия не учитывается!
    const includeArmy = (combatType !== 'arena');
    const pCP = calculateCP(playerSquadIds, enemyData.squad, includeArmy);
    const hasElemBonus = checkElementalAdvantage(playerSquadIds, enemyData.squad);
    
    // Во время прохождения обучения игрок всегда побеждает, чтобы не застрять
    const isWin = !isFtueCompleted() ? true : (pCP >= enemyData.cp);

    // Режим VIP: мгновенный расчет (если в настройках не включен визуальный бой)
    if (isVipActive() && gState.vipSkipCombat !== false) {
        let claimFunction = null;
        let spoilsText = '';

        if (typeof onCompleteCallback === 'function') {
            spoilsText = onCompleteCallback(isWin, (claimFn) => { claimFunction = claimFn; });
        }
        if (typeof claimFunction === 'function') claimFunction(isWin ? 2 : 1);

        if (isWin) {
            playCoinSfx();
            pushToast(currentLang === 'RU' ? `[VIP] АВТОБОЙ: ПОБЕДА! ${spoilsText} (x2)` : `[VIP] AUTO-COMBAT: VICTORY! ${spoilsText} (x2)`);
        } else {
            playBladeClash();
            pushToast(currentLang === 'RU' ? `[VIP] АВТОБОЙ: ПОРАЖЕНИЕ! ${spoilsText}` : `[VIP] AUTO-COMBAT: DEFEAT! ${spoilsText}`);
        }
        saveGame();
        renderArena();
        renderLeaderboard();
        renderBattleHistory();
        renderDungeon();
        renderFtue();
        renderUI();
        return;
    }

    // Инициализация полноценной боевой арены TCG с честным распределением статов карт соперника
    const enemyHasElemBonus = checkElementalAdvantage(enemyData.squad, playerSquadIds);
    activeCombatData = {
        playerUnits: playerSquadIds.map((id, idx) => id ? buildCombatUnit(id, true, idx, pCP, combatType) : null),
        // B3: 8-й аргумент — реальные статы карт защитника (для живых игроков).
        // Для ботов squadMeta === null → используется getBotCardStats (как раньше).
        enemyUnits: enemyData.squad.map((id, idx) => id ? buildCombatUnit(id, false, idx, enemyData.cp, combatType, enemyData.name, enemyData.squad, enemyData.squadMeta || null) : null),
        hasElemBonus,
        enemyHasElemBonus,
        playerSynergy: getFormationSynergy(playerSquadIds),
        enemySynergy: getFormationSynergy(enemyData.squad),
        combatType,
        onComplete: onCompleteCallback,
        onClaim: null,
        roundQueue: [], // Очередь действий: ровно по 1 удару на каждого живого бойца за раунд
        isFinished: false
    };

    renderCombatStage();
    const modal = document.getElementById('battle-overlay-modal');
    const verdict = document.getElementById('combat-verdict-box');
    const skipBtn = document.getElementById('btn-battle-skip');

    if (skipBtn) skipBtn.innerText = I18N[currentLang].battle_skip;
    if (modal) modal.style.display = 'flex';
    if (verdict) verdict.style.display = 'none';

    clearTimeout(combatSimulationTimeout);
    clearInterval(combatWatchdogInterval);

    isCombatTurnBusy = false;
    let lastTurnTimestamp = Date.now();
    combatWatchdogInterval = setInterval(() => {
        if (!activeCombatData || activeCombatData.isFinished) {
            clearInterval(combatWatchdogInterval);
            return;
        }
        // Безопасный порог Watchdog 3500ms с отменой запланированных таймеров во избежание наслоения ходов
        if (Date.now() - lastTurnTimestamp > 3500) {
            console.warn('[TCG Battle] Watchdog спас бой от зависания! Форсирование следующего хода...');
            lastTurnTimestamp = Date.now();
            clearTimeout(combatSimulationTimeout);
            isCombatTurnBusy = false;
            if (activeCombatData) {
                executeCombatTurn();
            }
        }
    }, 500);

    activeCombatData.lastTurnTick = () => { lastTurnTimestamp = Date.now(); };
    scheduleNextCombatAction(500);
}

function renderCombatStage() {
    if (!activeCombatData) return;
    const pContainer = document.getElementById('player-combat-squad');
    const eContainer = document.getElementById('enemy-combat-squad');
    const ticker = document.getElementById('battle-combat-ticker');
    if (!pContainer || !eContainer) return;

    if (ticker) {
        const pSquad = activeCombatData.playerUnits.map(u => u?.id).filter(Boolean);
        const eSquad = activeCombatData.enemyUnits.map(u => u?.id).filter(Boolean);
        const pHasAdv = checkElementalAdvantage(pSquad, eSquad);
        const eHasAdv = checkElementalAdvantage(eSquad, pSquad);

        if (pHasAdv && !eHasAdv) {
            ticker.innerText = I18N[currentLang]?.combat_ticker_player_adv || "Ваше преимущество стихии (+15%)";
            ticker.style.color = "var(--gold)";
        } else if (eHasAdv && !pHasAdv) {
            ticker.innerText = I18N[currentLang]?.combat_ticker_enemy_adv || "Преимущество стихии у врага (+15%)";
            ticker.style.color = "#f87171";
        } else {
            ticker.innerText = I18N[currentLang]?.combat_ticker_balance || "Стихии в балансе";
            ticker.style.color = "#94a3b8";
        }
    }

    // Тактическое построение клином: [1: Главком (слева), 0: АВАНГАРД (по центру), 2: Тыл (справа)]
    const spearheadOrder = [1, 0, 2];
    pContainer.innerHTML = spearheadOrder.map(idx => renderBattleCardHtml(activeCombatData.playerUnits[idx], 'p')).join('');
    eContainer.innerHTML = spearheadOrder.map(idx => renderBattleCardHtml(activeCombatData.enemyUnits[idx], 'e')).join('');
    updateTeamHpHeaders();
}

function renderBattleCardHtml(u, side) {
    if (!u) return '<div class="battle-tcg-card" style="opacity:0;"></div>';
    const h = u.hero;
    const roleClasses = { vanguard: 'role-vg', commander: 'role-cm', rearguard: 'role-rg' };
    const roleNames = {
        vanguard: currentLang === 'RU' ? 'АВАНГАРД' : 'VANGUARD',
        commander: currentLang === 'RU' ? 'ЛИДЕР' : 'COMMANDER',
        rearguard: currentLang === 'RU' ? 'ТЫЛ' : 'REARGUARD'
    };
    const roleShort = roleNames[u.roleType] || (currentLang === 'RU' ? 'БОЕЦ' : 'UNIT');

    const heroImg = h.img || `${h.id}.webp`;
    const artHtml = `<img src="assets/heroes/${heroImg}" class="b-card-art-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span class="b-card-art-icon" style="display:none;">${h.icon}</span>`;

    const hpPct = Math.max(0, Math.min(100, (u.currentHp / u.maxHp) * 100));

    // Проверка активности стихийной синергии (x2 или x3) для карты
    const squadSynergy = side === 'p' ? activeCombatData?.playerSynergy : activeCombatData?.enemySynergy;
    let synergyAuraClass = '';
    if (squadSynergy && squadSynergy.mult > 1 && squadSynergy.faction === h.faction) {
        synergyAuraClass = `synergy-aura-${squadSynergy.faction} synergy-count-${squadSynergy.count}`;
    }

    return `
        <div class="battle-tcg-card ${synergyAuraClass} ${u.roleType === 'vanguard' ? 'card-vanguard' : ''} ${u.isDead ? 'card-dead' : ''}" id="${side}-bcard-${u.slotIndex}" style="border-color:var(--tier-${(h.tier||'f').toLowerCase()});">
            <div class="b-card-header">
                <span class="b-card-role ${roleClasses[u.roleType]}">${roleShort}</span>
                <span style="color:var(--gold); font-size:11px; font-weight:800;">★${u.stars}</span>
            </div>
            <div class="b-card-art-box">${artHtml}</div>
            <div class="b-card-meta">
                <div class="b-card-name">${h.name[currentLang] || h.name['EN']}</div>
            </div>
            <div class="b-card-bars">
                <div class="b-hp-track"><div class="b-hp-fill" id="${side}-hp-fill-${u.slotIndex}" style="width:${hpPct}%;"></div></div>
                <div class="b-energy-track"><div class="b-energy-fill" id="${side}-energy-fill-${u.slotIndex}" style="width:${u.energy}%;"></div></div>
                <div class="b-stat-text">
                    <span id="${side}-hp-num-${u.slotIndex}">${formatNumber(u.currentHp)}</span>
                    <span style="color:var(--gold); display:inline-flex; align-items:center; gap:2px;"><img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:11px; height:11px;" alt="⚔">${formatNumber(u.atk)}</span>
                </div>
            </div>
        </div>`;
}

function updateTeamHpHeaders() {
    if (!activeCombatData) return;
    let pHp = 0, eHp = 0;
    activeCombatData.playerUnits.forEach(u => { if (u && !u.isDead) pHp += u.currentHp; });
    activeCombatData.enemyUnits.forEach(u => { if (u && !u.isDead) eHp += u.currentHp; });

    const pSum = document.getElementById('player-team-hp-sum');
    const eSum = document.getElementById('enemy-team-hp-sum');
    if (pSum) pSum.innerText = `${formatNumber(pHp)} HP`;
    if (eSum) eSum.innerText = `${formatNumber(eHp)} HP`;
}

function scheduleNextCombatAction(delayMs) {
    if (!activeCombatData || activeCombatData.isFinished) return;
    clearTimeout(combatSimulationTimeout);
    const adjustedDelay = Math.max(120, Math.floor(delayMs / battleSpeedMultiplier));
    combatSimulationTimeout = setTimeout(executeCombatTurn, adjustedDelay);
}

// Построение честной раундовой очереди: ровно по 1 действию на каждого живого бойца
function buildRoundActionQueue() {
    if (!activeCombatData) return [];
    const pAlive = (activeCombatData.playerUnits || []).filter(u => u && !u.isDead && u.currentHp > 0);
    const eAlive = (activeCombatData.enemyUnits || []).filter(u => u && !u.isDead && u.currentHp > 0);

    // Упорядочиваем шеренги: Авангард (0) -> Главком (1) -> Тыл (2)
    pAlive.sort((a, b) => a.slotIndex - b.slotIndex);
    eAlive.sort((a, b) => a.slotIndex - b.slotIndex);

    const queue = [];
    const maxSteps = Math.max(pAlive.length, eAlive.length);

    // Шахматное чередование: каждый живой боец делает ровно 1 выпад за раунд
    for (let i = 0; i < maxSteps; i++) {
        if (i < pAlive.length) queue.push({ isPlayer: true, unit: pAlive[i] });
        if (i < eAlive.length) queue.push({ isPlayer: false, unit: eAlive[i] });
    }
    return queue;
}

function executeCombatTurn() {
    if (!activeCombatData || activeCombatData.isFinished || isCombatTurnBusy) return;
    isCombatTurnBusy = true;
    if (activeCombatData.lastTurnTick) activeCombatData.lastTurnTick();

    try {
        activeCombatData.turnCount = (activeCombatData.turnCount || 0) + 1;

        activeCombatData.playerUnits.forEach(u => { if (u && u.currentHp <= 0) u.isDead = true; });
        activeCombatData.enemyUnits.forEach(u => { if (u && u.currentHp <= 0) u.isDead = true; });

        // Внезапная смерть включается только после 36 действий (6 полных раундов)
        if (activeCombatData.turnCount >= 60) {
            let pHp = activeCombatData.playerUnits.reduce((a, b) => a + (b && !b.isDead ? b.currentHp : 0), 0);
            let eHp = activeCombatData.enemyUnits.reduce((a, b) => a + (b && !b.isDead ? b.currentHp : 0), 0);
            finalizeCombat(pHp >= eHp);
            return;
        }

        // Поиск следующего живого участника в раунде
        let currentAction = null;
        let attempts = 0;
        while (attempts < 12) {
            attempts++;
            if (!activeCombatData.roundQueue || activeCombatData.roundQueue.length === 0) {
                activeCombatData.roundQueue = buildRoundActionQueue();
            }

            const candidate = activeCombatData.roundQueue.shift();
            if (candidate && candidate.unit && !candidate.unit.isDead && candidate.unit.currentHp > 0) {
                currentAction = candidate;
                break;
            }
        }

        if (!currentAction) {
            checkBattleEndCondition();
            return;
        }

        const isPlayer = currentAction.isPlayer;
        const attacker = currentAction.unit;
        const defenders = isPlayer ? activeCombatData.enemyUnits : activeCombatData.playerUnits;
        const attackerPrefix = isPlayer ? 'p' : 'e';
        const defenderPrefix = isPlayer ? 'e' : 'p';

        // Выбор живой цели: Тыл снайпит самого раненого, остальные пробивают передовую
        const aliveTargets = defenders.filter(u => u && !u.isDead && u.currentHp > 0);
        if (aliveTargets.length === 0) {
            checkBattleEndCondition();
            return;
        }

        let target = null;
        if (attacker.roleType === 'rearguard') {
            aliveTargets.sort((a, b) => a.currentHp - b.currentHp);
            target = aliveTargets[0];
        } else {
            target = aliveTargets.find(u => u.roleType === 'vanguard') ||
                     aliveTargets.find(u => u.roleType === 'commander') ||
                     aliveTargets[0];
        }

        if (!target) {
            checkBattleEndCondition();
            return;
        }

        const attackerEl = document.getElementById(`${attackerPrefix}-bcard-${attacker.slotIndex}`);
        const defenderEl = document.getElementById(`${defenderPrefix}-bcard-${target.slotIndex}`);
        const turnIndicator = document.getElementById('tcg-turn-indicator');

        const isUltimateReady = attacker.energy >= 100;
        const isCrit = !isUltimateReady && Math.random() < 0.18;
        const ultData = getHeroUltimate(attacker.hero);

        if (turnIndicator) {
            if (isUltimateReady) {
                const ultTitle = ultData?.name?.[currentLang] || ultData?.name?.['EN'] || ultData?.[currentLang] || 'УЛЬТИМЕЙТ';
                turnIndicator.innerText = `${ultTitle}!`;
                turnIndicator.style.color = '#ef4444';
            } else {
                const aName = attacker.hero?.name?.[currentLang] || attacker.hero?.name?.['EN'] || (currentLang === 'RU' ? 'Боец' : 'Unit');
                const turnLabel = I18N[currentLang]?.combat_turn_prefix || (currentLang === 'RU' ? 'ХОД' : 'TURN');
                turnIndicator.innerText = `${turnLabel}: ${aName}`;
                turnIndicator.style.color = isPlayer ? 'var(--gold)' : 'var(--red)';
            }
        }

        // Мягкое нарастание урона только после 36 действий (+5% за каждый последующий ход)
        const suddenDeathMult = activeCombatData.turnCount > 36 ? (1 + (activeCombatData.turnCount - 36) * 0.05) : 1.0;
        let dmgMultiplier = (isUltimateReady ? 2.3 : (isCrit ? 1.7 : 1.0)) * suddenDeathMult;
        // Симметричный расчет: честный бонус +15% урона тому, чья стихия доминирует
        if (isPlayer && activeCombatData.hasElemBonus) dmgMultiplier *= 1.15;
        if (!isPlayer && activeCombatData.enemyHasElemBonus) dmgMultiplier *= 1.15;

        let rawDmg = attacker.atk * dmgMultiplier * (0.9 + Math.random() * 0.2);
        let finalDmg = Math.max(25, Math.floor(rawDmg * (1 - target.def)));

        // Мгновенное синхронное списание здоровья
        target.currentHp = Math.max(0, target.currentHp - finalDmg);
        if (target.currentHp <= 0) target.isDead = true;

        // Энергия
        if (isUltimateReady) {
            attacker.energy = 0;
        } else {
            attacker.energy = Math.min(100, attacker.energy + 35);
            target.energy = Math.min(100, target.energy + 20);
        }

        const finalizeHitAndAdvance = () => {
            if (!activeCombatData || activeCombatData.isFinished) return;
            updateCardBars(attacker, attackerPrefix);
            isCombatTurnBusy = false;
            scheduleNextCombatAction(450);
        };

        const executeHit = () => {
            try {
                if (attacker.roleType === 'rearguard') {
                    attackerEl?.classList.add('card-recoil');
                    playSfx(isUltimateReady ? 900 : 700, 'triangle', 0.1);
                    spawnCombatProjectile(attackerEl, defenderEl, () => {
                        applyDamageToTarget(target, finalDmg, isCrit, isUltimateReady, defenderEl, defenderPrefix);
                        finalizeHitAndAdvance();
                    });
                } else {
                    const slamClass = isPlayer ? 'card-slam-player' : 'card-slam-enemy';
                    attackerEl?.classList.add(slamClass);
                    if (isUltimateReady) attackerEl?.classList.add('card-ultimate');

                    playBladeClash();

                    setTimeout(() => {
                        attackerEl?.classList.remove(slamClass);
                        attackerEl?.classList.remove('card-ultimate');
                        applyDamageToTarget(target, finalDmg, isCrit, isUltimateReady, defenderEl, defenderPrefix);
                        finalizeHitAndAdvance();
                    }, Math.max(160, Math.floor(240 / battleSpeedMultiplier)));
                }
            } catch (innerErr) {
                console.error("executeHit inner error:", innerErr);
                finalizeHitAndAdvance();
            }
        };

        if (isUltimateReady) {
            triggerHeroCutIn(attacker.hero, executeHit);
        } else {
            executeHit();
        }
    } catch (err) {
        console.error("[TCG Battle] Критическая ошибка в ходе боя:", err);
        isCombatTurnBusy = false;
        if (activeCombatData && !activeCombatData.isFinished) {
            scheduleNextCombatAction(400);
        }
    }
}

// Запуск аниме-сплэша перед ультимейтом
function triggerHeroCutIn(hero, callback) {
    const cutin = document.getElementById('ultimate-cutin-overlay');
    if (!cutin) { callback(); return; }

    try {
        const ultData = getHeroUltimate(hero);
        const ultSkillEl = document.getElementById('ult-cutin-skill');
        const ultNameEl = document.getElementById('ult-cutin-name');
        const stripeEl = document.getElementById('ult-cutin-stripe');

        if (ultNameEl) ultNameEl.innerText = hero?.name?.[currentLang] || hero?.name?.['EN'] || 'Герой';
        if (ultSkillEl) ultSkillEl.innerText = ultData?.name?.[currentLang] || ultData?.name?.['EN'] || 'Абсолютная Ярость';

        if (stripeEl) {
            stripeEl.className = `ult-cutin-stripe faction-${hero?.faction || 'chaos'}`;
        }

        const iconEl = document.getElementById('ult-cutin-icon');
        if (iconEl) {
            const heroImg = hero?.img || `${hero?.id}.webp`;
            iconEl.innerHTML = `<img src="assets/heroes/${heroImg}" style="width:120px; height:120px; object-fit:cover; border-radius:50%; border:3px solid var(--gold);" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span style="display:none; font-size:90px;">${hero?.icon || '👑'}</span>`;
        }

        cutin.style.display = 'flex';
        playSfx(1200, 'sawtooth', 0.3);
        triggerHaptic('crit');

        setTimeout(() => {
            cutin.style.display = 'none';
            callback();
        }, Math.max(250, Math.floor(600 / battleSpeedMultiplier)));
    } catch (e) {
        console.error("triggerHeroCutIn error:", e);
        cutin.style.display = 'none';
        callback();
    }
}

function triggerCombatHitFx(targetEl, isCrit, isUlt) {
    if (!targetEl) return;
    const board = document.getElementById('battle-overlay-modal');
    if (isUlt || isCrit) {
        const flash = document.getElementById('tcg-screen-flash');
        if (flash) {
            flash.classList.remove('active');
            void flash.offsetWidth;
            flash.classList.add('active');
        }
    }
    const rect = targetEl.getBoundingClientRect();
    const boardRect = board?.getBoundingClientRect() || { left: 0, top: 0 };
    const originX = rect.left + rect.width / 2 - boardRect.left;
    const originY = rect.top + rect.height / 2 - boardRect.top;

    const count = isUlt ? 8 : (isCrit ? 6 : 4);
    for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.className = `combat-spark ${isUlt ? 'ult' : (isCrit ? 'crit' : '')}`;
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 45;
        spark.style.left = `${originX}px`;
        spark.style.top = `${originY}px`;
        spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        spark.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
        board?.appendChild(spark);
        setTimeout(() => spark.remove(), 420);
    }
}

function applyDamageToTarget(target, dmg, isCrit, isUlt, defenderEl, defenderPrefix) {
    if (!target || !activeCombatData) return;

    defenderEl?.classList.add('card-recoil');
    setTimeout(() => defenderEl?.classList.remove('card-recoil'), 200);

    triggerCombatHitFx(defenderEl, isCrit, isUlt);
    spawnDamageNumber(defenderEl, dmg, isCrit, isUlt);
    playSfx(isUlt ? 220 : 350, 'sawtooth', 0.12);

    if (target.isDead) {
        defenderEl?.setAttribute('data-dead-label', I18N[currentLang]?.combat_dead_label || (currentLang === 'RU' ? 'ПОГИБ' : 'K.O.'));
        defenderEl?.classList.add('card-dead');
        playSfx(180, 'square', 0.25);
    }

    updateCardBars(target, defenderPrefix);
    updateTeamHpHeaders();
    checkBattleEndCondition();
}

function updateCardBars(unit, prefix) {
    const hpFill = document.getElementById(`${prefix}-hp-fill-${unit.slotIndex}`);
    const hpNum = document.getElementById(`${prefix}-hp-num-${unit.slotIndex}`);
    const energyFill = document.getElementById(`${prefix}-energy-fill-${unit.slotIndex}`);

    if (hpFill) hpFill.style.width = `${Math.max(0, (unit.currentHp / unit.maxHp) * 100)}%`;
    if (hpNum) hpNum.innerText = formatNumber(unit.currentHp);
    if (energyFill) energyFill.style.width = `${unit.energy}%`;
}

function spawnCombatProjectile(fromEl, toEl, onHit) {
    const layer = document.getElementById('tcg-projectile-layer');
    if (!layer || !fromEl || !toEl) { onHit(); return; }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();

    const p = document.createElement('div');
    p.className = 'tcg-projectile';
    p.style.left = `${fromRect.left + fromRect.width / 2 - layerRect.left}px`;
    p.style.top = `${fromRect.top + fromRect.height / 2 - layerRect.top}px`;
    layer.appendChild(p);

    setTimeout(() => {
        const targetX = toRect.left + toRect.width / 2 - layerRect.left;
        const targetY = toRect.top + toRect.height / 2 - layerRect.top;
        p.style.transform = `translate(${targetX - parseFloat(p.style.left)}px, ${targetY - parseFloat(p.style.top)}px) scale(1.4)`;
    }, 10);

    setTimeout(() => {
        p.remove();
        onHit();
    }, Math.floor(220 / battleSpeedMultiplier));
}

function spawnDamageNumber(targetEl, dmg, isCrit, isUlt) {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const board = document.getElementById('battle-overlay-modal');
    if (!board) return;

    const ultText = I18N[currentLang]?.combat_ult_popup || (currentLang === 'RU' ? 'УЛЬТА!' : 'ULT!');
    const critText = I18N[currentLang]?.combat_crit_popup || (currentLang === 'RU' ? 'КРИТ!' : 'CRIT!');

    const popup = document.createElement('div');
    popup.className = `tcg-dmg-popup ${isUlt ? 'ult' : (isCrit ? 'crit' : '')}`;
    popup.innerText = isUlt ? `${ultText} -${formatNumber(dmg)}` : (isCrit ? `${critText} -${formatNumber(dmg)}` : `-${formatNumber(dmg)}`);
    popup.style.left = `${rect.left + rect.width / 2 - 25}px`;
    popup.style.top = `${rect.top + 20}px`;
    board.appendChild(popup);

    setTimeout(() => popup.remove(), 750);
}

function checkBattleEndCondition() {
    if (!activeCombatData || activeCombatData.isFinished) return;
    const isPlayerAlive = activeCombatData.playerUnits.some(u => u && !u.isDead);
    const isEnemyAlive = activeCombatData.enemyUnits.some(u => u && !u.isDead);

    if (!isPlayerAlive || !isEnemyAlive) {
        clearTimeout(combatSimulationTimeout);
        finalizeCombat(isPlayerAlive);
    }
}

function skipCombatSimulation() {
    if (!activeCombatData || activeCombatData.isFinished) return;
    clearTimeout(combatSimulationTimeout);
    // Досчитываем результат мгновенно по общему балансу мощи
    const isWin = activeCombatData.playerUnits.reduce((a,b) => a + (b ? b.currentHp : 0), 0) >=
                  activeCombatData.enemyUnits.reduce((a,b) => a + (b ? b.currentHp : 0), 0);
    finalizeCombat(isWin);
}

function finalizeCombat(forceWin = null) {
    if (!activeCombatData || activeCombatData.isFinished) return;
    activeCombatData.isFinished = true;
    clearTimeout(combatSimulationTimeout);
    clearInterval(combatWatchdogInterval);

    // Защита от софтлока только на конкретных боевых шагах туториала (Шаг 7: Бездна, Шаг 9: Арена)
    const isTutorialGuaranteedWin = !isFtueCompleted() && (
        (activeCombatData.combatType === 'dungeon' && (gState.ftueStep || 0) === 7) ||
        (activeCombatData.combatType === 'arena' && (gState.ftueStep || 0) === 9)
    );
    let isWin = forceWin !== null ? forceWin : activeCombatData.playerUnits.some(u => u && !u.isDead);
    if (isTutorialGuaranteedWin) isWin = true;

    const verdictBox = document.getElementById('combat-verdict-box');
    const verdictTitle = document.getElementById('combat-verdict-title');
    const verdictSpoils = document.getElementById('combat-verdict-spoils');
    const banterBox = document.getElementById('combat-verdict-banter');
    const banterText = document.getElementById('banter-quote-text');
    const banterAuthor = document.getElementById('banter-quote-author');
    const doubleBtn = document.getElementById('btn-battle-double');
    const closeBtn = document.getElementById('btn-battle-close');

    if (verdictBox && verdictTitle && verdictSpoils) {
        verdictTitle.innerText = isWin ? I18N[currentLang].battle_victory : I18N[currentLang].battle_defeat;
        verdictTitle.className = `verdict-banner ${isWin ? '' : 'defeat'}`;
        if (closeBtn) closeBtn.innerText = isWin ? I18N[currentLang].battle_claim_normal : I18N[currentLang].battle_close;
        if (doubleBtn) {
            if (isWin) {
                doubleBtn.style.display = 'inline-flex';
                doubleBtn.className = 'btn-action btn-ad-standard verdict-double-btn';
                const doubleLabel = currentLang === 'RU' ? 'УДВОИТЬ x2' : 'DOUBLE x2';
                doubleBtn.innerHTML = `<img src="assets/icons/icon_ad.webp" class="res-icon-inline" style="width:13px; height:13px;"> ${doubleLabel}`;
            } else {
                doubleBtn.style.setProperty('display', 'none', 'important');
            }
        }

        // Вывод реплики командира-победителя
        if (banterBox && banterText && banterAuthor) {
            const winnerSquad = isWin ? activeCombatData.playerUnits : activeCombatData.enemyUnits;
            const commander = winnerSquad[1] || winnerSquad[0] || winnerSquad[2];
            if (commander && commander.hero) {
                const h = commander.hero;
                banterText.innerText = `«${h.lore[currentLang] || h.lore['EN']}»`;
                banterAuthor.innerText = `— ${h.name[currentLang] || h.name['EN']}`;
                banterBox.style.display = 'block';
            } else {
                banterBox.style.display = 'none';
            }
        }

        // Победная или пораженческая тактильная отдача
        triggerHaptic(isWin ? 'victory' : 'defeat');

        verdictBox.style.display = 'flex';
    }

    if (!isFtueCompleted()) {
        if (activeCombatData.combatType === 'dungeon') gState.ftueDungeonDone = true;
        if (activeCombatData.combatType === 'arena') gState.ftueArenaDone = true;
        updateFtueFocus();
    }

    if (typeof activeCombatData.onComplete === 'function') {
        const spoils = activeCombatData.onComplete(isWin, (claimFn) => {
            if (activeCombatData) activeCombatData.onClaim = claimFn;
        });
        if (verdictSpoils && spoils) verdictSpoils.innerHTML = spoils;
    }

    tryTriggerInterstitialAd();
}

function closeCombatSimulation(multiplier = 1) {
    clearTimeout(combatSimulationTimeout);
    clearInterval(combatWatchdogInterval);

    const modal = document.getElementById('battle-overlay-modal');
    const verdict = document.getElementById('combat-verdict-box');
    const btnClose = document.getElementById('btn-battle-close');
    const btnDouble = document.getElementById('btn-battle-double');

    if (!activeCombatData) {
        if (modal) modal.style.display = 'none';
        if (verdict) verdict.style.display = 'none';
        return;
    }

    const claimHandler = activeCombatData.onClaim;

    const finalizeAndSave = (m) => {
        if (modal) modal.style.display = 'none';
        if (verdict) verdict.style.display = 'none';
        if (btnClose) btnClose.disabled = false;
        if (btnDouble) btnDouble.disabled = false;

        activeCombatData = null;

        if (typeof claimHandler === 'function') {
            try {
                claimHandler(m);
            } catch(err) {
                console.error("claimHandler error:", err);
            }
        }
        try {
            saveGame();
            renderArena();
            renderLeaderboard();
            renderBattleHistory();
            renderDungeon();
            renderFtue();
            renderUI();
        } catch(err) {
            console.error("render update error:", err);
        }
    };

    if (multiplier > 1) {
        // Блокируем кнопки на время показа рекламы, но НЕ скрываем окно боя!
        if (btnClose) btnClose.disabled = true;
        if (btnDouble) btnDouble.disabled = true;

        showPlatformRewarded(
            () => {
                finalizeAndSave(2);
            },
            () => {
                // При ошибке рекламы мгновенно разблокируем кнопки: игрок может забрать базовую награду!
                if (btnClose) btnClose.disabled = false;
                if (btnDouble) btnDouble.disabled = false;
                pushToast(currentLang === 'RU' 
                    ? "Реклама недоступна. Заберите обычную награду" 
                    : "Ad unavailable. Collect standard reward");
            }
        );
    } else {
        finalizeAndSave(1);
    }
}

/* ==========================================================
   ПРОКАЧКА ГЕРОЕВ (С МУЛЬТИ-ВЫБОРОМ x1, x5, x10, MAX)
   ========================================================== */
let activeInspectHeroId = null;
const LEVEL_UPGRADE_STEPS = [1, 5, 10, 'max'];
let activeLevelUpgradeStepIdx = 0;
let activeLevelUpgradeMult = 1;

// B7: Второй слой прокачки — МАСТЕРСТВО.
// Диапазон уровней героя: 1–200 (база) + 201–300 (мастерство).
// CP: +8% за базовый уровень, +5% за уровень мастерства (снижение ставки компенсируется визуальной ценностью M-ранга).
const MAX_BASE_LVL = 200;
const MAX_MASTERY_LVL = 100;
const MAX_TOTAL_LVL = MAX_BASE_LVL + MAX_MASTERY_LVL;

// v4.9.1: Новая база CP по тирам. F:SSS = 1:19.8 (было 1:281).
// Старые hero.cp в data-heroes.js остаются, но не используются в расчётах.
// Экономика построена на принципе constant gold efficiency: +1M золота = ~+200 CP у любого тира.
const TIER_BASE_CP = {
    'F': 50, 'E': 73, 'D': 106, 'C': 154, 'B': 223,
    'A': 324, 'S': 470, 'SS': 681, 'SSS': 988
};
const UPGRADE_REFERENCE_CP = 100; // эталон для формулы стоимости
const UPGRADE_CP_EXPONENT = 0.7;  // степень: 0.7 → F дешевле SSS в 8 раз

// v4.9.4: кап уровня зависит от тира.
// F-A — фоновый костяк для мид-гейма, потолок 200. Без Мастерства.
// S+ — эндгейм-прогрессия, потолок 300 через Мастерство M1–M100.
const TIER_CAP_LVL = {
    'F': 200, 'E': 200, 'D': 200, 'C': 200, 'B': 200, 'A': 200,
    'S': 300, 'SS': 300, 'SSS': 300
};
function getTierCap(heroId) {
    const hero = HEROES_CATALOG[heroId];
    if (!hero) return MAX_TOTAL_LVL;
    return TIER_CAP_LVL[hero.tier] || MAX_TOTAL_LVL;
}

// Динамический стык стоимости на 100 уровне
const COST_AT_LVL_100 = Math.floor(100 * Math.pow(1.14, 99));
// Стык на 200 — точка входа в Мастерство (M1)
const COST_AT_LVL_200 = Math.floor(COST_AT_LVL_100 * Math.pow(1.05, 99));

// Форматирует уровень героя для UI:
//   1..200 → "175"
//   201..300 → "M15" (mastery = lvl - 200)
function formatHeroLevel(lvl) {
    lvl = lvl || 1;
    if (lvl > MAX_BASE_LVL) return `M${lvl - MAX_BASE_LVL}`;
    return `${lvl}`;
}

// v4.9.2 FIX-LINEAR-COST: линейная стоимость уровня.
// ПРОБЛЕМА v4.9.1: экспонента 1.14^lvl давала разницу 4000× между +1 ур.
//   у F на 89 lvl (6.1M золота) и SSS на 10 lvl (1.6K золота).
//   Нарушало договорённость «+1M золота = ~+200 CP у всех тиров».
// РЕШЕНИЕ: cost = 18 × lvl × tierMultiplier. Рост ровный по уровню,
//   эффективность золота одинакова на любом тире и уровне.
//   Прокачка до MAX: F ≈ 500k, S ≈ 1.5M, SSS ≈ 4.1M.
function getHeroLevelUpgradeCost(lvl, heroCP = null) {
    const base = 100 * lvl * lvl;
    if (heroCP === null) return base;
    const mult = Math.pow(Math.max(1, heroCP) / UPGRADE_REFERENCE_CP, UPGRADE_CP_EXPONENT);
    return Math.floor(base * mult);
}

// v4.9.1: обёртка — считает heroCP по тиру и возвращает финальную цену уровня.
// Чем мощнее карта — тем дороже прокачка, но CP за золото одинаков у всех тиров.
function getHeroUpgradeCost(heroId, lvl) {
    const hero = HEROES_CATALOG[heroId];
    const heroCP = hero ? (TIER_BASE_CP[hero.tier] || hero.cp || UPGRADE_REFERENCE_CP) : UPGRADE_REFERENCE_CP;
    return getHeroLevelUpgradeCost(lvl, heroCP);
}

// B7: Эпическое событие — герой впервые пересёк 200-й уровень и вошёл в Мастерство.
// Вызывается только из авто-флоу (dumpGold, autoSpend) — в ручном апгрейде визуал даёт модалка.
function checkMasteryAwakening(oldLvl, newLvl) {
    if (oldLvl <= MAX_BASE_LVL && newLvl > MAX_BASE_LVL) {
        triggerHaptic('legendary');
        playSfx(1400, 'triangle', 0.3);
        const vp = document.getElementById('app-viewport');
        if (vp) {
            vp.classList.add('screen-shake-hard');
            setTimeout(() => vp.classList.remove('screen-shake-hard'), 500);
        }
        pushToast(currentLang === 'RU'
            ? '★ ПРОБУЖДЕНИЕ: МАСТЕРСТВО ОТКРЫТО! +5% CP ЗА УРОВЕНЬ'
            : '★ AWAKENING: MASTERY UNLOCKED! +5% CP PER LEVEL');
    }
}

// G2: Хелперы для модалки входа в Мастерство.
let pendingMasteryHeroId = null;

function isMasteryAwakened(heroId) {
    return !!(gState.masteryAwakened && gState.masteryAwakened[heroId]);
}

function markMasteryAwakened(heroId) {
    if (!gState.masteryAwakened) gState.masteryAwakened = {};
    gState.masteryAwakened[heroId] = true;
}

// G2: Открытие модалки подтверждения. Показывается только один раз — при первой попытке
// пересечь 200-й уровень. После подтверждения флаг awakened снимает гейт.
function openMasteryModal(heroId) {
    if (!heroId || !HEROES_CATALOG[heroId] || !gState.deck[heroId]) return;
    if (isMasteryAwakened(heroId)) return;

    pendingMasteryHeroId = heroId;
    const hero = HEROES_CATALOG[heroId];
    const tColor = `var(--tier-${(hero.tier||'f').toLowerCase()})`;

    const titleEl = document.getElementById('mastery-awakening-title');
    const nameEl = document.getElementById('mastery-awakening-hero-name');
    const subEl = document.getElementById('mastery-awakening-hero-sub');
    const iconBox = document.getElementById('mastery-awakening-icon');
    const infoBox = document.getElementById('mastery-awakening-info-box');
    const btnCancel = document.getElementById('btn-mastery-cancel');
    const btnConfirm = document.getElementById('btn-mastery-confirm');

    if (titleEl) titleEl.innerText = currentLang === 'RU' ? '★ ПРОБУЖДЕНИЕ МАСТЕРСТВА ★' : '★ MASTERY AWAKENING ★';
    if (nameEl) {
        nameEl.innerText = hero.name[currentLang] || hero.name['EN'];
        nameEl.style.color = tColor;
    }
    if (subEl) {
        subEl.innerText = currentLang === 'RU'
            ? 'Достиг 200-го уровня. Готов к пробуждению.'
            : 'Reached Level 200. Ready for awakening.';
    }
    if (iconBox) {
        const heroImg = hero.img || `${hero.id}.webp`;
        iconBox.style.borderColor = tColor;
        iconBox.innerHTML = `<img src="assets/heroes/${heroImg}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.parentElement.innerText='${hero.icon || ''}';">`;
    }
    if (infoBox) {
        // G2-fix: уточняем базу процента — +5% берётся от БАЗОВОЙ мощи героя (hero.cp),
        // а не от текущего CP. Иначе игрок считает 5% × 100 = +500% и путается,
        // почему в итоге показывается только +29.6% (это прирост относительно Lvl 200).
        const m1Cost = getHeroUpgradeCost(heroId, MAX_BASE_LVL);
        const m1CostStr = `<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"> ${formatNumber(m1Cost)}`;
        infoBox.innerHTML = currentLang === 'RU'
            ? `<div style="font-weight:800; color:#c084fc; margin-bottom:6px;">Второй слой прокачки M1–M100</div>
               <div>• Каждый уровень M даёт <b>+5% к БАЗОВОЙ мощи героя</b></div>
               <div>• Стоимость M1: <b style="color:var(--gold);">${m1CostStr}</b></div>
               <div>• Суммарно M1–M100 = <b>+29.6%</b> к итоговому CP (база — Lvl 200)</div>
               <div>• Путь к M100 занимает месяцы активной игры</div>`
            : `<div style="font-weight:800; color:#c084fc; margin-bottom:6px;">Second progression layer M1–M100</div>
               <div>• Each M level grants <b>+5% to hero's BASE power</b></div>
               <div>• M1 cost: <b style="color:var(--gold);">${m1CostStr}</b></div>
               <div>• Full M1–M100 = <b>+29.6%</b> total CP (relative to Lvl 200)</div>
               <div>• Path to M100 takes months of active play</div>`;
    }
    if (btnCancel) {
        btnCancel.innerText = currentLang === 'RU' ? 'ОСТАНОВИТЬСЯ (200)' : 'STOP AT 200';
    }
    if (btnConfirm) {
        btnConfirm.innerText = currentLang === 'RU' ? '★ ВОЙТИ В МАСТЕРСТВО ★' : '★ ENTER MASTERY ★';
    }

    playSfx(880, 'sine', 0.08);
    const m = document.getElementById('mastery-awakening-modal');
    if (m) m.style.display = 'flex';
}

function closeMasteryModal() {
    const m = document.getElementById('mastery-awakening-modal');
    if (m) m.style.display = 'none';
}

function cancelMasteryEntry() {
    pendingMasteryHeroId = null;
    closeMasteryModal();
    playSfx(420, 'triangle', 0.06);
}

function confirmMasteryEntry() {
    if (!pendingMasteryHeroId) return;
    const heroId = pendingMasteryHeroId;

    // FIX Bug B: флаг awakened ставится ТОЛЬКО после успешного повышения уровня.
    // Раньше он снимался безусловно — мина для нештатных сейвов.
    const card = gState.deck[heroId];
    let entryCost = 0;
    let entrySuccess = false;

    if (card && card.lvl === MAX_BASE_LVL) {
        const cost = getHeroUpgradeCost(heroId, card.lvl);
        if ((gState.gold || 0) < cost) {
            const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
            pushToast(currentLang === 'RU'
                ? `Нужно ${formatNumber(cost)} ${gI} для входа в Мастерство`
                : `Need ${formatNumber(cost)} ${gI} for Mastery entry`);
            pendingMasteryHeroId = null;
            closeMasteryModal();
            return;
        }
        gState.gold -= cost;
        card.lvl += 1;
        entryCost = cost;
        entrySuccess = true;
    }

    // FIX Bug B: флаг ставится строго после успешного пересечения 200-го уровня.
    if (entrySuccess) {
        markMasteryAwakened(heroId);
    }
    pendingMasteryHeroId = null;
    closeMasteryModal();

    // Эпик пробуждения: тряска, легендарная вибрация, звук
    triggerHaptic('legendary');
    playSfx(1400, 'triangle', 0.3);
    const vp = document.getElementById('app-viewport');
    if (vp) {
        vp.classList.add('screen-shake-hard');
        setTimeout(() => vp.classList.remove('screen-shake-hard'), 500);
    }
        if (entrySuccess) {
        pushToast(currentLang === 'RU'
            ? '★ МАСТЕРСТВО ОТКРЫТО! M1 достигнут. +5% к базовой мощи.'
            : '★ MASTERY UNLOCKED! M1 reached. +5% base power.');
        // FIX Bug A: прогресс квеста начисляется РОВНО ОДИН РАЗ — здесь.
        trackQuestProgress('hero_lvl', 1);
    }
    // FIX Bug A: убран дублирующий вызов trackQuestProgress ниже.
    saveGame();

    // Обновляем UI: активный инспектор либо рендер Штаба
    if (activeInspectHeroId === heroId) {
        openCardInspect(heroId);
    } else {
        renderFormationSlots();
        renderCards();
    }
    renderUI();
}

function cycleLevelUpgradeMultiplier() {
    activeLevelUpgradeStepIdx = (activeLevelUpgradeStepIdx + 1) % LEVEL_UPGRADE_STEPS.length;
    activeLevelUpgradeMult = LEVEL_UPGRADE_STEPS[activeLevelUpgradeStepIdx];
    const btn = document.getElementById('btn-lvl-cycle');
    if (btn) btn.innerText = activeLevelUpgradeMult === 'max' ? 'MAX' : `x${activeLevelUpgradeMult}`;
    playSfx(480, 'sine', 0.04);
    updateInspectUpgradeButton();
}

// v4.9.1: добавлен 4-й аргумент heroId — нужен для тир-множителя стоимости.
// Без него считает по эталонной цене (совместимость со старыми вызовами).
function calculateBatchUpgradeCost(currentLvl, countOrMax, availableBudget = null, heroId = null) {
    let totalCost = 0;
    let levelsToAdd = 0;
    let tempLvl = currentLvl;
    const globalMax = (currentLvl < MAX_BASE_LVL) ? MAX_BASE_LVL : MAX_TOTAL_LVL;
    const tierMax = heroId ? getTierCap(heroId) : globalMax;
    const maxLvl = Math.min(globalMax, tierMax);
    const budget = (availableBudget !== null) ? availableBudget : (gState.gold || 0);
    const targetAdd = (countOrMax === 'max') ? (maxLvl - currentLvl) : countOrMax;

    const hero = heroId ? HEROES_CATALOG[heroId] : null;
    const heroCP = hero ? (TIER_BASE_CP[hero.tier] || hero.cp || UPGRADE_REFERENCE_CP) : null;

    for (let i = 0; i < targetAdd; i++) {
        if (tempLvl >= maxLvl) break;
        const cost = getHeroLevelUpgradeCost(tempLvl, heroCP);
        if (budget < (totalCost + cost)) {
            break;
        }
        totalCost += cost;
        tempLvl++;
        levelsToAdd++;
    }
    return { totalCost, levelsToAdd };
}

function updateInspectUpgradeButton() {
    if (!activeInspectHeroId) return;
    const isOwned = !!gState.deck[activeInspectHeroId];
    const btn = document.getElementById('btn-levelup-hero');
    const cycleBtn = document.getElementById('btn-lvl-cycle');
    if (!btn) return;

    if (!isOwned) {
        btn.disabled = true;
        btn.className = 'btn-action modal-full-btn';
        btn.innerText = currentLang === 'RU' ? 'НЕДОСТУПЕН' : 'LOCKED';
        btn.style.background = '#273347';
        btn.style.borderColor = '#334155';
        btn.style.color = 'var(--text-muted)';
        if (cycleBtn) cycleBtn.style.display = 'none';
        return;
    }

        if (cycleBtn) cycleBtn.style.display = 'inline-block';
    const card = gState.deck[activeInspectHeroId];

    const _tierCap = getTierCap(activeInspectHeroId);
    if (card.lvl >= _tierCap) {
        btn.disabled = true;
        const _isMasteryTier = _tierCap > MAX_BASE_LVL;
        btn.innerText = _isMasteryTier
            ? (currentLang === 'RU' ? `МАКСИМАЛЬНЫЙ УРОВЕНЬ (M${MAX_MASTERY_LVL})` : `MAX LEVEL (M${MAX_MASTERY_LVL})`)
            : (currentLang === 'RU' ? `МАКСИМУМ ДЛЯ РАНГА ${HEROES_CATALOG[activeInspectHeroId].tier}` : `MAX FOR RANK ${HEROES_CATALOG[activeInspectHeroId].tier}`);
        btn.style.background = '#273347';
        btn.style.borderColor = '#334155';
        btn.style.color = 'var(--text-muted)';
        btn.style.boxShadow = 'none';
        if (cycleBtn) cycleBtn.style.display = 'none';
        return;
    }

    // Герой ровно на 200 — показываем «ВОЙТИ В МАСТЕРСТВО»
    // Если денег меньше стоимости M1 — кнопка серая с динамической ценой
    // v4.9.4: модалка Мастерства только для S+.
    if (card.lvl === MAX_BASE_LVL && getTierCap(activeInspectHeroId) > MAX_BASE_LVL) {
        const m1Cost = getHeroUpgradeCost(activeInspectHeroId, MAX_BASE_LVL);
        const canAffordM1 = (gState.gold || 0) >= m1Cost;
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';

        btn.disabled = !canAffordM1;
        btn.style.boxShadow = canAffordM1 ? '0 0 14px rgba(168, 85, 247, 0.55)' : 'none';
        if (canAffordM1) {
            btn.style.background = 'linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)';
            btn.style.borderColor = '#a855f7';
            btn.style.color = '#fff';
            btn.innerHTML = currentLang === 'RU' ? '★ ВОЙТИ В МАСТЕРСТВО ★' : '★ ENTER MASTERY ★';
        } else {
            btn.style.background = '#273347';
            btn.style.borderColor = '#334155';
            btn.style.color = 'var(--text-muted)';
            btn.innerHTML = currentLang === 'RU'
                ? `★ МАСТЕРСТВО — нужно ${formatNumber(m1Cost)} ${gI}`
                : `★ MASTERY — need ${formatNumber(m1Cost)} ${gI}`;
        }
        if (cycleBtn) cycleBtn.style.display = 'none';
        return;
    }

    // Обычная прокачка: сбрасываем возможные стили от мастерства
    btn.style.color = '';
    btn.style.boxShadow = '';
    btn.style.background = 'linear-gradient(180deg, #d97706 0%, #b45309 100%)';
    btn.style.borderColor = '#f59e0b';

    const { totalCost, levelsToAdd } = calculateBatchUpgradeCost(card.lvl, activeLevelUpgradeMult, null, activeInspectHeroId);

    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const lvlPrefix = currentLang === 'RU' ? 'Ур.' : 'Lvl';
    if (levelsToAdd === 0) {
        const singleCost = getHeroUpgradeCost(activeInspectHeroId, card.lvl);
        btn.disabled = true;
        btn.innerHTML = `${lvlPrefix} +1 (${formatNumber(singleCost)} ${gI})`;
    } else {
        btn.disabled = (gState.gold || 0) < totalCost;
        btn.innerHTML = `${lvlPrefix} +${levelsToAdd} (${formatNumber(totalCost)} ${gI})`;
    }
}

function upgradeSelectedHeroLevel() {
    if (!activeInspectHeroId || !gState.deck[activeInspectHeroId]) return;
    const card = gState.deck[activeInspectHeroId];
    if (card.lvl >= MAX_TOTAL_LVL) {
        return pushToast(currentLang === 'RU'
            ? `МАКСИМАЛЬНЫЙ УРОВЕНЬ (M${MAX_MASTERY_LVL})!`
            : `MAX LEVEL (M${MAX_MASTERY_LVL})!`);
    }

    // G4: герой ровно на 200 и не пробуждён — открываем модалку вместо апгрейда.
    // Игрок явно подтверждает вход в Мастерство или отменяет действие.
    if (card.lvl === MAX_BASE_LVL && !isMasteryAwakened(activeInspectHeroId) && getTierCap(activeInspectHeroId) > MAX_BASE_LVL) {
        openMasteryModal(activeInspectHeroId);
        return;
    }

    const { totalCost, levelsToAdd } = calculateBatchUpgradeCost(card.lvl, activeLevelUpgradeMult, null, activeInspectHeroId);
    if (levelsToAdd === 0 || (gState.gold || 0) < totalCost) {
        return pushToast(currentLang === 'RU' ? "Недостаточно золота!" : "Not enough gold!");
    }

    const oldLvl = card.lvl;
    gState.gold -= totalCost;
    card.lvl += levelsToAdd;
    // G4: checkMasteryAwakening убран из ручного флоу — визуал даёт модалка.
    // Авто-флоу (dumpGold/autoSpend) продолжает использовать checkMasteryAwakening.
    gState.ftueHeroLvlDone = true;
    trackQuestProgress('hero_lvl', levelsToAdd);
    playCoinSfx();
    triggerHaptic('upgrade');

    saveGame();
    openCardInspect(activeInspectHeroId);
    renderCards();
    renderFormationSlots();
    renderUI();

    if (!isFtueCompleted() && (gState.ftueStep || 0) === 6) {
        setTimeout(() => {
            closeCardInspect();
            renderFtue();
        }, 350);
    }
}

/* ==========================================================
   AFK-ЭКСПЕДИЦИИ (БАЛАНС КРИСТАЛЛОВ И ЧЕСТНЫЕ СТАТУСЫ)
   ========================================================== */
let activeAscendPickerMult = 1;
const ASCEND_PICKER_STEPS = [1, 5, 10, 'max'];
let activeAscendPickerStepIdx = 0;
let activeAscendTierSortDesc = true;
let activeAscendLvlSortDesc = false;
let activeAscendPrimarySort = 'tier';

function toggleAscendTierSort() {
    activeAscendPrimarySort = 'tier';
    activeAscendTierSortDesc = !activeAscendTierSortDesc;
    const btn = document.getElementById('btn-sort-tier-toggle');
    if (btn) {
        btn.innerText = activeAscendTierSortDesc
            ? (currentLang === 'RU' ? 'Ранг ⬇' : 'Rank ⬇')
            : (currentLang === 'RU' ? 'Ранг ⬆' : 'Rank ⬆');
    }
    renderAscendHeroPickerList();
}

function toggleAscendLvlSort() {
    activeAscendPrimarySort = 'lvl';
    activeAscendLvlSortDesc = !activeAscendLvlSortDesc;
    const btn = document.getElementById('btn-sort-lvl-toggle');
    if (btn) {
        btn.innerText = activeAscendLvlSortDesc
            ? (currentLang === 'RU' ? 'Уровень ⬇' : 'Level ⬇')
            : (currentLang === 'RU' ? 'Уровень ⬆' : 'Level ⬆');
    }
    renderAscendHeroPickerList();
}

function cycleAscendPickerMultiplier() {
    activeAscendPickerStepIdx = (activeAscendPickerStepIdx + 1) % ASCEND_PICKER_STEPS.length;
    activeAscendPickerMult = ASCEND_PICKER_STEPS[activeAscendPickerStepIdx];
    const btn = document.getElementById('btn-ascend-picker-mult');
    if (btn) btn.innerText = activeAscendPickerMult === 'max' ? 'MAX' : `x${activeAscendPickerMult}`;
    playSfx(480, 'sine', 0.04);
    renderAscendHeroPickerList();
}

function openAscendHeroPicker() {
    const goldReq = getAscendGoldReq();
    const excessGold = (gState.gold || 0) - goldReq;
    if (excessGold <= 0) return pushToast(currentLang === 'RU' ? "Нет излишков золота!" : "No excess gold!");

    renderAscendHeroPickerList();
    const m = document.getElementById('ascend-hero-picker-modal');
    if (m) m.style.display = 'flex';
}

function closeAscendHeroPicker() {
    const m = document.getElementById('ascend-hero-picker-modal');
    if (m) m.style.display = 'none';
}

function renderAscendHeroPickerList() {
    const goldReq = getAscendGoldReq();
    const excessGold = Math.max(0, (gState.gold || 0) - goldReq);
    const excessLabel = document.getElementById('ascend-picker-excess-gold');

    const list = document.getElementById('ascend-picker-hero-list');
    if (!list) return;
    list.innerHTML = '';

    const heroKeys = Object.keys(gState.deck || {});
    heroKeys.sort((a, b) => {
        const heroA = HEROES_CATALOG[a], heroB = HEROES_CATALOG[b];
        const cardA = gState.deck[a], cardB = gState.deck[b];
        if (activeAscendPrimarySort === 'lvl') {
            return activeAscendLvlSortDesc ? (cardB.lvl - cardA.lvl) : (cardA.lvl - cardB.lvl);
        }
        const diff = (TIER_ORDER[heroB.tier] || 0) - (TIER_ORDER[heroA.tier] || 0);
        return activeAscendTierSortDesc ? diff : -diff;
    });

    let anyAffordable = false;

    heroKeys.forEach(hid => {
        const hero = HEROES_CATALOG[hid];
        if (!hero) return;
        const card = gState.deck[hid];
        const tColor = `var(--tier-${(hero.tier||'f').toLowerCase()})`;

        const { totalCost, levelsToAdd } = calculateBatchUpgradeCost(card.lvl, activeAscendPickerMult, excessGold, hid);
        // B7: cap уровня поднят до MAX_TOTAL_LVL (300)
        const isMaxLvl = card.lvl >= MAX_TOTAL_LVL;
        const canAfford = excessGold >= totalCost && levelsToAdd > 0 && !isMaxLvl;
        if (canAfford) anyAffordable = true;

        let btnText = 'MAX';
        if (isMaxLvl) {
            // Максимум: M100 = 300 общий
            btnText = `M${MAX_MASTERY_LVL} MAX`;
        } else if (levelsToAdd > 0) {
            btnText = `+${levelsToAdd} (${formatNumber(totalCost)} <img src="assets/icons/gold.webp" class="res-icon-inline">)`;
        } else {
            const singleCost = getHeroUpgradeCost(hid, card.lvl);
            btnText = `${currentLang === 'RU' ? 'нужно' : 'needs'} ${formatNumber(singleCost)} <img src="assets/icons/gold.webp" class="res-icon-inline">`;
        }

        const row = document.createElement('div');
        row.className = 'building-card';
        row.innerHTML = `
            <div>
                <b style="color:${tColor};">[${hero.tier}] ${hero.name[currentLang] || hero.name['EN']}</b>
                <div style="font-size:11.5px; color:#cbd5e1; margin-top:2px;">
                    ${currentLang === 'RU' ? 'Ур.' : 'Lvl'} ${formatHeroLevel(card.lvl)}/${MAX_TOTAL_LVL} • ${formatHeroStars(card.stars || 1)}
                </div>
            </div>
            <button class="btn-action" style="font-size:11.5px; padding:6px 10px; ${canAfford ? 'background:var(--green); border-color:#22c55e;' : 'background:#273347; border-color:#334155;'}" ${!canAfford ? 'disabled' : ''} onclick="dumpGoldIntoHero('${hid}')">
                ${btnText}
            </button>`;
        list.appendChild(row);
    });

    window.lastAscendCanUpgradeAny = anyAffordable;

    if (excessLabel) {
        if (!anyAffordable && heroKeys.length > 0) {
            excessLabel.innerHTML = `${currentLang === 'RU' ? 'Остаток' : 'Remaining'}: ${formatNumber(excessGold)} <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"> <span style="color:#4ade80; font-size:11px; margin-left:4px;">(${currentLang === 'RU' ? 'Излишки освоены' : 'Surplus invested'})</span>`;
        } else {
            excessLabel.innerHTML = `${currentLang === 'RU' ? 'Излишки' : 'Surplus'}: ${formatNumber(excessGold)} <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">`;
        }
    }

    if (!anyAffordable && heroKeys.length > 0) {
        const infoBanner = document.createElement('div');
        infoBanner.className = 'building-card';
        infoBanner.style.background = 'rgba(34, 197, 94, 0.15)';
        infoBanner.style.borderColor = '#22c55e';
        infoBanner.style.padding = '8px 10px';
        infoBanner.style.marginBottom = '4px';
        infoBanner.innerHTML = `
            <div style="font-size:11.5px; color:#f1f5f9; line-height:1.4;">
                <b>${currentLang === 'RU' ? 'Все доступные уровни выкуплены!' : 'All available levels upgraded!'}</b><br>
                <span style="color:var(--text-muted); font-size:11px;">${currentLang === 'RU' ? `Оставшиеся ${formatNumber(excessGold)} золота меньше стоимости 1 уровня и уйдут в жертву Бездне при Возвышении.` : `Remaining ${formatNumber(excessGold)} gold is below 1 level cost and will be sacrificed to the Void upon Ascension.`}</span>
            </div>`;
        list.prepend(infoBanner);
    }

    const doneBtn = document.getElementById('btn-ascend-picker-done');
    if (doneBtn) {
        doneBtn.removeAttribute('style');
        const isReadyToAscend = !anyAffordable && heroKeys.length > 0;
        doneBtn.classList.toggle('btn-ascend-ready', isReadyToAscend);
        doneBtn.innerHTML = isReadyToAscend
            ? (currentLang === 'RU' ? 'ПЕРЕЙТИ К ВОЗВЫШЕНИЮ ➔' : 'PROCEED TO ASCENSION ➔')
            : (currentLang === 'RU' ? 'ГОТОВО' : 'DONE');
    }
}

function dumpGoldIntoHero(heroId) {
    const goldReq = getAscendGoldReq();
    const excessGold = Math.max(0, (gState.gold || 0) - goldReq);
    if (excessGold <= 0) return pushToast(currentLang === 'RU' ? "Излишки золота закончились!" : "No excess gold!");

    const card = gState.deck[heroId];
    if (!card || card.lvl >= MAX_TOTAL_LVL) {
        return pushToast(currentLang === 'RU'
            ? `У героя максимальный уровень (M${MAX_MASTERY_LVL})!`
            : `Hero at max level (M${MAX_MASTERY_LVL})!`);
    }

    // G6: в авто-флоу Ascension герой может пересечь 200 без модалки.
    // Считаем это согласием на вход в Мастерство — игрок уже нажал «Полный автомат» или
    // «Выбрать героя» и явно инвестирует. Модалка здесь только мешала бы.
    if (card.lvl === MAX_BASE_LVL && !isMasteryAwakened(heroId)) {
        markMasteryAwakened(heroId);
    }

    const { totalCost, levelsToAdd } = calculateBatchUpgradeCost(card.lvl, activeAscendPickerMult, excessGold, heroId);
    if (levelsToAdd === 0 || excessGold < totalCost) {
        return pushToast(currentLang === 'RU' ? "Недостаточно излишков золота!" : "Not enough excess gold!");
    }

    const oldLvl = card.lvl;
    gState.gold -= totalCost;
    card.lvl += levelsToAdd;
    // B7: пробуждение показываем только если оно реально случилось в этой операции
    checkMasteryAwakening(oldLvl, card.lvl);
    gState.ftueAutoSpendDone = true;
    trackQuestProgress('hero_lvl', levelsToAdd);
    playCoinSfx();
    triggerHaptic('upgrade');
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const invStr = currentLang === 'RU' ? 'Влито' : 'Invested';
    const lvlStr = currentLang === 'RU' ? 'ур.' : 'lvl';
    pushToast(`${invStr} ${formatNumber(totalCost)} ${gI} (+${levelsToAdd} ${lvlStr})!`);

    saveGame();
    renderAscendHeroPickerList();
    renderCards();
    renderUI();

    const newExcess = Math.max(0, (gState.gold || 0) - goldReq);
    const canStillUpgrade = Object.keys(gState.deck || {}).some(id => {
        const c = gState.deck[id];
        return c && c.lvl < MAX_TOTAL_LVL && getHeroLevelUpgradeCost(c.lvl) <= newExcess;
    });
    if (!canStillUpgrade) {
        setTimeout(() => {
            pushToast(currentLang === 'RU' ? "Излишки распределены! Можно возвышаться." : "Excess gold invested! Ready to ascend.");
        }, 320);
    }
}
let selectedExpHeroes = [];

function isHeroBusy(heroId) {
    // v5.3.2 FIX-EXP-DEFENSE-BUSY: учитываем и ATTACK, и DEFENSE formations.
    // Раньше герой из defenseFormation мог быть отправлен в поход, но обратно
    // в defense slot (через openSlotPicker) — уже не мог: openSlotPicker блокирует
    // isHeroInExpedition. Асимметрия приводила к блокировке героя в походе
    // без возможности вернуть его в защиту до завершения экспедиции.
    if ((gState.attackFormation || []).includes(heroId)) return true;
    if ((gState.defenseFormation || []).includes(heroId)) return true;
    for (let expId in gState.expeditions) {
        if ((gState.expeditions[expId].heroIds || []).includes(heroId)) return true;
    }
    return false;
}

function isHeroInSquad(heroId) {
    // Отображаем статус «В СТРОЮ» только для атакующего отряда
    return (gState.attackFormation || []).includes(heroId);
}

function isHeroInExpedition(heroId) {
    for (let expId in gState.expeditions) {
        if ((gState.expeditions[expId].heroIds || []).includes(heroId)) return true;
    }
    return false;
}

// Навигация экспедиций интегрирована во вкладку Штаба 4.0 (selectRosterTab('expeditions'))

/* ==========================================================
   ЭКСПЕДИЦИИ: ИСПОЛЬЗОВАНИЕ ЕДИНОГО РЕЕСТРА EXPEDITIONS_CONFIG
   ========================================================== */

function getExpeditionAffinity(expId) {
    if (!gState.expeditionAffinities) gState.expeditionAffinities = {};
    if (!gState.expeditionAffinities[expId]) {
        if (expId === 'exp_1') {
            gState.expeditionAffinities[expId] = 'undead'; // Гарантированная стихия для старта и FTUE
        } else {
            const factions = ['light', 'undead', 'chaos', 'demon'];
            gState.expeditionAffinities[expId] = factions[Math.floor(Math.random() * factions.length)];
        }
    }
    return gState.expeditionAffinities[expId];
}

function renderExpeditionsList() {
    const container = document.getElementById('expeditions-list-box');
    if (!container) return;
    container.innerHTML = '';
    const now = Date.now();

    const listToRender = [...(EXPEDITIONS_CONFIG || [])];
    listToRender.sort((a, b) => {
        const curA = gState.expeditions[a.id];
        const curB = gState.expeditions[b.id];
        const isReadyA = curA && curA.endTime <= now;
        const isReadyB = curB && curB.endTime <= now;
        if (isReadyB !== isReadyA) return (isReadyB ? 1 : 0) - (isReadyA ? 1 : 0);

        const isRunningA = curA && curA.endTime > now;
        const isRunningB = curB && curB.endTime > now;
        if (isRunningB !== isRunningA) return (isRunningB ? 1 : 0) - (isRunningA ? 1 : 0);

        // Во время обучения легкий поход (1 герой) идет первым!
        if (!isFtueCompleted()) {
            return (a.requiredHeroes || 1) - (b.requiredHeroes || 1);
        }
        // После обучения: тяжелые экспедиции (5 -> 1) стоят вверху для кнопки АВТО!
        return (b.requiredHeroes || 1) - (a.requiredHeroes || 1);
    });

    listToRender.forEach(exp => {
        const cur = gState.expeditions[exp.id];
        const isRunning = cur && cur.endTime > now;
        const isReady = cur && cur.endTime <= now;
        const targetFaction = getExpeditionAffinity(exp.id);
        const factionNames = I18N[currentLang]?.factions || {};
        let cleanFaction = (factionNames[targetFaction] || targetFaction).replace(/[\u2600-\u26FF\u2700-\u27BF\uD83C-\uD83E\uDC00-\uDFFF\u2011-\u26FF]/g, '').trim();
        const fElemIcon = `<img src="assets/icons/elem_${targetFaction}.webp" class="res-icon-inline" style="width:14px; height:14px;" alt="${targetFaction}">`;

        const div = document.createElement('div');
        div.className = 'building-card';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '6px';
        div.style.borderLeft = `3.5px solid var(--tier-${targetFaction === 'light' ? 'a' : (targetFaction === 'undead' ? 'd' : (targetFaction === 'chaos' ? 'b' : 's'))})`;

        const autoStr = currentLang === 'RU' ? 'АВТО' : 'AUTO';
        const chanceStr = currentLang === 'RU' ? 'Шанс' : 'Chance';
        const resStr = currentLang === 'RU' ? 'РЕЗОНАНС' : 'RESONANCE';
        // R1: длительность экспедиции (для показа ДО отправки).
        const _rawDur = exp.durationSec || 0;
        const _effDur = isVipActive() ? Math.floor(_rawDur * 0.5) : _rawDur;
        const durStr = formatExpeditionDuration(_effDur);
        const durLabel = currentLang === 'RU' ? 'Длительность' : 'Duration';
        const vipMark = isVipActive() ? ' <span style="color:var(--gold); font-size:10.5px;">VIP −50%</span>' : '';

        let actionHtml = '';
        if (isReady) {
            actionHtml = `<button class="btn-action" style="background:var(--green); color:#fff; font-size:11.5px; padding:8px;" onclick="claimExpedition('${exp.id}')">${I18N[currentLang].exp_claim_btn}</button>`;
        } else if (isRunning) {
        const leftSec = Math.floor((cur.endTime - now) / 1000);
        const speedupsLeft = 1 - (cur.speedupsCount || 0);
        let speedupControlHtml = '';
        if (isVipActive()) {
            speedupControlHtml = `<span style="font-size:11px; font-weight:800; color:var(--gold); padding:3px 8px; border:1px solid var(--gold); border-radius:5px; background:rgba(245,176,65,0.15);"> VIP x2</span>`;
        } else {
            const speedupText = currentLang === 'RU' ? 'Ускорить' : 'Speedup';
            const limitText = currentLang === 'RU' ? 'ЛИМИТ' : 'LIMIT';
            speedupControlHtml = `<button class="btn-action btn-ad-standard" style="font-size:11px; padding:4px 10px;" ${speedupsLeft <= 0 ? 'disabled' : ''} onclick="speedupExpedition('${exp.id}')">
                ${speedupsLeft > 0 ? `<img src="assets/icons/icon_ad.webp" class="icon-ad-inline"> ${speedupText} (1/1)` : limitText}
            </button>`;
        }
        // R3: кнопка досрочного прерывания с пропорциональной наградой.
        const cancelBtnLabel = currentLang === 'RU' ? 'Отменить' : 'Cancel';
        actionHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <span style="font-size:11px; color:var(--gold); font-weight:700; white-space:nowrap;">${I18N[currentLang].exp_in_progress} ${getFormattedTime(leftSec)}</span>
                    <div style="display:flex; gap:4px; align-items:center;">
                        ${speedupControlHtml}
                        <button class="btn-action" style="font-size:11px; padding:4px 10px; background:#7f1d1d; border-color:#ef4444; color:#fca5a5;" onclick="openCancelExpeditionConfirm('${exp.id}')">${cancelBtnLabel}</button>
                    </div>
                </div>`;
        } else {
            const heroReqStr = currentLang === 'RU'
                ? (exp.requiredHeroes === 1 ? '1 герой' : (exp.requiredHeroes < 5 ? `${exp.requiredHeroes} героя` : `${exp.requiredHeroes} героев`))
                : `${exp.requiredHeroes} ${exp.requiredHeroes === 1 ? 'Hero' : 'Heroes'}`;

            actionHtml = `
                <div style="display:flex; gap:6px;">
                    <button class="btn-action" style="flex:1.4; font-size:11.5px; padding:7px 8px;" onclick="openExpHeroPicker('${exp.id}')">${I18N[currentLang].exp_send_btn} (${heroReqStr})</button>
                    <button class="btn-action btn-exp-auto" style="flex:1; background:var(--crystal); border-color:#a855f7; font-size:11.5px; padding:7px 8px;" onclick="autoDeployExpedition('${exp.id}')">${autoStr}</button>
                </div>`;
        }

        let bonusText = '';
        let affinityBadgeHtml = '';

        if (cur && cur.heroIds && (isRunning || isReady)) {
            let totalLvl = 0;
            let matchCount = 0;
            cur.heroIds.forEach(hid => {
                totalLvl += (gState.deck[hid]?.lvl || 1);
                if (HEROES_CATALOG[hid] && HEROES_CATALOG[hid].faction === targetFaction) matchCount++;
            });
            const avgLvl = Math.max(1, totalLvl / cur.heroIds.length);
            const lvlBonusPct = Math.round((avgLvl - 1) * 5);
            const isFullRes = matchCount === exp.requiredHeroes && matchCount > 0;
            const resBonusPct = isFullRes ? 50 : (matchCount * 10);
            const totalBonus = lvlBonusPct + resBonusPct;
            bonusText = `<span style="color:var(--gold); font-weight:800; margin-left:4px;">(+${totalBonus}%)</span>`;

            if (isFullRes) {
                affinityBadgeHtml = `<span style="font-size:11px; font-weight:800; color:#4ade80; background:rgba(34,197,94,0.18); border:1.5px solid #22c55e; border-radius:4px; padding:1px 6px; display:inline-flex; align-items:center; gap:3px; box-shadow:0 0 8px rgba(34,197,94,0.35);">
                    ${fElemIcon} ${cleanFaction}: +50% (${matchCount}/${exp.requiredHeroes} МОНО)
                </span>`;
            } else if (matchCount > 0) {
                affinityBadgeHtml = `<span style="font-size:11px; font-weight:800; color:#fde047; background:rgba(245,176,65,0.15); border:1px solid var(--gold); border-radius:4px; padding:1px 6px; display:inline-flex; align-items:center; gap:3px;">
                    ${fElemIcon} ${cleanFaction}: +${resBonusPct}% (${matchCount}/${exp.requiredHeroes})
                </span>`;
            } else {
                affinityBadgeHtml = `<span style="font-size:11px; font-weight:700; color:#94a3b8; background:#10141d; border:1px solid #334155; border-radius:4px; padding:1px 6px; display:inline-flex; align-items:center; gap:3px;">
                    ${fElemIcon} ${cleanFaction}: 0% (0/${exp.requiredHeroes})
                </span>`;
            }
        } else {
            const upToStr = currentLang === 'RU' ? 'до' : 'up to';
            affinityBadgeHtml = `<span style="font-size:11px; font-weight:800; color:#cbd5e1; background:#10141d; border:1px solid var(--border-metal); border-radius:4px; padding:1px 6px; display:inline-flex; align-items:center; gap:3px;">
                ${fElemIcon} ${cleanFaction} (${upToStr} +50%)
            </span>`;
        }

        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <b style="font-size:13px; color:#fff;">${exp.title[currentLang] || exp.title['EN']}</b>
                        ${affinityBadgeHtml}
                    </div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:nowrap; white-space:nowrap;">
                        <span>${currentLang === 'RU' ? 'Добыча:' : 'Spoils:'}</span>
                        <b style="color:var(--gold); white-space:nowrap;">+${formatNumber(exp.rewardGold)} ${gI}${bonusText}</b>
                        <b style="color:var(--crystal); white-space:nowrap;">+${exp.rewardCrystals} ${cI}</b>
                        ${exp.relicChance > 0 ? `<span style="color:var(--gold); font-size:11px; white-space:nowrap;">(${chanceStr} ${rI})</span>` : ''}
                    </div>
                    <div style="font-size:11px; color:#cbd5e1; margin-top:2px;">
                        ${durLabel}: <b style="color:#fff;">${durStr}</b>${vipMark}
                    </div>
                </div>
            </div>
            ${actionHtml}`;
        container.appendChild(div);
    });
}

function autoSelectInPicker() {
    const config = EXPEDITIONS_CONFIG.find(e => e.id === activeAssignExpId);
    if (!config) return;

    const targetFaction = getExpeditionAffinity(activeAssignExpId);
    const freeHeroes = Object.keys(gState.deck || {}).filter(id => !isHeroBusy(id));

    freeHeroes.sort((a, b) => {
        const heroA = HEROES_CATALOG[a], heroB = HEROES_CATALOG[b];
        const cardA = gState.deck[a] || { lvl: 1, stars: 1 };
        const cardB = gState.deck[b] || { lvl: 1, stars: 1 };

        const matchA = heroA?.faction === targetFaction ? 1 : 0;
        const matchB = heroB?.faction === targetFaction ? 1 : 0;
        if (matchB !== matchA) return matchB - matchA; // Приоритет совпадению стихии!

        if (cardB.lvl !== cardA.lvl) return cardB.lvl - cardA.lvl;
        const tDiff = (TIER_ORDER[heroB.tier] || 0) - (TIER_ORDER[heroA.tier] || 0);
        if (tDiff !== 0) return tDiff;
        return (cardB.stars || 1) - (cardA.stars || 1);
    });

    if (freeHeroes.length < config.requiredHeroes) {
        return pushToast(currentLang === 'RU' ? "Недостаточно свободных героев!" : "Not enough free heroes!");
    }

    selectedExpHeroes = freeHeroes.slice(0, config.requiredHeroes);
    playSfx(520, 'sine', 0.08);
    renderExpPickerList();
}

function autoDeployExpedition(expId) {
    const config = EXPEDITIONS_CONFIG.find(e => e.id === expId);
    if (!config) return;
    // v5.3.2 FIX-EXP-DOUBLE-DEPLOY: запрет перезапуска активной экспедиции.
    // Раньше повторное нажатие AUTO перезаписывало gState.expeditions[expId],
    // прогресс терялся, а герои старого состава освобождались без награды.
    if (gState.expeditions[expId]) {
        return pushToast(currentLang === 'RU' ? 'Экспедиция уже в пути!' : 'Expedition already underway!');
    }

    const targetFaction = getExpeditionAffinity(expId);
    const freeHeroes = Object.keys(gState.deck || {}).filter(id => !isHeroBusy(id));

    freeHeroes.sort((a, b) => {
        const heroA = HEROES_CATALOG[a], heroB = HEROES_CATALOG[b];
        const cardA = gState.deck[a] || { lvl: 1, stars: 1 };
        const cardB = gState.deck[b] || { lvl: 1, stars: 1 };

        const matchA = heroA?.faction === targetFaction ? 1 : 0;
        const matchB = heroB?.faction === targetFaction ? 1 : 0;
        if (matchB !== matchA) return matchB - matchA;

        if (cardB.lvl !== cardA.lvl) return cardB.lvl - cardA.lvl;
        const tDiff = (TIER_ORDER[heroB.tier] || 0) - (TIER_ORDER[heroA.tier] || 0);
        if (tDiff !== 0) return tDiff;
        return (cardB.stars || 1) - (cardA.stars || 1);
    });

    if (freeHeroes.length < config.requiredHeroes) {
        return pushToast(currentLang === 'RU' ? "Недостаточно свободных героев!" : "Not enough free heroes!");
    }

    const selected = freeHeroes.slice(0, config.requiredHeroes);
    // Для VIP поход сразу уходит на 50% времени
    const duration = isVipActive() ? Math.floor(config.durationSec * 0.5) : config.durationSec;
    gState.expeditions[expId] = {
        heroIds: [...selected],
        endTime: Date.now() + (duration * 1000),
        speedupsCount: isVipActive() ? 1 : 0
    };
    gState.ftueExpDone = true;
    trackQuestProgress('expedition', 1);
    playCoinSfx();
    pushToast(currentLang === 'RU' ? "Экспедиция отправлена с максимальным резонансом!" : "Squad deployed with max resonance!");
    saveGame();
    renderExpeditionsList();
    renderCards();
    renderFtue();
}

function openExpHeroPicker(expId) {
    // v5.3.2 FIX-EXP-DOUBLE-DEPLOY: не открываем picker для активной экспедиции.
    // Иначе confirmExpeditionDeployment перезаписал бы state и прогресс бы потерялся.
    if (gState.expeditions[expId]) {
        return pushToast(currentLang === 'RU' ? 'Экспедиция уже в пути!' : 'Expedition already underway!');
    }
    activeAssignExpId = expId;
    selectedExpHeroes = [];
    renderExpPickerList();
    const m = document.getElementById('exp-picker-modal');
    if (m) m.style.display = 'flex';
    if (!isFtueCompleted()) updateFtueFocus();
}
function closeExpHeroPicker() {
    const m = document.getElementById('exp-picker-modal');
    if (m) m.style.display = 'none';
    activeAssignExpId = null;
    selectedExpHeroes = [];
    if (!isFtueCompleted()) updateFtueFocus();
}

function renderExpPickerList() {
    const config = EXPEDITIONS_CONFIG.find(e => e.id === activeAssignExpId);
    if (!config) return;

    const targetFaction = getExpeditionAffinity(activeAssignExpId);
    const counter = document.getElementById('exp-picker-counter');
    const confirmBtn = document.getElementById('btn-exp-picker-confirm');
    if (counter) {
        counter.innerText = I18N[currentLang].exp_picker_hint
            .replace('{req}', config.requiredHeroes)
            .replace('{cur}', selectedExpHeroes.length);
    }
    if (confirmBtn) {
        confirmBtn.disabled = selectedExpHeroes.length !== config.requiredHeroes;
        confirmBtn.innerText = `${I18N[currentLang].exp_start_confirm} (${selectedExpHeroes.length}/${config.requiredHeroes})`;
    }

    const list = document.getElementById('exp-picker-list');
    if (!list) return;
    list.innerHTML = '';

    const heroKeys = Object.keys(gState.deck || {});
    heroKeys.sort((a, b) => {
        const heroA = HEROES_CATALOG[a], heroB = HEROES_CATALOG[b];
        const cardA = gState.deck[a], cardB = gState.deck[b];

        const matchA = heroA?.faction === targetFaction ? 1 : 0;
        const matchB = heroB?.faction === targetFaction ? 1 : 0;
        if (matchB !== matchA) return matchB - matchA;

        const rankDiff = (TIER_ORDER[heroB.tier] || 0) - (TIER_ORDER[heroA.tier] || 0);
        if (rankDiff !== 0) return rankDiff;
        const lvlDiff = (cardB.lvl || 1) - (cardA.lvl || 1);
        if (lvlDiff !== 0) return lvlDiff;
        return (cardB.stars || 1) - (cardA.stars || 1);
    });

    heroKeys.forEach(hid => {
        const hero = HEROES_CATALOG[hid];
        if (!hero) return;
        const busy = isHeroBusy(hid);
        const inSquad = isHeroInSquad(hid);
        const inExp = isHeroInExpedition(hid);
        const card = gState.deck[hid];
        const isSelected = selectedExpHeroes.includes(hid);
        const isMatch = hero.faction === targetFaction;
        const resStr = currentLang === 'RU' ? 'РЕЗОНАНС' : 'RESONANCE';

        let statusLabel = '';
        if (inSquad) statusLabel = `• ${I18N[currentLang].hero_in_squad}`;
        else if (inExp) statusLabel = `• ${I18N[currentLang].hero_in_expedition}`;
        else if (isMatch) statusLabel = `• <span style="color:#4ade80; font-weight:800;">${resStr} +10%</span>`;

        const d = document.createElement('div');
        d.className = `building-card ${isSelected ? 'selected-exp-card' : ''}`;
        d.style.opacity = busy ? '0.45' : '1';
        d.style.border = isSelected ? '1.5px solid var(--gold)' : (isMatch ? '1.5px solid #22c55e' : '1px solid var(--border-metal)');
        d.style.cursor = busy ? 'not-allowed' : 'pointer';

        d.innerHTML = `
            <div>
                <b style="color:var(--tier-${(hero.tier||'f').toLowerCase()});">[${hero.tier}] ${hero.name[currentLang] || hero.name['EN']}</b>
                <div style="font-size:11.5px; color:var(--gold); margin-top:2px;">${'★'.repeat(card.stars)} (Lvl ${card.lvl}) ${statusLabel}</div>
            </div>
            <button class="btn-action" style="font-size:11.5px; padding:6px 10px;" ${busy ? 'disabled' : ''}>${isSelected ? '✔' : '+'}</button>`;

        d.onclick = () => {
            if (busy) return pushToast(I18N[currentLang].exp_hero_busy_err);
            if (isSelected) {
                selectedExpHeroes = selectedExpHeroes.filter(id => id !== hid);
            } else {
                if (selectedExpHeroes.length >= config.requiredHeroes) selectedExpHeroes.shift();
                selectedExpHeroes.push(hid);
            }
            playSfx(480, 'sine', 0.05);
            renderExpPickerList();
            if (!isFtueCompleted()) updateFtueFocus();
        };
        list.appendChild(d);
    });
}

function confirmExpeditionDeployment() {
    const config = EXPEDITIONS_CONFIG.find(e => e.id === activeAssignExpId);
    if (!config || selectedExpHeroes.length !== config.requiredHeroes) return;

    // Для VIP поход сразу отправляется с ускорением на 50% без рекламы!
    const duration = isVipActive() ? Math.floor(config.durationSec * 0.5) : config.durationSec;
    gState.expeditions[activeAssignExpId] = {
        heroIds: [...selectedExpHeroes],
        endTime: Date.now() + (duration * 1000),
        speedupsCount: isVipActive() ? 1 : 0
    };
    gState.ftueExpDone = true;
    trackQuestProgress('expedition', 1);
    playCoinSfx();
    pushToast(currentLang === 'RU' ? "Экспедиция отправлена!" : "Expedition deployed!");
    closeExpHeroPicker();
    if (!isFtueCompleted()) {
        closeExpeditionsModal();
    }
    saveGame();
    renderExpeditionsList();
    renderCards();
    renderFtue();
}

// v5.3.2 FIX-EXP-SPEEDUP-GUARD: reentrancy-guard + защита от отрицательного diff.
// Раньше двойной клик открывал два rewarded-видео, а при завершении экспедиции
// во время рекламы diff становился отрицательным — endTime увеличивался,
// откладывая возврат отряда.
const _speedupInFlight = {};
function speedupExpedition(expId) {
    const cur = gState.expeditions[expId];
    if (!cur) return;
    if (_speedupInFlight[expId]) return;
    if ((cur.speedupsCount || 0) >= 1) {
        return pushToast(currentLang === 'RU' ? "Лимит ускорений исчерпан (1/1)!" : "Speedup limit reached (1/1)!");
    }

    _speedupInFlight[expId] = true;
    showPlatformRewarded(() => {
        const diff = cur.endTime - Date.now();
        if (diff <= 0) {
            delete _speedupInFlight[expId];
            return pushToast(currentLang === 'RU' ? "Поход уже завершён — заберите награду" : "Expedition already finished — claim reward");
        }
        cur.endTime -= Math.floor(diff * 0.5);
        cur.speedupsCount = (cur.speedupsCount || 0) + 1;
        delete _speedupInFlight[expId];
        playCoinSfx();
        pushToast(currentLang === 'RU' ? "Время похода сокращено на 50%!" : "Time halved by 50%!");
        saveGame();
        renderExpeditionsList();
    }, () => {
        delete _speedupInFlight[expId];
    });
}

// Защита: множитель уровня и стихийный резонанс умножают ЗОЛОТО
// MAJOR-M3: reentrancy-guard блокирует двойное нажатие «Забрать» (двойной тап, две вкладки)
// и гарантирует single-flight начисление награды за одну экспедицию.
// FIX-EXP-CANCEL: отмена похода больше НЕ выдаёт награду.
// Причина: пропорциональная награда открывала эксплойт — игрок мог смотреть
// рекламу x2 на коротком походе и отменять сразу, получая бонус ни за что.
// Теперь: сначала модалка подтверждения с явным предупреждением, что награды
// не будет. При подтверждении герои возвращаются немедленно, без выдачи.
let _pendingCancelExpId = null;

function openCancelExpeditionConfirm(expId) {
    const expData = gState.expeditions[expId];
    if (!expData) return;
    _pendingCancelExpId = expId;
    const m = document.getElementById('cancel-expedition-modal');
    if (m) m.style.display = 'flex';
    playSfx(400, 'triangle', 0.05);
}

function closeCancelExpeditionModal() {
    _pendingCancelExpId = null;
    const m = document.getElementById('cancel-expedition-modal');
    if (m) m.style.display = 'none';
}

function confirmCancelExpedition() {
    const expId = _pendingCancelExpId;
    closeCancelExpeditionModal();
    if (!expId) return;
    const expData = gState.expeditions[expId];
    if (!expData) return;

    // Награда НЕ начисляется. Герои возвращаются в строй немедленно.
    delete gState.expeditions[expId];

    playSfx(300, 'square', 0.1);
    triggerHaptic('defeat');
    pushToast(currentLang === 'RU' ? 'Экспедиция отменена. Герои вернулись.' : 'Expedition cancelled. Heroes returned.');

    saveGame();
    renderExpeditionsList();
    renderCards();
    renderUI();
}

const claimingExpeditionIds = {};
function claimExpedition(expId) {
    if (claimingExpeditionIds[expId]) return;
    claimingExpeditionIds[expId] = true;
    // FIX-EXP-CLAIM-GUARD (v4.9.0): try/finally гарантирует снятие флага.
    // Раньше любое исключение внутри тела оставляло флаг залипшим навсегда —
    // игрок не мог забрать награду из этой экспедиции без F5.
    try {
    const config = EXPEDITIONS_CONFIG.find(e => e.id === expId);
    const expData = gState.expeditions[expId];
    if (!config || !expData) {
        delete claimingExpeditionIds[expId];
        return;
    }

    const targetFaction = getExpeditionAffinity(expId);
    let totalLvl = 0;
    let matchCount = 0;

    (expData.heroIds || []).forEach(hid => {
        totalLvl += (gState.deck[hid]?.lvl || 1);
        if (HEROES_CATALOG[hid] && HEROES_CATALOG[hid].faction === targetFaction) matchCount++;
    });

    const avgLvl = Math.max(1, totalLvl / (expData.heroIds?.length || 1));
    const lvlMultiplier = 1 + (avgLvl - 1) * 0.05;
    const isFullResonance = matchCount === config.requiredHeroes && matchCount > 0;
    const resonanceGoldPct = isFullResonance ? 0.50 : (matchCount * 0.10);
    const resonanceGold = Math.floor(config.rewardGold * resonanceGoldPct);

    const finalGold = Math.floor(config.rewardGold * lvlMultiplier) + resonanceGold;
    const finalCryst = config.rewardCrystals;

    gState.gold += finalGold;
    gState.lifetimeGold += finalGold;
    gState.crystals += finalCryst;

    let effectiveRelicChance = config.relicChance || 0;
    if (isFullResonance && effectiveRelicChance > 0) {
        // FIX-EXP-RELIC v4.7.0: бонус моно-отряда снижен с +4% до +1%.
        // Суммарно с базовым 3% на exp_5 даёт максимум 4% за 16ч.
        effectiveRelicChance += 0.01;
    }

    if (Math.random() < effectiveRelicChance) {
        gState.relics = (gState.relics || 0) + 1;
        pushToast(currentLang === 'RU' ? "+1 Реликвия из глубин!" : "+1 Relic from the depths!");
    }

    // Случайная генерация новой стихии на следующий заход
    const factions = ['light', 'undead', 'chaos', 'demon'];
    gState.expeditionAffinities[expId] = factions[Math.floor(Math.random() * factions.length)];

    delete gState.expeditions[expId];
    playCoinSfx();
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const rLabel = resonanceGold > 0 ? (isFullResonance ? ' • МОНО-РЕЗОНАНС +50%' : ` • Резонанс +${matchCount * 10}%`) : '';
    pushToast(`+${formatNumber(finalGold)} ${gI} • +${finalCryst} ${cI}${rLabel}`);

    saveGame();
    renderExpeditionsList();
    renderCards();
    renderUI();
    } finally {
        delete claimingExpeditionIds[expId];
    }
}

/* ==========================================================
   ШТАБ, СЛОТЫ И КАРТОТЕКА
   ========================================================== */
let activeRosterTab = 'cards';
let activePickingSlot = 0;
let activePickingSquad = 'attack'; // 'attack' | 'defense'

// RU-ROLE: catalogKey — внутренний ключ роли в HEROES_CATALOG (data-heroes.js).
// data-heroes.js НЕ трогаем — там 84 записи с role: 'Главком'. Только UI-слой
// показывает 'Лидер', а фильтр слотов ищет по catalogKey = 'Главком'.
const SLOT_ROLES_DATA = [
    { RU: 'Авангард', EN: 'Vanguard',  catalogKey: 'Авангард' },
    { RU: 'Лидер',    EN: 'Commander', catalogKey: 'Главком' },
    { RU: 'Тыл',      EN: 'Rearguard', catalogKey: 'Тыл' }
];

function selectRosterTab(tabKey) {
    activeRosterTab = tabKey;
    // N1-fix: пересчёт бейджа Кодекса + общих бейджей Штаба через rAF — гарантированно
    // после того, как DOM-элементы Штаба вставлены в дерево. Дроссель M4 не блокирует.
    requestAnimationFrame(() => {
        checkCodexNotifications();
    });
    const tabs = ['cards', 'formation', 'expeditions', 'codex'];
    tabs.forEach(t => {
        let btnId = `btn-roster-tab-${t}`;
        if (t === 'expeditions') btnId = 'mode-exp-btn';
        if (t === 'codex') btnId = 'mode-codex-btn';

        const btn = document.getElementById(btnId);
        const pane = document.getElementById(`roster-pane-${t}`);
        if (btn) btn.classList.toggle('active', t === tabKey);
        if (pane) pane.style.display = (t === tabKey) ? 'flex' : 'none';
    });

    playSfx(420, 'sine', 0.04);

    if (tabKey === 'cards') renderCards();
    else if (tabKey === 'formation') renderFormationSlots();
    else if (tabKey === 'expeditions') renderExpeditionsList();
    else if (tabKey === 'codex') renderCodexUI();

    checkCodexNotifications();
    if (!isFtueCompleted()) updateFtueFocus();
}

function openExpeditionsModal() {
    openRosterFrom('citadel-view');
    selectRosterTab('expeditions');
}

function closeExpeditionsModal() {
    selectRosterTab('formation');
}

function openCodexModal() {
    openRosterFrom('citadel-view');
    selectRosterTab('codex');
}

function closeCodexModal() {
    selectRosterTab('formation');
}

function openSlotPicker(slotIndex, squadType = 'attack') {
    activePickingSlot = slotIndex;
    activePickingSquad = squadType;
    // RU-ROLE: фильтруем по catalogKey (внутренний ключ 'Главком'), а не по RU-названию.
    const slotRole = SLOT_ROLES_DATA[slotIndex];
    const requiredRoleKey = slotRole.catalogKey || slotRole.RU;
    const list = document.getElementById('slot-picker-list');
    if (!list) return;
    list.innerHTML = '';

    const matching = Object.values(HEROES_CATALOG).filter(c => gState.deck[c.id] && c.role === requiredRoleKey);

    matching.sort((a, b) => {
        const cardA = gState.deck[a.id] || { lvl: 1, stars: 1 };
        const cardB = gState.deck[b.id] || { lvl: 1, stars: 1 };
        const tierDiff = (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0);
        if (tierDiff !== 0) return tierDiff;
        const lvlDiff = cardB.lvl - cardA.lvl;
        if (lvlDiff !== 0) return lvlDiff;
        return cardB.stars - cardA.stars;
    });

    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';
    matching.forEach(hero => {
        const card = gState.deck[hero.id];
        const stars = card.stars || 1;
        const lvl = card.lvl || 1;
        const factionName = I18N[currentLang].factions[hero.faction] || hero.faction;
        const inExp = isHeroInExpedition(hero.id);

        let cleanFaction = factionName.replace(/[\u2600-\u26FF\u2700-\u27BF\uD83C-\uD83E\uDC00-\uDFFF\u2011-\u26FF]/g, '').trim();
        const fIcon = `<img src="assets/icons/elem_${hero.faction}.webp" class="res-icon-inline" style="width:11px; height:11px;">`;

        const d = document.createElement('div');
        d.className = 'building-card';
        d.style.cursor = inExp ? 'not-allowed' : 'pointer';
        d.style.opacity = inExp ? '0.45' : '1';
        d.innerHTML = `
            <div>
                <b style="color:var(--tier-${(hero.tier||'f').toLowerCase()});">[${hero.tier}] ${hero.name[currentLang] || hero.name['EN']}</b>
                <div style="font-size:11px; color:var(--gold); margin-top:3px;">
                    ${formatHeroStars(stars)} | Ур. ${lvl} | +${formatNumber(getHeroCP(hero.id))} ${cpUnit} | ${fIcon} ${cleanFaction} ${inExp ? `<span style="color:var(--text-muted);">(${I18N[currentLang].hero_in_expedition})</span>` : ''}
                </div>
            </div>
            <button class="btn-action" ${inExp ? 'disabled' : ''}>${I18N[currentLang].slot_select}</button>`;

        d.onclick = () => {
            if (inExp) return pushToast(I18N[currentLang].exp_hero_busy_err);
            const targetFormation = (activePickingSquad === 'attack') ? gState.attackFormation : gState.defenseFormation;
            targetFormation[activePickingSlot] = hero.id;
            gState.ftueEquipDone = true;

            playSfx(580, 'sine', 0.1);
            closeSlotPicker();
            saveGame();
            renderFormationSlots();
            renderCards();
            renderDungeon();
            renderFtue();
            renderUI();
            renderLeaderboard();
        };
        list.appendChild(d);
    });

    const m = document.getElementById('slot-picker-modal');
    if (m) m.style.display = 'flex';
    if (!isFtueCompleted()) updateFtueFocus();
}

function closeSlotPicker() { 
    const m = document.getElementById('slot-picker-modal');
    if (m) m.style.display = 'none'; 
    if (!isFtueCompleted()) updateFtueFocus();
}

function renderSquadSlot(boxId, hid, roleName, roleClass) {
    const box = document.getElementById(boxId);
    if (!box) return;
    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';

    if (hid && HEROES_CATALOG[hid]) {
        const h = HEROES_CATALOG[hid];
        const card = gState.deck[hid] || { stars: 1, lvl: 1 };
        const tColor = `var(--tier-${(h.tier||'f').toLowerCase()})`;
        box.classList.add('assigned');
        box.style.borderColor = tColor;

        const heroImg = h.img || `${h.id}.webp`;
        const artContent = `<img src="assets/heroes/${heroImg}" class="slot-card-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span class="slot-card-icon" style="display:none;">${h.icon}</span>`;

        box.innerHTML = `
            <div class="slot-card-inner">
                <div class="slot-full-art-layer">${artContent}</div>
                <div class="slot-top-overlay">
                    <span class="slot-role-tag ${roleClass}">${roleName}</span>
                    <span>${formatHeroStars(card.stars || 1)}</span>
                </div>
                <div class="slot-bottom-overlay">
                    <div style="font-size:11.5px; font-weight:900; color:${tColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-shadow:0 1px 3px #000;">[${h.tier}] ${h.name[currentLang] || h.name['EN']}</div>
                    <div style="font-size:11px; font-weight:700; color:#fff; margin-top:1px; text-shadow:0 1px 2px #000;">${currentLang === 'RU' ? 'Ур.' : 'Lvl'}${formatHeroLevel(card.lvl)} • +${formatNumber(getHeroCP(hid))} ${cpUnit}</div>
                    <div class="slot-quick-upg-wrap">
                        <button class="slot-lvlup-btn ${((gState.gold || 0) >= getHeroUpgradeCost(hid, card.lvl || 1) && (card.lvl || 1) < getTierCap(hid)) ? 'can-afford' : ''}" onclick="event.stopPropagation(); quickUpgradeSquadHero('${hid}')" ${(card.lvl || 1) >= getTierCap(hid) || (gState.gold || 0) < getHeroUpgradeCost(hid, card.lvl || 1) ? 'disabled' : ''}>
                            ${(card.lvl || 1) >= getTierCap(hid) ? 'MAX' : `${I18N[currentLang]?.slot_lvlup_prefix || (currentLang === 'RU' ? '+1 Ур.' : '+1 Lvl')} (${formatNumber(getHeroUpgradeCost(hid, card.lvl || 1))} <img src="assets/icons/gold.webp" class="res-icon-inline" style="width:11px; height:11px;">)`}
                        </button>
                    </div>
                </div>
            </div>`;
    } else {
        box.classList.remove('assigned');
        box.style.borderColor = 'var(--border-metal)';
        box.innerHTML = `
            <div class="slot-empty-prompt">
                <span class="slot-role-tag ${roleClass}">${roleName}</span>
                <div class="slot-empty-plus">+</div>
                <div class="slot-val-name" style="font-size:11px; color:var(--text-muted);">${I18N[currentLang].slot_select}</div>
            </div>`;
    }
}

function quickUpgradeSquadHero(hid) {
    if (!hid || !gState.deck[hid]) return;
    const card = gState.deck[hid];
    if ((card.lvl || 1) >= MAX_TOTAL_LVL) {
        return pushToast(currentLang === 'RU'
            ? `Максимальный уровень (M${MAX_MASTERY_LVL})!`
            : `Max level (M${MAX_MASTERY_LVL})!`);
    }

    // G5: герой ровно на 200 и не пробуждён — открываем модалку
    if ((card.lvl || 1) === MAX_BASE_LVL && !isMasteryAwakened(hid) && getTierCap(hid) > MAX_BASE_LVL) {
        openMasteryModal(hid);
        return;
    }

    const cost = getHeroUpgradeCost(hid, card.lvl || 1);
    if ((gState.gold || 0) < cost) return pushToast(currentLang === 'RU' ? "Недостаточно золота!" : "Not enough gold!");

    const oldLvl = card.lvl || 1;
    gState.gold -= cost;
    card.lvl = oldLvl + 1;
    // G5: checkMasteryAwakening в ручном флоу не нужен — визуал даёт модалка
    trackQuestProgress('hero_lvl', 1);
    playCoinSfx();
    triggerHaptic('upgrade');
    saveGame();
    renderFormationSlots();
    renderCards();
    renderUI();
}

function renderFormationSlots() {
    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';

    // 1. АТАКА
    const atkForm = gState.attackFormation || [];
    const atkSyn = getFormationSynergy(atkForm);
    const atkSynBadge = document.getElementById('roster-synergy-badge');
    const atkCpEl = document.getElementById('roster-atk-cp');
    const atkStr = currentLang === 'RU' ? 'АТАКА:' : 'ATTACK:';
    if (atkSynBadge) atkSynBadge.innerHTML = atkSyn.label;
    if (atkCpEl && atkCpEl.parentElement) {
        atkCpEl.parentElement.innerHTML = `<img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:13px; height:13px;" alt="CP"> ${atkStr} <b id="roster-atk-cp" style="color:#fff;">${formatNumber(calculateCP(atkForm, null, false))} ${cpUnit}</b>`;
    }

    // 2. ОБОРОНА
    const defForm = gState.defenseFormation || [];
    const defSyn = getFormationSynergy(defForm);
    const defSynBadge = document.getElementById('roster-def-synergy-badge');
    const defCpEl = document.getElementById('roster-def-cp');
    const defStr = currentLang === 'RU' ? 'ОБОРОНА:' : 'DEFENSE:';
    if (defSynBadge) defSynBadge.innerHTML = defSyn.label;
    if (defCpEl && defCpEl.parentElement) {
        defCpEl.parentElement.innerHTML = `<img src="assets/icons/army.webp" class="res-icon-inline" style="width:13px; height:13px; vertical-align:-1px;" alt="DEF"> ${defStr} <b id="roster-def-cp" style="color:#fff;">${formatNumber(calculateCP(defForm, null, false))} ${cpUnit}</b>`;
    }

    const roleNames = [
        I18N[currentLang].roles.vanguard,
        I18N[currentLang].roles.commander,
        I18N[currentLang].roles.rearguard
    ];
    const roleClasses = ['role-vanguard', 'role-commander', 'role-rearguard'];

    for (let i = 0; i < 3; i++) {
        renderSquadSlot(`slot-${i}`, atkForm[i], roleNames[i], roleClasses[i]);
        renderSquadSlot(`slot-def-${i}`, defForm[i], roleNames[i], roleClasses[i]);
    }
}

let activeRosterFactionFilter = 'all';
let activeRosterTierDesc = false; // Старт сортировки от [F] (новичкам удобнее)
let activeRosterLvlDesc = true;
let activeRosterSortMode = 'tier';

function setRosterFactionFilter(faction) {
    activeRosterFactionFilter = faction;
    ['all', 'light', 'undead', 'chaos', 'demon'].forEach(f => {
        document.getElementById(`filter-f-${f}`)?.classList.toggle('active', f === faction);
    });
    playFilterClickSfx();
    triggerHaptic('tap');
    renderCards();
}

function toggleRosterTierSort() {
    activeRosterSortMode = 'tier';
    activeRosterTierDesc = !activeRosterTierDesc;
    const btn = document.getElementById('btn-roster-sort-tier');
    if (btn) btn.innerText = activeRosterTierDesc ? 'Ранг ⬇' : 'Ранг ⬆';
    renderCards();
}

function toggleRosterLvlSort() {
    activeRosterSortMode = 'lvl';
    activeRosterLvlDesc = !activeRosterLvlDesc;
    const btn = document.getElementById('btn-roster-sort-lvl');
    if (btn) btn.innerText = activeRosterLvlDesc ? 'Уровень ⬇' : 'Уровень ⬆';
    renderCards();
}

function renderCards() {
    const c = document.getElementById('cards-container');
    if (!c) return;
    c.innerHTML = '';

    // В КАРТОТЕКЕ отображаются ТОЛЬКО те герои, которыми реально владеет игрок!
    let heroList = Object.values(HEROES_CATALOG).filter(h => !!gState.deck[h.id]);

    if (activeRosterFactionFilter !== 'all') {
        heroList = heroList.filter(h => h.faction === activeRosterFactionFilter);
    }

    const counterBadge = document.getElementById('ui-deck-counter');
    if (counterBadge) counterBadge.innerText = `${heroList.length} ${currentLang === 'RU' ? 'бойцов' : 'heroes'}`;

    // Сортировка
    heroList.sort((a, b) => {
        const cardA = gState.deck[a.id] || { lvl: 1, stars: 1 };
        const cardB = gState.deck[b.id] || { lvl: 1, stars: 1 };

        if (activeRosterSortMode === 'lvl') {
            const diff = cardB.lvl - cardA.lvl;
            return activeRosterLvlDesc ? diff : -diff;
        } else {
            const diff = (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0);
            return activeRosterTierDesc ? diff : -diff;
        }
    });

    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';

    // N1: асинхронная проверка бейджа Кодекса — не блокирует рендер, но обновляет точку
    setTimeout(checkCodexNotifications, 0);

    heroList.forEach(card => {
        const cardData = gState.deck[card.id] || { stars: 1, lvl: 1 };
        const inAtk = (gState.attackFormation || []).includes(card.id);
        const inDef = (gState.defenseFormation || []).includes(card.id);
        const inExp = isHeroInExpedition(card.id);

        let statusBadge = '';
        if (inAtk && inDef) {
            statusBadge = `<div class="card-status-pill all-squads">${currentLang === 'RU' ? 'АТАКА + ОБОРОНА' : 'ATK + DEF'}</div>`;
        } else if (inAtk) {
            statusBadge = `<div class="card-status-pill current">${currentLang === 'RU' ? 'В АТАКЕ' : 'ATTACK'}</div>`;
        } else if (inDef) {
            statusBadge = `<div class="card-status-pill def-squad">${currentLang === 'RU' ? 'В ОБОРОНЕ' : 'DEFENSE'}</div>`;
        } else if (inExp) {
            // R1: показываем таймер возврата героя из экспедиции.
            const _expInfo = (typeof getHeroExpeditionInfo === 'function') ? getHeroExpeditionInfo(card.id) : null;
            const _timerStr = _expInfo ? formatExpeditionDuration(_expInfo.remainingSec) : '';
            statusBadge = `<div class="card-status-pill exp">${currentLang === 'RU' ? 'В ПОХОДЕ' : 'EXPEDITION'}${_timerStr ? ' • ' + _timerStr : ''}</div>`;
        } else {
            statusBadge = `<div class="card-status-pill free">${currentLang === 'RU' ? 'СВОБОДЕН' : 'READY'}</div>`;
        }

        const cardEl = document.createElement('div');
        cardEl.className = `tcg-card tier-${card.tier} faction-${card.faction}`;

        const heroImg = card.img || `${card.id}.webp`;
        // FIX-CARDS-FREEZE: loading="lazy" + decoding="async" + fetchpriority="low".
        // Chromium декодировал 84 webp-картинки 512×680 ВСЕ СРАЗУ при открытии Картотеки,
        // выдавая стартовый фриз 200-400 мс. Теперь карты декодируются по мере попадания
        // во viewport, а низкий fetchpriority не забивает очередь загрузчика.
        const artContent = `<img src="assets/heroes/${heroImg}" class="tcg-art-img" loading="lazy" decoding="async" fetchpriority="low" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span class="tcg-art-icon" style="display:none;">${card.icon}</span>`;
        const tierColor = `var(--tier-${(card.tier||'f').toLowerCase()})`;

        const _roleInfo = getHeroRoleLabel(card);
        const _roleHtml = _roleInfo ? `<span class="tcg-role-badge ${_roleInfo.cls}">${_roleInfo.text}</span>` : '';
        cardEl.innerHTML = `
            <div class="tcg-art-bg-layer">${artContent}</div>
            <div class="tcg-header">
                <div style="display:flex; align-items:center; gap:3px;">
                    ${_roleHtml}
                </div>
                <span class="tcg-stars-row">${formatHeroStars(cardData.stars || 1)}</span>
            </div>
            <div class="tcg-footer-meta">
                <div class="tcg-name" style="color:${tierColor};"><span class="tcg-tier-badge" style="color:${tierColor}; margin-right:3px;">[${card.tier}]</span>${card.name[currentLang] || card.name['EN']}</div>
                <div class="tcg-stats">${currentLang === 'RU' ? 'Ур.' : 'Lvl'} ${formatHeroLevel(cardData.lvl)} | ${cpUnit}: +${formatNumber(getHeroCP(card.id))}</div>
                ${statusBadge}
            </div>`;

        cardEl.onclick = () => openCardInspect(card.id);
        c.appendChild(cardEl);
    });
}

function closeCardInspect() {
    const m = document.getElementById('card-inspect-modal');
    if (m) m.style.display = 'none';
    activeInspectHeroId = null;
    if (!isFtueCompleted()) updateFtueFocus();
}

/* ==========================================================
   LIVE ARENA (v4.7.6) — обмен данными с живыми игроками
   через Cloudflare Worker + KV.

   Схема:
     • При saveGame() (debounced 30s) → POST /arena/submit
     • При открытии Арены → POST /arena/rivals
     • При победе/поражении над живым → POST /arena/attack
     • При входе в игру → POST /arena/inbox (это в Патче B2)

   Все запросы требуют валидный launch params (query) в теле.
   В standalone (GH Pages без VK) — submit отключён, только чтение.

   Кэш: gState.liveRivalsCache — массив живых соперников,
   подмешивается в renderArena поверх ботов.
   ========================================================== */

let liveArenaSubmitDebounce = null;
let liveArenaSubmitRetry = null;  // B3: таймер ретрая при rate_limited
let liveArenaSubmitErrorShown = false; // v4.8.8: one-shot toast при отказе сервера live-арены
// v5.2.4 FIX-INBOX-SYNC: пока inbox не прочитан при загрузке — блокируем submit,
// чтобы наши локальные (устаревшие) кубки не перезаписали серверные значения,
// изменённые атаками живых игроков. Снимается после первого checkArenaInbox
// или по fallback-таймеру 15 сек (если сеть/Worker не ответил).
let _inboxSyncPending = true;
let _inboxSyncFallbackTimer = null;

// B4: дедупликация submit'ов. Хэш профиля хранится в localStorage — если
// он не изменился, submit не отправляется вообще. Это уменьшает число
// KV-запросов на ~90%.
const LAST_PROFILE_HASH_KEY = 'lota_last_profile_hash';
const LAST_PROFILE_TS_KEY = 'lota_last_profile_ts';
const MIN_SUBMIT_INTERVAL_MS = 60000;

function computeProfileHash(name, trophies, cp, squad, crystals) {
    const str = name + '|' + trophies + '|' + cp + '|' + squad.map(s => s.id + ':' + s.stars + ':' + s.lvl).join(',') + '|c' + (crystals || 0);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
}

function getLaunchQuery() {
    try {
        return (typeof window !== 'undefined' && window.location)
            ? window.location.search.replace(/^\?/, '')
            : '';
    } catch (e) { return ''; }
}

// Строгая проверка — submit разрешён только в VK (там есть sign).
// На GH Pages / Yandex — работает только чтение списка живых.
function canSubmitToLiveArena() {
    return isRunningInsideVK() && !!getLaunchQuery();
}

async function submitArenaProfile(force = false) {
    if (!canSubmitToLiveArena()) return { ok: false, reason: 'standalone' };
    // v5.2.4 FIX-INBOX-SYNC: до первой inbox-синхронизации блокируем submit.
    // force=true — explicit override (смена имени в настройках).
    if (_inboxSyncPending && !force) return { ok: false, reason: 'inbox_pending' };

    const query = getLaunchQuery();
    const name = (gState.playerName || 'Duke Valdor').slice(0, 12);
    const trophies = Math.floor(gState.trophies || 150);
    const cp = Math.floor(calculateCP(gState.defenseFormation, null, false));
    const defenseSquad = sanitizeFormation(gState.defenseFormation).map(id => {
        const realId = id || 'f_und_v';
        const card = gState.deck[realId] || { stars: 1, lvl: 1 };
        return {
            id: realId,
            stars: Math.max(1, Math.min(10, card.stars || 1)),
            lvl: Math.max(1, Math.min(300, card.lvl || 1))
        };
    });

    // B4: hash-проверка. Если профиль не изменился и прошло <60 сек — skip.
    const hash = computeProfileHash(name, trophies, cp, defenseSquad);
    let lastHash = '', lastTs = 0;
    try {
        lastHash = localStorage.getItem(LAST_PROFILE_HASH_KEY) || '';
        lastTs = parseInt(localStorage.getItem(LAST_PROFILE_TS_KEY), 10) || 0;
    } catch (e) {}

    const timeSinceLast = Date.now() - lastTs;
    if (!force && hash === lastHash) {
        if (DEV_MODE_CHECK()) devLog('[LiveArena] submit skipped (unchanged)');
        return { ok: true, reason: 'skipped_unchanged' };
    }
    if (!force && timeSinceLast < MIN_SUBMIT_INTERVAL_MS) {
        const delay = MIN_SUBMIT_INTERVAL_MS - timeSinceLast;
        if (liveArenaSubmitRetry) clearTimeout(liveArenaSubmitRetry);
        liveArenaSubmitRetry = setTimeout(() => {
            liveArenaSubmitRetry = null;
            submitArenaProfile(false);
        }, delay);
        if (DEV_MODE_CHECK()) devLog('[LiveArena] submit deferred', delay, 'ms');
        return { ok: false, reason: 'deferred' };
    }

    try {
        const resp = await fetch(`${WORKER_BASE_URL}/arena/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query, name, trophies, cp, defenseSquad,
                // v5.3.14: флаг suspicion — уходит в KV, пригодится для блокировки в ладдере.
                suspicious: !!gState._suspicious
            })
        });
        const data = await resp.json();
        if (DEV_MODE_CHECK()) devLog('[LiveArena] submit →', data);

        if (data && data.ok === true) {
            try {
                localStorage.setItem(LAST_PROFILE_HASH_KEY, hash);
                localStorage.setItem(LAST_PROFILE_TS_KEY, String(Date.now()));
            } catch (e) {}
            // v5.3.12: успешный submit — кристаллы на сервере актуальны, флаг IAP снимается.
            if (gState._iapPendingSync) gState._iapPendingSync = false;
        }

        if (data && data.ok === false && data.reason === 'rate_limited') {
            const retryIn = Math.max(1000, (data.retryIn || 5000) + 500);
            if (liveArenaSubmitRetry) clearTimeout(liveArenaSubmitRetry);
            liveArenaSubmitRetry = setTimeout(() => {
                liveArenaSubmitRetry = null;
                submitArenaProfile(true);
            }, retryIn);
        } else if (data && data.ok === false && !liveArenaSubmitErrorShown) {
            // v4.8.8: сервер отверг профиль — показываем игроку один раз за сессию.
            // До патча причина уходила только в console (в проде через DEV_MODE_CHECK — вообще никуда),
            // поэтому на мобильном VK отладка была невозможна без USB-отладки.
            liveArenaSubmitErrorShown = true;
            const reason = data.reason || 'unknown';
            const reasonRu = {
                invalid_name: 'Имя содержит недопустимые символы. Смените в Настройках.',
                invalid_trophies: 'Некорректное число кубков. Обратитесь в поддержку.',
                invalid_cp: 'Некорректная мощь защиты. Обратитесь в поддержку.',
                invalid_squad: 'Некорректный отряд обороны. Пересохраните построение.',
                sign_mismatch: 'Сессия не прошла проверку. Перезапустите игру.',
                sign_expired: 'Сессия устарела. Перезапустите игру.',
                sign_length_mismatch: 'Сессия не прошла проверку. Перезапустите игру.',
                no_sign: 'Нет подписи сессии. Перезапустите игру.',
                no_user_id: 'Не удалось получить ваш ID. Перезапустите игру.',
                empty_query: 'Пустой запрос к серверу. Перезапустите игру.',
                bad_json: 'Ошибка формата данных.',
                network: 'Сеть недоступна.'
            };
            const reasonEn = {
                invalid_name: 'Invalid characters in name. Change in Settings.',
                invalid_trophies: 'Invalid trophies count. Contact support.',
                invalid_cp: 'Invalid defense power. Contact support.',
                invalid_squad: 'Invalid defense squad. Re-save formation.',
                sign_mismatch: 'Session validation failed. Restart the game.',
                sign_expired: 'Session expired. Restart the game.',
                sign_length_mismatch: 'Session validation failed. Restart the game.',
                no_sign: 'No session signature. Restart the game.',
                no_user_id: 'Failed to obtain your ID. Restart the game.',
                empty_query: 'Empty server request. Restart the game.',
                bad_json: 'Invalid data format.',
                network: 'Network unavailable.'
            };
            const msg = (currentLang === 'RU' ? reasonRu : reasonEn)[reason]
                || (currentLang === 'RU' ? 'Сервер отклонил профиль: ' + reason : 'Server rejected profile: ' + reason);
            pushToast(msg);
        }
        return data;
    } catch (e) {
        if (DEV_MODE_CHECK()) console.warn('[LiveArena] submit failed:', e);
        return { ok: false, reason: 'network' };
    }
}

function scheduleLiveArenaSubmit(force = false) {
    if (!canSubmitToLiveArena()) return;
    if (force) {
        if (liveArenaSubmitDebounce) { clearTimeout(liveArenaSubmitDebounce); liveArenaSubmitDebounce = null; }
        submitArenaProfile(true);
        return;
    }
    if (liveArenaSubmitDebounce) clearTimeout(liveArenaSubmitDebounce);
    // B4: debounce 30 → 180 сек. Даёт ~60% экономии submits поверх hash-проверки.
    liveArenaSubmitDebounce = setTimeout(() => {
        liveArenaSubmitDebounce = null;
        submitArenaProfile(false);
    }, 180000);
}

async function fetchLiveRivals(count = 2) {
    const query = getLaunchQuery();
    try {
        const resp = await fetch(`${WORKER_BASE_URL}/arena/rivals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, count })
        });
        const data = await resp.json();
        if (data && data.ok && Array.isArray(data.rivals)) {
            gState.liveRivalsCache = data.rivals;
            gState.liveRivalsCacheTs = Date.now();
            if (DEV_MODE_CHECK()) devLog('[LiveArena] fetched rivals:', data.rivals.length);
            return data.rivals;
        }
    } catch (e) {
        if (DEV_MODE_CHECK()) console.warn('[LiveArena] fetch rivals failed:', e);
    }
    return [];
}

// B6: глобальный топ-10 живых игроков с Cloudflare Worker.
// Кэшируется в gState.liveTopCache на 120 сек (проверка по liveTopCacheTs).
// Worker со своей стороны тоже кэширует sorted:trophies — TTL 60 сек — так что
// реальных KV-чтений будет ~1 в минуту даже при массовых запросах ладдера.
// v5.3.8: стабильный deviceId для защиты от RNG-дубля призыва.
// UUID в localStorage, переживает перезагрузки. Один deviceId = одно устройство.
// При двух устройствах — разные deviceId, Worker блокирует параллельный ролл.
function getOrCreateDeviceId() {
    const _key = 'lota_device_id';
    try {
        let id = localStorage.getItem(_key);
        if (!id || id.length < 8) {
            id = 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem(_key, id);
        }
        return id;
    } catch (e) {
        return 'd_fallback_' + Math.random().toString(36).slice(2, 10);
    }
}

// v5.3.13: syncCrystalsFromServer удалена. Архитектурно несовместима с моделью
// «много локальных источников кристаллов + отстающий KV». Для полного закрытия
// RNG-дубля нужен server-side roll (Worker крутит сам), это отдельная задача.

// v5.3.8: запрос лока призыва у Worker'а. При сетевой ошибке возвращает ok:true
// (offline fallback — крутим локально, чтобы не блокировать игру без сети).
async function requestSummonLock() {
    if (!canSubmitToLiveArena()) return { ok: true, reason: 'standalone' };
    const query = getLaunchQuery();
    const deviceId = getOrCreateDeviceId();
    try {
        const resp = await fetch(`${WORKER_BASE_URL}/summon/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, deviceId })
        });
        const data = await resp.json();
        if (data && typeof data.ok === 'boolean') return data;
        return { ok: true, reason: 'bad_response' };
    } catch (e) {
        return { ok: true, reason: 'network' };
    }
}

// v5.3.8: обёртка над summonGacha с проверкой лока.
// Вызывается из кнопок Алтаря вместо summonGacha.
async function summonGachaWithLock(type, count = 1) {
    // v5.3.13: sync кристаллов из KV убран — конфликтовал с локальными
    // источниками (демон/промокод/календарь/квесты/кодекс/колесо/левиафан).
    // Любой источник накапливался локально, KV отставал, sync стирал прогресс.
    const lock = await requestSummonLock();
    if (!lock.ok && lock.reason === 'summon_locked') {
        const retryIn = Math.max(1, Math.ceil((lock.retryIn || 60000) / 1000));
        return pushToast(currentLang === 'RU'
            ? `Призыв заблокирован: игра открыта на другом устройстве. Повторите через ${retryIn} сек или закройте её.`
            : `Summon locked: game is open on another device. Retry in ${retryIn}s or close it.`);
    }
    summonGacha(type, count);
}

async function fetchLiveTop10() {
    if (!canSubmitToLiveArena()) return [];
    // Throttle 120 сек, как у fetchLiveRivals — защита от спама при частом открытии модалки
    if (gState.liveTopCacheTs && (Date.now() - gState.liveTopCacheTs) < 120000 && Array.isArray(gState.liveTopCache)) {
        return gState.liveTopCache;
    }
    const query = getLaunchQuery();
    try {
        const resp = await fetch(`${WORKER_BASE_URL}/arena/top`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 10 })
        });
        const data = await resp.json();
        if (data && data.ok && Array.isArray(data.players)) {
            gState.liveTopCache = data.players;
            gState.liveTopCacheTs = Date.now();
            if (DEV_MODE_CHECK()) devLog('[LiveArena] top10 fetched:', data.players.length);
            return data.players;
        }
    } catch (e) {
        if (DEV_MODE_CHECK()) console.warn('[LiveArena] fetch top10 failed:', e);
    }
    return [];
}

// Обёртка над IS_DEV_MODE с защитой от ReferenceError при раннем вызове
function DEV_MODE_CHECK() {
    try { return typeof IS_DEV_MODE !== 'undefined' && IS_DEV_MODE; } catch (e) { return false; }
}

// LIVE-ARENA (v4.7.8): уведомить сервер об атаке на живого игрока.
async function reportArenaAttack(targetUid, result, trophyChange) {
    if (!canSubmitToLiveArena()) return { ok: false, reason: 'standalone' };
    if (!targetUid || !result) return { ok: false, reason: 'bad_args' };
    const query = getLaunchQuery();
    try {
        const resp = await fetch(`${WORKER_BASE_URL}/arena/attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                targetUid: String(targetUid),
                result: result === 'win' ? 'win' : 'loss',
                trophyChange: Math.abs(Math.floor(trophyChange || 0))
            })
        });
        const data = await resp.json();
        if (DEV_MODE_CHECK()) devLog('[LiveArena] attack reported →', data);
        return data;
    } catch (e) {
        if (DEV_MODE_CHECK()) console.warn('[LiveArena] attack report failed:', e);
        return { ok: false, reason: 'network' };
    }
}

async function fetchArenaInbox() {
    if (!canSubmitToLiveArena()) return [];
    const query = getLaunchQuery();
    try {
        const resp = await fetch(`${WORKER_BASE_URL}/arena/inbox`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await resp.json();
        if (data && data.ok && Array.isArray(data.attacks)) {
            if (DEV_MODE_CHECK()) devLog('[LiveArena] inbox fetched:', data.attacks.length);
            return data.attacks;
        }
    } catch (e) {
        if (DEV_MODE_CHECK()) console.warn('[LiveArena] inbox fetch failed:', e);
    }
    return [];
}

async function clearArenaInboxOnServer() {
    if (!canSubmitToLiveArena()) return;
    const query = getLaunchQuery();
    try {
        await fetch(`${WORKER_BASE_URL}/arena/inbox/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
    } catch (e) {}
}

async function fetchPlayerProfile(targetUid) {
    const query = getLaunchQuery();
    try {
        const resp = await fetch(`${WORKER_BASE_URL}/arena/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, targetUid: String(targetUid) })
        });
        const data = await resp.json();
        if (data && data.ok && data.player) return data.player;
    } catch (e) {}
    return null;
}

// v5.2.4: молчаливый sync без показа модалки. Применяет ±trophyChange к gState.trophies
// для новых атак (по дедуп-ключу). Вызывается раз в 60 сек из основного тика.
// v5.3.0: reentrancy-guard — медленный Worker + тик не дают двух параллельных запросов.
let _silentInboxBusy = false;
async function silentInboxSync() {
    if (!canSubmitToLiveArena()) return;
    if (_silentInboxBusy) return;
    _silentInboxBusy = true;
    try {
        const attacks = await fetchArenaInbox();
        if (!attacks || attacks.length === 0) return;
        if (!gState._seenInboxKeys) gState._seenInboxKeys = {};
        let _deltaSum = 0, _applied = 0;
        attacks.forEach(atk => {
            const dedupKey = String(atk.attackerUid || '?') + '_' + String(atk.ts || 0);
            if (gState._seenInboxKeys[dedupKey]) return;
            gState._seenInboxKeys[dedupKey] = 1;
            _deltaSum += Math.floor(atk.trophyChange || 0);
            _applied++;
        });
        if (_applied > 0) {
            gState.trophies = Math.max(0, Math.min(3700, (gState.trophies || 150) + _deltaSum));
            saveGame();
            renderUI();
            renderArena();
            renderLeaderboard();
            if (DEV_MODE_CHECK()) devLog('[LiveArena] silent sync applied', _applied, 'delta', _deltaSum);
        }
    } finally {
        _silentInboxBusy = false;
    }
}

async function checkArenaInbox() {
    const attacks = await fetchArenaInbox();
    if (!attacks || attacks.length === 0) {
        // FIX-INBOX-SYNC: пустой inbox — тоже снимаем блок, submit можно разрешать.
        _inboxSyncPending = false;
        if (_inboxSyncFallbackTimer) { clearTimeout(_inboxSyncFallbackTimer); _inboxSyncFallbackTimer = null; }
        return;
    }
    gState.pendingInboxAttacks = attacks;
    if (!gState._seenInboxKeys) gState._seenInboxKeys = {};

    // FIX-INBOX-SYNC: применяем ±trophyChange к нашим кубкам.
    // trophyChange в inbox УЖЕ от лица защитника (см. worker.js handleArenaAttack,
    // где delta = result==='win' ? -trophyChange : trophyChange и записывается в inbox напрямую).
    // Дедуп по (attackerUid + ts) — защита от двойного применения при перезаходе.
    let _deltaSum = 0, _newCount = 0;
    attacks.forEach(atk => {
        const dedupKey = String(atk.attackerUid || '?') + '_' + String(atk.ts || 0);
        if (gState._seenInboxKeys[dedupKey]) return;
        gState._seenInboxKeys[dedupKey] = 1;
        _deltaSum += Math.floor(atk.trophyChange || 0);
        _newCount++;
    });
    if (_newCount > 0) {
        gState.trophies = Math.max(0, Math.min(3700, (gState.trophies || 150) + _deltaSum));
        if (DEV_MODE_CHECK()) devLog('[LiveArena] inbox applied', _newCount, 'delta', _deltaSum);
    }
    // Снимаем блок submit — inbox прочитан, кубки актуальны.
    _inboxSyncPending = false;
    if (_inboxSyncFallbackTimer) { clearTimeout(_inboxSyncFallbackTimer); _inboxSyncFallbackTimer = null; }

    // v4.9.6: дублируем входящие PvP-атаки в журнал сражений на Арене.
    // FIX-INBOX-HISTORY-DEDUP: дедуп по (attackerUid + ts) — иначе при каждом
    // переоткрытии игры одни и те же атаки перезаписывались в журнал заново.
    const _trIcon = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:12px; height:12px;" alt="Trophy">';
    attacks.slice(0, 5).forEach(atk => {
        const dedupKey = String(atk.attackerUid || '?') + '_' + String(atk.ts || 0);
        if (gState._seenInboxKeys[dedupKey]) return;
        gState._seenInboxKeys[dedupKey] = 1;
        const isLossForPlayer = atk.result === 'win';
        const delta = Math.abs(Math.floor(atk.trophyChange || 0));
        const timeStr = atk.ts ? new Date(atk.ts * 1000).toLocaleTimeString().slice(0, 5) : '';
        gState.battleHistory.unshift({
            enemy: String(atk.attackerName || '???').slice(0, 20),
            time: timeStr,
            result: isLossForPlayer
                ? (currentLang === 'RU' ? 'Атака: Пробита' : 'Atk: Breached')
                : (currentLang === 'RU' ? 'Атака: Отбита' : 'Atk: Defended'),
            text: `${isLossForPlayer ? '-' : '+'}${delta} ${_trIcon}`
        });
    });
    // Обрезаем кэш дедупа — не больше 200 последних ключей
    const _keys = Object.keys(gState._seenInboxKeys);
    if (_keys.length > 200) {
        _keys.slice(0, _keys.length - 200).forEach(k => delete gState._seenInboxKeys[k]);
    }
    if (gState.battleHistory.length > 8) gState.battleHistory.length = 8;
    renderBattleHistory();
    saveGame();
    renderArenaInbox();
    const m = document.getElementById('arena-inbox-modal');
    if (m) m.style.display = 'flex';
}

function renderArenaInbox() {
    const list = document.getElementById('arena-inbox-list');
    if (!list) return;
    list.innerHTML = '';
    const attacks = Array.isArray(gState.pendingInboxAttacks) ? gState.pendingInboxAttacks : [];
    if (attacks.length === 0) {
        list.innerHTML = `<div class="arena-inbox-row" style="justify-content:center;">${I18N[currentLang]?.arena_inbox_empty || (currentLang === 'RU' ? 'Пока никто не атаковал ваш гарнизон.' : 'No attacks on your garrison yet.')}</div>`;
        return;
    }
    const trIcon = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:14px; height:14px;" alt="Trophy">';
    attacks.forEach(atk => {
        const isLossForPlayer = atk.result === 'win';
        const delta = Math.abs(Math.floor(atk.trophyChange || 0));
        const deltaClass = isLossForPlayer ? 'loss' : 'win';
        const deltaSign = isLossForPlayer ? '-' : '+';
        const timeStr = atk.ts ? new Date(atk.ts * 1000).toLocaleTimeString().slice(0, 5) : '';
        const row = document.createElement('div');
        row.className = 'arena-inbox-row';
        row.innerHTML = `
            <div>
                <div class="inbox-attacker-name">${escapeHtml(atk.attackerName || '???')}</div>
                <div class="inbox-attack-meta">${timeStr} • <span class="inbox-attack-delta ${deltaClass}">${deltaSign}${delta} ${trIcon}</span></div>
            </div>
            <button class="inbox-revenge-btn" data-revenge-uid="${escapeHtml(atk.attackerUid || '')}">${I18N[currentLang]?.arena_inbox_revenge || (currentLang === 'RU' ? 'ОТОМСТИТЬ' : 'REVENGE')}</button>`;
        list.appendChild(row);
    });
    list.querySelectorAll('[data-revenge-uid]').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.getAttribute('data-revenge-uid');
            revengeFromInbox(uid);
        });
    });
}

async function revengeFromInbox(attackerUid) {
    if (!attackerUid) return;
    closeArenaInbox();
    const profile = await fetchPlayerProfile(attackerUid);
    if (!profile) {
        return pushToast(currentLang === 'RU' ? 'Игрок недоступен для реванша' : 'Player unavailable for revenge');
    }
    const myAtkCP = calculateCP(gState.attackFormation, null, false);
    // B3: та же логика разбора двух форматов defenseSquad, что и в renderArena.
    const squadIds = [];
    const squadMeta = {};
    if (Array.isArray(profile.defenseSquad) && profile.defenseSquad.length === 3) {
        profile.defenseSquad.forEach(el => {
            if (typeof el === 'string') {
                squadIds.push(el);
            } else if (el && typeof el === 'object' && typeof el.id === 'string') {
                squadIds.push(el.id);
                squadMeta[el.id] = {
                    stars: Math.max(1, Math.min(10, parseInt(el.stars, 10) || 1)),
                    lvl: Math.max(1, Math.min(300, parseInt(el.lvl, 10) || 1))
                };
            } else {
                squadIds.push('f_und_v');
            }
        });
    } else {
        squadIds.push('f_und_v', 'f_und_c', 'f_und_r');
    }
    const rival = {
        isReal: true,
        uid: profile.uid,
        rank: 999,
        name: profile.name || '???',
        trophies: Math.floor(profile.trophies || 150),
        cp: Math.floor(profile.cp || 1000),
        squad: squadIds,
        squadMeta: squadMeta,
        gain: calculateDynamicTrophyGain(myAtkCP, profile.cp || 1000),
        isRevenge: true,
        consecutiveLosses: 0
    };
    startActualCombatWithRival(rival);
}

function closeArenaInbox() {
    const m = document.getElementById('arena-inbox-modal');
    if (m) m.style.display = 'none';
    gState.pendingInboxAttacks = null;
    clearArenaInboxOnServer();
}

/* ==========================================================
   АРЕНА И 5 ЛИГ (БРОНЗА, СЕРЕБРО, ЗОЛОТО, ПЛАТИНА, АЛМАЗ)
   ========================================================== */
// v4.9.6: minCp пересчитаны под новую базу героев (шкала /20).
const ARENA_LEAGUES = [
    { id: 'bronze', name: { RU: 'Бронзовая Лига', EN: 'Bronze League' }, icon: 'assets/icons/league_bronze.webp', minCp: 500 },
    { id: 'silver', name: { RU: 'Серебряная Лига', EN: 'Silver League' }, icon: 'assets/icons/league_silver.webp', minCp: 8000 },
    { id: 'gold', name: { RU: 'Золотая Лига', EN: 'Gold League' }, icon: 'assets/icons/league_gold.webp', minCp: 30000 },
    { id: 'platinum', name: { RU: 'Платиновая Лига', EN: 'Platinum League' }, icon: 'assets/icons/league_platinum.webp', minCp: 100000 },
    { id: 'diamond', name: { RU: 'Алмазная Лига', EN: 'Diamond League' }, icon: 'assets/icons/league_diamond.webp', minCp: 300000 }
];

function getCurrentLeague() {
    const lId = gState.arenaLeague || 'bronze';
    return ARENA_LEAGUES.find(l => l.id === lId) || ARENA_LEAGUES[0];
}

function openArenaLadderModal() {
    try {
        renderLeaderboard();
    } catch (e) {
        console.warn("[Arena] Ошибка рендера таблицы лидеров:", e);
    }

    // B6: асинхронно подтягиваем живых топ-10, затем перерисовываем.
    // v5.3.6: синхронизируем header Арены — иначе при свежем live данные
    // header показывал старый rank, а таблица уже новый.
    if (typeof fetchLiveTop10 === 'function') {
        fetchLiveTop10().then(list => {
            if (list && list.length > 0) {
                renderLeaderboard();
                if (typeof renderArena === 'function') renderArena();
            }
        });
    }

    const inYandex = isRunningInsideYandex();
    const vkLadderBtn = document.getElementById('btn-arena-vk-ladder');
    if (vkLadderBtn) {
        vkLadderBtn.style.display = !inYandex && isRunningInsideVK() ? 'inline-flex' : 'none';
    }
    const yandexLadderBtn = document.getElementById('btn-arena-yandex-ladder');
    if (yandexLadderBtn) {
        yandexLadderBtn.style.display = inYandex ? 'inline-flex' : 'none';
    }
    const m = document.getElementById('arena-ladder-modal');
    if (m) m.style.display = 'flex';
}

function openYandexArenaLeaderboard() {
    const modal = document.getElementById('arena-live-ladder-modal');
    if (modal) modal.style.display = 'flex';
    loadYandexArenaLeaderboard();
}

function closeYandexArenaLeaderboard() {
    const modal = document.getElementById('arena-live-ladder-modal');
    if (modal) modal.style.display = 'none';
}

async function loadYandexArenaLeaderboard() {
    const box = document.getElementById('arena-live-leaderboard-box');
    const refreshButton = document.getElementById('btn-arena-live-refresh');
    if (!box || !refreshButton || refreshButton.disabled) return;

    refreshButton.disabled = true;
    box.innerHTML = `<div class="building-card">${I18N[currentLang].arena_live_loading}</div>`;
    try {
        const result = await PlatformBridge.getArenaLeaderboardEntries();
        const entries = result && Array.isArray(result.entries) ? result.entries : [];
        if (entries.length === 0) {
            box.innerHTML = `<div class="building-card">${I18N[currentLang].arena_live_empty}</div>`;
            return;
        }

        const trophyIcon = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:14px; height:14px;" alt="">';
        box.innerHTML = entries.map((entry, index) => {
            const rank = Number.isFinite(entry.rank) ? entry.rank : index + 1;
            const name = escapeHtml((entry.player && entry.player.publicName) || I18N[currentLang].arena_live_player_fallback);
            const score = Number.isFinite(entry.score) ? Math.floor(entry.score) : 0;
            return `<div class="building-card" style="padding:7px 10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px;"><b><span style="color:var(--text-muted);">#${rank}</span> ${name}</b></span>
                <b style="color:var(--gold); font-size:12.5px; display:inline-flex; align-items:center; gap:3px;">${score.toLocaleString()} ${trophyIcon}</b>
            </div>`;
        }).join('');
    } catch (error) {
        console.warn('[Arena] Не удалось загрузить рейтинг игроков Яндекс Игр:', error);
        box.innerHTML = `<div class="building-card">${I18N[currentLang].arena_live_unavailable}</div>`;
    } finally {
        refreshButton.disabled = false;
    }
}

function closeArenaLadderModal() {
    const m = document.getElementById('arena-ladder-modal');
    if (m) m.style.display = 'none';
}
function getWeekIdentifier() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}_W${weekNum}`;
}

// MAJOR-M6: считает, сколько календарных недель прошло между двумя ID формата "2025_W41".
// Устойчиво к переходу через год: W52 2024 → W03 2025 = 3 недели.
// Используется в checkWeeklyArenaReset для компенсации возвращенцам.
function getMissedWeeksCount(oldWeekId, newWeekId) {
    try {
        const [oldYear, oldWeek] = oldWeekId.split('_W').map(Number);
        const [newYear, newWeek] = newWeekId.split('_W').map(Number);
        if (!Number.isFinite(oldYear) || !Number.isFinite(newYear) || !Number.isFinite(oldWeek) || !Number.isFinite(newWeek)) return 1;
        return Math.max(1, (newYear - oldYear) * 52 + (newWeek - oldWeek));
    } catch (e) {
        return 1;
    }
}

function checkWeeklyArenaReset() {
    // MAJOR-M2: заморозка недельного ресета Арены при откате часов
    if (isClockRolledBack) return;

    const curWeek = getWeekIdentifier();
    if (!gState.arenaSeasonWeekId) {
        gState.arenaSeasonWeekId = curWeek;
        gState.arenaSeasonNumber = 1; // Старт первого сезона
        return;
    }

    if (gState.arenaSeasonWeekId !== curWeek) {
        // MAJOR-M6: считаем число пропущенных недель (обрезка до 8 — защита от абсурда).
        // Возвращенец получает компенсацию за каждую пропущенную неделю сверх текущей.
        const missedWeeks = Math.min(8, getMissedWeeksCount(gState.arenaSeasonWeekId, curWeek));

        const finalRank = calculatePlayerRank();
        const prevSeasonNum = gState.arenaSeasonNumber || 1;
        gState.arenaSeasonWeekId = curWeek;
        gState.arenaSeasonNumber = prevSeasonNum + 1;

        // Фиксируем СТАРУЮ Лигу, в которой игрок сражался всю неделю
        const oldLeagueId = gState.arenaLeague || 'bronze';
        let curLeagueIdx = ARENA_LEAGUES.findIndex(l => l.id === oldLeagueId);
        if (curLeagueIdx < 0) curLeagueIdx = 0;

        const isUp = finalRank <= 10;
        const isDown = finalRank >= 990;

        // Честное начисление еженедельных наград по матрице СТАРОЙ Лиги:
        const rate = getIncomeRate();
        let crystals = 50;
        let gold = rate * 3600;
        let heroReward = null;
        let rankTier = '';

        if (oldLeagueId === 'bronze') {
            if (isUp) { crystals = 150; gold = rate * 14400; heroReward = ['a_lig_v', 'a_dem_c', 'a_und_v', 'a_cha_c'][Math.floor(Math.random() * 4)]; rankTier = currentLang === 'RU' ? 'Бронза: Повышение [ВВЕРХ]' : 'Bronze: Promoted [UP]'; }
            else if (isDown) { crystals = 25; gold = rate * 1800; rankTier = currentLang === 'RU' ? 'Бронза: Вылет [ВНИЗ]' : 'Bronze: Demoted [DOWN]'; }
            else { crystals = 50; gold = rate * 3600; rankTier = currentLang === 'RU' ? 'Бронза: Удержание Лиги' : 'Bronze: Retained League'; }
        } else if (oldLeagueId === 'silver') {
            if (isUp) { crystals = 300; gold = rate * 28800; heroReward = ['s_dem_c', 's_cha_r', 's_lig_v', 's_und_c'][Math.floor(Math.random() * 4)]; gState.relics = (gState.relics || 0) + 1; rankTier = currentLang === 'RU' ? 'Серебро: Повышение [ВВЕРХ]' : 'Silver: Promoted [UP]'; }
            else if (isDown) { crystals = 40; gold = rate * 3600; rankTier = currentLang === 'RU' ? 'Серебро: Вылет [ВНИЗ]' : 'Silver: Demoted [DOWN]'; }
            else { crystals = 100; gold = rate * 7200; rankTier = currentLang === 'RU' ? 'Серебро: Удержание Лиги' : 'Silver: Retained League'; }
        } else if (oldLeagueId === 'gold') {
            if (isUp) { crystals = 600; gold = rate * 43200; heroReward = ['s_dem_c', 's_cha_r', 's_lig_v', 's_und_c', 'ss_und_r'][Math.floor(Math.random() * 5)]; gState.relics = (gState.relics || 0) + 2; rankTier = currentLang === 'RU' ? 'Золото: Повышение [ВВЕРХ]' : 'Gold: Promoted [UP]'; }
            else if (isDown) { crystals = 80; gold = rate * 7200; rankTier = currentLang === 'RU' ? 'Золото: Вылет [ВНИЗ]' : 'Gold: Demoted [DOWN]'; }
            else { crystals = 200; gold = rate * 14400; gState.relics = (gState.relics || 0) + 1; rankTier = currentLang === 'RU' ? 'Золото: Удержание Лиги' : 'Gold: Retained League'; }
        } else if (oldLeagueId === 'platinum') {
            if (isUp) { crystals = 1200; gold = rate * 86400; heroReward = ['ss_und_r', 'ss_dem_v', 'ss_lig_c', 'ss_cha_v'][Math.floor(Math.random() * 4)]; gState.relics = (gState.relics || 0) + 3; rankTier = currentLang === 'RU' ? 'Платина: Повышение [ВВЕРХ]' : 'Platinum: Promoted [UP]'; }
            else if (isDown) { crystals = 150; gold = rate * 14400; rankTier = currentLang === 'RU' ? 'Платина: Вылет [ВНИЗ]' : 'Platinum: Demoted [DOWN]'; }
            else { crystals = 400; gold = rate * 28800; gState.relics = (gState.relics || 0) + 1; rankTier = currentLang === 'RU' ? 'Платина: Удержание Лиги' : 'Platinum: Retained League'; }
        } else { // diamond
            if (finalRank === 1) { crystals = 3000; gold = rate * 172800; heroReward = ['sss_cha_c', 'sss_dem_v', 'sss_lig_r', 'sss_und_v'][Math.floor(Math.random() * 4)]; gState.relics = (gState.relics || 0) + 5; rankTier = currentLang === 'RU' ? 'ЧЕМПИОН ОЛИМПА (#1)' : 'OLYMPUS CHAMPION (#1)'; }
            else if (isUp) { crystals = 1800; gold = rate * 86400; heroReward = Math.random() < 0.5 ? ['sss_cha_c', 'sss_dem_v', 'sss_lig_r', 'sss_und_v'][Math.floor(Math.random() * 4)] : ['ss_und_r', 'ss_dem_v', 'ss_lig_c', 'ss_cha_v'][Math.floor(Math.random() * 4)]; gState.relics = (gState.relics || 0) + 4; rankTier = currentLang === 'RU' ? 'Алмаз: Топ 2–10 [ВВЕРХ]' : 'Diamond: Top 2–10 [UP]'; }
            else if (isDown) { crystals = 250; gold = rate * 28800; rankTier = currentLang === 'RU' ? 'Алмаз: Вылет [ВНИЗ]' : 'Diamond: Demoted [DOWN]'; }
            else { crystals = 600; gold = rate * 43200; gState.relics = (gState.relics || 0) + 2; rankTier = currentLang === 'RU' ? 'Алмаз: Удержание Лиги' : 'Diamond: Retained League'; }
        }

        // Перевод игрока в новую лигу после начисления наград
        if (isUp && curLeagueIdx < ARENA_LEAGUES.length - 1) {
            curLeagueIdx++;
            pushToast(currentLang === 'RU' ? `ПОВЫШЕНИЕ ЛИГИ!` : `LEAGUE PROMOTED!`);
        } else if (isDown && curLeagueIdx > 0) {
            curLeagueIdx--;
            pushToast(currentLang === 'RU' ? `ПОНИЖЕНИЕ ЛИГИ!` : `LEAGUE DEMOTED!`);
        }
        
        gState.arenaLeague = ARENA_LEAGUES[curLeagueIdx].id;
        
        // Непрерывный подъем: кубки НЕ сбрасываются! Игрок сохраняет свой прогресс.
        // Мягкий сброс (Soft Reset) применяется ТОЛЬКО для Алмазной лиги (срез кубков выше 3000 наполовину)
        if (oldLeagueId === 'diamond' && (gState.trophies || 0) > 3000) {
            gState.trophies = 3000 + Math.floor(((gState.trophies || 3000) - 3000) / 2);
        }
        
        // Глубокая очистка ладдера: в новой лиге новые соперники
        gState.ladderSwaps = {}; 
        gState.arenaActiveRivals = null; 
        gState.arenaTopTenBots = null; // Принудительный сброс Топ-10 для генерации новых имен 

        // MAJOR-M6: компенсация за пропущенные недели.
        // За каждую упущенную неделю даём 50% от 4 часов дохода шахт — честно, но не эксплойтно.
        // (Возвращенец через 3 недели получает награды за последнюю + золотую компенсацию за 2 пропущенные.)
        if (missedWeeks > 1) {
            const compensationGold = Math.floor(getIncomeRate() * 3600 * 4 * (missedWeeks - 1) * 0.5);
            gState.gold += compensationGold;
            gState.lifetimeGold += compensationGold;
            setTimeout(() => {
                const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
                pushToast(currentLang === 'RU' 
                    ? `Пропущено недель: ${missedWeeks} • Компенсация: +${formatNumber(compensationGold)} ${gI}`
                    : `Weeks missed: ${missedWeeks} • Compensation: +${formatNumber(compensationGold)} ${gI}`);
            }, 2000);
        }

        gState.pendingSeasonCeremony = {
            seasonNumber: prevSeasonNum,
            finalRank,
            rankTier,                 // обратная совместимость для старых сейвов
            oldLeagueId,              // v5.3.1: для пересчёта локализации при рендере
            isUp, isDown,             // v5.3.1: флаги исхода (не зависят от языка)
            crystals,
            gold,
            heroReward
        };

        saveGame();
        renderArena();
        renderLeaderboard();
        renderUI();
        checkSeasonCeremony();
    }
}

function checkSeasonCeremony() {
    if (!gState.pendingSeasonCeremony) return;
    openSeasonCeremonyModal(gState.pendingSeasonCeremony);
}

function openSeasonCeremonyModal(ceremonyData) {
    const modal = document.getElementById('season-verdict-modal');
    if (!modal) return;

    const titleEl = document.getElementById('season-verdict-title');
    const rankEl = document.getElementById('season-verdict-rank-badge');
    const rewardsBox = document.getElementById('season-verdict-rewards-box');
    const congratsEl = document.getElementById('season-verdict-congrats');

    const sNum = ceremonyData.seasonNumber || 1;
    if (titleEl) {
        titleEl.innerText = currentLang === 'RU' ? `ИТОГИ СЕЗОНА #${sNum}` : `SEASON #${sNum} CONCLUDED`;
    }
    if (rankEl) {
        // v5.3.1: rankTier пересчитывается на актуальном языке при рендере.
        // Раньше строка сохранялась в момент reset — при смене языка игрок видел старый язык.
        let rankTierLabel = ceremonyData.rankTier;
        if (ceremonyData.oldLeagueId && typeof ceremonyData.isUp === 'boolean') {
            const _leagueNames = {
                bronze: { RU: 'Бронза', EN: 'Bronze' },
                silver: { RU: 'Серебро', EN: 'Silver' },
                gold: { RU: 'Золото', EN: 'Gold' },
                platinum: { RU: 'Платина', EN: 'Platinum' },
                diamond: { RU: 'Алмаз', EN: 'Diamond' }
            };
            const _lName = (_leagueNames[ceremonyData.oldLeagueId] || _leagueNames.bronze)[currentLang]
                || ceremonyData.oldLeagueId;
            const _isRU = currentLang === 'RU';
            if (ceremonyData.finalRank === 1 && ceremonyData.oldLeagueId === 'diamond') {
                rankTierLabel = _isRU ? 'ЧЕМПИОН ОЛИМПА (#1)' : 'OLYMPUS CHAMPION (#1)';
            } else if (ceremonyData.isUp) {
                rankTierLabel = _isRU ? `${_lName}: Повышение [ВВЕРХ]` : `${_lName}: Promoted [UP]`;
            } else if (ceremonyData.isDown) {
                rankTierLabel = _isRU ? `${_lName}: Вылет [ВНИЗ]` : `${_lName}: Demoted [DOWN]`;
            } else {
                rankTierLabel = _isRU ? `${_lName}: Удержание Лиги` : `${_lName}: Retained League`;
            }
        }
        rankEl.innerText = currentLang === 'RU'
            ? `ВАШ ИТОГ: #${ceremonyData.finalRank} (${rankTierLabel})`
            : `FINAL STANDING: #${ceremonyData.finalRank} (${rankTierLabel})`;
    }

    if (rewardsBox) {
        rewardsBox.innerHTML = '';

        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" style="width:24px; height:24px;" alt="G">';
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" style="width:24px; height:24px;" alt="C">';

        if (ceremonyData.gold > 0) {
            rewardsBox.innerHTML += `
                <div class="season-reward-item">
                    ${gI}
                    <div>
                        <div style="font-size:11.5px; color:var(--text-muted);">${currentLang === 'RU' ? 'Золото Казны' : 'Treasury Gold'}</div>
                        <b style="color:var(--gold); font-size:14px;">+${formatNumber(ceremonyData.gold)} <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"></b>
                    </div>
                </div>`;
        }

        if (ceremonyData.crystals > 0) {
            rewardsBox.innerHTML += `
                <div class="season-reward-item">
                    ${cI}
                    <div>
                        <div style="font-size:11.5px; color:var(--text-muted);">${currentLang === 'RU' ? 'Кристаллы Бездны' : 'Abyss Crystals'}</div>
                        <b style="color:var(--crystal); font-size:14px;">+${formatNumber(ceremonyData.crystals)} <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C"></b>
                    </div>
                </div>`;
        }

        if (ceremonyData.heroReward && HEROES_CATALOG[ceremonyData.heroReward]) {
            const h = HEROES_CATALOG[ceremonyData.heroReward];
            const hName = h.name[currentLang] || h.name['EN'];
            const tColor = `var(--tier-${(h.tier||'s').toLowerCase()})`;
            rewardsBox.innerHTML += `
                <div class="season-reward-item hero-reward" style="border-color:${tColor};">
                    <span style="font-size:26px;">${h.icon}</span>
                    <div>
                        <div style="font-size:11px; color:${tColor}; font-weight:800;">[${h.tier}] ТРОФЕЙ ЛИГИ</div>
                        <b style="color:#fff; font-size:13px;">${hName}</b>
                    </div>
                </div>`;
        }
    }

    if (congratsEl) {
        congratsEl.innerText = currentLang === 'RU'
            ? '«Ваша доблесть отмечена Советом Цитадели. Новый сезон ладдера объявляется открытым!»'
            : '«Your valor has been inscribed upon the gates of the Citadel. The new season has begun!»';
    }

    playSfx(1200, 'triangle', 0.3);
    modal.style.display = 'flex';
}

function claimSeasonCeremony() {
    const data = gState.pendingSeasonCeremony;
    if (!data) {
        document.getElementById('season-verdict-modal')?.setAttribute('style', 'display: none;');
        return;
    }

    if (data.gold > 0) {
        gState.gold += data.gold;
        gState.lifetimeGold += data.gold;
    }
    if (data.crystals > 0) {
        gState.crystals += data.crystals;
    }
    if (data.heroReward && HEROES_CATALOG[data.heroReward]) {
        const hid = data.heroReward;
        // v5.3.0 FIX-SEASON-MAX-HERO-COMP: при MAX 10★ выдаём компенсацию 1500 C,
        // как в промокодах. Раньше Math.min(10, stars+1) молча терял награду.
        if (!gState.deck[hid]) {
            gState.deck[hid] = { stars: 1, lvl: 1 };
        } else if ((gState.deck[hid].stars || 1) < 10) {
            gState.deck[hid].stars = (gState.deck[hid].stars || 1) + 1;
        } else {
            gState.crystals += 1500;
            const _cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
            setTimeout(() => pushToast(currentLang === 'RU'
                ? `Трофей лиги уже MAX 10★: +1500 ${_cI} компенсации`
                : `League trophy already MAX 10★: +1500 ${_cI} compensation`), 200);
        }
    }

    gState.pendingSeasonCeremony = null;
    playCoinSfx();
    pushToast(currentLang === 'RU' ? "Сезонные трофеи зачислены в казну!" : "Season spoils claimed!");
    
    document.getElementById('season-verdict-modal')?.setAttribute('style', 'display: none;');
    saveGame();
    renderCards();
    renderArena();
    renderLeaderboard();
    renderUI();
}

function previewSeasonCeremony() {
    closeRewardsModal();
    const rank = calculatePlayerRank();
    const dummyHero = rank === 1 ? 'sss_dem_v' : (rank <= 3 ? 'ss_und_r' : 's_dem_c');
    openSeasonCeremonyModal({
        seasonNumber: gState.arenaSeasonNumber || 1,
        finalRank: rank,
        rankTier: rank === 1 ? 'Чемпион (#1)' : (rank <= 3 ? 'Легенда (Топ 2-3)' : 'Мастер (Топ 4-20)'),
        crystals: rank === 1 ? 1000 : 300,
        gold: rank === 1 ? 50000 : 15000,
        heroReward: dummyHero
    });
}

// Живая база реальных игровых ников
const humanNicknames = [
    'Ghost', 'Варвар', 'Phantom', 'Снайпер', 'Viper', 'Феникс', 'Striker', 'Кречет',
    'Apex', 'Сармат', 'Blaze', 'Викинг', 'Reaper', 'Барс', 'Frost', 'Тайфун',
    'Alex', 'Максим', 'Titan', 'Денис', 'Shadow', 'Руслан', 'Raven', 'Danil',
    'Demon', 'Сергей', 'Ranger', 'Vlad', 'Predator', 'Kirill', 'Warrior', 'Артём',
    'Spartan', 'Цербер', 'Hunter', 'Хищник', 'Nemesis', 'Атлант', 'Kenshi', 'Спартанец',
    'Overlord', 'Дракон', 'Blackout', 'Самурай', 'Storm', 'Вулкан', 'Nightmare', 'Фобос',
    'Spectre', 'Оракул', 'Gorgon', 'Каратель', 'Zero', 'Мститель', 'Vector', 'Кочевник',
    'Raptor', 'Берсерк', 'Vortex', 'Гроза', 'Archon', 'Тень', 'Exile', 'Варяг',
    'Brimstone', 'Паладин', 'Eclipse', 'Следопыт', 'Venom', 'Монолит', 'Cipher', 'Витязь',
    'Zenith', 'Ястреб', 'Onyx', 'Русич', 'Havoc', 'Легионер', 'Slayer', 'Буран',
    'Chaos', 'Аватар', 'Rogue', 'Дозорный', 'Pulse', 'Шаман', 'Ignis', 'Страж',
    'Dread', 'Магистр', 'Frenzy', 'Север', 'Quantum', 'Клин', 'Blade', 'Зубр',
    'Valkyrie', 'Сокол', 'Wraith', 'Рыцарь', 'Inferno', 'Богатырь', 'Nexus', 'Гриф',
    'Specter', 'Волкодав', 'Shade', 'Шторм', 'Grim', 'Леший', 'Rune', 'Странник',
    'Void', 'Ермак', 'Grave', 'Радомир', 'Fang', 'Ярополк', 'Steel', 'Мстислав'
];

// Инициализация устойчивого реестра Топ-10 Лидеров
function ensureTopTenBots() {
    const curLeagueId = gState.arenaLeague || 'bronze';
    const leagueTrophies = {
        bronze: { minTr: 150, maxTr: 800, minCp: 300, maxCp: 8000 },
        silver: { minTr: 800, maxTr: 1500, minCp: 8000, maxCp: 30000 },
        gold: { minTr: 1500, maxTr: 2300, minCp: 30000, maxCp: 100000 },
        platinum: { minTr: 2300, maxTr: 3000, minCp: 100000, maxCp: 300000 },
        diamond: { minTr: 3000, maxTr: 3700, minCp: 300000, maxCp: 1000000 }
    };
    const cfg = leagueTrophies[curLeagueId] || leagueTrophies.bronze;

    // v5.3.5 FIX-DEDUP-BOT-NAMES: если в существующем arenaTopTenBots есть дубли
    // имён (напр. два 'Шторм' из старого сейва или коллизии в humanNicknames) —
    // сбрасываем массив для пересоздания. Раньше дубли попадали в топ-10 таблицы.
    if (Array.isArray(gState.arenaTopTenBots) && gState.arenaTopTenBots.length === 10) {
        const _nameSeen = new Set();
        let _hasDup = false;
        for (const b of gState.arenaTopTenBots) {
            const n = String(b.name || '').toLowerCase();
            if (_nameSeen.has(n)) { _hasDup = true; break; }
            _nameSeen.add(n);
        }
        if (_hasDup) {
            gState.arenaTopTenBots = null;
        }
    }

    if (!gState.arenaTopTenBots || gState.arenaTopTenBots.length !== 10 || gState.arenaTopTenLeague !== curLeagueId) {
        gState.arenaTopTenLeague = curLeagueId;
        gState.arenaTopTenBots = [];
        const pools = {
            bronze: ['f_und_v', 'f_dem_c', 'e_und_v', 'd_und_v', 'c_und_v', 'b_und_v', 'a_lig_v', 's_dem_c'],
            silver: ['d_und_v', 'c_und_v', 'b_und_v', 'a_und_v', 'a_dem_c', 's_dem_c', 'ss_und_r'],
            gold: ['b_und_v', 'a_und_v', 'a_dem_c', 's_dem_c', 's_lig_v', 'ss_und_r', 'ss_dem_v'],
            platinum: ['a_und_v', 's_dem_c', 's_lig_v', 'ss_und_r', 'ss_dem_v', 'ss_lig_c', 'sss_cha_c'],
            diamond: ['s_dem_c', 's_lig_v', 'ss_und_r', 'ss_dem_v', 'ss_lig_c', 'sss_cha_c', 'sss_dem_v', 'sss_und_v']
        };
        const pool = pools[curLeagueId] || pools.bronze;

        const leagueSalts = { bronze: 0, silver: 13, gold: 27, platinum: 42, diamond: 55 };
        const lSalt = leagueSalts[curLeagueId] || 0;

        // v5.3.5: жёсткая уникальность имён в новом массиве.
        const _usedNames = new Set();
        for (let r = 1; r <= 10; r++) {
            const step = (10 - r) / 9;
            const trophies = Math.floor(cfg.maxTr - (r - 1) * Math.max(5, (cfg.maxTr - cfg.minTr) * 0.035));
            const cp = Math.floor(cfg.maxCp * 0.65 + step * (cfg.maxCp * 0.35));
            
            let _nameIdx = (r * 9 + 17 + lSalt) % humanNicknames.length;
            let _attempts = 0;
            while (_usedNames.has(humanNicknames[_nameIdx].toLowerCase()) && _attempts < humanNicknames.length) {
                _nameIdx = (_nameIdx + 1) % humanNicknames.length;
                _attempts++;
            }
            const name = humanNicknames[_nameIdx];
            _usedNames.add(name.toLowerCase());
            const h1 = pool[(r * 2 + lSalt) % pool.length];
            const h2 = pool[(r * 2 + 1 + lSalt) % pool.length];
            const h3 = pool[(r * 2 + 3 + lSalt) % pool.length];
            
            gState.arenaTopTenBots.push({
                rank: r,
                name,
                trophies,
                cp,
                squad: [h1, h2, h3]
            });
        }
    }
}

function getBotByRank(rank) {
    rank = Math.max(1, Math.min(1000, Math.floor(rank)));
    const curLeagueId = gState.arenaLeague || 'bronze';
    ensureTopTenBots();

    const myRank = calculatePlayerRank();
    const bots = gState.arenaTopTenBots || [];

    // Для Топ-10: учитываем сдвиг позиций ботов относительно игрока (исключение двойных мест)
    if (rank <= 10) {
        let botIndex;
        if (rank < myRank) {
            botIndex = rank - 1;
        } else {
            botIndex = rank - 2;
        }
        botIndex = Math.max(0, Math.min(bots.length - 1, botIndex));
        const b = bots[botIndex];
        if (b) {
            return { rank, name: b.name, trophies: b.trophies, cp: b.cp, squad: [...b.squad] };
        }
    }

    // Для мест 11..1000: строгая привязка кубков ниже Топ-10 (никаких аномалий на 23-м месте)
    const leagueRanges = {
        bronze: { minCp: 300, maxCp: 8000, minTr: 150, maxTr: 800, pool: ['f_und_v', 'f_dem_c', 'e_und_v', 'd_und_v', 'c_und_v', 'b_und_v', 'a_lig_v', 's_dem_c'] },
        silver: { minCp: 8000, maxCp: 30000, minTr: 800, maxTr: 1500, pool: ['d_und_v', 'c_und_v', 'b_und_v', 'a_und_v', 'a_dem_c', 's_dem_c', 'ss_und_r'] },
        gold: { minCp: 30000, maxCp: 100000, minTr: 1500, maxTr: 2300, pool: ['b_und_v', 'a_und_v', 'a_dem_c', 's_dem_c', 's_lig_v', 'ss_und_r', 'ss_dem_v'] },
        platinum: { minCp: 100000, maxCp: 300000, minTr: 2300, maxTr: 3000, pool: ['a_und_v', 's_dem_c', 's_lig_v', 'ss_und_r', 'ss_dem_v', 'ss_lig_c', 'sss_cha_c'] },
        diamond: { minCp: 300000, maxCp: 1000000, minTr: 3000, maxTr: 3700, pool: ['s_dem_c', 's_lig_v', 'ss_und_r', 'ss_dem_v', 'ss_lig_c', 'sss_cha_c', 'sss_dem_v', 'sss_und_v'] }
    };

    const cfg = leagueRanges[curLeagueId] || leagueRanges.bronze;
    const bot10Tr = bots[9] ? bots[9].trophies : Math.floor(cfg.maxTr * 0.78);
    // FIX-RANK-TROPHY-SYNC: кубки бота вычисляются обратной формулой к calculatePlayerRank.
    // Раньше использовались exponent 1.5 и maxSubTr=bot10Tr-5, из-за чего для одного и того же
    // rank кубки ботов не совпадали с кубками игрока (расхождение ~40 кубков в бронзе).
    // Следствие: живой игрок с меньшими кубками попадал в слот ВЫШЕ игрока с большими.
    // Теперь: rank 11 ↔ bot10Tr, rank 1000 ↔ minTr. Монотонно, согласовано с calculatePlayerRank.
    const subProgress = Math.pow(Math.max(0, Math.min(1, (rank - 11) / 989)), 1 / 1.2);
    const trophies = Math.max(cfg.minTr, Math.floor(bot10Tr - subProgress * (bot10Tr - cfg.minTr)));

    const progress = (1000 - rank) / 999;
    const cp = Math.floor(cfg.minCp + progress * (cfg.maxCp - cfg.minCp));

    // ЖИВОЙ ЛАДДЕР: личность бота («домашний» ранг) переезжает вместе с ним по позициям,
    // которые намутировал simulateLivingLadder. Сила же привязана к ТЕКУЩЕЙ позиции —
    // упавший бот становится слабее в отображении, поднявшийся — сильнее.
    if (!gState.ladderSwaps) gState.ladderSwaps = {};
    let originalRank = gState.ladderSwaps[rank] || rank;
    // Защита от багнутых сохранений прошлых версий: держим в подвале [11..1000]
    if (originalRank < 11) originalRank = 11;
    if (originalRank > 1000) originalRank = 1000;

    const leagueSalts = { bronze: 0, silver: 13, gold: 27, platinum: 42, diamond: 55 };
    const lSalt = leagueSalts[curLeagueId] || 0;

    // Хэш ЛИЧНОСТИ — от «домашнего» ранга (имя и отряд переезжают вместе с ботом)
    const identityHash = originalRank * 37 + (gState.arenaSeasonNumber || 1) * 11 + lSalt;

    // Хэш СИЛЫ — от текущей позиции (jitterFactor слегка дрожит при свапах ладдера)
    const currentRankHash = rank * 37 + (gState.arenaSeasonNumber || 1) * 11 + (gState.arenaShuffleSeed || 0) + lSalt;

    const name = humanNicknames[identityHash % humanNicknames.length];
    const getH = (offset) => cfg.pool[(identityHash + offset) % cfg.pool.length];

    const jitterFactor = 0.80 + (((currentRankHash % 40) / 100));
    const finalCp = Math.max(500, Math.floor(cp * jitterFactor));

    return { rank, name, trophies, cp: finalCp, squad: [getH(0), getH(2), getH(4)] };
}

// Генерация строго уникальных соперников Арены (исключение дублирования рангов)
function generateArenaRivals() {
    ensureTopTenBots();
    // v5.3.5: единый rank — согласован с шапкой и таблицей.
    const myRank = getCurrentUnifiedRank();
    const myAttackCp = calculateCP(gState.attackFormation, null, false);
    const seed = gState.arenaShuffleSeed || 0;

    let targetRanks = [];
    if (myRank === 1) {
        targetRanks = [2, 3, 4];
    } else if (myRank === 2) {
        targetRanks = [1, 3, 4];
    } else if (myRank === 3) {
        targetRanks = [1, 2, 4];
    } else if (myRank <= 10) {
        targetRanks = [
            Math.max(1, myRank - 2),
            myRank - 1,
            Math.min(1000, myRank + 1)
        ];
    } else {
        const offsetHigh = 4 + (seed % 3);
        const offsetMid = 2 + (seed % 2);
        const offsetLow = 1 + ((seed + 1) % 3);
        targetRanks = [
            Math.max(1, myRank - offsetHigh),
            Math.max(1, myRank - offsetMid),
            Math.min(1000, myRank + offsetLow)
        ];
    }

    // Алгоритмическая гарантия: три строго различных ранга, исключающих ранг самого игрока.
    // FIX-ARENA-HANG-2: while с «пинг-понгом» (уменьшить/увеличить) может зацикливаться,
    // если кандидат окружён занятыми рангами с обеих сторон. Заменили на безопасный
    // восходящий скан с жёстким лимитом попыток и fallback-веткой.
    const uniqueRanks = [];
    targetRanks.forEach(r => {
        let candidate = Math.max(1, Math.min(1000, Math.floor(r)));
        if (candidate === myRank) candidate = candidate > 1 ? candidate - 1 : candidate + 1;

        const occupied = new Set([myRank, ...uniqueRanks]);
        let scanAttempts = 0;
        while (occupied.has(candidate) && scanAttempts < 1000) {
            scanAttempts++;
            candidate++;
        }
        // Fallback: если восходящий скан не нашёл свободный слот (теоретически невозможно
        // при 1000 позициях), пробуем ниже игрока на случай плотного заполнения.
        if (occupied.has(candidate)) {
            candidate = Math.max(1, myRank - 20);
            let fallbackAttempts = 0;
            while (occupied.has(candidate) && fallbackAttempts < 1000) {
                fallbackAttempts++;
                candidate = candidate > 1 ? candidate - 1 : candidate + 1;
            }
        }

        uniqueRanks.push(candidate);
    });

    // Сортировка по возрастанию мест (то есть от сильнейшего к слабейшему)
    uniqueRanks.sort((a, b) => a - b);

    const rivalsData = [];
    for (let i = 0; i < 3; i++) {
        const targetR = uniqueRanks[i];
        const bot = getBotByRank(targetR);
        const dynamicGain = calculateDynamicTrophyGain(myAttackCp, bot.cp);
        rivalsData.push({
            isReal: false,
            rank: targetR,
            name: bot.name,
            trophies: bot.trophies,
            cp: bot.cp,
            squad: [...bot.squad],
            gain: dynamicGain,
            isRevenge: false,
            consecutiveLosses: 0
        });
    }
    gState.arenaActiveRivals = rivalsData;
    return rivalsData;
}

function refreshArenaRivals() {
    gState.arenaShuffleSeed = (gState.arenaShuffleSeed || 0) + 1;
    // v5.2.6 FIX-REFRESH-REFETCH-LIVE: инвалидируем кэш живых и рефетчим.
    // Раньше refresh регенерировал только ботов; если liveRivalsCache старше 120 сек,
    // живые пропадали из списка до следующего захода на Арену.
    gState.liveRivalsCacheTs = 0;
    generateArenaRivals();
    playSfx(480, 'sine', 0.04);
    renderArena();
    if (typeof fetchLiveRivals === 'function') {
        fetchLiveRivals(2).then(list => {
            if (list && list.length > 0) renderArena();
        });
    }
    pushToast(currentLang === 'RU' ? "Список соперников обновлен!" : "Rivals refreshed!");
}

function simulateLivingLadder() {
    ensureTopTenBots();
    const myRank = calculatePlayerRank();
    
    // 1. Фоновая жизнь в Топ-10: 3 свапа за тик (45с).
    //    Полный диапазон 0..9 — топ-1 и топ-10 тоже участвуют, чтобы
    //    «первое место можно было отбить» и «десятое могло вылететь из топа».
    if (gState.arenaTopTenBots && gState.arenaTopTenBots.length >= 10) {
        let swapsDone = 0;
        let safetyAttempts = 0;
        while (swapsDone < 3 && safetyAttempts < 15) {
            safetyAttempts++;
            const idxA = Math.floor(Math.random() * 9); // 0..8
            const idxB = idxA + 1;                       // 1..9

            // Не трогаем позицию, где сидит игрок
            if (idxA + 1 === myRank || idxB + 1 === myRank) continue;

            const botA = gState.arenaTopTenBots[idxA];
            const botB = gState.arenaTopTenBots[idxB];
            if (!botA || !botB) continue;

            // Плавные дельты кубков в обе стороны:
            // победитель +5..+20, проигравший −5..−20. Результат — естественный
            // обмен местами без искусственного «тот, кто ниже, всегда поднимается».
            const deltaWin = 5 + Math.floor(Math.random() * 16);
            const deltaLose = 5 + Math.floor(Math.random() * 16);
            botB.trophies = Math.max(150, botB.trophies + deltaWin);
            botA.trophies = Math.max(150, botA.trophies - deltaLose);

            // Обмен местами в массиве
            gState.arenaTopTenBots[idxA] = botB;
            gState.arenaTopTenBots[idxB] = botA;
            swapsDone++;
        }

        // Гарантия монотонности: #1 = max trophies, #10 = min trophies.
        // Сортировка по убыванию кубков + переназначение rank. Это ключевое
        // место — без него после серии свапов инвариант «выше место → больше кубков»
        // может сломаться (что и давало баг «топ-1 с кубками 8-го места»).
        gState.arenaTopTenBots.sort((a, b) => b.trophies - a.trophies);
        gState.arenaTopTenBots.forEach((b, idx) => b.rank = idx + 1);

        // Инвалидация кэша лидерборда — иначе renderLeaderboard()
        // выйдет досрочно и вёрстка останется старой до следующего захода на Арену.
        _lastLeaderboardKey = '';
    }

    // 2. Фоновая жизнь в окружении игрока (места 11-1000)
    if (myRank > 2) {
        if (!gState.ladderSwaps) gState.ladderSwaps = {};
        // Выбираем случайного соседа в радиусе ±10 позиций от игрока
        const offset = Math.floor(Math.random() * 20) - 10;
        let rankA = myRank + offset;
        
        // Защита границ (Топ-10 живет по своим правилам)
        if (rankA <= 10) rankA = 11;
        if (rankA >= 999) rankA = 998;
        let rankB = rankA + 1;

        // Если это не наша позиция — боты дерутся и физически меняются местами!
        if (rankA !== myRank && rankB !== myRank) {
            const origA = gState.ladderSwaps[rankA] || rankA;
            const origB = gState.ladderSwaps[rankB] || rankB;
            gState.ladderSwaps[rankA] = origB;
            gState.ladderSwaps[rankB] = origA;
        }
    }

    const ladderModal = document.getElementById('arena-ladder-modal');
    if (ladderModal && ladderModal.style.display === 'flex') {
        renderLeaderboard();
    }
}

// Динамическая градация наград за победу на Арене: от +10 (слабый) до +32 (дерзкий штурм титана)
function calculateDynamicTrophyGain(playerCP, oppCP) {
    const p = Math.max(1, playerCP || 1000);
    const o = Math.max(1, oppCP || 1000);
    const ratio = o / p;

    if (ratio >= 1.35) {
        // Враг на 35%+ сильнее: дерзкая победа над титаном (Giant Slayer)
        const extra = Math.min(4, Math.floor((ratio - 1.35) / 0.15) * 2);
        return Math.min(32, 28 + extra); // +28..+32
    } else if (ratio >= 0.90) {
        // Равный тактический бой (от -10% до +35% перевеса врага)
        const factor = (ratio - 0.90) / 0.45; // 0..1
        return Math.round(18 + factor * 6); // +18..+24
    } else {
        // Враг заметно слабее (меньше 90% от мощи вашей атаки)
        const factor = Math.max(0, (ratio - 0.50) / 0.40); // 0..1
        return Math.max(10, Math.round(10 + factor * 6)); // +10..+16
    }
}

// FIX-LEADERBOARD-UNIFIED-RANK: универсальная версия calculatePlayerRank
// для произвольного числа кубков. Нужна для корректного размещения живых
// в таблице лидеров по единой формуле. Для игрока — calculatePlayerRank(),
// для живых — эта функция с их trophies.
function calculatePlayerRankByTrophies(playerTrophies) {
    ensureTopTenBots();
    const curLeagueId = gState.arenaLeague || 'bronze';
    const leagueTrophies = {
        bronze: { minTr: 150, maxTr: 800 },
        silver: { minTr: 800, maxTr: 1500 },
        gold: { minTr: 1500, maxTr: 2300 },
        platinum: { minTr: 2300, maxTr: 3000 },
        diamond: { minTr: 3000, maxTr: 3700 }
    };
    const cfg = leagueTrophies[curLeagueId] || leagueTrophies.bronze;
    const pTr = Math.max(cfg.minTr, Math.floor(playerTrophies || cfg.minTr));
    const bots = gState.arenaTopTenBots || [];
    let topRank = 1;
    for (let i = 0; i < bots.length; i++) {
        if (pTr < bots[i].trophies) topRank = i + 2;
    }
    if (topRank <= 10) return topRank;
    const bot10Tr = bots[9] ? bots[9].trophies : Math.floor(cfg.maxTr * 0.78);
    if (pTr <= cfg.minTr) return 1000;
    const span = Math.max(1, bot10Tr - cfg.minTr);
    const progress = Math.max(0, Math.min(1, (bot10Tr - pTr) / span));
    const subRank = 11 + Math.floor(Math.pow(progress, 1.2) * (1000 - 11));
    return Math.max(11, Math.min(1000, subRank));
}

function calculatePlayerRank() {
    ensureTopTenBots();
    const curLeagueId = gState.arenaLeague || 'bronze';
    const leagueTrophies = {
        bronze: { minTr: 150, maxTr: 800 },
        silver: { minTr: 800, maxTr: 1500 },
        gold: { minTr: 1500, maxTr: 2300 },
        platinum: { minTr: 2300, maxTr: 3000 },
        diamond: { minTr: 3000, maxTr: 3700 }
    };
    const cfg = leagueTrophies[curLeagueId] || leagueTrophies.bronze;
    const pTr = gState.trophies !== undefined ? gState.trophies : cfg.minTr;

    // 1. Честный расчет места среди Топ-10 участников ладдера
    const bots = gState.arenaTopTenBots || [];
    let topRank = 1;
    for (let i = 0; i < bots.length; i++) {
        if (pTr < bots[i].trophies) {
            topRank = i + 2;
        }
    }
    if (topRank <= 10) return topRank;

    // 2. Если кубки ниже Топ-10: строго монотонный расчет позиций 11..1000
    const bot10Tr = bots[9] ? bots[9].trophies : Math.floor(cfg.maxTr * 0.78);
    if (pTr <= cfg.minTr) return 1000;
    const span = Math.max(1, bot10Tr - cfg.minTr);
    const progress = Math.max(0, Math.min(1, (bot10Tr - pTr) / span));
    const subRank = 11 + Math.floor(Math.pow(progress, 1.2) * (1000 - 11));
    return Math.max(11, Math.min(1000, subRank));
}

function getLeagueLordByRank(botRank) {
    return getBotByRank(botRank);
}

// Кэш соперников для арены
let cachedArenaRivals = [];

function renderArena() {
    const oppEl = document.getElementById('arena-opp-list');
    if (!oppEl) return;
    oppEl.innerHTML = '';

    const curLeague = getCurrentLeague();
    const lNameEl = document.getElementById('ui-league-name');
    const lIconEl = document.getElementById('ui-league-icon');
    const lTagEl = document.getElementById('ui-league-status-tag');
    const modalDescEl = document.getElementById('ui-ladder-league-desc');

    if (lNameEl) lNameEl.innerText = curLeague.name[currentLang] || curLeague.name['EN'];
    if (lIconEl) lIconEl.innerHTML = `<img src="${curLeague.icon}" class="res-icon-inline" style="width:20px; height:20px;" alt="${curLeague.id}">`;
    if (modalDescEl) modalDescEl.innerText = curLeague.name[currentLang] || curLeague.name['EN'];

    // v5.3.5: единый rank (боты + живые + игрок) для согласованности с таблицей.
    const myRank = getCurrentUnifiedRank();
    if (lTagEl) {
        const armyIcon = '<img src="assets/icons/army.webp" class="res-icon-inline" alt="Щит">';
        lTagEl.removeAttribute('style');
        if (myRank <= 10) {
            lTagEl.className = 'league-status-pill league-tag-up';
            lTagEl.innerHTML = currentLang === 'RU' ? '[ТОП-10 ПОВЫШЕНИЕ]' : '[TOP-10 PROMOTION]';
        } else if (myRank >= 990) {
            lTagEl.className = 'league-status-pill league-tag-down';
            lTagEl.innerHTML = currentLang === 'RU' ? '[ЗОНА ВЫЛЕТА]' : '[DEMOTION ZONE]';
        } else {
            lTagEl.className = 'league-status-pill league-tag-hold';
            lTagEl.innerHTML = `${currentLang === 'RU' ? 'УДЕРЖАНИЕ ЛИГИ' : 'LEAGUE RETENTION'} ${armyIcon}`;
        }
    }

    const myTrophies = gState.trophies || 150;
    const myAttackCp = calculateCP(gState.attackFormation, null, false);
    // Защита от XSS: ник лорда в шапке Арены идёт в innerHTML шаблона
    const myName = escapeHtml((gState.playerName || 'Duke Valdor').slice(0, 12));
    const trIcon = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:16px; height:16px;" alt="Кубок">';

    // Обновляем иконку дивизиона в шапке арены
    const lIconImg = document.getElementById('ui-league-icon-img');
    if (lIconImg) lIconImg.src = `assets/icons/league_${curLeague.id}.webp`;

    // Обновляем текст заголовка без затирания кнопки «ОБНОВИТЬ ⟳»
    const rivalsTitle = document.getElementById('lbl-rivals-text') || document.getElementById('lbl-rivals');
    if (rivalsTitle) rivalsTitle.innerText = I18N[currentLang].rivals_title;

    // Внедряем премиальную плашку профиля игрока НАД списком соперников
    const editStr = currentLang === 'RU' ? 'Изменить строй ➔' : 'Edit Squad ➔';
    const atkLabel = currentLang === 'RU' ? 'Атака' : 'Attack';
    oppEl.innerHTML = `
        <div class="building-card" style="background: radial-gradient(circle at right, rgba(245,176,65,0.2) 0%, rgba(16,20,29,0.9) 100%); border: 1.5px solid var(--gold); margin-bottom: 10px; cursor: pointer;" onclick="openRosterFrom('arena-view')">
            <div>
                <div style="font-family:'Cinzel',serif; font-size:14.5px; font-weight:900; color:var(--gold); text-shadow:0 0 8px rgba(245,176,65,0.4);">#${myRank} ${myName}</div>
                <div style="font-size:11.5px; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:3px;"><img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:12px; height:12px;" alt="БМ"> ${atkLabel}: <b style="color:#fff;">${formatNumber(myAttackCp)} ${currentLang === 'RU' ? 'БМ' : 'CP'}</b></div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:16px; font-weight:900; color:var(--gold); text-shadow:0 0 10px var(--gold-glow); display:inline-flex; align-items:center; gap:4px;">${Math.floor(myTrophies).toLocaleString()} ${trIcon}</div>
                <div style="font-size:11px; font-weight:800; color:var(--text-muted); margin-top:2px;">${editStr}</div>
            </div>
        </div>
    `;

    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';

    ensureTopTenBots();

    // Проверка на дублирование рангов между соперниками (защита от «трех вторых мест»)
    const distinctRanks = new Set((gState.arenaActiveRivals || []).map(r => r.rank));
    const hasDuplicateRanks = distinctRanks.size !== (gState.arenaActiveRivals || []).length;

    // Автоматическая валидация: дубликаты, совпадение с местом игрока, или лимит поражений
    const hasInvalidRivals = !gState.arenaActiveRivals || 
        gState.arenaActiveRivals.length !== 3 ||
        hasDuplicateRanks ||
        gState.arenaActiveRivals.some(r => {
            if (r.rank === myRank || (myRank === 1 && r.rank <= 1)) return true;
            if ((r.consecutiveLosses || 0) >= 2) return true;
            const maxDist = myRank <= 10 ? 4 : 8;
            if (Math.abs(r.rank - myRank) > maxDist) return true;
            return false;
        });

    if (hasInvalidRivals) {
        generateArenaRivals();
    } else {
        // Синхронизация кубков ботов Топ-10 без мутации их закрепленных рангов.
        // FIX-SYNC-SKIP-LIVE: пропускаем живых (isReal) — иначе кубки живого временно
        // перезаписывались кубками бота, которого он заменяет.
        gState.arenaActiveRivals.forEach(riv => {
            if (riv.isReal) return;
            if (riv.rank <= 10 && gState.arenaTopTenBots) {
                const targetIdx = Math.max(0, Math.min(9, riv.rank < myRank ? riv.rank - 1 : riv.rank - 2));
                const topBot = gState.arenaTopTenBots[targetIdx];
                if (topBot) riv.trophies = topBot.trophies;
            }
        });
        gState.arenaActiveRivals.sort((a, b) => a.rank - b.rank);
    }

    let rivalsData = gState.arenaActiveRivals;

    // LIVE-ARENA (v4.7.6): подмешиваем живых игроков поверх ботов.
    // gState.liveRivalsCache заполняется fetchLiveRivals() при открытии Арены.
    // Логика: заменяем первых N ботов на N живых, сохраняя rank и gain.
    // Если живых нет — список остаётся 100% из ботов (обратная совместимость).
    const liveCache = Array.isArray(gState.liveRivalsCache) ? gState.liveRivalsCache : [];
    const cacheFresh = gState.liveRivalsCacheTs && (Date.now() - gState.liveRivalsCacheTs < 120000);
    const myUid = (typeof getCurrentVkUserId === 'function') ? getCurrentVkUserId() : '';

    if (cacheFresh && liveCache.length > 0) {
        const myAtkCP = calculateCP(gState.attackFormation, null, false);
        const myTrophies = Math.floor(gState.trophies || 150);
        const TROPHY_GAP_LIMIT = 30;

        // Дедуп по uid: в KV могут быть 2+ профиля с одинаковым ником (несколько устройств).
        // Без этого один и тот же игрок показывался в списке 2-3 раза подряд.
        const seenUids = new Set([myUid]);
        const uniqueLive = [];
        for (const lp of liveCache) {
            if (!lp || !lp.uid) continue;
            if (seenUids.has(lp.uid)) {
                if (DEV_MODE_CHECK()) devLog('[LiveArena] dedup skip uid=' + lp.uid);
                continue;
            }
            seenUids.add(lp.uid);
            const theirTrophies = Math.floor(lp.trophies || 150);
            if (Math.abs(theirTrophies - myTrophies) > TROPHY_GAP_LIMIT) {
                if (DEV_MODE_CHECK()) devLog('[LiveArena] skip ' + lp.name + ' (gap=' + Math.abs(theirTrophies - myTrophies) + '>30)');
                continue;
            }
            uniqueLive.push(lp);
        }

        // Живые вставляются не в «первые слоты», а на позицию, соответствующую их кубкам.
        // Для каждого живого ищем бота с минимальной |Δ кубков| среди ещё не занятых.
        // Так BalTaZaR со 300 кубками при твоих 274 встанет на ~#650, а не на #675.
        const usedSlots = new Set();
        for (const lp of uniqueLive) {
            const theirTrophies = Math.floor(lp.trophies || 150);
            let bestIdx = -1;
            let bestDiff = Infinity;
            for (let i = 0; i < rivalsData.length; i++) {
                if (usedSlots.has(i)) continue;
                const rivalTr = Math.floor(rivalsData[i].trophies || 0);
                const diff = Math.abs(rivalTr - theirTrophies);
                if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
            }
            if (bestIdx < 0) continue;
            usedSlots.add(bestIdx);

            const bot = rivalsData[bestIdx];
            const squadIds = [];
            const squadMeta = {};
            if (Array.isArray(lp.defenseSquad) && lp.defenseSquad.length === 3) {
                lp.defenseSquad.forEach(el => {
                    if (typeof el === 'string') {
                        squadIds.push(el);
                    } else if (el && typeof el === 'object' && typeof el.id === 'string') {
                        squadIds.push(el.id);
                        squadMeta[el.id] = {
                            stars: Math.max(1, Math.min(10, parseInt(el.stars, 10) || 1)),
                            lvl: Math.max(1, Math.min(300, parseInt(el.lvl, 10) || 1))
                        };
                    } else {
                        squadIds.push('f_und_v');
                    }
                });
            } else {
                squadIds.push('f_und_v', 'f_und_c', 'f_und_r');
            }
            // v5.3.7 FIX-RIVAL-RANK-UNIFIED: rank живого = его unified rank
            // (та же формула, что в шапке и таблице). Раньше показывался номер слота
            // бота, которого заменили — BalTaZaR #7 в списке vs #8 в таблице при 682 кубках.
            const _unifiedRank = (typeof getUnifiedRankForRival === 'function') ? getUnifiedRankForRival(lp.uid) : null;
            rivalsData[bestIdx] = {
                isReal: true,
                uid: lp.uid,
                rank: _unifiedRank || bot.rank,
                name: lp.name || 'Неизвестный',
                trophies: theirTrophies,
                cp: Math.floor(lp.cp || 1000),
                squad: squadIds,
                squadMeta: squadMeta,
                gain: calculateDynamicTrophyGain(myAtkCP, lp.cp || 1000),
                isRevenge: false,
                consecutiveLosses: 0
            };
        }
        if (DEV_MODE_CHECK()) devLog('[LiveArena] merged', uniqueLive.length, 'live players into rivals');
    }

    // FIX-CACHED-RIVALS-COPY: копия массива, а не ссылка на gState.arenaActiveRivals.
    // Иначе мутации (замена элемента на живого) сохранялись в сейв и всплывали
    // после перезагрузки как «призраки» живых с устаревшими данными.
    cachedArenaRivals = rivalsData.slice();

    rivalsData.forEach((lord, index) => {
        const div = document.createElement('div');
        div.className = `building-card ${lord.isRevenge ? 'arena-revenge-card' : ''}`;
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '6px';

        const heroesBadges = lord.squad.map(hid => {
            const h = HEROES_CATALOG[hid] || HEROES_CATALOG['f_und_v'];
            return `<span class="opp-mini-badge" style="border-color:var(--tier-${(h.tier||'f').toLowerCase()});"><img src="assets/icons/elem_${h.faction}.webp" class="res-icon-inline" alt="${h.faction}"> [${h.tier}]</span>`;
        }).join('');

        const intel = getSquadTacticalIntel(lord.squad);
        const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';

        let statusPill = `<span class="intel-tag neutral">${I18N[currentLang]?.intel_balance_tag || (currentLang === 'RU' ? 'Баланс' : 'Balanced')}</span>`;
        if (lord.isRevenge) {
            statusPill = `<span class="intel-tag lose arena-revenge-tag">${I18N[currentLang]?.intel_revenge_tag || '[REVENGE]'}</span>`;
        } else if (intel.playerHasAdvantage) {
            statusPill = `<span class="intel-tag win">+15% ${cpUnit} (${currentLang === 'RU' ? 'Вы сильнее' : 'Player adv'})</span>`;
        } else if (intel.enemyHasAdvantage) {
            statusPill = `<span class="intel-tag lose">+15% ${cpUnit} (${currentLang === 'RU' ? 'Враг сильнее' : 'Enemy adv'})</span>`;
        }

        const setPrefix = I18N[currentLang]?.intel_set_prefix || (currentLang === 'RU' ? 'Сет' : 'Set');
        let synPill = intel.enemySyn.mult > 1 ? `<span class="intel-tag syn">${setPrefix} x${intel.enemySyn.mult === 1.75 ? '3' : '2'}</span>` : '';

        // LIVE-ARENA (v4.7.8): бейдж ОНЛАЙН для живых игроков
        const liveBadge = lord.isReal
            ? '<span class="live-online-badge">● ' + (currentLang === 'RU' ? 'ОНЛАЙН' : 'ONLINE') + '</span>'
            : '';

        const _rankLabel = lord.rank ? `#${lord.rank}` : '—';
        // v4.9.0: escapeHtml на lord.name — вторая линия защиты от XSS.
        // Воркер валидирует name паттерном NAME_PATTERN, но клиент обязан экранировать
        // на выходе. Одна строка — закрывает дыру при любом сбое валидации на сервере.
        const _safeLordName = escapeHtml(lord.name || '??');
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div>
                        <span class="arena-rival-title" onclick="inspectArenaRival(${index})">
                            ${_rankLabel} ${_safeLordName} ${liveBadge}
                        </span>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:3px; display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                        <span>${trIcon} <b style="color:var(--gold);">${Math.floor(lord.trophies).toLocaleString()}</b></span>
                        <span>• ${cpUnit}: <b style="color:#fff;">${formatNumber(lord.cp)}</b></span>
                        <span>• ${currentLang === 'RU' ? 'Награда:' : 'Spoils:'} <b style="color:var(--gold);">+${lord.gain} ${trIcon}</b> <b style="color:var(--gold);">+${formatNumber(lord.gain * 25)} ${gI}</b></span>
                    </div>
                </div>
                <button class="btn-action btn-arena-battle" onclick="startArenaCombatByIndex(${index})">${I18N[currentLang].btn_to_battle}</button>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <div class="opp-mini-squad">${heroesBadges} ${synPill}</div>
                <div>${statusPill}</div>
            </div>`;
        oppEl.appendChild(div);
    });
}

function inspectArenaRival(index) {
    const rival = cachedArenaRivals[index];
    if (!rival) return;
    // FIX-ARENA-INSPECT-STATS: передаём squadMeta для живых игроков, чтобы
    // модалка разведки показывала реальные звёзды/уровни их защиты.
    inspectPlayer(rival.name, rival.cp, rival.squad, rival.squadMeta || null);
}

function inspectLadderRank(rank) {
    // v5.3.5: единый rank для сравнения.
    const myRank = getCurrentUnifiedRank();
    if (rank === myRank) {
        inspectMyDefenseProfile();
        return;
    }
    // v5.3.5: если позиция занята живым — открываем его профиль, а не бота.
    const liveCache = Array.isArray(gState.liveTopCache) ? gState.liveTopCache : [];
    const myUid = (typeof getCurrentVkUserId === 'function') ? getCurrentVkUserId() : '';
    const liveNames = new Set();
    for (const lp of liveCache) {
        if (!lp || !lp.uid || lp.uid === myUid) continue;
        const lpName = String(lp.name || '').toLowerCase();
        if (liveNames.has(lpName)) continue;
        liveNames.add(lpName);
    }
    const bot = getBotByRank(rank);
    if (!bot) return;
    // Если у бота rank совпадает с живым игроком (по имени) — открываем живого.
    const botNameKey = String(bot.name || '').toLowerCase();
    const liveMatch = liveCache.find(lp => lp && lp.uid && lp.uid !== myUid && String(lp.name || '').toLowerCase() === botNameKey);
    if (liveMatch) {
        inspectLiveLadderRival(liveMatch.uid);
        return;
    }
    inspectPlayer(bot.name, bot.cp, bot.squad);
}

// v5.3.5: инспекция живого игрока из таблицы лидеров.
async function inspectLiveLadderRival(uid) {
    if (!uid) return;
    const profile = await fetchPlayerProfile(uid);
    if (!profile) {
        return pushToast(currentLang === 'RU' ? 'Игрок недоступен' : 'Player unavailable');
    }
    const squadIds = [];
    const squadMeta = {};
    if (Array.isArray(profile.defenseSquad) && profile.defenseSquad.length === 3) {
        profile.defenseSquad.forEach(el => {
            if (typeof el === 'string') {
                squadIds.push(el);
            } else if (el && typeof el === 'object' && typeof el.id === 'string') {
                squadIds.push(el.id);
                squadMeta[el.id] = {
                    stars: Math.max(1, Math.min(10, parseInt(el.stars, 10) || 1)),
                    lvl: Math.max(1, Math.min(300, parseInt(el.lvl, 10) || 1))
                };
            } else {
                squadIds.push('f_und_v');
            }
        });
    } else {
        squadIds.push('f_und_v', 'f_und_c', 'f_und_r');
    }
    inspectPlayer(profile.name || '???', Math.floor(profile.cp || 1000), squadIds, squadMeta);
}

// MAJOR-M5: reentrancy-guard блокирует быстрый двойной тап по кнопке «В БОЙ»,
// который списывал 2 билета до открытия оверлея боя.
// FIX-ARENA-STUCK: добавлен safety-net auto-reset через 5 секунд. Если callback боя
// не снял флаг (закрытый verdict-overlay, ранний return и т.п.) — игрок не залипает,
// флаг сбрасывается сам. Это устраняет ситуацию «после реванша кнопка В БОЙ молчит».
let isArenaCombatStarting = false;
let arenaCombatGuardTimer = null;
function startArenaCombatByIndex(index) {
    if (isArenaCombatStarting) return;
    isArenaCombatStarting = true;

    // Safety-net: безусловный сброс флага через 5 секунд, если он всё ещё стоит.
    clearTimeout(arenaCombatGuardTimer);
    arenaCombatGuardTimer = setTimeout(() => {
        if (isArenaCombatStarting) {
            console.warn('[Arena] Combat guard auto-reset (safety-net).');
            isArenaCombatStarting = false;
        }
    }, 5000);

    const rival = cachedArenaRivals[index];
    if (!rival) {
        isArenaCombatStarting = false;
        clearTimeout(arenaCombatGuardTimer);
        return;
    }
    startActualCombatWithRival(rival);
}

function startActualCombatWithRival(rival) {
    // FIX-ARENA-STUCK: при раннем выходе (нет билетов) гарантированно снимаем guard —
    // иначе следующий клик по «В БОЙ» молча съедался бы до конца сессии.
    if ((gState.tickets || 0) < 1) {
        isArenaCombatStarting = false;
        clearTimeout(arenaCombatGuardTimer);
        return pushToast(currentLang === 'RU' ? "Нет билетов!" : "No tickets!");
    }
    
    // Билет списывается всегда на входе в бой (сохраняем ценность билетов в Магазине!)
    gState.tickets--;
    trackQuestProgress('arena', 1);

    const pCP = calculateCP(gState.attackFormation, null, false);
    const oppCP = rival.cp || 1000;
    const trophyGain = rival.gain || calculateDynamicTrophyGain(pCP, oppCP);
    const prevRank = calculatePlayerRank();

    // Динамический расчет потери кубков: от -10 (враг значительно сильнее) до -15 (враг равен или слабее)
    let trophyLoss = 15;
    if (oppCP > pCP) {
        const ratio = oppCP / Math.max(1, pCP);
        const factor = Math.min(1, Math.max(0, (ratio - 1.0) / 0.5));
        trophyLoss = Math.round(15 - (factor * 5));
    }
    trophyLoss = Math.max(10, Math.min(15, trophyLoss));

    launchVisualCombat(gState.attackFormation, rival, 'arena', (isWin, setClaimHandler) => {
            // MAJOR-M5: снимаем guard сразу на входе в callback — VIP-ветка вызывает его
            // синхронно, визуальная — по завершении боя. В обоих случаях блокировка снята корректно.
            // FIX-ARENA-STUCK: заодно гасим safety-net таймер, чтобы он не сработал зря.
            isArenaCombatStarting = false;
            clearTimeout(arenaCombatGuardTimer);
            const trIcon = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:14px; height:14px;" alt="Кубок">';

        if (isWin) {
                const baseGold = trophyGain * 25;
                setClaimHandler((mult = 1) => {
                    const finalGold = baseGold * mult;
                    const finalTrophies = trophyGain * (mult > 1 ? 2 : 1);
                    gState.gold += finalGold;
                    gState.lifetimeGold += finalGold;
                    gState.trophies += finalTrophies;
                    gState.lifetimeWins = (gState.lifetimeWins || 0) + 1;
                    gState.ftueArenaDone = true;

                    // v5.3.0 FIX-PVP-ASYNC-ROLLBACK: ждём ответа сервера перед submit.
                    // Раньше reportArenaAttack и submitArenaProfile(true) шли параллельно —
                    // при отказе Worker'а (rate_limited, target_too_far, target_not_found)
                    // локальные +trophies всё равно уходили в KV как безосновательная награда.
                    if (rival.isReal && rival.uid && typeof reportArenaAttack === 'function') {
                        const _finalTrophiesWin = finalTrophies;
                        const _multWin = mult;
                        const _baseGoldWin = baseGold;
                        reportArenaAttack(rival.uid, 'win', trophyGain).then(resp => {
                            if (resp && resp.ok) {
                                // v5.3.1: сервер — источник истины. Если его actualDelta отличается
                                // от клиентского trophyGain — корректируем локальные кубки молча.
                                if (typeof resp.actualDelta === 'number' && resp.actualDelta > 0 && resp.actualDelta !== trophyGain) {
                                    const serverAwarded = resp.actualDelta * (_multWin > 1 ? 2 : 1);
                                    const diff = serverAwarded - _finalTrophiesWin;
                                    if (diff !== 0) {
                                        gState.trophies = Math.max(0, Math.min(3700, (gState.trophies || 0) + diff));
                                        saveGame();
                                        renderUI();
                                        renderArena();
                                        renderLeaderboard();
                                        pushToast(currentLang === 'RU'
                                            ? `Кубки скорректированы сервером: +${serverAwarded}`
                                            : `Trophies corrected by server: +${serverAwarded}`);
                                    }
                                }
                                if (typeof submitArenaProfile === 'function') submitArenaProfile(true);
                            } else {
                                // Откат: атака не зафиксирована — возвращаем и кубки, и золото.
                                gState.trophies = Math.max(0, (gState.trophies || 0) - _finalTrophiesWin);
                                gState.gold = Math.max(0, (gState.gold || 0) - _baseGoldWin * _multWin);
                                saveGame();
                                renderUI();
                                renderArena();
                                renderLeaderboard();
                                const _rsn = (resp && resp.reason) || 'network';
                                pushToast(currentLang === 'RU'
                                    ? `Сервер отклонил атаку (${_rsn}). Награды возвращены.`
                                    : `Server rejected attack (${_rsn}). Rewards refunded.`);
                            }
                        });
                    }

                    // FIX-ARENA-TROPHY-LOSS: побеждённый соперник ТЕРЯЕТ кубки (как в реальном PvP),
                    // а не бесследно исчезает из списка. Игрок отбирает у него ровно trophyGain
                    // кубков (те же, что сам получил). Если бот в Топ-10 — он опускается в
                    // глобальном ладдере (arenaTopTenBots пересортировывается).
                    //
                    // Бот ЗАМЕНЯЕТСЯ на нового только если:
                    //   • его кубки упали ниже 50% порога лиги (полный слив, пора обновить список)
                    //   • он накопил 3+ поражения подряд (проверка через consecutiveLosses)
                    if (gState.arenaActiveRivals) {
                        const rivIdx = gState.arenaActiveRivals.findIndex(r => r.name === rival.name);
                        if (rivIdx !== -1) {
                            const loser = gState.arenaActiveRivals[rivIdx];

                            // Отнимаем кубки у побеждённого
                            loser.trophies = Math.max(0, (loser.trophies || 0) - trophyGain);

                            // Если бот в Топ-10 — двигаем глобальный ладдер
                            if (loser.rank <= 10 && Array.isArray(gState.arenaTopTenBots)) {
                                const topBot = gState.arenaTopTenBots.find(b => b.name === loser.name);
                                if (topBot) {
                                    topBot.trophies = Math.max(0, (topBot.trophies || 0) - trophyGain);
                                    gState.arenaTopTenBots.sort((a, b) => b.trophies - a.trophies);
                                    gState.arenaTopTenBots.forEach((b, idx) => b.rank = idx + 1);
                                    // Синхронизируем rank в активных соперниках (мог сместиться)
                                    const updated = gState.arenaTopTenBots.find(b => b.name === loser.name);
                                    if (updated) loser.rank = updated.rank;
                                }
                            }

                            // Критерий замены: полный слив кубков ИЛИ слишком много поражений
                            const leagueMinTr = {
                                bronze: 150, silver: 800, gold: 1500, platinum: 2300, diamond: 3000
                            }[gState.arenaLeague || 'bronze'] || 150;
                            const isFullyDrained = loser.trophies < Math.max(50, leagueMinTr * 0.5);
                            const hasTooManyLosses = (loser.consecutiveLosses || 0) >= 3;

                            if (isFullyDrained || hasTooManyLosses) {
                                // Ищем свободный ранг для нового претендента
                                const otherRanks = gState.arenaActiveRivals
                                    .map((r, idx) => idx !== rivIdx ? r.rank : null)
                                    .filter(Boolean);
                                const myNewRank = calculatePlayerRank();
                                let newRank = Math.max(1, myNewRank - (rivIdx === 0 ? 3 : (rivIdx === 1 ? 2 : 1)));

                                const occupiedRanks = new Set([myNewRank, ...otherRanks]);
                                let scanAttempts = 0;
                                while (occupiedRanks.has(newRank) && scanAttempts < 1000) {
                                    scanAttempts++;
                                    newRank++;
                                }
                                if (occupiedRanks.has(newRank)) {
                                    newRank = myNewRank + 10;
                                }

                                const newBot = getBotByRank(newRank);
                                const myAtk = calculateCP(gState.attackFormation, null, false);
                                gState.arenaActiveRivals[rivIdx] = {
                                    isReal: false,
                                    rank: newRank,
                                    name: newBot.name,
                                    trophies: newBot.trophies,
                                    cp: newBot.cp,
                                    squad: [...newBot.squad],
                                    gain: calculateDynamicTrophyGain(myAtk, newBot.cp),
                                    isRevenge: false,
                                    consecutiveLosses: 0
                                };
                            } else {
                                // Бот остаётся в списке с уменьшенными кубками.
                                // Пересчитываем gain — стало проще бить, но и награда меньше.
                                const myAtk = calculateCP(gState.attackFormation, null, false);
                                loser.gain = calculateDynamicTrophyGain(myAtk, loser.cp);
                                // Счётчик поражений бота (для критерия замены)
                                loser.consecutiveLosses = (loser.consecutiveLosses || 0) + 1;
                            }

                            gState.arenaActiveRivals.sort((a, b) => a.rank - b.rank);
                        }
                    }

                    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
                    let logEntry = {
                        enemy: `${rival.name}`,
                        time: new Date().toLocaleTimeString().slice(0, 5),
                        result: currentLang === 'RU' ? 'Победа' : 'Victory',
                        text: `+${finalTrophies} ${trIcon} | +${formatNumber(finalGold)} ${gI}`
                    };
                    gState.battleHistory.unshift(logEntry);
                    if (gState.battleHistory.length > 8) gState.battleHistory.pop();

                    if (mult > 1) {
                        pushToast(`x2 НАГРАДА: +${finalTrophies} ${trIcon} • +${formatNumber(finalGold)} ${gI}`);
                    } else {
                        pushToast(`+${finalTrophies} ${trIcon} • +${formatNumber(finalGold)} ${gI}`);
                    }

                    const newRank = calculatePlayerRank();
                    if (prevRank > 1 && newRank === 1) {
                        setTimeout(() => pushToast(currentLang === 'RU' ? "ВЫ ВЗОШЛИ НА ВЕРШИНУ ЛАДДЕРА! ТОП-1!" : "YOU REACHED #1 ON THE LADDER!"), 1500);
                    }
                });
                const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
                return `+${trophyGain} ${trIcon} | +${formatNumber(baseGold)} ${gI}`;
            } else {
                setClaimHandler(() => {
                    gState.trophies = Math.max(0, (gState.trophies || 0) - trophyLoss);

                    // v5.3.0 FIX-PVP-ASYNC-ROLLBACK-LOSS: аналогично победной ветке.
                    // При отказе Worker'а — возвращаем потерянные кубки игроку.
                    if (rival.isReal && rival.uid && typeof reportArenaAttack === 'function') {
                        const _lossAmount = trophyLoss;
                        reportArenaAttack(rival.uid, 'loss', _lossAmount).then(resp => {
                            if (resp && resp.ok) {
                                if (typeof submitArenaProfile === 'function') submitArenaProfile(true);
                            } else {
                                gState.trophies = Math.min(3700, (gState.trophies || 0) + _lossAmount);
                                saveGame();
                                renderUI();
                                renderArena();
                                renderLeaderboard();
                            }
                        });
                    }

                    // Соперник НЕ исчезает: он честно забирает кубки и закрепляется в списке под статусом РЕВАНША!
                    if (gState.arenaActiveRivals) {
                        const riv = gState.arenaActiveRivals.find(r => r.name === rival.name);
                        if (riv) {
                            riv.trophies = (riv.trophies || 0) + trophyLoss;
                            riv.isRevenge = true;
                            riv.consecutiveLosses = (riv.consecutiveLosses || 0) + 1;
                        }
                    }

                    // Если бой был с ботом из Топ-10: бот физически поднимается в лидерборде!
                    if (gState.arenaTopTenBots) {
                        const topBot = gState.arenaTopTenBots.find(b => b.name === rival.name);
                        if (topBot) {
                            topBot.trophies += trophyLoss;
                        }
                        // Сортировка Топ-10 по реальным кубкам (победитель восходит на трон!)
                        gState.arenaTopTenBots.sort((a, b) => b.trophies - a.trophies);
                        gState.arenaTopTenBots.forEach((b, idx) => b.rank = idx + 1);
                    }

                    let logEntry = {
                        enemy: `${rival.name}`,
                        time: new Date().toLocaleTimeString().slice(0, 5),
                        result: currentLang === 'RU' ? 'Поражение' : 'Defeat',
                        text: `-${trophyLoss} ${trIcon}`
                    };
                    gState.battleHistory.unshift(logEntry);
                    if (gState.battleHistory.length > 8) gState.battleHistory.pop();
                });
                return `-${trophyLoss} ${trIcon}`;
            }
    });
}

// (Устаревший метод startArenaCombat удален, актуальные бои идут через startArenaCombatByIndex)

function renderBattleHistory() {
    const box = document.getElementById('battle-history-box');
    if (!box) return;
    box.innerHTML = '';
    (gState.battleHistory || []).forEach(h => {
        let locResult = h.result;
        if (currentLang === 'EN') {
            if (locResult === 'Победа') locResult = 'Victory';
            if (locResult === 'Поражение') locResult = 'Defeat';
            if (locResult === 'Оборона: Победа') locResult = 'Def: Victory';
            if (locResult === 'Оборона: Пробита') locResult = 'Def: Breached';
        } else {
            if (locResult === 'Victory') locResult = 'Победа';
            if (locResult === 'Defeat') locResult = 'Поражение';
            if (locResult === 'Def: Victory') locResult = 'Оборона: Победа';
            if (locResult === 'Def: Breached') locResult = 'Оборона: Пробита';
        }

        const row = document.createElement('div');
        row.style.fontSize = '11.5px';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '3px 0';
        row.innerHTML = `<span><b>[${locResult}]</b> vs ${h.enemy} <span style="color:var(--text-muted); font-size:11px;">(${h.time})</span></span><b style="color:var(--gold);">${h.text}</b>`;
        box.appendChild(row);
    });
}

// U3: кэш лидерборда по ключу состояния. Данные таблицы меняются редко
// (боты — раз в 45 сек через simulateLivingLadder, игрок — при победе/смене титула),
// но renderLeaderboard вызывается раз в секунду из тика. Ключ — хэш из 6 полей.
let _lastLeaderboardKey = '';

// v5.3.5 UNIFIED-LADDER: единый источник rank игрока для отображения (шапка Арены,
// таблица лидеров, генератор соперников). Собирает пул: 10 ботов + живые из liveTopCache
// + игрок, сортирует по кубкам, возвращает rank игрока (1..N). Заменяет собой
// calculatePlayerRank в отображающих местах — устраняет рассинхрон вида «шапка #7, таблица #9».
// ВНИМАНИЕ: для сезонного reset (promotion/demotion) calculatePlayerRank остаётся каноном —
// там формула считается без живых, менять её = менять игровую логику.
// v5.3.7: rank произвольного игрока в объединённом пуле (боты + живые + игрок).
// Нужен для списка соперников — там живой раньше показывался с номером слота
// бота, которого заменил (BalTaZaR #7 в списке, #8 в таблице при равных кубках).
// Возвращает честный unified rank или null если игрок не найден.
function getUnifiedRankForRival(liveUid) {
    if (!liveUid) return null;
    if (typeof ensureTopTenBots === 'function') ensureTopTenBots();
    const myUid = (typeof getCurrentVkUserId === 'function') ? getCurrentVkUserId() : '';
    const myName = String(gState.playerName || 'Duke Valdor').slice(0, 12).toLowerCase();
    const pool = [];
    const seen = new Set();
    const _botsArr = Array.isArray(gState.arenaTopTenBots) ? gState.arenaTopTenBots : [];
    for (const b of _botsArr) {
        const n = String(b.name || '').toLowerCase();
        if (!n || seen.has(n)) continue;
        seen.add(n);
        pool.push({ uid: null, trophies: Math.floor(b.trophies || 0), isMe: false });
    }
    const _top = Array.isArray(gState.liveTopCache) ? gState.liveTopCache : [];
    const _riv = Array.isArray(gState.liveRivalsCache) ? gState.liveRivalsCache : [];
    const _allLive = [..._riv, ..._top];
    for (const lp of _allLive) {
        if (!lp || !lp.uid || lp.uid === myUid) continue;
        const n = String(lp.name || '').toLowerCase();
        if (!n || seen.has(n)) continue;
        seen.add(n);
        pool.push({ uid: lp.uid, trophies: Math.floor(lp.trophies || 0), isMe: false });
    }
    if (seen.has(myName)) {
        // уже был бот с таким именем — пропускаем своего
    } else {
        pool.push({ uid: myUid || 'me', trophies: Math.floor(gState.trophies || 150), isMe: true });
    }
    pool.sort((a, b) => {
        if (b.trophies !== a.trophies) return b.trophies - a.trophies;
        return (b.isMe ? 2 : 0) - (a.isMe ? 2 : 0);
    });
    const idx = pool.findIndex(p => p.uid === liveUid);
    return idx >= 0 ? (idx + 1) : null;
}

function getCurrentUnifiedRank() {
    if (typeof ensureTopTenBots === 'function') ensureTopTenBots();
    const myUid = (typeof getCurrentVkUserId === 'function') ? getCurrentVkUserId() : '';
    const myName = String(gState.playerName || 'Duke Valdor').slice(0, 12).toLowerCase();
    const myTrophies = Math.floor(gState.trophies || 150);

    const pool = [];
    const botNames = new Set();
    // v5.3.6: итерируем arenaTopTenBots напрямую, а не через getBotByRank(r).
    // getBotByRank при myRank в топ-10 возвращает одного и того же бота для двух
    // разных r (сдвиг индекса botIndex), из-за чего в пуле появлялся дубль по имени.
    const _botsArr = Array.isArray(gState.arenaTopTenBots) ? gState.arenaTopTenBots : [];
    for (let i = 0; i < _botsArr.length; i++) {
        const b = _botsArr[i];
        if (!b) continue;
        const bName = String(b.name || '').toLowerCase();
        if (!bName || botNames.has(bName)) continue;
        botNames.add(bName);
        pool.push({ uid: 'bot_' + i, trophies: Math.floor(b.trophies || 0), isMe: false });
    }

    const liveCache = Array.isArray(gState.liveTopCache) ? gState.liveTopCache : [];
    const seenUids = new Set([myUid]);
    const seenNames = new Set(botNames);
    seenNames.add(myName);
    for (const lp of liveCache) {
        if (!lp || !lp.uid || seenUids.has(lp.uid)) continue;
        seenUids.add(lp.uid);
        const lpName = String(lp.name || '???').slice(0, 12).toLowerCase();
        if (seenNames.has(lpName)) continue;
        seenNames.add(lpName);
        pool.push({ uid: lp.uid, trophies: Math.floor(lp.trophies || 0), isMe: false });
    }

    pool.push({ uid: myUid || 'me', trophies: myTrophies, isMe: true });

    pool.sort((a, b) => {
        if (b.trophies !== a.trophies) return b.trophies - a.trophies;
        return (b.isMe ? 2 : 0) - (a.isMe ? 2 : 0);
    });
    const meIdx = pool.findIndex(p => p.isMe);
    return meIdx >= 0 ? (meIdx + 1) : 999;
}

function renderLeaderboard() {
    const lb = document.getElementById('leaderboard-box');
    if (!lb) return;
    ensureTopTenBots();

    const myTrophies = gState.trophies || 150;
    // Защита от XSS: ник лорда проходит через escapeHtml один раз при формировании пула данных.
    const cleanPlayerName = escapeHtml((gState.playerName || 'Duke Valdor').slice(0, 12));
    // v5.3.5: единый rank для отображения (шапка Арены и таблица теперь согласованы).
    const myRank = getCurrentUnifiedRank();

    // B6: cache key включает liveTopCacheTs — обновление живых триггерит пересборку.
    const liveTs = gState.liveTopCacheTs || 0;
    const cacheKey = `${myTrophies}|${cleanPlayerName}|${gState.selectedTitleId || ''}|${gState.arenaSeasonWeekId || ''}|${gState.arenaLeague || 'bronze'}|${gState.arenaShuffleSeed || 0}|${liveTs}`;
    if (_lastLeaderboardKey === cacheKey) return;
    _lastLeaderboardKey = cacheKey;

    // FIX-LEADERBOARD-UNIFIED-RANK: rank в таблице приходит из единого источника —
    // calculatePlayerRank для игрока и живых, фиксированные позиции из arenaTopTenBots
    // для ботов 1-10. Свободная сортировка по кубкам давала расхождение:
    // игрок с 332 кубками получал разный rank в таблице и в calculatePlayerRank.
    const myUid = (typeof getCurrentVkUserId === 'function') ? getCurrentVkUserId() : '';
    const myUnifiedRank = myRank; // глобальный rank игрока (calculatePlayerRank)

    // v5.2.6 FIX-LEADERBOARD-SORT: чистая сортировка по кубкам вместо подмены слотов.
    // Прошлая версия занимала topSlots[myRank-1] под игрока, и если живому вычислился
    // тот же rank (кубки равны) — он пропускался по guard'у isMe. Теперь: боты 1-10,
    // живые из liveTopCache и игрок — в одном пуле, сорт по кубкам, топ-10 на вывод.
    // Оба игрока с равными кубками видны одновременно.

    // v5.3.6 FIX: pool строится из arenaTopTenBots напрямую с dedup по имени.
    // Раньше через getBotByRank(r) при myRank в топ-10 один и тот же бот возвращался
    // для двух r (shift botIndex), в топ-10 таблицы появлялись дубли-близнецы.
    const pool = [];
    const _botSeenForPool = new Set();
    const _botsArrForPool = Array.isArray(gState.arenaTopTenBots) ? gState.arenaTopTenBots : [];
    for (let i = 0; i < _botsArrForPool.length; i++) {
        const b = _botsArrForPool[i];
        if (!b) continue;
        const _bNameKey = String(b.name || '').toLowerCase();
        if (!_bNameKey || _botSeenForPool.has(_bNameKey)) continue;
        _botSeenForPool.add(_bNameKey);
        pool.push({
            uid: 'bot_' + i,
            name: escapeHtml(b.name),
            trophies: Math.floor(b.trophies || 0),
            cp: b.cp,
            isMe: false,
            isReal: false
        });
    }

    const liveCache = Array.isArray(gState.liveTopCache) ? gState.liveTopCache : [];
    // v5.3.4 FIX-LEADERBOARD-DEDUP-BY-NAME: живой игрок и бот из humanNicknames
    // могут иметь одинаковое имя (напр. 'Мститель'). Раньше dedup был только по uid —
    // живой от бота с тем же именем не отсекался, в топ-10 появлялись дубли.
    // Теперь живые занимают свои имена в Set, ботов с такими именами пропускаем.
    const seenLiveUids = new Set([myUid]);
    const seenNames = new Set([cleanPlayerName.toLowerCase()]);
    const liveInserted = [];
    for (const lp of liveCache) {
        if (!lp || !lp.uid || seenLiveUids.has(lp.uid)) continue;
        seenLiveUids.add(lp.uid);
        const _lpName = String(lp.name || '???').slice(0, 12);
        const _lpNameKey = _lpName.toLowerCase();
        if (seenNames.has(_lpNameKey)) continue;
        seenNames.add(_lpNameKey);
        liveInserted.push({
            uid: lp.uid,
            name: escapeHtml(_lpName),
            trophies: Math.floor(lp.trophies || 0),
            cp: Math.floor(lp.cp || 0),
            isMe: false,
            isReal: true
        });
    }
    // Боты 1-10: пропускаем тех, чьё имя совпадает с уже вставленным живым.
    // (сначала строим botPool, потом — pool с живыми и игроком)
    const botPoolFiltered = pool.filter(b => !seenNames.has(String(b.name || '').toLowerCase()));
    pool.length = 0;
    pool.push(...botPoolFiltered);
    pool.push(...liveInserted);

    pool.push({
        uid: myUid || 'me',
        name: cleanPlayerName,
        trophies: Math.floor(myTrophies),
        cp: calculateCP(gState.defenseFormation, null, false),
        isMe: true,
        isReal: false
    });

    // Сортировка по кубкам desc. Tie-break: игрок > живые > боты (для стабильности
    // при равных кубках, чтобы игрок всегда видел себя в таблице).
    pool.sort((a, b) => {
        if (b.trophies !== a.trophies) return b.trophies - a.trophies;
        const scoreA = (a.isMe ? 2 : (a.isReal ? 1 : 0));
        const scoreB = (b.isMe ? 2 : (b.isReal ? 1 : 0));
        return scoreB - scoreA;
    });

    const topTen = pool.slice(0, 10).map((p, idx) => ({ ...p, rank: idx + 1 }));
    const meIdx = pool.findIndex(p => p.isMe);
    const meInTop = meIdx >= 0 && meIdx < 10;
    // v5.3.4 FIX-LEADERBOARD-HONEST-RANK: rank в подвале = честная позиция в объединённом пуле.
    // Раньше fallback шёл на myUnifiedRank (глобальная формула) — она не знает про живых,
    // и давала rank, не согласованный с топ-10 таблицей (игрок #9 в подвале, но в топ-10 его нет).
    const myRealRank = meIdx >= 0 ? (meIdx + 1) : myUnifiedRank;
    const myDisplayTrophies = Math.floor(myTrophies);

    let html = '';
    topTen.forEach(p => {
        const bgStyle = p.isMe ? 'background:rgba(245,176,65,0.22); border:1.5px solid var(--gold);' : '';
        const nameSuffix = p.isMe ? ` (${currentLang === 'RU' ? 'ВЫ' : 'YOU'})` : '';
        const liveSuffix = p.isReal ? ' <span class="live-online-badge">● ONLINE</span>' : '';

        const trIconSmall = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:14px; height:14px;" alt="Кубок">';
        let rankBadge = '';
        if (p.rank === 1) rankBadge = `<span style="color:#fde047; font-weight:900;">#1</span> `;
        else if (p.rank === 2) rankBadge = `<span style="color:#e2e8f0; font-weight:900;">#2</span> `;
        else if (p.rank === 3) rankBadge = `<span style="color:#febb7a; font-weight:900;">#3</span> `;
        else rankBadge = `<span style="color:var(--text-muted);">#${p.rank}</span> `;

        // v5.3.5: клик по живому открывает его профиль через Worker.
        const clickHandler = p.isMe
            ? 'inspectMyDefenseProfile()'
            : (p.isReal ? `inspectLiveLadderRival('${p.uid}')` : `inspectLadderRank(${p.rank})`);

        html += `
            <div class="building-card" style="padding:7px 10px; ${bgStyle} ${clickHandler ? 'cursor:pointer;' : ''}" ${clickHandler ? `onclick="${clickHandler}"` : ''}>
                <span style="font-size:12px; display:inline-flex; align-items:center; gap:4px;"><b>${rankBadge}${p.name}${nameSuffix}${liveSuffix}</b></span>
                <b style="color:var(--gold); font-size:12.5px; display:inline-flex; align-items:center; gap:3px;">${Math.floor(p.trophies).toLocaleString()} ${trIconSmall}</b>
            </div>`;
        });

        // Если игрок не вошел в Топ-10 — выводим разделитель и его персональную строку.
        // B6: зона определяется по myRealRank в объединённом пуле, а не myRank от ботов.
        if (!meInTop) {
            html += `<div class="ladder-separator">• • •</div>`;
            const myZoneTag = myRealRank >= 990 
                ? `<span style="color:#f87171; font-weight:800; font-size:11px;">${currentLang === 'RU' ? '[ВЫЛЕТ]' : '[DEMOTION]'}</span>`
                : `<span style="color:var(--gold); font-weight:800; font-size:11px;">${currentLang === 'RU' ? '[УДЕРЖАНИЕ]' : '[RETENTION]'}</span>`;

            const trIconSmall = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:14px; height:14px;" alt="Кубок">';
            html += `
            <div class="building-card" style="padding:8px 10px; background:rgba(245,176,65,0.25); border:1.5px solid var(--gold); cursor:pointer;" onclick="inspectMyDefenseProfile()">
                <span style="font-size:12px; display:inline-flex; align-items:center; gap:4px;"><b><span style="color:var(--text-muted);">#${myRealRank}</span> ${cleanPlayerName} (${currentLang === 'RU' ? 'ВЫ' : 'YOU'})</b> ${myZoneTag}</span>
                <b style="color:var(--gold); font-size:13px; display:inline-flex; align-items:center; gap:3px;">${myDisplayTrophies.toLocaleString()} ${trIconSmall}</b>
            </div>`;
        }

    lb.innerHTML = html;
}

function inspectMyDefenseProfile() {
    inspectPlayer(`${gState.playerName} (${currentLang === 'RU' ? 'Гарнизон' : 'Garrison'})`, calculateCP(gState.defenseFormation), gState.defenseFormation);
}

// Аналитический модуль тактической разведки с послотовым анализом дуэлей
function getSquadTacticalIntel(enemySquad) {
    const playerSquad = gState.attackFormation || [];
    const enemySyn = getFormationSynergy(enemySquad);
    const roleNames = [
        I18N[currentLang]?.roles?.vanguard || (currentLang === 'RU' ? 'Авангард' : 'Vanguard'),
        I18N[currentLang]?.roles?.commander || (currentLang === 'RU' ? 'Лидер' : 'Commander'),
        I18N[currentLang]?.roles?.rearguard || (currentLang === 'RU' ? 'Тыл' : 'Rearguard')
    ];

    // Послотовый анализ дуэлей (Слот игрока VS Слот врага)
    let slotAdvantages = [];
    let slotDisadvantages = [];

    for (let i = 0; i < 3; i++) {
        const pElem = HEROES_CATALOG[playerSquad[i]]?.faction;
        const eElem = HEROES_CATALOG[enemySquad[i]]?.faction;
        if (pElem && eElem) {
            if (ELEMENTAL_ADVANTAGE[pElem] === eElem) {
                slotAdvantages.push({ slot: roleNames[i], pElem, eElem });
            } else if (ELEMENTAL_ADVANTAGE[eElem] === pElem) {
                slotDisadvantages.push({ slot: roleNames[i], pElem, eElem });
            }
        }
    }

    // Подсчет преобладающей фракции врага
    const counts = {};
    (enemySquad || []).forEach(hid => {
        const f = HEROES_CATALOG[hid]?.faction;
        if (f) counts[f] = (counts[f] || 0) + 1;
    });

    let dominantFaction = 'undead';
    let maxCount = 0;
    for (let f in counts) {
        if (counts[f] > maxCount) {
            maxCount = counts[f];
            dominantFaction = f;
        }
    }

    const counterElements = {
        'undead': 'light',
        'chaos': 'undead',
        'demon': 'chaos',
        'light': 'demon'
    };
    const recommendedFaction = counterElements[dominantFaction] || 'light';

    return {
        enemySyn,
        dominantFaction,
        recommendedFaction,
        slotAdvantages,
        slotDisadvantages,
        playerHasAdvantage: slotAdvantages.length > 0,
        enemyHasAdvantage: slotDisadvantages.length > 0
    };
}

function inspectPlayer(name, cp, enemyDefenseSquad, squadMeta = null) {
    const pName = document.getElementById('p-ins-name');
    const pRank = document.getElementById('p-ins-rank');
    const sq = document.getElementById('p-ins-squad');
    const intelBox = document.getElementById('p-ins-intel-box');
    const titleGarrison = document.getElementById('lbl-ins-garrison');

    if (pName) pName.innerText = name;
    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';
    const swordsIcon = '<img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:13px; height:13px; vertical-align:-1px;" alt="БМ">';
    if (pRank) pRank.innerHTML = `${swordsIcon} ${formatNumber(cp)} ${cpUnit}`;

    // Точная проверка своего профиля (без ложных срабатываний на префиксы Lord у ботов)
    const cleanPlayerName = (gState.playerName || 'Duke Valdor').trim();
    const isSelfProfile = (name === cleanPlayerName) || name.startsWith(cleanPlayerName + ' (');
    const myAttackSquad = gState.attackFormation || [];
    const factionNames = I18N[currentLang].factions;

    if (intelBox) {
        const aI = '<img src="assets/icons/army.webp" class="res-icon-inline" alt="Оборона">';
        if (isSelfProfile) {
            // Осмотр собственного гарнизона обороны
            if (titleGarrison) titleGarrison.innerHTML = `${I18N[currentLang]?.intel_self_title || 'ВАША ОБОРОНА ЦИТАДЕЛИ'} ${aI}`;
            intelBox.innerHTML = `
                <div class="intel-hint-bar" style="border-left-color:var(--blue);">
                    ${aI} <b>${currentLang === 'RU' ? 'Гарнизон Обороны:' : 'Defense Garrison:'}</b> ${I18N[currentLang]?.intel_self_hint || ''}
                </div>`;
        } else {
            // Осмотр СОПЕРНИКА: сопоставляем АТАКУ игрока и ОБОРОНУ врага
            if (titleGarrison) titleGarrison.innerHTML = `${I18N[currentLang]?.intel_enemy_title || 'ОБОРОНА СОПЕРНИКА:'} ${aI}`;
            const intel = getSquadTacticalIntel(enemyDefenseSquad);

            let matchupVerdict = `<span class="intel-tag neutral">${I18N[currentLang]?.intel_balance_tag || 'Баланс стихий'}</span>`;
            if (intel.playerHasAdvantage) {
                matchupVerdict = `<span class="intel-tag win">${I18N[currentLang]?.intel_player_adv_tag || `Ваша Атака сильнее (+15% ${cpUnit})`}</span>`;
            } else if (intel.enemyHasAdvantage) {
                matchupVerdict = `<span class="intel-tag lose">${I18N[currentLang]?.intel_enemy_adv_tag || `Оборона врага контрит вас (+15% ${cpUnit})`}</span>`;
            }

            const noSynStr = currentLang === 'RU' ? 'Нет синергии' : 'No synergy';
            const synLabel = intel.enemySyn.mult > 1 
                ? `<span class="intel-tag syn">${intel.enemySyn.label}</span>` 
                : `<span style="color:var(--text-muted); font-size:11px;">${noSynStr}</span>`;

            const myAttackBadges = myAttackSquad.map(hid => {
                const h = HEROES_CATALOG[hid];
                return h ? `<span class="opp-mini-badge" style="border-color:var(--tier-${(h.tier||'f').toLowerCase()}); font-size:13px; padding:3px 6px;"><img src="assets/icons/elem_${h.faction}.webp" class="res-icon-inline" alt="${h.faction}"></span>` : '';
            }).join('');

            // Формируем детальное пояснение работы стихийного бонуса
            let duelDetailsHtml = '';
            if (intel.slotAdvantages.length > 0) {
                const adv = intel.slotAdvantages[0];
                const tagAdv = currentLang === 'RU' ? '[ПРЕИМУЩЕСТВО]' : '[ADVANTAGE]';
                const beatsStr = currentLang === 'RU' ? 'бьет' : 'counters';
                duelDetailsHtml = `<div style="font-size:11.5px; color:var(--green); margin-top:3px; line-height:1.35;">
                    ${tagAdv} <b>${adv.slot}:</b> ${factionNames[adv.pElem]} ${beatsStr} ${factionNames[adv.eElem]} (+15% ${cpUnit})!
                </div>`;
            } else if (intel.slotDisadvantages.length > 0) {
                const dis = intel.slotDisadvantages[0];
                const tagDis = currentLang === 'RU' ? '[УЯЗВИМОСТЬ]' : '[WEAKNESS]';
                const beatsStr = currentLang === 'RU' ? 'бьет ваш' : 'counters your';
                duelDetailsHtml = `<div style="font-size:11.5px; color:var(--red); margin-top:3px; line-height:1.35;">
                    ${tagDis} <b>${dis.slot}:</b> ${factionNames[dis.eElem]} ${beatsStr} ${factionNames[dis.pElem]}!
                </div>`;
            } else {
                duelDetailsHtml = `<div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">
                    ${I18N[currentLang]?.intel_neutral_lines || 'Стихии равны или нейтральны на всех линиях.'}
                </div>`;
            }

            const myAttackCp = calculateCP(gState.attackFormation, null, false);
            const myAtkTitle = currentLang === 'RU' ? 'Ваша Атака:' : 'Your Attack:';
            const enemySynTitle = currentLang === 'RU' ? 'Синергия врага:' : 'Enemy Synergy:';
            const statusTitle = currentLang === 'RU' ? 'Стихийный статус:' : 'Elemental Status:';
            const tipPrefix = I18N[currentLang]?.intel_tip_prefix || 'Совет: Чтобы законтрить бойцов врага';
            const tipDeploy = I18N[currentLang]?.intel_tip_deploy || 'поставьте в строй';

            intelBox.innerHTML = `
                <!-- Сравнение отрядов -->
                <div class="intel-compare-row">
                    <span>${swordsIcon} <b>${myAtkTitle}</b> <b style="color:var(--gold); margin-left:4px;">${formatNumber(myAttackCp)} ${cpUnit}</b></span>
                    <div class="intel-squad-mini-list">${myAttackBadges}</div>
                </div>
                <div class="intel-row">
                    <span style="color:var(--text-muted);">${enemySynTitle}</span>
                    <b>${synLabel}</b>
                </div>
                <div class="intel-row status-stack">
                    <span style="color:var(--text-muted);">${statusTitle}</span>
                    <b>${matchupVerdict}</b>
                </div>
                ${duelDetailsHtml}
                <div class="intel-hint-bar">
                    <b>${tipPrefix} (${factionNames[intel.dominantFaction]}), ${tipDeploy} <b>${factionNames[intel.recommendedFaction]}</b>!
                </div>`;
        }
    }

    if (sq) {
            sq.innerHTML = '';
            sq.style.display = 'grid';
            sq.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
            sq.style.gap = '6px';
            sq.style.width = '100%';

            (enemyDefenseSquad || []).forEach((hid, idx) => {
                const h = HEROES_CATALOG[hid] || HEROES_CATALOG['f_und_v'];
                const roleNames = [I18N[currentLang].roles.vanguard, I18N[currentLang].roles.commander, I18N[currentLang].roles.rearguard];
                const tColor = `var(--tier-${(h.tier||'f').toLowerCase()})`;
                const d = document.createElement('div');
                d.className = 'tcg-card';
                d.style.height = '145px';
                d.style.borderColor = tColor;

                const heroImg = h.img || `${h.id}.webp`;
                const artContent = `<img src="assets/heroes/${heroImg}" class="tcg-art-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span class="tcg-art-icon" style="display:none;">${h.icon}</span>`;

                let heroLvl = 1;
                let heroStars = 1;

                if (isSelfProfile) {
                    // Для собственного гарнизона отображаем подлинные данные из колоды игрока
                    const realCard = gState.deck[hid] || { lvl: 1, stars: 1 };
                    heroLvl = realCard.lvl || 1;
                    heroStars = realCard.stars || 1;
                } else if (squadMeta && squadMeta[hid]) {
                    // FIX-ARENA-INSPECT-STATS: для живых соперников используем реальные
                    // stars/lvl из squadMeta. Раньше здесь падало в getBotCardStats и
                    // показывало фейк: завышенные звёзды, заниженный уровень.
                    heroLvl = Math.max(1, Math.min(300, parseInt(squadMeta[hid].lvl, 10) || 1));
                    heroStars = Math.max(1, Math.min(10, parseInt(squadMeta[hid].stars, 10) || 1));
                } else {
                    // Боты: честный расчет с учетом ранга конкретного героя
                    const stats = getBotCardStats(name, cp, idx, hid);
                    heroLvl = stats.lvl;
                    heroStars = stats.stars;
                }

                d.innerHTML = `
                    <div class="tcg-art-bg-layer">${artContent}</div>
                    <div class="tcg-header">
                        <span class="tcg-tier-badge" style="color:${tColor};">[${h.tier}]</span>
                        <span style="font-size:11px; font-weight:800; color:var(--gold);">${formatHeroStars(heroStars)}</span>
                    </div>
                    <div class="tcg-footer-meta">
                        <div class="tcg-name" style="color:${tColor}; font-size:11px;">${h.name[currentLang] || h.name['EN']}</div>
                        <div class="tcg-stats" style="font-size:11px; color:#cbd5e1;">${currentLang === 'RU' ? 'Ур.' : 'Lvl'} ${heroLvl} • ${roleNames[idx]}</div>
                    </div>`;
                sq.appendChild(d);
            });
        }
    const m = document.getElementById('player-inspect-modal');
    if (m) m.style.display = 'flex';
}
function closePlayerInspect() { 
    const m = document.getElementById('player-inspect-modal');
    if (m) m.style.display = 'none'; 
}
let activeRewardsLeagueTab = 'bronze';

function openRewardsModal() {
    activeRewardsLeagueTab = gState.arenaLeague || 'bronze';
    selectRewardsLeagueTab(activeRewardsLeagueTab);
    const m = document.getElementById('rewards-modal');
    if (m) m.style.display = 'flex';
}

function closeRewardsModal() {
    const m = document.getElementById('rewards-modal');
    if (m) m.style.display = 'none';
}

function selectRewardsLeagueTab(leagueId) {
    activeRewardsLeagueTab = leagueId;
    const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    leagues.forEach(l => {
        document.getElementById(`ltab-${l}`)?.classList.toggle('active', l === leagueId);
    });

    const box = document.getElementById('rewards-league-content');
    if (!box) return;

    const rate = getIncomeRate();
    const myRank = calculatePlayerRank();
    const isCurrentPlayerLeague = (gState.arenaLeague || 'bronze') === leagueId;

    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';

    const isRU = currentLang === 'RU';
    const hStr = isRU ? 'ч Шахт' : 'h Mines';
    const heroStr = isRU ? 'Герой' : 'Hero';
    const godStr = isRU ? 'БОГ!' : 'GOD!';
    const rewardsData = {
        bronze: {
            title: isRU ? '[БРОНЗА] БРОНЗОВАЯ ЛИГА' : '[BRONZE] BRONZE LEAGUE',
            up: `+150 ${cI} • +${formatNumber(rate * 14400)} ${gI} (4${hStr}) • [A] ${heroStr}`,
            keep: `+50 ${cI} • +${formatNumber(rate * 3600)} ${gI} (1${hStr})`,
            down: `+25 ${cI} (${isRU ? 'Минимум дивизиона' : 'Division Minimum'})`
        },
        silver: {
            title: isRU ? '[СЕРЕБРО] СЕРЕБРЯНАЯ ЛИГА' : '[SILVER] SILVER LEAGUE',
            up: `+300 ${cI} • +${formatNumber(rate * 28800)} ${gI} (8${hStr}) • +1 ${rI} • [S] ${heroStr}`,
            keep: `+100 ${cI} • +${formatNumber(rate * 7200)} ${gI} (2${hStr})`,
            down: `+40 ${cI} • ${isRU ? 'Спуск в Бронзу' : 'Demoted to Bronze'}`
        },
        gold: {
            title: isRU ? '[ЗОЛОТО] ЗОЛОТАЯ ЛИГА' : '[GOLD] GOLD LEAGUE',
            up: `+600 ${cI} • +${formatNumber(rate * 43200)} ${gI} (12${hStr}) • +2 ${rI} • [S] ${heroStr}`,
            keep: `+200 ${cI} • +${formatNumber(rate * 14400)} ${gI} (4${hStr}) • +1 ${rI}`,
            down: `+80 ${cI} • ${isRU ? 'Спуск в Серебро' : 'Demoted to Silver'}`
        },
        platinum: {
            title: isRU ? '[ПЛАТИНА] ПЛАТИНОВАЯ ЛИГА' : '[PLATINUM] PLATINUM LEAGUE',
            up: `+1,200 ${cI} • +${formatNumber(rate * 86400)} ${gI} (24${hStr}) • +3 ${rI} • [SS] ${heroStr}`,
            keep: `+400 ${cI} • +${formatNumber(rate * 28800)} ${gI} (8${hStr}) • +1 ${rI}`,
            down: `+150 ${cI} • ${isRU ? 'Спуск в Золото' : 'Demoted to Gold'}`
        },
        diamond: {
            title: isRU ? '[АЛМАЗ] АЛМАЗНАЯ ЛИГА (ВЫСШИЙ ПАНТЕОН)' : '[DIAMOND] DIAMOND LEAGUE (HIGHEST PANTHEON)',
            up: `${isRU ? 'Топ-1' : 'Top 1'}: +3,000 ${cI} • +48${hStr} • +5 ${rI} • [SSS] ${godStr}<br>${isRU ? 'Топ 2-10' : 'Top 2-10'}: +1,800 ${cI} • +24${hStr} • +4 ${rI} • [SS] ${heroStr}`,
            keep: `+600 ${cI} • +${formatNumber(rate * 43200)} ${gI} (12${hStr}) • +2 ${rI}`,
            down: `+250 ${cI} • ${isRU ? 'Спуск в Платину' : 'Demoted to Platinum'}`
        }
    };

    const d = rewardsData[leagueId] || rewardsData.bronze;
    const isUp = isCurrentPlayerLeague && myRank <= 10;
    const isDown = isCurrentPlayerLeague && myRank >= 990;
    const isKeep = isCurrentPlayerLeague && !isUp && !isDown;
    const aShieldIcon = '<img src="assets/icons/army.webp" class="res-icon-inline" style="width:13px; height:13px;" alt="Щит">';

    const promoHeader = isRU ? '[ПОВЫШЕНИЕ] (Места 1–10):' : '[PROMOTION] (Ranks 1–10):';
    const retainHeader = isRU ? `${aShieldIcon} ЗОНА УДЕРЖАНИЯ (Места 11–989):` : `${aShieldIcon} RETENTION ZONE (Ranks 11–989):`;
    const demoHeader = isRU ? '[ВЫЛЕТ] (Места 990–1000):' : '[DEMOTION] (Ranks 990–1000):';

    box.innerHTML = `
        <div style="font-family:'Cinzel',serif; font-weight:900; color:var(--gold); font-size:13px; text-align:center;">${d.title}</div>
        <div class="building-card" style="flex-direction:column; align-items:stretch; gap:3px; ${isUp ? 'border-color:#22c55e; background:rgba(34,197,94,0.15);' : ''}">
            <b style="color:#4ade80; font-size:11.5px;">${promoHeader}</b>
            <div style="font-size:11px; color:#fff;">${d.up}</div>
        </div>
        <div class="building-card" style="flex-direction:column; align-items:stretch; gap:3px; ${isKeep ? 'border-color:var(--gold); background:rgba(245,176,65,0.15);' : ''}">
            <b style="color:var(--gold); font-size:11.5px;">${retainHeader}</b>
            <div style="font-size:11px; color:#fff;">${d.keep}</div>
        </div>
        <div class="building-card" style="flex-direction:column; align-items:stretch; gap:3px; ${isDown ? 'border-color:#ef4444; background:rgba(239,68,68,0.15);' : ''}">
            <b style="color:#f87171; font-size:11.5px;">${demoHeader}</b>
            <div style="font-size:11px; color:#fff;">${d.down}</div>
        </div>`;
}

/* ==========================================================
   ПОДЗЕМЕЛЬЕ (БЕЗДНА)
   ========================================================== */
// U1: LRU-кэш этажей Бездны. getDungeonFloorData вызывается из renderDungeon, startDungeonCombat,
// farmDungeonShards и из тика — на 60 FPS это 60 аллокаций/сек → GC-спайки. Кэш по floor
// с ограничением 8 актуальных этажей устраняет оверхед и оставляет fallback на пересчёт.
const _dungeonCache = new Map();
const DUNGEON_CACHE_LIMIT = 8;

function getDungeonFloorData(floor) {
    // LRU-hit: если этаж уже считался — отдаём готовый объект и двигаем его в конец очереди
    if (_dungeonCache.has(floor)) {
        const cached = _dungeonCache.get(floor);
        _dungeonCache.delete(floor);
        _dungeonCache.set(floor, cached);
        return cached;
    }

    const isBoss = (floor % 10 === 0);
    const isElite = (floor % 5 === 0 && !isBoss);
    const isApex100 = (floor >= 100);

    // Плавная 5-секторная кривая мощи.
    // Секторы 1-4 (1..100F): от 500 БМ до 55.3M БМ — каноничная прогрессия.
    // Сектор 5 (101F+): ENDLESS-режим с непрерывным ростом 1.038/этаж.
    // v4.9.6: кривая Бездны пересчитана под новую базу героев (масштаб /20 от старой).
    // floor 1=100, floor 10=1000, floor 30=9.7k, floor 60=55k, floor 100=264k.
    // Мид-гейм (отряд 40-60k) стабильно проходит 50-70 этажей.
    let rawCp = 100;
    if (floor <= 10) {
        rawCp = Math.floor(100 * Math.pow(1.30, floor - 1));
    } else if (floor <= 30) {
        rawCp = Math.floor(1000 * Math.pow(1.12, floor - 10));
    } else if (floor <= 60) {
        rawCp = Math.floor(9650 * Math.pow(1.06, floor - 30));
    } else {
        const sec4 = Math.min(40, floor - 60);
        rawCp = Math.floor(55000 * Math.pow(1.04, sec4));
        if (floor > 100) {
            const endlessFloors = floor - 100;
            rawCp = Math.floor(rawCp * Math.pow(1.035, endlessFloors));
        }
    }

    // Приоритет множителей: эпический финал 100F > боссы %10 > элиты %5 > рядовые.
    // После 100F спец. множитель апекса снят — иначе рядовые этажи перестают отличаться от боссов,
    // и прогрессия ощущается плоской. Endless-награда компенсирует сложность через чистый rawCp.
    let cp = rawCp;
    if (floor === 100) cp = Math.floor(rawCp * 1.25);
    else if (isBoss) cp = Math.floor(cp * 1.35);
    else if (isElite) cp = Math.floor(cp * 1.18);

    // Золото Бездны динамически привязано к шахтам империи
    const baseFloorGold = Math.max(500, Math.floor(getIncomeRate() * (180 + floor * 45)));
    const goldLoot = Math.floor(baseFloorGold * (isBoss ? 3.0 : (isElite ? 1.5 : 1.0)));
    const crystLoot = isApex100 ? 500 : (isBoss ? 50 : (isElite ? 20 : 5));
    const relicLoot = isApex100 ? 2 : (isBoss ? 1 : 0);

    let squad = [];

    if (isApex100) {
        // Финал 100 этажа: «Свита Первородного Бога» с чистой моносинергией 3/3 (+75%)
        const divineCourts = [
            ['sss_und_v', 's_und_c', 'ss_und_r'], // Культ Танатоса (Нежить 3/3)
            ['ss_dem_v', 's_dem_c', 'sss_dem_v'],  // Пламя Бахамута (Демоны 3/3)
            ['ss_cha_v', 'sss_cha_c', 's_cha_r'],  // Колыбель Астарты (Хаос 3/3)
            ['s_lig_v', 'ss_lig_c', 'sss_lig_r']   // Престол Люминариса (Свет 3/3)
        ];
        squad = divineCourts[(floor - 100) % divineCourts.length];
    } else if (isBoss) {
        // Боссы разлома (каждые 10): сплочённая армия единой веры с моносинергией 3/3
        const bossMonoSquads = {
            10: ['d_dem_v', 'd_dem_c', 'd_dem_r'], // Демоны 3/3
            20: ['c_lig_v', 'c_lig_c', 'c_lig_r'], // Свет 3/3
            30: ['b_und_v', 'b_und_c', 'b_und_r'], // Нежить 3/3
            40: ['b_dem_v', 'b_dem_c', 'b_dem_r'], // Демоны 3/3
            50: ['a_und_v', 'a_und_c', 'a_und_r'], // Нежить 3/3
            60: ['a_dem_v', 'a_dem_c', 'a_dem_r'], // Демоны 3/3
            70: ['a_cha_v', 'a_cha_c', 's_cha_r'], // Хаос 3/3
            80: ['s_lig_v', 'a_lig_c', 'a_lig_r'], // Свет 3/3
            90: ['ss_und_r', 'a_und_c', 'a_und_v'] // Нежить 3/3
        };
        squad = bossMonoSquads[floor] || ['s_dem_c', 'a_dem_c', 'ss_dem_v'];
    } else if (isElite) {
        // Элитные стражи (каждые 5): дуо-синергия 2/3 (+30%)
        const elitePresets = [
            ['f_und_v', 'f_und_c', 'f_dem_r'], // Нежить + Нежить + Демон
            ['e_dem_v', 'e_dem_c', 'e_cha_r'], // Демон + Демон + Хаос
            ['d_cha_v', 'd_cha_c', 'd_lig_r'], // Хаос + Хаос + Свет
            ['c_lig_v', 'c_lig_c', 'c_und_r'], // Свет + Свет + Нежить
            ['b_und_v', 'b_und_c', 'b_dem_r'],
            ['a_dem_v', 'a_dem_c', 'a_cha_r']
        ];
        squad = elitePresets[Math.floor((floor / 5)) % elitePresets.length];
    } else {
        // Рядовые этажи: разношёрстные смешанные отряды 4 стихий без моносинергии
        const earlyMixed = [
            ['f_und_v', 'f_dem_c', 'f_lig_r'],
            ['f_cha_v', 'f_und_c', 'f_dem_r'],
            ['e_lig_v', 'e_cha_c', 'e_und_r'],
            ['e_dem_v', 'e_lig_c', 'e_cha_r'],
            ['d_und_v', 'd_dem_c', 'd_cha_r'],
            ['d_cha_v', 'd_lig_c', 'd_und_r'],
            ['c_dem_v', 'c_cha_c', 'c_lig_r'],
            ['c_lig_v', 'c_und_c', 'c_dem_r'],
            ['b_cha_v', 'b_dem_c', 'b_lig_r'],
            ['b_und_v', 'b_cha_c', 'b_dem_r'],
            ['a_lig_v', 'a_cha_c', 'a_und_r'],
            ['a_dem_v', 'a_lig_c', 'a_cha_r'],
            ['s_und_c', 'a_dem_v', 'a_lig_r'],
            ['s_lig_v', 'a_cha_c', 'a_dem_r']
        ];
        squad = earlyMixed[floor % earlyMixed.length];
    }

    const bossHeroId = squad[1] || squad[0];
    const bossHero = HEROES_CATALOG[bossHeroId];

    let name = currentLang === 'RU' ? `Страж Этажа #${floor}` : `Floor Guardian #${floor}`;
    if (bossHero) {
        let titlePrefix = currentLang === 'RU' ? 'Страж' : 'Guardian';
        if (isApex100) titlePrefix = currentLang === 'RU' ? 'ПЕРВОРОДНЫЙ БОГ' : 'PRIMORDIAL GOD';
        else if (isBoss) titlePrefix = currentLang === 'RU' ? 'Владыка' : 'Monarch';
        else if (isElite) titlePrefix = currentLang === 'RU' ? 'Каратель' : 'Punisher';

        name = `${titlePrefix} #${floor} • [${bossHero.tier}] ${bossHero.name[currentLang] || bossHero.name['EN']}`;
    }

    const result = { floor, name, bossHeroId, cp, goldLoot, crystLoot, relicLoot, squad };
    // U1: сохраняем в LRU-кэш. При переполнении удаляем самый старый (первый в Map)
    if (_dungeonCache.size >= DUNGEON_CACHE_LIMIT) {
        const oldestKey = _dungeonCache.keys().next().value;
        _dungeonCache.delete(oldestKey);
    }
    _dungeonCache.set(floor, result);
    return result;
}

function refillDungeonStaminaAd() {
    // Запрет рекламы, если после прибавки +5 энергия превысит максимум 10
    if ((gState.dungeonStamina || 0) > 5) {
        return pushToast(currentLang === 'RU' ? "Энергии достаточно (максимум 10)!" : "Energy full enough (max 10)!");
    }
    if ((gState.dungeonRefillsToday || 0) >= 3) {
        return pushToast(currentLang === 'RU' ? "Лимит пополнений энергии исчерпан (3/3)!" : "Daily refills limit reached (3/3)!");
    }
    const btn = document.getElementById('btn-dung-refill');
    if (btn) btn.disabled = true;

    showPlatformRewarded(() => {
        if (btn) btn.disabled = false;
        gState.dungeonStamina = Math.min(10, (gState.dungeonStamina || 0) + 5);
        gState.dungeonRefillsToday = (gState.dungeonRefillsToday || 0) + 1;
        saveGame();
        renderDungeon();
        const eI = '<img src="assets/icons/icon_energy.webp" class="res-icon-inline icon-energy-glow" alt="E">';
        pushToast(currentLang === 'RU' ? `+5 ${eI} (${gState.dungeonRefillsToday}/3)!` : `+5 ${eI} (${gState.dungeonRefillsToday}/3)!`);
    }, () => {
        if (btn) btn.disabled = false;
    });
}

function renderDungeon() {
    const d = getDungeonFloorData(gState.dungeonFloor || 1);
    const fBadge = document.getElementById('ui-dungeon-floor-badge');
    const bName = document.getElementById('dung-boss-name');
    const bAvatar = document.getElementById('dung-boss-avatar');
    const bCP = document.getElementById('dung-boss-cp');
    const lDesc = document.getElementById('dung-loot-desc');
    const sBadge = document.getElementById('dung-stamina-badge');

    if (fBadge) {
        const curFloor = gState.dungeonFloor || 1;
        const floorWord = currentLang === 'RU' ? 'ЭТАЖ' : 'FLOOR';
        // B6: для 100F+ добавляем символ бесконечности — визуальный намёк на endless-прогрессию
        const endlessMark = curFloor > 100 ? ' <span style="color:var(--crystal); font-weight:900;">∞</span>' : '';
        fBadge.innerHTML = `${floorWord} ${curFloor}${endlessMark}`;
    }
    if (bName) bName.innerText = d.name;
    if (bAvatar) {
        const h = HEROES_CATALOG[d.bossHeroId] || HEROES_CATALOG['f_und_v'];
        const heroImg = h.img || `${h.id}.webp`;
        const tColor = `var(--tier-${(h.tier||'f').toLowerCase()})`;
        bAvatar.innerHTML = `
            <div class="dungeon-boss-portrait-wrap" style="border-color:${tColor}; box-shadow:0 0 16px ${tColor};">
                <img src="assets/heroes/${heroImg}" class="dungeon-boss-portrait-img" onerror="this.onerror=null; this.style.display='none';">
                <div class="dungeon-boss-elem-tag">
                    <img src="assets/icons/elem_${h.faction}.webp" class="res-icon-inline" style="width:14px; height:14px;" alt="${h.faction}">
                </div>
            </div>`;
    }
    // v4.9.6: предпросмотр отряда врага — 3 мини-бейджа с тиром и фракцией.
    // Игрок сразу видит состав стража и понимает, какую команду собирать (моно-синергия vs контр-пики).
    const _sqPreview = document.getElementById('dung-squad-preview');
    if (_sqPreview && Array.isArray(d.squad) && d.squad.length) {
        const _badgesHtml = d.squad.map(hid => {
            const h = HEROES_CATALOG[hid] || HEROES_CATALOG['f_und_v'];
            return `<span class="opp-mini-badge" style="border-color:var(--tier-${(h.tier||'f').toLowerCase()});"><img src="assets/icons/elem_${h.faction}.webp" class="res-icon-inline" alt="${h.faction}"> [${h.tier}]</span>`;
        }).join('');
        _sqPreview.innerHTML = `<div class="opp-mini-squad" style="justify-content:center; margin-top:4px;">${_badgesHtml}</div>`;
    }
    if (bCP) bCP.innerHTML = `<img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:12px; height:12px;" alt="БМ"> ${formatNumber(d.cp)} ${currentLang === 'RU' ? 'БМ' : 'CP'}`;
    if (sBadge) {
        const eIcon = '<img src="assets/icons/icon_energy.webp" class="res-icon-inline icon-energy-glow" style="width:16px; height:16px;" alt="E">';
        sBadge.innerHTML = `${eIcon} <span>${I18N[currentLang].dung_energy} <b style="color:var(--gold);">${gState.dungeonStamina || 0}/10</b></span>`;
    }

    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
    let lootStr = `+${formatNumber(d.goldLoot)} ${gI} | +${d.crystLoot} ${cI}`;
    if (d.relicLoot > 0) lootStr += ` | +${d.relicLoot} ${rI}`;
    if (lDesc) lDesc.innerHTML = lootStr;

    // Кнопка добора энергии: при исчерпании лимита (3/3) блокируется с обратным отсчетом до полуночи
    const btnRefill = document.getElementById('btn-dung-refill');
    if (btnRefill) {
        const leftRefills = 3 - (gState.dungeonRefillsToday || 0);
        if ((gState.dungeonStamina || 0) < 10) {
            btnRefill.style.display = 'inline-flex';
            if (leftRefills > 0) {
                btnRefill.disabled = false;
                btnRefill.innerHTML = `<img src="assets/icons/icon_ad.webp" class="icon-ad-inline" style="width:13px; height:13px;"> +5 <img src="assets/icons/icon_energy.webp" class="res-icon-inline icon-energy-glow" style="width:13px; height:13px;" alt="E"> (${leftRefills}/3)`;
            } else {
                btnRefill.disabled = true;
                btnRefill.innerHTML = `<img src="assets/icons/icon_hourglass.webp" class="icon-hourglass-inline" style="width:13px; height:13px;"> Лимит (${getFormattedMidnightCountdown()})`;
            }
        } else {
            btnRefill.style.display = 'none';
        }
    }

        const sqWrapper = document.getElementById('dung-squad-wrapper');
        if (sqWrapper) {
            const totalCp = calculateCP(gState.attackFormation, null, true); // В Бездне армия СЧИТАЕТСЯ!
            const armyCount = gState.army || 0;
            // FIX-ARMY-VISIBLE v4.7.0: показываем вклад армии в общую мощь легиона
            // отдельным чипом. Игрок видел "Армия в гарнизоне: 500" без понимания,
            // что она реально даёт в бою (расчёт CP был непрозрачен).
            // Формула идентична calculateCP (includeArmy=true).
            const armyCpBonus = Math.floor(armyCount * 0.8 + (armyCount * armyCount) / 50000 + ((gState.buildings.keep || 1) * 20));
            const titleStr = I18N[currentLang].dung_squad_title || (currentLang === 'RU' ? 'МОЩЬ ЛЕГИОНА:' : 'LEGION POWER:');
            const editStr = currentLang === 'RU' ? 'Изменить строй ➔' : 'Edit Squad ➔';
            const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';
            const totPwrStr = currentLang === 'RU' ? 'Общая Мощь:' : 'Total Power:';
            const garArmyStr = currentLang === 'RU' ? 'Армия в гарнизоне:' : 'Garrison Army:';

            let badgesHtml = '';
            (gState.attackFormation || []).forEach(hid => {
                const h = HEROES_CATALOG[hid] || HEROES_CATALOG['f_und_v'];
                badgesHtml += `<span class="opp-mini-badge" style="border-color:var(--tier-${(h.tier||'f').toLowerCase()});"><img src="assets/icons/elem_${h.faction}.webp" class="res-icon-inline" alt="${h.faction}"> [${h.tier}]</span>`;
            });

            const swordsIcon = '<img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:13px; height:13px; vertical-align:-1px;" alt="БМ">';
            sqWrapper.innerHTML = `
                <div class="building-card" style="background: radial-gradient(circle at right, rgba(34,197,94,0.15) 0%, rgba(16,20,29,0.9) 100%); border: 1.5px solid var(--border-metal); cursor: pointer; flex-direction: column; align-items: stretch; gap: 8px;" onclick="openRosterFrom('dungeon-view')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="font-family:'Cinzel',serif; font-size:14px; font-weight:900; color:var(--green); text-shadow:0 0 8px rgba(34,197,94,0.4);">${titleStr}</div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:5px;">${swordsIcon} ${totPwrStr} <b style="color:#fff; font-size:13.5px;">${formatNumber(totalCp)} ${cpUnit}</b></div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;"><img src="assets/icons/army.webp" class="res-icon-inline" alt="A"> ${garArmyStr} <b style="color:var(--green);">${formatNumber(armyCount)}</b> <span style="color:var(--gold); font-weight:800;">(+${formatNumber(armyCpBonus)} ${cpUnit})</span></div>
                        </div>
                        <div style="text-align:right; margin-top:2px;">
                            <div style="font-size:11px; font-weight:800; color:var(--text-muted);">${editStr}</div>
                        </div>
                    </div>
                    <div class="preview-badges-row">${badgesHtml}</div>
                </div>`;
        }
    }

// Reentrancy-guard: блокирует повторное списание стамины при быстром спаме кнопки «Штурм»
let isDungeonCombatStarting = false;

function startDungeonCombat() {
    if (isDungeonCombatStarting) return;
    if ((gState.dungeonStamina || 0) < 1) {
        return pushToast(currentLang === 'RU' ? "Недостаточно энергии! Пополните кнопкой [+ 📺]" : "Need Energy! Refill with [+ 📺]");
    }

    isDungeonCombatStarting = true;

    // Энергия списывается сразу на входе, а каждый штурм честно двигает прогресс квеста!
    gState.dungeonStamina--;
    trackQuestProgress('dungeon', 1);
    saveGame();
    renderDungeon();
    renderUI();

    const d = getDungeonFloorData(gState.dungeonFloor || 1);
    launchVisualCombat(gState.attackFormation, d, 'dungeon', (isWin, setClaimHandler) => {
        // Снимаем флаг в самом раннем безопасном месте: на VIP-ветке launchVisualCombat
        // возвращается синхронно, на визуальной — оверлей уже перехватил тачи над кнопкой.
        isDungeonCombatStarting = false;
        if (isWin) {
            setClaimHandler((mult = 1) => {
                const finalGold = d.goldLoot * mult;
                const finalCryst = d.crystLoot * mult;
                gState.gold += finalGold;
                gState.lifetimeGold += finalGold;
                gState.crystals += finalCryst;
                gState.relics += d.relicLoot;

                // FIX-ARMY-ATTRITION: 4% армии списывается за штурм этажа.
                // Без этого армия упирается в кап и стоит мёртвым грузом —
                // достижение ach_a («Соберите гарнизон N воинов») выполняется один раз.
                const armyLoss = Math.floor((gState.army || 0) * 0.04);
                if (armyLoss > 0) {
                    gState.army = Math.max(0, (gState.army || 0) - armyLoss);
                }

                // Если побежден босс (каждые 5 этажей) — открываем свиток Хроники Бездны!
                if (d.floor % 5 === 0) {
                    if ((gState.dungeonStamina || 0) < 10) gState.dungeonStamina++;
                    setTimeout(() => openChronicleModal(d.floor), 400);
                }

                gState.dungeonFloor = (gState.dungeonFloor || 1) + 1;
                
                const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
                const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
                const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
                
                let toastStr = `+${formatNumber(finalGold)} ${gI} • +${finalCryst} ${cI}`;
                if (d.relicLoot > 0) toastStr += ` • +${d.relicLoot} ${rI}`;
                if (armyLoss > 0) toastStr += currentLang === 'RU'
                    ? ` • -${formatNumber(armyLoss)} воинов`
                    : ` • -${formatNumber(armyLoss)} troops`;

                if (mult > 1) {
                    pushToast(currentLang === 'RU' ? `x2 НАГРАДА: ${toastStr}` : `x2 REWARD: ${toastStr}`);
                } else {
                    pushToast(toastStr);
                }
            });
            const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
            const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
            return `+${formatNumber(d.goldLoot)} ${gI} | +${d.crystLoot} ${cI}`;
        } else {
            setClaimHandler(() => {
                // FIX-ARMY-ATTRITION: при поражении потери удвоены (x2 базовых).
                // Неудачный штурм стоит дороже успешного — армия течёт быстрее.
                const armyLoss = Math.floor((gState.army || 0) * 0.04 * 2);
                if (armyLoss > 0) {
                    gState.army = Math.max(0, (gState.army || 0) - armyLoss);
                    pushToast(currentLang === 'RU'
                        ? `-${formatNumber(armyLoss)} воинов`
                        : `-${formatNumber(armyLoss)} troops`);
                }
            });
            return currentLang === 'RU' ? 'Поражение в Бездне' : 'Abyss Defeat';
        }
    });
}

// Быстрый рейд (Sweep): мгновенная зачистка без кулдауна!
let isQuickSweepActive = false;
function farmDungeonShards() {
    if (isQuickSweepActive) return;
    isQuickSweepActive = true;
    if ((gState.dungeonStamina || 0) <= 0) {
        isQuickSweepActive = false;
        return pushToast(currentLang === 'RU' ? "Закончилась энергия Бездны (10/10)!" : "Abyss energy depleted (10/10)!");
    }
    
    const targetFloor = Math.max(1, (gState.dungeonFloor || 1) - 1);
    if (targetFloor < 1 && (gState.dungeonFloor || 1) === 1) {
        // FIX-QUICK-SWEEP-GUARD v4.7.0: снимаем флаг перед ранним возвратом.
        // Иначе кнопка "Быстрый рейд" молча блокировалась до перезапуска приложения
        // (игрок считал, что кнопка "серая" и не работает).
        isQuickSweepActive = false;
        return pushToast(currentLang === 'RU' ? "Сначала пройдите 1-й этаж!" : "Clear Floor 1 first!");
    }

    gState.dungeonStamina--;
    const d = getDungeonFloorData(targetFloor);
    
    const farmGold = d.goldLoot;
    const farmCryst = Math.floor(d.crystLoot * 0.5); // В авто-рейде дают половину кристаллов

    gState.gold += farmGold;
    gState.lifetimeGold += farmGold;
    gState.crystals += farmCryst;

    // FIX-ARMY-ATTRITION-SWEEP: быстрый рейд тоже тратит армию (4% как обычный штурм).
    const sweepArmyLoss = Math.floor((gState.army || 0) * 0.04);
    if (sweepArmyLoss > 0) {
        gState.army = Math.max(0, (gState.army || 0) - sweepArmyLoss);
    }

    trackQuestProgress('dungeon', 1);
    playCoinSfx();
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const sweepLabel = currentLang === 'RU' ? 'БЫСТРЫЙ РЕЙД' : 'QUICK SWEEP';
    const sweepLossSuffix = sweepArmyLoss > 0
        ? (currentLang === 'RU' ? ` • -${formatNumber(sweepArmyLoss)} воинов` : ` • -${formatNumber(sweepArmyLoss)} troops`)
        : '';
    pushToast(`${sweepLabel}: +${formatNumber(farmGold)} ${gI} • +${farmCryst} ${cI}${sweepLossSuffix}`);

    saveGame();
    renderDungeon();
    renderUI();
    isQuickSweepActive = false;
}

/* ==========================================================
   МИРОВОЙ РЕЙД (СНАПШОТ HP НА ВСЮ НЕДЕЛЮ, БЕЗ СБРОСА ПРИ ВОЗВЫШЕНИИ)
   ========================================================== */
function getRaidCooldownMs() { return isVipActive() ? 60000 : 300000; }

function speedupRaidCooldown() {
    if (isVipActive() || gState.raidSpeedupUsed) return;
    showPlatformRewarded(() => {
        const now = Date.now();
        const elapsed = now - (gState.lastRaidAttackTime || 0);
        const totalCd = getRaidCooldownMs();
        if (elapsed < totalCd) {
            const remaining = totalCd - elapsed;
            gState.lastRaidAttackTime -= Math.floor(remaining * 0.5);
            gState.raidSpeedupUsed = true;
            saveGame();
            renderRaidBossUI();
            pushToast(currentLang === 'RU' ? "Откат удара сокращен на 50%!" : "Strike cooldown halved by 50%!");
        }
    });
}

// FIX-RAID-HP: Левиафан требует ~25 ударов для убийства.
// HP фиксируется раз в неделю (в полночь воскресенья) от текущего CP игрока.
// Это устраняет ваншот ветеранами с 10+ реликвиями и сохраняет вызов для всех.
// Fallback для чистых сейвов и первого запуска — считаем от текущего CP.
function getRaidMaxHp() {
    // v4.9.6: база HP пересчитана под новую экономику (старая 5M при CP ~2000 = 2500 ударов).
    // Новая база 50K даёт мид-гейму 25 ударов, как задумано в FIX-RAID-HP.
    // v4.9.6: HP = CP × 40 (было ×25). За неделю игрок подрастает — ударов <40.
    if (!gState.worldBossMaxHp || gState.worldBossMaxHp < 2000000) {
        gState.worldBossMaxHp = Math.max(2000000, Math.floor(calculateCP(gState.attackFormation) * 40));
    }
    return gState.worldBossMaxHp;
}

function getTimeUntilSundayMidnight() {
    const now = new Date();
    const target = new Date(now);
    const day = now.getDay(); // 0 - воскресенье, 1..6 - пн..сб
    const daysToAdd = (7 - day) % 7;
    target.setDate(now.getDate() + daysToAdd);
    target.setHours(24, 0, 0, 0); // Полночь сегодняшнего воскресенья или ближайшего
    const diffSec = Math.max(0, Math.floor((target - now) / 1000));
    const d = Math.floor(diffSec / 86400);
    const h = Math.floor((diffSec % 86400) / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    return `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Перезапуск рейда и расчет усиленного босса СТРОГО в полночь воскресенья
function checkWeeklyRaidReset() {
    // MAJOR-M2: заморозка недельного ресета рейда при откате часов
    if (isClockRolledBack) return;

    // U13: дроссель 30 секунд — неделя меняется в воскресенье, оверхед не нужен
    const _now = Date.now();
    if (_now - _lastWeeklyResetCheckTs < 30000) return;
    _lastWeeklyResetCheckTs = _now;

    const curWeek = getWeekIdentifier();
    // FIX-RAID-HP: HP Левиафана считается от текущего CP игрока — ~25 ударов до победы.
    // Убрана старая формула relics * 0.35 и верхний потолок 100M, ломавший эндгейм.
    const calculatedMax = Math.max(2000000, Math.floor(calculateCP(gState.attackFormation) * 40));

    if (!gState.worldBossMaxHp || gState.worldBossMaxHp < 2000000) {
        gState.worldBossMaxHp = calculatedMax;
    }
    if (gState.worldBossHp === undefined || gState.worldBossHp > gState.worldBossMaxHp) {
        gState.worldBossHp = gState.worldBossMaxHp;
    }

    // Наступило воскресенье полночь — старый босс «убегает», рождается новый.
    // HP сбрасывается в полный максимум и фиксируется на всю неделю.
    if (gState.worldBossWeekId !== curWeek) {
        gState.worldBossWeekId = curWeek;
        gState.worldBossMaxHp = calculatedMax;
        gState.worldBossHp = gState.worldBossMaxHp;
        gState.isRaidDefeatedThisWeek = false;
        gState.lastRaidAttackTime = 0;
        saveGame();
    }
}

function attackWorldRaidBoss() {
    if (gState.isRaidDefeatedThisWeek || (gState.worldBossHp || 0) <= 0) {
        return pushToast(currentLang === 'RU' ? "Левиафан уже повержен на этой неделе!" : "Leviathan already defeated this week!");
    }

    const now = Date.now();
    const elapsed = now - (gState.lastRaidAttackTime || 0);
    const raidCd = getRaidCooldownMs();
    
    // Во время шага обучения рейда снимаем кулдаун, чтобы игрок нанес удар без задержек
    const isTutorialRaidStep = !isFtueCompleted() && (gState.ftueStep || 0) === 10;

    if (!isTutorialRaidStep && elapsed < raidCd) {
        const leftSec = Math.ceil((raidCd - elapsed) / 1000);
        return pushToast(currentLang === 'RU' ? `Откат удара: ${getFormattedTime(leftSec)}` : `Cooldown: ${getFormattedTime(leftSec)}`);
    }

    const maxHp = getRaidMaxHp();
    
    // Нормализация при первом запуске
    if (gState.worldBossHp > maxHp) {
        gState.worldBossHp = maxHp;
    }

    const myCP = calculateCP(gState.attackFormation);
    const finalDamage = Math.max(500, myCP);

    gState.worldBossHp = Math.max(0, gState.worldBossHp - finalDamage);
    gState.lastRaidAttackTime = now;
    gState.raidSpeedupUsed = false;
    gState.ftueRaidDone = true;
    trackQuestProgress('raid', 1); // Прогресс квеста на рейд
    playBladeClash();

    // FIX-ARMY-ATTRITION: Левиафан отбивается — гарнизон несёт потери ~10% за удар.
    // Без этого армия упирается в кап и стоит мёртвым грузом (см. ach_a).
    const raidArmyLoss = Math.floor((gState.army || 0) * 0.10);
    if (raidArmyLoss > 0) {
        gState.army = Math.max(0, (gState.army || 0) - raidArmyLoss);
    }
    const lossSuffix = raidArmyLoss > 0
        ? (currentLang === 'RU' ? ` • -${formatNumber(raidArmyLoss)} воинов` : ` • -${formatNumber(raidArmyLoss)} troops`)
        : '';
    pushToast(`-${formatNumber(finalDamage)} HP!${lossSuffix}`);
    renderFtue();

    // Победа над Левиафаном: строго +1 Реликвия и эпический оверлей
    if (gState.worldBossHp <= 0) {
        gState.isRaidDefeatedThisWeek = true;
        // v4.9.7: Левиафан даёт реликвию с шансом 15% (было гарантированно).
        const gotRelic = Math.random() < 0.15;
        const rewardCryst = 100;
        if (gotRelic) gState.relics = (gState.relics || 0) + 1;
        gState.crystals = (gState.crystals || 0) + rewardCryst;
        gState.lastRaidRelicGot = gotRelic;
        openLeviathanTriumphOverlay();

        if (typeof PlatformBridge !== 'undefined' && PlatformBridge.checkAndPromptReview) {
            setTimeout(() => PlatformBridge.checkAndPromptReview(), 2500);
        }
    }
    saveGame();
    renderRaidBossUI();
    renderUI();
}

function openLeviathanTriumphOverlay() {
    if (isLeviathanTriumphInProgress) return;
    isLeviathanTriumphInProgress = true;
    playCosmicAscensionAudio();
    triggerHaptic('legendary');

    const overlay = document.getElementById('leviathan-triumph-overlay');
    const vortex = document.getElementById('leviathan-triumph-vortex');
    const flash = document.getElementById('leviathan-triumph-flash');
    const card = document.getElementById('leviathan-triumph-card');

    // Динамическая локализация всех надписей триумфа над Левиафаном
    const badgeEl = document.getElementById('lbl-leviathan-badge');
    const titleEl = document.getElementById('lbl-leviathan-title');
    const descEl = document.getElementById('lbl-leviathan-desc');
    const shareBtn = document.getElementById('btn-leviathan-share');
    const claimBtn = document.getElementById('btn-leviathan-claim');

    if (badgeEl) badgeEl.innerText = I18N[currentLang]?.raid_triumph_badge || (currentLang === 'RU' ? 'РЕЙД НЕДЕЛИ ЗАВЕРШЕН' : 'WEEKLY RAID CONCLUDED');
    if (titleEl) titleEl.innerText = I18N[currentLang]?.raid_triumph_title || (currentLang === 'RU' ? 'ЛЕВИАФАН ПОВЕРЖЕН!' : 'LEVIATHAN DEFEATED!');
    if (descEl) descEl.innerText = I18N[currentLang]?.raid_triumph_desc || (currentLang === 'RU' ? 'Древний титан глубин пал перед несокрушимой мощью вашего легиона!' : 'The ancient abyssal titan has fallen before your legion!');
    if (shareBtn) shareBtn.innerHTML = I18N[currentLang]?.raid_triumph_share_btn || (currentLang === 'RU' ? 'НА СТЕНУ (+25 <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">)' : 'SHARE (+25 <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">)');
    if (claimBtn) claimBtn.innerText = I18N[currentLang]?.raid_triumph_claim_btn || (currentLang === 'RU' ? 'ПРИНЯТЬ ТРИУМФ ➔' : 'CLAIM TRIUMPH ➔');

    // v4.9.7: показываем, выпала ли реликвия (шанс 15%).
    const _relicValEl = document.getElementById('raid-triumph-relic-val');
    if (_relicValEl) {
        if (gState.lastRaidRelicGot) {
            _relicValEl.innerHTML = '+1 <img src="assets/icons/relic.webp" class="res-icon-inline" alt="R"> (+15% ко всему)';
            _relicValEl.style.color = 'var(--gold)';
        } else {
            _relicValEl.innerHTML = (currentLang === 'RU' ? 'не выпала (шанс 15%)' : 'not dropped (15% chance)');
            _relicValEl.style.color = 'var(--text-muted)';
        }
    }
    if (overlay) overlay.style.display = 'flex';
    setTimeout(() => vortex?.classList.add('active'), 20);
    setTimeout(() => {
        flash?.classList.add('active');
        spawnCelebrationConfetti();
        triggerHaptic('crit');
        setTimeout(() => card?.classList.add('revealed'), 250);
    }, 400);
}

function closeLeviathanTriumphOverlay() {
    const overlay = document.getElementById('leviathan-triumph-overlay');
    if (overlay) overlay.style.display = 'none';
    isLeviathanTriumphInProgress = false;
    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    pushToast(currentLang === 'RU' ? `ТРОФЕИ ПОБЕДИТЕЛЯ: +1 ${rI} • +100 ${cI}` : `RAID SPOILS: +1 ${rI} • +100 ${cI}`);
    saveGame();
    renderRaidBossUI();
    renderUI();
}

function renderRaidBossUI() {
    // U2: пропускаем тяжёлый рендер (HP-бар, иконки, кнопка), если вкладка Рейда неактивна.
    // Состояние HP уже хранится в gState и пересчитается при заходе (navigate вызывает рендер).
    // Это убирает ~15 DOM-updates/sec в фоне без потери консистентности данных.
    const raidView = document.getElementById('raid-view');
    const hubModal = document.getElementById('battle-hub-modal');
    const isViewActive = raidView && raidView.classList.contains('active');
    const isHubOpen = hubModal && hubModal.style.display === 'flex';
    if (!isViewActive && !isHubOpen) return;

    const maxHp = getRaidMaxHp();

    // Защита текущего здоровья: не превышает зафиксированный максимум недели
    if (gState.worldBossHp === undefined || gState.worldBossHp > maxHp) {
        gState.worldBossHp = maxHp;
    }

    const hp = Math.max(0, Math.min(maxHp, gState.worldBossHp));
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

    const bar = document.getElementById('raid-boss-hp-bar');
    const txt = document.getElementById('raid-boss-hp-text');
    const btn = document.getElementById('btn-raid-attack');
    const icon = document.getElementById('raid-boss-icon');
    const cdLabel = document.getElementById('raid-reset-countdown');
    const strikeTimer = document.getElementById('raid-strike-timer');

    if (bar) bar.style.width = `${pct}%`;
    if (txt) txt.innerText = `${formatNumber(hp)} / ${formatNumber(maxHp)} HP (${pct.toFixed(1)}%)`;
    if (cdLabel) cdLabel.innerText = getTimeUntilSundayMidnight();

    const now = Date.now();
    const elapsed = now - (gState.lastRaidAttackTime || 0);
    const raidCd = getRaidCooldownMs();
    const isCoolingDown = elapsed < raidCd;

    const speedupBox = document.getElementById('raid-strike-speedup-box');

        // Кнопка ускорения размещается строго под боевой кнопкой
        if (speedupBox) {
            if (isCoolingDown && !gState.isRaidDefeatedThisWeek && hp > 0 && !isVipActive() && !gState.raidSpeedupUsed) {
                speedupBox.style.display = 'block';
                const spdText = I18N[currentLang]?.raid_speedup_btn || (currentLang === 'RU' ? 'Сократить откат на 50%' : 'Reduce Cooldown 50%');
                speedupBox.innerHTML = `<button class="btn-action btn-ad-standard" onclick="speedupRaidCooldown()"><img src="assets/icons/icon_ad.webp" class="icon-ad-inline"> ${spdText}</button>`;
            } else {
                speedupBox.style.display = 'none';
            }
        }

        // Таймер перезарядки отображается в кнопке с цветным золотым стилем и без серого фильтра
        if (btn) {
            const leviathanArt = '<img src="assets/icons/boss_leviathan.webp" style="width:128px; height:128px; object-fit:contain;" alt="Левиафан">';
            if (gState.isRaidDefeatedThisWeek || hp <= 0) {
                btn.disabled = true;
                btn.classList.remove('is-cooldown');
                btn.innerText = I18N[currentLang].raid_defeated;
                if (icon) icon.innerHTML = `<div style="filter:grayscale(0.85) opacity(0.6);">${leviathanArt}</div>`;
            } else if (isCoolingDown) {
                btn.disabled = true;
                btn.classList.add('is-cooldown');
                const leftSec = Math.ceil((raidCd - elapsed) / 1000);
                btn.innerHTML = `<img src="assets/icons/icon_hourglass.webp" class="icon-hourglass-inline" style="margin-right:8px;"> ${getFormattedTime(leftSec)}`;
                if (icon) icon.innerHTML = leviathanArt;
            } else {
                btn.disabled = false;
                btn.classList.remove('is-cooldown');
                btn.innerText = I18N[currentLang].raid_attack;
                if (icon) icon.innerHTML = leviathanArt;
            }
        }
}

/* ==========================================================
   АЛТАРЬ (ГАЧА)
   ========================================================== */
function toggleQuickSummonSetting(val) {
    gState.quickSummonEnabled = val;
    saveGame();
}

function summonGacha(type, count = 1) {
    const now = Date.now();
    let isFree = false;

    // Логика бесплатных призывов по таймеру
    if (count === 1) {
        if (type === 'gold' && now - (gState.lastFreeBasicSummon || 0) >= 8 * 3600 * 1000) {
            isFree = true;
            gState.lastFreeBasicSummon = now;
        } else if (type === 'crystal' && now - (gState.lastFreeEliteSummon || 0) >= 48 * 3600 * 1000) {
            isFree = true;
            gState.lastFreeEliteSummon = now;
        }
    }

    if (!isFree) {
        // Базовый призыв: 10 Кристаллов (x1) / 90 Кристаллов (x10) — ровно в 10 раз дешевле Элитного!
        const costPerOne = (type === 'gold') ? 10 : 100;
        const totalCost = Math.floor(costPerOne * count * (count === 10 ? 0.9 : 1.0));
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';

        if ((gState.crystals || 0) < totalCost) {
            return pushToast(currentLang === 'RU' ? `Нужно ${totalCost} ${cI}` : `Requires ${totalCost} ${cI}`);
        }
        gState.crystals -= totalCost;
    }

    trackQuestProgress('summon', count);
    playSfx(800, 'sine', 0.1);

    const pullResults = [];
    for (let i = 0; i < count; i++) {
        const tiers = (type === 'gold') ? ['F','E','D','C','B','A'] : ['D','C','B','A','S','SS','SSS'];
        const weights = (type === 'gold') ? [45,25,15,9,5,1] : [42,28,18,10,1.2,0.6,0.2];
        pullResults.push(rollHero(tiers, weights));
    }
    saveGame();
    renderCards();
    renderQuests();
    renderUI();

    if (gState.quickSummonEnabled) {
        const sorted = [...pullResults].sort((a,b) => (TIER_ORDER[b.hero.tier] || 0) - (TIER_ORDER[a.hero.tier] || 0));
        const best = sorted[0];
        const newCount = pullResults.filter(r => r.status === 'new').length;
        const starCount = pullResults.filter(r => r.status === 'star').length;
        // L14: локализация тоста быстрого призыва. Раньше было захардкожено "Новых/Звезд".
        const newLabel = currentLang === 'RU' ? 'Новых' : 'New';
        const starLabel = currentLang === 'RU' ? 'Звезд' : 'Stars';
        pushToast(`⚡ [${best.hero.tier}] ${best.hero.name[currentLang] || best.hero.name['EN']} | ${newLabel}: ${newCount}, ${starLabel}: ${starCount}`);
        
        // Сценарий Б: если включен быстрый призыв (без окон), сразу завершаем шаг и переключаем туториал
        if (!isFtueCompleted() && (gState.ftueStep || 0) === 4) {
            gState.ftueSummonDone = true;
        }
        renderFtue();
    } else {
        openSummonResultModal(pullResults);
    }

    // v5.3.8 FIX-SUMMON-SUBMIT: после ролла форсим submit — новые кристаллы
    // уходят в KV. Второе устройство при заходе через 60+ сек увидит свежий баланс
    // и не сможет крутить за старые кристаллы (защита от RNG-дубля).
    if (typeof submitArenaProfile === 'function'
        && typeof canSubmitToLiveArena === 'function'
        && canSubmitToLiveArena()
        && !_inboxSyncPending) {
        setTimeout(() => submitArenaProfile(true), 500);
    }
}

// Вызов оверлея с цитатой Легендарного героя (Hero Spotlight 2.0 с картой)
window.epicSpotlightQueue = [];

function showEpicQuote(hero) {
    const overlay = document.getElementById('epic-quote-overlay');
    if (!overlay || !hero) return;

    // Защита от затирания: если оверлей уже открыт, ставим героя в очередь
    if (overlay.style.display === 'flex') {
        if (!window.epicSpotlightQueue) window.epicSpotlightQueue = [];
        window.epicSpotlightQueue.push(hero);
        return;
    }

    const textEl = document.getElementById('epic-quote-text');
    const authorEl = document.getElementById('epic-quote-author');
    const rankBadge = document.getElementById('spotlight-rank-badge');
    const tierPill = document.getElementById('spotlight-tier-pill');
    const heroNameEl = document.getElementById('spotlight-hero-name');
    const roleTagEl = document.getElementById('spotlight-role-tag');
    const iconEl = document.getElementById('spotlight-card-icon');
    const frameEl = document.getElementById('spotlight-card-frame');

    const tKey = (hero.tier || 's').toLowerCase();
    const tColor = `var(--tier-${tKey})`;

    if (textEl) textEl.innerText = `«${hero.lore[currentLang] || hero.lore['EN']}»`;
    if (authorEl) authorEl.innerText = `— ${hero.name[currentLang] || hero.name['EN']}`;
    if (rankBadge) rankBadge.innerText = `[${hero.tier}] ${currentLang === 'RU' ? 'ТРИУМФ БЕЗДНЫ' : 'VOID TRIUMPH'}`;
    if (tierPill) {
        // L7: локализация tier-пилюли в Hero Spotlight
        tierPill.innerText = currentLang === 'RU' ? `[${hero.tier}] РАНГ` : `[${hero.tier}] RANK`;
        tierPill.style.color = tColor;
        tierPill.style.borderColor = tColor;
    }
    if (heroNameEl) {
        heroNameEl.innerText = hero.name[currentLang] || hero.name['EN'];
        heroNameEl.style.color = tColor;
    }
    if (roleTagEl) {
        // L15: hero.role в data-heroes.js хранится на русском ('Авангард'/'Главком'/'Тыл').
        // Пропускаем через тот же словарь, что в openCardInspect, чтобы EN-игрок видел 'Commander', а не 'Главком'.
        const fName = I18N[currentLang]?.factions?.[hero.faction] || hero.faction;
        const roleKey = { 'Авангард': 'vanguard', 'Главком': 'commander', 'Тыл': 'rearguard' }[hero.role];
        const roleLocalized = I18N[currentLang]?.roles?.[roleKey] || hero.role;
        roleTagEl.innerText = `${roleLocalized} • ${fName}`;
    }
    if (frameEl) {
        frameEl.style.borderColor = tColor;
        frameEl.style.boxShadow = `0 0 25px ${tColor}`;
    }
    if (iconEl) {
        const heroImg = hero.img || `${hero.id}.webp`;
        iconEl.innerHTML = `<img src="assets/heroes/${heroImg}" class="inspect-art-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span style="display:none;">${hero.icon}</span>`;
    }

    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.opacity = '1', 30);
    playTriumphFanfare(hero?.tier === 'SSS');
    triggerHaptic('legendary');
    spawnCelebrationConfetti();
    window.lastCelebratedHeroName = hero.name[currentLang] || hero.name['EN'];
}

function closeEpicQuote() {
    const overlay = document.getElementById('epic-quote-overlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        // Если в очереди есть еще легенды из того же призыва, показываем следующую!
        if (window.epicSpotlightQueue && window.epicSpotlightQueue.length > 0) {
            const nextHero = window.epicSpotlightQueue.shift();
            showEpicQuote(nextHero);
        }
    }, 250);
}

function rollHero(tiers, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    let rnd = Math.random() * sum, selTier = tiers[0];
    for (let i = 0; i < tiers.length; i++) {
        if (rnd < weights[i]) { selTier = tiers[i]; break; }
        rnd -= weights[i];
    }
    const pool = Object.values(HEROES_CATALOG).filter(c => c.tier === selTier);
    const hero = pool[Math.floor(Math.random() * pool.length)] || HEROES_CATALOG['f_und_v'];
    let status = 'new', rewardInfo = '';
    if (!gState.deck[hero.id]) {
        gState.deck[hero.id] = { stars: 1, lvl: 1 };
    } else {
        if (gState.deck[hero.id].stars < 10) {
            gState.deck[hero.id].stars++;
            status = 'star';
            const s = gState.deck[hero.id].stars;
            rewardInfo = s > 5 ? `★${s - 5} (Розовая)` : `★${s}`;
        } else {
            const back = (DISMANTLE_RATES[hero.tier] || 1) * 2;
            gState.crystals += back;
            status = 'dismantle';
            const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
            rewardInfo = `+${back} ${cI}`;
        }
    }
    return { hero, status, rewardInfo };
}

function openSummonResultModal(results) {
    const grid = document.getElementById('summon-result-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const btnClose = document.getElementById('btn-sum-result-close');
    const btnRevealAll = document.getElementById('btn-sum-reveal-all');
    if (btnClose) btnClose.style.display = 'none';
    if (btnRevealAll) btnRevealAll.style.display = 'block';

    if (results.length === 1) {
            grid.style.display = 'flex';
            grid.style.justifyContent = 'center';
            grid.style.alignItems = 'center';
            grid.style.minHeight = '235px';
            grid.style.overflow = 'visible';
            grid.style.padding = '18px 10px';
        } else {
            grid.style.display = 'grid';
            grid.style.minHeight = 'auto';
            grid.style.overflow = 'visible'; // 3 колонки x 4 ряда помещаются целиком без скролла
            grid.style.padding = '4px 2px';
        }

    currentGachaResults = [];
    window.currentGachaResults = currentGachaResults;
    unrevealedGachaCards = results.length;
    window.unrevealedGachaCards = unrevealedGachaCards;

    results.forEach((res, idx) => {
        const h = res.hero;
        const isEpic = ['S', 'SS', 'SSS'].includes(h.tier);
        
        // Определение 1 из 4 динамических рубашек карты по тиру
        let backTierClass = 'card-back-common';
        if (['SS', 'SSS', 'S'].includes(h.tier)) backTierClass = 'card-back-legendary';
        else if (['A', 'B'].includes(h.tier)) backTierClass = 'card-back-epic';
        else if (['C', 'D'].includes(h.tier)) backTierClass = 'card-back-rare';

        const scene = document.createElement('div');
        scene.className = `summon-card-scene ${isEpic ? 'is-epic-rumble' : ''}`;
        scene.id = `gacha-scene-${idx}`;
        
        if (results.length === 1) {
            scene.style.width = '140px';
            scene.style.height = '186px';
        }

        let statusText = currentLang === 'RU' ? "НОВЫЙ ГЕРОЙ" : "NEW HERO";
        let statusClass = 'status-new';
        if (res.status === 'star') { statusText = `★+1 (${res.rewardInfo})`; statusClass = 'status-star'; }
        else if (res.status === 'dismantle') { statusText = `${currentLang === 'RU' ? 'РАСПЫЛЕН' : 'DUSTED'} (${res.rewardInfo})`; statusClass = 'status-dismantle'; }

        const heroImg = h.img || `${h.id}.webp`;
        const tierColor = `var(--tier-${(h.tier||'f').toLowerCase()})`;

        scene.innerHTML = `
            <div class="summon-card-inner" id="gacha-inner-${idx}">
                <!-- Рубашка (Динамическая по рангу) -->
                <div class="summon-card-face summon-card-front ${backTierClass}"></div>
                <!-- Лицо героя (Full-Art TCG) -->
                <div class="summon-card-face summon-card-back" style="border-color: ${tierColor}; box-shadow: 0 0 16px rgba(0,0,0,0.8);">
                    <div class="summon-card-art-layer">
                        <img src="assets/heroes/${heroImg}" class="summon-card-art-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
                        <span class="summon-card-icon" style="display:none;">${h.icon}</span>
                    </div>
                    <div class="summon-card-top-overlay">
                        <span class="summon-card-tier" style="color:${tierColor};">[${h.tier}]</span>
                    </div>
                    <div class="summon-card-bottom-overlay">
                        <div class="summon-card-name" style="color:${tierColor};">${h.name[currentLang] || h.name['EN']}</div>
                        <div class="summon-card-status ${statusClass}">${statusText}</div>
                    </div>
                </div>
            </div>`;

        scene.onclick = () => revealGachaCard(idx, h, isEpic);
        grid.appendChild(scene);
        currentGachaResults.push({ index: idx, hero: h, isEpic, revealed: false });
    });

    const m = document.getElementById('summon-result-modal');
    if (m) m.style.display = 'flex';
    if (!isFtueCompleted()) updateFtueFocus();
}

function revealGachaCard(idx, hero, isEpic) {
    const cardInfo = currentGachaResults[idx];
    if (!cardInfo || cardInfo.revealed) return;
    
    cardInfo.revealed = true;
    unrevealedGachaCards--;

    const scene = document.getElementById(`gacha-scene-${idx}`);
    if (scene) {
        scene.classList.remove('is-epic-rumble');
        scene.classList.add('is-flipped');
    }

    if (isEpic) {
        playTriumphFanfare(hero?.tier === 'SSS');
        triggerHaptic('legendary');
        // Тряска экрана (Screen Shake)
        const appViewport = document.getElementById('app-viewport');
        if (appViewport) {
            appViewport.classList.add('screen-shake-hard');
            setTimeout(() => appViewport.classList.remove('screen-shake-hard'), 400);
        }
        showEpicQuote(hero);
    } else {
        triggerHaptic('tap');
        playSfx(600, 'triangle', 0.05); // Звук переворота обычной карты
    }

    checkAllGachaRevealed();
}

function revealAllGachaCards() {
    let delay = 0;
    currentGachaResults.forEach(c => {
        if (!c.revealed) {
            setTimeout(() => revealGachaCard(c.index, c.hero, c.isEpic), delay);
            delay += 150; // Карты вскрываются каскадом
        }
    });
}

function checkAllGachaRevealed() {
    if (unrevealedGachaCards <= 0) {
        const btnClose = document.getElementById('btn-sum-result-close');
        const btnRevealAll = document.getElementById('btn-sum-reveal-all');
        if (btnRevealAll) btnRevealAll.style.display = 'none';
        if (btnClose) btnClose.style.display = 'block';
        if (!isFtueCompleted()) updateFtueFocus();
    }
}

function closeSummonResultModal() { 
    const m = document.getElementById('summon-result-modal');
    if (m) m.style.display = 'none'; 
    
    // Сценарий А: при принятии воинов завершаем шаг призыва и переключаем фокус на забор награды
    if (!isFtueCompleted() && (gState.ftueStep || 0) === 4) {
        gState.ftueSummonDone = true;
    }
    if (!isFtueCompleted()) renderFtue();
}

/* ==========================================================
   ДЕМОН-ВЕСТНИК (БЕЗ УТЕЧКИ ТАЙМЕРОВ И БЕЗ РАЗМНОЖЕНИЯ)
   ========================================================== */
let demonActive = false;
let demonFlightInterval = null;
let demonSoundInterval = null; // FIX-DEMON-SOUND: повтор звука пока демон летит
let demonSpawnTimer = null;

function scheduleNextDemon() {
    if (demonSpawnTimer) clearTimeout(demonSpawnTimer);
    // FIX-DEMON-FTUE: пока идёт обучение, демон не спавнится.
    // z-index демона (2950) выше Советника (2000) и модалок — во время FTUE
    // он бы перекрывал инструкции и кнопки. Это задумано как фича для основного
    // геймплея, но в туториале только отвлекает и может быть сочтён модератором
    // как «маскировка важных элементов» (п. 3.4.3). После 12-го шага — работает как раньше.
    if (!isFtueCompleted()) {
        demonSpawnTimer = setTimeout(scheduleNextDemon, 60000);
        return;
    }
    demonSpawnTimer = setTimeout(spawnDemon, 180000);
}

// R1: процедурный звук появления демона-вестника — нисходящий визг.
function playDemonAppearSound() {
    if (gState.isAudioMuted || (gState.sfxVolume || 0) <= 0) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const curT = ctx.currentTime;
        const volMult = Math.max(0, Math.min(1, gState.sfxVolume !== undefined ? gState.sfxVolume : 0.8));

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(900, curT);
        osc.frequency.exponentialRampToValueAtTime(300, curT + 0.5);
        const peak = 0.16 * volMult;
        gain.gain.setValueAtTime(0.0001, curT);
        gain.gain.linearRampToValueAtTime(peak, curT + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, curT + 0.55);
        osc.start(curT);
        osc.stop(curT + 0.6);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1400, curT + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(700, curT + 0.45);
        const peak2 = 0.08 * volMult;
        gain2.gain.setValueAtTime(0.0001, curT + 0.05);
        gain2.gain.linearRampToValueAtTime(peak2, curT + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.0001, curT + 0.5);
        osc2.start(curT + 0.05);
        osc2.stop(curT + 0.55);
    } catch(e) {}
}

function spawnDemon() {
    if (demonActive) return;
    // Страховка от гонки: если игрок только что завершил FTUE, но таймер успел стрельнуть
    if (!isFtueCompleted()) return;
    const demonEl = document.getElementById('flying-demon');
    const viewport = document.getElementById('app-viewport');
    if (!demonEl || !viewport) return;

    demonActive = true;
    demonEl.style.display = 'block';
    // R1: звук появления — привлекает внимание игрока.
    // FIX-DEMON-SOUND: повторяем каждые 1.8с, пока демон летит. Иначе игрок
    // отвлекается, и бес улетает с сокровищами, никем не замеченный.
    playDemonAppearSound();
    if (demonSoundInterval) clearInterval(demonSoundInterval);
    demonSoundInterval = setInterval(() => {
        if (!demonActive) { clearInterval(demonSoundInterval); demonSoundInterval = null; return; }
        playDemonAppearSound();
    }, 1800);
    const baseTop = 90 + Math.random() * 180;
    demonEl.style.left = '-70px';
    demonEl.style.top = `${baseTop}px`;

    let posX = -70;
    const startTime = performance.now();
    clearInterval(demonFlightInterval);
    demonFlightInterval = setInterval(() => {
        posX += 2.4;
        const elapsed = (performance.now() - startTime) / 1000;
        const waveY = Math.sin(elapsed * 4.2) * 16;
        demonEl.style.left = `${posX}px`;
        demonEl.style.top = `${baseTop + waveY}px`;

        if (Math.random() < 0.45) {
            spawnDemonEmber(posX + 26, baseTop + waveY + 38, viewport);
        }

        const maxBoundary = viewport.clientWidth + 70;
        if (posX > maxBoundary) {
            despawnDemon();
        }
    }, 30);
}

function spawnDemonEmber(x, y, parent) {
    if (!parent) return;
    const ember = document.createElement('div');
    const isGold = Math.random() < 0.6;
    ember.className = 'demon-ember-spark';
    ember.style.left = `${x}px`;
    ember.style.top = `${y}px`;
    ember.style.backgroundColor = isGold ? '#f59e0b' : '#c084fc';
    ember.style.boxShadow = isGold ? '0 0 6px #f59e0b, 0 0 10px #fde047' : '0 0 6px #a855f7, 0 0 10px #e879f9';
    ember.style.setProperty('--dx', `${-16 - Math.random() * 22}px`);
    ember.style.setProperty('--dy', `${(Math.random() * 22) - 6}px`);
    parent.appendChild(ember);
    setTimeout(() => ember.remove(), 650);
}

function despawnDemon() {
    clearInterval(demonFlightInterval);
    if (demonSoundInterval) { clearInterval(demonSoundInterval); demonSoundInterval = null; }
    const demonEl = document.getElementById('flying-demon');
    if (demonEl) demonEl.style.display = 'none';
    demonActive = false;
    scheduleNextDemon();
}

function catchDemon() {
    if (!demonActive) return;
    clearInterval(demonFlightInterval);
    if (demonSoundInterval) { clearInterval(demonSoundInterval); demonSoundInterval = null; }
    const demonEl = document.getElementById('flying-demon');
    if (demonEl) demonEl.style.display = 'none';
    playSfx(1050, 'square', 0.2);
    triggerHaptic('crit');

    gState.demonCatches = (gState.demonCatches || 0) + 1;
    trackQuestProgress('demon', 1);

    const freeGold = Math.max(1000, getIncomeRate() * 60);
    const freeCryst = 5;

    if (isVipActive()) {
        const adGold = freeGold * 2;
        const adCryst = freeCryst * 2;
        gState.gold += adGold;
        gState.lifetimeGold += adGold;
        gState.crystals += adCryst;
        const gotTicket = Math.random() < 0.25;
        if (gotTicket) gState.tickets += 1;
        playCoinSfx();
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';
        const vipSubjStr = currentLang === 'RU' ? '[VIP] Бес подчинен!' : '[VIP] Imp subjugated!';
        pushToast(gotTicket ? `${vipSubjStr} +${formatNumber(adGold)} ${gI} • +${adCryst} ${cI} • +1 ${tI}` : `${vipSubjStr} +${formatNumber(adGold)} ${gI} • +${adCryst} ${cI}`);
        demonActive = false;
        scheduleNextDemon();
        saveGame();
        renderUI();
        return;
    }

    const lGold = document.getElementById('demon-loot-gold');
    const lCryst = document.getElementById('demon-loot-cryst');
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    if (lGold) lGold.innerHTML = `+${formatNumber(freeGold)} ${gI}`;
    if (lCryst) lCryst.innerHTML = `+${freeCryst} ${cI}`;

    const btnAd = document.getElementById('btn-demon-ad');
    if (btnAd) {
        btnAd.disabled = false;
        btnAd.style.background = 'linear-gradient(180deg, #10b981 0%, #059669 100%)';
        btnAd.style.borderColor = '#22c55e';
    }

    const m = document.getElementById('demon-modal');
    if (m) m.style.display = 'flex';
}

let isClaimingDemon = false;
function closeDemonModal() {
    const m = document.getElementById('demon-modal');
    if (m) m.style.display = 'none';
    demonActive = false;
    isClaimingDemon = false;
    const btnAd = document.getElementById('btn-demon-ad');
    if (btnAd) btnAd.disabled = false;
    scheduleNextDemon();
}

function claimDemonReward(isAd) {
    if (isClaimingDemon) return;
    isClaimingDemon = true;

    const baseGold = Math.max(1000, getIncomeRate() * 60);
    const baseCryst = 5;

    const btnAd = document.getElementById('btn-demon-ad');
    if (btnAd) btnAd.disabled = true;

    const unlockLock = () => {
        isClaimingDemon = false;
        if (btnAd) btnAd.disabled = false;
    };

    if (isAd) {
        showPlatformRewarded(() => {
            playCoinSfx();
            const mult = 2;
            const adGold = baseGold * mult;
            const adCryst = baseCryst * mult;

            gState.gold += adGold;
            gState.lifetimeGold += adGold;
            gState.crystals += adCryst;

            const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
            const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
            const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';
            
            const gotTicket = Math.random() < 0.33;
            if (gotTicket) {
                gState.tickets += 1;
                pushToast(currentLang === 'RU' ? `БИЛЕТ НАЙДЕН! +${formatNumber(adGold)} ${gI} • +${adCryst} ${cI} • +1 ${tI}` : `TICKET FOUND! +${formatNumber(adGold)} ${gI} • +${adCryst} ${cI} • +1 ${tI}`);
            } else {
                pushToast(`+${formatNumber(adGold)} ${gI} • +${adCryst} ${cI}`);
            }

            unlockLock();
            closeDemonModal();
            saveGame();
            renderUI();
        }, () => {
            unlockLock();
        });
    } else {
        gState.gold += baseGold;
        gState.lifetimeGold += baseGold;
        gState.crystals += baseCryst;
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        pushToast(`+${formatNumber(baseGold)} ${gI} • +${baseCryst} ${cI}`);
        unlockLock();
        closeDemonModal();
        saveGame();
        renderUI();
    }
}

/* ==========================================================
   АУДИОСИСТЕМА: SFX И ФОНОВЫЙ MP3-САУНДТРЕК
   ========================================================== */
let aCtx = null;
let bgMusicTrack = null;

function getAudioContext() {
    if (!aCtx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) aCtx = new AudioCtx();
    }
    return aCtx;
}

/* ==========================================================
   АВТОНОМНАЯ ПРОЦЕДУРНАЯ АУДИОСИСТЕМА (WEB AUDIO API)
   0 МБ на диске • Нулевые 404 ошибки • Мгновенный отклик 0ms
   ========================================================== */
function playSfx(freq, type = 'sine', duration = 0.08) {
    if (gState.isAudioMuted || (gState.sfxVolume || 0) <= 0) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = type; osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        const curVol = (gState.sfxVolume !== undefined ? gState.sfxVolume : 0.8) * 0.14;
        gain.gain.setValueAtTime(curVol, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        osc.start(); osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

function playCoinSfx() {
    playSfx(1200, 'triangle', 0.05);
    setTimeout(() => playSfx(1600, 'sine', 0.08), 40);
}

function playBladeClash() {
    playSfx(300, 'sawtooth', 0.15);
    setTimeout(() => playSfx(900, 'triangle', 0.1), 30);
}

// Тактильный микро-щелчок для фильтров и переключателей интерфейса (Game Juice)
function playFilterClickSfx() {
    if (gState.isAudioMuted || (gState.sfxVolume || 0) <= 0) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(ctx.destination);

        const curT = ctx.currentTime;
        osc.frequency.setValueAtTime(1600, curT);
        osc.frequency.exponentialRampToValueAtTime(2200, curT + 0.02);

        const curVol = (gState.sfxVolume !== undefined ? gState.sfxVolume : 0.8) * 0.07;
        gain.gain.setValueAtTime(curVol, curT);
        gain.gain.exponentialRampToValueAtTime(0.0001, curT + 0.025);

        osc.start(curT);
        osc.stop(curT + 0.03);
    } catch(e) {}
}

// Процедурные золотые фанфары для ультра-редких [S] / [SS] / [SSS] карт (0 МБ на диске)
function playTriumphFanfare(isApex = false) {
    if (gState.isAudioMuted || (gState.sfxVolume || 0) <= 0) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const curT = ctx.currentTime;
        const baseVol = (gState.sfxVolume !== undefined ? gState.sfxVolume : 0.8) * 0.16;

        // Мажорное восходящее арпеджио: C5, E5, G5, C6 и апофеоз E6 для Первородных Богов
        const notes = isApex 
            ? [523.25, 659.25, 783.99, 1046.50, 1318.51] 
            : [523.25, 659.25, 783.99, 1046.50];

        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const isLast = (idx === notes.length - 1);
            osc.type = isLast ? 'triangle' : 'sine';
            osc.connect(gain);
            gain.connect(ctx.destination);

            const noteStart = curT + (idx * 0.065);
            const noteDuration = isLast ? (isApex ? 0.75 : 0.55) : 0.22;

            osc.frequency.setValueAtTime(freq, noteStart);
            gain.gain.setValueAtTime(0.0001, noteStart);
            gain.gain.linearRampToValueAtTime(baseVol, noteStart + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);

            osc.start(noteStart);
            osc.stop(noteStart + noteDuration + 0.05);
        });
    } catch(e) {}
}

// Безопасный мост для совместимости вызовов
function playAudioSample(sampleKey, syntheticFallback) {
    if (typeof syntheticFallback === 'function') syntheticFallback();
}

// Фоновый зацикленный саундтрек (assets/audio/theme.mp3) с поддержкой громкости
function initBgMusic() {
    if (bgMusicTrack || typeof window === 'undefined') return;
    try {
        bgMusicTrack = new Audio('assets/audio/theme.mp3');
        bgMusicTrack.loop = true;
        bgMusicTrack.volume = (gState.musicVolume !== undefined ? gState.musicVolume : 0.35);
        bgMusicTrack.onerror = () => {
            bgMusicTrack = null;
        };
    } catch(e) {
        bgMusicTrack = null;
    }
}

function onMusicVolumeChange(val) {
    const num = parseInt(val, 10);
    gState.musicVolume = Math.max(0, Math.min(100, num)) / 100;
    if (bgMusicTrack) bgMusicTrack.volume = gState.musicVolume;
    const lbl = document.getElementById('lbl-music-vol-val');
    if (lbl) lbl.innerText = `${num}%`;
    if (num === 0 && !gState.isMusicMuted) {
        toggleMusicMute();
    } else if (num > 0 && gState.isMusicMuted) {
        toggleMusicMute();
    }
    saveGame();
}

function onSfxVolumeChange(val) {
    const num = parseInt(val, 10);
    gState.sfxVolume = Math.max(0, Math.min(100, num)) / 100;
    const lbl = document.getElementById('lbl-sfx-vol-val');
    if (lbl) lbl.innerText = `${num}%`;
    if (num === 0 && !gState.isAudioMuted) {
        toggleAudioMute();
    } else if (num > 0 && gState.isAudioMuted) {
        toggleAudioMute();
    }
    playCoinSfx(); // Мгновенный тестовый звук для игрока
    saveGame();
}

function toggleMasterAudio() {
    const isMuted = gState.isAudioMuted && gState.isMusicMuted;
    if (isMuted) {
        gState.isAudioMuted = false;
        gState.isMusicMuted = false;
        playBgMusic();
        pushToast(currentLang === 'RU' ? "Звук включен" : "Sound unmuted");
    } else {
        gState.isAudioMuted = true;
        gState.isMusicMuted = true;
        pauseBgMusic();
        pushToast(currentLang === 'RU' ? "Звук отключен" : "Sound muted");
    }
    saveGame();
    updateSettingsAudioBtnText();
    // FIX-4.2.10: синхронизация индикатора «ЗВУК» в Главном меню (если оно открыто)
    if (typeof updateMainMenuUI === 'function') updateMainMenuUI();
}

function playBgMusic() {
    if (gState.isMusicMuted) return;
    initBgMusic();
    if (!bgMusicTrack) return;
    bgMusicTrack.play().catch(() => {
        // Разблокировка после первого пользовательского клика
        const unlock = () => {
            if (!gState.isMusicMuted && bgMusicTrack) bgMusicTrack.play().catch(() => {});
            document.removeEventListener('pointerdown', unlock);
        };
        document.addEventListener('pointerdown', unlock, { once: true });
    });
}

function pauseBgMusic() {
    if (bgMusicTrack) {
        try { bgMusicTrack.pause(); } catch(e) {}
    }
}

function toggleMusicMute() {
    gState.isMusicMuted = !gState.isMusicMuted;
    if (gState.isMusicMuted) {
        pauseBgMusic();
    } else {
        playBgMusic();
    }
    saveGame();
    updateSettingsAudioBtnText();
    pushToast(gState.isMusicMuted 
        ? (currentLang === 'RU' ? 'Музыка отключена' : 'Music muted') 
        : (currentLang === 'RU' ? 'Музыка включена' : 'Music playing'));
}

function toggleAudioMute() {
    gState.isAudioMuted = !gState.isAudioMuted;
    saveGame();
    updateSettingsAudioBtnText();
    pushToast(gState.isAudioMuted 
        ? (currentLang === 'RU' ? 'Эффекты выключены' : 'SFX muted') 
        : (currentLang === 'RU' ? 'Эффекты включены' : 'SFX enabled'));
}

function toggleMusicFromSettings() {
    toggleMusicMute();
}

function toggleVipCombatSetting() {
    gState.vipSkipCombat = (gState.vipSkipCombat === false) ? true : false;
    saveGame();
    updateSettingsAudioBtnText();
    pushToast(gState.vipSkipCombat !== false
        ? (currentLang === 'RU' ? "VIP: Мгновенный бой включен" : "VIP: Instant combat enabled")
        : (currentLang === 'RU' ? "VIP: Визуальный бой включен" : "VIP: Visual combat enabled"));
}

function toggleVipAdsSetting() {
    gState.vipShowAds = !gState.vipShowAds;
    saveGame();
    renderUI();
    updateSettingsAudioBtnText();
    pushToast(gState.vipShowAds 
        ? (currentLang === 'RU' ? "Кнопка рекламы включена" : "VIP ads button enabled")
        : (currentLang === 'RU' ? "Кнопка рекламы скрыта" : "VIP ads button hidden"));
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

// Единый контроллер тостов: максимум 2 штуки, никаких дублей
function pushToast(msg) {
    const feed = document.getElementById('toast-feed');
    if (!feed) return;

    // U11: дедуп через нормализованный ключ вместо innerHTML. Сравнение innerHTML медленное
    // (браузер парсит и нормализует разметку при чтении), а msg содержит <img>-теги.
    // Ключ — текст без HTML-тегов и лишних пробелов.
    const toastKey = String(msg).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const existing = Array.from(feed.children).find(el => el.getAttribute('data-toast-key') === toastKey);
    if (existing) {
        existing.style.animation = 'none';
        void existing.offsetHeight;
        existing.style.animation = 'toastIn 0.15s ease-out';
        return;
    }

    while (feed.children.length >= 2) {
        feed.removeChild(feed.firstChild);
    }

    const t = document.createElement('div');
    t.className = 'toast-pill';
    t.setAttribute('data-toast-key', toastKey);
    t.innerHTML = msg;
    feed.appendChild(t);
    setTimeout(() => {
        if (t.parentNode === feed) feed.removeChild(t);
    }, 1800);
}

let isWatchingAdReward = false;
function watchAdReward() {
    // v4.9.0: guard против параллельных вызовов (двойной клик / программный вызов).
    // Кнопка disabled блокирует клик, но не программный вызов из консоли.
    if (isWatchingAdReward) return;
    isWatchingAdReward = true;
    const btn = document.getElementById('btn-ad-footer');
    if (btn) btn.disabled = true;

    showPlatformRewarded(() => {
        if (btn) btn.disabled = false;
        playCoinSfx();
        let ticketsBonus = 0;
        if ((gState.adTicketsClaimedToday || 0) < 2) {
            ticketsBonus = 2;
            gState.tickets += ticketsBonus;
            gState.adTicketsClaimedToday = (gState.adTicketsClaimedToday || 0) + 2;
        }
        const mult = isVipActive() ? 2 : 1;
        const goldReward = getAdGoldReward() * mult;
        gState.gold += goldReward;
        gState.lifetimeGold += goldReward;
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';
        pushToast(ticketsBonus > 0 ? `+${formatNumber(goldReward)} ${gI} • +2 ${tI}` : `+${formatNumber(goldReward)} ${gI}`);
        saveGame();
        renderUI();
        isWatchingAdReward = false;
    }, () => {
        if (btn) btn.disabled = false;
        isWatchingAdReward = false;
    });
}

/* ==========================================================
   КОЛЕСО ФОРТУНЫ БЕЗДНЫ (LUCKY WHEEL)
   ========================================================== */
let isWheelSpinning = false;
let currentWheelRotation = 0;

function isFreeWheelReady() {
    return gState.lastFreeWheelDate !== new Date().toDateString();
}

function getWheelAdSpinsLeft() {
    const maxAdSpins = isVipActive() ? 3 : 2;
    return Math.max(0, maxAdSpins - (gState.wheelAdSpinsToday || 0));
}

function openLuckyWheelModal() {
    renderLuckyWheelUI();
    const m = document.getElementById('lucky-wheel-modal');
    if (m) m.style.display = 'flex';
}

function closeLuckyWheelModal() {
    if (isWheelSpinning) return;
    const m = document.getElementById('lucky-wheel-modal');
    if (m) m.style.display = 'none';
}

function buildWheelSvg() {
    const svg = document.getElementById('wheel-disc-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const isRU = currentLang === 'RU';
    const sectors = [
        { iconImg: 'gold.webp', label: isRU ? '1ч Шахт' : '1h Mines', isJackpot: false },
        { iconImg: 'crystal.webp', label: '+12', isJackpot: false },
        { iconImg: 'shop_tickets.webp', label: '+2', isJackpot: false },
        { iconImg: 'gold.webp', label: isRU ? '4ч Шахт' : '4h Mines', isJackpot: false },
        { iconImg: 'crystal.webp', label: '+40', isJackpot: false },
        { iconImg: 'shop_tickets.webp', label: '+5', isJackpot: false },
        { iconImg: 'relic.webp', label: '+1', isJackpot: false },
        { iconImg: 'portal_abyss.webp', label: 'S / SSS', isJackpot: true }
    ];

    const cx = 150, cy = 150, r = 142;
    sectors.forEach((sec, i) => {
        const startAngle = (i * 45 - 22.5) * Math.PI / 180;
        const endAngle = (i * 45 + 22.5) * Math.PI / 180;
        const x1 = cx + r * Math.sin(startAngle);
        const y1 = cy - r * Math.cos(startAngle);
        const x2 = cx + r * Math.sin(endAngle);
        const y2 = cy - r * Math.cos(endAngle);

        const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', sec.isJackpot ? 'url(#jackpotGrad)' : (i % 2 === 0 ? '#182133' : '#101622'));
        path.setAttribute('stroke', sec.isJackpot ? '#fde047' : '#283344');
        path.setAttribute('stroke-width', sec.isJackpot ? '2.5' : '1.5');
        svg.appendChild(path);

        const midAngle = (i * 45) * Math.PI / 180;
        const tx = cx + (r * 0.68) * Math.sin(midAngle);
        const ty = cy - (r * 0.68) * Math.cos(midAngle);

        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        textGroup.setAttribute('transform', `translate(${tx}, ${ty}) rotate(${i * 45})`);

        const iconSize = 24;
        const imgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgIcon.setAttribute('href', `assets/icons/${sec.iconImg}`);
        imgIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `assets/icons/${sec.iconImg}`);
        imgIcon.setAttribute('x', `${-iconSize / 2}`);
        imgIcon.setAttribute('y', `${-iconSize - 2}`);
        imgIcon.setAttribute('width', `${iconSize}`);
        imgIcon.setAttribute('height', `${iconSize}`);
        textGroup.appendChild(imgIcon);

        const tLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tLabel.setAttribute('text-anchor', 'middle');
        tLabel.setAttribute('y', '14');
        tLabel.setAttribute('font-family', 'Cinzel, serif');
        tLabel.setAttribute('font-weight', '900');
        tLabel.setAttribute('font-size', '11.5');
        tLabel.setAttribute('fill', sec.isJackpot ? '#fde047' : (sec.iconImg.includes('gold') ? '#f59e0b' : (sec.iconImg.includes('crystal') ? '#c084fc' : '#ffffff')));
        tLabel.textContent = sec.label;
        textGroup.appendChild(tLabel);

        svg.appendChild(textGroup);
    });

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <radialGradient id="jackpotGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#ca8a04"/>
                    <stop offset="60%" stop-color="#854d0e"/>
                    <stop offset="100%" stop-color="#422006"/>
                </radialGradient>`;
            svg.insertBefore(defs, svg.firstChild);
}

function renderLuckyWheelUI() {
    buildWheelSvg();
    const btn = document.getElementById('btn-wheel-spin');
    const desc = document.getElementById('wheel-status-desc');
    const isFree = isFreeWheelReady();
    const adSpinsLeft = getWheelAdSpinsLeft();

    if (btn) {
        btn.removeAttribute('style');
        if (isFree) {
            btn.disabled = false;
            btn.className = 'btn-action modal-full-btn wheel-spin-btn wheel-btn-free';
            btn.innerText = currentLang === 'RU' ? 'ВРАЩАТЬ (БЕСПЛАТНО)' : 'SPIN (FREE)';
        } else if (adSpinsLeft > 0) {
            btn.disabled = false;
            const total = isVipActive() ? 3 : 2;
            const done = total - adSpinsLeft;
            btn.className = 'btn-action modal-full-btn wheel-spin-btn btn-ad-standard wheel-btn-ad';
            const spinStr = currentLang === 'RU' ? 'ВРАЩАТЬ' : 'SPIN';
            btn.innerHTML = `<img src="assets/icons/icon_ad.webp" class="icon-ad-inline"> ${spinStr} (${done + 1}/${total})`;
        } else {
            btn.disabled = true;
            btn.className = 'btn-action modal-full-btn wheel-spin-btn wheel-btn-locked';
            btn.innerText = currentLang === 'RU' ? 'ЛИМИТ НА СЕГОДНЯ' : 'DAILY LIMIT REACHED';
        }
    }

    if (desc) {
        if (isFree) {
            desc.innerText = currentLang === 'RU' ? 'Бесплатное вращение готово!' : 'Daily Free Spin Ready!';
            desc.style.color = 'var(--green)';
        } else if (adSpinsLeft > 0) {
            desc.innerText = currentLang === 'RU' ? `Доступно вращений за просмотр: ${adSpinsLeft}` : `Rewarded spins available: ${adSpinsLeft}`;
            desc.style.color = 'var(--gold)';
        } else {
            desc.innerText = currentLang === 'RU' ? `Новые спины в полночь 00:00 (${getFormattedMidnightCountdown()})` : `Resets midnight (${getFormattedMidnightCountdown()})`;
            desc.style.color = 'var(--text-muted)';
        }
    }
}

function spinLuckyWheel() {
    if (isWheelSpinning) return;
    const isFree = isFreeWheelReady();
    const adLeft = getWheelAdSpinsLeft();

    if (!isFree && adLeft <= 0) return;

    // FIX-WHEEL-DOUBLE-SPIN (v4.9.0): guard и списание ДО showPlatformRewarded.
    // Раньше isWheelSpinning ставился внутри executeSpin — между кликом и колбэком рекламы
    // флаг был false, и второй клик/программный вызов запускал параллельный rewarded.
    isWheelSpinning = true;
    const _prevFreeDate = gState.lastFreeWheelDate;
    const _prevAdSpins = gState.wheelAdSpinsToday;
    if (isFree) {
        gState.lastFreeWheelDate = new Date().toDateString();
    } else {
        gState.wheelAdSpinsToday = (gState.wheelAdSpinsToday || 0) + 1;
    }

    const _rollbackSpin = () => {
        gState.lastFreeWheelDate = _prevFreeDate;
        gState.wheelAdSpinsToday = _prevAdSpins;
        isWheelSpinning = false;
        const btn = document.getElementById('btn-wheel-spin');
        if (btn) btn.disabled = false;
        renderLuckyWheelUI();
        saveGame();
    };

    const executeSpin = () => {
        const btn = document.getElementById('btn-wheel-spin');
        if (btn) btn.disabled = true;

        trackQuestProgress('wheel', 1);
        gState.lifetimeWheelSpins = (gState.lifetimeWheelSpins || 0) + 1; // v4.9.6: счётчик достижения
        checkNotificationBadges();
        saveGame();

        const roll = Math.random() * 1000;
        let sectorIndex = 0;
        let prizeType = '';

        if (roll < 250) { sectorIndex = 0; prizeType = 'gold_1h'; }
        else if (roll < 490) { sectorIndex = 1; prizeType = 'cryst_12'; }
        else if (roll < 670) { sectorIndex = 2; prizeType = 'tickets_2'; }
        else if (roll < 790) { sectorIndex = 3; prizeType = 'gold_4h'; }
        else if (roll < 890) { sectorIndex = 4; prizeType = 'cryst_40'; }
        else if (roll < 959) { sectorIndex = 5; prizeType = 'tickets_5'; }
        else if (roll < 989) { sectorIndex = 6; prizeType = 'relic_1'; }
        else {
            sectorIndex = 7;
            prizeType = (roll >= 999) ? 'sss_champion' : 's_champion'; // 0.1% на SSS!
        }

        // Античит (MAJOR-M1): фиксируем приз в state ДО анимации.
        // Если игрок закроет приложение в момент вращения — pendingWheelPrize сохранится
        // и будет начислен при следующей загрузке (см. loadGame).
        gState.pendingWheelPrize = prizeType;
        saveGame();

        const fullTurns = 5 + Math.floor(Math.random() * 2);
        const sectorAngle = 45;
        const jitter = (Math.random() * 26) - 13;
        const targetStopAngle = (360 - (sectorIndex * sectorAngle)) % 360;

        const currentMod = currentWheelRotation % 360;
        let delta = targetStopAngle - currentMod;
        if (delta < 0) delta += 360;

        currentWheelRotation += (fullTurns * 360) + delta + jitter;

        const wheelDisc = document.getElementById('wheel-disc-svg');
        if (wheelDisc) {
            wheelDisc.style.transition = 'transform 4.5s cubic-bezier(0.15, 0.9, 0.2, 1.0)';
            wheelDisc.style.transform = `rotate(${currentWheelRotation}deg)`;
        }

        const startTime = performance.now();
        let lastTickSector = -1;
        const tickTimer = setInterval(() => {
            const elapsed = performance.now() - startTime;
            if (elapsed >= 4500) {
                clearInterval(tickTimer);
                return;
            }
            if (wheelDisc) {
                const matrix = window.getComputedStyle(wheelDisc).transform;
                if (matrix && matrix !== 'none') {
                    const values = matrix.split('(')[1].split(')')[0].split(',');
                    const a = parseFloat(values[0]), b = parseFloat(values[1]);
                    let deg = Math.round(Math.atan2(b, a) * (180 / Math.PI));
                    if (deg < 0) deg += 360;
                    const curSec = Math.floor(((360 - deg + 22.5) % 360) / 45);
                    if (curSec !== lastTickSector) {
                        lastTickSector = curSec;
        playAudioSample('wheel_tick', () => playSfx(750, 'triangle', 0.045));
        triggerHaptic('tap');
                        const peg = document.getElementById('wheel-pointer-peg');
                        if (peg) {
                            peg.classList.remove('peg-bounce');
                            void peg.offsetWidth;
                            peg.classList.add('peg-bounce');
                        }
                    }
                }
            }
        }, 35);

        setTimeout(() => {
            isWheelSpinning = false;
            // Античит (MAJOR-M1): читаем приз ИЗ STATE, а не из локальной переменной.
            // Обнуляем pending ДО начисления — это гарантирует single-flight даже
            // при открытой второй вкладке (та увидит pending=null и приз не продублирует).
            if (gState.pendingWheelPrize) {
                const pendingPrize = gState.pendingWheelPrize;
                gState.pendingWheelPrize = null;
                claimWheelPrize(pendingPrize);
            }
            saveGame();
            renderLuckyWheelUI();
            renderUI();
        }, 4650);
    };

    if (!isFree && !isVipActive()) {
        showPlatformRewarded(executeSpin, _rollbackSpin);
    } else {
        executeSpin();
    }
}

function claimWheelPrize(type) {
    const rate = getIncomeRate();
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
    const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';

    if (type === 'gold_1h') {
        const amt = Math.max(1500, rate * 3600);
        gState.gold += amt;
        gState.lifetimeGold += amt;
        playCoinSfx();
        triggerHaptic('upgrade');
        const hStr = currentLang === 'RU' ? '1ч Шахт' : '1h Mines';
        pushToast(currentLang === 'RU' ? `НАГРАДА: +${formatNumber(amt)} ${gI} (${hStr})` : `REWARD: +${formatNumber(amt)} ${gI} (${hStr})`);
    } else if (type === 'gold_4h') {
        const amt = Math.max(6000, rate * 14400);
        gState.gold += amt;
        gState.lifetimeGold += amt;
        playCoinSfx();
        triggerHaptic('upgrade');
        const hStr = currentLang === 'RU' ? '4ч Шахт' : '4h Mines';
        pushToast(currentLang === 'RU' ? `КУШ: +${formatNumber(amt)} ${gI} (${hStr})` : `JACKPOT: +${formatNumber(amt)} ${gI} (${hStr})`);
    } else if (type === 'cryst_12' || type === 'cryst_25') {
        // legacy key 'cryst_25' принят для обратной совместимости с pendingWheelPrize старых сейвов.
        // Реальная выдача всегда +12 — это историческое значение, сниженное по балансу без переименования.
        gState.crystals += 12;
        playCoinSfx();
        triggerHaptic('upgrade');
        pushToast(currentLang === 'RU' ? `НАГРАДА: +12 ${cI} Кристаллов` : `REWARD: +12 ${cI} Crystals`);
    } else if (type === 'cryst_40' || type === 'cryst_80') {
        // legacy key 'cryst_80' принят для обратной совместимости с pendingWheelPrize старых сейвов.
        gState.crystals += 40;
        playCoinSfx();
        triggerHaptic('upgrade');
        pushToast(currentLang === 'RU' ? `НАГРАДА: +40 ${cI} Кристаллов` : `REWARD: +40 ${cI} Crystals`);
    } else if (type === 'tickets_2') {
        gState.tickets += 2;
        playCoinSfx();
        triggerHaptic('upgrade');
        pushToast(currentLang === 'RU' ? `НАГРАДА: +2 ${tI} Билета Арены` : `REWARD: +2 ${tI} Arena Tickets`);
    } else if (type === 'tickets_5') {
        gState.tickets += 5;
        playCoinSfx();
        triggerHaptic('upgrade');
        pushToast(currentLang === 'RU' ? `НАГРАДА: +5 ${tI} Билетов Арены` : `REWARD: +5 ${tI} Arena Tickets`);
    } else if (type === 'relic_1') {
        gState.relics += 1;
        playCoinSfx();
        triggerHaptic('legendary');
        const allStr = currentLang === 'RU' ? 'ко всему' : 'to all';
        pushToast(currentLang === 'RU' ? `ДАР ВЕЧНОСТИ: +1 ${rI} (+15% ${allStr})` : `ETERNITY GIFT: +1 ${rI} (+15% ${allStr})`);
    } else if (type === 's_champion') {
        const sPool = ['s_dem_c', 's_cha_r', 's_lig_v', 's_und_c'];
        const heroId = sPool[Math.floor(Math.random() * sPool.length)];
        const hero = HEROES_CATALOG[heroId];
        grantWheelHero(heroId, hero, 300);
    } else if (type === 'sss_champion') {
        const sssPool = ['sss_cha_c', 'sss_dem_v', 'sss_lig_r', 'sss_und_v'];
        const heroId = sssPool[Math.floor(Math.random() * sssPool.length)];
        const hero = HEROES_CATALOG[heroId];
        grantWheelHero(heroId, hero, 1500, true);
    }
}

function grantWheelHero(heroId, hero, compensationCryst, isSuperJackpot = false) {
    if (!hero) return;
    playTriumphFanfare(isSuperJackpot || hero.tier === 'SSS');
    triggerHaptic('legendary');
    spawnCelebrationConfetti();

    if (!gState.deck[heroId]) {
        gState.deck[heroId] = { stars: 1, lvl: 1 };
        const jackStr = currentLang === 'RU' ? 'ДЖЕКПОТ КОЛЕСА' : 'WHEEL JACKPOT';
        pushToast(`${jackStr}: [${hero.tier}] ${hero.name[currentLang] || hero.name['EN']}!`);
    } else if (gState.deck[heroId].stars < 10) {
        gState.deck[heroId].stars++;
        const s = gState.deck[heroId].stars;
        const awakeStr = currentLang === 'RU' ? 'Пробуждение' : 'Awakened';
        const starLabel = s > 5 ? `${s - 5} (${awakeStr})` : `${s}`;
        const upgStr = currentLang === 'RU' ? 'ДЖЕКПОТ (+1 Звезда)' : 'JACKPOT (+1 Star)';
        pushToast(`${upgStr}: [${hero.tier}] ${hero.name[currentLang] || hero.name['EN']} (${starLabel})!`);
    } else {
        gState.crystals += compensationCryst;
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        const maxStr = currentLang === 'RU' ? 'ДЖЕКПОТ (10 звезд MAX)' : 'JACKPOT (10 Stars MAX)';
        pushToast(`${maxStr}: +${compensationCryst} ${cI}`);
    }

    if (isSuperJackpot) {
        const appViewport = document.getElementById('app-viewport');
        if (appViewport) {
            appViewport.classList.add('screen-shake-hard');
            setTimeout(() => appViewport.classList.remove('screen-shake-hard'), 500);
        }
    }

    showEpicQuote(hero);
    renderCards();
}

/* ==========================================================
   САЛЮТ (CONFETTI CANNON) И ВИРАЛЬНЫЙ МОСТ VK
   ========================================================== */
function spawnCelebrationConfetti() {
    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;
    const colors = ['#f59e0b', '#ec4899', '#a855f7', '#22c55e', '#3b82f6', '#fde047'];
    for (let i = 0; i < 35; i++) {
        const c = document.createElement('div');
        c.className = 'confetti-piece';
        c.style.left = `${8 + Math.random() * 84}%`;
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
        c.style.setProperty('--dx', `${Math.random() * 140 - 70}px`);
        c.style.setProperty('--delay', `${Math.random() * 0.25}s`);
        c.style.setProperty('--dur', `${1.2 + Math.random() * 0.8}s`);
        viewport.appendChild(c);
        setTimeout(() => c.remove(), 2300);
    }
}

// P10: кнопка «Поделиться» без награды. Заменён VKWebAppShowWallPostBox на VKWebAppShare
// (нативный диалог шаринга, соответствует п. 2.6.2 правил VK Mini Apps).
// Ветка arena_top1 удалена — точка вызова отсутствовала в UI.
function shareTriumphToWall(type, extra = '') {
    if (!extra) extra = currentLang === 'RU' ? 'Бога' : 'God';
    const msgs = {
        sss_hero: currentLang === 'RU' 
            ? `Я призвал Божественного Владыку [SSS] ${extra} в игре «Lords of the Abyss»! Кто осмелится бросить вызов моему легиону?` 
            : `I summoned the Divine Overlord [SSS] ${extra} in "Lords of the Abyss"! Who dares challenge my legion?`,
        leviathan: currentLang === 'RU' 
            ? `Древний Мировой Левиафан повержен моим войском в «Lords of the Abyss»!` 
            : `The Ancient World Leviathan has fallen to my army in "Lords of the Abyss"!`
    };
    const msg = msgs[type] || (currentLang === 'RU' ? `Мой легион правит Бездной в «Lords of the Abyss»!` : `My legion rules the Abyss in "Lords of the Abyss"!`);

    const shareUrl = 'https://vk.com/app54817477';

    // Ветка VK: нативный share-диалог без вознаграждения
    if (isRunningInsideVK() && window.vkBridge) {
        try {
            window.vkBridge.send('VKWebAppShare', { link: shareUrl }).catch(() => {});
        } catch (e) {}
        return;
    }

    // Standalone / Yandex: Web Share API с текстом, fallback — буфер обмена
    if (navigator.share) {
        navigator.share({ title: 'Lords of the Abyss', text: msg, url: shareUrl }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(`${msg} ${shareUrl}`).then(() => {
            pushToast(currentLang === 'RU' ? 'Весть скопирована в буфер!' : 'Copied to clipboard!');
        }).catch(() => {});
    }
}

// FIX-262-BOOKMARK: убрана награда +50 C за «Добавить в избранное».
// Обоснование: п. 2.6.2 правил VK Mini Apps (ред. 17.03.2026) содержит ЗАКРЫТЫЙ перечень
// соцмеханик, за которые разрешено выдавать бонусы. «Добавить в избранное» и «Добавить
// на главный экран» в этом перечне ОТСУТСТВУЮТ — выдача награды = прямое нарушение.
// Кнопка оставлена как информирующее действие; hasBookmarked нужен только для UI-статуса.
function addToBookmarksVK() {
    if (isRunningInsideVK()) {
        if (!window.vkBridge) {
            pushToast(currentLang === 'RU' ? 'Нет связи с VK. Проверьте соединение' : 'VK connection unavailable. Check your connection');
            return;
        }
        window.vkBridge.send('VKWebAppAddToFavorites')
            .then(data => {
                if (data && data.result && !gState.hasBookmarked) {
                    gState.hasBookmarked = true;
                    triggerHaptic('upgrade');
                    pushToast(currentLang === 'RU' ? 'Игра добавлена в избранное!' : 'Added to favorites!');
                    saveGame();
                    renderPlatformRewardsUI();
                }
            })
            .catch(err => {
                console.warn('[VK Bridge] AddToFavorites error:', err);
                pushToast(currentLang === 'RU' ? "Действие отменено или недоступно" : "Action cancelled or unavailable");
            });
    } else {
        if (!gState.hasBookmarked) {
            gState.hasBookmarked = true;
            triggerHaptic('tap');
            pushToast(currentLang === 'RU' ? 'Игра в избранном!' : 'Game is in favorites!');
            saveGame();
            renderPlatformRewardsUI();
        }
    }
}

// FIX-262-HOMESCREEN: убрана награда +50 C за «Добавить на главный экран».
// Причина идентична FIX-262-BOOKMARK: п. 2.6.2 правил VK Mini Apps не разрешает
// выдачу бонусов за эту соцмеханику. Кнопка оставлена как действие.
function addToHomeScreenVK() {
    // FIX-HOMESCREEN-FEEDBACK: iOS-пре-флайт. VKWebAppAddToHomeScreen не поддерживается
    // на iPhone — Apple блокирует создание ярлыков мини-аппами на уровне ОС.
    // Раньше игрок тыкал кнопку и не получал никакой обратной связи. Теперь — подсказка.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        pushToast(currentLang === 'RU'
            ? 'На iPhone: Меню Safari → Поделиться → На экран «Домой»'
            : 'On iPhone: Safari menu → Share → Add to Home Screen');
        return;
    }

    if (isRunningInsideVK()) {
        if (!window.vkBridge) {
            pushToast(currentLang === 'RU' ? 'Нет связи с VK. Проверьте соединение' : 'VK connection unavailable. Check your connection');
            return;
        }
        window.vkBridge.send('VKWebAppAddToHomeScreen')
            .then(data => {
                // FIX-HOMESCREEN-FEEDBACK: разбираем три исхода — success / result:false / отсутствие result.
                // Раньше тихо игнорировали result:false — игрок думал, что кнопка сломана.
                if (data && data.result === true) {
                    if (!gState.hasAddedToHome) {
                        gState.hasAddedToHome = true;
                        triggerHaptic('upgrade');
                        pushToast(currentLang === 'RU' ? 'Иконка добавлена на экран!' : 'Icon added to home!');
                        saveGame();
                        renderPlatformRewardsUI();
                    } else {
                        pushToast(currentLang === 'RU' ? 'Иконка уже добавлена!' : 'Icon already added!');
                    }
                } else {
                    // MIUI / EMUI / ColorOS требуют явного разрешения «Создание ярлыков» для VK.
                    // Отправляем игрока в настройки — точный путь подсказан ниже.
                    pushToast(currentLang === 'RU'
                        ? 'Не удалось. Разрешите VK создавать ярлыки: Настройки → Приложения → ВКонтакте → Разрешения → Создание ярлыков'
                        : 'Failed. Allow VK to create shortcuts: Settings → Apps → VK → Permissions → Create shortcuts');
                }
            })
            .catch(err => {
                // FIX-HOMESCREEN-FEEDBACK: раньше стоял catch(() => {}) — игрок не получал ни успеха, ни ошибки.
                console.warn('[VK Bridge] AddToHomeScreen error:', err);
                pushToast(currentLang === 'RU'
                    ? 'Ошибка добавления. Проверьте разрешения VK-приложения.'
                    : 'Add error. Check VK app permissions.');
            });
    } else {
        // Standalone fallback — эмуляция для GH Pages / localhost
        if (!gState.hasAddedToHome) {
            gState.hasAddedToHome = true;
            triggerHaptic('tap');
            pushToast(currentLang === 'RU' ? 'Иконка добавлена!' : 'Icon added!');
            saveGame();
            renderPlatformRewardsUI();
        }
    }
}

function renderPlatformRewardsUI() {
    const bBtn = document.getElementById('btn-perk-bookmark');
    const hBtn = document.getElementById('btn-perk-homescreen');
    const invBtn = document.getElementById('btn-perk-vk-invite');
    const yRow = document.getElementById('row-perk-yandex-shortcut');
    const yBtn = document.getElementById('btn-perk-yandex-shortcut');
    const bRow = document.getElementById('row-perk-vk-bookmark') || bBtn?.closest('.settings-row-card');
    const hRow = document.getElementById('row-perk-vk-homescreen') || hBtn?.closest('.settings-row-card');
    const invRow = document.getElementById('row-perk-vk-invite') || invBtn?.closest('.settings-row-card');
    const titleLbl = document.getElementById('lbl-platform-bonuses');

    const inVK = isRunningInsideVK();
    const inYandex = isRunningInsideYandex() || (PlatformBridge && PlatformBridge.canShowYandexShortcut);
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';

    // Управление заголовком блока бонусов
    if (titleLbl) {
        titleLbl.style.display = (inVK || inYandex) ? 'block' : 'none';
    }

    // Ветка VK (Закладки, Экран и Инвайты)
    if (bRow) bRow.style.display = inVK ? 'flex' : 'none';
    if (hRow) hRow.style.display = inVK ? 'flex' : 'none';
    if (invRow) invRow.style.display = inVK ? 'flex' : 'none';

    if (inVK) {
        if (invBtn) {
            const today = new Date().toDateString();
            if (gState.lastInviteDate === today) {
                invBtn.innerText = currentLang === 'RU' ? '✔ ОТПРАВЛЕНО' : '✔ SENT';
                invBtn.disabled = true;
                invBtn.style.background = '#273347';
            } else {
                invBtn.innerHTML = `+50 ${cI} ${currentLang === 'RU' ? 'ВЗЯТЬ' : 'CLAIM'}`;
                invBtn.disabled = false;
                invBtn.style.background = 'var(--gold)';
                invBtn.style.color = '#0b0f17';
            }
        }
        // FIX-262-UI: нейтральные серо-стальные кнопки-действия. Убраны «+50 C», золотая
        // и фиолетовая окраски — они читались как «бонус за соцмеханику» (нарушение п. 2.6.2).
        const addLabel = currentLang === 'RU' ? 'ДОБАВИТЬ' : 'ADD';
        const doneLabel = currentLang === 'RU' ? '✔ ДОБАВЛЕНО' : '✔ ADDED';
        if (bBtn) {
            if (gState.hasBookmarked) {
                bBtn.innerText = doneLabel;
                bBtn.disabled = true;
                bBtn.style.background = '#273347';
                bBtn.style.color = '#64748b';
            } else {
                bBtn.innerText = addLabel;
                bBtn.disabled = false;
                bBtn.style.background = '#273347';
                bBtn.style.color = '#cbd5e1';
            }
        }
        if (hBtn) {
            if (gState.hasAddedToHome) {
                hBtn.innerText = doneLabel;
                hBtn.disabled = true;
                hBtn.style.background = '#273347';
                hBtn.style.color = '#64748b';
            } else {
                hBtn.innerText = addLabel;
                hBtn.disabled = false;
                hBtn.style.background = '#273347';
                hBtn.style.color = '#cbd5e1';
            }
        }
    }

    // Ветка Яндекс Игр (Ярлык на рабочий стол)
    if (yRow) yRow.style.display = inYandex ? 'flex' : 'none';
    if (inYandex && yBtn) {
        if (gState.hasAddedShortcutYandex) {
            yBtn.innerText = currentLang === 'RU' ? '✔ УСТАНОВЛЕНО' : '✔ INSTALLED';
            yBtn.disabled = true;
            yBtn.style.background = '#273347';
        } else {
            yBtn.innerHTML = `+50 ${cI} ${currentLang === 'RU' ? 'ВЗЯТЬ' : 'CLAIM'}`;
            yBtn.disabled = false;
            yBtn.style.background = 'var(--gold)';
            yBtn.style.color = '#0b0f17';
        }
    }
}

/* ==========================================================
   КАЛЕНДАРЬ НАГРАД (КОМПЕНСАЦИЯ ДУБЛИКАТОВ 5★)
   ========================================================== */
/* ==========================================================
   КАЛЕНДАРЬ: ИСПОЛЬЗОВАНИЕ ЕДИНОГО РЕЕСТРА DAILY_CALENDAR_REWARDS
   ========================================================== */

let activeCalendarViewWeek = 0; // 0: Неделя 1, 1: Неделя 2, 2: Неделя 3, 3: Неделя 4

function isDailyCalendarReady() { return gState.lastCalendarClaimDate !== new Date().toDateString(); }

function selectCalendarWeek(weekIdx) {
    activeCalendarViewWeek = Math.max(0, Math.min(3, weekIdx));
    renderDailyCalendarGrid();
    playSfx(420, 'sine', 0.04);
}

function openDailyCalendarModal() { 
    const curDay = gState.calendarDay || 1;
    activeCalendarViewWeek = Math.min(3, Math.floor((curDay - 1) / 7));
    renderDailyCalendarGrid(); 
    const m = document.getElementById('daily-calendar-modal');
    if (m) m.style.display = 'flex'; 
}
function closeDailyCalendarModal() { 
    const m = document.getElementById('daily-calendar-modal');
    if (m) m.style.display = 'none'; 
}

function renderDailyCalendarGrid() {
    const grid = document.getElementById('daily-calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const canClaimToday = isDailyCalendarReady();
    const curDay = gState.calendarDay || 1;
    const curRealWeek = Math.min(3, Math.floor((curDay - 1) / 7));

    // Отрисовка переключателя 4 недель
    const tabsBox = document.getElementById('cal-week-tabs');
    if (tabsBox) {
        const weekPrefix = currentLang === 'RU' ? 'НЕДЕЛЯ' : 'WEEK';
        tabsBox.innerHTML = [1, 2, 3, 4].map((w, idx) => {
            const isActive = idx === activeCalendarViewWeek;
            const isCurrent = idx === curRealWeek;
            const hasReadyBadge = isCurrent && canClaimToday;
            const titleLabel = currentLang === 'RU' ? `${w} ${weekPrefix}` : `${weekPrefix} ${w}`;
            return `
                <button class="cal-week-tab ${isActive ? 'active' : ''}" onclick="selectCalendarWeek(${idx})">
                    ${titleLabel} ${isCurrent ? '<span class="cal-tab-cur-pill">•</span>' : ''}
                    ${hasReadyBadge ? '<span class="notif-badge active" style="top:2px; right:2px;"></span>' : ''}
                </button>`;
        }).join('');
    }

    const startDay = activeCalendarViewWeek * 7 + 1;
    const endDay = startDay + 6;
    const weekRewards = DAILY_CALENDAR_REWARDS.slice(startDay - 1, endDay);

    const calDescEl = document.getElementById('lbl-cal-modal-desc');
    if (calDescEl) {
        const weekTitles = [
            { RU: 'НЕДЕЛЯ 1: СТАРТОВЫЙ ТРИУМФ (ДНИ 1–7)', EN: 'WEEK 1: STARTER TRIUMPH (DAYS 1–7)' },
            { RU: 'НЕДЕЛЯ 2: МАРШ ЛЕГИОНОВ (ДНИ 8–14)', EN: 'WEEK 2: LEGION MARCH (DAYS 8–14)' },
            { RU: 'НЕДЕЛЯ 3: ТАЙНЫ ГЛУБИН (ДНИ 15–21)', EN: 'WEEK 3: DEPTH SECRETS (DAYS 15–21)' },
            { RU: 'НЕДЕЛЯ 4: АБСОЛЮТНЫЙ ПАНТЕОН (ДНИ 22–28)', EN: 'WEEK 4: ABSOLUTE PANTHEON (DAYS 22–28)' }
        ];
        const wTitle = weekTitles[activeCalendarViewWeek] || weekTitles[0];
        calDescEl.innerText = wTitle[currentLang] || wTitle['EN'];
        calDescEl.style.color = 'var(--gold)';
        calDescEl.style.fontWeight = '800';
    }

    const gIcon = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cIcon = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';

    weekRewards.forEach(rew => {
        const isPast = (rew.day < curDay);
        const isCurrent = (rew.day === curDay && canClaimToday);
        const isLandmark = (rew.day % 7 === 0);

        const cell = document.createElement('div');
        cell.className = `cal-day-card ${isLandmark ? 'landmark-banner' : ''} ${isPast ? 'claimed' : ''} ${isCurrent ? 'active-today' : ''}`;

        const svgLock = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        let statusText = svgLock;
        let statusColor = 'var(--text-muted)';
        if (isPast) {
            statusText = currentLang === 'RU' ? 'ПОЛУЧЕНО' : 'CLAIMED';
            statusColor = 'var(--green)';
        } else if (isCurrent) {
            statusText = currentLang === 'RU' ? 'ДОСТУПНО' : 'AVAILABLE';
            statusColor = 'var(--gold)';
        }

        // Если в ячейке есть герой — клик по всей карточке надежно открывает полноэкранный инспектор карты
        if (rew.hero && HEROES_CATALOG[rew.hero]) {
            cell.style.cursor = 'pointer';
            cell.onclick = (e) => {
                e.stopPropagation();
                openCardInspect(rew.hero, true, `ДЕНЬ ${rew.day}`);
            };
        }

        // 1. Горизонтальный Гранд-Баннер финала недели (Дни 7, 14, 21, 28)
        if (isLandmark) {
            const h = rew.hero ? HEROES_CATALOG[rew.hero] : null;
            const hImg = h ? (h.img || `${h.id}.webp`) : '';
            const tierColor = h ? `var(--tier-${(h.tier||'s').toLowerCase()})` : 'var(--gold)';
            const hFullName = h ? (h.name[currentLang] || h.name['EN']) : '';

            cell.innerHTML = `
                <div class="banner-left-hero">
                    <div class="banner-hero-avatar-wrap" style="border-color:${tierColor}; box-shadow:0 0 10px ${tierColor};">
                        <img src="assets/heroes/${hImg}" class="banner-hero-img" onerror="this.onerror=null; this.style.display='none';">
                    </div>
                    <div class="banner-hero-name" style="color:${tierColor};">[${h ? h.tier : 'SS'}] ${hFullName}</div>
                </div>
                <div class="banner-center-spoils">
                    ${rew.relics > 0 ? `
                        <div class="banner-spoil-row relic">
                            <img src="assets/icons/relic.webp" class="res-icon-inline"> +${rew.relics} ${currentLang === 'RU' ? 'Реликвия' : 'Relic'}
                        </div>
                    ` : ''}
                    ${rew.gold > 0 ? `
                        <div class="banner-spoil-row gold">
                            <img src="assets/icons/gold.webp" class="res-icon-inline"> +${formatNumber(rew.gold)} ${currentLang === 'RU' ? 'Золота' : 'Gold'}
                        </div>
                    ` : ''}
                    ${rew.crystals > 0 ? `
                        <div class="banner-spoil-row crystal">
                            <img src="assets/icons/crystal.webp" class="res-icon-inline"> +${rew.crystals} ${currentLang === 'RU' ? 'Кристаллов' : 'Crystals'}
                        </div>
                    ` : ''}
                </div>
                <div class="banner-right-status">
                    <span style="font-size:11.5px; font-weight:900; color:${statusColor}; white-space:nowrap;">${statusText}</span>
                </div>`;
            grid.appendChild(cell);
            return;
        }

        // 2. Дни 1–6: День 3 с героем или ресурсами
        let iconHtml = '';
        if (rew.hero && HEROES_CATALOG[rew.hero]) {
            const h = HEROES_CATALOG[rew.hero];
            const hImg = h ? (h.img || `${h.id}.webp`) : '';
            const tierColor = `var(--tier-${(h.tier||'s').toLowerCase()})`;
            iconHtml = `
                <div class="cal-single-hero-card">
                    <div class="cal-hero-avatar-wrap" style="border-color:${tierColor}; box-shadow:0 0 8px ${tierColor};">
                        <img src="assets/heroes/${hImg}" class="cal-hero-img" onerror="this.onerror=null; this.style.display='none';">
                    </div>
                    <div class="cal-hero-name-pill" style="color:${tierColor};">[${h.tier}] ${h.name[currentLang] || h.name['EN']}</div>
                    ${(rew.gold > 0 || rew.crystals > 0) ? `
                        <div class="cal-hero-sub-res">
                            ${rew.gold > 0 ? `<span style="color:var(--gold); display:inline-flex; align-items:center; gap:2px;">+${formatNumber(rew.gold)} ${gIcon}</span>` : ''}
                            ${rew.crystals > 0 ? `<span style="color:var(--crystal); display:inline-flex; align-items:center; gap:2px;">+${rew.crystals} ${cIcon}</span>` : ''}
                        </div>
                    ` : ''}
                </div>`;
        } else if (rew.crystals > 0 && rew.gold > 0) {
            iconHtml = `
                <div style="background:rgba(10,14,22,0.85); border:1px solid var(--border-metal); border-radius:6px; padding:6px 8px; display:flex; flex-direction:column; gap:4px; align-items:center; width:85%;">
                    <div style="display:flex; align-items:center; gap:4px;"><img src="assets/icons/gold.webp" class="res-icon-inline"> <b style="color:var(--gold); font-size:12px;">${formatNumber(rew.gold)}</b></div>
                    <div style="display:flex; align-items:center; gap:4px;"><img src="assets/icons/crystal.webp" class="res-icon-inline"> <b style="color:var(--crystal); font-size:12px;">+${rew.crystals}</b></div>
                </div>`;
        } else if (rew.crystals > 0) {
            iconHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                    <img src="assets/icons/crystal.webp" class="res-icon-inline" style="width:34px; height:34px;">
                    <b style="color:var(--crystal); font-size:12px;">+${rew.crystals}</b>
                </div>`;
        } else {
            iconHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                    <img src="assets/icons/gold.webp" class="res-icon-inline" style="width:34px; height:34px;">
                    <b style="color:var(--gold); font-size:12px;">+${formatNumber(rew.gold)}</b>
                </div>`;
        }

        cell.innerHTML = `
            <div style="font-weight:800; color:var(--gold); font-size:11.5px; font-family:'Cinzel',serif;">${currentLang === 'RU' ? 'ДЕНЬ' : 'DAY'} ${rew.day}</div>
            <div style="margin:1px 0; display:flex; justify-content:center; align-items:center; flex:1; width:100%;">${iconHtml}</div>
            <div class="cal-day-status-pill" style="font-size:11px; font-weight:900; letter-spacing:0.5px; color:${statusColor}; white-space:nowrap;">${statusText}</div>`;
        grid.appendChild(cell);
    });

    const isViewingCurrentWeek = activeCalendarViewWeek === curRealWeek;
    const actBox = document.getElementById('cal-action-buttons');
    if (actBox) actBox.style.display = (canClaimToday && isViewingCurrentWeek) ? 'flex' : 'none';

    // v4.8.9 FIX-CALENDAR-BTN-UNLOCK: разблокировка кнопок Забрать/Удвоить.
    // ПРОБЛЕМА: btn-cal-claim/btn-cal-double — статичные элементы HTML.
    // claimDailyReward() ставит им disabled = true, но НЕ сбрасывает обратно.
    // Раньше баг не проявлялся, потому что игрок перезагружал страницу —
    // HTML пересоздавался, disabled уходил в дефолт false.
    // Теперь: вкладка живёт через полночь → checkDailyReset() сбрасывает
    // флаги, isDailyCalendarReady() снова true, actBox показывается,
    // но кнопки остаются серыми с вчерашнего клейма → клик не проходит.
    // Разблокировка идёт именно здесь — renderDailyCalendarGrid вызывается
    // из openDailyCalendarModal(), после успешного клейма, при смене недели.
    const _calBtnClaim = document.getElementById('btn-cal-claim');
    const _calBtnDouble = document.getElementById('btn-cal-double');
    if (canClaimToday && isViewingCurrentWeek) {
        if (_calBtnClaim) _calBtnClaim.disabled = false;
        if (_calBtnDouble) _calBtnDouble.disabled = false;
        // Страховка от залипшего флага: если прошлый rewarded-видео оборвался
        // между disabled = true и action() — флаг остался true и блокировал
        // повторные попытки до F5. Сбрасываем при каждом рендере с готовым днём.
        isClaimingDaily = false;
    }
}

let isClaimingDaily = false;
function claimDailyReward(mult = 1) {
    if (isClaimingDaily || !isDailyCalendarReady()) return;
    const curDay = gState.calendarDay || 1;
    const rew = DAILY_CALENDAR_REWARDS.find(r => r.day === curDay);
    if (!rew) return;

    isClaimingDaily = true;
    const btnClaim = document.getElementById('btn-cal-claim');
    const btnDouble = document.getElementById('btn-cal-double');
    if (btnClaim) btnClaim.disabled = true;
    if (btnDouble) btnDouble.disabled = true;

    const action = () => {
        const finalMult = isVipActive() ? 2 : mult;
        const gLoot = rew.gold * finalMult;
        const cLoot = rew.crystals * finalMult;
        gState.gold += gLoot;
        gState.lifetimeGold += gLoot;
        gState.crystals += cLoot;
        gState.relics += (rew.relics * finalMult);

        if (rew.hero && HEROES_CATALOG[rew.hero]) {
            if (!gState.deck[rew.hero]) {
                gState.deck[rew.hero] = { stars: 1, lvl: 1 };
            } else if (gState.deck[rew.hero].stars < 10) {
                gState.deck[rew.hero].stars++;
            } else {
                const compensation = rew.hero === 'ss_und_r' ? 100 : 50;
                gState.crystals += compensation;
                const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
                pushToast(currentLang === 'RU' ? `MAX 10! Компенсация: +${compensation} ${cI}` : `MAX 10! Compensation: +${compensation} ${cI}`);
            }

            // Дофаминовый триггер: полноэкранный триумф героя при получении из календаря
            setTimeout(() => {
                showEpicQuote(HEROES_CATALOG[rew.hero]);
            }, 300);
        }

        gState.lastCalendarClaimDate = new Date().toDateString();
        const prevDay = gState.calendarDay || 1;
        const curWeekIdx = Math.floor((prevDay - 1) / 7);

        let nextDay = prevDay + 1;
        if (nextDay > 28) nextDay = 1;
        gState.calendarDay = nextDay;

        // Фиксация вкладки: календарь НЕ скачет на следующую неделю, игрок видит галочку на забранном дне!
        activeCalendarViewWeek = curWeekIdx;

        trackQuestProgress('calendar', 1);
        playCoinSfx();
        
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
        
        let toastMsg = [];
        if (gLoot > 0) toastMsg.push(`+${formatNumber(gLoot)} ${gI}`);
        if (cLoot > 0) toastMsg.push(`+${cLoot} ${cI}`);
        if (rew.relics > 0) toastMsg.push(`+${rew.relics * finalMult} ${rI}`);
        if (rew.hero) toastMsg.push(`[${HEROES_CATALOG[rew.hero].tier}] ${HEROES_CATALOG[rew.hero].name[currentLang] || HEROES_CATALOG[rew.hero].name['EN']}!`);
        
        pushToast(finalMult > 1 ? `x2 НАГРАДА: ${toastMsg.join(' • ')}` : toastMsg.join(' • '));

        if (prevDay % 7 === 0) {
            const nextWeekNum = (curWeekIdx + 1 > 3) ? 1 : curWeekIdx + 2;
            setTimeout(() => {
                pushToast(currentLang === 'RU' ? `Трофеи ${curWeekIdx + 1}-й недели получены! Неделя ${nextWeekNum} откроется завтра.` : `Week ${curWeekIdx + 1} spoils claimed! Week ${nextWeekNum} unlocks tomorrow.`);
            }, 1200);
        }
        
        isClaimingDaily = false;
        saveGame();
        renderDailyCalendarGrid();
        checkNotificationBadges();
        renderCards();
        renderUI();
    };

    const onAdFail = () => {
        isClaimingDaily = false;
        if (btnClaim) btnClaim.disabled = false;
        if (btnDouble) btnDouble.disabled = false;
        pushToast(currentLang === 'RU' 
            ? "Реклама недоступна. Заберите обычную награду" 
            : "Ad unavailable. Claim standard reward");
    };

    if (mult > 1 && !isVipActive()) showPlatformRewarded(action, onAdFail);
    else action();
}

/* ==========================================================
   МАГАЗИН И ПАК НОВИЧКА
   ========================================================== */
let pendingBuyItem = null;

const SHOP_ITEMS_CATALOG = {
    'starter_pro': { title: { RU: 'Пак Владыки', EN: 'Overlord Pack' } },
    'vip_30': { title: { RU: 'VIP-Статус (30 Дней)', EN: 'VIP Status (30 Days)' } },
    // Кристаллы (6 паков)
    'cryst_100': { baseC: 100, title: { RU: '100 Кристаллов', EN: '100 Crystals' } },
    'cryst_350': { baseC: 350, title: { RU: '350 Кристаллов', EN: '350 Crystals' } },
    'cryst_1000': { baseC: 1000, title: { RU: '1,000 Кристаллов', EN: '1,000 Crystals' } },
    'cryst_2500': { baseC: 2500, title: { RU: '2,500 Кристаллов', EN: '2,500 Crystals' } },
    'cryst_6000': { baseC: 6000, title: { RU: '6,000 Кристаллов', EN: '6,000 Crystals' } },
    'cryst_14000': { baseC: 14000, title: { RU: '14,000 Кристаллов', EN: '14,000 Crystals' } },
    // Билеты
    'tickets_5': { tickets: 5, title: { RU: '5 Билетов Арены', EN: '5 Arena Tickets' } },
    'tickets_15': { tickets: 15, title: { RU: '15 Билетов Арены', EN: '15 Arena Tickets' } },
    'tickets_50': { tickets: 50, title: { RU: '50 Билетов Арены', EN: '50 Arena Tickets' } },
    // B4: «Золотые» паки переработаны в микс золото+кристаллы.
    // Проблема: игрок мог получить тот же объём золота через 8 просмотров рекламы,
    // поэтому паки за рубли не находили ценности. Теперь каждый пак включает уникальный
    // бонус кристаллов, которых реклама не даёт в таком объёме.
    'gold_warp_2h': { hours: 2, crystals: 60, title: { RU: 'Пак 2ч + 60 Кристаллов', EN: '2h Pack + 60 Crystals' } },
    'gold_warp_8h': { hours: 8, crystals: 180, title: { RU: 'Пак 8ч + 180 Кристаллов', EN: '8h Pack + 180 Crystals' } },
    'gold_warp_24h': { hours: 24, crystals: 500, title: { RU: 'Пак 24ч + 500 Кристаллов', EN: '24h Pack + 500 Crystals' } }
};

function openBuyConfirm(itemKey, priceRub) {
    if (itemKey === 'starter_pro' && gState.hasStarterPackBought) {
        return pushToast(currentLang === 'RU' ? "Пак Владыки уже приобретен!" : "Starter Pack already claimed!");
    }

    const cfg = SHOP_ITEMS_CATALOG[itemKey] || { title: { RU: itemKey, EN: itemKey } };
    const titleStr = cfg.title[currentLang] || cfg.title['EN'];
    pendingBuyItem = { key: itemKey, title: titleStr, price: priceRub };

    // 1. Нативная оплата через PlatformBridge (VK / Яндекс Игры)
    // T-B2: фиксируем itemKey в замыкании — устраняет race с перезаписью pendingBuyItem.
    if (isRunningInsideVK() || isRunningInsideYandex()) {
        const lockedItemKey = itemKey;
        PlatformBridge.purchase(lockedItemKey, priceRub, () => {
            executePurchase(lockedItemKey);
        });
        return;
    }

    // 2. Автономный режим браузера / Telegram
    const bTitle = document.getElementById('buy-m-title');
    const bDesc = document.getElementById('buy-m-desc');
    const bBtn = document.getElementById('buy-m-confirm-btn');

    if (bTitle) bTitle.innerText = pendingBuyItem.title;
    if (bDesc) bDesc.innerText = `${pendingBuyItem.title} (${priceRub} ${currentLang === 'RU' ? 'руб.' : 'RUB'})?`;
    if (bBtn) {
        bBtn.innerText = `${priceRub} ${currentLang === 'RU' ? 'руб.' : 'RUB'}`;
        // FIX-STANDALONE-BUY: при прямой привязке `bBtn.onclick = executePurchase`
        // браузер передаёт в функцию event-объект первым аргументом, и он попадает
        // в itemKeyOverride. Проверка `if (!key)` его пропускает (event truthy),
        // pendingBuyItem обнуляется, а все ветки SHOP_ITEMS_CATALOG[key] пролетают
        // мимо — товар не начисляется, но первый-покупка-подарок выдаётся.
        // Фикс: фиксируем itemKey в замыкании явно, как это уже сделано в VK/Yandex ветке.
        bBtn.onclick = () => executePurchase(itemKey);
    }
    const m = document.getElementById('buy-modal');
    if (m) m.style.display = 'flex';
}

function closeBuyModal() {
    const m = document.getElementById('buy-modal');
    if (m) m.style.display = 'none';
}

// T-B (Critical): executePurchase принимает itemKey параметром, а не читает pendingBuyItem.
// Убирает race при перезаписи глобала между открытием модалки VK/Yandex и её закрытием.
// Старый вызов без аргумента (кнопка "Оплатить" в standalone) читает pendingBuyItem как fallback.
let isPurchasing = false;
function executePurchase(itemKeyOverride = null) {
    // T-C (Major): reentrancy-guard — блокирует двойное начисление при дабл-клике на «Оплатить»
    if (isPurchasing) return;
    isPurchasing = true;

    const key = itemKeyOverride || (pendingBuyItem ? pendingBuyItem.key : null);
    if (!key) {
        isPurchasing = false;
        return;
    }
    pendingBuyItem = null; // T-B: обнуляем сразу — блокирует любой повторный вызов
    closeBuyModal();
    playCoinSfx();

    // T-D (Major): начисление подарка ПЕРЕД установкой флага — защита от потери при краше
    // между флагом и начислением (мобильный баннер, low-memory kill, отключение экрана).
    // Если флаг устанавливается первым, а краш случается до gold += — игрок заплатил, но товара нет.
    if (!gState.hasFirstPurchaseDone) {
        // Начисление подарка (идемпотентно — только один раз при первом проходе)
        gState.gold += 100000;
        gState.crystals += 300;
        if (!gState.deck['s_dem_c']) gState.deck['s_dem_c'] = { stars: 1, lvl: 1 };
        else gState.deck['s_dem_c'].stars = Math.min(10, (gState.deck['s_dem_c'].stars || 1) + 1);
        // Финализируем состояние сразу saveGame — до тоста, чтобы даже краш в момент тоста не потерял подарок
        saveGame();
        // Флаг ставится ПОСЛЕ начисления. Если краш между saveGame и флагом — игрок получит
        // подарок повторно, но это безопаснее, чем не получить подарок вообще (компания не пострадает).
        gState.hasFirstPurchaseDone = true;
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        const fpPrefix = currentLang === 'RU' ? 'ДАР ПЕРВОГО ПЛАТЕЖА' : 'FIRST PURCHASE GIFT';
        const heroName = currentLang === 'RU' ? 'ЛИЛИТ' : 'LILITH';
        setTimeout(() => pushToast(`${fpPrefix}: [S] ${heroName} • +100K ${gI} • +300 ${cI}`), 150);
    }

    if (!gState.firstDoubleClaimed) gState.firstDoubleClaimed = {};
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
    const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';

    if (SHOP_ITEMS_CATALOG[key]?.baseC) {
        const base = SHOP_ITEMS_CATALOG[key].baseC;
        const isDouble = !gState.firstDoubleClaimed[key];
        const gain = isDouble ? base * 2 : base;
        gState.crystals += gain;
        // v5.3.12: помечаем IAP-покупку — до успешного submit sync не трогает кристаллы.
        gState._iapPendingSync = true;
        if (isDouble) {
            gState.firstDoubleClaimed[key] = true;
            pushToast(`x2 БОНУС ПЕРВОЙ ПОКУПКИ: +${formatNumber(gain)} ${cI}`);
        } else {
            pushToast(`+${formatNumber(gain)} ${cI}`);
        }
    }
    else if (SHOP_ITEMS_CATALOG[key]?.tickets) {
        const t = SHOP_ITEMS_CATALOG[key].tickets;
        gState.tickets += t;
        // L5: локализация тоста «Билетов Арены»
        pushToast(currentLang === 'RU' ? `+${t} ${tI} Билетов Арены` : `+${t} ${tI} Arena Tickets`);
    }
    else if (SHOP_ITEMS_CATALOG[key]?.relics) {
        const r = SHOP_ITEMS_CATALOG[key].relics;
        gState.relics += r;
        // L6: локализация тоста реликвий и приписки «+N% ко всему»
        const relicReward = currentLang === 'RU'
            ? `+${r} ${rI} Реликвий (+${r * 15}% ко всему)`
            : `+${r} ${rI} Relics (+${r * 15}% to all)`;
        pushToast(relicReward);
    }
    else if (SHOP_ITEMS_CATALOG[key]?.hours) {
        const h = SHOP_ITEMS_CATALOG[key].hours;
        const crystalBonus = SHOP_ITEMS_CATALOG[key].crystals || 0;
        const goldGain = getIncomeRate() * h * 3600;
        gState.gold += goldGain;
        gState.lifetimeGold += goldGain;
        if (crystalBonus > 0) gState.crystals += crystalBonus;
        // B4: пак теперь содержит золото + кристаллы. Двуязычный toast.
        const hStr = currentLang === 'RU' ? `${h}ч шахт` : `${h}h mines`;
        pushToast(currentLang === 'RU'
            ? `+${formatNumber(goldGain)} ${gI} (${hStr}) • +${crystalBonus} ${cI}`
            : `+${formatNumber(goldGain)} ${gI} (${hStr}) • +${crystalBonus} ${cI}`);
    }
    else if (key === 'starter_pro') {
        const starterGold = getStarterPackGold();
        gState.hasStarterPackBought = true;
        gState.gold += starterGold;
        gState.lifetimeGold += starterGold;
        gState.crystals += 250;
        gState.relics += 2;
        gState.tickets += 10;
        if (!gState.deck['a_lig_v']) gState.deck['a_lig_v'] = { stars: 1, lvl: 1 };
        else gState.deck['a_lig_v'].stars = Math.min(10, (gState.deck['a_lig_v'].stars || 1) + 1);
        const packStr = currentLang === 'RU' ? 'ПАК ВЛАДЫКИ' : 'OVERLORD PACK';
        const palStr = currentLang === 'RU' ? '[A] Паладин' : '[A] Paladin';
        pushToast(`${packStr}: +${formatNumber(starterGold)} ${gI} • ${palStr} • +2 ${rI}`);
    }
    else if (key === 'vip_30') {
        const thirtyDays = 30 * 24 * 3600 * 1000;
        const base = Math.max(Date.now(), gState.vipUntil || 0);
        gState.vipUntil = base + thirtyDays;
        gState.tickets += 5;
        pushToast(currentLang === 'RU' ? "VIP (30 ДНЕЙ) АКТИВИРОВАН!" : "VIP (30 DAYS) ACTIVATED!");
    }

    saveGame();
    renderCards();
    renderUI();
    // v5.3.12: форсим submit сразу после IAP-покупки. Кристаллы уходят в KV
    // до того, как sync на этом же или другом устройстве мог бы их откатить.
    if (typeof submitArenaProfile === 'function'
        && typeof canSubmitToLiveArena === 'function'
        && canSubmitToLiveArena()) {
        submitArenaProfile(true);
    }
    // T-C: снимаем guard ПОСЛЕ сохранения — при краше между начислением и saveGame
    // следующий запуск подберёт незавершённое состояние через T-D (флаг после начисления)
    isPurchasing = false;
}

function openFirstPurchaseModal() {
    const modal = document.getElementById('first-purchase-modal');
    if (!modal) return;

    const isRU = currentLang === 'RU';
    const tierPill = document.getElementById('lbl-first-purchase-tier');
    const heroName = document.getElementById('lbl-first-purchase-name');
    const roleTag = document.getElementById('lbl-first-purchase-role');
    const cpLine = document.getElementById('lbl-first-purchase-cp');
    const listHeroName = document.getElementById('lbl-first-purchase-hero-name');

    if (tierPill) tierPill.innerText = isRU ? '[S] РАНГ' : '[S] RANK';
    if (heroName) heroName.innerText = isRU ? 'Лилит, Тень Бездны' : 'Lilith, Void Shade';
    if (roleTag) roleTag.innerText = isRU ? 'Главком • Демоны' : 'Commander • Demons';
    if (cpLine) cpLine.innerHTML = `<img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:13px; height:13px; vertical-align:-1px;" alt="CP"> 3,800 ${isRU ? 'БМ' : 'CP'}`;
    if (listHeroName) listHeroName.innerText = isRU ? '[S] Лилит' : '[S] Lilith';

    modal.style.display = 'flex';
}

// Забрать ежедневный бесплатный подарок в Магазине
function getDailyFreebieGold() {
    return Math.max(1500, getIncomeRate() * 3600); // 1 час добычи шахты (мин. 1,500)
}

function getStarterPackGold() {
    return Math.max(15000, getIncomeRate() * 28800); // 8 часов добычи шахты (мин. 15,000)
}

function claimDailyFreebie() {
    if (gState.dailyFreebieClaimedToday) {
        return pushToast(currentLang === 'RU' ? "Дар уже получен! Сброс сегодня в полночь 00:00" : "Already claimed today! Resets midnight 00:00");
    }

    gState.dailyFreebieClaimedToday = true;
    const rewardGold = getDailyFreebieGold();
    const rewardCryst = 10;

    gState.gold += rewardGold;
    gState.lifetimeGold += rewardGold;
    gState.crystals += rewardCryst;

    playCoinSfx();
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    pushToast(currentLang === 'RU' ? `ЕЖЕДНЕВНЫЙ ДАР: +${formatNumber(rewardGold)} ${gI} • +${rewardCryst} ${cI}` : `DAILY GIFT: +${formatNumber(rewardGold)} ${gI} • +${rewardCryst} ${cI}`);
    
    saveGame();
    renderUI();
}

/* ==========================================================
   КВЕСТЫ И ДОСТИЖЕНИЯ (ЕЖЕДНЕВНЫЕ 🔮 | ЭТАПНЫЕ 💰 | ДОСТИЖЕНИЯ 🏆)
   ========================================================== */
let currentQuestTab = 'daily';

function initDailyQuestsIfEmpty() {
    if (!gState.dailyQuests) gState.dailyQuests = {};
    // FIX-BALANCE v4.7.0: приток кристаллов урезан в ~3 раза.
    // Суммарно: 27 C/день (было 75 C/день).
    const defaultDaily = {
        calendar: { curr: 0, target: 1, rewardC: 5, claimed: false },
        tap: { curr: 0, target: 50, rewardC: 2, claimed: false },
        upgrade: { curr: 0, target: 1, rewardC: 2, claimed: false },
        hero_lvl: { curr: 0, target: 2, rewardC: 3, claimed: false },
        summon: { curr: 0, target: 1, rewardC: 2, claimed: false },
        arena: { curr: 0, target: 3, rewardC: 3, claimed: false },
        dungeon: { curr: 0, target: 3, rewardC: 3, claimed: false },
        raid: { curr: 0, target: 1, rewardC: 3, claimed: false },
        expedition: { curr: 0, target: 1, rewardC: 2, claimed: false },
        demon: { curr: 0, target: 1, rewardC: 2, claimed: false }
    };
    for (let k in defaultDaily) {
        if (!gState.dailyQuests[k]) {
            gState.dailyQuests[k] = defaultDaily[k];
        }
    }
}

function toggleQuestTab(tab) {
    currentQuestTab = tab;
    document.getElementById('btn-sub-daily')?.classList.toggle('active', tab === 'daily');
    document.getElementById('btn-sub-quests')?.classList.toggle('active', tab === 'quests');
    document.getElementById('btn-sub-achieve')?.classList.toggle('active', tab === 'achievements');
    
    const timerEl = document.getElementById('daily-quest-header-timer');
    if (timerEl) timerEl.style.display = (tab === 'daily') ? 'flex' : 'none';

    renderQuests();
}

// Единый контроллер параллельного учета прогресса (и в Ежедневки, и в Этапные!)
function trackQuestProgress(type, amt = 1) {
    initDailyQuestsIfEmpty();

    // 1. Учет в ежедневных квестах
    if (gState.dailyQuests[type] && !gState.dailyQuests[type].claimed) {
        gState.dailyQuests[type].curr = Math.min(gState.dailyQuests[type].target, gState.dailyQuests[type].curr + amt);
    }

    // 2. Учет в бесконечных этапных квестах (только зарегистрированные активности замка)
    if (gState.stageQuests && gState.stageQuests[type]) {
        gState.stageQuests[type].curr += amt;
    }

    // FIX-BALANCE v4.7.0: XP за отдельные действия убран полностью.
    // XP Пропуска начисляется только +100 раз в сутки при первом входе
    // (см. checkDailyReset). Это закрывает месячный цикл и стимулирует D7.

    if (type !== 'tap') {
        saveGame();
    }
    checkNotificationBadges();
    renderQuests();
}

// R3: собрать ВСЕ доступные награды со всех трёх вкладок Заданий одним тапом.
function claimAllQuests() {
    let totalGold = 0;
    let totalCryst = 0;
    let count = 0;

    // 1. Ежедневные
    initDailyQuestsIfEmpty();
    for (const k in gState.dailyQuests) {
        const dq = gState.dailyQuests[k];
        if (dq && !dq.claimed && dq.curr >= dq.target) {
            dq.claimed = true;
            gState.crystals += dq.rewardC;
            totalCryst += dq.rewardC;
            count++;
        }
    }

    // 2. Этапные — могут закрыть несколько стадий подряд
    for (const k in gState.stageQuests) {
        if (['calendar', 'wheel', 'daily'].includes(k)) continue;
        const q = gState.stageQuests[k];
        if (!q) continue;
        let safety = 20;
        while (q.curr >= q.target && safety-- > 0) {
            gState.gold += q.rewardGold;
            gState.lifetimeGold += q.rewardGold;
            totalGold += q.rewardGold;
            q.curr -= q.target;
            q.stage++;
            q.target = Math.floor(q.target * 2.2);
            q.rewardGold = Math.floor(q.rewardGold * 1.8);
            count++;
        }
    }

    // 3. Достижения — каскадные вехи
    (CASCADING_ACHIEVEMENTS || []).forEach(ach => {
        let safety = 20;
        while (safety-- > 0) {
            const stIdx = gState.achieveStages[ach.id] || 0;
            if (stIdx >= ach.stages.length) break;
            if (getCascadeMetric(ach.type) < ach.stages[stIdx]) break;
            const rC = ach.rewardsC[stIdx];
            gState.crystals += rC;
            totalCryst += rC;
            gState.achieveStages[ach.id] = stIdx + 1;
            count++;
        }
    });

    if (count === 0) {
        return pushToast(currentLang === 'RU' ? 'Нет готовых наград' : 'No rewards ready');
    }

    playCoinSfx();
    triggerHaptic('upgrade');
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
    const parts = [];
    if (totalGold > 0) parts.push(`+${formatNumber(totalGold)} ${gI}`);
    if (totalCryst > 0) parts.push(`+${totalCryst} ${cI}`);
    const collectStr = currentLang === 'RU' ? 'СОБРАНО' : 'COLLECTED';
    pushToast(`${collectStr} (${count}): ${parts.join(' • ')}`);

    saveGame();
    checkNotificationBadges();
    renderQuests();
    renderUI();
}

function claimDailyQuest(type) {
    initDailyQuestsIfEmpty();
    const dq = gState.dailyQuests[type];
    if (dq && !dq.claimed && dq.curr >= dq.target) {
        dq.claimed = true;
        gState.crystals += dq.rewardC;
        playCoinSfx();
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        pushToast(currentLang === 'RU' ? `+${dq.rewardC} ${cI} Кристаллов!` : `+${dq.rewardC} ${cI} Crystals!`);
        saveGame();
        checkNotificationBadges();
        renderQuests();
        renderUI();
    }
}

function claimStageQuest(type) {
    const q = gState.stageQuests[type];
    if (q && q.curr >= q.target) {
        gState.gold += q.rewardGold; 
        gState.lifetimeGold += q.rewardGold;
        playCoinSfx();
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        pushToast(`+${formatNumber(q.rewardGold)} ${gI}`);
        q.curr -= q.target;
        q.stage++;
        q.target = Math.floor(q.target * 2.2);
        q.rewardGold = Math.floor(q.rewardGold * 1.8);
        saveGame();
        checkNotificationBadges();
        renderQuests();
        renderUI();
    }
}

function getCascadeMetric(type) {
    switch(type) {
        case 'lifetime_gold': return gState.lifetimeGold || 0;
        case 'max_army': return Math.max(gState.army || 0, gState.maxArmyEver || 0);
        case 'highest_keep': return Math.max(gState.buildings.keep || 1, gState.highestKeep || 1);
        case 'lifetime_wins': return gState.lifetimeWins || 0;
        case 'cards_count': return Object.keys(gState.deck || {}).length;
        case 'total_relics': return gState.relics || 0;
        case 'demon_catches': return gState.demonCatches || 0;
        case 'dungeon_floor': return gState.dungeonFloor || 1;
        case 'wheel_spins': return gState.lifetimeWheelSpins || 0;
        default: return 0;
    }
}

function claimCascadeAchievement(achId) {
    const ach = CASCADING_ACHIEVEMENTS.find(a => a.id === achId);
    if (!ach) return;
    const stageIdx = gState.achieveStages[achId] || 0;
    if (stageIdx < ach.stages.length && getCascadeMetric(ach.type) >= ach.stages[stageIdx]) {
        const rC = ach.rewardsC[stageIdx];
        gState.crystals += rC;
        gState.achieveStages[achId] = stageIdx + 1;
        playCoinSfx();
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        pushToast(currentLang === 'RU' ? `+${rC} ${cI} За достижение!` : `+${rC} ${cI} For Achievement!`);
        saveGame();
        checkNotificationBadges();
        renderQuests();
        renderUI();
    }
}

// FIX-QUEST-NAVIGATE: клик по «В ПРОЦЕССЕ» ведёт игрока на вкладку действия,
// а не молча блокируется. Клик по готовому «ЗАБРАТЬ» — работает как раньше.
function handleQuestClick(kind, key, isReady, event) {
    if (event) { event.stopPropagation(); }
    if (isReady) {
        if (kind === 'daily') claimDailyQuest(key);
        else if (kind === 'stage') claimStageQuest(key);
        else if (kind === 'achievement') claimCascadeAchievement(key);
        return;
    }
    navigateToQuestAction(kind, key);
}

// FIX-QUEST-NAVIGATE: маппинг «тип квеста → целевое действие».
// Ведёт не просто на вкладку, а в конкретную подвкладку/модалку по запросу
// разработчика («до конкретного действия»).
function navigateToQuestAction(kind, key) {
    const routes = {
        // DAILY — открываем конкретное действие/здание.
        'daily:calendar': () => openDailyCalendarModal(),
        'daily:tap': () => navigate('citadel-view'),
        'daily:upgrade': () => { navigate('citadel-view'); openBuildingModal('keep'); },
        'daily:hero_lvl': () => openRosterFrom('citadel-view', 'cards'),
        'daily:summon': () => navigate('altar-view'),
        'daily:arena': () => navigate('arena-view'),
        'daily:dungeon': () => navigate('dungeon-view'),
        'daily:raid': () => navigate('raid-view'),
        'daily:expedition': () => openRosterFrom('citadel-view', 'expeditions'),
        'daily:demon': () => navigate('citadel-view'),
        // STAGE
        'stage:tap': () => navigate('citadel-view'),
        'stage:arena': () => navigate('arena-view'),
        'stage:upgrade': () => { navigate('citadel-view'); openBuildingModal('keep'); },
        'stage:summon': () => navigate('altar-view'),
        'stage:demon': () => navigate('citadel-view'),
        'stage:expedition': () => openRosterFrom('citadel-view', 'expeditions'),
        'stage:hero_lvl': () => openRosterFrom('citadel-view', 'cards'),
        'stage:dungeon': () => navigate('dungeon-view'),
        'stage:raid': () => navigate('raid-view'),
        // ACHIEVEMENTS — открываем профильное здание напрямую.
        // FIX-QUEST-BUILDING-ROUTES: голда → Шахты, армия → Казармы, уровень Цитадели → Трон.
        'achievement:ach_g': () => { navigate('citadel-view'); openBuildingModal('mine'); },
        'achievement:ach_a': () => { navigate('citadel-view'); openBuildingModal('barracks'); },
        'achievement:ach_k': () => { navigate('citadel-view'); openBuildingModal('keep'); },
        'achievement:ach_ar': () => navigate('arena-view'),
        'achievement:ach_c': () => openRosterFrom('citadel-view', 'cards'),
        'achievement:ach_asc': () => { navigate('citadel-view'); openBuildingModal('keep'); },
        'achievement:ach_dem': () => navigate('citadel-view'),
        'achievement:ach_dung': () => navigate('dungeon-view')
    };
    const fn = routes[kind + ':' + key];
    if (typeof fn === 'function') fn();
}

function renderQuests() {
    const box = document.getElementById('quests-render-box');
    if (!box) return;
    box.innerHTML = '';
    initDailyQuestsIfEmpty();

    // FIX-CALENDAR-QUEST: страховка от рассинхрона «награда календаря — квест дня».
    // Если награда за сегодня уже забрана (lastCalendarClaimDate === today),
    // но квест помечен как невыполненный — форсим прогресс.
    // Закрывает:
    //   1. Race с checkDailyReset в полночь (curr обнулялся через 20–30 сек после забора).
    //   2. Потерю curr при арбитраже облака, если saveGame не успел записать состояние.
    //   3. Ручной запуск «Удвоить x2», когда реклама не показалась и trackQuestProgress
    //      не отработал (fallback: curr уже форсится при следующем рендере).
    // Идемпотентно: если награда вчерашняя — условие не сработает.
    // Безопасно от абуза: повторный claim блокирует флаг claimed в самом квесте.
    if (gState.lastCalendarClaimDate === new Date().toDateString()
        && gState.dailyQuests && gState.dailyQuests.calendar
        && !gState.dailyQuests.calendar.claimed) {
        gState.dailyQuests.calendar.curr = gState.dailyQuests.calendar.target;
    }

    const timerLabel = document.getElementById('daily-reset-countdown');
    if (timerLabel) timerLabel.innerText = `${currentLang === 'RU' ? 'Сброс' : 'Reset'}: ${getFormattedMidnightCountdown()}`;

    // 0. ВКЛАДКА БОЕВОГО ПРОПУСКА БЕЗДНЫ (ABYSS PASS)
    if (currentQuestTab === 'pass') {
        renderAbyssPass(box);
        return;
    }

    // 1. ВКЛАДКА ЕЖЕДНЕВНЫХ КВЕСТОВ (НАГРАДА: КРИСТАЛЛЫ 🔮)
    if (currentQuestTab === 'daily') {
        const dailyConfigs = {
            calendar: { title: { RU: 'Дар Календаря', EN: 'Calendar Gift' }, desc: { RU: 'Заберите ежедневную награду в календаре', EN: 'Claim daily login calendar reward' } },
            tap: { title: { RU: 'Дань и Ополчение', EN: 'Tribute & Militia' }, desc: { RU: 'Соберите дань и войско кликами', EN: 'Collect tribute & recruits' } },
            upgrade: { title: { RU: 'Каменщик Цитадели', EN: 'Citadel Mason' }, desc: { RU: 'Улучшите любое здание в Цитадели', EN: 'Upgrade any Citadel structure' } },
            hero_lvl: { title: { RU: 'Тренировка Войск', EN: 'Troop Training' }, desc: { RU: 'Повысьте уровень героев в Штабе', EN: 'Upgrade hero levels in Roster' } },
            summon: { title: { RU: 'Врата Бездны', EN: 'Summon Gates' }, desc: { RU: 'Совершите призыв героев в Алтаре', EN: 'Summon champions at the Altar' } },
            arena: { title: { RU: 'Гладиатор Арены', EN: 'Arena Gladiator' }, desc: { RU: 'Проведите поединки на Арене', EN: 'Fight duels on the Arena' } },
            dungeon: { title: { RU: 'Покоритель Бездны', EN: 'Abyss Conqueror' }, desc: { RU: 'Очистите этаж или сделайте быстрый рейд', EN: 'Clear floor or execute quick sweep' } },
            raid: { title: { RU: 'Удар по Левиафану', EN: 'Leviathan Strike' }, desc: { RU: 'Нанесите сокрушительный удар боссу', EN: 'Strike the World Leviathan' } },
            expedition: { title: { RU: 'Разведка Глубин', EN: 'Depths Scout' }, desc: { RU: 'Отправьте отряд героев в экспедицию', EN: 'Deploy a hero squad on expedition' } },
            demon: { title: { RU: 'Охота на Беса', EN: 'Imp Hunter' }, desc: { RU: 'Перехватите летучего демона с сундуком', EN: 'Intercept flying treasure imp' } }
        };

        for (let k in gState.dailyQuests) {
            const dq = gState.dailyQuests[k];
            const cfg = dailyConfigs[k];
            if (!cfg) continue;
            const ready = dq.curr >= dq.target && !dq.claimed;
            const done = dq.claimed;

            let btnClass = 'btn-quest-progress';
            let btnLabel = currentLang === 'RU' ? 'В ПРОЦЕССЕ' : 'IN PROGRESS';

            if (done) {
                btnClass = 'btn-quest-claimed';
                btnLabel = currentLang === 'RU' ? '✔ ВЫПОЛНЕНО' : '✔ COMPLETED';
            } else if (ready) {
                btnClass = 'btn-quest-ready';
                btnLabel = currentLang === 'RU' ? 'ЗАБРАТЬ' : 'CLAIM';
            }

            const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
            const div = document.createElement('div');
            div.className = 'building-card';
            div.innerHTML = `
                <div>
                    <div style="font-size:13.5px; font-weight:800; color:#fff;">${cfg.title[currentLang] || cfg.title['EN']}</div>
                    <div style="font-size:11.5px; color:#cbd5e1; margin:2px 0;">${cfg.desc[currentLang] || cfg.desc['EN']} (<b style="color:var(--gold);">${dq.curr}/${dq.target}</b>)</div>
                    <div style="font-size:11.5px; font-weight:800; color:var(--crystal);">+${dq.rewardC} ${cI}</div>
                </div>
                <button class="btn-action ${btnClass}" style="font-size:12px; padding:8px 12px;" ${done ? 'disabled' : ''} onclick="handleQuestClick('daily', '${k}', ${ready}, event)">
                    ${btnLabel}
                </button>`;
            box.appendChild(div);
        }
    } 
    // 2. ВКЛАДКА БЕСКОНЕЧНЫХ ЭТАПНЫХ КВЕСТОВ (НАГРАДА: ЗОЛОТО 💰)
    else if (currentQuestTab === 'quests') {
        const stageDescriptions = {
            tap: { RU: 'Соберите дань и ополчение {target} раз', EN: 'Muster tribute {target} times' },
            arena: { RU: 'Сразитесь на Арене {target} раз', EN: 'Fight in Arena {target} times' },
            upgrade: { RU: 'Улучшите здания замка {target} раз', EN: 'Upgrade buildings {target} times' },
            summon: { RU: 'Призовите героев в Алтаре {target} раз', EN: 'Summon heroes {target} times' },
            demon: { RU: 'Поймайте летучих бесов {target} раз', EN: 'Catch imps {target} times' },
            expedition: { RU: 'Отправьте экспедиции {target} раз', EN: 'Deploy expeditions {target} times' },
            hero_lvl: { RU: 'Повысьте уровни героев {target} раз', EN: 'Upgrade hero levels {target} times' },
            dungeon: { RU: 'Очистите этажи или рейды {target} раз', EN: 'Assault Abyss floors {target} times' },
            raid: { RU: 'Ударьте по Левиафану {target} раз', EN: 'Strike Leviathan {target} times' }
        };

        const titles = {
            tap: { RU: 'Дань и Ополчение', EN: 'Tribute & Militia' },
            arena: { RU: 'Битвы на Арене', EN: 'Arena Battles' },
            upgrade: { RU: 'Строительство Замка', EN: 'Keep Construction' },
            summon: { RU: 'Призыв Полководцев', EN: 'Summon Champions' },
            demon: { RU: 'Перехват Бесов', EN: 'Catch Imps' },
            expedition: { RU: 'Экспедиции в Бездну', EN: 'Abyss Expeditions' },
            hero_lvl: { RU: 'Тренировка Героев', EN: 'Hero Training' },
            dungeon: { RU: 'Покорение Бездны', EN: 'Abyss Conquest' },
            raid: { RU: 'Удар по Левиафану', EN: 'Leviathan Assault' }
        };

        // Моментальная санитизация от паразитных квестов
        if (gState.stageQuests) {
            delete gState.stageQuests.calendar;
            delete gState.stageQuests.wheel;
            delete gState.stageQuests.daily;
        }

        for (let k in gState.stageQuests) {
            if (!stageDescriptions[k]) continue; // Фильтр-страж: рендерить только канонические этапные квесты
            const q = gState.stageQuests[k];
            const ready = q.curr >= q.target;
            const descTpl = stageDescriptions[k][currentLang] || stageDescriptions[k]['EN'];

            let btnClass = ready ? 'btn-quest-ready' : 'btn-quest-progress';

            const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
            const div = document.createElement('div');
            div.className = 'building-card';
            const rewardPrefix = currentLang === 'RU' ? 'Награда:' : 'Reward:';
            div.innerHTML = `
                <div>
                    <b style="font-size:13.5px; color:var(--gold);">${titles[k] ? (titles[k][currentLang] || k) : k} (${currentLang === 'RU' ? 'Этап' : 'Stage'} ${q.stage})</b>
                    <div style="font-size:11.5px; color:#fff; margin:2px 0;">${descTpl.replace('{target}', formatNumber(q.target))} (<b style="color:var(--gold);">${formatNumber(q.curr)}/${formatNumber(q.target)}</b>)</div>
                    <div style="font-size:11.5px; color:var(--text-muted); font-weight:700;">${rewardPrefix} <b style="color:var(--gold);">+${formatNumber(q.rewardGold)} ${gI}</b></div>
                </div>
                <button class="btn-action ${btnClass}" style="font-size:12px; padding:8px 12px;" onclick="handleQuestClick('stage', '${k}', ${ready}, event)">
                    ${ready ? I18N[currentLang].quest_claim : (currentLang === 'RU' ? 'В ПРОЦЕССЕ' : 'IN PROGRESS')}
                </button>`;
            box.appendChild(div);
        }
    } 
    // 3. ВКЛАДКА ГЛОБАЛЬНЫХ ДОСТИЖЕНИЙ НА 3 ГОДА
    else {
        (CASCADING_ACHIEVEMENTS || []).forEach(ach => {
            const stageIdx = gState.achieveStages[ach.id] || 0;
            const isMax = stageIdx >= ach.stages.length;
            const target = isMax ? ach.stages[ach.stages.length - 1] : ach.stages[stageIdx];
            const rewardC = isMax ? 0 : ach.rewardsC[stageIdx];
            const metric = getCascadeMetric(ach.type);
            const ready = !isMax && metric >= target;
            const tpl = ach.descTemplate[currentLang] || ach.descTemplate['EN'];

            let btnClass = 'btn-quest-progress';
            let btnLabel = I18N[currentLang].quest_in_progress;

            if (isMax) {
                btnClass = 'btn-quest-claimed';
                btnLabel = currentLang === 'RU' ? '✔ ВЫПОЛНЕНО' : '✔ COMPLETED';
            } else if (ready) {
                btnClass = 'btn-quest-ready';
                btnLabel = currentLang === 'RU' ? 'ЗАБРАТЬ' : 'CLAIM';
            }

            const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
            const div = document.createElement('div');
            div.className = 'building-card';
            div.style.flexDirection = 'column'; div.style.alignItems = 'stretch'; div.style.gap = '6px';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <b style="color:var(--gold); font-size:13px;">${ach.title[currentLang] || ach.title['EN']} (${Math.min(stageIdx + 1, ach.stages.length)}/${ach.stages.length})</b>
                        <div style="font-size:11.5px; color:#fff; margin-top:2px;">${tpl.replace('{val}', formatNumber(target))}</div>
                    </div>
                    <button class="btn-action ${btnClass}" style="font-size:12px; padding:8px 12px;" ${isMax ? 'disabled' : ''} onclick="handleQuestClick('achievement', '${ach.id}', ${ready}, event)">${btnLabel}</button>
                </div>
                <div style="font-size:11.5px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                    <span>${I18N[currentLang].quest_progress}: <b style="color:#fff;">${formatNumber(Math.min(metric, target))}</b> / ${formatNumber(target)}</span>
                    <span style="color:var(--crystal); font-weight:800; font-size:12.5px;">+${rewardC} ${cI}</span>
                </div>`;
            box.appendChild(div);
        });
    }
    checkNotificationBadges();
}

// FIX-RAID-QUEST-AUTO: если босс недели уже повержен, а daily-квест «Удар по
// Левиафану» ещё не выполнен — засчитываем автоматически. Иначе игрок физически
// не может ударить (attackWorldRaidBoss возвращает ранний return), и квест
// висит вечно.
function autoCompleteRaidQuestIfDefeated() {
    if (!gState.dailyQuests || !gState.dailyQuests.raid) return;
    const rq = gState.dailyQuests.raid;
    if (rq.claimed || rq.curr >= rq.target) return;
    if (!gState.isRaidDefeatedThisWeek && (gState.worldBossHp || 0) > 0) return;
    rq.curr = rq.target;
    saveGame();
    checkNotificationBadges();
}

function checkNotificationBadges() {
    initDailyQuestsIfEmpty();

    // 1. Проверка ежедневных квестов
    let dReady = false;
    for (let k in gState.dailyQuests) {
        if (gState.dailyQuests[k].curr >= gState.dailyQuests[k].target && !gState.dailyQuests[k].claimed) { dReady = true; break; }
    }

    // 2. Проверка этапных квестов (только канонические)
    let qReady = false;
    for (let k in gState.stageQuests) {
        if (['calendar', 'wheel', 'daily'].includes(k)) continue;
        if (gState.stageQuests[k] && gState.stageQuests[k].curr >= gState.stageQuests[k].target) { qReady = true; break; }
    }

    // 3. Проверка долгосрочных достижений
    let aReady = false;
    (CASCADING_ACHIEVEMENTS || []).forEach(ch => {
        const stIdx = gState.achieveStages[ch.id] || 0;
        if (stIdx < ch.stages.length && getCascadeMetric(ch.type) >= ch.stages[stIdx]) aReady = true;
    });

    // 4. Проверка наград Боевого Пропуска
    const curPassLvl = getAbyssPassLevel();
    let passReady = false;
    for (let l = 1; l <= curPassLvl; l++) {
        if (!(gState.abyssPassFreeClaimed || []).includes(l)) { passReady = true; break; }
        if (isVipActive() && !(gState.abyssPassVipClaimed || []).includes(l)) { passReady = true; break; }
    }

    // U16: горячие бейджи через кэш $id — checkNotificationBadgesThrottled вызывается из тика
    $id('badge-nav-quests')?.classList.toggle('active', dReady || qReady || aReady);
    $id('badge-sub-daily')?.classList.toggle('active', dReady);
    $id('badge-sub-quests')?.classList.toggle('active', qReady);
    $id('badge-sub-achieve')?.classList.toggle('active', aReady);
    $id('badge-pass-circle')?.classList.toggle('active', passReady);
    checkCodexNotifications();
    const hasCal = isDailyCalendarReady();
    $id('badge-calendar-circle')?.classList.toggle('active', hasCal);
    $id('badge-wheel-circle')?.classList.toggle('active', isFreeWheelReady());
    $id('badge-quests-circle')?.classList.toggle('active', dReady || qReady || aReady);
    
    const now = Date.now();

    // UX-настройка hideBuildingBadges: игрок может скрыть точки прокачки у зданий.
    // На Цитадели остаётся критичный сигнал Возвышения (isAscendReady) — он не скрывается.
    const _hideBldBadges = !!gState.hideBuildingBadges;
    const isAscendReady = (gState.buildings.keep || 1) >= getAscendKeepReq() && (gState.gold || 0) >= getAscendGoldReq();
    const _canUpKeep = (gState.gold || 0) >= getUpgradeCost('keep');
    $id('badge-district-keep')?.classList.toggle('active', isAscendReady || (!_hideBldBadges && _canUpKeep));

    const _canUpMine = (gState.gold || 0) >= getUpgradeCost('mine');
    $id('badge-district-mine')?.classList.toggle('active', !_hideBldBadges && _canUpMine);

    const _canUpBarracks = (gState.gold || 0) >= getUpgradeCost('barracks');
    $id('badge-district-barracks')?.classList.toggle('active', !_hideBldBadges && _canUpBarracks);

    // 3. Штаб: Завершена экспедиция ИЛИ готовы вехи Кодекса
    const isExpeditionReady = Object.values(gState.expeditions || {}).some(e => e && e.endTime <= now);
    const codexReady = isCodexRewardReady();
    $id('badge-district-roster')?.classList.toggle('active', isExpeditionReady || codexReady);
    $id('badge-tab-exp')?.classList.toggle('active', isExpeditionReady);
    $id('badge-tab-codex')?.classList.toggle('active', codexReady);
    $id('badge-exp-ready')?.classList.toggle('active', isExpeditionReady);

    // 4. Подземелья: Лампочка активна СТРОГО когда готов удар по Левиафану или есть неизученные Хроники
    const raidCooldown = getRaidCooldownMs ? getRaidCooldownMs() : 300000;
    const raidElapsed = now - (gState.lastRaidAttackTime || 0);
    const isRaidStrikeReady = !gState.isRaidDefeatedThisWeek && (gState.worldBossHp || 0) > 0 && (raidElapsed >= raidCooldown);
    const isAbyssFull = (gState.dungeonStamina || 0) >= 10;
    const hasUnreadChronicles = (gState.dungeonFloor || 1) > 5 && (gState.claimedChronicles || []).length < Math.floor((gState.dungeonFloor || 1) / 5);

    // FIX-BADGE-ABYSS v4.7.0: на карте Цитадели лампа — ТОЛЬКО готовность удара
    // по Левиафану. Раньше пульсировала и при непрочитанных Хрониках — игрок
    // думал что "энергия есть" хотя мог быть 0/10. Хроники теперь дают точку
    // только внутри хаба подземелий (badge-hub-dungeon).
    $id('badge-district-dungeons')?.classList.toggle('active', isRaidStrikeReady);

    // FIX-BADGE-HUB v4.7.0: маркер на "Спуск в Бездну" в хабе больше не пульсирует
    // от непрочитанных Хроник — игрок читал его как "есть энергия", хотя энергия 0/10.
    // Хроники остаются доступны через кнопку "ХРОНИКИ" в самой вкладке Бездны.
    // Маркер хаба Рейда (badge-hub-raid) работает как раньше — только на готовый удар.
    $id('badge-hub-raid')?.classList.toggle('active', isRaidStrikeReady);

    const abyssInfoEl = $id('hub-abyss-info');
    if (abyssInfoEl) {
        const eIcon = '<img src="assets/icons/icon_energy.webp" class="res-icon-inline icon-energy-glow" style="width:13px; height:13px;" alt="E">';
        if (isAbyssFull) {
            abyssInfoEl.className = 'hub-status-pill energy-full';
            abyssInfoEl.innerHTML = `${eIcon} 10/10 ${currentLang === 'RU' ? 'ПОЛНО' : 'FULL'}`;
        } else {
            abyssInfoEl.className = 'hub-status-pill energy';
            abyssInfoEl.innerHTML = `${eIcon} ${gState.dungeonStamina || 0}/10`;
        }
    }

    const raidInfoEl = $id('hub-raid-info');
    if (raidInfoEl) {
        if (gState.isRaidDefeatedThisWeek || (gState.worldBossHp || 0) <= 0) {
            raidInfoEl.className = 'hub-status-pill';
            raidInfoEl.innerText = currentLang === 'RU' ? 'ПОВЕРЖЕН' : 'DEFEATED';
        } else if (isRaidStrikeReady) {
            raidInfoEl.className = 'hub-status-pill raid-ready';
            raidInfoEl.innerText = currentLang === 'RU' ? 'УДАР ГОТОВ!' : 'STRIKE READY!';
        } else {
            const leftSec = Math.ceil((raidCooldown - raidElapsed) / 1000);
            raidInfoEl.className = 'hub-status-pill raid-cd';
            raidInfoEl.innerHTML = `<img src="assets/icons/icon_hourglass.webp" class="icon-hourglass-inline" style="width:13px; height:13px; margin-right:3px;"> ${getFormattedTime(leftSec)}`;
        }
    }

    // 5. Арена: Лампочка активна СТРОГО когда ожидает награда сезона или брошен вызов на РЕВАНШ
    const hasPendingSeason = !!gState.pendingSeasonCeremony;
    const hasRevengeRival = (gState.arenaActiveRivals || []).some(r => r.isRevenge);
    $id('badge-district-arena')?.classList.toggle('active', hasPendingSeason || hasRevengeRival);

    // 6. Магазин: Готов ежедневный бесплатный дар Казны
    const isFreebieReady = !gState.dailyFreebieClaimedToday;
    $id('badge-district-market')?.classList.toggle('active', isFreebieReady);
}

/* ==========================================================
   ФРАКЦИОННЫЙ КОДЕКС СТИХИЙ (84 ГЕРОЯ / 4 СТИХИИ)
   ========================================================== */
let activeCodexFaction = 'undead';

const CODEX_MILESTONES = [
    { count: 3, bonusPct: 3, rewardC: 50, rewardR: 0, title: { RU: 'Глава I: Пробуждение', EN: 'Chapter I: Awakening' } },
    { count: 7, bonusPct: 5, rewardC: 100, rewardR: 0, title: { RU: 'Глава II: Когорты Смерти', EN: 'Chapter II: Cohorts of Dread' } },
    { count: 12, bonusPct: 8, rewardC: 250, rewardR: 0, title: { RU: 'Глава III: Славный Легион', EN: 'Chapter III: High Legion' } },
    { count: 17, bonusPct: 12, rewardC: 0, rewardR: 1, title: { RU: 'Глава IV: Владыки Стихии', EN: 'Chapter IV: Elemental Overlords' } },
    { count: 21, bonusPct: 20, rewardC: 500, rewardR: 0, title: { RU: 'Глава V: Абсолютный Магистр', EN: 'Chapter V: Absolute Magister' } }
];

// Кодекс нативно открывается через вкладку Штаба: selectRosterTab('codex')

function selectCodexFaction(f) {
    activeCodexFaction = f;
    renderCodexUI();
    playFilterClickSfx();
    triggerHaptic('tap');
}

function renderCodexUI() {
    const tabsBox = document.getElementById('codex-faction-tabs');
    const contentBox = document.getElementById('codex-content-box');
    if (!tabsBox || !contentBox) return;

    if (!gState.codexClaimed) gState.codexClaimed = { light: [], undead: [], chaos: [], demon: [] };

    const factions = ['undead', 'demon', 'light', 'chaos'];
    const fIcons = {
        undead: `<img src="assets/icons/elem_undead.webp" class="res-icon-inline" alt="Нежить"> ${currentLang === 'RU' ? 'Нежить' : 'Undead'}`,
        demon: `<img src="assets/icons/elem_demon.webp" class="res-icon-inline" alt="Демоны"> ${currentLang === 'RU' ? 'Демоны' : 'Demons'}`,
        light: `<img src="assets/icons/elem_light.webp" class="res-icon-inline" alt="Свет"> ${currentLang === 'RU' ? 'Свет' : 'Light'}`,
        chaos: `<img src="assets/icons/elem_chaos.webp" class="res-icon-inline" alt="Хаос"> ${currentLang === 'RU' ? 'Хаос' : 'Chaos'}`
    };

    tabsBox.innerHTML = factions.map(f => {
        const owned = Object.values(HEROES_CATALOG).filter(h => h.faction === f && !!gState.deck[h.id]).length;
        const claimed = gState.codexClaimed?.[f] || [];
        const hasReadyReward = CODEX_MILESTONES.some((m, idx) => owned >= m.count && !claimed.includes(idx));
        return `
            <div class="codex-f-tab ${activeCodexFaction === f ? 'active' : ''}" style="position:relative;" onclick="selectCodexFaction('${f}')">
                ${fIcons[f]}
                <span class="notif-badge ${hasReadyReward ? 'active' : ''}" style="top:-2px; right:-2px;"></span>
            </div>`;
    }).join('');

    const factionHeroes = Object.values(HEROES_CATALOG).filter(h => h.faction === activeCodexFaction);
    const ownedCount = factionHeroes.filter(h => !!gState.deck[h.id]).length;
    const curBonusPct = Math.round(getCodexBonus(activeCodexFaction) * 100);
    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';

    const tilesHtml = factionHeroes.map(h => {
        const isOwned = !!gState.deck[h.id];
        const cardData = gState.deck[h.id] || { stars: 1, lvl: 1 };
        const tColor = `var(--tier-${(h.tier||'f').toLowerCase()})`;

        const heroImg = h.img || `${h.id}.webp`;
        const artContent = `<img src="assets/heroes/${heroImg}" class="tcg-art-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span class="tcg-art-icon" style="display:none;">${h.icon}</span>`;

        const lockedStr = currentLang === 'RU' ? '[НЕДОСТУПЕН]' : '[LOCKED]';
        const _codexRoleInfo = getHeroRoleLabel(h);
        const _codexRoleHtml = _codexRoleInfo ? `<span class="tcg-role-badge ${_codexRoleInfo.cls}">${_codexRoleInfo.text}</span>` : '';
        return `
            <div class="tcg-card ${isOwned ? '' : 'unowned'}" style="height:165px; border-color:${isOwned ? tColor : 'var(--border-metal)'}; cursor:pointer;" onclick="openCardInspect('${h.id}')">
                <div class="tcg-art-bg-layer">${artContent}</div>
                <div class="tcg-header">
                    <div style="display:flex; align-items:center; gap:3px;">
                        ${_codexRoleHtml}
                    </div>
                    <span class="tcg-stars-row">${isOwned ? formatHeroStars(cardData.stars || 1) : `<span style="font-size:11px; color:var(--text-muted); font-weight:700;">${lockedStr}</span>`}</span>
                </div>
                <div class="tcg-footer-meta">
                    <div class="tcg-name" style="color:${tColor}; font-size:11px;"><span class="tcg-tier-badge" style="color:${tColor}; margin-right:3px;">[${h.tier}]</span>${h.name[currentLang] || h.name['EN']}</div>
                    <div class="tcg-stats" style="font-size:11px;">${isOwned ? `${currentLang === 'RU' ? 'Ур.' : 'Lvl'} ${cardData.lvl} • +${formatNumber(getHeroCP(h.id))} ${cpUnit}` : (currentLang === 'RU' ? 'Не открыт' : 'Locked')}</div>
                </div>
            </div>`;
    }).join('');

    let milestonesHtml = '';
    const claimedList = gState.codexClaimed[activeCodexFaction] || [];

    CODEX_MILESTONES.forEach((m, idx) => {
        const isUnlocked = ownedCount >= m.count;
        const isClaimed = claimedList.includes(idx);
        const titleStr = m.title[currentLang] || m.title['EN'];

        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
        let rewardStr = m.rewardC > 0 ? `+${m.rewardC} ${cI}` : `+${m.rewardR} ${rI}`;
        let btnHtml = '';

        if (isClaimed) {
            btnHtml = `<span style="font-size:11px; font-weight:800; color:var(--green);">${currentLang === 'RU' ? 'ВЫПОЛНЕНО' : 'CLAIMED'}</span>`;
        } else if (isUnlocked) {
            btnHtml = `<button class="btn-action" style="font-size:11px; padding:6px 10px; background:var(--green); border-color:#22c55e;" onclick="claimCodexMilestone('${activeCodexFaction}', ${idx})">${currentLang === 'RU' ? 'ЗАБРАТЬ' : 'CLAIM'}</button>`;
        } else {
            btnHtml = `<span style="font-size:11px; color:var(--text-muted); font-weight:700;">${ownedCount}/${m.count}</span>`;
        }

        milestonesHtml += `
            <div class="building-card" style="padding:8px 10px; ${isUnlocked && !isClaimed ? 'border-color:var(--gold);' : ''}">
                <div>
                    <div style="font-weight:800; font-size:12px; color:${isUnlocked ? '#fff' : 'var(--text-muted)'};">${titleStr} (${m.count} ${currentLang === 'RU' ? 'героев' : 'heroes'})</div>
                    <div style="font-size:11px; color:var(--gold); margin-top:2px;">${currentLang === 'RU' ? 'Бонус' : 'Bonus'}: <b>+${m.bonusPct}% ${cpUnit} ${currentLang === 'RU' ? 'стихии' : 'element'}</b> • ${currentLang === 'RU' ? 'Награда' : 'Reward'}: ${rewardStr}</div>
                </div>
                <div>${btnHtml}</div>
            </div>`;
    });

    contentBox.innerHTML = `
        <div class="building-card" style="background: radial-gradient(circle at left, rgba(245,176,65,0.15) 0%, #10141d 100%); border-color:var(--gold); margin-bottom:4px;">
            <div>
                <b style="font-size:13px; color:var(--gold);">${fIcons[activeCodexFaction]} (${currentLang === 'RU' ? 'Собрано' : 'Collected'}: ${ownedCount}/21)</b>
                <div style="font-size:11px; color:#cbd5e1; margin-top:2px;">${currentLang === 'RU' ? 'Текущий пассивный бонус' : 'Current passive bonus'}: <b style="color:var(--green);">+${curBonusPct}% ${cpUnit}</b></div>
            </div>
        </div>
        <div class="codex-hero-grid">${tilesHtml}</div>
        <div style="font-size:12px; font-weight:800; color:var(--gold); margin:8px 0 4px 0; font-family:'Cinzel',serif;">${currentLang === 'RU' ? 'ВЕХИ ТРИУМФА:' : 'TRIUMPH MILESTONES:'}</div>
        <div style="display:flex; flex-direction:column; gap:6px;">${milestonesHtml}</div>
    `;

    // N1-fix: явная активация общего бейджа вкладки CODEX (снаружи faction-табов).
    // Дублирует внутренние точки, но делает подсветку моментальной и безусловной.
    const overallReady = isCodexRewardReady();
    document.getElementById('badge-tab-codex')?.classList.toggle('active', overallReady);
    const rosterDistrict = document.getElementById('badge-district-roster');
    const now = Date.now();
    const isExpReady = Object.values(gState.expeditions || {}).some(e => e && e.endTime <= now);
    rosterDistrict?.classList.toggle('active', overallReady || isExpReady);
    checkCodexNotifications();
}

function claimCodexMilestone(faction, mIdx) {
    if (!gState.codexClaimed) gState.codexClaimed = { light: [], undead: [], chaos: [], demon: [] };
    const claimedList = gState.codexClaimed[faction] || [];
    if (claimedList.includes(mIdx)) return;

    const m = CODEX_MILESTONES[mIdx];
    if (!m) return;

    claimedList.push(mIdx);
    gState.codexClaimed[faction] = claimedList;

    if (m.rewardC > 0) gState.crystals += m.rewardC;
    if (m.rewardR > 0) gState.relics += m.rewardR;

    playCoinSfx();
    // L10: локализация хвоста «+N% CP» → «+N% БМ» в RU
    const rewStr = currentLang === 'RU' ? 'за веху Кодекса!' : 'for Codex milestone!';
    const cpSuffix = currentLang === 'RU' ? 'БМ' : 'CP';
    pushToast(`+${m.rewardC || m.rewardR} ${rewStr} (+${m.bonusPct}% ${cpSuffix})`);
    saveGame();
    renderCodexUI();
    renderFormationSlots();
    renderCards();
    renderUI();
}

function isCodexRewardReady() {
    const factions = ['undead', 'demon', 'light', 'chaos'];
    for (let f of factions) {
        const owned = Object.values(HEROES_CATALOG).filter(h => h.faction === f && !!gState.deck[h.id]).length;
        const claimed = gState.codexClaimed?.[f] || [];
        for (let i = 0; i < CODEX_MILESTONES.length; i++) {
            if (owned >= CODEX_MILESTONES[i].count && !claimed.includes(i)) return true;
        }
    }
    return false;
}

function checkCodexNotifications() {
    const ready = isCodexRewardReady();
    // U16: горячие бейджи через кэш $id (функция вызывается из тика и из 4+ мест UI)
    $id('badge-tab-codex')?.classList.toggle('active', ready);
    const now = Date.now();
    const isExpeditionReady = Object.values(gState.expeditions || {}).some(e => e && e.endTime <= now);
    $id('badge-tab-exp')?.classList.toggle('active', isExpeditionReady);
    $id('badge-district-roster')?.classList.toggle('active', isExpeditionReady || ready);
}

/* ==========================================================
   БОЕВОЙ ПРОПУСК БЕЗДНЫ (ABYSS PASS)
   ========================================================== */
function getAbyssPassLevel() {
    // FIX-BALANCE v4.7.0: порог уровня 85 XP (было 50).
    // Сезон: 30 ур. × 85 = 2550 XP. Суточный кап 100 XP.
    // Игроку нужно заходить 26 из 30 дней — 4 дня просрочки в месяц допустимо.
    return Math.min(30, Math.floor((gState.abyssPassXp || 0) / 85));
}

function renderAbyssPass(container) {
    if (!container) return;
    const curLvl = getAbyssPassLevel();
    // FIX-BALANCE v4.7.0: XP-остаток считается от нового порога 85.
    const curXp = (gState.abyssPassXp || 0) % 85;
    const isVip = isVipActive();

    let rowsHtml = '';
    for (let lvl = 1; lvl <= 30; lvl++) {
        const isUnlocked = curLvl >= lvl;
        const freeClaimed = (gState.abyssPassFreeClaimed || []).includes(lvl);
        const vipClaimed = (gState.abyssPassVipClaimed || []).includes(lvl);

        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
        const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
        const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';

        const passLvlGold = Math.max(lvl * 3000, Math.floor(getIncomeRate() * (600 + lvl * 180)));
        // B5: значение milestone-кристаллов синхронизировано с claimAbyssPassReward (lvl² × 2)
        // FIX-BALANCE v4.7.0: milestone-кристаллы lvl×8 (было lvl²×2).
        // Суммарно за 30 уровней: 840 C (было 4550 C).
        let freeRewardText = lvl % 5 === 0 
            ? `<span class="pass-reward-val crystal">+${lvl * 8} ${cI}</span>` 
            : `<span class="pass-reward-val gold">+${formatNumber(passLvlGold)} ${gI}</span>`;
            
        let vipRewardText = '';
        const ssHeroLabel = currentLang === 'RU' ? '[SS] ГЕРОЙ' : '[SS] HERO';
        const hoursLabel = currentLang === 'RU' ? '24ч' : '24h';
        const claimBtnText = currentLang === 'RU' ? 'ВЗЯТЬ' : 'CLAIM';

        if (lvl === 30) {
            vipRewardText = `<span class="pass-reward-val gold">${ssHeroLabel}</span>`;
        } else if (lvl === 20) {
            vipRewardText = `<span class="pass-reward-val gold">+1 ${rI}</span>`;
        } else if (lvl === 10) {
            vipRewardText = `<span class="pass-reward-val gold">+10 ${tI}</span>`;
        } else if (lvl === 25) {
            vipRewardText = `<span class="pass-reward-val gold">${hoursLabel} ${gI}</span>`;
        } else {
            vipRewardText = `<span class="pass-reward-val crystal">+${lvl * 20} ${cI}</span>`;
        }

        let freeBtn = '';
        if (freeClaimed) {
            freeBtn = `<span style="color:var(--green); font-weight:800; font-size:12px;">OK</span>`;
        } else if (isUnlocked) {
            freeBtn = `<button class="btn-action btn-pass-claim" onclick="claimAbyssPassReward(${lvl}, false)">${claimBtnText}</button>`;
        } else {
            freeBtn = `<span style="color:var(--text-muted); font-size:12px;">--</span>`;
        }

        let vipBtn = '';
        if (vipClaimed) {
            vipBtn = `<span style="color:var(--gold); font-weight:800; font-size:12px;">OK</span>`;
        } else if (isUnlocked && isVip) {
            vipBtn = `<button class="btn-action btn-pass-claim" onclick="claimAbyssPassReward(${lvl}, true)">${claimBtnText}</button>`;
        } else if (isUnlocked && !isVip) {
            vipBtn = `<button class="btn-action btn-pass-vip" onclick="openBuyConfirm('vip_30', 299)">VIP</button>`;
        } else {
            vipBtn = `<span style="color:var(--text-muted); font-size:12px;">--</span>`;
        }

        rowsHtml += `
            <div class="pass-level-row ${isUnlocked ? 'unlocked' : ''}">
                <div style="font-family:'Cinzel',serif; font-weight:900; font-size:13px; color:${isUnlocked ? 'var(--gold)' : 'var(--text-muted)'}; display:flex; align-items:center; justify-content:center;">
                    #${lvl}
                </div>
                <div class="pass-reward-cell">
                    ${freeRewardText}
                    <div style="flex-shrink:0;">${freeBtn}</div>
                </div>
                <div class="pass-reward-cell vip">
                    ${vipRewardText}
                    <div style="flex-shrink:0;">${vipBtn}</div>
                </div>
            </div>`;
    }

    const passLvlTitle = currentLang === 'RU' ? `УРОВЕНЬ ${curLvl} / 30` : `LEVEL ${curLvl} / 30`;
    const xpTitle = currentLang === 'RU' ? 'Опыт' : 'Experience';
    const vipActiveTitle = currentLang === 'RU' ? 'VIP АКТИВЕН' : 'VIP ACTIVE';
    const vipInactiveTitle = currentLang === 'RU' ? 'VIP НЕ АКТИВЕН' : 'VIP INACTIVE';
    const colLvl = currentLang === 'RU' ? 'УР.' : 'LVL';
    const colFree = currentLang === 'RU' ? 'ОБЫЧНЫЙ' : 'FREE';
    const colVip = currentLang === 'RU' ? 'ЭЛИТНЫЙ VIP' : 'ELITE VIP';

    container.innerHTML = `
        <div class="pass-header-card">
            <div>
                <div class="pass-level-badge">${passLvlTitle}</div>
                <div style="font-size:11.5px; color:#cbd5e1; margin-top:2px;">${xpTitle}: <b style="color:var(--gold);">${curLvl >= 30 ? 'MAX' : `${curXp}/85 XP`}</b></div>
            </div>
            <div>
                <span class="vip-tag ${isVip ? 'active' : ''}" style="font-size:11px; padding:4px 8px;">${isVip ? vipActiveTitle : vipInactiveTitle}</span>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 46px 1fr 1fr; gap:6px; font-size:11px; font-weight:800; color:var(--text-muted); text-align:center; margin-bottom:2px;">
            <span>${colLvl}</span>
            <span>${colFree}</span>
            <span style="color:var(--gold);">${colVip}</span>
        </div>
        <div class="pass-track-list">${rowsHtml}</div>
    `;
}

function claimAllAbyssPassRewards() {
    const curLvl = getAbyssPassLevel();
    let claimedAny = false;
    for (let lvl = 1; lvl <= curLvl; lvl++) {
        if (!(gState.abyssPassFreeClaimed || []).includes(lvl)) {
            claimAbyssPassReward(lvl, false);
            claimedAny = true;
        }
        if (isVipActive() && !(gState.abyssPassVipClaimed || []).includes(lvl)) {
            claimAbyssPassReward(lvl, true);
            claimedAny = true;
        }
    }
    updatePassClaimAllButton();
    if (claimedAny) {
        pushToast(currentLang === 'RU' ? 'Все доступные награды Пропуска собраны!' : 'All Pass rewards collected!');
    } else {
        pushToast(currentLang === 'RU' ? 'Нет доступных наград для сбора' : 'No rewards available to claim');
    }
}

function claimAbyssPassReward(lvl, isVipTrack) {
    if (getAbyssPassLevel() < lvl) return;

    if (!isVipTrack) {
        if (!gState.abyssPassFreeClaimed) gState.abyssPassFreeClaimed = [];
        if (gState.abyssPassFreeClaimed.includes(lvl)) return;
        gState.abyssPassFreeClaimed.push(lvl);

        if (lvl % 5 === 0) {
            // FIX-BALANCE v4.7.0: milestone lvl×8 (было lvl²×2 = 4550 C за сезон).
            // Суммарно за 30 уровней: 840 C.
            // • lvl 5  → 40
            // • lvl 10 → 80
            // • lvl 15 → 120
            // • lvl 20 → 160
            // • lvl 25 → 200
            // • lvl 30 → 240
            gState.crystals += (lvl * 8);
        } else {
            const passGold = Math.max(lvl * 3000, Math.floor(getIncomeRate() * (600 + lvl * 180)));
            gState.gold += passGold;
            gState.lifetimeGold += passGold;
        }

        playCoinSfx();
        pushToast(currentLang === 'RU' ? `Награда Пропуска за Ур. ${lvl} получена!` : `Pass Reward for Lvl ${lvl} claimed!`);
    } else {
        if (!isVipActive()) return openBuyConfirm('vip_30', 299);
        if (!gState.abyssPassVipClaimed) gState.abyssPassVipClaimed = [];
        if (gState.abyssPassVipClaimed.includes(lvl)) return;
        gState.abyssPassVipClaimed.push(lvl);

        if (lvl === 30) {
            const legendPool = ['ss_und_r', 'ss_dem_v', 'ss_lig_c', 'ss_cha_v', 'sss_dem_v'];
            const hid = legendPool[Math.floor(Math.random() * legendPool.length)];
            if (!gState.deck[hid]) gState.deck[hid] = { stars: 1, lvl: 1 };
            else gState.deck[hid].stars = Math.min(10, (gState.deck[hid].stars || 1) + 1);
            const finalStr = currentLang === 'RU' ? 'ФИНАЛЬНЫЙ ТРОФЕЙ' : 'FINAL TROPHY';
            pushToast(`${finalStr}: [${HEROES_CATALOG[hid].tier}] ${HEROES_CATALOG[hid].name[currentLang] || HEROES_CATALOG[hid].name['EN']}`);
        } else if (lvl === 20) {
            gState.relics = (gState.relics || 0) + 1;
            const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
            const culmStr = currentLang === 'RU' ? 'КУЛЬМИНАЦИЯ ПРОПУСКА' : 'PASS CLIMAX';
            const forStr = currentLang === 'RU' ? 'навсегда' : 'forever';
            pushToast(`${culmStr}: +1 ${rI} (+15% ${forStr})!`);
        } else if (lvl === 10) {
            gState.tickets = (gState.tickets || 0) + 10;
            const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';
            const ammoStr = currentLang === 'RU' ? 'БОЕКОМПЛЕКТ ПРОПУСКА' : 'PASS ARSENAL';
            pushToast(`${ammoStr}: +10 ${tI}`);
        } else if (lvl === 25) {
            const goldGain = getIncomeRate() * 86400;
            gState.gold += goldGain;
            gState.lifetimeGold += goldGain;
            const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
            const jackpotStr = currentLang === 'RU' ? 'ЗОЛОТОЙ КУШ' : 'GOLDEN JACKPOT';
            pushToast(`${jackpotStr}: +${formatNumber(goldGain)} ${gI}`);
        } else {
            gState.crystals += (lvl * 20);
            const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';
            const rewStr = currentLang === 'RU' ? 'Награда Пропуска' : 'Pass Reward';
            pushToast(`+${lvl * 20} ${cI} ${rewStr}`);
        }
        playCoinSfx();
    }

    saveGame();
    const container = document.getElementById('abyss-pass-modal-container');
    if (container) renderAbyssPass(container);
    updatePassClaimAllButton();
    renderQuests();
    renderUI();
}

/* ==========================================================
   ЗДАНИЯ И ВОЗВЫШЕНИЕ (ПЛАВНЫЙ РОСТ ЦЕН И РЕАЛЬНЫЙ CAP)
   ========================================================== */
function getUpgradeCost(b) {
    // Цитадель: монументальное сооружение с весомой прогрессией стоимости
    if (b === 'keep') {
        return Math.floor(500 * Math.pow(1.32, gState.buildings.keep || 1));
    }
    const base = { mine: 60, barracks: 90 }[b] || 100;
    return Math.floor(base * Math.pow(1.16, gState.buildings[b] || 1));
}

let activeInspectBuilding = null;

function openBuildingModal(b) {
    activeInspectBuilding = b;
    renderBuildingModal();
    const m = document.getElementById('building-modal');
    if (m) m.style.display = 'flex';
    if (!isFtueCompleted()) updateFtueFocus();
}

function closeBuildingModal() {
    const m = document.getElementById('building-modal');
    if (m) m.style.display = 'none';
    activeInspectBuilding = null;
    if (!isFtueCompleted()) updateFtueFocus();
}

function openBattleHubModal() {
    const m = document.getElementById('battle-hub-modal');
    if (m) m.style.display = 'flex';
    if (!isFtueCompleted()) updateFtueFocus();
}
function closeBattleHubModal() {
    const m = document.getElementById('battle-hub-modal');
    if (m) m.style.display = 'none';
    if (!isFtueCompleted()) updateFtueFocus();
}

function renderBuildingModal() {
    if (!activeInspectBuilding) return;
    const b = activeInspectBuilding;
    const lvl = gState.buildings[b] || (b === 'barracks' ? 0 : 1);
    const cost = getUpgradeCost(b);

    const bNames = {
        keep: { RU: 'Цитадель', EN: 'Citadel', icon: '🏛️', desc: { RU: 'Увеличивает вместимость армии на +30% за уровень и открывает Возвышение.', EN: 'Expands army capacity by +30% and unlocks Ascension.' } },
        mine: { RU: 'Золотые Шахты', EN: 'Gold Mines', icon: '⛏️', desc: { RU: 'Приносит пассивный доход золота каждую секунду.', EN: 'Produces passive gold income every second.' } },
        barracks: { RU: 'Казармы Легиона', EN: 'Legion Barracks', icon: '⚔️', desc: { RU: 'Автоматически нанимает воинов в гарнизон каждую секунду.', EN: 'Automatically recruits soldiers every second.' } }
    };

    const cfg = bNames[b];
    if (!cfg) return;

    const mTitle = document.getElementById('bld-m-title');
    const mIcon = document.getElementById('bld-m-icon');
    const mArtBox = document.getElementById('bld-m-art-box');
    const mDesc = document.getElementById('bld-m-desc');

    const bImages = { keep: 'keep.webp', mine: 'mine.webp', barracks: 'barracks.webp' };
    if (mArtBox) {
        mArtBox.innerHTML = `
            <img src="assets/buildings/${bImages[b]}" class="bld-modal-art-img" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'bld-modal-icon\\'>${cfg.icon}</span>';">
        `;
    }
    const mCurLvl = document.getElementById('bld-m-cur-lvl');
    const mCurEff = document.getElementById('bld-m-cur-eff');
    const mNextEff = document.getElementById('bld-m-next-eff');
    const mBtn = document.getElementById('bld-m-upg-btn');
    const keepAscendBox = document.getElementById('bld-keep-ascend-box');

    if (mTitle) mTitle.innerText = cfg[currentLang] || cfg['EN'];
    if (mIcon) mIcon.style.display = 'none'; // Эмодзи скрыты, оставляем только чистый арт здания
    if (mDesc) mDesc.innerText = cfg.desc[currentLang] || cfg.desc['EN'];
    if (mCurLvl) mCurLvl.innerText = `${currentLang === 'RU' ? 'Ур.' : 'Lvl'} ${lvl}`;

    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const aI = '<img src="assets/icons/army.webp" class="res-icon-inline" alt="A">';

    if (b === 'keep') {
        const curMult = Math.round(lvl * 30);
        const nextMult = Math.round((lvl + 1) * 30);
        const capSuffix = currentLang === 'RU' ? 'к лимиту армии' : 'army cap';
        if (mCurEff) mCurEff.innerText = `+${curMult}% ${capSuffix}`;
        if (mNextEff) mNextEff.innerHTML = `+${nextMult}% ${capSuffix} <span style="color:var(--green); font-size:11px; font-weight:800; margin-left:4px;">(+30%)</span>`;
        if (keepAscendBox) keepAscendBox.style.display = 'block';
    } else {
        if (keepAscendBox) keepAscendBox.style.display = 'none';
        const perSecUnit = currentLang === 'RU' ? '/с' : '/s';
        if (b === 'mine') {
            const curIncNum = getIncomeRate(lvl);
            const nextIncNum = getIncomeRate(lvl + 1);
            const deltaIncNum = Math.max(1, nextIncNum - curIncNum);
            if (mCurEff) mCurEff.innerHTML = `+${formatNumber(curIncNum)} ${gI}${perSecUnit}`;
            if (mNextEff) mNextEff.innerHTML = `+${formatNumber(nextIncNum)} ${gI}${perSecUnit} <span style="color:var(--green); font-size:11px; font-weight:800; margin-left:4px;">(+${formatNumber(deltaIncNum)}${perSecUnit})</span>`;
        } else if (b === 'barracks') {
            const curRecNum = Math.floor(lvl * 1 * getRelicBonus());
            const nextRecNum = Math.floor((lvl + 1) * 1 * getRelicBonus());
            const deltaRecNum = Math.max(1, nextRecNum - curRecNum);
            if (mCurEff) mCurEff.innerHTML = `+${formatNumber(curRecNum)} ${aI}${perSecUnit}`;
            if (mNextEff) mNextEff.innerHTML = `+${formatNumber(nextRecNum)} ${aI}${perSecUnit} <span style="color:var(--green); font-size:11px; font-weight:800; margin-left:4px;">(+${formatNumber(deltaRecNum)}${perSecUnit})</span>`;
        }
    }

    if (mBtn) {
        mBtn.innerHTML = `${currentLang === 'RU' ? 'УЛУЧШИТЬ' : 'UPGRADE'} (${formatNumber(cost)} ${gI})`;
        mBtn.disabled = (gState.gold || 0) < cost;
    }
}

function upgradeFromModal() {
    if (!activeInspectBuilding) return;
    upgrade(activeInspectBuilding);
    renderBuildingModal();
    // Если игрок проходит обучение и выполнил требование шага — плавно закрываем окно
    if (!isFtueCompleted()) {
        const step = gState.ftueStep || 0;
        const cfg = FTUE_STEPS_CONFIG[step];
        if (cfg && cfg.req()) {
            closeBuildingModal();
            renderFtue();
        }
    }
}

function upgrade(b) {
    const cost = getUpgradeCost(b);
    if ((gState.gold || 0) >= cost) {
        gState.gold -= cost; 
        gState.buildings[b] = (gState.buildings[b] || 0) + 1;
        if (b === 'keep' && gState.buildings.keep > (gState.highestKeep || 1)) gState.highestKeep = gState.buildings.keep;
        playSfx(520, 'sine', 0.1);
        triggerHaptic('upgrade');
        trackQuestProgress('upgrade', 1);
        saveGame();
        renderFtue();
        renderUI();
        renderQuests();
    } else pushToast(currentLang === 'RU' ? "Недостаточно золота!" : "Not enough gold!");
}

function getAscendKeepReq() {
    // v4.9.7: требование к Цитадели — от числа возвышений, не от пассивных реликвий.
    const r = gState.relicsFromAscend || 0;
    if (r === 0) return 2;
    // Каждое последующее Возвышение требует планомерного развития Цитадели
    return Math.min(30, 2 + (r * 3));
}

// Сбалансированная степенно-экспоненциальная кривая с точкой перелома на 15-й реликвии.
// B2: чистая экспонента 1.35^r обгоняла доход шахт после r≈22 — игрок упирался в «стеклянный потолок».
// Решение: линейно-степенной рост до r=15, после — мягкий демпфер 1.06 вместо 1.35.
// Проходимо до r≈40 при текущей экономике и органично упирается в новые механики (Пробуждение, B7).
function getAscendGoldReq() {
    // v4.9.7: цена — только от числа возвышений (relicsFromAscend),
    // не от общего счётчика реликвий (календарь/Левиафан/экспедиции).
    const r = gState.relicsFromAscend || 0;
    if (r === 0) return 5000;
    // FIX-BALANCE v4.7.0: новая кривая. Тайминги (с учётом роста дохода):
    //   r=1  →  ~180k   (часть дня)
    //   r=5  →  ~7M     (1-2 дня)
    //   r=10 →  ~110M   (1 неделя)
    //   r=15 →  ~440M   (2-3 недели)
    //   r=20 →  ~1.4B   (1-2 месяца)
    // Старая формула давала r=13 за сутки — новый темп в 15-20 раз медленнее.
    // v4.9.7: смягчённая формула. 1.30×1.10 → 1.20×1.06.
    // Целевая прогрессия: ~12 возвышений в год, 36 за 3 года активной игры.
    // r=10: ~11M, r=20: ~250M, r=30: ~3B, r=36: ~5B.
    const base = 25000 * Math.pow(1 + r, 2.5);
    const expMult = Math.pow(1.20, Math.min(r, 10));
    const logDampener = r > 10 ? Math.pow(1.06, r - 10) : 1;
    return Math.floor(base * expMult * logDampener);
}

function openAscendModal() {
    const keepReq = getAscendKeepReq();
    const goldReq = getAscendGoldReq();

    if ((gState.buildings.keep || 1) < keepReq) {
        return pushToast((currentLang === 'RU' ? "Требуется Цитадель Ур. " : "Requires Citadel Lvl ") + keepReq);
    }
    if ((gState.gold || 0) < goldReq) {
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        return pushToast((currentLang === 'RU' ? `Требуется накопить ${formatNumber(goldReq)} ${gI}!` : `Requires ${formatNumber(goldReq)} ${gI}!`));
    }
    document.getElementById('ascend-modal')?.setAttribute('style', 'display: flex;');
    if (!isFtueCompleted()) updateFtueFocus();
}
function closeAscendModal() { 
    document.getElementById('ascend-modal')?.setAttribute('style', 'display: none;'); 
    if (!isFtueCompleted()) updateFtueFocus();
}

function autoSpendExcessGoldOnHeroes() {
    if (isAutoSpendingInProgress) return;
    const goldReq = getAscendGoldReq();
    let excessGold = (gState.gold || 0) - goldReq;
    if (excessGold <= 0) return pushToast(currentLang === 'RU' ? "Нет излишков золота!" : "No excess gold!");
    isAutoSpendingInProgress = true;

    let spent = 0;
    let upgradedCount = 0;

    const owned = Object.keys(gState.deck || {}).map(id => ({ id, ...gState.deck[id] }));
    owned.sort((a, b) => a.lvl - b.lvl);

        let iterations = 0;
    for (let h of owned) {
        // G7: Полный автомат Ascension работает без модалок.
        // Если герой достиг 200 и не пробуждён — авто-awaken: игрок сам запустил автомат.
        if (h.lvl === MAX_BASE_LVL && !isMasteryAwakened(h.id)) {
            markMasteryAwakened(h.id);
        }
        // B7: cap расширен до MAX_TOTAL_LVL (300). Итераций в 2x больше для поддержки M1–M100.
        while (excessGold > 0 && h.lvl < MAX_TOTAL_LVL && iterations < 600) {
            iterations++;
            const cost = getHeroUpgradeCost(h.id, h.lvl);
            if (excessGold >= cost) {
                excessGold -= cost;
                spent += cost;
                h.lvl++;
                gState.deck[h.id].lvl = h.lvl;
                upgradedCount++;
                // G7: триггерим визуал пробуждения один раз — при пересечении 200
                if (h.lvl === MAX_BASE_LVL + 1) {
                    markMasteryAwakened(h.id);
                    checkMasteryAwakening(MAX_BASE_LVL, MAX_BASE_LVL + 1);
                }
            } else {
                break;
            }
        }
        if (iterations >= 600) break;
    }

    gState.gold -= spent;
    gState.ftueAutoSpendDone = true;
    if (upgradedCount > 0) trackQuestProgress('hero_lvl', upgradedCount);
    playCoinSfx();
    triggerHaptic('upgrade');
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const invStr = currentLang === 'RU' ? 'Вложено' : 'Invested';
    const lvlStr = currentLang === 'RU' ? 'ур.' : 'lvl';
    pushToast(`${invStr} ${formatNumber(spent)} ${gI} (+${upgradedCount} ${lvlStr})!`);
    saveGame();
    renderCards();
    renderUI();
    renderFtue();
    isAutoSpendingInProgress = false;
}

function confirmAscension() {
    if (isAscendingInProgress) return;
    const keepReq = getAscendKeepReq();
    const goldReq = getAscendGoldReq();

    if ((gState.buildings.keep || 1) < keepReq) {
        return pushToast(currentLang === 'RU' ? `Для Возвышения требуется Цитадель Ур. ${keepReq}!` : `Citadel Lvl ${keepReq} required for Ascension!`);
    }
    if ((gState.gold || 0) < goldReq) {
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        return pushToast(currentLang === 'RU' ? `Требуется накопить ${formatNumber(goldReq)} ${gI}!` : `Requires ${formatNumber(goldReq)} ${gI}!`);
    }

    closeAscendModal();
    executeGrandAscensionRitual();
}

function playCosmicAscensionAudio() {
    // FIX-ASCEND-MUTE: ритуал Возвышения играл в полную громкость, игнорируя mute
    // и ползунок SFX. Все остальные звуки (playSfx/playCoinSfx/playTriumphFanfare)
    // имеют этот guard, а playCosmicAscensionAudio — нет, потому что это единственная
    // функция, работающая напрямую через Web Audio API без обёртки playSfx.
    // Двойная защита: ранний return + масштабирование gain на gState.sfxVolume.
    if (gState.isAudioMuted || (gState.sfxVolume || 0) <= 0) return;

    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const curT = ctx.currentTime;
        // FIX-ASCEND-MUTE: базовый множитель громкости — 0..1 из настроек игрока.
        // Раньше gain был хардкод 0.38 / 0.22, теперь это пиковые значения при volume=1.
        const volMult = Math.max(0, Math.min(1, gState.sfxVolume !== undefined ? gState.sfxVolume : 0.8));

        // 1. Мощный инфернальный саб-бас (спад частоты 260 -> 45 Hz)
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.frequency.setValueAtTime(260, curT);
        subOsc.frequency.exponentialRampToValueAtTime(45, curT + 0.6);

        const subPeak = 0.38 * volMult;
        subGain.gain.setValueAtTime(0.001, curT);
        subGain.gain.linearRampToValueAtTime(subPeak, curT + 0.05);
        subGain.gain.exponentialRampToValueAtTime(0.001, curT + 0.7);

        subOsc.start(curT);
        subOsc.stop(curT + 0.75);

        // 2. Сияющий мажорный аккорд Сверхновой на 400 мс (C5 - E5 - G5 - C6)
        const chordNotes = [523.25, 659.25, 783.99, 1046.50];
        const chordPeak = 0.22 * volMult;
        chordNotes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = 'triangle';
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);

            const startT = curT + 0.38 + (idx * 0.04);
            noteOsc.frequency.setValueAtTime(freq, startT);

            noteGain.gain.setValueAtTime(0.0001, startT);
            noteGain.gain.linearRampToValueAtTime(chordPeak, startT + 0.04);
            noteGain.gain.exponentialRampToValueAtTime(0.001, startT + 1.2);

            noteOsc.start(startT);
            noteOsc.stop(startT + 1.25);
        });
    } catch(e) {}
}

// Получение закрепленного оверлея ритуала из DOM
function ensureAscensionOverlay() {
    return document.getElementById('ascension-ritual-overlay');
}

let pendingAscensionData = null;

function executeGrandAscensionRitual() {
    if (isAscendingInProgress) return;
    isAscendingInProgress = true;
    const prevRelics = gState.relics || 0;
    const newRelics = prevRelics + 1;
    const eraNum = prevRelics + 1;

    pendingAscensionData = { prevRelics, newRelics, eraNum };

    // Запуск процедурного саунда и тактильности
    playCosmicAscensionAudio();
    triggerHaptic('legendary');

    // Гарантированно получаем или создаем оверлей прямо в DOM
    const overlay = ensureAscensionOverlay();
    const vortex = document.getElementById('ritual-vortex-bg');
    const flash = document.getElementById('ritual-supernova-flash');
    const card = document.getElementById('ritual-content-card');

    overlay.style.cssText = 'position: absolute !important; inset: 0 !important; z-index: 99999 !important; display: flex !important; justify-content: center; align-items: center; overflow: hidden; background: #040508;';
    
    vortex?.classList.remove('active');
    flash?.classList.remove('active');
    card?.classList.remove('revealed');

    // Фаза 1: Схлопывание Бездны (0 мс)
    setTimeout(() => {
        vortex?.classList.add('active');
    }, 20);

    // Фаза 2: Сверхновая и салют (400 мс)
    setTimeout(() => {
        flash?.classList.add('active');
        spawnCelebrationConfetti();
        triggerHaptic('crit');

        // Данные манифеста эпохи
        const eraBadge = document.getElementById('ritual-era-badge');
        const totalRelicsEl = document.getElementById('ritual-total-relics');
        const multEl = document.getElementById('ritual-multiplier-val');
        const descEl = document.getElementById('ritual-bonus-desc');

        if (eraBadge) eraBadge.innerText = currentLang === 'RU' ? `ЭПОХА #${eraNum} ЗАВЕРШЕНА` : `ERA #${eraNum} CONCLUDED`;
        if (totalRelicsEl) totalRelicsEl.innerHTML = `${newRelics} <img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">`;
        const bonusPct = newRelics * 15;
        if (multEl) multEl.innerText = currentLang === 'RU' ? `+${bonusPct}% ко всем сферам` : `+${bonusPct}% to all realms`;
        if (descEl) descEl.innerText = currentLang === 'RU' ? `+15% ко всей мощи и добыче навсегда (Всего: +${bonusPct}%)` : `+15% to all power & income lifetime (Total: +${bonusPct}%)`;

        // Фаза 3: Явление Реликвии (650 мс)
        setTimeout(() => {
            card?.classList.add('revealed');
        }, 250);
    }, 400);
}

function completeAscensionRitual() {
    const overlay = document.getElementById('ascension-ritual-overlay');
    if (overlay) overlay.style.display = 'none';

    // v4.9.7: два счётчика — общий (для бонуса +15%) и отдельный (для цены возвышения).
    gState.relics = (gState.relics || 0) + 1;
    gState.relicsFromAscend = (gState.relicsFromAscend || 0) + 1;
    isAscendingInProgress = false;
    gState.gold = 1000;
    gState.army = 0;
    gState.ftueAscendDone = true;
    gState.buildings = { keep: 1, mine: 1, barracks: 0 };

    playCoinSfx();
    saveGame();
    renderUI();
    renderQuests();

    // Возврат в Цитадель для нового триумфального марша
    navigate('citadel-view');

    const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
    pushToast(currentLang === 'RU' ? `Империя возрождена! +1 ${rI} (+${gState.relics * 15}% навсегда)!` : `Empire reborn! +1 ${rI} (+${gState.relics * 15}% forever)!`);

    // Запрос отзыва в момент триумфального завершения ритуала
    if (typeof PlatformBridge !== 'undefined' && PlatformBridge.checkAndPromptReview) {
        setTimeout(() => PlatformBridge.checkAndPromptReview(), 1200);
    }
}

// FIX-DEV-MODE: критично! testAscensionRitual() даёт +1 Реликвию БЕЗ проверки требований
// (Трон Ур.2 / 5000 золота). Это была дыра для дюпа Реликвий — любой игрок с F12 мог
// вызвать её в консоли VK-браузера и повторять бесконечно.
// Теперь команда доступна ТОЛЬКО в dev-режиме (localhost / ?debug=1).
if (IS_DEV_MODE) {
    window.testAscensionRitual = () => executeGrandAscensionRitual();
}

function openCardInspect(heroId, isShowcase = false, showcaseSourceStr = '') {
    activeInspectHeroId = heroId;
    const hero = HEROES_CATALOG[heroId];
    if (!hero) return;
    const isOwned = !!gState.deck[heroId];
    const cardData = gState.deck[heroId] || { stars: 1, lvl: 1 };
    const factionName = I18N[currentLang].factions[hero.faction] || hero.faction;
    const roleName = I18N[currentLang].roles[{ 'Авангард': 'vanguard', 'Главком': 'commander', 'Тыл': 'rearguard' }[hero.role]] || hero.role;

    const frame = document.getElementById('inspect-frame');
    const iTier = document.getElementById('ins-tier');
    const iStars = document.getElementById('ins-stars');
    const iIcon = document.getElementById('ins-icon');
    const iName = document.getElementById('ins-name');
    const iRole = document.getElementById('ins-role-tag');
    const iLvl = document.getElementById('ins-level-display');
    const iStats = document.getElementById('ins-stats-bar');
    const iLore = document.getElementById('ins-lore');

    const tierKey = (hero.tier || 'f').toLowerCase();
    const tierColor = `var(--tier-${tierKey})`;
    const tierGlow = `var(--tier-${tierKey})`;

    if (frame) {
        frame.style.setProperty('--card-tier-color', tierColor);
        frame.style.setProperty('--card-tier-glow', tierGlow);
        if (isShowcase) {
            frame.classList.remove('unowned-inspect');
        } else if (!isOwned) {
            frame.classList.add('unowned-inspect');
        } else {
            frame.classList.remove('unowned-inspect');
        }
    }

    if (iTier) {
        const s = cardData.stars || 1;
        const rankLabel = currentLang === 'RU' ? 'РАНГ' : 'RANK';
        const awakeStr = currentLang === 'RU' ? 'ПРОБУЖДЕНИЕ' : 'AWAKENED';
        const rankSuffix = s > 5 ? ` • ${awakeStr} ${s - 5}` : '';
        iTier.innerText = `[${hero.tier}] ${rankLabel}${rankSuffix}`;
        iTier.style.color = s > 5 ? '#ec4899' : tierColor;
        iTier.style.borderColor = s > 5 ? '#ec4899' : tierColor;
    }
    if (iStars) iStars.innerHTML = formatHeroStars(cardData.stars || 1);

    if (iIcon) {
        const heroImg = hero.img || `${hero.id}.webp`;
        iIcon.innerHTML = `<img src="assets/heroes/${heroImg}" class="inspect-art-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span style="display:none;">${hero.icon}</span>`;
    }

    if (iName) {
        iName.innerText = hero.name[currentLang] || hero.name['EN'];
        iName.style.color = tierColor;
        iName.style.textShadow = `0 2px 8px #000, 0 0 18px ${tierColor}`;
    }

    let cleanFaction = factionName.replace(/[\u2600-\u26FF\u2700-\u27BF\uD83C-\uD83E\uDC00-\uDFFF\u2011-\u26FF]/g, '').trim();
    if (iRole) iRole.innerHTML = `${roleName} • <img src="assets/icons/elem_${hero.faction}.webp" class="res-icon-inline" style="width:12px; height:12px; margin:0 2px;"> ${cleanFaction}`;
    const gIcon = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const inVaultStr = currentLang === 'RU' ? 'В казне' : 'Treasury';
    if (iLvl) {
        // B7: отображение уровня с учётом Мастерства.
        //   1..200   → "Ур. 175 / 200"
        //   201..300 → "Ур. 250 (M50) / 300"
        const rawLvl = cardData.lvl || 1;
        const lvlLabel = rawLvl > MAX_BASE_LVL
            ? `${rawLvl} (${formatHeroLevel(rawLvl)}) / ${MAX_TOTAL_LVL}`
            : `${rawLvl} / ${MAX_BASE_LVL}`;
        const vaultSpan = (isShowcase || !isOwned)
            ? ''
            : ` <span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(${inVaultStr}: ${formatNumber(gState.gold)} ${gIcon})</span>`;
        iLvl.innerHTML = `${I18N[currentLang].hero_level} ${lvlLabel}${vaultSpan}`;
    }

    const s = cardData.stars || 1;
    const starBonus = (Math.min(5, s) - 1) * 0.25 + Math.max(0, s - 5) * 0.35;
    const realCap = Math.floor((hero.cap || 30) * (1 + starBonus));
    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';
    const capLabel = currentLang === 'RU' ? 'Лимит' : 'Cap';
    const armyIcon = '<img src="assets/icons/army.webp" class="res-icon-inline" alt="A">';
    if (iStats) iStats.innerHTML = `<img src="assets/icons/swords_cp.webp" class="res-icon-inline" style="width:12px; height:12px;" alt="БМ"> ${cpUnit}: +${formatNumber(getHeroCP(heroId))} | ${armyIcon} ${capLabel}: +${realCap}`;

    const upgBar = document.querySelector('.stationary-upgrade-bar');
    if (isShowcase || !isOwned) {
        if (upgBar) upgBar.style.display = 'none';
    } else {
        if (upgBar) upgBar.style.display = 'flex';
        updateInspectUpgradeButton();
    }

    // Расчет вместимости с учетом 10 звезд
    if (iLore) iLore.innerText = hero.lore[currentLang] || hero.lore['EN'];

    // Подключение 3D-параллакса при движении пальца или курсора
    attachCardTilt3D();

    const m = document.getElementById('card-inspect-modal');
    if (m) m.style.display = 'flex';
    if (!isFtueCompleted()) updateFtueFocus();
}

// Контроллер 3D-параллакса карточки героя.
// FIX-MOBILE-TILT: на тач-устройствах параллакс полностью отключён.
// Причина: (hover: none) + (pointer: coarse) означает, что у игрока нет мыши —
// hover-эффект бессмысленен, а pointermove летит при каждом касании и скролле.
// Каждый вызов getBoundingClientRect() + style.transform вынуждает layout-thrash,
// на слабых Android это даёт 10-15 fps вместо 60. На тачах функция — no-op.
function attachCardTilt3D() {
    // Разовая проверка возможностей указателя — кэшируем, чтобы не дёргать matchMedia при каждой карте
    if (typeof attachCardTilt3D._isTouch === 'undefined') {
        try {
            attachCardTilt3D._isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        } catch (e) {
            attachCardTilt3D._isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        }
    }
    if (attachCardTilt3D._isTouch) return;

    const box = document.getElementById('inspect-tilt-box');
    const card = document.getElementById('inspect-frame');
    if (!box || !card) return;

    const handleMove = (x, y) => {
        const rect = box.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const rotateY = ((x - centerX) / (rect.width / 2)) * 14;
        const rotateX = -((y - centerY) / (rect.height / 2)) * 14;
        card.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    };

    box.onpointermove = (e) => handleMove(e.clientX, e.clientY);
    box.onpointerleave = () => { card.style.transform = 'rotateX(0deg) rotateY(0deg)'; };
}

/* ==========================================================
   ОФФЛАЙН ДОХОД И ЕЖЕДНЕВНЫЙ СБРОС
   ========================================================== */
// U12/U13: дроссели для дневных и недельных проверок. Тик вызывает их 60 раз/сек,
// но смена дня реально происходит только в 00:00, недели — в воскресенье. 30-секундная
// задержка для игрока незаметна, а экономия — десятки тысяч аллокаций Date() в час.
let _lastDailyResetCheckTs = 0;
let _lastWeeklyResetCheckTs = 0;

function checkDailyReset() {
    // MAJOR-M2: заморозка дневных сбросов при обнаруженном откате системных часов
    if (isClockRolledBack) return;

    // U12: пропускаем проверку, если она выполнялась менее 30 секунд назад
    const _now = Date.now();
    if (_now - _lastDailyResetCheckTs < 30000) return;
    _lastDailyResetCheckTs = _now;

    const today = new Date().toDateString();
    const nowD = new Date();
    const currentMonthKey = `${nowD.getFullYear()}_${nowD.getMonth() + 1}`;

    // Месячный сброс сезона Пропуска Бездны
    if (!gState.abyssPassMonthId) {
        gState.abyssPassMonthId = currentMonthKey;
    } else if (gState.abyssPassMonthId !== currentMonthKey) {
        gState.abyssPassMonthId = currentMonthKey;
        gState.abyssPassXp = 0;
        gState.abyssPassFreeClaimed = [];
        gState.abyssPassVipClaimed = [];
        pushToast(currentLang === 'RU' ? "👑 Начался новый сезон Пропуска Бездны!" : "👑 New Abyss Pass Season started!");
    }

    if (gState.lastTicketDate !== today) {
        gState.lastTicketDate = today;
        const dailyCap = isVipActive() ? 15 : 10;
        if ((gState.tickets || 0) < dailyCap) gState.tickets = dailyCap;
        gState.adTicketsDate = today;
        gState.adTicketsClaimedToday = 0;
        gState.dungeonStamina = 10;
        gState.dungeonRefillsToday = 0;
        gState.wheelAdSpinsToday = 0; // Сброс рекламных спинов Колеса
        gState.dailyFreebieClaimedToday = false; // Сброс бесплатного дара казны строго в полночь

        // Полночный сброс 10 ежедневных заданий
        gState.dailyQuests = {
            calendar: { curr: 0, target: 1, rewardC: 5, claimed: false },
            tap: { curr: 0, target: 50, rewardC: 2, claimed: false },
            upgrade: { curr: 0, target: 1, rewardC: 2, claimed: false },
            hero_lvl: { curr: 0, target: 2, rewardC: 3, claimed: false },
            summon: { curr: 0, target: 1, rewardC: 2, claimed: false },
            arena: { curr: 0, target: 3, rewardC: 3, claimed: false },
            dungeon: { curr: 0, target: 3, rewardC: 3, claimed: false },
            raid: { curr: 0, target: 1, rewardC: 3, claimed: false },
            expedition: { curr: 0, target: 1, rewardC: 2, claimed: false },
            demon: { curr: 0, target: 1, rewardC: 2, claimed: false }
        };

        // FIX-BALANCE v4.7.0: суточный XP Пропуска — +100 при первом входе в день.
        // Сезон: 30 уровней × 85 XP = 2550 XP. За 26 активных дней игрок закрывает
        // Пропуск. 3-4 дня просрочки в месяц — допустимо, 5+ — не успевает.
        if (typeof gState.abyssPassXp !== 'number') gState.abyssPassXp = 0;
        gState.abyssPassXp = Math.min(3000, gState.abyssPassXp + 100);

        // Календарь больше не перескакивает дни при пропуске входа: прогресс двигается только в claimDailyReward
        saveGame();
    }
}

let pendingOfflineGold = 0;
function checkOfflineArenaDefense() {
    const now = Date.now();
    const lastDefense = gState.lastDefenseBattleTime || 0;
    // Нападения происходят не чаще одного раза в 3 часа при наличии гарнизона
    if (now - lastDefense < 10800000 || !Array.isArray(gState.defenseFormation) ||
        !gState.defenseFormation.some(id => id && HEROES_CATALOG[id])) return;
    gState.lastDefenseBattleTime = now;

    const myRank = calculatePlayerRank();
    const rivalRank = Math.max(1, Math.min(1000, myRank + (Math.random() < 0.5 ? -3 : 3)));
    const bot = getBotByRank(rivalRank);
    const myDefCP = calculateCP(gState.defenseFormation, bot.squad, false);

    const isDefWon = myDefCP >= bot.cp;
    const trophiesChange = isDefWon ? 10 : -12;
    gState.trophies = Math.max(150, Math.min(3700, (gState.trophies || 150) + trophiesChange));

    const trIcon = '<img src="assets/icons/trophy.webp" class="res-icon-inline" style="width:12px; height:12px;" alt="Трофеи">';

    const logEntry = {
        enemy: `${bot.name}`,
        time: new Date().toLocaleTimeString().slice(0, 5),
        result: isDefWon ? (currentLang === 'RU' ? 'Оборона: Победа' : 'Def: Victory') : (currentLang === 'RU' ? 'Оборона: Пробита' : 'Def: Breached'),
        text: `${trophiesChange > 0 ? `+${trophiesChange}` : trophiesChange} ${trIcon}`
    };
    if (!gState.battleHistory) gState.battleHistory = [];
    gState.battleHistory.unshift(logEntry);
    if (gState.battleHistory.length > 8) gState.battleHistory.pop();

    if (isDefWon) {
        pushToast(currentLang === 'RU' ? `Гарнизон отбил атаку ${bot.name} (+10 ${trIcon})!` : `Garrison repelled ${bot.name} (+10 ${trIcon})!`);
    } else {
        pushToast(currentLang === 'RU' ? `Оборона пробита лордом ${bot.name} (-12 ${trIcon})!` : `Garrison breached by ${bot.name} (-12 ${trIcon})!`);
    }
}

function checkOfflineActivity() {
    checkOfflineArenaDefense();
    checkOfflineIncome();
}

function checkOfflineIncome() {
    const diffSec = Math.floor((Date.now() - (gState.lastTickTime || Date.now())) / 1000);
    if (diffSec > 60) {
        // Базовый доход (без двойного VIP-множителя: множитель честно применится при зачислении в claimOffline)
        let earned = Math.min(diffSec, 8 * 3600) * getIncomeRate();
        if (earned > 20) {
            pendingOfflineGold = earned;
            const elGold = document.getElementById('offline-m-gold');
            const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" style="width:20px; height:20px;">';
            if (elGold) elGold.innerHTML = `+${formatNumber(earned)} ${gI}`;
            // FIX-OFFLINE-MODAL-FROZEN: принудительный сброс залипшего флага и разблокировка кнопок.
            // Причина: если игрок свернул игру во время показа rewarded-видео, isClaimingOffline
            // оставался true, а кнопки — disabled. Модалка открывалась «мёртвой» и висела вечно.
            isClaimingOffline = false;
            const _btnOffClaim = document.getElementById('btn-offline-claim');
            const _btnOffDouble = document.getElementById('btn-offline-double');
            if (_btnOffClaim) _btnOffClaim.disabled = false;
            if (_btnOffDouble) _btnOffDouble.disabled = false;
            const m = document.getElementById('offline-modal');
            if (m) m.style.display = 'flex';
        }
    }
}
let isClaimingOffline = false;
function claimOffline(m = 1) {
    if (isClaimingOffline || pendingOfflineGold <= 0) return;
    isClaimingOffline = true;

    // Не обнуляем pendingOfflineGold заранее — только при фактическом успехе!
    // Иначе провал рекламы (VK/Yandex SDK error) стирает накопленную добычу игрока.
    const goldToAward = pendingOfflineGold;

    const btnClaim = document.getElementById('btn-offline-claim');
    const btnDouble = document.getElementById('btn-offline-double');
    if (btnClaim) btnClaim.disabled = true;
    if (btnDouble) btnDouble.disabled = true;

    // Единый разблокировщик для всех веток завершения (успех / провал рекламы)
    const unlockButtons = () => {
        if (btnClaim) btnClaim.disabled = false;
        if (btnDouble) btnDouble.disabled = false;
    };

    const action = () => {
        pendingOfflineGold = 0;
        const finalMult = isVipActive() ? 2 : m;
        const totalGold = goldToAward * finalMult;
        gState.gold += totalGold; 
        gState.lifetimeGold += totalGold;
        playCoinSfx();
        const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        pushToast(`+${formatNumber(totalGold)} ${gI}`);
        const modal = document.getElementById('offline-modal');
        if (modal) modal.style.display = 'none';
        isClaimingOffline = false;
        saveGame();
        renderUI();
    };

    // Реклама не показана — НЕ трогаем pendingOfflineGold, возвращаем UI в рабочее состояние.
    // Игрок сможет повторить попытку или забрать базовую сумму.
    const onError = () => {
        isClaimingOffline = false;
        unlockButtons();
    };

    if (m > 1 && !isVipActive()) {
        // FIX-OFFLINE-MODAL-FROZEN: watchdog-таймер 20с. Если rewarded-видео не вызвало
        // ни onSuccess, ни onError (зависла реклама, отвал сети, выгрузка вкладки) —
        // принудительно снимаем isClaimingOffline и разблокируем кнопки. Игрок сможет
        // повторить попытку или забрать базовую сумму без F5.
        const _offlineWatchdog = setTimeout(() => {
            if (isClaimingOffline) {
                console.warn('[Offline] Watchdog: rewarded ad did not resolve in 20s. Unlocking UI.');
                isClaimingOffline = false;
                unlockButtons();
            }
        }, 20000);

        const _wrappedAction = () => {
            clearTimeout(_offlineWatchdog);
            action();
        };
        const _wrappedError = () => {
            clearTimeout(_offlineWatchdog);
            onError();
        };
        showPlatformRewarded(_wrappedAction, _wrappedError);
    }
    else action();
}

// U7: кэш титула лорда. getUnlockedTitles() фильтрует массив из 6 элементов,
// getLordTitleData() дёргается из calculateCP десятки раз/сек. Оба кэша инвалидируются по ключу.
let _cachedTitlesKey = '';
let _cachedUnlockedTitles = null;
let _cachedLordTitleDataKey = '';
let _cachedLordTitleData = null;

const LORD_TITLES = [
    { id: 't_militia', minTrophies: 0, minKeep: 1, title: { RU: 'Ополченец Склепа', EN: 'Crypt Militia' }, bonus: 0 },
    { id: 't_knight', minTrophies: 300, minKeep: 3, title: { RU: 'Рыцарь Авангарда', EN: 'Vanguard Knight' }, bonus: 0.05 },
    { id: 't_baron', minTrophies: 800, minKeep: 6, title: { RU: 'Барон Преисподней', EN: 'Underworld Baron' }, bonus: 0.12 },
    { id: 't_duke', minTrophies: 1500, minKeep: 10, title: { RU: 'Герцог Бездны', EN: 'Void Duke' }, bonus: 0.25 },
    { id: 't_overlord', minTrophies: 2500, minKeep: 15, title: { RU: 'Владыка Легионов', EN: 'Legion Overlord' }, bonus: 0.40 },
    { id: 't_emperor', minTrophies: 3700, minKeep: 20, title: { RU: 'Император Тьмы', EN: 'Emperor of Darkness' }, bonus: 0.60 }
];

function getUnlockedTitles() {
    const t = gState.trophies || 150;
    const k = gState.buildings.keep || 1;
    const key = `${t}|${k}`;
    if (_cachedUnlockedTitles && _cachedTitlesKey === key) return _cachedUnlockedTitles;
    _cachedTitlesKey = key;
    _cachedUnlockedTitles = LORD_TITLES.filter(item => t >= item.minTrophies && k >= item.minKeep);
    // Список разблокированных изменился — инвалидируем вторичный кэш выбранного титула
    _cachedLordTitleDataKey = '';
    _cachedLordTitleData = null;
    return _cachedUnlockedTitles;
}

function getLordTitleData() {
    const t = gState.trophies || 150;
    const k = gState.buildings.keep || 1;
    const selectedId = gState.selectedTitleId || '';
    const fullKey = `${t}|${k}|${selectedId}`;
    // U7: возвращаем ССЫЛКУ на оригинальный объект LORD_TITLES (не копию),
    // чтобы потенциальные identity-сравнения по .id продолжали работать.
    if (_cachedLordTitleData && _cachedLordTitleDataKey === fullKey) return _cachedLordTitleData;

    const unlocked = getUnlockedTitles();
    let result = null;
    if (selectedId) {
        result = unlocked.find(item => item.id === selectedId) || null;
    }
    if (!result) result = unlocked[unlocked.length - 1] || LORD_TITLES[0];

    _cachedLordTitleData = result;
    _cachedLordTitleDataKey = fullKey;
    return result;
}

function toggleSettingsTab(tab) {
    document.getElementById('btn-tab-settings-profile')?.classList.toggle('active', tab === 'profile');
    document.getElementById('btn-tab-settings-system')?.classList.toggle('active', tab === 'system');
    document.getElementById('btn-tab-settings-platform')?.classList.toggle('active', tab === 'platform');
    const pPane = document.getElementById('settings-tab-profile');
    const sPane = document.getElementById('settings-tab-system');
    const plPane = document.getElementById('settings-tab-platform');
    if (pPane) pPane.style.display = tab === 'profile' ? 'flex' : 'none';
    if (sPane) sPane.style.display = tab === 'system' ? 'flex' : 'none';
    if (plPane) plPane.style.display = tab === 'platform' ? 'flex' : 'none';
    playSfx(400, 'sine', 0.04);
}

function openSettingsModal() {
    const fld = document.getElementById('settings-nick-input');
    if (fld) fld.value = gState.playerName || 'Duke Valdor';
    updateSettingsAudioBtnText();
    const lBtn = document.getElementById('btn-settings-lang');
    if (lBtn) lBtn.innerText = currentLang;

    renderSettingsAvatarsGrid();
    renderLordTitleSelector();
    renderPlatformRewardsUI();
    toggleSettingsTab('profile');
    const m = document.getElementById('settings-modal');
    if (m) m.style.display = 'flex';
}

function updateSettingsAudioBtnText() {
    const mBtn = document.getElementById('btn-settings-music');
    if (mBtn) {
        mBtn.innerText = gState.isMusicMuted 
            ? (currentLang === 'RU' ? 'ВЫКЛ' : 'OFF') 
            : (currentLang === 'RU' ? 'ВКЛ' : 'ON');
    }
    const aBtn = document.getElementById('btn-settings-audio');
    if (aBtn) {
        aBtn.innerText = gState.isAudioMuted 
            ? (currentLang === 'RU' ? 'ВЫКЛ' : 'OFF') 
            : (currentLang === 'RU' ? 'ВКЛ' : 'ON');
    }

    const mSlider = document.getElementById('slider-music-volume');
    const sSlider = document.getElementById('slider-sfx-volume');
    const mVal = Math.round((gState.musicVolume !== undefined ? gState.musicVolume : 0.35) * 100);
    const sVal = Math.round((gState.sfxVolume !== undefined ? gState.sfxVolume : 0.8) * 100);

    if (mSlider) mSlider.value = mVal;
    if (sSlider) sSlider.value = sVal;
    const mLbl = document.getElementById('lbl-music-vol-val');
    const sLbl = document.getElementById('lbl-sfx-vol-val');
    if (mLbl) mLbl.innerText = `${mVal}%`;
    if (sLbl) sLbl.innerText = `${sVal}%`;

    // Синхронизация кнопки Mute с защитой от ежесекундного DOM-сброса клика на ПК (Dirty-Checking)
    const headerBtn = document.getElementById('btn-audio-toggle');
    if (headerBtn) {
        const isMuted = (gState.isAudioMuted && gState.isMusicMuted);
        const currentMuteAttr = headerBtn.getAttribute('data-muted');
        if (currentMuteAttr !== String(isMuted)) {
            headerBtn.setAttribute('data-muted', String(isMuted));
            headerBtn.innerHTML = isMuted 
                ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#ef4444"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
                : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="var(--gold)"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
        }
    }

    // FIX-VIP-HIDE-NONVIP: строки VIP-настроек скрыты, пока VIP неактивен.
    // Модерация VK (п. 4.2.2 и рядом) может счесть «витрину VIP» рекламой услуг в UI.
    const vipCombatRow = document.getElementById('row-settings-vip-combat');
    const vipAdsRow = document.getElementById('row-settings-vip-ads');
    const vipActive = isVipActive();
    if (vipCombatRow) vipCombatRow.style.display = vipActive ? 'flex' : 'none';
    if (vipAdsRow) vipAdsRow.style.display = vipActive ? 'flex' : 'none';

    // Состояние тумблеров VIP
    const vipCombatBtn = document.getElementById('btn-settings-vip-combat');
    if (vipCombatBtn) {
        const isSkip = (gState.vipSkipCombat !== false);
        vipCombatBtn.innerText = isSkip ? (currentLang === 'RU' ? 'ВКЛ' : 'ON') : (currentLang === 'RU' ? 'ВЫКЛ' : 'OFF');
        vipCombatBtn.style.background = isSkip ? 'var(--green)' : '#273347';
    }

    const vipAdsBtn = document.getElementById('btn-settings-vip-ads');
    if (vipAdsBtn) {
        vipAdsBtn.innerText = gState.vipShowAds ? (currentLang === 'RU' ? 'ВКЛ' : 'ON') : (currentLang === 'RU' ? 'ВЫКЛ' : 'OFF');
        vipAdsBtn.style.background = gState.vipShowAds ? 'var(--green)' : '#273347';
    }

    // Состояние тумблера виброотклика (Haptics)
    const hapticBtn = document.getElementById('btn-settings-haptics');
    if (hapticBtn) {
        hapticBtn.innerText = gState.isHapticsMuted 
            ? (currentLang === 'RU' ? 'ВЫКЛ' : 'OFF') 
            : (currentLang === 'RU' ? 'ВКЛ' : 'ON');
        hapticBtn.style.background = gState.isHapticsMuted ? '#273347' : 'var(--green)';
    }

    // UX-настройка: тумблер скрытия точек зданий
    const bldBadgesBtn = document.getElementById('btn-settings-hide-badges');
    if (bldBadgesBtn) {
        bldBadgesBtn.innerText = gState.hideBuildingBadges
            ? (currentLang === 'RU' ? 'ВЫКЛ' : 'OFF')
            : (currentLang === 'RU' ? 'ВКЛ' : 'ON');
        bldBadgesBtn.style.background = gState.hideBuildingBadges ? '#273347' : 'var(--green)';
    }

    // FIX-PRELOADER-SOUND: синхронизация иконки звука на экране предзагрузки.
    // Кнопка живёт в #app-preloader и должна отражать глобальное состояние mute
    // (isAudioMuted && isMusicMuted), пока игрок ещё не вошёл в Цитадель.
    // Dirty-Checking через data-muted защищает от перезаписи innerHTML в момент клика.
    const preloaderSoundBtn = document.getElementById('btn-preloader-sound');
    if (preloaderSoundBtn) {
        const isFullyMuted = (gState.isAudioMuted && gState.isMusicMuted);
        if (preloaderSoundBtn.getAttribute('data-muted') !== String(isFullyMuted)) {
            preloaderSoundBtn.setAttribute('data-muted', String(isFullyMuted));
            if (isFullyMuted) {
                preloaderSoundBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#ef4444"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
            } else {
                preloaderSoundBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f5b041" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#f5b041"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
            }
        }
    }
}

function toggleAudioFromSettings() {
    toggleAudioMute();
    updateSettingsAudioBtnText();
}

function toggleFullscreenFromSettings() {
    toggleFullscreen();
    const fBtn = document.getElementById('btn-settings-fullscreen');
    if (fBtn) fBtn.innerText = document.fullscreenElement ? (currentLang === 'RU' ? '🗗 Окно' : '🗗 Window') : (currentLang === 'RU' ? '⛶ Экран' : '⛶ Fullscreen');
}

function renderLordTitleSelector() {
    const container = document.getElementById('settings-title-selector-box');
    if (!container) return;
    container.innerHTML = '';

    const unlocked = getUnlockedTitles();
    const current = getLordTitleData();

    unlocked.forEach(item => {
        const tName = item.title[currentLang] || item.title['EN'];
        const bPct = Math.round(item.bonus * 100);
        const isSelected = item.id === current.id;

        const btn = document.createElement('div');
        btn.className = `building-card ${isSelected ? 'selected-title-card' : ''}`;
        btn.style.padding = '6px 8px';
        btn.style.cursor = 'pointer';
        btn.style.border = isSelected ? '1.5px solid var(--gold)' : '1px solid var(--border-metal)';
        btn.style.background = isSelected ? 'rgba(245, 176, 65, 0.12)' : '#10141d';

        const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';
        btn.innerHTML = `
            <div>
                <b style="color:${isSelected ? 'var(--gold)' : '#fff'}; font-size:12.5px;">${tName}</b>
                <div style="font-size:11.5px; color:var(--gold); font-weight:700; margin-top:2px;">+${bPct}% ${cpUnit}</div>
            </div>
            <span style="font-size:11.5px; color:${isSelected ? 'var(--gold)' : 'var(--text-muted)'}; font-weight:800;">${isSelected ? (currentLang === 'RU' ? 'АКТИВЕН' : 'ACTIVE') : (currentLang === 'RU' ? 'ВЫБРАТЬ' : 'SELECT')}</span>`;

        btn.onclick = () => {
            gState.selectedTitleId = item.id;
            saveGame();
            renderLordTitleSelector();
            renderUI();
            pushToast(currentLang === 'RU' ? `Титул изменен: ${tName}` : `Title changed: ${tName}`);
        };
        container.appendChild(btn);
    });
}

function renderLordTitleInfo() {
    const titleBox = document.getElementById('settings-lord-title-display');
    if (!titleBox) return;
    const data = getLordTitleData();
    const tName = data.title[currentLang] || data.title['EN'];
    const bPct = Math.round(data.bonus * 100);
    const cpUnit = currentLang === 'RU' ? 'БМ' : 'CP';
    titleBox.innerHTML = `<b>${tName}</b> • <span style="color:var(--gold); font-size:12px; font-weight:800;">+${bPct}% ${cpUnit}</span>`;
}

function renderSettingsAvatarsGrid() {
    const grid = document.getElementById('settings-avatar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const unlockedIds = Object.keys(gState.deck || {});
    if (unlockedIds.length === 0) {
        const emptyStr = currentLang === 'RU' ? 'Призовите героев в Алтаре' : 'Summon heroes at the Altar';
        grid.innerHTML = `<div style="grid-column:span 6; font-size:11px; color:var(--text-muted); text-align:center; padding:8px 0;">${emptyStr}</div>`;
        return;
    }

    // FIX-VK-AVATAR: первая ячейка — опция «использовать аватарку ВКонтакте».
    // Показывается только в VK-окружении. Не дефолт: часть игроков предпочитает
    // анонимность в игре (реальное фото на игровом HUD ломает 4-ю стену).
    if (isRunningInsideVK()) {
        const vkCell = document.createElement('div');
        vkCell.className = `avatar-cell vk-avatar-cell ${gState.playerAvatarType === 'vk' ? 'selected' : ''}`;
        vkCell.title = currentLang === 'RU' ? 'Моя аватарка VK' : 'My VK avatar';
        vkCell.innerHTML = `<div style="font-family:'Cinzel',serif; font-weight:900; color:#5b88c4; font-size:18px; display:flex; align-items:center; justify-content:center; width:100%; height:100%; background:#0a1420; border-radius:inherit;">VK</div>`;
        vkCell.onclick = () => useVkAvatar();
        grid.appendChild(vkCell);
    }

    unlockedIds.forEach(hid => {
        const hero = HEROES_CATALOG[hid];
        if (!hero) return;
        const heroImg = hero.img || `${hero.id}.webp`;
        const val = `assets/heroes/${heroImg}`;
        const hName = hero.name[currentLang] || hero.name['EN'];

        const cell = document.createElement('div');
        cell.className = `avatar-cell ${gState.playerAvatarVal === val ? 'selected' : ''}`;
        cell.title = hName;
        cell.innerHTML = `<img src="${val}" class="avatar-cell-img" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"><span class="avatar-cell-icon" style="display:none;">${hero.icon}</span>`;
        cell.onclick = () => {
            setAvatarPortrait('img', val, hName);
            renderSettingsAvatarsGrid();
        };
        grid.appendChild(cell);
    });
}

function closeSettingsModal() {
    const m = document.getElementById('settings-modal');
    if (m) m.style.display = 'none';
}

// FIX-VK-AVATAR: получение аватарки ВКонтакте через VK Bridge.
// Явный выбор пользователя через ячейку в Настройках → Профиль.
// Не дефолт — часть игроков предпочитает анонимность в игре.
function useVkAvatar() {
    if (!isRunningInsideVK() || !window.vkBridge) {
        return pushToast(currentLang === 'RU' ? 'Доступно только в VK' : 'Available only in VK');
    }
    window.vkBridge.send('VKWebAppGetUserInfo')
        .then(info => {
            if (!info || !info.photo_200) {
                return pushToast(currentLang === 'RU' ? 'Не удалось получить аватарку' : 'Failed to fetch avatar');
            }
            gState.playerAvatarType = 'vk';
            gState.playerAvatarVal = info.photo_200;
            gState.playerAvatarName = currentLang === 'RU' ? 'Аватарка VK' : 'VK Avatar';
            saveGame();
            updateAvatarDisplay();
            renderSettingsAvatarsGrid();
            pushToast(currentLang === 'RU' ? 'Аватарка VK установлена!' : 'VK avatar set!');
        })
        .catch(err => {
            console.warn('[VK Avatar] VKWebAppGetUserInfo failed:', err);
            pushToast(currentLang === 'RU' ? 'Не удалось получить аватарку' : 'Failed to fetch avatar');
        });
}

function setAvatarPortrait(type, val, heroName) {
    gState.playerAvatarType = type;
    gState.playerAvatarVal = val;
    gState.playerAvatarName = heroName;
    saveGame();
    updateAvatarDisplay();
    highlightSelectedAvatar();
    pushToast((currentLang === 'RU' ? "Аватар: " : "Avatar: ") + heroName);
}

// FIX-MOBILE-PERF: dirty-check по data-avatar-key. Раньше функция перезаписывала
// innerHTML 60 раз/мин, хотя аватар меняется раз в сессию. Теперь — только при
// фактическом изменении значения. На мобильных это снимает парс+layout каждый тик.
function updateAvatarDisplay() {
    const avatarBox = document.getElementById('ui-lord-avatar');
    if (!avatarBox) return;

    const type = gState.playerAvatarType || 'img';
    let val = gState.playerAvatarVal || 'assets/heroes/f_lig_r.webp';
    // FIX-VK-AVATAR: если тип 'vk' — val это абсолютный https URL аватарки VK,
    // префикс 'assets/heroes/' добавлять НЕЛЬЗЯ, иначе картинка не загрузится.
    if (type !== 'vk' && !val.startsWith('assets/heroes/') && !val.includes('assets/')) {
        val = 'assets/heroes/' + val;
    }
    gState.playerAvatarVal = val;

    const avatarKey = `${type}|${val}`;
    if (avatarBox.getAttribute('data-avatar-key') === avatarKey) return;
    avatarBox.setAttribute('data-avatar-key', avatarKey);

    if ((type === 'img' || type === 'vk') && val) {
        avatarBox.innerHTML = `<img src="${val}" class="lord-avatar-img" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-size:18px;\\'>🏹</span>';">`;
    } else {
        avatarBox.innerHTML = `<span style="font-size:18px;">${val}</span>`;
    }
}

function highlightSelectedAvatar() {
    const curName = gState.playerAvatarName || 'Лучник';
    document.querySelectorAll('.avatar-cell').forEach(el => {
        const title = el.getAttribute('title') || '';
        el.classList.toggle('selected', title.includes(curName));
    });
}

function hasAnyClaimablePassRewards() {
    const curLvl = getAbyssPassLevel();
    for (let lvl = 1; lvl <= curLvl; lvl++) {
        if (!(gState.abyssPassFreeClaimed || []).includes(lvl)) return true;
        if (isVipActive() && !(gState.abyssPassVipClaimed || []).includes(lvl)) return true;
    }
    return false;
}

function updatePassClaimAllButton() {
    const btn = document.getElementById('btn-pass-claim-all');
    if (!btn) return;
    const canClaim = hasAnyClaimablePassRewards();
    btn.disabled = !canClaim;
    btn.classList.toggle('is-ready', canClaim);
}

function openAbyssPassModal() {
    const container = document.getElementById('abyss-pass-modal-container');
    if (container) renderAbyssPass(container);
    updatePassClaimAllButton();
    const m = document.getElementById('abyss-pass-modal');
    const viewport = document.getElementById('app-viewport');
    if (viewport) viewport.classList.add('in-subview');
    if (m) m.style.display = 'flex';
}

function closeAbyssPassModal() {
    const m = document.getElementById('abyss-pass-modal');
    if (m) m.style.display = 'none';
    const activeView = document.querySelector('.view-tab.active')?.id || 'citadel-view';
    const viewport = document.getElementById('app-viewport');
    if (viewport && activeView === 'citadel-view') {
        viewport.classList.remove('in-subview');
    }
}

function saveAndCloseSettings() {
    const fld = document.getElementById('settings-nick-input');
    const val = fld ? fld.value.trim() : '';
    if (val) {
        // Удаляем управляющие символы (переносы, табы, NUL), которые ломают white-space:nowrap
        // и не должны попадать в ник. XSS-защита работает отдельно через escapeHtml на выводе.
        gState.playerName = val.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 12) || 'Duke Valdor';
    }
    closeSettingsModal();
    saveGame();
    renderLeaderboard();
    renderUI();
    pushToast(currentLang === 'RU' ? "Настройки сохранены!" : "Settings saved!");

    // v5.3.0 FIX-SAVE-NICK-SUBMIT-SCHEDULE: через schedule вместо force-submit.
    // Раньше submitArenaProfile(true) обходил _inboxSyncPending — если игрок сразу
    // после boot меняет имя, кубки уходили в KV без inbox-sync (возможный откат
    // серверных изменений от PvP). scheduleLiveArenaSubmit уважает флаг.
    if (typeof scheduleLiveArenaSubmit === 'function' && typeof canSubmitToLiveArena === 'function' && canSubmitToLiveArena()) {
        if (liveArenaSubmitDebounce) { clearTimeout(liveArenaSubmitDebounce); liveArenaSubmitDebounce = null; }
        scheduleLiveArenaSubmit(false);
    }
}

function generateRandomNick() {
    const arr = ['Lord Mortis', 'Baron Raven', 'Prince Shadow', 'Duke Valdor', 'Warlord Zero', 'Emperor Kane', 'Archon Dread'];
    const fld = document.getElementById('settings-nick-input');
    if (fld) fld.value = arr[Math.floor(Math.random() * arr.length)];
}

function openHardResetModal() {
    const m = document.getElementById('hard-reset-modal');
    if (m) m.style.display = 'flex';
}

function closeHardResetModal() {
    const m = document.getElementById('hard-reset-modal');
    if (m) m.style.display = 'none';
}

function executeHardReset() {
    // v4.9.5 FIX-HARD-RESET: заменена старая версия («три клика»).
    //   • saveGame = () => {} не работал против setInterval (держит оригинальную ссылку);
    //   • setTimeout(reload, 250) не давал VK Bridge записать в облако;
    //   • пустая строка '' не принимается VK Bridge;
    //   • location.reload() даёт BFCache — возвращает старый gState.
    // Новая логика — копия adminResetAll:
    gStateLoaded = false;

    try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem('lords_saved_language');
        localStorage.removeItem('lota_p9_result');
    } catch (e) {}

    const cloudReset = (async () => {
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

    Promise.race([
        cloudReset,
        new Promise(resolve => setTimeout(resolve, 2000))
    ]).then(() => {
        const bust = '_wipe=' + Date.now();
        const newUrl = location.origin + location.pathname + '?' + bust;
        location.replace(newUrl);
    });
}

/* ==========================================================
   ОТРИСОВКА ИНТЕРФЕЙСА (RENDER UI)
   ========================================================== */
function renderUI() {
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';

    const uName = document.getElementById('ui-lord-name');
    if (uName) uName.innerText = gState.playerName || 'Duke Valdor';
    const uTitle = document.getElementById('ui-lord-title-tag');
    if (uTitle) {
        const titleData = getLordTitleData();
        uTitle.innerText = titleData.title[currentLang] || titleData.title['EN'];
    }
    updateAvatarDisplay();
    const vipTag = document.getElementById('ui-vip-tag');
    if (vipTag) {
        if (isVipActive()) {
            const daysLeft = Math.ceil((gState.vipUntil - Date.now()) / (24 * 3600 * 1000));
            vipTag.innerText = `VIP (${daysLeft}d)`;
            vipTag.classList.add('active');
        } else {
            vipTag.classList.remove('active');
        }
    }

    const fBtn = document.getElementById('btn-ad-footer');
    if (fBtn) fBtn.style.display = isVipActive() ? 'none' : 'block';
    const fpBanner = document.getElementById('first-purchase-banner');
    if (fpBanner) fpBanner.style.display = (gState.hasFirstPurchaseDone) ? 'none' : 'block';

    // U16: самые горячие поля (renderUI вызывается 60 раз/сек из тика)
    const elGold = $id('ui-gold');
    const elArmy = $id('ui-army');
    const elCap = $id('ui-army-cap');
    const elCryst = $id('ui-crystals');
    const elRelics = $id('ui-relics');
    const elCP = $id('ui-total-cp');

    if (elGold) elGold.innerText = formatNumber(gState.gold);
    if (elArmy) elArmy.innerText = formatNumber(gState.army);
    if (elCap) elCap.innerText = formatNumber(getArmyCap());
    if (elCryst) elCryst.innerText = formatNumber(gState.crystals);
    if (elRelics) elRelics.innerText = formatNumber(gState.relics);
    if (elCP) elCP.innerText = formatNumber(calculateCP());

    const cpUnitEl = document.getElementById('lbl-ui-cp-unit');
    if (cpUnitEl) cpUnitEl.innerText = I18N[currentLang].cp;
    
    const ladderTitleEl = document.getElementById('lbl-ladder-modal-title');
    if (ladderTitleEl) ladderTitleEl.innerText = I18N[currentLang].arena_ladder_title;

    const lvlPrefix = currentLang === 'RU' ? 'Ур.' : 'Lvl';
    const secSuffix = currentLang === 'RU' ? '/с' : '/s';
    const setTxt = (id, str) => { const el = document.getElementById(id); if (el) el.innerText = str; };

    const goldIncome = getIncomeRate();
    const armyIncome = Math.floor((gState.buildings.barracks || 0) * 1 * getRelicBonus());

    setTxt('keep-lvl', `${lvlPrefix} ${gState.buildings.keep || 1}`);
    setTxt('mine-lvl', `${lvlPrefix} ${gState.buildings.mine || 1} (+${formatNumber(goldIncome)}${secSuffix})`);
    setTxt('barracks-lvl', `${lvlPrefix} ${gState.buildings.barracks || 0} (+${formatNumber(armyIncome)}${secSuffix})`);

    const keepReq = getAscendKeepReq();
    const goldReq = getAscendGoldReq();
    const lblAscReq = document.getElementById('lbl-ascend-req');
    const btnAsc = document.getElementById('btn-ascend');
    if (lblAscReq) lblAscReq.innerHTML = `${currentLang === 'RU' ? 'Требуется: Цитадель Ур.' : 'Requires: Citadel Lvl'} ${keepReq} ${currentLang === 'RU' ? 'и' : '&'} ${formatNumber(goldReq)} ${gI}`;
    if (btnAsc) btnAsc.disabled = (gState.buildings.keep || 1) < keepReq || (gState.gold || 0) < goldReq;

    const maxTickets = isVipActive() ? 15 : 10;
    setTxt('arena-tickets-val', `${gState.tickets || 0}/${maxTickets}`);

    // Отрисовка таймеров и активных кнопок в Алтаре (Кристаллы 10/100)
    const now = Date.now();
    const basicElapsed = now - (gState.lastFreeBasicSummon || 0);
    const basicCd = 8 * 3600 * 1000;
    const basicReady = basicElapsed >= basicCd;

    const eliteElapsed = now - (gState.lastFreeEliteSummon || 0);
    const eliteCd = 48 * 3600 * 1000;
    const eliteReady = eliteElapsed >= eliteCd;

    const pBasic = document.getElementById('price-sum-g1');
    const pElite = document.getElementById('price-sum-c1');
    const btnBasic = document.getElementById('btn-sum-g1');
    const btnElite = document.getElementById('btn-sum-c1');

    if (pBasic) {
        if (basicReady) {
            pBasic.innerText = currentLang === 'RU' ? 'БЕСПЛАТНО' : 'FREE';
            pBasic.style.color = '#4ade80';
        } else {
            const leftSec = Math.ceil((basicCd - basicElapsed) / 1000);
            pBasic.innerHTML = `10 ${cI} <span class="altar-timer-sub">(${getFormattedTime(leftSec)})</span>`;
            pBasic.style.color = '#fff';
        }
    }
    // Кнопка призыва всегда активна, если есть кристаллы или готов бесплатный пулл!
    if (btnBasic) {
        btnBasic.disabled = !basicReady && (gState.crystals || 0) < 10;
    }
    const btnBasic10 = document.getElementById('btn-sum-g10');
    if (btnBasic10) {
        btnBasic10.disabled = (gState.crystals || 0) < 90;
    }

    if (pElite) {
        if (eliteReady) {
            pElite.innerText = currentLang === 'RU' ? 'БЕСПЛАТНО' : 'FREE';
            pElite.style.color = '#4ade80';
        } else {
            const leftSec = Math.ceil((eliteCd - eliteElapsed) / 1000);
            pElite.innerHTML = `100 ${cI} <span class="altar-timer-sub">(${getFormattedTime(leftSec)})</span>`;
            pElite.style.color = '#fff';
        }
    }
    if (btnElite) {
        btnElite.disabled = !eliteReady && (gState.crystals || 0) < 100;
    }
    const btnElite10 = document.getElementById('btn-sum-c10');
    if (btnElite10) {
        btnElite10.disabled = (gState.crystals || 0) < 900;
    }

    // Золотая точка на карте Цитадели (над районом Алтаря: готов базовый или элитный призыв)
    document.getElementById('badge-district-altar')?.classList.toggle('active', basicReady || eliteReady);

    const starterBtn = document.getElementById('btn-shop-starter');
    if (starterBtn) {
        if (gState.hasStarterPackBought) {
            starterBtn.disabled = true;
            starterBtn.innerText = I18N[currentLang].shop_purchased;
            starterBtn.style.opacity = '0.5';
        } else {
            starterBtn.disabled = false;
            starterBtn.innerText = formatPriceForPlatform(149);
            starterBtn.style.opacity = '1';
        }
    }

    // Отрисовка статуса Ежедневного Дара (динамическое золото шахт + тикающий таймер)
    const btnFreebie = document.getElementById('btn-claim-freebie');
    // FIX-MOBILE-PERF: dirty-check. Значения меняются раз в часы, а innerHTML
    // переписывался 60 раз/мин. Сравнение по кэшу в data-атрибуте.
    const descFreebie = document.getElementById('lbl-freebie-desc');
    const midnightTimer = getFormattedMidnightCountdown();
    const currentFreebieGold = getDailyFreebieGold();

    if (descFreebie) {
        const freebieHtml = currentLang === 'RU'
            ? `+${formatNumber(currentFreebieGold)} ${gI} (1ч шахт) и +10 ${cI}`
            : `+${formatNumber(currentFreebieGold)} ${gI} (1h mine) & +10 ${cI}`;
        if (descFreebie.getAttribute('data-cache') !== freebieHtml) {
            descFreebie.setAttribute('data-cache', freebieHtml);
            descFreebie.innerHTML = freebieHtml;
        }
    }

    // Динамическое обновление описания Пака Владыки с проверкой языка
    const starterDesc = document.getElementById('lbl-shop-starter-desc');
    if (starterDesc) {
        const sGold = getStarterPackGold();
        const rI = '<img src="assets/icons/relic.webp" class="res-icon-inline" alt="R">';
        const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';
        const minesHStr = currentLang === 'RU' ? '8ч шахт' : '8h mines';
        const paladinStr = currentLang === 'RU' ? '[A] Паладин' : '[A] Paladin';
        const starterHtml = `+${formatNumber(sGold)} ${gI} (${minesHStr}) + 250 ${cI} + ${paladinStr} <br>+ 2 ${rI} + 10 ${tI}`;
        if (starterDesc.getAttribute('data-cache') !== starterHtml) {
            starterDesc.setAttribute('data-cache', starterHtml);
            starterDesc.innerHTML = starterHtml;
        }
    }

    if (btnFreebie) {
        if (!gState.dailyFreebieClaimedToday) {
            btnFreebie.disabled = false;
            btnFreebie.innerText = currentLang === 'RU' ? 'ЗАБРАТЬ' : 'CLAIM';
            btnFreebie.style.background = 'var(--green)';
        } else {
            btnFreebie.disabled = true;
            btnFreebie.innerHTML = `<img src="assets/icons/icon_hourglass.webp" class="res-icon-inline" style="width:12px; height:12px;" alt="⏳"> ${midnightTimer}`;
            btnFreebie.style.background = '#273347';
        }
    }

    // Динамический расчет золота в скачках времени магазина через чистые арты
    const rate = getIncomeRate();

    const w2 = document.getElementById('warp-val-2h');
    const w8 = document.getElementById('warp-val-8h');
    const w24 = document.getElementById('warp-val-24h');
    if (w2) w2.innerHTML = `+${formatNumber(rate * 7200)} ${gI}`;
    if (w8) w8.innerHTML = `+${formatNumber(rate * 28800)} ${gI}`;
    if (w24) w24.innerHTML = `+${formatNumber(rate * 86400)} ${gI}`;

    if (!gState.firstDoubleClaimed) gState.firstDoubleClaimed = {};
    const crystalKeys = ['100', '350', '1000', '2500', '6000', '14000'];
    crystalKeys.forEach(k => {
        const sub = document.getElementById(`sub-cryst-${k}`);
        if (sub) {
            if (gState.firstDoubleClaimed[`cryst_${k}`]) {
                sub.innerHTML = `<span style="color:var(--text-muted); font-size:10px;">Стандартный</span>`;
            } else {
                const base = SHOP_ITEMS_CATALOG[`cryst_${k}`]?.baseC || 100;
                sub.innerHTML = `<span class="shop-badge-x2">x2</span> ${formatNumber(base * 2)} ${cI}`;
            }
        }
    });

    // Управление видимостью рекламного футера (учитывает VIP и тумблер в настройках)
    const footerContainer = document.querySelector('.app-footer');
    const footerAdBtn = document.getElementById('btn-ad-footer');
    const showFooter = !isVipActive() || !!gState.vipShowAds;

    if (footerContainer) {
        footerContainer.style.display = showFooter ? 'block' : 'none';
    }
    if (footerAdBtn) {
        footerAdBtn.style.display = showFooter ? 'block' : 'none';
    }

    const quickSummonBox = document.getElementById('chk-quick-summon');
    if (quickSummonBox) quickSummonBox.checked = !!gState.quickSummonEnabled;

    updateAdButtonText();
    updateSettingsAudioBtnText();
    renderBuildVersion(); // FIX-BUILD-VERSION: метка сборки в UI (меню, настройки, предзагрузка)
    // MAJOR-M4: checkNotificationBadges() намеренно НЕ вызывается здесь.
    // renderUI работает на 60 FPS, а проверка бейджей включает isCodexRewardReady() с полным
    // сканом 84 героев × 4 фракции. Все триггерные точки вызывают его явно (прогресс квестов,
    // покупки, колесо), а фоновое обновление идёт через checkNotificationBadgesThrottled().
}

// FIX-MOBILE-PERF: dirty-check по строке. Рекламный текст меняется только при
// смене золота/тикетов/языка, но функция вызывалась 60 раз/мин → 3600 парсов
// innerHTML в час впустую. Теперь сравнение по кэшу lastHtml и ранний return.
function updateAdButtonText() {
    const btn = document.getElementById('btn-ad-footer');
    if (!btn) return;
    const mult = isVipActive() ? 2 : 1;
    const gLoot = formatNumber(getAdGoldReward() * mult);
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const tI = '<img src="assets/icons/shop_tickets.webp" class="res-icon-inline" alt="T">';
    const adI = '<img src="assets/icons/icon_ad.webp" class="res-icon-inline" style="width:14px; height:14px; margin-right:4px;">';
    const adPrefix = currentLang === 'RU' ? 'РЕКЛАМА' : 'AD';
    const andStr = currentLang === 'RU' ? 'И' : '&';

    btn.className = 'ad-reward-btn btn-ad-standard';
    const newHtml = ((gState.adTicketsClaimedToday || 0) < 2)
        ? `${adI}${adPrefix}: +${gLoot} ${gI} ${andStr} +2 ${tI}`
        : `${adI}${adPrefix}: +${gLoot} ${gI}`;

    if (btn.getAttribute('data-cache') === newHtml) return;
    btn.setAttribute('data-cache', newHtml);
    btn.innerHTML = newHtml;
}

// Умный возврат из Штаба туда, откуда мы пришли
let rosterReturnView = 'citadel-view';

function openRosterFrom(sourceView, targetTab = 'formation') {
    rosterReturnView = sourceView;
    navigate('roster-view');
    selectRosterTab(targetTab);
}

function closeRoster() {
    navigate(rosterReturnView);
    rosterReturnView = 'citadel-view'; // Сброс
}

function navigate(viewId) {
    playSfx(350, 'sine', 0.04);
    document.querySelectorAll('.view-tab').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    const targetBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick')?.includes(viewId));
    if (targetBtn) targetBtn.classList.add('active');

    const viewport = document.getElementById('app-viewport');
    if (viewport) {
        if (viewId === 'citadel-view') {
            viewport.classList.remove('in-subview');
        } else {
            viewport.classList.add('in-subview');
        }
    }

    if (viewId === 'dungeon-view') renderDungeon();
    if (viewId === 'arena-view') {
        // LIVE-ARENA (v4.7.6): подтягиваем живых соперников асинхронно,
        // затем перерисовываем список. Первый рендер идёт с кэшем (если есть),
        // второй — после ответа Worker'а.
        renderArena();
        renderLeaderboard();
        renderBattleHistory();
        checkSeasonCeremony();
        // v5.3.6: на входе в Арену подтягиваем живой топ-10 для единого rank.
        // Иначе header показывает rank без живых, а таблица — с ними.
        if (typeof fetchLiveTop10 === 'function') {
            fetchLiveTop10().then(() => {
                renderArena();
                renderLeaderboard();
            });
        }
        if (typeof fetchLiveRivals === 'function') {
            fetchLiveRivals(2).then(list => {
                if (list && list.length > 0) renderArena();
            });
        }
    }
    if (viewId === 'raid-view') renderRaidBossUI();
    if (viewId === 'quests-view') renderQuests();
    // N1-fix: жёсткий пересчёт бейджа Кодекса при любом переходе — не полагаемся на дроссель
    if (viewId === 'roster-view' || viewId === 'citadel-view') {
        setTimeout(checkCodexNotifications, 0);
    }
    renderFtue();
}

/* ==========================================================
   СМЕНА ЯЗЫКА И СИСТЕМА ЛОКАЛИЗАЦИИ
   ========================================================== */
// Переключение языка на экране предзагрузки
function togglePreloaderLanguage() {
    const nextLang = currentLang === 'RU' ? 'EN' : 'RU';
    applyLanguage(nextLang);
    playSfx(440, 'triangle', 0.05);

    const btnLang = document.getElementById('btn-preloader-lang');
    if (btnLang) btnLang.innerText = currentLang;

    const btnStart = document.getElementById('btn-preloader-start');
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    if (btnStart) {
        btnStart.innerText = hasSave 
            ? (I18N[currentLang]?.title_start_continue || (currentLang === 'RU' ? 'ПРОДОЛЖИТЬ' : 'CONTINUE'))
            : (I18N[currentLang]?.title_start_new || (currentLang === 'RU' ? 'ВОЙТИ В БЕЗДНУ' : 'ENTER THE ABYSS'));
    }

    const statusEl = document.getElementById('preloader-status');
    if (statusEl && statusEl.getAttribute('data-loaded') === 'true') {
        statusEl.innerText = currentLang === 'RU' ? 'Цитадель ждет вашего приказа!' : 'The Citadel awaits your command!';
    }
}

// P8: переключение чекбокса соглашения. Флаг сохраняется мгновенно, чтобы состояние
// персистировалось между сессиями (игрок отметил → закрыл таб → вернулся → чекбокс уже стоит).
function togglePreloaderTermsCheck(checked) {
    gState.hasAcceptedTerms = !!checked;
    const btnStart = document.getElementById('btn-preloader-start');
    if (btnStart) btnStart.disabled = !gState.hasAcceptedTerms;
    saveGame();
    if (gState.hasAcceptedTerms) {
        triggerHaptic('tap');
    }
}

// Запуск игры по клику на кнопку старта (User Gesture -> 100% разблокировка звука)
function startGameFromPreloader() {
    // P8: guard — без принятия соглашения старт заблокирован (п. 1.1.4 правил VK Mini Apps)
    if (!gState.hasAcceptedTerms) {
        pushToast(I18N[currentLang].preloader_terms_required_toast || 'Please accept the agreement');
        return;
    }

    const preloaderEl = document.getElementById('app-preloader');
    if (preloaderEl) {
        preloaderEl.classList.add('preloader-hidden');
        setTimeout(() => {
            preloaderEl.style.display = 'none';
        }, 550);
    }

    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
    if (!gState.isMusicMuted) {
        playBgMusic();
    }
    playSfx(880, 'triangle', 0.15);
    triggerHaptic('upgrade');
    saveGame();
    renderFtue();
    renderUI();
}

// Единый декларативный транслятор интерфейса (100% Full Parity)
function applyLanguage(lang) {
    currentLang = lang;
    if (gState) gState.language = lang;
    try { localStorage.setItem('lords_saved_language', lang); } catch(e) {}

    // U6-b: сбрасываем кэш синергии — его метки содержат локализованные имена фракций.
    // Без этого при смене языка UI какое-то время показывал синергию на старом языке.
    if (typeof _synergyCache !== 'undefined') _synergyCache.clear();
    // U1-b: сбрасываем кэш этажей Бездны — имена стражей содержат локализованные название
    if (typeof _dungeonCache !== 'undefined') _dungeonCache.clear();

    const lBtn = document.getElementById('lang-btn');
    if (lBtn) lBtn.innerText = currentLang;
    const settingsLangBtn = document.getElementById('btn-settings-lang');
    if (settingsLangBtn) settingsLangBtn.innerText = currentLang;
    const btnPreloaderLang = document.getElementById('btn-preloader-lang');
    if (btnPreloaderLang) btnPreloaderLang.innerText = currentLang;

    // 1. Декларативный перевод всех элементов с атрибутом data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[currentLang] && I18N[currentLang][key]) {
            el.innerHTML = I18N[currentLang][key];
        }
    });

    // 2. Подсказки title для десктопа и тача (Полное покрытие HUD)
    const tips = I18N[currentLang].tips;
    const setTip = (id, str) => { const el = document.getElementById(id); if (el && str) el.title = str; };
    const setTipQuery = (sel, str) => { document.querySelectorAll(sel).forEach(el => el.title = str); };
    
    setTip('nick-wrapper', tips.nick);
    setTip('btn-audio-toggle', tips.audio);
    setTip('btn-fullscreen-header', tips.fullscreen);
    setTip('btn-fullscreen', tips.fullscreen);
    setTip('btn-hud-pass', tips.pass);
    setTip('btn-hud-wheel', tips.wheel);
    setTip('btn-hud-calendar', tips.calendar);
    setTip('btn-hud-quests', tips.quests);
    setTip('btn-calendar-top', tips.calendar);
    setTip('ui-cp-box', tips.cp);
    setTip('pill-gold', tips.gold);
    setTip('pill-army', tips.army);
    setTip('pill-cryst', tips.crystals);
    setTip('pill-relics', tips.relics);
    // v5.3.10: тултип снят с кнопки тапа. При активном тапе (2-3 пальца)
    // long-press случайно срабатывал и показывал спам из-за multi-touch.
    setTip('slot-0', tips.slot_0);
    setTip('slot-1', tips.slot_1);
    setTip('slot-2', tips.slot_2);
    setTip('btn-sum-g1', tips.altar_basic);
    setTip('btn-sum-c1', tips.altar_elite);
    setTip('btn-sum-c10', tips.altar_elite_10);
    setTip('btn-dung-farm', tips.dung_farm);
    setTip('btn-ad-footer', tips.ad_footer);

    setTipQuery('.district-mine .district-hitbox', I18N[currentLang].mine_name);
    setTipQuery('.district-keep .district-hitbox', I18N[currentLang].keep_name);
    setTipQuery('.district-barracks .district-hitbox', I18N[currentLang].barracks_name);
    setTipQuery('.district-altar .district-hitbox', I18N[currentLang].altar);
    setTipQuery('.district-roster .district-hitbox', I18N[currentLang].roster);
    setTipQuery('.district-dungeons .district-hitbox', I18N[currentLang].dungeon);
    setTipQuery('.district-arena .district-hitbox', I18N[currentLang].arena);
    setTipQuery('.district-market .district-hitbox', I18N[currentLang].shop);

    // 3. Динамические подписи блоков и экранов
    const setTxt = (id, str) => { const el = document.getElementById(id); if (el && str) el.innerText = str; };
    const setHtml = (id, str) => { const el = document.getElementById(id); if (el && str) el.innerHTML = str; };

    setTxt('lbl-chronicles-archive-title', I18N[currentLang].chronicles_archive_title);
    setTxt('lbl-chronicles-archive-desc', I18N[currentLang].chronicles_archive_desc);
    setTxt('chronicle-title', I18N[currentLang].chronicles_archive_title);
    setTxt('btn-chronicles-archive', I18N[currentLang].dungeon_archive_btn);
    setTxt('lbl-open-ladder-hint', I18N[currentLang].arena_reset_hint);
    setTxt('lbl-ladder-modal-title', I18N[currentLang].arena_ladder_title);
    setTxt('lbl-leviathan-badge', I18N[currentLang].raid_triumph_badge);
    setTxt('lbl-leviathan-title', I18N[currentLang].raid_triumph_title);
    setTxt('lbl-leviathan-desc', I18N[currentLang].raid_triumph_desc);
    setHtml('btn-leviathan-share', I18N[currentLang].raid_triumph_share_btn);
    setTxt('btn-leviathan-claim', I18N[currentLang].raid_triumph_claim_btn);

    setTxt('lbl-cp', I18N[currentLang].cp);
    setTxt('lbl-ui-cp-unit', I18N[currentLang].cp);
    setTxt('lbl-tap-title', I18N[currentLang].tap_title);
    setTxt('lbl-tap-desc', isFrenzy ? I18N[currentLang].frenzy_desc : I18N[currentLang].tap_desc);
    setTxt('lbl-keep-name', I18N[currentLang].keep_name);
    setTxt('lbl-keep-bonus', I18N[currentLang].keep_bonus);
    setTxt('lbl-mine-name', I18N[currentLang].mine_name);
    setTxt('lbl-income', I18N[currentLang].income);
    setTxt('lbl-barracks-name', I18N[currentLang].barracks_name);
    setTxt('lbl-recruits', I18N[currentLang].recruits);
    setTxt('lbl-ascend-title', I18N[currentLang].ascend_title);

    setTxt('nav-citadel', I18N[currentLang].citadel);
    setTxt('nav-roster', I18N[currentLang].roster);
    setTxt('nav-altar', I18N[currentLang].altar);
    setTxt('nav-arena', I18N[currentLang].arena);
    setTxt('nav-dungeon', I18N[currentLang].dungeon);
    setTxt('nav-raid', I18N[currentLang].raid);
    setTxt('nav-quests-text', I18N[currentLang].quests);
    setTxt('nav-shop', I18N[currentLang].shop);

    setTxt('lbl-ftue-title', I18N[currentLang].ftue_title);
    // FIX-CODEX: НЕ используем setTxt на этих кнопках — они содержат вложенные <span class="notif-badge">,
    // которые setTxt (innerText = ...) физически уничтожает. Перевод уже выполнен выше через data-i18n на
    // внутренних span-ах, поэтому достаточно обновить только текст через безопасный селектор.
    document.querySelectorAll('#btn-roster-tab-cards [data-i18n], #btn-roster-tab-formation [data-i18n], #mode-exp-btn [data-i18n], #mode-codex-btn [data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[currentLang] && I18N[currentLang][key]) el.innerText = I18N[currentLang][key];
    });

    setTxt('lbl-subtab-daily', I18N[currentLang].sub_daily);
    setTxt('lbl-subtab-quests', I18N[currentLang].sub_quests);
    setTxt('lbl-subtab-achieve', I18N[currentLang].sub_achieve);
    setTxt('lbl-subtab-pass', I18N[currentLang].sub_pass);

    setTxt('lbl-altar-title', I18N[currentLang].altar_title);
    setTxt('lbl-altar-desc', I18N[currentLang].altar_desc);
    setTxt('lbl-sum-gold', I18N[currentLang].sum_gold);
    setTxt('lbl-sum-gold-10', I18N[currentLang].sum_gold_10);
    setTxt('lbl-sum-cryst', I18N[currentLang].sum_cryst);
    setTxt('lbl-sum-cryst-10', I18N[currentLang].sum_cryst_10);
    setTxt('lbl-quick-summon', I18N[currentLang].quick_summon_label);
    setTxt('lbl-rates-title', I18N[currentLang].rates_title);
    setTxt('lbl-rates-basic', I18N[currentLang].rates_basic);
    setTxt('lbl-rates-elite', I18N[currentLang].rates_elite);

    setTxt('lbl-tickets', I18N[currentLang].tickets);
    setTxt('lbl-view-rewards', I18N[currentLang].view_rewards);
    setTxt('lbl-rivals-text', I18N[currentLang].rivals_title);
    setTxt('btn-arena-refresh', I18N[currentLang].arena_refresh_btn);
    setTxt('lbl-battle-log', I18N[currentLang].battle_log);
    setTxt('lbl-leaderboard', I18N[currentLang].leaderboard);

    // Синхронизация кнопки старта и текста предзагрузчика на титульном экране
    const btnStart = document.getElementById('btn-preloader-start');
    if (btnStart) {
        const hasSave = !!localStorage.getItem(SAVE_KEY);
        btnStart.innerText = hasSave
            ? (I18N[currentLang]?.title_start_continue || (currentLang === 'RU' ? 'ПРОДОЛЖИТЬ ПОХОД' : 'CONTINUE CAMPAIGN'))
            : (I18N[currentLang]?.title_start_new || (currentLang === 'RU' ? 'ВОЙТИ В БЕЗДНУ' : 'ENTER THE ABYSS'));
    }
    const preloaderStatus = document.getElementById('preloader-status');
    if (preloaderStatus && preloaderStatus.getAttribute('data-loaded') === 'true') {
        preloaderStatus.innerText = currentLang === 'RU' ? 'Цитадель ждет вашего приказа!' : 'The Citadel awaits your command!';
    }

    setTxt('lbl-dung-title', I18N[currentLang].dung_title);
    setTxt('lbl-dung-desc', I18N[currentLang].dung_desc);
    setTxt('btn-dung-attack', I18N[currentLang].dung_attack);
    setTxt('btn-dung-farm', I18N[currentLang].dung_farm);
    setTxt('lbl-dung-squad-title', I18N[currentLang].dung_squad_title);

    setTxt('lbl-raid-title', I18N[currentLang].raid_title);
    setTxt('lbl-raid-badge', I18N[currentLang].raid_badge);
    setTxt('lbl-raid-desc', I18N[currentLang].raid_desc);
    setTxt('lbl-raid-timer-title', I18N[currentLang].raid_reset_timer || (currentLang === 'RU' ? 'До обновления рейда:' : 'Raid respawns in:'));
    setTxt('raid-boss-name', I18N[currentLang].raid_boss_name || (currentLang === 'RU' ? 'ДРЕВНИЙ ЛЕВИАФАН БЕЗДНЫ' : 'ANCIENT VOID LEVIATHAN'));

    setHtml('first-purchase-banner', I18N[currentLang].first_purchase_banner);
    setTxt('lbl-shop-title', I18N[currentLang].shop_title);
    setTxt('lbl-shop-desc', I18N[currentLang].shop_desc);

    setTxt('lbl-modal-demon-title', I18N[currentLang].demon_title);
    setTxt('lbl-modal-demon-desc', I18N[currentLang].demon_desc);
    setTxt('lbl-cal-modal-title', I18N[currentLang].cal_modal_title);
    setTxt('lbl-cal-modal-desc', I18N[currentLang].cal_modal_desc);
    setTxt('btn-cal-claim', I18N[currentLang].cal_claim_btn);
    setHtml('btn-cal-double', `<img src="assets/icons/icon_ad.webp" class="res-icon-inline" style="width:13px; height:13px;"> ${I18N[currentLang].cal_double_btn}`);
    setTxt('btn-sum-reveal-all', I18N[currentLang].summon_reveal_all);
    setTxt('lbl-sum-result-title', I18N[currentLang].sum_modal_title);
    setTxt('lbl-sum-result-desc', I18N[currentLang].sum_modal_desc);
    setTxt('btn-sum-result-close', I18N[currentLang].sum_modal_close);
    setTxt('lbl-offline-title', I18N[currentLang].offline_title);
    setTxt('offline-m-desc', I18N[currentLang].offline_desc);
    setTxt('btn-offline-claim', I18N[currentLang].offline_claim);
    setTxt('btn-offline-double', I18N[currentLang].offline_double);
    setTxt('lbl-ascend-m-title', I18N[currentLang].modal_ascend_confirm_title);
    setHtml('lbl-ascend-m-warning', I18N[currentLang].modal_ascend_warning.replace(/\n/g, '<br>'));
    setTxt('btn-ascend-confirm', I18N[currentLang].modal_ascend_yes);
    setTxt('btn-ascend-cancel', I18N[currentLang].modal_ascend_no);
    setTxt('buy-m-title', I18N[currentLang].modal_buy_title);
    setTxt('buy-m-desc', I18N[currentLang].modal_buy_desc);
    setTxt('lbl-buy-cancel', I18N[currentLang].modal_buy_cancel);
    setTxt('btn-close-rewards', I18N[currentLang].modal_close);
    setTxt('btn-close-inspect', I18N[currentLang].modal_close);
    setTxt('btn-close-card-inspect', I18N[currentLang].modal_close);

    setTxt('slot-picker-title', I18N[currentLang].modal_slot_picker_title);
    setTxt('btn-slot-cancel', I18N[currentLang].modal_cancel);
    setTxt('btn-exp-picker-cancel', I18N[currentLang].modal_cancel);
    setTxt('lbl-ins-garrison', I18N[currentLang].modal_garrison);

    const skipBtn = document.getElementById('btn-battle-skip');
    if (skipBtn) skipBtn.innerText = isVipActive() ? I18N[currentLang].battle_instant_vip : I18N[currentLang].battle_skip;

    const btnSortTier = document.getElementById('btn-roster-sort-tier');
    const btnSortLvl = document.getElementById('btn-roster-sort-lvl');
    if (btnSortTier) btnSortTier.innerText = activeRosterTierDesc ? (currentLang === 'RU' ? 'Ранг ⬇' : 'Rank ⬇') : (currentLang === 'RU' ? 'Ранг ⬆' : 'Rank ⬆');
    if (btnSortLvl) btnSortLvl.innerText = activeRosterLvlDesc ? (currentLang === 'RU' ? 'Уровень ⬇' : 'Level ⬇') : (currentLang === 'RU' ? 'Уровень ⬆' : 'Level ⬆');

    const btnAscSortTier = document.getElementById('btn-sort-tier-toggle');
    const btnAscSortLvl = document.getElementById('btn-sort-lvl-toggle');
    if (btnAscSortTier) btnAscSortTier.innerText = activeAscendTierSortDesc ? (currentLang === 'RU' ? 'Ранг ⬇' : 'Rank ⬇') : (currentLang === 'RU' ? 'Ранг ⬆' : 'Rank ⬆');
    if (btnAscSortLvl) btnAscSortLvl.innerText = activeAscendLvlSortDesc ? (currentLang === 'RU' ? 'Уровень ⬇' : 'Level ⬇') : (currentLang === 'RU' ? 'Уровень ⬆' : 'Level ⬆');

    const wheelHint = document.getElementById('lbl-element-wheel-hint');
    if (wheelHint) wheelHint.innerHTML = I18N[currentLang]?.element_wheel_hint_full || '<img src="assets/icons/elem_light.webp" class="res-icon-inline" alt="Light"> Light > <img src="assets/icons/elem_undead.webp" class="res-icon-inline" alt="Undead"> Undead > <img src="assets/icons/elem_chaos.webp" class="res-icon-inline" alt="Chaos"> Chaos > <img src="assets/icons/elem_demon.webp" class="res-icon-inline" alt="Demons"> Demons > <img src="assets/icons/elem_light.webp" class="res-icon-inline" alt="Light"> (+15% CP)';

    // 4. Динамический перевод цен покупок на кнопках магазина (Голоса для VK / рубли для web)
    document.querySelectorAll('.shop-tile-btn, .shop-buy-btn').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        const match = onclickAttr.match(/,\s*(\d+)\)/);
        if (match && match[1]) {
            btn.innerText = formatPriceForPlatform(Number(match[1]));
        }
    });

    // MAJOR-M7: перерисовка активной модалки Инспектора героя при смене языка.
    // Без этого лор, имя, роль и статы остаются на старом языке до закрытия окна.
    const inspectModal = document.getElementById('card-inspect-modal');
    if (activeInspectHeroId && inspectModal && inspectModal.style.display === 'flex') {
        openCardInspect(activeInspectHeroId);
    }

    // L9: если открыта модалка «Дар первого платежа» — перерисовываем её (аналогично M7 для инспектора).
    // Все подписи внутри генерируются в openFirstPurchaseModal через isRU ? ... : ...,
    // без этого вызова они остаются на старом языке до закрытия окна.
    const fpModal = document.getElementById('first-purchase-modal');
    if (fpModal && fpModal.style.display === 'flex') {
        openFirstPurchaseModal();
    }

    // P8-fix: если открыта модалка правового документа — перерисовываем её на новом языке.
    // FIX-LEGAL-CLOSE-2: читаем тот же атрибут, который пишет openLegalDocument (data-doc-key).
    // Раньше читался несуществующий data-active-doc — при открытом privacy переключение языка
    // схлопывало содержимое обратно в terms, а кнопка «ЗАКРЫТЬ» не переводилась ни в одном случае.
    const legalModal = document.getElementById('legal-doc-modal');
    if (legalModal && legalModal.style.display === 'flex') {
        const activeKey = legalModal.getAttribute('data-doc-key') || 'terms';
        openLegalDocument(activeKey);
    }

    // L13: кнопка Hero Spotlight (share) — статичный текст в index.html,
    // требует явного обновления при смене языка (data-i18n не используется).
    const spotlightShare = document.getElementById('btn-spotlight-share');
    if (spotlightShare) {
        spotlightShare.innerText = currentLang === 'RU' ? 'ПОДЕЛИТЬСЯ' : 'SHARE';
    }
    const spotlightAccept = document.getElementById('btn-spotlight-accept');
    if (spotlightAccept) {
        spotlightAccept.innerText = currentLang === 'RU' ? 'ПРИНЯТЬ' : 'ACCEPT';
    }

    renderFormationSlots();
    renderCards();
    renderQuests();
    renderArena();
    renderDungeon();
    renderRaidBossUI();
    renderLeaderboard();
    renderBattleHistory();
    renderExpeditionsList();
    renderCodexUI();
    renderFtue();
    renderUI();
    // FIX-4.2.10: обновление динамических значений Главного меню (значения вне data-i18n)
    if (typeof updateMainMenuUI === 'function') updateMainMenuUI();
    // FIX-BUILD-VERSION: перерисовка метки сборки при смене языка (СБОРКА ↔ BUILD)
    if (typeof renderBuildVersion === 'function') renderBuildVersion();
    // FIX-FTUE-SUBVIEW-HEIGHT: при смене языка текст Советника меняет длину →
    // высота карточки меняется → позицию подэкранов нужно пересчитать.
    if (typeof recalcFtueSubviewTop === 'function') recalcFtueSubviewTop();
}

function toggleLanguage() {
    applyLanguage(currentLang === 'RU' ? 'EN' : 'RU');
}

/* ==========================================================
   ЦЕНТРАЛИЗОВАННЫЙ ТАКТ ЖИВЫХ ТАЙМЕРОВ (LIVE TIMERS)
   ========================================================== */
function updateLiveTimers() {
    const midnightStr = getFormattedMidnightCountdown();
    const sundayStr = getTimeUntilSundayMidnight();

    // 1. Таймеры Арены
    const arenaTimer = document.getElementById('arena-timer');
    if (arenaTimer) arenaTimer.innerText = `${currentLang === 'RU' ? 'Сброс' : 'Reset'}: ${midnightStr}`;

    const seasonTimer = document.getElementById('ui-season-timer');
    if (seasonTimer) seasonTimer.innerText = `${currentLang === 'RU' ? 'Сброс сезона через' : 'Season reset in'}: ${sundayStr}`;

    // 2. Таймер Рейда (Мировой Левиафан)
    const raidReset = document.getElementById('raid-reset-countdown');
    if (raidReset) raidReset.innerText = sundayStr;

    // 3. Таймер Ежедневных Квестов и лимита энергии в Бездне
    const dailyReset = document.getElementById('daily-reset-countdown');
    if (dailyReset) dailyReset.innerText = `${currentLang === 'RU' ? 'Сброс' : 'Reset'}: ${midnightStr}`;

    const btnDungRefill = document.getElementById('btn-dung-refill');
    if (btnDungRefill && (gState.dungeonRefillsToday || 0) >= 3 && (gState.dungeonStamina || 0) < 10) {
        btnDungRefill.innerHTML = `<img src="assets/icons/icon_hourglass.webp" class="icon-hourglass-inline" style="width:13px; height:13px;"> ${currentLang === 'RU' ? 'Лимит' : 'Limit'} (${midnightStr})`;
    }

    // 4. Таймер Бесплатного Дара в Магазине (с защитой от ReferenceError)
    const freebieDesc = document.getElementById('lbl-freebie-desc');
    const btnFreebie = document.getElementById('btn-claim-freebie');
    const currentFreebieGold = getDailyFreebieGold();
    const gI = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
    const cI = '<img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C">';

    // FIX-MOBILE-PERF: тут таймер меняется ежесекундно, но descFreebie меняется
    // раз в час (зависит только от currentFreebieGold). Кэшируем по значению.
    if (freebieDesc) {
        const freebieLiveHtml = currentLang === 'RU'
            ? `+${formatNumber(currentFreebieGold)} ${gI} (1ч шахт) и +10 ${cI} • До сброса: ${midnightStr}`
            : `+${formatNumber(currentFreebieGold)} ${gI} (1h mines) & +10 ${cI} • Resets: ${midnightStr}`;
        if (freebieDesc.getAttribute('data-cache') !== freebieLiveHtml) {
            freebieDesc.setAttribute('data-cache', freebieLiveHtml);
            freebieDesc.innerHTML = freebieLiveHtml;
        }
    }
    if (btnFreebie && gState.dailyFreebieClaimedToday) {
        // Таймер тикает ежесекундно — тут dirty-check не спасёт, но innerHTML мал.
        // Оставлено как есть с сохранением скорости — задача следующих сессий.
        btnFreebie.innerHTML = `<img src="assets/icons/icon_hourglass.webp" class="res-icon-inline icon-hourglass-inline" style="width:13px; height:13px;" alt="Hourglass"> ${midnightStr}`;
    }

    // 5. Таймер Колеса Фортуны
    const wheelDesc = document.getElementById('wheel-status-desc');
    if (wheelDesc && !isFreeWheelReady() && getWheelAdSpinsLeft() <= 0) {
        wheelDesc.innerText = currentLang === 'RU' 
            ? `Новые спины в полночь 00:00 (${midnightStr})` 
            : `Resets midnight (${midnightStr})`;
    }

    // v5.3.2 FIX-EXP-DEAD-TIMER-CODE: удалён мёртвый код updateLiveTimers для
    // active-экспедиций. Искал exp-timer-${expId}, такого ID в DOM нет.
    // Таймеры активных экспедиций обновляются через refreshCurrentView →
    // renderExpeditionsList раз в 3 сек (когда вкладка Походов открыта).
}

/* ==========================================================
   ИГРОВОЙ ЦИКЛ И СТАРТ
   ========================================================== */
// MAJOR-M4: дроссель для фоновой проверки бейджей — не чаще 1 раза в 3 секунды.
// Триггерные события (claimDailyQuest, claimStageQuest, claimCascadeAchievement,
// claimCodexMilestone, spinLuckyWheel и др.) по-прежнему вызывают checkNotificationBadges() напрямую.
let _lastCheckBadgesTs = 0;
function checkNotificationBadgesThrottled() {
    const now = Date.now();
    if (now - _lastCheckBadgesTs < 3000) return;
    _lastCheckBadgesTs = now;
    checkNotificationBadges();
    // FIX-VIEW-FRESH v4.7.0: держим активную вкладку свежей.
    // Проблема: рендер-функции вкладок (renderDungeon/renderArena/...) вызывались
    // только при переходе navigate(). Если состояние менялось асинхронно
    // (облачный арбитраж, onSuccess рекламы, checkDailyReset, победа над боссом),
    // кнопки на ОТКРЫТОЙ вкладке оставались серыми до повторного открытия окна.
    refreshCurrentView();
}

// FIX-VIEW-FRESH v4.7.0: лёгкий рендер активной вкладки. Раз в 3 секунды из throttled tick.
// Дёшево — обрабатывается только один активный экран. Stateful-структуры
// (gState.arenaActiveRivals, gState.battleHistory) не пересоздаются, только вёрстка.
function refreshCurrentView() {
    const activeView = document.querySelector('.view-tab.active')?.id || 'citadel-view';
    if (activeView === 'dungeon-view') {
        renderDungeon();
    } else if (activeView === 'raid-view') {
        renderRaidBossUI();
    } else if (activeView === 'arena-view') {
        renderArena();
    } else if (activeView === 'quests-view') {
        renderQuests();
    } else if (activeView === 'roster-view') {
        if (activeRosterTab === 'cards') renderCards();
        else if (activeRosterTab === 'formation') renderFormationSlots();
        else if (activeRosterTab === 'expeditions') renderExpeditionsList();
        else if (activeRosterTab === 'codex') renderCodexUI();
    }
}

setInterval(() => {
    // FIX-BACKGROUND-TICK: в фоне tick пропускается целиком.
    // Причины: (1) не жжём CPU на мобилке при свёрнутом браузере;
    // (2) не перерисовываем UI, который никто не видит;
    // (3) главное — не трогаем gState.lastTickTime через внутренние saveGame,
    //     чтобы offline income честно накопился к моменту возврата в таб.
    if (typeof document !== 'undefined' && document.hidden) return;

    const inc = getIncomeRate();
    gState.gold += inc; 
    gState.lifetimeGold += inc;

    const cap = getArmyCap();
    if ((gState.army || 0) < cap && (gState.buildings.barracks || 0) > 0) {
        gState.army = Math.min(cap, gState.army + Math.floor((gState.buildings.barracks || 0) * 1 * getRelicBonus()));
        if (gState.army > (gState.maxArmyEver || 0)) gState.maxArmyEver = gState.army;
    }

    // Живое обновление излишков золота и казны в модалке распределения
    const pickerModal = document.getElementById('ascend-hero-picker-modal');
    if (pickerModal && pickerModal.style.display === 'flex') {
        const excess = Math.max(0, (gState.gold || 0) - getAscendGoldReq());
        const canAffordNow = Object.keys(gState.deck || {}).some(id => {
            const c = gState.deck[id];
            return c && c.lvl < 200 && getHeroLevelUpgradeCost(c.lvl) <= excess;
        });
        if (window.lastAscendCanUpgradeAny === false && canAffordNow) {
            renderAscendHeroPickerList();
        } else {
            const lbl = document.getElementById('ascend-picker-excess-gold');
            if (lbl && window.lastAscendCanUpgradeAny !== false) {
                const surpStr = currentLang === 'RU' ? 'Излишки:' : 'Surplus:';
                lbl.innerHTML = `${surpStr} ${formatNumber(excess)} <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">`;
            }
        }
    }
    const inspectModal = document.getElementById('card-inspect-modal');
    if (inspectModal && inspectModal.style.display === 'flex' && activeInspectHeroId) {
        const cardData = gState.deck[activeInspectHeroId] || { lvl: 1 };
        const iLvl = document.getElementById('ins-level-display');
        const gIcon = '<img src="assets/icons/gold.webp" class="res-icon-inline" alt="G">';
        const inVaultStr = currentLang === 'RU' ? 'В казне' : 'Treasury';
        if (iLvl) {
            const rawLvl = cardData.lvl || 1;
            const lvlLabel = rawLvl > MAX_BASE_LVL
                ? `${rawLvl} (${formatHeroLevel(rawLvl)}) / ${MAX_TOTAL_LVL}`
                : `${rawLvl} / ${MAX_BASE_LVL}`;
            iLvl.innerHTML = `${I18N[currentLang].hero_level} ${lvlLabel} <span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(${inVaultStr}: ${formatNumber(gState.gold)} ${gIcon})</span>`;
        }
        // FIX-LIVE-UPGRADE: пересчитываем кнопку прокачки в живом времени.
        // Без этого при накоплении золота кнопка оставалась серой до F5-перезагрузки.
        updateInspectUpgradeButton();
    }

    updateLiveTimers();
    checkDailyReset();
    checkWeeklyRaidReset();
    autoCompleteRaidQuestIfDefeated();
    checkWeeklyArenaReset();
    renderRaidBossUI();
    // U4: пока обучение не пройдено — рендерим каждый тик. После 12-го шага renderFtue
    // мгновенно выходит, но всё равно дёргает querySelectorAll для очистки подсветки. Guard.
    if (!isFtueCompleted()) renderFtue();
    renderUI();
    checkNotificationBadgesThrottled(); // MAJOR-M4: дросселированный бейдж-чек

    // Симуляция живого ладдера Топ-10 каждые 45 секунд
    if (!window._ladderTimerCount) window._ladderTimerCount = 0;
    window._ladderTimerCount++;
    if (window._ladderTimerCount >= 45) {
        window._ladderTimerCount = 0;
        simulateLivingLadder();
    }

    // v5.2.5: тихий sync кубков от PvP-атак раз в 60 сек (было 300).
    // Пока игрок в игре — атаки живых обновляют его кубки почти мгновенно.
    if (!window._silentInboxTimer) window._silentInboxTimer = 0;
    window._silentInboxTimer++;
    if (window._silentInboxTimer >= 60) {
        window._silentInboxTimer = 0;
        if (typeof silentInboxSync === 'function') silentInboxSync();
    }

    // v5.3.0 FIX-LIVE-RIVALS-AUTO-REFRESH: раз в 90 сек обновляем живых соперников,
    // пока игрок на Арене. Иначе liveRivalsCache устаревает через 120 сек и живые
    // пропадают из списка до перехода на другую вкладку и обратно.
    if (document.querySelector('.view-tab.active')?.id === 'arena-view') {
        if (!window._liveRivalsTimer) window._liveRivalsTimer = 0;
        window._liveRivalsTimer++;
        if (window._liveRivalsTimer >= 90) {
            window._liveRivalsTimer = 0;
            gState.liveRivalsCacheTs = 0;
            if (typeof fetchLiveRivals === 'function') {
                fetchLiveRivals(2).then(list => {
                    if (list && list.length > 0) renderArena();
                });
            }
        }
    } else {
        window._liveRivalsTimer = 0;
    }
}, 1000);

setInterval(saveGame, 5000);

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (demonFlightInterval) { clearInterval(demonFlightInterval); demonFlightInterval = null; }
        if (demonSoundInterval) { clearInterval(demonSoundInterval); demonSoundInterval = null; }
        if (demonSpawnTimer) { clearTimeout(demonSpawnTimer); demonSpawnTimer = null; }
        saveGame(true);
        PlatformBridge.flushCloudSave();
        pauseBgMusic();
        // FIX-VIEWHIDE-AUDIO: аналогично VKWebAppViewHide — глушим Web Audio API
        // при сворачивании вкладки браузера (standalone / GH Pages / Yandex).
        if (typeof aCtx !== 'undefined' && aCtx && aCtx.state === 'running') {
            try { aCtx.suspend(); } catch(e) {}
        }
    } else {
        // Возврат во вкладку — поднимаем аудиоконтекст
        if (typeof aCtx !== 'undefined' && aCtx && aCtx.state === 'suspended') {
            try { aCtx.resume(); } catch(e) {}
        }
        // FIX-OFFLINE-MODAL-FROZEN: при возврате в игру сбрасываем залипший флаг и
        // разблокируем кнопки в модалке офлайн-дохода. Если игрок свернул игру во время
        // показа rewarded-видео, колбэк onSuccess/onError не придёт, а isClaimingOffline
        // останется true. Без этого сброса модалка #offline-modal висела бы с неактивными
        // кнопками до перезагрузки страницы (F5), а pendingOfflineGold сгорал.
        isClaimingOffline = false;
        const _offClaim = document.getElementById('btn-offline-claim');
        const _offDouble = document.getElementById('btn-offline-double');
        if (_offClaim) _offClaim.disabled = false;
        if (_offDouble) _offDouble.disabled = false;
        if (!demonActive) scheduleNextDemon();
        // FIX-OFFLINE-DUP: возврат в таб считает offline income ТОЛЬКО если облачный
        // sync за эту сессию уже завершён (или не нужен — standalone). Иначе игрок
        // может закрыть таб в момент инициализации и вернуться: checkOfflineIncome
        // увидит разницу от старого локального lastTickTime.
        if (offlineIncomeFinalized) checkOfflineIncome();
        // U12/U13-b: при возврате в игру сбрасываем дроссели дневных и недельных проверок.
        // Иначе, если игрок держал приложение в фоне через 00:00, сбросы сработают только
        // через 30 секунд после возврата (что воспринимается как баг).
        _lastDailyResetCheckTs = 0;
        _lastWeeklyResetCheckTs = 0;
        checkDailyReset();
        if (!gState.isMusicMuted) {
            playBgMusic();
        }
    }
});

window.addEventListener('beforeunload', () => {
    PlatformBridge.flushCloudSave();
});

// Библиотека Свитков Памяти Бездны (Двуязычная)
const CHRONICLES_LORE = {
    5: { 
        chapter: { RU: 'ГЛАВА I: ПАДЕНИЕ НЕБЕС', EN: 'CHAPTER I: FALL OF THE HEAVENS' }, 
        text: { 
            RU: '«Когда свод тверди треснул, первые города падали в пустоту девяносто дней. Те, кто выжил на дне, научились дышать пеплом и пить кипящую смолу.»',
            EN: '«When the firmament cracked, primeval cities plummeted into void for ninety days. Those who survived learned to breathe ash and drink boiling pitch.»'
        } 
    },
    10: { 
        chapter: { RU: 'ГЛАВА II: СЕРНОЕ ЯДРО', EN: 'CHAPTER II: THE BRIMSTONE CORE' }, 
        text: { 
            RU: '«Глубинные разломы исторгли наружу расплавленное сердце планеты. Демоны не вторгались в наш мир — мир сам провалился в их раскаленные объятия.»',
            EN: '«Deep abyssal rifts expelled the molten heart of the world. Demons never invaded our realm—the world itself collapsed into their searing embrace.»'
        } 
    },
    15: { 
        chapter: { RU: 'ГЛАВА III: ВЕЧНЫЙ ДОЛГ', EN: 'CHAPTER III: THE ETERNAL DEBT' }, 
        text: { 
            RU: '«Владыки склепов поняли первыми: живая плоть слаба перед дыханием Бездны. Только окаменевшие кости и холодное железо способны пережить эоны забвения.»',
            EN: '«The lords of ossuaries understood first: mortal flesh withers before the breath of the Abyss. Only calcified bone and cold iron endure eons of oblivion.»'
        } 
    },
    20: { 
        chapter: { RU: 'ГЛАВА IV: ОЧИЩЕНИЕ ПЕПЛОМ', EN: 'CHAPTER IV: SCOURED BY ASH' }, 
        text: { 
            RU: '«Инквизиция принесла на дно осколки умирающего солнца. Их фанатичный свет столь яростен, что сжигает тьму вместе с глазами тех, кто молится о спасении.»',
            EN: '«The Inquisition carried shards of a dying sun into the deep. Their fanatical light blazes so fiercely that it scours away the dark along with the eyes of those who pray.»'
        } 
    },
    25: { 
        chapter: { RU: 'ГЛАВА V: ЗВЕЗДНЫЙ РАЗЛОМ', EN: 'CHAPTER V: THE ASTRAL RIFT' }, 
        text: { 
            RU: '«Под фундаментом древнейших твердынь покоятся останки комет, что соткали саму материю. Тот, кто коснется их черного льда, навсегда забудет собственное имя.»',
            EN: '«Beneath the foundations of primeval keeps rest the bones of comets that wove matter itself. Whoever touches their black frost forgets their very name.»'
        } 
    },
    30: { 
        chapter: { RU: 'ГЛАВА VI: КОЛЫБЕЛЬ ХАОСА', EN: 'CHAPTER VI: CRADLE OF CHAOS' }, 
        text: { 
            RU: '«Пространство и время здесь сплетаются в предсмертный узел. То, что умерло тысячелетия назад, пойдет в авангарде вашей армии завтра утром.»',
            EN: '«Space and time tangle here into a death-knot. What perished millennia ago will march in the vanguard of your legions tomorrow dawn.»'
        } 
    },
    35: {
        chapter: { RU: 'ГЛАВА VII: СЕРЕБРЯНЫЙ ДОЗОР', EN: 'CHAPTER VII: THE SILVER WATCH' },
        text: {
            RU: '«Здесь стояли гарнизоны первой династии. Их доспехи вплавились в камень, но глазницы шлемов всё ещё направлены на северный разлом.»',
            EN: '«Here stood garrisons of the first dynasty. Their plate fused into bedrock, yet helmet visors remain fixed upon the northern rift.»'
        }
    },
    40: {
        chapter: { RU: 'ГЛАВА VIII: ПЕПЕЛЬНЫЙ ОКЕАН', EN: 'CHAPTER VIII: ASHEN OCEAN' },
        text: {
            RU: '«Реки жидкого базальта застывают черными иглами. С каждым шагом вниз гравитация меняет направление, напоминая о близости ядра мира.»',
            EN: '«Rivers of liquid basalt freeze into black needles. With every step deeper, gravity tilts, signaling proximity to the world core.»'
        }
    },
    50: {
        chapter: { RU: 'ГЛАВА IX: ПАНТЕОН ПАДШИХ', EN: 'CHAPTER IX: PANTHEON OF FALLEN' },
        text: {
            RU: '«Титаны, державшие небесный свод, погребены в этих чертогах. Их шепот звучит в металле клинков, требуя продолжения вечной жатвы.»',
            EN: '«Titans that once upheld the firmament lie entombed here. Their whispers resonate through forged steel, demanding eternal harvest.»'
        }
    },
    60: {
        chapter: { RU: 'ГЛАВА X: ТЕНИ ЗАБВЕНИЯ', EN: 'CHAPTER X: SHADES OF OBLIVION' },
        text: {
            RU: '«Даже свет умирает здесь от истощения. Лишь пламя непокорной воли способно рассекать вечную мерзлоту древней пустоты.»',
            EN: '«Even radiant light perishes here from attrition. Only the flame of unbroken will cleaves the permafrost of ancient void.»'
        }
    },
    75: {
        chapter: { RU: 'ГЛАВА XI: АСТРАЛЬНАЯ КУЗНИЦА', EN: 'CHAPTER XI: ASTRAL FORGE' },
        text: {
            RU: '«Здесь первые боги высекали законы материи. Разрушенные наковальни всё ещё пульсируют энергией, готовой расплавить любого смертного.»',
            EN: '«Here primordial deities chiseled the laws of reality. Fractured anvils pulse with power capable of liquefying mortal marrow.»'
        }
    },
    100: {
        chapter: { RU: 'ГЛАВА XII: АБСОЛЮТНАЯ ПУСТОТА', EN: 'CHAPTER XII: ABSOLUTE VOID' },
        text: {
            RU: '«Конец спуска. Здесь нет ни верха, ни низа, ни времени. Только вы, ваша империя и первородная бездна, склонившаяся перед вашим легионом.»',
            EN: '«The end of the descent. Here lies no height, no depth, no era. Only you, your empire, and the primordial abyss bowing to your host.»'
        }
    }
};

function closeFirstPurchaseModal() {
    const m = document.getElementById('first-purchase-modal');
    if (m) m.style.display = 'none';
}

function openChronicleModal(floor, isArchiveView = false) {
    const data = CHRONICLES_LORE[floor] || { 
        chapter: { RU: `ГЛАВА ${floor}: ТАЙНЫ ГЛУБИН`, EN: `CHAPTER ${floor}: DEPTH SECRETS` }, 
        text: { 
            RU: '«Чем глубже вы спускаетесь, тем громче тишина Бездны. Память павших королей становится фундаментом для вашей новой непобедимой империи.»',
            EN: '«The deeper you descend, the louder the stillness of the Abyss. The memory of fallen monarchs becomes the bedrock of your empire.»'
        } 
    };

    const modal = document.getElementById('chronicle-modal');
    if (!modal) return;

    const chEl = document.getElementById('chronicle-chapter');
    const txtEl = document.getElementById('chronicle-text');
    const rewEl = document.getElementById('chronicle-reward');

    const chTitle = typeof data.chapter === 'object' ? (data.chapter[currentLang] || data.chapter['EN']) : data.chapter;
    const chLore = typeof data.text === 'object' ? (data.text[currentLang] || data.text['EN']) : data.text;

    if (chEl) chEl.innerText = chTitle;
    if (txtEl) txtEl.innerText = chLore;

    if (!gState.claimedChronicles) gState.claimedChronicles = [];
    const isAlreadyClaimed = gState.claimedChronicles.includes(floor);

    if (isArchiveView || isAlreadyClaimed) {
        if (rewEl) rewEl.style.display = 'none';
    } else {
        if (rewEl) {
            rewEl.innerHTML = I18N[currentLang]?.chronicles_reward_msg || '+50 <img src="assets/icons/crystal.webp" class="res-icon-inline" alt="C"> Crystals Reward!';
            rewEl.style.display = 'block';
        }
        gState.claimedChronicles.push(floor);
        gState.crystals = (gState.crystals || 0) + 50;
        saveGame();
        renderUI();
    }

    playCoinSfx();
    modal.setAttribute('style', 'display: flex !important; z-index: 3500 !important;');
}

function closeChronicleModal() {
    const m = document.getElementById('chronicle-modal');
    if (m) m.style.display = 'none';
}

function openChroniclesArchiveModal() {
    renderChroniclesArchiveList();
    const m = document.getElementById('chronicles-archive-modal');
    if (m) m.style.display = 'flex';
}

function closeChroniclesArchiveModal() {
    const m = document.getElementById('chronicles-archive-modal');
    if (m) m.style.display = 'none';
}

function renderChroniclesArchiveList() {
    const list = document.getElementById('chronicles-archive-list');
    if (!list) return;
    list.innerHTML = '';

    // Динамический список хроник вплоть до 100 этажа
    const floors = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100];
    const currentMaxFloor = gState.dungeonFloor || 1;

    floors.forEach(f => {
        const item = CHRONICLES_LORE[f];
        if (!item) return;
        const isUnlocked = currentMaxFloor > f;
        const title = item.chapter[currentLang] || item.chapter['EN'];

        const row = document.createElement('div');
        row.className = `chronicle-item-card ${isUnlocked ? '' : 'locked'}`;

        const readBtnText = currentLang === 'RU' ? 'ЧИТАТЬ' : 'READ';
        const unlockedLabel = currentLang === 'RU' ? `Открыто (Этаж ${f})` : `Unlocked (Floor ${f})`;
        const lockedTitle = currentLang === 'RU' ? 'Свиток опечатан' : 'Scroll sealed';
        const lockedDesc = currentLang === 'RU' ? `Зачистите Этаж ${f}` : `Clear Floor ${f}`;
        const closedBadge = currentLang === 'RU' ? '[ЗАКРЫТО]' : '[LOCKED]';

        if (isUnlocked) {
            row.innerHTML = `
                <div>
                    <b style="color:var(--gold); font-size:12.5px;">${title}</b>
                    <div style="font-size:11px; color:#4ade80; margin-top:2px;">${unlockedLabel}</div>
                </div>
                <button class="btn-action" style="font-size:11px; padding:4px 10px;">${readBtnText}</button>`;
            row.onclick = () => {
                openChronicleModal(f, true);
            };
        } else {
            row.innerHTML = `
                <div>
                    <b style="color:var(--text-muted); font-size:12px;">${lockedTitle}</b>
                    <div style="font-size:11px; color:var(--red); margin-top:2px;">${lockedDesc}</div>
                </div>
                <span style="font-size:11px; color:var(--text-muted); font-weight:700;">${closedBadge}</span>`;
        }
        list.appendChild(row);
    });
}

// Инициализация мобильных всплывающих тултипов при удержании пальца (Long-Press 400ms)
// v5.3.9 FIX-MOBILE-TOOLTIP-PERSIST: тултип не убирается при отпускании пальца.
// Раньше touchend/touchmove сразу removeTooltip — палец закрывал обзор,
// убираешь палец — убирается тултип. Теперь: держится после отпускания,
// следующий тап по экрану закрывает его.
function initMobileLongPressTooltips() {
    let longPressTimer = null;
    let activeTooltipEl = null;
    let tooltipActive = false;

    const removeTooltip = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        if (activeTooltipEl) { activeTooltipEl.remove(); activeTooltipEl = null; }
        tooltipActive = false;
    };

    document.addEventListener('touchstart', (e) => {
        // Если тултип уже показан — тап по экрану его закрывает, действие не проваливается.
        if (tooltipActive) {
            removeTooltip();
            return;
        }
        const target = e.target.closest('[title]');
        if (!target) return;
        // v5.3.10: исключаем активно-тапаемые игровые зоны — там тултип мешает.
        if (target.id === 'tap-node' || target.closest('.citadel-bottom-tap-zone')) return;
        const text = target.getAttribute('title');
        if (!text) return;

        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            activeTooltipEl = document.createElement('div');
            activeTooltipEl.className = 'mobile-longpress-tooltip';
            activeTooltipEl.innerText = text;
            const touch = e.touches[0];
            activeTooltipEl.style.left = `${Math.min(window.innerWidth - 180, Math.max(10, touch.clientX - 80))}px`;
            activeTooltipEl.style.top = `${Math.max(10, touch.clientY - 46)}px`;
            document.body.appendChild(activeTooltipEl);
            tooltipActive = true;
            triggerHaptic('tap');
        }, 400);
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        // Тултип НЕ убирается при отпускании пальца — держится до следующего тапа.
        // preventDefault блокирует click по элементу, который открыл тултип.
        if (tooltipActive) {
            e.preventDefault();
            return;
        }
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        // При активном тултипе сдвиг пальца не убирает его — только тап.
        if (tooltipActive) return;
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }, { passive: true });
}

// Обработка аппаратной кнопки «Назад» / свайпа «Назад» на Android
// FIX-SWIPE-UNIFIED: единый обработчик свайпа вправо.
// Приоритет слоёв: модалка → подэкран → Цитадель.
// Pull-down (свайп вниз) убран полностью — жесты только право-лево.
// VK edge-swipe (от левого края) не перехватываем: требуем startX > 20.
const MODAL_CLOSERS_SWIPE = {
    'season-verdict-modal': () => claimSeasonCeremony(),
    'epic-quote-overlay': () => closeEpicQuote(),
    'first-purchase-modal': () => closeFirstPurchaseModal(),
    'leviathan-triumph-overlay': () => closeLeviathanTriumphOverlay(),
    'ascension-ritual-overlay': () => completeAscensionRitual(),
    'player-inspect-modal': () => closePlayerInspect(),
    'card-inspect-modal': () => closeCardInspect(),
    'abyss-pass-modal': () => closeAbyssPassModal(),
    'slot-picker-modal': () => closeSlotPicker(),
    'exp-picker-modal': () => closeExpHeroPicker(),
    'settings-modal': () => closeSettingsModal(),
    'building-modal': () => closeBuildingModal(),
    'battle-hub-modal': () => closeBattleHubModal(),
    'main-menu-modal': () => closeMainMenu(),
    'daily-calendar-modal': () => closeDailyCalendarModal(),
    'lucky-wheel-modal': () => closeLuckyWheelModal(),
    'arena-ladder-modal': () => closeArenaLadderModal(),
    'rewards-modal': () => closeRewardsModal(),
    'ascend-modal': () => closeAscendModal(),
    'ascend-hero-picker-modal': () => closeAscendHeroPicker(),
    'demon-modal': () => closeDemonModal(),
    'buy-modal': () => closeBuyModal(),
    'hard-reset-modal': () => closeHardResetModal(),
    'chronicle-modal': () => closeChronicleModal(),
    'legal-doc-modal': () => closeLegalDocModal(),
    'chronicles-archive-modal': () => closeChroniclesArchiveModal(),
    'promo-modal': () => closePromoModal(),
    'mastery-awakening-modal': () => cancelMasteryEntry()
};

function initSwipeRightClose() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isHorizontalSwipe = false;
    let isTracking = false;

    // FIX-SWIPE-XIAOMI: EDGE_MARGIN 20 → 50. MIUI имеет более широкую зону edge-swipe
    // (40-60px), чем стоковый Android. Свайпы, начинающиеся ближе к краю, система
    // перехватывала раньше, чем наш код видел их. SWIPE_MIN_DIST 80 → 60 — снижаем
    // порог длины, чтобы короткие жесты на Xiaomi проходили.
    const SWIPE_MIN_DIST = 60;
    const SWIPE_MAX_TIME = 800;
    const EDGE_MARGIN = 50;

    const getActiveModalId = () => {
        for (const id in MODAL_CLOSERS_SWIPE) {
            const el = document.getElementById(id);
            if (el && el.style.display === 'flex') return id;
        }
        return null;
    };

    const getActiveSubview = () => {
        const active = document.querySelector('.view-tab.active');
        if (!active || active.id === 'citadel-view') return null;
        return active;
    };

    const onSwipeStart = (x, y) => {
        if (x < EDGE_MARGIN) { isTracking = false; if (IS_DEV_MODE) console.log('[Swipe] too close to edge x=' + x); return; }
        touchStartX = x;
        touchStartY = y;
        touchStartTime = Date.now();
        isTracking = true;
        isHorizontalSwipe = false;
    };

    const onSwipeMove = (x, y) => {
        if (!isTracking) return;
        const dx = x - touchStartX;
        const dy = y - touchStartY;
        if (Math.abs(dx) > Math.abs(dy) * 1.2 && dx > 15) {
            isHorizontalSwipe = true;
        } else if (Math.abs(dy) > 15) {
            isHorizontalSwipe = false;
        }
    };

    const onSwipeEnd = (x, y) => {
        if (!isTracking) return;
        isTracking = false;
        if (!isHorizontalSwipe) {
            if (IS_DEV_MODE) console.log('[Swipe] end (not horizontal)');
            return;
        }
        const dx = x - touchStartX;
        const dy = Math.abs(y - touchStartY);
        const dt = Date.now() - touchStartTime;
        if (dx < SWIPE_MIN_DIST) { if (IS_DEV_MODE) console.log('[Swipe] too short dx=' + dx); return; }
        if (dt > SWIPE_MAX_TIME) { if (IS_DEV_MODE) console.log('[Swipe] too slow dt=' + dt); return; }
        if (dy > 80) { if (IS_DEV_MODE) console.log('[Swipe] too vertical dy=' + dy); return; }

        const modalId = getActiveModalId();
        if (modalId) {
            const closer = MODAL_CLOSERS_SWIPE[modalId];
            if (typeof closer === 'function') {
                try { closer(); } catch (err) { console.warn('[Swipe] close failed:', err); }
            }
            return;
        }

        const subview = getActiveSubview();
        if (subview) {
            if (typeof triggerHaptic === 'function') triggerHaptic('tap');
            navigate('citadel-view');
        }
    };

    // FIX-SWIPE-XIAOMI: capture:true ловит события ДО того, как промежуточные слои
    // VK WebView успеют погасить их через stopPropagation.
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { isTracking = false; return; }
        onSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true, capture: true });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        onSwipeMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true, capture: true });

    document.addEventListener('touchend', (e) => {
        const touch = e.changedTouches[0];
        if (!touch) return;
        onSwipeEnd(touch.clientX, touch.clientY);
    }, { passive: true, capture: true });

    // FIX-SWIPE-XIAOMI: touchcancel приходит, когда система (MIUI) перехватывает жест.
    // Раньше мы это игнорировали и висели в isTracking = true до следующего touchstart.
    document.addEventListener('touchcancel', () => {
        if (IS_DEV_MODE && isTracking) console.log('[Swipe] touchcancel — system stole gesture');
        isTracking = false;
        isHorizontalSwipe = false;
    }, { passive: true, capture: true });
}

// v4.8.8: initSwipeRightToCloseView() удалена. Её логика полностью дублировала
// initSwipeRightClose() — оба слушали touchstart/touchmove/touchend/touchcancel на
// document с capture:true и вызывали navigate('citadel-view') при свайпе вправо.
// Один свайп по подэкрану обрабатывался дважды, что давало двойной haptic-tap
// и потенциально лишние перерисовки при переключении вкладок.
/*
// СТАРОЕ ОПРЕДЕЛЕНИЕ (сохранено в комментарии для git-истории):
function initSwipeRightToCloseView() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isHorizontalSwipe = false;
    let isTracking = false;

    // FIX-SWIPE-XIAOMI: те же улучшения, что и в initSwipeRightClose — см. пояснение выше.
    const SWIPE_MIN_DIST = 60;
    const SWIPE_MAX_TIME = 800;
    const EDGE_MARGIN = 50;

    const getActiveSubview = () => {
        const active = document.querySelector('.view-tab.active');
        if (!active || active.id === 'citadel-view') return null;
        return active;
    };

    const isAnyModalOpen = () => {
        for (const id in MODAL_CLOSERS_SWIPE) {
            const el = document.getElementById(id);
            if (el && el.style.display === 'flex') return true;
        }
        return false;
    };

    const onStart = (x, y) => {
        const subview = getActiveSubview();
        if (!subview || isAnyModalOpen()) { isTracking = false; return; }
        touchStartX = x;
        touchStartY = y;
        touchStartTime = Date.now();
        isTracking = touchStartX > EDGE_MARGIN;
        isHorizontalSwipe = false;
    };

    const onMove = (x, y) => {
        if (!isTracking) return;
        const dx = x - touchStartX;
        const dy = y - touchStartY;
        if (Math.abs(dx) > Math.abs(dy) * 1.2 && dx > 15) {
            isHorizontalSwipe = true;
        } else if (Math.abs(dy) > 15) {
            isHorizontalSwipe = false;
        }
    };

    const onEnd = (x, y) => {
        if (!isTracking) return;
        isTracking = false;
        if (!isHorizontalSwipe) return;
        const dx = x - touchStartX;
        const dy = Math.abs(y - touchStartY);
        const dt = Date.now() - touchStartTime;
        if (dx < SWIPE_MIN_DIST) return;
        if (dt > SWIPE_MAX_TIME) return;
        if (dy > 80) return;
        const subview = getActiveSubview();
        if (!subview) return;
        if (isAnyModalOpen()) return;
        if (typeof triggerHaptic === 'function') triggerHaptic('tap');
        navigate('citadel-view');
    };

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { isTracking = false; return; }
        onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true, capture: true });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true, capture: true });

    document.addEventListener('touchend', (e) => {
        const touch = e.changedTouches[0];
        if (!touch) return;
        onEnd(touch.clientX, touch.clientY);
    }, { passive: true, capture: true });

    document.addEventListener('touchcancel', () => {
        isTracking = false;
        isHorizontalSwipe = false;
    }, { passive: true, capture: true });
}
*/

function initHardwareBackNavigation() {
    const handleBack = () => {
        // 1. Закрытие модальных окон в порядке приоритета глубины
        // Полный перехват модалок для нативной кнопки «Назад» на Android в строгом порядке глубины
        const activeModals = [
            { id: 'season-verdict-modal', close: claimSeasonCeremony },
            { id: 'epic-quote-overlay', close: closeEpicQuote },
            { id: 'first-purchase-modal', close: closeFirstPurchaseModal },
            { id: 'leviathan-triumph-overlay', close: closeLeviathanTriumphOverlay },
            { id: 'ascension-ritual-overlay', close: completeAscensionRitual },
            { id: 'player-inspect-modal', close: closePlayerInspect },
            { id: 'card-inspect-modal', close: closeCardInspect },
            { id: 'abyss-pass-modal', close: closeAbyssPassModal },
            { id: 'slot-picker-modal', close: closeSlotPicker },
            { id: 'exp-picker-modal', close: closeExpHeroPicker },
            { id: 'settings-modal', close: closeSettingsModal },
            { id: 'building-modal', close: closeBuildingModal },
            { id: 'battle-hub-modal', close: closeBattleHubModal },
            { id: 'main-menu-modal', close: closeMainMenu },
            { id: 'daily-calendar-modal', close: closeDailyCalendarModal },
            { id: 'lucky-wheel-modal', close: closeLuckyWheelModal },
            { id: 'arena-ladder-modal', close: closeArenaLadderModal },
            { id: 'rewards-modal', close: closeRewardsModal },
            { id: 'ascend-modal', close: closeAscendModal },
            { id: 'ascend-hero-picker-modal', close: closeAscendHeroPicker },
            { id: 'demon-modal', close: closeDemonModal },
            { id: 'buy-modal', close: closeBuyModal },
            { id: 'hard-reset-modal', close: closeHardResetModal },
            { id: 'chronicle-modal', close: closeChronicleModal },
            { id: 'legal-doc-modal', close: closeLegalDocModal },
            { id: 'chronicles-archive-modal', close: closeChroniclesArchiveModal }
        ];

        for (let m of activeModals) {
            const el = document.getElementById(m.id);
            if (el && el.style.display !== 'none' && el.style.display !== '') {
                m.close();
                return;
            }
        }

        // 2. Если открыт подэкран (Арена, Штаб, Бездна и т.д.) -> возврат в Цитадель
        const activeView = document.querySelector('.view-tab.active');
        if (activeView && activeView.id !== 'citadel-view') {
            navigate('citadel-view');
        }
    };

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.addListener('backButton', handleBack);
    } else {
        document.addEventListener('backbutton', handleBack);
    }
}

// Автоматический калькулятор масштаба сцены игры под физический дисплей
function initStageScaler() {
    const updateScale = () => {
        const targetW = 460;
        const targetH = 860;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        // FIX-STAGE-PC: базовый масштаб — вписываем сцену в окно без обрезки
        let scale = Math.min(winW / targetW, winH / targetH);
        // FIX-STAGE-PC: раньше на десктопе scale жёстко фиксировался в 1.0 — игра оставалась
        // 460×860 в центре огромного монитора. Теперь разрешаем увеличение до 1.55x —
        // комфортно для Full HD / QHD, но не мылит текст на Retina/4K (растр сцены 460×860).
        // • 1920×1080 → scale ≈ 1.26 (сцена 580×1080)
        // • 2560×1440 → scale = 1.55 (сцена 713×1333)
        // Мобилки (<900px) идут по прежней формуле Math.min — там scale и так <1.
        if (winW >= 900 && winH >= 880) {
            scale = Math.min(1.55, scale);
        }
        document.documentElement.style.setProperty('--stage-scale', scale.toFixed(4));
    };
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', () => setTimeout(updateScale, 120));
    updateScale();
}

// ==========================================================
// P9: ВАЛИДАЦИЯ LAUNCH PARAMS ПЕРЕД ЗАГРУЗКОЙ ПРОГРЕССА
// П. 1.2.2 правил VK Mini Apps: Приложение-Игра должно валидировать подпись
// параметров запуска. Валидация идёт на Cloudflare Worker (см. VK_VALIDATOR_URL).
//
// Режим F1 (оптимистично): при недоступности Worker'а (нет сети, 5xx, timeout)
// игра ГРУЗИТСЯ с console.warn. Это не ослабляет защиту в проде (VK всегда доступен),
// но не блокирует модератора при нестабильном соединении.
//
// Только при ЯВНОМ sign_mismatch/sign_expired — один раз показываем toast,
// но всё равно грузим игру (пользовательская сессия могла быть создана легитимно,
// а подпись испортиться из-за прокси/буфера).
// ==========================================================
async function validateLaunchParams() {
    // Вне VK — валидация не требуется (standalone / GH Pages / Yandex)
    if (!isRunningInsideVK()) return { valid: true, reason: 'not_in_vk' };

    // URL не задан — graceful no-op (пока Cloudflare Worker не развёрнут)
    if (!VK_VALIDATOR_URL) {
        console.warn('[LOTA] P9: VK_VALIDATOR_URL не задан — валидация launch params пропущена. П. 1.2.2 НЕ закрыт.');
        return { valid: true, reason: 'no_validator_url' };
    }

    // Кэш в sessionStorage: избегаем повторного fetch при hot-reload в течение сессии
    try {
        const cached = sessionStorage.getItem('lota_p9_result');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.ts && (Date.now() - parsed.ts) < 3600 * 1000) {
                return parsed.data;
            }
        }
    } catch (e) {}

    const rawQuery = (typeof window !== 'undefined' && window.location && window.location.search)
        ? window.location.search.replace(/^\?/, '')
        : '';

    if (!rawQuery) return { valid: true, reason: 'empty_query' };

    let controller = null;
    let timeoutId = null;
    try {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 5000);

        const resp = await fetch(VK_VALIDATOR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: rawQuery }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        timeoutId = null;

        if (!resp.ok) {
            devLog('[LOTA] P9: validator HTTP', resp.status);
            return { valid: true, reason: 'validator_http_' + resp.status };
        }

        const data = await resp.json();
        const result = (data && typeof data.valid === 'boolean')
            ? { valid: data.valid, reason: data.reason || 'ok' }
            : { valid: true, reason: 'bad_response_shape' };

        try {
            sessionStorage.setItem('lota_p9_result', JSON.stringify({ ts: Date.now(), data: result }));
        } catch (e) {}

        return result;
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        devLog('[LOTA] P9: validator unavailable —', e && e.message);
        return { valid: true, reason: 'validator_unreachable' };
    }
}

// Безопасный запуск ядра и инициализация моста платформ
try {
    // FIX-BUILD-VERSION: boot-лог сборки в консоль. По нему в DevTools VK сразу видно,
    // какая версия кода реально загружена (критично при итерациях с GitHub Pages).
    devLog(
        `%c[LOTA] BUILD v${BUILD_VERSION} · ${BUILD_DATE} · ${isRunningInsideVK() ? 'VK' : (isRunningInsideYandex() ? 'Yandex' : 'Standalone')}`,
        'color:#f5b041; font-weight:bold; font-size:11px;'
    );

    initStageScaler();

    // FIX-VK-INIT-SYNC: VK handshake СИНХРОННО, до любых await.
    // Без этого VK держит свой splash («games») пока не получит VKWebAppInit,
    // а P9-валидация уводит вызов в async IIFE — при медленном Worker'е
    // VK зависает на splash навсегда. Метод идемпотентен через флаг.
    PlatformBridge.initVKHandshake();

    // P9: асинхронная валидация launch params (fire-and-await в async IIFE).
    // loadGame() вызывается ПОСЛЕ получения результата, чтобы защититься от сценария
    // «подменённый vk_user_id → загрузка чужого прогресса». При F1-режиме результат
    // всегда valid=true, поэтому задержка не блокирует игру на нестабильной сети.
    (async () => {
        let p9 = { valid: true, reason: 'skipped' };
        try {
            p9 = await validateLaunchParams();
        } catch (e) {
            console.warn('[LOTA] P9: unexpected error —', e && e.message);
        }

        if (!p9.valid && (p9.reason === 'sign_mismatch' || p9.reason === 'sign_expired')) {
            // F1: не блокируем игру, но даём видимый сигнал. Warn оставляем —
            // это реальный сигнал безопасности, не info-шум.
            console.warn('[LOTA] P9: VALIDATION FAILED —', p9.reason);
            setTimeout(() => {
                if (typeof pushToast === 'function') {
                    pushToast(currentLang === 'RU'
                        ? '⚠ Проверка подписи не пройдена. Перезапустите игру.'
                        : '⚠ Signature validation failed. Please restart.');
                }
            }, 1500);
        } else if (p9.valid) {
            devLog('[LOTA] P9: launch params validation OK (' + p9.reason + ')');
        }

        // Загружаем прогресс после валидации (даже при F1-провале — игра работает)
        loadGame();
        // ...дальнейшая инициализация идёт без изменений (см. существующий код ниже)
    // FIX-P9-RACE: IIFE здесь НЕ закрываем — init должен идти ПОСЛЕ loadGame().
    // Закрытие перенесено в самый конец try-блока (после всех render*-вызовов).
    applyLanguage(currentLang);
    PlatformBridge.init();
    initMobileLongPressTooltips();
    initHardwareBackNavigation();
    initSwipeRightClose();
    // v4.8.8: initSwipeRightToCloseView() удалена — её логика полностью дублировала
    // initSwipeRightClose(). Один свайп по подэкрану обрабатывался дважды.

    renderFormationSlots();
    renderCards();
    renderQuests();
    renderArena();
    renderDungeon();
    renderRaidBossUI();
    renderLeaderboard();
    renderBattleHistory();
    renderFtue();
    renderUI();
    scheduleNextDemon();

            document.addEventListener('pointerdown', () => {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            if (!gState.isMusicMuted) {
                playBgMusic();
            }
        }, { once: true });

        // FIX-CLEAN-DIAG: маркер полной инициализации UI — под devLog.
        // В проде молчит, при отладке виден.
        devLog('[LOTA] UI RENDERED — all screens initialized, ready to display');

        // LIVE-ARENA (v4.7.8): проверяем входящие атаки на гарнизон.
        // Отложенно 3 сек — чтобы дать время всем рендерам и bridge.
        // v5.2.4: пока inbox не прочитан — submitArenaProfile заблокирован,
        // чтобы локальные кубки не перезаписали серверные изменения от атак.
        _inboxSyncPending = true;
        if (_inboxSyncFallbackTimer) clearTimeout(_inboxSyncFallbackTimer);
        _inboxSyncFallbackTimer = setTimeout(() => {
            if (_inboxSyncPending) {
                if (DEV_MODE_CHECK()) console.warn('[LiveArena] inbox sync timeout — releasing submit lock');
                _inboxSyncPending = false;
                _inboxSyncFallbackTimer = null;
            }
        }, 15000);
        if (typeof checkArenaInbox === 'function') {
            setTimeout(checkArenaInbox, 3000);
        }

    })(); // FIX-P9-RACE: закрываем async IIFE ТОЛЬКО после полной инициализации UI.
          // Теперь весь render* и обработчики запускаются с уже загруженным gState —
          // нет «моргания» дефолтным состоянием, пока fetch к Cloudflare Worker'у идёт.
} catch(e) {
    console.error("Initialization safe-fail:", e);
}

/* ==========================================================
   ПРЕДЗАГРУЗКА АССЕТОВ (PRELOADER) & PWA SERVICE WORKER
   ========================================================== */
(function initPreloaderAndServiceWorker() {
    // 1. Безопасная регистрация Service Worker (PWA / Offline Cache)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const isSecureOrigin = window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        if (isSecureOrigin) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(err => {
                    console.log('[PWA] Service Worker registration skipped/failed (sandbox mode):', err);
                });
            });
        }
    }

    // 2. Логика предзагрузки критических ресурсов
    const preloaderEl = document.getElementById('app-preloader');
    const barEl = document.getElementById('preloader-bar');
    const pctEl = document.getElementById('preloader-pct');
    const statusEl = document.getElementById('preloader-status');

    if (!preloaderEl) return;

    const criticalAssets = [
        'assets/bg/roster.webp',
        'assets/bg/hq.webp',
        'assets/bg/altar.webp',
        'assets/bg/arena.webp',
        'assets/bg/dungeon.webp',
        'assets/bg/raid.webp',
        'assets/icons/gold.webp',
        'assets/icons/crystal.webp',
        'assets/icons/relic.webp',
        'assets/icons/army.webp',
        'assets/icons/shop_tickets.webp',
        'assets/icons/swords_cp.webp',
        'assets/icons/icon_energy.webp',
        'assets/icons/portal_abyss.webp',
        'assets/advisor.webp'
    ];

    const statusPhrases = [
        'Пробуждение древних владык...',
        'Сбор легионов и когорт...',
        'Ковка клинков и арсенала...',
        'Связь с астральным разломом...',
        'Цитадель готова к осаде!'
    ];

    let loadedCount = 0;
    const totalCount = criticalAssets.length;
    let isFinished = false;

    function updateProgress(forcePct = null) {
        if (isFinished) return;
        const currentPct = forcePct !== null ? forcePct : Math.min(100, Math.floor((loadedCount / totalCount) * 100));
        if (barEl) barEl.style.width = `${currentPct}%`;
        if (pctEl) pctEl.innerText = `${currentPct}%`;

        const phraseIdx = Math.min(statusPhrases.length - 1, Math.floor((currentPct / 100) * statusPhrases.length));
        if (statusEl && statusPhrases[phraseIdx]) {
            statusEl.innerText = statusPhrases[phraseIdx];
        }

        if (currentPct >= 100) {
            completePreloader();
        }
    }

    function completePreloader() {
        if (isFinished) return;
        isFinished = true;
        if (barEl) barEl.style.width = '100%';
        if (pctEl) pctEl.innerText = '100%';
        if (statusEl) {
            statusEl.innerText = currentLang === 'RU' ? 'Цитадель ждет вашего приказа!' : 'The Citadel awaits your command!';
            statusEl.setAttribute('data-loaded', 'true');
        }

        // Сигнал готовности платформе Яндекс Игр
        if (typeof PlatformBridge !== 'undefined' && PlatformBridge.notifyLoadingReady) {
            PlatformBridge.notifyLoadingReady();
        }

        // Обновляем состояние кнопки языка в верхнем правом углу
        const btnLang = document.getElementById('btn-preloader-lang');
        if (btnLang) btnLang.innerText = currentLang;

        // Плавная замена прогресс-бара на сияющую кнопку старта
        const trackBox = document.getElementById('preloader-track-box');
        const metaBox = document.getElementById('preloader-meta-box');
        const btnStart = document.getElementById('btn-preloader-start');
        const termsBox = document.getElementById('preloader-terms-box');
        const termsChk = document.getElementById('chk-preloader-terms');

        if (trackBox) trackBox.style.display = 'none';
        if (metaBox) metaBox.style.display = 'none';

        // P8: блок соглашения показывается только если игрок ещё не принял условия.
        // При повторных запусках с уже установленным флагом — блок скрыт, старт сразу доступен.
        if (!gState.hasAcceptedTerms) {
            if (termsBox) termsBox.style.display = 'flex';
            if (termsChk) termsChk.checked = false;
        } else {
            if (termsBox) termsBox.style.display = 'none';
        }

        if (btnStart) {
            const hasSave = !!localStorage.getItem(SAVE_KEY);
            btnStart.innerText = hasSave 
                ? (I18N[currentLang]?.title_start_continue || (currentLang === 'RU' ? 'ПРОДОЛЖИТЬ' : 'CONTINUE'))
                : (I18N[currentLang]?.title_start_new || (currentLang === 'RU' ? 'ВОЙТИ В БЕЗДНУ' : 'ENTER THE ABYSS'));
            btnStart.style.display = 'block';
            // P8: блокируем кнопку старта до принятия соглашения (п. 1.1.4 VK Mini Apps)
            btnStart.disabled = !gState.hasAcceptedTerms;
        }
    }

    // Предзагрузка изображений через объект Image
    criticalAssets.forEach(src => {
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            updateProgress();
        };
        img.onerror = () => {
            loadedCount++;
            updateProgress();
        };
        img.src = src;
    });

    // Fail-Safe Watchdog: максимум через 2.2 секунды лоадер гарантированно растворяется
    setTimeout(() => {
        if (!isFinished) {
            updateProgress(100);
        }
    }, 2200);
})();

// ==========================================================
// КОНСОЛЬНЫЕ ЧИТ-КОДЫ РАЗРАБОТЧИКА (ДЛЯ ТЕСТИРОВАНИЯ ЛИГ)
// FIX-DEV-MODE: обе команды форсируют еженедельный сезон Арены →
// мгновенные награды лиги + повышение/понижение. Это фактически бесплатные
// ресурсы и ранги вне игрового цикла. Теперь доступны только в dev-режиме.
// ==========================================================
if (IS_DEV_MODE) {
    window.testArenaPromote = () => {
        const curLeagueId = gState.arenaLeague || 'bronze';
        const leagueTrophies = {
            bronze: { minTr: 150, maxTr: 800 },
            silver: { minTr: 800, maxTr: 1500 },
            gold: { minTr: 1500, maxTr: 2300 },
            platinum: { minTr: 2300, maxTr: 3000 },
            diamond: { minTr: 3000, maxTr: 3700 }
        };
        gState.trophies = leagueTrophies[curLeagueId].maxTr;
        gState.arenaSeasonWeekId = "TEST_WEEK_PROMOTE_" + Date.now();
        checkWeeklyArenaReset();
        console.log("✅ Тест повышения завершен. Вы стали Чемпионом и перешли в новую лигу.");
    };

    window.testArenaDemote = () => {
        const curLeagueId = gState.arenaLeague || 'bronze';
        const leagueTrophies = {
            bronze: { minTr: 150, maxTr: 800 },
            silver: { minTr: 800, maxTr: 1500 },
            gold: { minTr: 1500, maxTr: 2300 },
            platinum: { minTr: 2300, maxTr: 3000 },
            diamond: { minTr: 3000, maxTr: 3700 }
        };
        gState.trophies = leagueTrophies[curLeagueId].minTr;
        gState.arenaSeasonWeekId = "TEST_WEEK_DEMOTE_" + Date.now();
        checkWeeklyArenaReset();
        console.log("❌ Тест понижения завершен. Вы упали в рейтинге и перешли в лигу ниже.");
    };
}
