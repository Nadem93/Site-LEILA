const CACHE = 'internalis-v35';
const ASSETS = [
  './',
  './accueil.html',
  './dashboard.html',
  './aide.html',
  './notes.html',
  './chambres.html',
  './echeances.html',
  './repas.html',
  './visites.html',
  './nuit.html',
  './activites.html',
  './eig.html',
  './cvs.html',
  './medicaments.html',
  './vie-quotidienne.html',
  './dossiers.html',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
