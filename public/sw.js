/*
 * AlMart service worker (needed for the installable app / Google Play version).
 * - Pages: always from the network; if offline, the last cached copy or an offline page.
 * - /assets/* (hashed Vite files) and icons: cache first.
 * - /api/* is never cached (listings, sign-in and admin must always be live).
 */
const VERSION = 'v1';
const STATIC_CACHE = `almart-static-${VERSION}`;
const PAGE_CACHE = `almart-pages-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.well-known/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep the app shell (the SPA's index.html) for offline starts
          if (res.ok && url.pathname === '/') {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(async () => (await caches.match('/', { cacheName: PAGE_CACHE })) || caches.match(OFFLINE_URL))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
