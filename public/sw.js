const CACHE_NAME = 'tlu-schedule-v2';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icon.png',
  '/map_tlu.jpg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bỏ qua các request không phải GET hoặc request đến API/Firebase
  if (event.request.method !== 'GET' || 
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Không cache nếu response lỗi hoặc không hợp lệ
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone response để vừa trả về cho browser vừa lưu vào cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Nếu mất mạng và không có trong cache, trả về trang chủ (index.html)
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
