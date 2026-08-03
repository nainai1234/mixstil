const APP_CACHE = 'snooze-app-shell-v2';
const OFFLINE_AUDIO_CACHE = 'snooze-offline-audio-v1';
const APP_SHELL = ['/', '/listen', '/sounds', '/profile', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![APP_CACHE, OFFLINE_AUDIO_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.destination === 'audio' || url.pathname.startsWith('/audio/') || url.pathname.startsWith('/exports/') || url.pathname.includes('/download')) {
    event.respondWith(
      caches.open(OFFLINE_AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/listen').then((cached) => cached ?? caches.match('/'))));
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok) return response;
          const clone = response.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)),
    );
  }
});
