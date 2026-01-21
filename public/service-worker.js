// service-worker.js
const CACHE_NAME = 'tee-elite-v1';

// Keep your list, but don't let one bad request fail install
const urlsToCache = [
  '/',
  '/home.html',
  '/members.html',
  '/resources.html',
  '/retreats.html',
  '/profile.html',
  '/admin.html',
  '/styles.css',
  '/pwa-nav.css',
  '/pwa-nav.js',
  '/tee-elite-logo.png',
  '/tee-elite-favicon.png',
  '/tmac-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache each item individually so one failure doesn't break install
    for (const url of urlsToCache) {
      try {
        await cache.add(url);
      } catch (err) {
        // Skip failures (e.g., auth-gated routes, missing files, etc.)
        console.warn('[SW] Skipped caching:', url, err);
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
    }));
  })());
});

// Network-first for HTML/navigation, cache-first for static GETs,
// and do NOT cache API calls.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and skip API routes entirely
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation: network first, fallback to cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache first, then network
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const resp = await fetch(req);
    // Only cache successful same-origin basic responses
    if (resp && resp.ok && resp.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, resp.clone()).catch(() => {});
    }
    return resp;
  })());
});
