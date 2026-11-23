const CACHE = 'burger-app-v40';   // app files: bump when you want old copies dropped
const IMG = 'jeun-koyo-media';    // pictures and 3D models: kept between versions
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const MAX_MEDIA = 400;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isMedia = (req, url) => req.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|ico|glb)$/i.test(url.pathname) || url.pathname.includes('/storage/v1/object/public/');

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_MEDIA; i++) await cache.delete(keys[i]);
}

// Pictures: show the saved copy straight away (no waiting for the network), and fetch the newest copy in the background for next time.
async function media(e, req, url) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req);
  const fresh = (async () => {
    try {
      let res = await fetch(url.origin === self.location.origin ? new Request(req, { cache: 'no-cache' }) : new Request(req.url, { mode: 'cors' }));
      if (res && res.ok) { await cache.put(req, res.clone()); trim(cache); }
      return res;
    } catch (_) { try { return await fetch(req); } catch (__) { return undefined; } }
  })();
  if (hit) { e.waitUntil(fresh); return hit; }
  return (await fresh) || Response.error();
}

// Everything else (pages, scripts, menu data): newest from the network, saved copy when offline or the network is slow.
async function live(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  });
  const hit = await cache.match(req);
  if (!hit) return net.catch(() => (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
  return Promise.race([net.catch(() => hit), new Promise((ok) => setTimeout(() => ok(hit), 5000))]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (isMedia(req, url)) e.respondWith(media(e, req, url));
  else e.respondWith(live(req));
});
