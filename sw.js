// SpanishPath service worker
// Enables offline play. Uses stale-while-revalidate so updates roll out
// the next time the user is online but offline-only sessions still work.

const CACHE_NAME = 'spanishpath-v11';
const PRECACHE_URLS = [
  './',
  './index.html',
  './sw.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Best-effort precache; don't fail install if a URL can't fetch right now
      Promise.all(PRECACHE_URLS.map(url =>
        cache.add(url).catch(() => null)
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET. Anything else (POST to Supabase, etc.) goes to network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Don't cache Supabase API calls — those need real-time data.
  // We DO cache the Supabase JS library and Google Fonts (CDN assets).
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(response => {
        // Only cache successful, basic/cors responses
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(()=>{});
        }
        return response;
      }).catch(() => cached); // Network failed, fall back to cache

      // Stale-while-revalidate: return cached immediately if we have it
      return cached || network;
    })
  );
});
