// Formula Taller — Service Worker
// Cache-first for static assets, network-first for navigation & API calls.
// IMPORTANT: never intercept /_next/ — those are build-hashed assets that
// change on every build; the browser's HTTP cache handles them. Caching them
// here would serve stale chunks after a rebuild and break the whole page.

const CACHE_NAME = 'formula-taller-v3';
const STATIC_ASSETS = [
  '/login',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Track whether this SW is REPLACING a previous one (an update) vs. a first
// install. self.registration.active is non-null only when an older SW is
// already running, i.e. we are upgrading.
let isUpdate = false;

// Install: cache core assets
self.addEventListener('install', (event) => {
  isUpdate = !!self.registration.active;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets may not exist yet — ignore errors
      });
    })
  );
  self.skipWaiting();
});

// Activate: delete old caches, take control, and — when we just replaced an
// older SW — force every open tab to reload so it picks up fresh HTML/assets
// through the new (fixed) fetch strategy. This makes a stale SW self-heal on
// the next reload, with no manual unregister needed.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
      if (isUpdate) {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => client.navigate(client.url));
      }
    })()
  );
});

// Fetch strategy:
// - /_next/ build assets → bypass SW entirely (always network)
// - API / Supabase calls → network-first
// - HTML navigations    → network-first (avoid stale HTML referencing dead chunks)
// - Everything else     → cache-first with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, and all Next.js build assets.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/_next/')
  ) {
    return;
  }

  // Network-first for API and Supabase calls
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Network-first for Next.js App Router data (RSC) requests.
  // A client-side navigation (router.push / <Link>) doesn't reload the page:
  // Next fetches the target route's RSC payload as a plain GET with the `RSC`
  // header and a `?_rsc=<hash>` query param. Its request.mode is NOT 'navigate',
  // so without this branch it would fall through to the cache-first strategy
  // below and serve a stale (or empty prefetch) payload — that's the "la orden
  // sale vacía hasta que recargo" bug. A full reload works because it IS a
  // 'navigate' request. These payloads must always come from the network.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Network-first for page navigations (always get fresh HTML; fall back to cache offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((c) => c || caches.match('/login')))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
