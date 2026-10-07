// Logic service worker của LoveDays. KHÔNG đăng ký trực tiếp file này — nó
// được nạp qua importScripts từ products/love-days/sw-love-days.js.
// love-days-core.js is shared with the page; the push handler opens
// IndexedDB through LoveCore.openDb() so the DB is never created without its
// stores. ?v= follows CACHE_NAME.
importScripts('/products/love-days/js/love-days-core.js?v=3');

var CACHE_NAME = "lovedays-cache-v3";

// Code hay đổi, không có hash trong URL → network-first, cache chỉ để offline.
var APP_CODE_PATHS = [
  "/products/love-days/html/index.html",
  "/products/love-days/css/love-days.css",
  "/products/love-days/js/love-days-core.js",
  "/products/love-days/js/love-days-media.js",
  "/products/love-days/js/love-days-backup.js",
  "/products/love-days/js/love-days.js"
];
var ICON_PATHS = [
  "/products/love-days/img/love-days-icon.svg",
  "/products/love-days/img/love-days-icon-32.png",
  "/products/love-days/img/love-days-icon-180.png"
];
var DATA_PATHS = [
  "/products/love-days/data/changelog.json",
  "/products/love-days/manifest.json"
];
var NETWORK_FIRST_PATHS = APP_CODE_PATHS.concat(DATA_PATHS);
var LOVEDAYS_PATHS = APP_CODE_PATHS.concat(ICON_PATHS).concat(DATA_PATHS);

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
      // Cache Storage is shared by the whole origin (GoldTrack and FuelTrack
      // live in it too) — only ever delete our own old versions.
      return Promise.all(keys.filter(function(k){ return k.indexOf("lovedays-cache-") === 0 && k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if(url.origin !== location.origin) return;
  if(LOVEDAYS_PATHS.indexOf(url.pathname) === -1) return;

  if(NETWORK_FIRST_PATHS.indexOf(url.pathname) !== -1){
    event.respondWith(
      fetch(event.request).then(function(res){
        // Only a good response may replace the offline copy; on a transient
        // 404/5xx serve the last working version if we have one.
        if(res.ok){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
          return res;
        }
        return caches.match(event.request).then(function(cached){ return cached || res; });
      }).catch(function(){
        return caches.match(event.request).then(function(cached){ return cached || Response.error(); });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(function(cached){
        var fetchPromise = fetch(event.request).then(function(res){
          if(res.ok){
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
          }
          return res;
        }).catch(function(){ return cached || Response.error(); });
        return cached || fetchPromise;
      })
    );
  }
});

// ---------- Daily push (sent by .github/workflows/love-days-push.yml) ----------
// The device's own start date in IndexedDB is the source of truth and N is
// computed when the push ARRIVES (a delayed push still shows the right day);
// the payload {startDate, n, date} is only a fallback for an empty DB.
var APP_URL = "/products/love-days/html/index.html";
var ICON_URL = "/products/love-days/img/love-days-icon-180.png";

function readStoredStart(){
  return LoveCore.openDb().then(function(db){
    return LoveCore.idbGet(db, "kv", "profile").then(function(p){
      db.close();
      return p;
    }, function(err){
      db.close();
      throw err;
    });
  }).then(function(p){
    return p && LoveCore.checkStartDate(p.startDate, Date.now()) === "ok" ? p.startDate : null;
  }).catch(function(){ return null; });
}

function pushInfo(payload){
  return readStoredStart().then(function(start){
    var now = Date.now();
    if(!start && payload && LoveCore.checkStartDate(payload.startDate, now) === "ok") start = payload.startDate;
    if(start) return { n: LoveCore.dayCount(start, now), start: start, now: now };
    var n = payload && payload.n;
    if(typeof n === "number" && n >= 1 && Math.floor(n) === n) return { n: n, start: null, now: now };
    return null;
  });
}

function dailyContent(info){
  if(!info) return { title: "💕 Long & Thư", body: "Mở app để xem hôm nay là ngày thứ mấy hai bạn bên nhau" };
  var nTxt = LoveCore.fmtInt(info.n);
  var body = "Hôm nay là ngày thứ " + nTxt + " Long & Thư yêu nhau";
  if(info.start){
    var today = LoveCore.todayStr(info.now);
    LoveCore.autoMilestones({ startDate: info.start, persons: [] }, info.now).forEach(function(m){
      if(m.date !== today) return;
      if(m.kind === "anniversary") body = "Hôm nay tròn " + m.title.replace("Kỷ niệm ", "") + " Long & Thư yêu nhau 🎉";
      else if(m.kind === "hundred") body = "Hôm nay tròn " + nTxt + " ngày Long & Thư yêu nhau 🎉";
    });
  }
  return { title: "💕 Ngày thứ " + nTxt, body: body };
}

self.addEventListener("push", function(event){
  var payload = null;
  try{ payload = event.data ? event.data.json() : null; }catch(e){ payload = null; }
  // iOS revokes the subscription of a SW that receives pushes without
  // showing a notification, so every path below ends in showNotification.
  event.waitUntil(
    pushInfo(payload).catch(function(){ return null; }).then(function(info){
      var c = dailyContent(info);
      if(info){
        try{
          if(self.navigator.setAppBadge){
            var r = self.navigator.setAppBadge(info.n);
            if(r && r.catch) r.catch(function(){});
          }
        }catch(e){}
      }
      return self.registration.showNotification(c.title, { body: c.body, tag: "love-days-daily", icon: ICON_URL });
    }).catch(function(){
      return self.registration.showNotification("💕 Long & Thư", { body: "Mở app để xem hôm nay là ngày thứ mấy hai bạn bên nhau", tag: "love-days-daily" });
    })
  );
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if(new URL(list[i].url).pathname.indexOf("/products/love-days/") === 0 && "focus" in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(APP_URL);
    })
  );
});
