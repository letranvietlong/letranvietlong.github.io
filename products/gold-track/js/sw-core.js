// Logic service worker của GoldTrack. KHÔNG đăng ký trực tiếp file này —
// nó được nạp qua importScripts từ products/gold-track/sw-gold-track.js
// (đọc file đó để biết vì sao vỏ phải nằm ngay trong products/gold-track/,
// không lồng thêm vào js/).
//
// Vỏ đăng ký với scope /products/gold-track/ — đúng và đủ cho mọi trang của
// GoldTrack, không rộng hơn. Mọi handler dưới đây vẫn kiểm tra
// GOLDTRACK_PATHS trước khi làm gì, giữ nguyên tắc phòng thủ hai lớp dù scope
// giờ đã tự nhiên hẹp lại đúng phạm vi GoldTrack.
var CACHE_NAME = "goldtrack-cache-v9";

// The page plus its stylesheet and script — all actively edited, none with a
// build hash in the URL, so all three must be network-first (see below).
// Cache-first on these meant every visit kept re-serving whatever was cached
// at install time, silently hiding every later fix/update behind a stale copy
// (the exact "site still shows old source" bug this app has hit before,
// this time self-inflicted by the service worker instead of the git race).
// The CSS/JS entries matter for offline too: the HTML alone would restore
// from cache as an unstyled, non-functioning page without them.
var APP_CODE_PATHS = [
  "/products/gold-track/html/index.html",
  "/products/gold-track/css/gold-track.css",
  "/products/gold-track/js/gold-track.js"
];
// Icon files are named by content/size and effectively never change, so
// cache-first (instant, no network round trip) is safe for these.
var ICON_PATHS = [
  "/products/gold-track/img/gold-track-icon.svg",
  "/products/gold-track/img/gold-track-icon-32.png",
  "/products/gold-track/img/gold-track-icon-180.png"
];
var DATA_PATHS = [
  "/products/gold-track/data/gold-price.json",
  "/products/gold-track/data/gold-price-history.json",
  "/products/gold-track/data/changelog.json"
];
var NETWORK_FIRST_PATHS = APP_CODE_PATHS.concat(DATA_PATHS);
var GOLDTRACK_PATHS = APP_CODE_PATHS.concat(ICON_PATHS).concat(DATA_PATHS);

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
