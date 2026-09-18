/* Offline cache for the Pocket 3 field guide.
 *
 * Strategy: stale-while-revalidate. A cached response is served immediately so
 * the guide opens instantly and works with no signal at all, while a fresh copy
 * is fetched in the background and stored for next time. That way an update
 * published after someone has already saved the page still reaches them on
 * their next visit, instead of them being stuck on the version they first saw.
 */
const CACHE = 'pocket3-argentina-v2';

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

    const fresh = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => null);

    // Serve the cached copy at once; let the refetch update the cache behind it.
    if (cached) {
      event.waitUntil(fresh);
      return cached;
    }

    const res = await fresh;
    if (res) return res;

    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html', { ignoreSearch: true })
        || await caches.match('./', { ignoreSearch: true });
      if (shell) return shell;
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  })());
});
