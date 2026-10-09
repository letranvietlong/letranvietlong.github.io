// Shared by the page AND the service worker (sw-core.js importScripts it), so
// it must stay a classic script: no ES modules, no DOM, no window.
(function(root){
  "use strict";

  var VN = 7 * 3600000;
  var DAY = 86400000;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var ID_RE = /^[\w-]+$/;

  var DB_NAME = "love-days";
  var DB_VERSION = 1;
  var OPEN_TIMEOUT_MS = 5000;

  // ---------- Dates (always UTC+7, never the device timezone) ----------
  // Never new Date('YYYY-MM-DD') or getDate()/getFullYear(): those follow the
  // device timezone and shift the day count by one abroad.
  function parseYMD(s){
    if(typeof s !== "string" || !DATE_RE.test(s)) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if(y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
    if(d > daysInMonth(y, m)) return null;
    return { y: y, m: m, d: d };
  }
  function isValidDate(s){ return parseYMD(s) !== null; }
  function pad2(n){ return (n < 10 ? "0" : "") + n; }
  function ymdStr(p){ return p.y + "-" + pad2(p.m) + "-" + pad2(p.d); }
  function daysInMonth(y, m){ return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function dayIdx(s){
    var p = typeof s === "string" ? parseYMD(s) : s;
    return Date.UTC(p.y, p.m - 1, p.d) / DAY;
  }
  function todayIdx(nowMs){ return Math.floor((nowMs + VN) / DAY); }
  function idxToStr(idx){
    var d = new Date(idx * DAY);
    return ymdStr({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
  }
  function todayStr(nowMs){ return idxToStr(todayIdx(nowMs)); }
  function addDays(s, n){ return idxToStr(dayIdx(s) + n); }
  // Clamps from the ORIGINAL date every time (31/01 + 2 months = 31/03, not
  // 28/03), so a month-end start doesn't drift.
  function addMonthsClamp(p, k){
    var total = p.y * 12 + (p.m - 1) + k;
    var y = Math.floor(total / 12), m = total - y * 12 + 1;
    return { y: y, m: m, d: Math.min(p.d, daysInMonth(y, m)) };
  }
  // 29/02 → 28/02 in non-leap years.
  function addYearsClamp(s, n){ return ymdStr(addMonthsClamp(parseYMD(s), n * 12)); }
  function wall(nowMs){
    var d = new Date(nowMs + VN);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
             h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }
  function startMs(s){ var p = parseYMD(s); return Date.UTC(p.y, p.m - 1, p.d) - VN; }

  // Start day counts as day 1.
  function dayCount(start, nowMs){ return todayIdx(nowMs) - dayIdx(start) + 1; }
  function hoursTogether(start, nowMs){ return Math.floor((nowMs - startMs(start)) / 3600000); }

  // Elapsed time since 00:00 (+07) of the start day — NOT +1.
  function breakdown(start, nowMs){
    var p = parseYMD(start), w = wall(nowMs);
    var wIdx = dayIdx(w);
    if(wIdx < dayIdx(p)) return { years: 0, months: 0, days: 0, h: 0, mi: 0, s: 0 };
    var k = (w.y - p.y) * 12 + (w.m - p.m);
    while(k > 0 && dayIdx(addMonthsClamp(p, k)) > wIdx) k--;
    if(k < 0) k = 0;
    var anchor = addMonthsClamp(p, k);
    return { years: Math.floor(k / 12), months: k % 12, days: wIdx - dayIdx(anchor),
             h: w.h, mi: w.mi, s: w.s };
  }

  function ageOn(dob, idx){
    var p = parseYMD(dob), t = parseYMD(idxToStr(idx));
    var age = t.y - p.y;
    var bdayThisYear = addMonthsClamp(p, age * 12);
    if(dayIdx(bdayThisYear) > idx) age--;
    return age;
  }

  // First occurrence base + n years (n ≥ minN) that is on/after today.
  function nextYearly(base, tIdx, minN){
    var p = parseYMD(base), t = parseYMD(idxToStr(tIdx));
    var n = Math.max(minN, t.y - p.y - 1);
    while(dayIdx(addMonthsClamp(p, n * 12)) < tIdx) n++;
    return { n: n, date: ymdStr(addMonthsClamp(p, n * 12)) };
  }

  // ---------- Milestones ----------
  // Each auto type shows only its NEXT occurrence.
  function autoMilestones(profile, nowMs){
    var out = [], tIdx = todayIdx(nowMs), start = profile.startDate;
    var n = dayCount(start, nowMs);
    var K = Math.max(100, Math.ceil(n / 100) * 100);
    out.push({ id: "auto-100", kind: "hundred", auto: true, emoji: "💯",
               title: "Ngày thứ " + fmtInt(K), date: addDays(start, K - 1) });
    var ann = nextYearly(start, tIdx, 1);
    out.push({ id: "auto-anniversary", kind: "anniversary", auto: true, emoji: "💞",
               title: "Kỷ niệm " + ann.n + " năm", date: ann.date });
    (profile.persons || []).forEach(function(person){
      if(!person || !isValidDate(person.dob)) return;
      if(dayIdx(person.dob) > tIdx) return;
      var b = nextYearly(person.dob, tIdx, 0);
      out.push({ id: "auto-bday-" + person.id, kind: "birthday", auto: true, emoji: "🎂",
                 personId: person.id, title: "Sinh nhật " + person.name, date: b.date,
                 age: ageOn(person.dob, tIdx), turning: b.n });
    });
    return out;
  }

  function userMilestoneView(m, tIdx){
    var v = { id: m.id, kind: "user", auto: false, emoji: m.emoji || "💗", title: m.title,
              note: m.note || "", repeatYearly: !!m.repeatYearly, origDate: m.date, date: m.date };
    if(m.repeatYearly){
      var nx = nextYearly(m.date, tIdx, 0);
      v.date = nx.date; v.years = nx.n;
    }
    return v;
  }

  function sortMilestones(list, tIdx){
    list.forEach(function(x){
      x.daysLeft = dayIdx(x.date) - tIdx;
      x.past = x.daysLeft < 0;
    });
    return list.sort(function(a, b){
      if(a.past !== b.past) return a.past ? 1 : -1;
      if(!a.past) return a.daysLeft - b.daysLeft || (a.auto === b.auto ? 0 : a.auto ? 1 : -1);
      return b.daysLeft - a.daysLeft;
    });
  }

  // Never throws for a valid profile; callers must validate first.
  function computeAll(profile, milestones, nowMs){
    var tIdx = todayIdx(nowMs), start = profile.startDate;
    var list = autoMilestones(profile, nowMs).concat((milestones || []).map(function(m){ return userMilestoneView(m, tIdx); }));
    sortMilestones(list, tIdx);
    var upcoming = null;
    for(var i = 0; i < list.length; i++){ if(!list[i].past){ upcoming = list[i]; break; } }
    return {
      today: idxToStr(tIdx),
      n: dayCount(start, nowMs),
      hours: hoursTogether(start, nowMs),
      breakdown: breakdown(start, nowMs),
      list: list,
      upcoming: upcoming,
      birthdays: list.filter(function(x){ return x.kind === "birthday"; })
    };
  }

  function fmtInt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  // ---------- Validators (every stored record passes through these) ----------
  function str(v, max){ return typeof v === "string" && v.length <= max; }

  // Drops unpaired surrogate halves (left by a UTF-16 slice through an emoji).
  function wellFormed(s){
    var out = "";
    for(var i = 0; i < s.length; i++){
      var c = s.charCodeAt(i);
      if(c >= 0xD800 && c <= 0xDBFF){
        var d = s.charCodeAt(i + 1);
        if(d >= 0xDC00 && d <= 0xDFFF){ out += s[i] + s[i + 1]; i++; }
      } else if(c < 0xDC00 || c > 0xDFFF) out += s[i];
    }
    return out;
  }
  // Keeps whole graphemes (👨‍👩‍👧‍👦 is one, 11 UTF-16 units) within maxUnits.
  function clipGraphemes(s, maxUnits){
    s = wellFormed(String(s));
    var parts;
    if(typeof Intl !== "undefined" && Intl.Segmenter){
      parts = [];
      var it = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)[Symbol.iterator]();
      for(var r = it.next(); !r.done; r = it.next()) parts.push(r.value.segment);
    } else parts = Array.from(s);
    var out = "";
    for(var k = 0; k < parts.length && out.length + parts[k].length <= maxUnits; k++) out += parts[k];
    return out;
  }

  // 'ok' | 'invalid' | 'future'
  function checkStartDate(s, nowMs){
    if(!isValidDate(s)) return "invalid";
    if(dayIdx(s) > todayIdx(nowMs)) return "future";
    return "ok";
  }

  var DEFAULT_PERSONS = [
    { id: "long", name: "Viết Long", dob: null },
    { id: "thu", name: "Minh Thư", dob: null }
  ];

  // Returns a cleaned profile (or null if not an object). Never discards the
  // stored startDate: an invalid one is reported via startStatus so the UI can
  // ask again without deleting anything.
  function validateProfile(p, nowMs){
    if(!p || typeof p !== "object") return null;
    var persons = DEFAULT_PERSONS.map(function(def, i){
      var src = Array.isArray(p.persons) ? p.persons[i] : null;
      var name = src && str(src.name, 40) && src.name.trim() ? src.name.trim() : def.name;
      var dob = src && isValidDate(src.dob) ? src.dob : null;
      return { id: def.id, name: name, dob: dob };
    });
    return {
      key: "profile",
      startDate: p.startDate,
      startStatus: checkStartDate(p.startDate, nowMs),
      persons: persons,
      hasCover: p.hasCover === true,
      activeGen: isGen(p.activeGen) ? p.activeGen : "g1",
      // activeGen above is a display default when the stored one is corrupt;
      // only activeGenOk:true may be used to delete photos of other gens.
      activeGenOk: isGen(p.activeGen),
      rawActiveGen: p.activeGen,
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0
    };
  }
  function isGen(v){ return str(v, 40) && ID_RE.test(v); }

  // Which activeGen to store with a profile write, and which gen to tag new
  // photo records with, without ever stranding existing photos:
  // - stored gen valid → keep it;
  // - stored gen corrupt → write the raw value back unchanged, so gen
  //   filtering stays off (a defaulted "g1" would make the next open delete
  //   every photo tagged with the real, unknown gen);
  // - no profile yet → the single gen all existing photos share, "g1" when
  //   there are none, or null (filtering off) if they are mixed.
  function genForWrite(profile, photos){
    var write;
    if(profile && profile.activeGenOk) write = profile.activeGen;
    else if(profile) write = profile.rawActiveGen;
    else {
      var gens = {};
      (photos || []).forEach(function(ph){ if(ph && typeof ph.gen === "string") gens[ph.gen] = true; });
      var list = Object.keys(gens);
      write = list.length === 0 ? "g1" : list.length === 1 && isGen(list[0]) ? list[0] : null;
    }
    return { write: write, trusted: isGen(write) ? write : null, tag: isGen(write) ? write : "g1" };
  }

  function validateMilestone(m){
    if(!m || typeof m !== "object") return null;
    if(!str(m.id, 64) || !ID_RE.test(m.id)) return null;
    if(!str(m.title, 80) || !m.title.trim()) return null;
    if(!isValidDate(m.date)) return null;
    if(m.emoji != null && !str(m.emoji, 16)) return null;
    if(m.note != null && !str(m.note, 500)) return null;
    return { id: m.id, title: m.title.trim(), date: m.date, emoji: m.emoji ? wellFormed(m.emoji) : "", note: m.note || "",
             repeatYearly: m.repeatYearly === true,
             createdAt: typeof m.createdAt === "number" ? m.createdAt : 0 };
  }

  function num(v){ return typeof v === "number" && isFinite(v); }
  function posInt(v){ return num(v) && v > 0 && Math.floor(v) === v && v <= 100000; }
  var SHA_RE = /^[0-9a-f]{64}$/;

  // Album photo metadata (the image itself lives in blobs under the same id).
  function validatePhoto(p){
    if(!p || typeof p !== "object") return null;
    if(!str(p.id, 64) || !ID_RE.test(p.id)) return null;
    if(!str(p.gen, 40)) return null;
    if(p.caption != null && !str(p.caption, 200)) return null;
    if(p.takenAt != null && !num(p.takenAt)) return null;
    if(!num(p.addedAt) || !num(p.order)) return null;
    if(!posInt(p.w) || !posInt(p.h)) return null;
    if(p.sha256 != null && !(typeof p.sha256 === "string" && SHA_RE.test(p.sha256))) return null;
    return { id: p.id, gen: p.gen, caption: p.caption || "", takenAt: p.takenAt == null ? null : p.takenAt,
             addedAt: p.addedAt, order: p.order, w: p.w, h: p.h,
             bytes: num(p.bytes) && p.bytes >= 0 ? p.bytes : 0, sha256: p.sha256 || null };
  }

  function validateBlob(b){
    if(!b || typeof b !== "object" || !str(b.id, 64)) return null;
    if(!(b.data instanceof ArrayBuffer) || !b.data.byteLength) return null;
    return b;
  }

  // ---------- IndexedDB ----------
  // Page and SW MUST both open through this: an indexedDB.open() without a
  // version from the SW before the page ever ran would create an EMPTY v1 DB,
  // and the page's onupgradeneeded would then never run → missing stores.
  function upgrade(db, oldVersion){
    switch(oldVersion){
      case 0:
        db.createObjectStore("kv", { keyPath: "key" });
        db.createObjectStore("milestones", { keyPath: "id" });
        var photos = db.createObjectStore("photos", { keyPath: "id" });
        photos.createIndex("gen", "gen");
        photos.createIndex("takenAt", "takenAt");
        photos.createIndex("addedAt", "addedAt");
        photos.createIndex("order", "order");
        db.createObjectStore("blobs", { keyPath: "id" });
    }
  }

  function openDb(){
    return new Promise(function(resolve, reject){
      var settled = false;
      function fail(code, err){
        if(settled) return;
        settled = true;
        var e = new Error(code);
        e.code = code; e.cause = err;
        reject(e);
      }
      var timer = setTimeout(function(){ fail("timeout"); }, OPEN_TIMEOUT_MS);
      var req;
      try{
        req = root.indexedDB.open(DB_NAME, DB_VERSION);
      }catch(err){ clearTimeout(timer); fail("unavailable", err); return; }
      req.onupgradeneeded = function(ev){ upgrade(req.result, ev.oldVersion); };
      req.onblocked = function(){ clearTimeout(timer); fail("blocked"); };
      req.onerror = function(){ clearTimeout(timer); fail("error", req.error); };
      req.onsuccess = function(){
        clearTimeout(timer);
        var db = req.result;
        if(settled){ db.close(); return; }
        settled = true;
        db.onversionchange = function(){ db.close(); };
        resolve(db);
      };
    });
  }

  function reqP(req){
    return new Promise(function(resolve, reject){
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  }
  function txDone(tx){
    return new Promise(function(resolve, reject){
      tx.oncomplete = function(){ resolve(); };
      tx.onerror = function(){ reject(tx.error); };
      tx.onabort = function(){ reject(tx.error || new Error("abort")); };
    });
  }
  function idbGet(db, store, key){ return reqP(db.transaction(store).objectStore(store).get(key)); }
  function idbGetAll(db, store){ return reqP(db.transaction(store).objectStore(store).getAll()); }
  function idbPut(db, store, value){
    var tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    return txDone(tx);
  }
  function idbDelete(db, store, key){
    var tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    return txDone(tx);
  }

  var PROFILE_BLOB_IDS = ["avatar-long", "avatar-thu", "cover"];

  // Removes leftovers of an interrupted import or photo add:
  // - photos of another generation (only when activeGen is known for sure —
  //   pass null when the profile is unreadable, so nothing is deleted on a guess);
  // - album blobs with no photo record. Imports stage image blobs first and
  //   write all photo records in one final transaction, so a blob without a
  //   record is never visible data. Avatar/cover blobs are never touched here.
  function cleanupGenerations(db, activeGen){
    var tx = db.transaction(["photos", "blobs"], "readwrite");
    var removed = 0, live = {};
    var photos = tx.objectStore("photos"), blobs = tx.objectStore("blobs");
    var req = photos.openCursor();
    req.onsuccess = function(){
      var cur = req.result;
      if(cur){
        var g = cur.value && cur.value.gen;
        if(activeGen && typeof g === "string" && g !== activeGen){ cur.delete(); removed++; }
        else live[cur.key] = true;
        cur.continue();
        return;
      }
      var kreq = blobs.getAllKeys();
      kreq.onsuccess = function(){
        kreq.result.forEach(function(k){
          if(PROFILE_BLOB_IDS.indexOf(k) !== -1 || live[k]) return;
          blobs.delete(k); removed++;
        });
      };
    };
    return txDone(tx).then(function(){ return removed; });
  }

  root.LoveCore = {
    VN: VN, DAY: DAY, DB_NAME: DB_NAME, DB_VERSION: DB_VERSION,
    parseYMD: parseYMD, isValidDate: isValidDate, dayIdx: dayIdx, todayIdx: todayIdx,
    todayStr: todayStr, idxToStr: idxToStr, addDays: addDays, addMonthsClamp: addMonthsClamp,
    addYearsClamp: addYearsClamp, wall: wall, startMs: startMs, dayCount: dayCount,
    hoursTogether: hoursTogether, breakdown: breakdown, ageOn: ageOn,
    autoMilestones: autoMilestones, computeAll: computeAll, fmtInt: fmtInt,
    checkStartDate: checkStartDate, validateProfile: validateProfile,
    validateMilestone: validateMilestone, clipGraphemes: clipGraphemes, validateBlob: validateBlob, validatePhoto: validatePhoto,
    DEFAULT_PERSONS: DEFAULT_PERSONS, PROFILE_BLOB_IDS: PROFILE_BLOB_IDS, genForWrite: genForWrite,
    upgrade: upgrade, openDb: openDb, idbGet: idbGet, idbGetAll: idbGetAll,
    idbPut: idbPut, idbDelete: idbDelete, reqP: reqP, txDone: txDone, cleanupGenerations: cleanupGenerations
  };
})(typeof self !== "undefined" ? self : this);
