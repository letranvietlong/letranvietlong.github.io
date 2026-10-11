// Logic service worker của PowerTrack. KHÔNG đăng ký trực tiếp file này —
// nó được nạp qua importScripts từ products/power-track/sw-power-track.js.
var CACHE_NAME = "powertrack-cache-v1";

// Code hay đổi, không có hash trong URL → network-first, cache chỉ để offline.
var APP_CODE_PATHS = [
  "/products/power-track/html/index.html",
  "/products/power-track/css/power-track.css",
  "/products/power-track/js/power-track-core.js",
  "/products/power-track/js/power-track.js"
];
var ICON_PATHS = [
  "/products/power-track/img/power-track-icon.svg",
  "/products/power-track/img/power-track-icon-32.png",
  "/products/power-track/img/power-track-icon-180.png"
];
var DATA_PATHS = [
  "/products/power-track/json/electricity-tariff.json",
  "/products/power-track/data/changelog.json",
  "/products/power-track/manifest.json"
];
var NETWORK_FIRST_PATHS = APP_CODE_PATHS.concat(DATA_PATHS);
var POWERTRACK_PATHS = APP_CODE_PATHS.concat(ICON_PATHS).concat(DATA_PATHS);

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
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
      // Cache Storage is shared by the whole origin (GoldTrack, FuelTrack and
      // LoveDays keep theirs in it too) — only ever delete our own old versions.
      return Promise.all(keys.filter(function(k){ return k.indexOf("powertrack-cache-") === 0 && k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Offline must also open the app from "/html/" (folder URL) and from links
// with a query (?utm=…, ?fbclid=…): requests are matched and cached by the
// normalised path, never by the full URL.
function cacheKey(url){
  var path = url.pathname;
  if(path === "/products/power-track/html/") path = "/products/power-track/html/index.html";
  return path;
}

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if(url.origin !== location.origin) return;
  var key = cacheKey(url);
  if(POWERTRACK_PATHS.indexOf(key) === -1) return;

  if(NETWORK_FIRST_PATHS.indexOf(key) !== -1){
    event.respondWith(
      fetch(event.request).then(function(res){
        // Only a good response may replace the offline copy — caching a
        // transient 404/5xx would overwrite the last working version.
        if(res.ok){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(key, copy); });
          return res;
        }
        return caches.match(key).then(function(cached){ return cached || res; });
      }).catch(function(){
        return caches.match(key).then(function(cached){ return cached || Response.error(); });
      })
    );
  } else {
    event.respondWith(
      caches.match(key).then(function(cached){
        var fetchPromise = fetch(event.request).then(function(res){
          if(res.ok){
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function(cache){ cache.put(key, copy); });
          }
          return res;
        }).catch(function(){ return cached || Response.error(); });
        return cached || fetchPromise;
      })
    );
  }
});
