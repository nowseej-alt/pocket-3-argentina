/* Offline cache for the Pocket 3 field guide.
   Everything the page needs is inlined except the web fonts, so caching
   the document plus whatever it pulls on first load is enough. */
const CACHE = 'pocket3-argentina-v1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of ['./', './index.html']) {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (_) { /* fine */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        const cache = await caches.open(CACHE);
        cache.put(req, copy).catch(() => {});
      }
      return res;
    } catch (_) {
      // Offline and not cached: for a navigation, hand back the guide itself.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html', { ignoreSearch: true })
          || await caches.match('./', { ignoreSearch: true });
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
