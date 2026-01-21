// Cache name
const CACHE_NAME = 'tee-elite-v4';

// Files to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/home.html',
  '/members.html',
  '/tee-room.html',
  '/between-the-tees.html',
  '/live.html',
  '/admin.html',
  '/styles.css',
  '/pwa-nav.js',
  '/pwa-nav.css',
  '/manifest.json',
  '/images/tee-elite-logo.png',
  '/images/tee-elite-favicon.png',
  '/images/tmac-logo.png',
  '/resources.html'
];

// Install - cache app shell (tolerate individual failures so one 404 doesn't break install)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache each URL individually so a single failed request doesn't abort the entire install.
    await Promise.allSettled(
      urlsToCache.map(async (url) => {
        try {
          const req = new Request(url, { cache: 'reload' });
          const res = await fetch(req);
          if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'NO_RESPONSE'}`);
          await cache.put(req, res);
        } catch (err) {
          // Keep SW install healthy even if a file is missing (ex: /resources.html 404)
          console.warn('[SW] Skipping cache for', url, err);
        }
      })
    );
  })());
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch - network first, then cache (so you always get fresh content)
self.addEventListener('fetch', event => {
  // Only handle GET requests; let POST/PUT/etc go straight to network.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never cache API responses; always hit the server.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If we got a valid response, clone it and cache it
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(() => {});
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});

// Push notification received
self.addEventListener('push', event => {
  console.log('Push received:', event);

  let data = {
    title: '🔴 Dr. TMac is LIVE!',
    body: 'Join the live session now!',
    url: '/live.html',
    icon: '/images/tee-elite-favicon.png',
    badge: '/images/tee-elite-favicon.png'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: { url: data.url }
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/live.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
