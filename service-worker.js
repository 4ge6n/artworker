// service-worker.js
const CACHE = 'awf-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  // Runtime cache for images (stale-while-revalidate)
  if (url.pathname.match(/\.(png|jpg|jpeg|webp)$/) || url.hostname.includes('mzstatic.com')){
    e.respondWith((async()=>{
      const cache = await caches.open(CACHE);
      const cached = await cache.match(e.request);
      const fetchPromise = fetch(e.request).then(networkResponse => {
        cache.put(e.request, networkResponse.clone());
        return networkResponse;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })());
    return;
  }
  // Default: cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
