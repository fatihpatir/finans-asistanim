const CACHE_NAME = 'finans-v6-' + Date.now(); 
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png'
];

// Kurulumda dosyaları önbelleğe al
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Beklemeden yeni sürüme geç
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Eski önbellekleri temizle
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Ağ öncelikli strateji (Önce internete bak, yoksa önbelleği kullan)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
