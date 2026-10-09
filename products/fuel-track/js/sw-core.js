// Logic service worker của FuelTrack. KHÔNG đăng ký trực tiếp file này —
// nó được nạp qua importScripts từ products/fuel-track/sw-fuel-track.js
// (đọc file đó để biết vì sao vỏ phải nằm ngay trong products/fuel-track/).
var CACHE_NAME = "fueltrack-cache-v4";

// Code hay đổi, không có hash trong URL → network-first, cache chỉ để offline.
var APP_CODE_PATHS = [
  "/products/fuel-track/html/index.html",
  "/products/fuel-track/css/fuel-track.css",
  "/products/fuel-track/js/fuel-track.js",
  "/products/fuel-track/js/fuel-track-log.js"
];
var ICON_PATHS = [
  "/products/fuel-track/img/fuel-track-icon.svg",
  "/products/fuel-track/img/fuel-track-icon-32.png",
  "/products/fuel-track/img/fuel-track-icon-180.png"
];
var DATA_PATHS = [
  "/products/fuel-track/data/fuel-price.json",
  "/products/fuel-track/data/fuel-price-history.json",
  "/products/fuel-track/data/changelog.json",
  "/products/fuel-track/manifest.json"
];
var NETWORK_FIRST_PATHS = APP_CODE_PATHS.concat(DATA_PATHS);
var FUELTRACK_PATHS = APP_CODE_PATHS.concat(ICON_PATHS).concat(DATA_PATHS);

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
      // Cache Storage is shared by the whole origin (GoldTrack's SW lives in
      // it too) — only ever delete our own old versions.
      return Promise.all(keys.filter(function(k){ return k.indexOf("fueltrack-cache-") === 0 && k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Offline must also open the app from "/html/" (folder URL) and from links
// with a query (?utm=…, ?fbclid=…): requests are matched and cached by the
// normalised path, never by the full URL.
function cacheKey(url){
  var path = url.pathname;
  if(path === "/products/fuel-track/html/") path = "/products/fuel-track/html/index.html";
  return path;
}

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if(url.origin !== location.origin) return;
  var key = cacheKey(url);
  if(FUELTRACK_PATHS.indexOf(key) === -1) return;

  if(NETWORK_FIRST_PATHS.indexOf(key) !== -1){
    event.respondWith(
      fetch(event.request).then(function(res){
        // Only a good response may replace the offline copy — caching a
        // transient 404/5xx would overwrite the last working version. On such
        // an error, serve that last working version if we have one.
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

// Thông báo khi giá đổi: payload {v,title,body,tag,ts} do
// products/fuel-track/py/notify_fuel_price.py gửi.
var PUSH_APP_URL = "/products/fuel-track/html/index.html";
var PUSH_ICON = "/products/fuel-track/img/fuel-track-icon-180.png";

// By code point: String#slice can cut an emoji's surrogate pair in half.
function clip(s, n){ return Array.from(s).slice(0, n).join(""); }

self.addEventListener("push", function(event){
  var p = null;
  try{ p = event.data ? event.data.json() : null; }catch(e){ p = null; }
  var title = p && typeof p.title === "string" && p.title ? clip(p.title, 80) : "FuelTrack";
  var body = p && typeof p.body === "string" && p.body ? clip(p.body, 300) : "Giá xăng dầu vừa điều chỉnh — mở app để xem";
  // iOS revokes the subscription if a push arrives without a visible
  // notification, so this path must always end in showNotification.
  event.waitUntil(self.registration.showNotification(title, { body: body, tag: "fuel-price", icon: PUSH_ICON }));
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if(new URL(list[i].url).pathname.indexOf("/products/fuel-track/") === 0 && "focus" in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(PUSH_APP_URL);
    })
  );
});
