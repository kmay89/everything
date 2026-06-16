/* Service worker for Everything That Glows — offline reading.
   Bump CACHE when the published files change to refresh the offline copy. */
const CACHE = 'etg-v5';
const CORE = [
  '/', '/index.html', '/read.html', '/privacy.html', '/404.html',
  '/manifest.webmanifest', '/og-image.png',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Let media (e.g. the welcome tone) go straight to the network so Range
  // requests get a 206 — Safari/iOS refuse to play a cached 200.
  if (url.pathname.endsWith('.mp3') || req.headers.has('range')) return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first: fresh pages online, cached copy offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy))); }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/read.html').then((f) => f || caches.match('/index.html'))))
    );
    return;
  }

  // Cache-first for static assets, refreshing in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => { if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
        .catch(() => cached);
      if (cached) { e.waitUntil(net); return cached; }
      return net;
    })
  );
});
