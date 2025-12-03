const CACHE_NAME = 'tee-elite-v2';
const urlsToCache = [
  '/',
  '/home.html',
  '/members.html',
  '/profile.html',
  '/resources.html',
  '/retreats.html',
  '/between-the-tees.html',
  '/member-login.html',
  '/admin.html',
  '/styles.css',
  '/pwa-nav.css',
  '/pwa-nav.js',
  '/images/tee-elite-favicon.png',
  '/images/tee-elite-logo.png',
  '/images/tmac-logo.png'
];

// Install - cache files
self.addEventListener('install', event => {
  // Force the new service worker to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app files');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch - network first, then cache (so you always get fresh content)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If we got a valid response, clone it and cache it
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});
