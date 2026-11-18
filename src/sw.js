const cacheName = 'toeic-800-shell-__VERSION__';
const scope = self.registration.scope;
const files = __FILES__.map((file) => new URL(file, scope).href);
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
