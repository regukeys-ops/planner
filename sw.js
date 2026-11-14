/* Regu's Planner service worker: opens offline, but always fetches the newest app when online. */
const VERSION = 'v9';
const CACHE = 'planner-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];
self.addEventListener('install', e => {
  // cache:'reload' skips the browser's HTTP cache so a new version is really fetched
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;                                  // API calls go straight to the network
  if (url.origin === location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
      // The app page: newest from the network (3 s limit), saved copy when offline
      e.respondWith(caches.open(CACHE).then(async c => {
        try {
          const net = await Promise.race([fetch(req, { cache: 'no-cache' }), new Promise((_, rej) => setTimeout(() => rej('slow'), 3000))]);
          if (net.ok) c.put('./index.html', net.clone());
          return net;
        } catch (err) {
          return (await c.match('./index.html')) || (await c.match(req, { ignoreSearch: true })) || Response.error();
        }
      }));
      return;
    }
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(req, { ignoreSearch: true })) || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; })));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
  }
});
