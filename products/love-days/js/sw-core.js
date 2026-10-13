// Logic service worker của LoveDays. KHÔNG đăng ký trực tiếp file này — nó
// được nạp qua importScripts từ products/love-days/sw-love-days.js.
// love-days-core.js is shared with the page; the push handler opens
// IndexedDB through LoveCore.openDb() so the DB is never created without its
// stores. ?v= follows CACHE_NAME.
importScripts('/products/love-days/js/love-days-core.js?v=10');

var CACHE_NAME = "lovedays-cache-v10";

// Code hay đổi, không có hash trong URL → network-first, cache chỉ để offline.
var APP_CODE_PATHS = [
  "/products/love-days/html/index.html",
  "/products/love-days/css/love-days.css",
  "/products/love-days/js/love-days-core.js",
  "/products/love-days/js/love-days-media.js",
  "/products/love-days/js/love-days-backup.js",
  "/products/love-days/js/love-days-share.js",
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
  // Shared links arrive as ".../index.html?fbclid=…" or as the bare html/
  // folder; both must open offline, so cache entries are keyed by the
  // canonical path without the query string.
  var path = url.pathname === "/products/love-days/html/" ? APP_URL : url.pathname;
  if(LOVEDAYS_PATHS.indexOf(path) === -1) return;
  var key = location.origin + path;

  if(NETWORK_FIRST_PATHS.indexOf(path) !== -1){
    event.respondWith(
      fetch(event.request).then(function(res){
        // Only a good response may replace the offline copy; on a transient
        // 404/5xx serve the last working version if we have one.
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

// ---------- Daily push (sent by .github/workflows/love-days-push.yml) ----------
// The device's own start date in IndexedDB is the source of truth and N is
// computed when the push ARRIVES (a delayed push still shows the right day);
// the payload {startDate, n, date} is only a fallback for an empty DB.
// Exactly ONE notification per push: the period reminder is a second line of
// the same notification, never one of its own.
var APP_URL = "/products/love-days/html/index.html";
var ICON_URL = "/products/love-days/img/love-days-icon-180.png";

// One open, one transaction, closed on both outcomes. The service worker only
// ever READS here. cycles/meta are handed on as stored (unvalidated).
function readPushData(){
  return LoveCore.openDb().then(function(db){
    return Promise.resolve().then(function(){
      var tx = db.transaction("kv"), st = tx.objectStore("kv"), out = {};
      ["profile", "cycles", "meta"].forEach(function(k){
        var rq = st.get(k);
        rq.onsuccess = function(){ out[k] = rq.result; };
      });
      return LoveCore.txDone(tx).then(function(){ return out; });
    }).then(function(out){
      db.close();
      return out;
    }, function(err){
      db.close();
      throw err;
    });
  }).then(function(out){
    var p = out.profile;
    return { start: p && LoveCore.checkStartDate(p.startDate, Date.now()) === "ok" ? p.startDate : null, cycles: out.cycles, meta: out.meta };
  }).catch(function(){ return { start: null, cycles: null, meta: null }; });
}

function pushInfo(payload){
  return readPushData().then(function(data){
    var now = Date.now(), start = data.start;
    // The reminder line is only for a device whose own data was read.
    var own = start ? data : null;
    if(!start && payload && LoveCore.checkStartDate(payload.startDate, now) === "ok") start = payload.startDate;
    if(start) return { n: LoveCore.dayCount(start, now), start: start, now: now, own: own };
    var n = payload && payload.n;
    if(typeof n === "number" && n >= 1 && n <= 100000 && Math.floor(n) === n) return { n: n, start: null, now: now, own: null };
    return null;
  });
}

// A second line "🌸 …" when the predicted period is within the days chosen in
// Cài đặt → Chu kỳ (kv meta: cycleRemind 0|1|2|3|5, default 2;
// cycleRemindQuiet, default true), else "". Anything unexpected → "": the
// daily notification must go out unchanged.
function reminderSuffix(info){
  try{
    if(!info || !info.own || !LoveCore.cycleReminder) return "";
    var rec = info.own.cycles, meta = info.own.meta && typeof info.own.meta === "object" ? info.own.meta : {};
    var days = [0, 1, 2, 3, 5].indexOf(meta.cycleRemind) !== -1 ? meta.cycleRemind : 2;
    if(!days || !rec || typeof rec !== "object") return "";
    var r = LoveCore.cycleReminder(rec.items, info.now, days);
    return r ? "\n" + LoveCore.reminderLine(r, meta.cycleRemindQuiet !== false) : "";
  }catch(e){ return ""; }
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
      c.body += reminderSuffix(info);
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
