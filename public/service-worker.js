const CACHE_NAME = 'tee-elite-v3';
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

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    data: {
      url: data.url
    },
    actions: [
      { action: 'join', title: 'Join Now' },
      { action: 'dismiss', title: 'Later' }
    ],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification clicked
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/live.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes('tmacmastermind.com') && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
