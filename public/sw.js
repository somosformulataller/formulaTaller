// Formula Taller — Service Worker
// Cache-first for static assets, network-first for navigation & API calls.
// IMPORTANT: never intercept /_next/ — those are build-hashed assets that
// change on every build; the browser's HTTP cache handles them. Caching them
// here would serve stale chunks after a rebuild and break the whole page.

const CACHE_NAME = 'formula-taller-v4';
const STATIC_ASSETS = [
  '/login',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets may not exist yet — ignore errors
      });
    })
  );
  self.skipWaiting();
});

// Activate: delete old caches and take control of open pages.
//
// NOTE: we intentionally do NOT force-reload open tabs here. A forced
// `client.navigate()` yanks the page out from under the user and can abort an
// in-flight request (e.g. deleting an attachment), which looked like "la web se
// recarga sola y el archivo vuelve a aparecer". The new SW still self-heals:
// navigations and RSC data are network-first and /_next/ is bypassed, so the
// next natural navigation already gets fresh content.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
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
