/* Thirsty Beaches — offline shell
   Network first for everything; the cache is only an offline fallback.
   Only same-origin 200, non-redirected responses (plus the Google Fonts CSS/files) are stored,
   so the cache never holds a 404/redirect, never grows with map tiles, and never
   answers a request while the network works (pages always come fresh). */
const V = 'tb-ux20261025';
const SHELL = ['/', '/menu', '/card', '/styles.css', '/app.js', '/arcade.js', '/cup-bubbles.js',
               '/styles.css?v=ux20261025', '/app.js?v=ux20261025',
               '/arcade.js?v=ux20261025', '/cup-bubbles.js?v=autobubbles20261018',
               '/assets/cup-80s-shell.webp?v=arcade20261018', '/assets/cup-80s-cream.png?v=arcade20261018',
               '/assets/logo.png?v=logo20261018', '/assets/logo-nav.png?v=logo20261018',
               '/assets/logo-480.webp?v=logo20261018', '/assets/logo-720.webp?v=logo20261018',
               '/assets/logo-nav.webp?v=logo20261018', '/assets/logo-nav@2x.webp?v=logo20261018',
               '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  // the API (location, cards, scores), map tiles and CDN scripts go straight to the network
  if (!same && !FONTS.test(url.origin)) return;
  // large media streams from the network, never the cache
  if (/\.(mp4|webm)$/.test(url.pathname)) return;

  const isPage = req.mode === 'navigate';
  e.respondWith(
    fetch(req)
      .then(r => {
        if ((r.ok && !r.redirected && (r.type === 'basic' || r.type === 'cors')) || (!same && r.type === 'opaque')) {
          const copy = r.clone();
          caches.open(V).then(c => c.put(req, copy)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(req, { ignoreSearch: isPage })
        .then(m => m || (isPage ? caches.match('/') : undefined))
        .then(m => m || Response.error()))
  );
});
