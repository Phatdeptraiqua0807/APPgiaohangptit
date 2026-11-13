/* ptitngon Service Worker - PWA & Offline Cache */
const CACHE_NAME = 'ptitngon-cache-v3';
const CORE_SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css?v=8.76',
  './js/fluent-icons.js?v=2.6',
  './js/food-data.js',
  './js/database.js?v=1.2',
  './js/app.js?v=9.17',
  './js/catalog-profile.js?v=5.10',
  './js/ai-chat.js?v=7.7',
  './js/dish-detail.js?v=6.14',
  './js/store-detail.js?v=1.3',
  './js/db-manager-core.js?v=4.8',
  './js/order-success.js?v=1.9',
  './js/router.js?v=1.6',
  './assets/images/hung_chien_gion.jpg',
  './assets/images/vietnamese-food-top-banner.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.endsWith('/sw.js') || url.pathname === '/sw.js') return;

  // 1. Điều hướng trang (HTML): Network-First + Offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // 2. Tài nguyên hình ảnh / icon / animation: Cache-First
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // 3. CSS / JS / JSON / Webmanifest: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
