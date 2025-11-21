self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('quantum-radio-cache').then((cache) => {
      return cache.addAll([
        '/radio/index.html',
        '/radio/scripts.js',
        '/radio/styles.css',
        '/images/icon-192x192.png',
        '/images/icon-512x512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});