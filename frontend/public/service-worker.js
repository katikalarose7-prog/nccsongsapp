/* Minimal service worker — required for Chrome's "Install app" prompt to
   appear on Android (a registered service worker is one of the official
   installability criteria). Also gives a small amount of offline caching
   for the app shell, so the page background and layout still render even
   with no signal, even though song data itself needs the network.
   This intentionally does NOT cache API responses — songs should always
   come from the network so users see up-to-date content. */

const CACHE_NAME = 'ncc-songs-shell-v1';
const SHELL_FILES = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept API calls — always go to the network for fresh data.
  if (request.url.includes('/api/')) return;

  // Network-first for navigation requests, falling back to cached shell if offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }
});