const cacheName = 'toeic-800-shell-c64c0a3127bf3a57';
const scope = self.registration.scope;
const files = ["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","assets/index-7mRFZnpx.css","assets/firebase-auth-CtUjCwYI.js","assets/firebase-database-CJeyFwG8.js","assets/index-C-8LIUJl.js"].map((file) => new URL(file, scope).href);
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('toeic-800-shell-') && key !== cacheName).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(cacheName).then((cache) => cache.match(scope))));
  } else if (files.includes(event.request.url)) {
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(event.request)).then((hit) => hit || fetch(event.request)));
  }
});
