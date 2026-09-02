// AWE System Service Worker
// Version 1.1.0

const CACHE_NAME = 'awe-system-v2';
const STATIC_CACHE = 'awe-static-v2';
const DYNAMIC_CACHE = 'awe-dynamic-v2';

// Never cache responses larger than this (64 MB). On-device LLM models are
// 0.5–1.6 GB downloads that must never enter Cache Storage.
const MAX_CACHEABLE_BYTES = 64 * 1024 * 1024;

function isCacheable(response) {
  if (response.status !== 200) return false;
  const length = Number(response.headers.get('content-length'));
  return !(Number.isFinite(length) && length > MAX_CACHEABLE_BYTES);
}

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/squ_logo.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[Service Worker] Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests (they need fresh data)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Pass cross-origin requests through untouched. This covers the on-device
  // model downloads from huggingface.co — cloning a 0.5–1.6 GB response into
  // Cache Storage crashes mobile tabs and wastes the storage quota.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Partial-content responses cannot be stored in Cache Storage.
  if (request.headers.has('range')) {
    return;
  }

  // For navigation requests, try network first, then cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (isCacheable(response)) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response and update cache in background
          fetch(request)
            .then((response) => {
              if (isCacheable(response)) {
                caches.open(DYNAMIC_CACHE).then((cache) => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (isCacheable(response)) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
      })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for pending essays (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-essays') {
    console.log('[Service Worker] Syncing pending essays...');
    // Handle offline essay sync when back online
  }
});

console.log('[Service Worker] Registered');
