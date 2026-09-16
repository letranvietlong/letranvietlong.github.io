// Service worker for GoldTrack only.
//
// This file has to live at the repo root next to every other product page
// on this site, so its registration scope is technically the whole origin
// (browsers can't scope a service worker narrower than its own directory).
// To make that harmless, every handler below checks GOLDTRACK_PATHS first
// and does nothing at all for any request that isn't one of GoldTrack's own
// files — other pages on the site see no behavior change whatsoever.
var CACHE_NAME = "goldtrack-cache-v2";

// GoldTrack.html is an actively-edited single file with no build hash in its
// URL, so it must be network-first (see below) — cache-first on it meant
// every visit kept re-serving whatever HTML happened to be cached at
// install time, silently hiding every later fix/update behind a stale copy
// (the exact "site still shows old source" bug this app has hit before,
// this time self-inflicted by the service worker instead of the git race).
var HTML_PATHS = ["/GoldTrack.html"];
// Icon files are named by content/size and effectively never change, so
// cache-first (instant, no network round trip) is safe for these.
var ICON_PATHS = [
  "/img/goldtrack-icon.svg",
  "/img/goldtrack-icon-32.png",
  "/img/goldtrack-icon-180.png"
];
var DATA_PATHS = [
  "/data/gold-price.json",
  "/data/gold-price-history.json",
  "/data/gold-news.json",
  "/data/changelog.json"
];
var NETWORK_FIRST_PATHS = HTML_PATHS.concat(DATA_PATHS);
var GOLDTRACK_PATHS = HTML_PATHS.concat(ICON_PATHS).concat(DATA_PATHS);

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // App shell must succeed for install to count as done. Data files are
      // best-effort here — the fetch handler below will fill them in on the
      // first successful network request either way, and a data endpoint
      // hiccup at install time shouldn't block offline support for the app
      // shell itself.
      return cache.addAll(ICON_PATHS).then(function(){
        return Promise.all(NETWORK_FIRST_PATHS.map(function(p){ return cache.add(p).catch(function(){}); }));
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if(url.origin !== location.origin) return;
  if(GOLDTRACK_PATHS.indexOf(url.pathname) === -1) return; // not ours — let the browser handle it normally

  var isNetworkFirst = NETWORK_FIRST_PATHS.indexOf(url.pathname) !== -1;

  if(isNetworkFirst){
    // Network-first: always show the freshest HTML/price/changelog when
    // online, fall back to the last cached copy so the app still works
    // offline.
    event.respondWith(
      fetch(event.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        return res;
      }).catch(function(){
        return caches.match(event.request).then(function(cached){ return cached || Response.error(); });
      })
    );
  } else {
    // Cache-first for icons: instant load offline, refreshed in the background.
    event.respondWith(
      caches.match(event.request).then(function(cached){
        var fetchPromise = fetch(event.request).then(function(res){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
          return res;
        }).catch(function(){ return cached || Response.error(); });
        return cached || fetchPromise;
      })
    );
  }
});
