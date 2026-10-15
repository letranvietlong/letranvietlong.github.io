// Logic service worker của LoveDays. KHÔNG đăng ký trực tiếp file này — nó
// được nạp qua importScripts từ products/love-days/sw-love-days.js.
// love-days-core.js is shared with the page; the push handler opens
// IndexedDB through LoveCore.openDb() so the DB is never created without its
// stores. ?v= follows CACHE_NAME.
importScripts('/products/love-days/js/love-days-core.js?v=18');

var CACHE_NAME = "lovedays-cache-v18";

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
// Exactly ONE notification per push: the period reminder and the milestone /
// birthday / wish reminders are further lines of the same notification.
var APP_URL = "/products/love-days/html/index.html";
var ICON_URL = "/products/love-days/img/love-days-icon-180.png";

// One open, closed on both outcomes. The service worker only ever READS here.
// Everything but the start date is handed on as stored (unvalidated).
// milestones (only needed for the reminder lines) are read on their own after
// the kv transaction: if that read fails the result is just milestones: null,
// and the day count still comes from this device.
// ok:false = IndexedDB could not be read at all (not the same as "no data").
function readPushData(skipMilestones){
  return LoveCore.openDb().then(function(db){
    return Promise.resolve().then(function(){
      var tx = db.transaction("kv"), st = tx.objectStore("kv"), out = {};
      ["profile", "cycles", "meta", "wishes", "med"].forEach(function(k){
        var rq = st.get(k);
        rq.onsuccess = function(){ out[k] = rq.result; };
      });
      return LoveCore.txDone(tx).then(function(){ return out; });
    }).then(function(out){
      out.milestones = null;
      if(skipMilestones || (out.meta && out.meta.dayRemind === false)) return out;
      return Promise.resolve().then(function(){
        return LoveCore.idbGetAll(db, "milestones");
      }).then(function(list){ out.milestones = list; }, function(){}).then(function(){ return out; });
    }).then(function(out){
      db.close();
      return out;
    }, function(err){
      db.close();
      throw err;
    });
  }).then(function(out){
    var p = out.profile;
    return { start: p && LoveCore.checkStartDate(p.startDate, Date.now()) === "ok" ? p.startDate : null, cycles: out.cycles, meta: out.meta,
             profileRaw: p, wishes: out.wishes, milestones: out.milestones, med: out.med, ok: true };
  }).catch(function(){ return { start: null, cycles: null, meta: null, profileRaw: null, wishes: null, milestones: null, med: null, ok: false }; });
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
function cycleLine(info){
  try{
    if(!info || !info.own || !LoveCore.cycleReminder) return "";
    var rec = info.own.cycles, meta = info.own.meta && typeof info.own.meta === "object" ? info.own.meta : {};
    var days = [0, 1, 2, 3, 5].indexOf(meta.cycleRemind) !== -1 ? meta.cycleRemind : 2;
    if(!days || !rec || typeof rec !== "object") return "";
    var r = LoveCore.cycleReminder(rec.items, info.now, days);
    return r ? LoveCore.reminderLine(r, meta.cycleRemindQuiet !== false) : "";
  }catch(e){ return ""; }
}

// Up to three more lines for milestones, birthdays and planned wishes that are
// due (kv meta: dayRemind, default true), after the period line. Its own
// try/catch: whatever goes wrong here only costs these lines.
function dayLines(info){
  try{
    if(!info || !info.own || !LoveCore.dayReminders || !LoveCore.dayReminderLines) return [];
    var d = info.own, meta = d.meta && typeof d.meta === "object" ? d.meta : {};
    if(meta.dayRemind === false) return [];
    var wishes = d.wishes && typeof d.wishes === "object" ? d.wishes.items : null;
    return LoveCore.dayReminderLines(LoveCore.dayReminders(d.profileRaw, d.milestones, wishes, info.now), LoveCore.REMIND_MAX_LINES);
  }catch(e){ return []; }
}

// Up to two medication lines (kv meta: medMorning, default true), placed
// before the milestone lines so the 300-character cut never drops them.
// [] when this device has no course in use today: the body is then exactly as before.
function medLines(info){
  try{
    if(!info || !info.own || !LoveCore.medMorningLines) return [];
    var lines = LoveCore.medMorningLines(info.own.med, info.own.meta, info.now);
    return Array.isArray(lines) ? lines : [];
  }catch(e){ return []; }
}

function withReminders(body, info){
  var cyc = cycleLine(info);
  try{
    if(LoveCore.pushBody) return LoveCore.pushBody(body, cyc, medLines(info).concat(dayLines(info)));
  }catch(e){}
  return body + (cyc ? "\n" + cyc : "");
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

// ---------- 8:00 medication reminder (.github/workflows/love-days-reminder-push.yml) ----------
// Payload { kind: "med", date }: the text is built here from this device's
// own record, for the day the push was sent (a late one doesn't say "today").
var MED_FALLBACK_BODY = "Mở app để xem lịch uống thuốc hôm nay.";
function showMed(title, body){
  return self.registration.showNotification(title, { body: body, tag: "love-days-med", icon: ICON_URL, data: { open: "med" } });
}
function medPush(payload){
  return readPushData(true).then(function(data){
    var c = null;
    try{
      if(data.ok && LoveCore.medPushContent) c = LoveCore.medPushContent(data.med, data.meta, payload.date, Date.now());
    }catch(e){ c = null; }
    if(!c || typeof c.title !== "string" || typeof c.body !== "string") c = { title: "💊 Nhắc uống thuốc", body: MED_FALLBACK_BODY };
    return showMed(c.title, c.body);
  }).catch(function(){
    return showMed("💊 Nhắc uống thuốc", MED_FALLBACK_BODY);
  });
}

self.addEventListener("push", function(event){
  var payload = null;
  try{ payload = event.data ? event.data.json() : null; }catch(e){ payload = null; }
  // iOS revokes the subscription of a SW that receives pushes without
  // showing a notification, so every path below ends in showNotification.
  if(payload && payload.kind === "med"){
    event.waitUntil(medPush(payload));
    return;
  }
  event.waitUntil(
    pushInfo(payload).catch(function(){ return null; }).then(function(info){
      var c = dailyContent(info);
      c.body = withReminders(c.body, info);
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

// A medication notification opens the Thuốc part: an open window gets
// postMessage({ type: "open", target: "med" }), otherwise the app opens at
// APP_URL + "?open=med" (the fetch handler drops the query, so it works offline).
self.addEventListener("notificationclick", function(event){
  var data = event.notification.data;
  var med = !!(data && data.open === "med");
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if(new URL(list[i].url).pathname.indexOf("/products/love-days/") === 0 && "focus" in list[i]){
          if(med){ try{ list[i].postMessage({ type: "open", target: "med" }); }catch(e){} }
          return list[i].focus();
        }
      }
      return self.clients.openWindow(med ? APP_URL + "?open=med" : APP_URL);
    })
  );
});
