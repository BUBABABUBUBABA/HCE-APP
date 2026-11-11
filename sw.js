/* Service worker: tiene l'app disponibile offline. I contenuti del corso stanno in IndexedDB, non qui. */
var CACHE = 'hce-app-2026-11-11-52960e61';
var FILES = ["./", "index.html", "percorso.html", "studio.html", "protocollo.html", "e3.html", "mib.html", "prep.html", "strumenti.html", "istair.html", "feedback.html", "hce.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('hce-app-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    // prima la rete (così vedi subito gli aggiornamenti), se offline la copia salvata
    e.respondWith(fetch(req, { credentials: 'include' }).then(function (r) {
      if (r && r.ok && !r.redirected) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
      return r;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }).then(function (m) { return m || caches.match('./index.html'); }); }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); return r; });
    }));
  }
});
