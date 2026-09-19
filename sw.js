/**
 * sw.js - SpeedRecall Service Worker
 * Strategy: Cache-first for core shell; Stale-while-revalidate for local assets.
 * Scope: Compatible with GitHub Pages subpaths via relative path resolution.
 */

const CACHE_VERSION = "speedrecall-v1.0.0";
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/base.css",
  "./css/stage.css",
  "./css/drawer.css",
  "./js/app.js",
  "./js/state.js",
  "./js/engine.js",
  "./js/normalizer.js",
  "./js/importer.js",
  "./js/tv-nav.js",
  "./data/zh-hsk1.json",
  "./data/fr-verbs.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/tv-banner-320x180.png"
];

// Installation: Pre-cache static shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activation: Purge outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_VERSION)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Interception: Stale-While-Revalidate for local assets
self.addEventListener("fetch", (event) => {
  // Only handle GET requests; ignore non-HTTP(S) schemas (e.g. extensions)
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // If response is valid, update the cache in the background
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failure: offline or connection dropped
          return cachedResponse;
        });

      // Return cached asset immediately if found; otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
