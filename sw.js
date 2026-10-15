/* ==========================================================
   LORDS OF THE ABYSS — SERVICE WORKER (sw.js)
   v3.3: Network-First for Code & Cache-First for Heavy Assets
   ========================================================== */

const CACHE_NAME = 'lords-abyss-v4.7.4';

// Полный набор ядра и ключевой графики для автономной работы в оффлайне
const STATIC_ASSETS = [
    './',
    'index.html',
    'terms.html',
    'privacy.html',
    'style.css',
    'engine.js',
    'data-heroes.js',
    'data-i18n.js',
    'data-legal.js',
    'manifest.json',
    'assets/bg/roster.webp',
    'assets/bg/hq.webp',
    'assets/bg/altar.webp',
    'assets/bg/arena.webp',
    'assets/bg/dungeon.webp',
    'assets/bg/raid.webp',
    'assets/bg/pass.webp',
    // FIX-SW-CLEANUP: assets/bg/quests.webp убран из STATIC_ASSETS — файл отсутствует
    // в репозитории, даёт warning при каждой установке SW. CSS-фолбэк (#0d1217) работает.
    'assets/bg/shop.webp',
    'assets/icons/gold.webp',
    'assets/icons/crystal.webp',
    'assets/icons/relic.webp',
    'assets/icons/army.webp',
    'assets/icons/shop_tickets.webp',
    'assets/icons/swords_cp.webp',
    'assets/icons/icon_energy.webp',
    'assets/icons/portal_abyss.webp',
    'assets/icons/icon_ad.webp',
    'assets/icons/icon_hourglass.webp',
    'assets/icons/boss_leviathan.webp',
    'assets/icons/demon_imp.webp',
    'assets/icons/trophy.webp',
    'assets/icons/league_bronze.webp',
    'assets/icons/league_silver.webp',
    'assets/icons/league_gold.webp',
    'assets/icons/league_platinum.webp',
    'assets/icons/league_diamond.webp',
    'assets/icons/hud_pass.webp',
    'assets/icons/hud_wheel.webp',
    'assets/icons/hud_calendar.webp',
    'assets/icons/hud_quests.webp',
    'assets/icons/elem_light.webp',
    'assets/icons/elem_undead.webp',
    'assets/icons/elem_chaos.webp',
    'assets/icons/elem_demon.webp',
    'assets/icons/shop_crystals.webp',
    'assets/icons/shop_crystals_2.webp',
    'assets/icons/shop_crystals_3.webp',
    'assets/icons/shop_crystals_4.webp',
    'assets/icons/shop_crystals_5.webp',
    'assets/icons/shop_crystals_6.webp',
    'assets/icons/shop_tickets_3.webp',
    'assets/icons/shop_gold.webp',
    'assets/icons/shop_relics.webp',
    'assets/cards/card_back_common.webp',
    'assets/cards/card_back_rare.webp',
    'assets/cards/card_back_epic.webp',
    'assets/cards/card_back_legendary.webp',
    'assets/buildings/keep.webp',
    'assets/buildings/mine.webp',
    'assets/buildings/barracks.webp',
    'assets/advisor.webp',
    'assets/audio/theme.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (const asset of STATIC_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn('[SW] Не критичный пропуск ассета при предзагрузке:', asset);
                }
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
        const url = new URL(event.request.url);

        // 1. Пропуск внешних SDK платформ без перехвата
        if (url.origin !== location.origin || url.pathname.includes('/sdk/') || url.pathname.includes('vk-bridge')) {
            return;
        }

        // 2. Исполняемый код (.js, .css, HTML, manifest): стратегия NETWORK-FIRST с защитой от query-хвостов
        const isCodeFile = url.pathname.endsWith('.js') || 
                           url.pathname.endsWith('.css') || 
                           url.pathname.endsWith('.html') || 
                           url.pathname.endsWith('/') || 
                           url.pathname.endsWith('manifest.json');

        if (isCodeFile) {
            event.respondWith(
                fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return networkResponse;
                }).catch(() => {
                    return caches.match(event.request, { ignoreSearch: true });
                })
            );
            return;
        }

        // 3. Графика (assets/**): стратегия CACHE-FIRST с ignoreSearch
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return networkResponse;
                }).catch(() => {});
            })
        );
    });