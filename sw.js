/* =====================================================
   Service Worker — XXIV Campeonato Regional del Sur
   MDD 2026 — PWA offline cache
   ===================================================== */

const CACHE_NAME     = 'mdd2026-v1';
const CACHE_DYNAMIC  = 'mdd2026-dynamic-v1';

// Recursos que se cachean en la instalación
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-512x512-maskable.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&family=Teko:wght@600;700&display=swap'
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // Estrategia: Cache First → Network fallback (para assets estáticos)
  // Network First → Cache fallback (para datos dinámicos / APIs)
  const isDynamicAPI =
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.includes('/spreadsheets');

  if (isDynamicAPI) {
    // Network First para datos en tiempo real
    event.respondWith(networkFirst(request));
  } else {
    // Cache First para recursos estáticos
    event.respondWith(cacheFirst(request));
  }
});

/* ── Estrategia Cache First ── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Sin conexión y sin cache: devuelve página offline si existe
    const fallback = await caches.match('./index.html');
    return fallback || new Response('Sin conexión', { status: 503 });
  }
}

/* ── Estrategia Network First ── */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Sin conexión', { status: 503 });
  }
}

/* ── PUSH NOTIFICATIONS (base) ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title   = data.title   || 'XXIV Campeonato MDD 2026';
  const options = {
    body:  data.body  || 'Hay una actualización disponible.',
    icon:  './icons/icon-192x192.png',
    badge: './icons/icon-96x96.png',
    data:  { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || './')
  );
});
