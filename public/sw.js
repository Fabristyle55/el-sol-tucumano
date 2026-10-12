// Service worker de El Sol Siciliano: permite instalar el sistema como app y
// que abra aunque la conexión esté mala. Los datos siempre se piden en vivo a
// Firebase y al backend; acá solo se guardan los archivos de la aplicación.
const CACHE = 'el-sol-v3';
const BASE = ['/app', '/marca/sol-192.png', '/marca/sol-512.png', '/marca/logo.jpg', '/manifest.webmanifest', '/app.webmanifest'];
// Cada parte guarda su propia página para abrir sin conexión: El Sol App (/app) y la página completa.
const paginaDe = (path) => (path === '/app' || path.startsWith('/app/') ? '/app' : '/_sistema');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/.netlify/')) return;

  // Páginas: primero la red (siempre la versión nueva); sin conexión, la última guardada.
  if (req.mode === 'navigate') {
    const clave = paginaDe(url.pathname);
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(clave, copia)); } return r; })
      .catch(() => caches.match(clave)));
    return;
  }
  // Archivos con nombre versionado (JS, CSS, imágenes de la marca): primero la caché.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/marca/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    })));
  }
});
