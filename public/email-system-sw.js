const CACHE_NAME = 'tmac-email-system-v2';
const urlsToCache = [
  'tmac-email-marketing-system.html',
  'email-system-manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Montserrat:wght@300;400;500;600&display=swap',
  'https://tmacinspired.com/wp-content/uploads/2025/04/cropped-icon-512x512-1.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Cache install error:', err);
      })
  );
  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Activate event - clean up old caches and take control immediately
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
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - network first, then cache fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If we got a valid response, clone it and update the cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
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

// Background sync for when online again
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('Background sync triggered');
  }
});

// Push notifications (for future use)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Time to check your email marketing tasks!',
    icon: 'https://tmacinspired.com/wp-content/uploads/2025/04/cropped-icon-512x512-1.png',
    badge: 'https://tmacinspired.com/wp-content/uploads/2025/04/cropped-icon-512x512-1.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('TMac Email System', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('tmac-email-marketing-system.html')
    );
  }
});
