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
              note: m.note || "", repeatYearly: !!m.repeatYearly, origDate: m.date, date: m.date,
              photoIds: Array.isArray(m.photoIds) ? m.photoIds : [] };
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

  var MAX_MS_PHOTOS = 60;
  // Links from a milestone to album photos. A bad or repeated entry is dropped
  // on its own: a broken link must never cost the milestone itself.
  function cleanPhotoIds(list){
    var out = [], seen = Object.create(null);
    if(!Array.isArray(list)) return out;
    for(var i = 0; i < list.length && out.length < MAX_MS_PHOTOS; i++){
      var v = list[i];
      if(!str(v, 64) || !ID_RE.test(v) || seen[v]) continue;
      seen[v] = true;
      out.push(v);
    }
    return out;
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
             createdAt: typeof m.createdAt === "number" ? m.createdAt : 0,
             photoIds: cleanPhotoIds(m.photoIds) };
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

  // ---------- Cycles (period log, stored whole in kv 'cycles') ----------
  var CYCLE_MIN = 15, CYCLE_MAX = 90;   // a gap outside this range is "unusual" and left out of the average
  var CYCLE_AVG_N = 6;
  var CYCLE_DEFAULT = 28;
  var CYCLE_OPEN_MAX = 10;              // a cycle with no end date counts as ongoing for this many days
  var CYCLE_MAX_LEN = 31;
  var MAX_CYCLES = 600;

  function validateCycle(c){
    if(!c || typeof c !== "object") return null;
    if(!str(c.id, 64) || !ID_RE.test(c.id)) return null;
    if(!isValidDate(c.start)) return null;
    if(c.end != null){
      if(!isValidDate(c.end)) return null;
      var d = dayIdx(c.end) - dayIdx(c.start);
      if(d < 0 || d > CYCLE_MAX_LEN - 1) return null;
    }
    if(c.note != null && !str(c.note, 200)) return null;
    if(!num(c.createdAt)) return null;
    return { id: c.id, start: c.start, end: c.end == null ? null : c.end, note: c.note || "", createdAt: c.createdAt };
  }

  function newCycleId(nowMs){ return "c" + nowMs.toString(36) + Math.random().toString(36).slice(2, 8); }

  // Would adding/replacing `cand` (matched by id) break the log? null = fine,
  // else { code, field: 'start'|'end', other }. nowMs == null skips the
  // "future" check (reading a backup: a cycle logged while the clock was
  // ahead must not make the whole file unreadable).
  // A cycle with no end date holds its start + CYCLE_OPEN_MAX - 1 days, the
  // same span cycleStats treats as "ongoing": code "openOverlap", with
  // self:true when the open one is `cand` itself.
  function cycleConflict(items, cand, nowMs){
    var s = dayIdx(cand.start), e = cand.end == null ? null : dayIdx(cand.end);
    if(nowMs != null){
      var t = todayIdx(nowMs);
      if(s > t) return { code: "future", field: "start", other: null };
      if(e !== null && e > t) return { code: "future", field: "end", other: null };
    }
    if(e !== null && e < s) return { code: "endBeforeStart", field: "end", other: null };
    if(e !== null && e - s + 1 > CYCLE_MAX_LEN) return { code: "tooLong", field: "end", other: null };
    var count = 0, hit = null;
    for(var i = 0; i < items.length; i++){
      var o = items[i];
      if(o.id === cand.id) continue;
      count++;
      if(hit) continue;
      if(o.start === cand.start) hit = { code: "dupStart", field: "start", other: o };
      else if(o.start < cand.start){
        if(o.end != null){ if(o.end >= cand.start) hit = { code: "overlap", field: "start", other: o }; }
        else if(dayIdx(o.start) + CYCLE_OPEN_MAX - 1 >= s) hit = { code: "openOverlap", field: "start", other: o, self: false };
      } else if(cand.end != null){ if(cand.end >= o.start) hit = { code: "overlap", field: "end", other: o }; }
      else if(s + CYCLE_OPEN_MAX - 1 >= dayIdx(o.start)) hit = { code: "openOverlap", field: "end", other: o, self: true };
    }
    if(hit) return hit;
    if(count >= MAX_CYCLES) return { code: "full", field: "start", other: null };
    return null;
  }

  // Adds each incoming cycle that fits. The import preview and the import
  // itself both call this, so the two counts cannot differ.
  function mergeCycles(local, incoming, nowMs){
    var items = local.slice(), ids = Object.create(null), added = 0, skipped = 0;
    items.forEach(function(c){ ids[c.id] = true; });
    incoming.forEach(function(c){
      var cand = { id: c.id, start: c.start, end: c.end, note: c.note, createdAt: c.createdAt };
      while(ids[cand.id]) cand.id = newCycleId(nowMs);
      if(cycleConflict(items, cand, nowMs)){ skipped++; return; }
      ids[cand.id] = true;
      items.push(cand);
      added++;
    });
    return { items: items, added: added, skipped: skipped };
  }

  // Never throws for validated items (an empty list included).
  function cycleStats(items, nowMs){
    var tIdx = todayIdx(nowMs);
    var list = (items || []).slice().sort(function(a, b){
      if(a.start !== b.start) return a.start < b.start ? -1 : 1;
      if(a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }).map(function(c, i, arr){
      var gap = i ? dayIdx(c.start) - dayIdx(arr[i - 1].start) : null;
      return { id: c.id, start: c.start, end: c.end, note: c.note, createdAt: c.createdAt,
               gap: gap, gapOk: gap !== null && gap >= CYCLE_MIN && gap <= CYCLE_MAX,
               len: c.end == null ? null : dayIdx(c.end) - dayIdx(c.start) + 1 };
    });
    // Filter first, then take the latest N: one skipped month must not shrink the sample.
    var gaps = list.filter(function(x){ return x.gapOk; }).slice(-CYCLE_AVG_N);
    var n = gaps.length, sum = 0;
    gaps.forEach(function(x){ sum += x.gap; });
    var lens = list.filter(function(x){ return x.len !== null; }).slice(-CYCLE_AVG_N), lenSum = 0;
    lens.forEach(function(x){ lenSum += x.len; });
    var out = {
      list: list, n: n, sum: sum, avgGap: n ? sum / n : null,
      cycleLen: n ? Math.floor((2 * sum + n) / (2 * n)) : CYCLE_DEFAULT, usedDefault: n === 0,
      avgLen: lens.length ? lenSum / lens.length : null, lenN: lens.length,
      last: null, next: null, daysLeft: null, inPeriod: false, dayOfPeriod: null, sinceLast: null,
      gapMin: null, gapMax: null, nextMin: null, nextMax: null
    };
    gaps.forEach(function(x){
      if(out.gapMin === null || x.gap < out.gapMin) out.gapMin = x.gap;
      if(out.gapMax === null || x.gap > out.gapMax) out.gapMax = x.gap;
    });
    if(!list.length) return out;
    var last = list[list.length - 1], sIdx = dayIdx(last.start);
    out.last = last;
    out.next = addDays(last.start, out.cycleLen);
    // Earliest/latest start the recent cycles suggest; only meaningful when they differ.
    if(n >= 2 && out.gapMin !== out.gapMax){
      out.nextMin = addDays(last.start, out.gapMin);
      out.nextMax = addDays(last.start, out.gapMax);
    }
    out.daysLeft = dayIdx(out.next) - tIdx;
    out.sinceLast = tIdx - sIdx;
    out.dayOfPeriod = tIdx - sIdx + 1;
    out.inPeriod = tIdx >= sIdx && (last.end != null ? tIdx <= dayIdx(last.end) : out.dayOfPeriod <= CYCLE_OPEN_MAX);
    return out;
  }

  // Whole weeks starting on Monday that cover month m of year y, as
  // 'YYYY-MM-DD'; always 35 or 42 cells so the grid height changes little.
  function monthGrid(y, m){
    var first = dayIdx({ y: y, m: m, d: 1 });
    var lead = ((first + 3) % 7 + 7) % 7;
    var n = Math.max(5, Math.ceil((lead + daysInMonth(y, m)) / 7)) * 7, out = [];
    for(var i = 0; i < n; i++) out.push(idxToStr(first - lead + i));
    return out;
  }

  // day → { period: cycle id | null, open, predicted, range } for the calendar.
  // st = cycleStats(...). A cycle with no end date is drawn up to today only
  // while it still counts as ongoing; after that just its start day.
  // isLong (the wait looks like a period that was never logged) drops the prediction.
  function cycleDayMarks(st, tIdx, isLong){
    var marks = Object.create(null), list = st.list || [], d;
    function at(idx){
      var k = idxToStr(idx);
      return marks[k] || (marks[k] = { period: null, open: false, predicted: false, range: false });
    }
    list.forEach(function(c, i){
      var s = dayIdx(c.start);
      var e = c.end != null ? dayIdx(c.end) : i === list.length - 1 && st.inPeriod ? tIdx : s;
      for(var k = s; k <= e; k++){
        var m = at(k);
        m.period = c.id;
        m.open = c.end == null;
      }
    });
    if(!isLong && st.next){
      at(dayIdx(st.next)).predicted = true;
      if(st.nextMin && st.nextMax){
        for(d = dayIdx(st.nextMin); d <= dayIdx(st.nextMax); d++) at(d).range = true;
      }
    }
    return marks;
  }

  var REMIND_DAYS = [1, 2, 3, 5];

  // For the daily push: null, or { daysLeft, next } when the predicted start
  // is 0..days away. Takes the stored items unvalidated (the service worker
  // reads them straight from IndexedDB) and never throws, whatever it is given.
  function cycleReminder(rawItems, nowMs, days){
    try{
      if(REMIND_DAYS.indexOf(days) === -1 || !Array.isArray(rawItems) || !num(nowMs)) return null;
      var seen = Object.create(null), items = [];
      rawItems.forEach(function(it){
        var v = validateCycle(it);
        if(v && !seen[v.id]){ seen[v.id] = true; items.push(v); }
      });
      if(!items.length) return null;
      var st = cycleStats(items, nowMs);
      if(st.inPeriod || st.daysLeft < 0 || st.daysLeft > days) return null;
      return { daysLeft: st.daysLeft, next: st.next };
    }catch(e){ return null; }
  }
  // quiet = no word that says what the reminder is about (it shows on the lock screen).
  function reminderLine(r, quiet){
    var when = r.daysLeft === 0 ? "hôm nay" : "còn " + r.daysLeft + " ngày";
    return "🌸 " + (quiet ? when : "Kỳ tới dự kiến " + when);
  }

  // ---------- Wishes ("Muốn làm", stored whole in kv 'wishes') ----------
  var MAX_WISHES = 500;
  var WISH_CATS = ["go", "eat", "watch", "other"];

  function validateWish(w){
    if(!w || typeof w !== "object") return null;
    if(!str(w.id, 64) || !ID_RE.test(w.id)) return null;
    if(!str(w.title, 80) || !w.title.trim()) return null;
    if(w.cat != null && w.cat !== "" && WISH_CATS.indexOf(w.cat) === -1) return null;
    if(w.note != null && !str(w.note, 300)) return null;
    if(w.planDate != null && !isValidDate(w.planDate)) return null;
    if(w.doneDate != null && !isValidDate(w.doneDate)) return null;
    if(w.milestoneId != null && (!str(w.milestoneId, 64) || !ID_RE.test(w.milestoneId))) return null;
    if(!num(w.createdAt)) return null;
    return { id: w.id, title: w.title.trim(), cat: w.cat || "", note: w.note || "",
             planDate: w.planDate == null ? null : w.planDate, doneDate: w.doneDate == null ? null : w.doneDate,
             milestoneId: w.milestoneId == null ? null : w.milestoneId, createdAt: w.createdAt };
  }

  function newWishId(nowMs){ return "w" + nowMs.toString(36) + Math.random().toString(36).slice(2, 8); }

  // Each item gains done + daysLeft (null without a planned date), split into:
  // soon (not done, planned today or later, nearest first), open (not done, no
  // date or the date has passed, newest first), done (latest first).
  // open is also given as its two halves: passed (the planned date is behind,
  // most recently passed first) and undated (newest first). open keeps its
  // meaning — the backup dry run adds soon + open + done.
  // Every order ends on id, so the same items always come out the same way.
  function wishView(items, nowMs){
    var tIdx = todayIdx(nowMs), soon = [], open = [], done = [], passed = [], undated = [];
    function byId(a, b){ return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
    (items || []).forEach(function(w){
      var v = { id: w.id, title: w.title, cat: w.cat, note: w.note, planDate: w.planDate, doneDate: w.doneDate,
                milestoneId: w.milestoneId, createdAt: w.createdAt,
                done: w.doneDate != null, daysLeft: w.planDate == null ? null : dayIdx(w.planDate) - tIdx };
      if(v.done) done.push(v);
      else if(v.daysLeft !== null && v.daysLeft >= 0) soon.push(v);
      else { open.push(v); (v.daysLeft === null ? undated : passed).push(v); }
    });
    soon.sort(function(a, b){ return a.daysLeft - b.daysLeft || a.createdAt - b.createdAt || byId(a, b); });
    open.sort(function(a, b){ return b.createdAt - a.createdAt || byId(a, b); });
    passed.sort(function(a, b){ return b.daysLeft - a.daysLeft || b.createdAt - a.createdAt || byId(a, b); });
    undated.sort(function(a, b){ return b.createdAt - a.createdAt || byId(a, b); });
    done.sort(function(a, b){
      if(a.doneDate !== b.doneDate) return a.doneDate < b.doneDate ? 1 : -1;
      return b.createdAt - a.createdAt || byId(a, b);
    });
    return { soon: soon, open: open, passed: passed, undated: undated, done: done, nearest: soon.length ? soon[0] : null };
  }

  // Adds each incoming wish whose id the device doesn't have; the device's own
  // copy always wins. The import preview and the import itself both call this.
  function mergeWishes(local, incoming){
    var items = local.slice(), ids = Object.create(null), added = 0, skipped = 0, over = 0;
    items.forEach(function(w){ ids[w.id] = true; });
    incoming.forEach(function(w){
      if(ids[w.id]){ skipped++; return; }
      if(items.length >= MAX_WISHES){ over++; return; }
      ids[w.id] = true;
      items.push(w);
      added++;
    });
    // skipped = already on the device; over = new but the list is full.
    return { items: items, added: added, skipped: skipped, over: over };
  }

  // ---------- Journal ("Nhật ký", stored whole in kv 'journal') ----------
  // One entry per day: { date, mood: 0 (none) | 1..5, text (≤ 200), updatedAt }.
  var MAX_JOURNAL = 4000;
  var JOURNAL_TEXT_MAX = 200;
  var MOODS = [1, 2, 3, 4, 5];
  var JOURNAL_MIN_DATE = "2000-01-01";

  // No "in the future" check: an entry written while the clock ran ahead must stay readable.
  function validateJournal(e){
    if(!e || typeof e !== "object") return null;
    if(!isValidDate(e.date) || e.date < JOURNAL_MIN_DATE) return null;
    if(typeof e.mood !== "number" || Math.floor(e.mood) !== e.mood || e.mood < 0 || e.mood > 5) return null;
    if(e.text != null && !str(e.text, JOURNAL_TEXT_MAX)) return null;
    var text = e.text ? wellFormed(e.text).trim() : "";
    if(!e.mood && !text) return null;
    if(!num(e.updatedAt)) return null;
    return { date: e.date, mood: e.mood, text: text, updatedAt: e.updatedAt };
  }

  // The month view: marks for every cell of monthGrid(y, m) (days of the
  // neighbouring months included), and the entries of that month, latest first.
  function journalMonth(items, y, m){
    var grid = monthGrid(y, m), ym = y + "-" + pad2(m), cell = Object.create(null), marks = Object.create(null), list = [];
    grid.forEach(function(d){ cell[d] = true; });
    (items || []).forEach(function(e){
      if(!e || typeof e.date !== "string") return;
      if(cell[e.date]) marks[e.date] = { mood: e.mood, hasText: !!e.text };
      if(e.date.slice(0, 7) === ym) list.push(e);
    });
    list.sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return { grid: grid, marks: marks, list: list, count: list.length };
  }

  // Adds each incoming day the device has no entry for; the device's own entry
  // always wins. The import preview and the import itself both call this.
  function mergeJournal(local, incoming){
    var items = local.slice(), have = Object.create(null), added = 0, skipped = 0, over = 0;
    items.forEach(function(e){ have[e.date] = true; });
    incoming.forEach(function(e){
      if(have[e.date]){ skipped++; return; }
      if(items.length >= MAX_JOURNAL){ over++; return; }
      have[e.date] = true;
      items.push(e);
      added++;
    });
    return { items: items, added: added, skipped: skipped, over: over };
  }

  // ---------- Medication ("Thuốc", stored whole in kv 'med') ----------
  // { courses: [Course], log: [Entry] }. One course in use at a time; days
  // never overlap. The log is keyed by day and carries no course id: which
  // course a day belongs to follows from the courses' date ranges, so two
  // devices that typed in the same prescription still merge by day.
  var MED_MAX_COURSES = 50;
  var MED_MAX_LOG = 4000;
  var MED_NAME_MAX = 40;
  var MED_NOTE_MAX = 200;
  var MED_PILLS_MAX = 2000;
  var MED_PERDAY_MAX = 10;
  var MED_LOW_DAYS = 7;
  var MED_MIN_DATE = "2000-01-01";
  // Fixed by the cron of love-days-reminder-push.yml (08:07 / 09:07 VN); the app can't change it.
  var MED_TIME_LABEL = "8:00";
  var MED_VISIT_AHEAD = [7, 1, 0];

  function intIn(v, lo, hi){ return typeof v === "number" && Math.floor(v) === v && v >= lo && v <= hi; }
  function medDate(s){ return isValidDate(s) && s >= MED_MIN_DATE; }
  function dmy(s){ return s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4); }
  function hhmm(ms){ var w = wall(ms); return pad2(w.h) + ":" + pad2(w.mi); }

  // No "in the future" check: a course saved while the clock ran ahead must stay readable.
  function validateMedCourse(c){
    if(!c || typeof c !== "object") return null;
    if(!str(c.id, 64) || !ID_RE.test(c.id)) return null;
    if(!str(c.name, MED_NAME_MAX)) return null;
    var name = wellFormed(c.name).trim();
    if(!name) return null;
    if(!intIn(c.perDay, 1, MED_PERDAY_MAX) || !intIn(c.totalPills, 1, MED_PILLS_MAX)) return null;
    if(!medDate(c.startDate)) return null;
    if(c.visitDate != null && !medDate(c.visitDate)) return null;
    if(c.endDate != null && (!medDate(c.endDate) || c.endDate < c.startDate)) return null;
    if(c.note != null && !str(c.note, MED_NOTE_MAX)) return null;
    if(!num(c.createdAt)) return null;
    return { id: c.id, name: name, perDay: c.perDay, startDate: c.startDate, totalPills: c.totalPills,
             visitDate: c.visitDate == null ? null : c.visitDate, endDate: c.endDate == null ? null : c.endDate,
             note: c.note ? wellFormed(c.note).trim() : "", createdAt: c.createdAt };
  }

  // An entry with nothing in it (not taken, no note) is not a valid entry: unticking such a day removes it.
  function validateMedEntry(e){
    if(!e || typeof e !== "object") return null;
    if(!medDate(e.date) || typeof e.taken !== "boolean") return null;
    if(e.note != null && !str(e.note, MED_NOTE_MAX)) return null;
    if(e.at != null && !num(e.at)) return null;
    var note = e.note ? wellFormed(e.note).trim() : "";
    if(!e.taken && !note) return null;
    return { date: e.date, taken: e.taken, note: note, at: e.taken && e.at != null ? e.at : null };
  }

  function newMedId(nowMs){ return "rx" + (num(nowMs) ? nowMs : Date.now()).toString(36) + Math.random().toString(36).slice(2, 8); }

  // Raw lists (as stored, or from a file) → validated, first of a repeated id / day wins.
  function medCourses(list){
    var out = [], seen = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(raw){
      var v = validateMedCourse(raw);
      if(v && !seen[v.id]){ seen[v.id] = true; out.push(v); }
    });
    return out;
  }
  function medLogMap(list){
    var map = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(raw){
      var v = validateMedEntry(raw);
      if(v && !map[v.date]) map[v.date] = v;
    });
    return map;
  }
  function medEnd(c){ return c.endDate == null ? Infinity : dayIdx(c.endDate); }

  // The course that covers `date`. Overlapping (corrupt) data → the latest start, then the larger id.
  function medCourseAt(courses, date){
    try{
      if(!isValidDate(date) || !Array.isArray(courses)) return null;
      var best = null, i = dayIdx(date);
      courses.forEach(function(c){
        if(!c || !isValidDate(c.startDate) || (c.endDate != null && !isValidDate(c.endDate))) return;
        if(dayIdx(c.startDate) > i || medEnd(c) < i) return;
        if(!best || c.startDate > best.startDate || (c.startDate === best.startDate && c.id > best.id)) best = c;
      });
      return best;
    }catch(e){ return null; }
  }

  // The first course in `courses` (other than cand itself) whose days overlap cand's; an open course runs on forever.
  function medOverlap(courses, cand){
    var s = dayIdx(cand.startDate), e = medEnd(cand);
    for(var i = 0; i < courses.length; i++){
      var o = courses[i];
      if(o.id === cand.id) continue;
      if(dayIdx(o.startDate) <= e && medEnd(o) >= s) return o;
    }
    return null;
  }

  // Would saving `cand` (matched by id) break the schedule? null = fine, else
  // { code, field: 'start'|'end'|'visit', other }. An open course that starts
  // BEFORE cand is not an error: the caller ends it the day before (medCloses).
  // nowMs == null skips the "future" checks (reading a backup).
  function medConflict(courses, cand, nowMs){
    var s = dayIdx(cand.startDate), e = medEnd(cand);
    if(nowMs != null){
      var t = todayIdx(nowMs);
      if(s > t) return { code: "future", field: "start", other: null };
      if(e !== Infinity && e > t) return { code: "endFuture", field: "end", other: null };
    }
    if(e < s) return { code: "endBeforeStart", field: "end", other: null };
    if(cand.visitDate != null && cand.visitDate <= cand.startDate) return { code: "visitBeforeStart", field: "visit", other: null };
    var count = 0, isNew = true, hit = null;
    var exists = courses.some(function(o){ return o.id === cand.id; });
    for(var i = 0; i < courses.length; i++){
      var o = courses[i];
      if(o.id === cand.id){ isNew = false; continue; }
      count++;
      if(hit) continue;
      var os = dayIdx(o.startDate), oe = medEnd(o);
      // A saved course re-opened (end date cleared) while a later one exists:
      // the fix is an end date, so the error belongs to that field (self).
      if(exists && e === Infinity && os > s && (oe === Infinity || oe >= s)){
        hit = { code: oe === Infinity ? "openBefore" : "overlap", field: "end", other: o, self: true };
        continue;
      }
      if(oe === Infinity){
        if(os >= s && e >= os) hit = { code: "openBefore", field: "start", other: o };
      } else if(os <= e && oe >= s) hit = { code: "overlap", field: "start", other: o };
    }
    if(hit) return hit;
    if(isNew && count >= MED_MAX_COURSES) return { code: "full", field: "start", other: null };
    return null;
  }

  // The open course that adding `cand` ends on cand.startDate − 1, or null.
  function medCloses(courses, cand){
    try{
      var best = null;
      (Array.isArray(courses) ? courses : []).forEach(function(o){
        if(!o || o.id === cand.id || o.endDate != null || !isValidDate(o.startDate) || !(o.startDate < cand.startDate)) return;
        if(!best || o.startDate > best.startDate) best = o;
      });
      return best;
    }catch(e){ return null; }
  }

  // Numbers for one course, all in VN days (today = todayStr(nowMs)):
  //   takenDays  = taken days inside the course, up to today (a future day logged under a wrong clock doesn't count)
  //   remaining  = totalPills − perDay × takenDays (may go below 0)
  //   lastDay    = day of the last pill if taken every day from the next day still to take (today, or tomorrow once today is taken)
  //   visit      = { date, daysLeft } | null
  //   shortfall  = days between running out and the day before the visit (> 0 = runs out early), when the visit is ahead
  //   surplus    = pills left over on the visit day, when there is no shortfall
  //   missed     = course days before today with no "taken"; streak = taken days in a row back from today (yesterday if today isn't taken)
  //   month      = { taken, expected, pct } for today's month: course days before today, plus today once taken
  // null for an unusable course. Never throws.
  function medStats(course, log, nowMs){
    try{
      var c = validateMedCourse(course);
      if(!c || !num(nowMs)) return null;
      var map = medLogMap(log), t = todayIdx(nowMs), today = idxToStr(t);
      var s = dayIdx(c.startDate), e = medEnd(c);
      var inC = function(i){ return i >= s && i <= e; };
      var isTaken = function(i){ var x = map[idxToStr(i)]; return !!(x && x.taken); };
      var takenDays = 0, i;
      Object.keys(map).forEach(function(d){
        var x = map[d], k = dayIdx(d);
        if(x.taken && inC(k) && k <= t) takenDays++;
      });
      var remaining = c.totalPills - c.perDay * takenDays;
      var takenToday = isTaken(t);
      var ended = e !== Infinity && e < t;
      // An end date on or before today = no supply to run out of any more:
      // no low / out / shortfall, and the last pill never goes past the end.
      var closed = e !== Infinity && e <= t;
      var first = Math.max(takenToday ? t + 1 : t, s);
      var supplyDays = remaining > 0 ? Math.floor(remaining / c.perDay) : 0;
      var lastIdx = supplyDays > 0 && !ended ? Math.min(first + supplyDays - 1, e) : null;
      var lastDay = lastIdx !== null && lastIdx >= first ? idxToStr(lastIdx) : null;
      var visit = c.visitDate ? { date: c.visitDate, daysLeft: dayIdx(c.visitDate) - t } : null;
      var shortfall = !closed && visit && lastDay && visit.daysLeft > 0 ? (dayIdx(c.visitDate) - 1) - dayIdx(lastDay) : null;
      var surplus = shortfall !== null && shortfall <= 0 ? remaining - c.perDay * (dayIdx(c.visitDate) - first) : null;
      var missed = 0;
      for(i = s; i < t && i <= e; i++) if(!isTaken(i)) missed++;
      var streak = 0;
      for(i = takenToday ? t : t - 1; isTaken(i); i--) streak++;
      var w = wall(nowMs), m0 = dayIdx({ y: w.y, m: w.m, d: 1 }), m1 = m0 + daysInMonth(w.y, w.m) - 1;
      var mt = 0, me = 0;
      for(i = m0; i <= m1; i++){
        if(!inC(i) || i > t || (i === t && !takenToday)) continue;
        me++;
        if(isTaken(i)) mt++;
      }
      return { today: today, takenToday: takenToday, takenAt: takenToday ? map[today].at : null,
               takenDays: takenDays, remaining: remaining, supplyDays: supplyDays, lastDay: lastDay, visit: visit,
               shortfall: shortfall, surplus: surplus,
               // Less than one day's dose left counts as out: "enough for 0 days" is never said.
               low: !closed && supplyDays > 0 && supplyDays <= MED_LOW_DAYS, out: !closed && supplyDays <= 0, ended: ended, closed: closed,
               missed: missed, streak: streak,
               month: { taken: mt, expected: me, pct: me ? Math.round(100 * mt / me) : null } };
    }catch(err){ return null; }
  }

  // The month view: one mark per cell of monthGrid(y, m) —
  // { state: 'taken'|'missed'|'due'|'future'|'off', note, courseId } — and the
  // month's own counts (cells of the neighbouring months left out), same rule as medStats' month. Never throws.
  function medMonth(courses, log, y, m, nowMs){
    var out = { grid: [], marks: Object.create(null), taken: 0, expected: 0, pct: null };
    try{
      if(!intIn(y, 1900, 2200) || !intIn(m, 1, 12) || !num(nowMs)) return out;
      var list = medCourses(courses), map = medLogMap(log), today = todayStr(nowMs), ym = y + "-" + pad2(m);
      out.grid = monthGrid(y, m);
      out.grid.forEach(function(d){
        var c = medCourseAt(list, d), x = map[d], st;
        if(x && x.taken) st = "taken";
        else if(!c) st = "off";
        else st = d < today ? "missed" : d === today ? "due" : "future";
        out.marks[d] = { state: st, note: x ? x.note : "", courseId: c ? c.id : null };
        if(d.slice(0, 7) !== ym || !c || d > today || (d === today && st !== "taken")) return;
        out.expected++;
        if(st === "taken") out.taken++;
      });
      out.pct = out.expected ? Math.round(100 * out.taken / out.expected) : null;
    }catch(e){
      out = { grid: [], marks: Object.create(null), taken: 0, expected: 0, pct: null };
    }
    return out;
  }

  // Import "Gộp": days are joined, and a day taken on either device counts as
  // taken (unlike the journal, where the device's entry wins whole). A course
  // with the same id, or the same name (trimmed, lower case) and start, is the
  // same course and the device's copy is kept; a course whose days overlap one
  // already there is dropped (clashCourses). The import preview and the import
  // itself both call this, so the two counts cannot differ.
  // local / incoming = { courses, log } with validated items.
  function mergeMed(local, incoming){
    local = local || {}; incoming = incoming || {};
    var logOf = function(list){ var map = medLogMap(list); return Object.keys(map).map(function(d){ return map[d]; }); };
    var courses = medCourses(local.courses), log = logOf(local.log);
    incoming = { courses: medCourses(incoming.courses), log: logOf(incoming.log) };
    var out = { courses: courses, log: log, addedCourses: 0, sameCourses: 0, clashCourses: 0, overCourses: 0,
                addedDays: 0, upgradedDays: 0, sameDays: 0, over: 0 };
    var key = function(c){ return String(c.name).trim().toLowerCase() + "|" + c.startDate; };
    var ids = Object.create(null), keys = Object.create(null);
    courses.forEach(function(c){ ids[c.id] = c; keys[key(c)] = true; });
    incoming.courses.forEach(function(c){
      var same = ids[c.id];
      if(keys[key(c)] || (same && key(same) === key(c))){ out.sameCourses++; return; }
      var cand = Object.assign({}, c);
      while(ids[cand.id]) cand.id = newMedId(Date.now());
      if(medOverlap(courses, cand)){ out.clashCourses++; return; }
      if(courses.length >= MED_MAX_COURSES){ out.overCourses++; return; }
      ids[cand.id] = cand; keys[key(cand)] = true;
      courses.push(cand);
      out.addedCourses++;
    });
    var at = Object.create(null);
    log.forEach(function(x, i){ at[x.date] = i; });
    incoming.log.forEach(function(f){
      if(at[f.date] === undefined){
        if(log.length >= MED_MAX_LOG){ out.over++; return; }
        at[f.date] = log.length;
        log.push(f);
        out.addedDays++;
        return;
      }
      var l = log[at[f.date]];
      var next = { date: l.date, taken: l.taken || f.taken, note: l.note || f.note, at: l.taken ? l.at : f.at };
      if(next.taken === l.taken && next.note === l.note && next.at === l.at){ out.sameDays++; return; }
      log[at[f.date]] = next;
      out.upgradedDays++;
    });
    return out;
  }

  // Raw record (as stored) → the course in use today and its stats, or null.
  function medToday(rawMed, nowMs){
    if(!rawMed || typeof rawMed !== "object" || !Array.isArray(rawMed.courses) || !Array.isArray(rawMed.log)) return null;
    var courses = medCourses(rawMed.courses), course = medCourseAt(courses, todayStr(nowMs));
    if(!course) return null;
    var st = medStats(course, rawMed.log, nowMs);
    return st ? { courses: courses, course: course, st: st, map: medLogMap(rawMed.log) } : null;
  }

  // Lines for the morning notification, at most 2, most pressing first:
  // visit in 7 / 1 / 0 days, out of / low on pills, today not taken yet,
  // yesterday not logged. No medicine name (lock screen). [] when there is no
  // course in use today, meta.medMorning is false, or the record is unreadable. Never throws.
  function medMorningLines(rawMed, rawMeta, nowMs){
    try{
      if(!num(nowMs) || (rawMeta && typeof rawMeta === "object" && rawMeta.medMorning === false)) return [];
      var d = medToday(rawMed, nowMs);
      if(!d) return [];
      var st = d.st, out = [];
      if(st.visit && MED_VISIT_AHEAD.indexOf(st.visit.daysLeft) !== -1){
        var left = st.visit.daysLeft;
        out.push("🩺 " + (left === 0 ? "Hôm nay" : left === 1 ? "Ngày mai" : "Còn " + left + " ngày") + ": tái khám");
      }
      var visitAhead = st.visit && st.visit.daysLeft > 0;
      if(st.out) out.push("💊 Đã hết số viên của đợt thuốc");
      else if(st.low && visitAhead && st.shortfall > 0) out.push("💊 Còn " + fmtInt(st.remaining) + " viên — hết trước ngày tái khám");
      else if(st.low && !visitAhead) out.push("💊 Thuốc còn đủ " + fmtInt(st.supplyDays) + " ngày");
      if(!st.takenToday) out.push("💊 " + MED_TIME_LABEL + " nhớ uống thuốc");
      var y = addDays(st.today, -1), yc = medCourseAt(d.courses, y), yx = d.map[y];
      if(yc && !(yx && yx.taken)) out.push("💊 Hôm qua chưa ghi uống thuốc");
      return out.slice(0, 2);
    }catch(e){ return []; }
  }

  var MED_FALLBACK = { title: "💊 Nhắc uống thuốc", body: "Mở app để xem lịch uống thuốc hôm nay." };

  // The 8:00 reminder push (payload { kind: "med", date }). targetDate = the
  // day the push was sent for, so one that arrives a day late doesn't talk
  // about "today". meta.medQuiet (default true) keeps the medicine name off
  // the lock screen. Always returns { title, body }; never throws.
  function medPushContent(rawMed, rawMeta, targetDate, nowMs){
    try{
      if(!num(nowMs)) return { title: MED_FALLBACK.title, body: MED_FALLBACK.body };
      var none = { title: "💊 Nhắc uống thuốc", body: "Không có đợt thuốc nào đang dùng trên máy này." };
      if(rawMed == null) return none;
      if(typeof rawMed !== "object" || !Array.isArray(rawMed.courses) || !Array.isArray(rawMed.log)){
        return { title: "💊 Nhắc uống thuốc", body: "Không đọc được lịch thuốc trên máy này — mở app để xem." };
      }
      var today = todayStr(nowMs), day = isValidDate(targetDate) ? targetDate : today;
      var label = day === today ? "Hôm nay" : day === addDays(today, -1) ? "Hôm qua" : "Ngày " + day.slice(8, 10) + "/" + day.slice(5, 7);
      var courses = medCourses(rawMed.courses), course = medCourseAt(courses, day);
      if(!course) return none;
      var map = medLogMap(rawMed.log), x = map[day];
      var quiet = !(rawMeta && typeof rawMeta === "object" && rawMeta.medQuiet === false);
      var stock = "";
      if(day === today){
        var st = medStats(course, rawMed.log, nowMs);
        if(st && !st.closed){
          var visitAhead = st.visit && st.visit.daysLeft > 0;
          if(st.out) stock = "Đã hết số viên của đợt này.";
          else if(st.low && visitAhead && st.shortfall > 0) stock = "Còn " + fmtInt(st.remaining) + " viên — hết trước ngày tái khám " + dmy(st.visit.date) + ".";
          else if(st.low && !visitAhead) stock = "Còn " + fmtInt(st.remaining) + " viên, đủ " + fmtInt(st.supplyDays) + " ngày.";
        }
      }
      var title, main;
      if(x && x.taken){
        var streak = 0;
        for(var i = dayIdx(day); map[idxToStr(i)] && map[idxToStr(i)].taken; i--) streak++;
        var tail = streak >= 2 ? " · " + fmtInt(streak) + " ngày liền." : ".";
        title = "💊 " + label + " đã uống thuốc ✓";
        main = x.at != null && todayStr(x.at) === day ? "Đã ghi lúc " + hhmm(x.at) + tail : "Đã ghi uống" + tail;
      } else if(day === today){
        title = "💊 Đến giờ uống thuốc";
        var name = clipGraphemes(course.name, MED_NAME_MAX);
        main = quiet ? "Hôm nay chưa ghi uống thuốc. Chạm để mở lịch thuốc."
                     : "Hôm nay chưa ghi uống " + name + " (" + course.perDay + " viên). Chạm để mở lịch thuốc.";
      } else {
        title = "💊 " + label + " chưa ghi uống thuốc";
        main = "Nếu đã uống, chạm để ghi bù.";
      }
      return { title: title, body: pushBody(main, "", stock ? [stock] : []) };
    }catch(e){ return { title: MED_FALLBACK.title, body: MED_FALLBACK.body }; }
  }

  // ---------- Weight ("Giảm cân", stored whole in kv 'weight') ----------
  // { profile: null | { heightCm, goalKg, goalDate, ratePerWeek, startDate },
  //   log: [{ date, kg, note, at }] } — one weigh-in per VN day. The start
  // weight is not stored: it is the first weigh-in on/after startDate (or the
  // first one in the log), so editing that day moves the plan with it.
  var WEIGHT_MAX_LOG = 4000;
  var WEIGHT_MIN = 20, WEIGHT_MAX = 300, HEIGHT_MIN = 100, HEIGHT_MAX = 250;
  var WEIGHT_NOTE_MAX = 100;
  var WEIGHT_RATES = [0.25, 0.5, 0.75, 1];
  var WEIGHT_RATE_DEFAULT = 0.5;
  var WEIGHT_AVG_DAYS = 7, WEIGHT_AVG_MIN = 3;
  var WEIGHT_TREND_DAYS = 14, WEIGHT_TREND_MIN = 6, WEIGHT_TREND_SPAN = 10;
  var WEIGHT_FAST = 1.0;
  var WEIGHT_ETA_MAX_DAYS = 730;
  // WHO Asia-Pacific cut-offs (WHO/IASO/IOTF 2000), not the international 25/30.
  var BMI_ASIA = { under: 18.5, over: 23, obese: 25 };
  var BMI_NORMAL_MAX = 22.9;
  var WEIGHT_MIN_DATE = "2000-01-01";
  var WEIGHT_MORNING_LINE = "⚖️ Nhớ cân hôm nay";
  var WEIGHT_CHART = { W: 340, H: 200, L: 36, R: 8, T: 10, B: 24 };

  function oneDec(x){ return num(x) && Math.abs(x * 10 - Math.round(x * 10)) < 1e-6; }
  // The 1e-7 nudge keeps x.x5 averages (81.95 stored as 81.9499…) rounding the way they read.
  function roundKg(x){
    if(!num(x)) return null;
    var r = Math.round(Math.abs(x) * 10 + 1e-7) / 10;
    return x < 0 && r ? -r : r;
  }
  function kgText(x){ var r = roundKg(x); return r == null ? "" : Math.abs(r).toFixed(1).replace(".", ","); }
  function weightDate(s){ return isValidDate(s) && s >= WEIGHT_MIN_DATE; }
  function ceilDays(x){ return Math.ceil(x - 1e-9); }
  function r2(x){ return Math.round(x * 100) / 100; }

  // "80", "80,5", "80.5" → { value }; else { error: "empty" | "format" | "range" }.
  function parseDecimal1(s, lo, hi){
    s = typeof s === "string" ? s.trim() : s == null ? "" : String(s).trim();
    if(!s) return { error: "empty" };
    if(!/^\d{1,3}([.,]\d)?$/.test(s)) return { error: "format" };
    var v = Math.round(parseFloat(s.replace(",", ".")) * 10) / 10;
    if(!(v >= lo && v <= hi)) return { error: "range" };
    return { value: v };
  }

  // No "in the future" check: a weigh-in saved while the clock ran ahead must stay readable.
  function validateWeightEntry(e){
    if(!e || typeof e !== "object" || Array.isArray(e)) return null;
    if(!weightDate(e.date) || !oneDec(e.kg)) return null;
    var kg = roundKg(e.kg);
    if(kg < WEIGHT_MIN || kg > WEIGHT_MAX) return null;
    if(e.note != null && !str(e.note, WEIGHT_NOTE_MAX)) return null;
    if(e.at != null && !num(e.at)) return null;
    return { date: e.date, kg: kg, note: e.note ? wellFormed(e.note).trim() : "", at: e.at == null ? null : e.at };
  }

  // goal < start is NOT checked here (the start weight can move); the form checks it on save.
  function validateWeightProfile(p){
    if(!p || typeof p !== "object" || Array.isArray(p)) return null;
    if(!oneDec(p.heightCm) || !oneDec(p.goalKg)) return null;
    var h = roundKg(p.heightCm), g = roundKg(p.goalKg);
    if(h < HEIGHT_MIN || h > HEIGHT_MAX || g < WEIGHT_MIN || g > WEIGHT_MAX) return null;
    var rate = p.ratePerWeek == null ? WEIGHT_RATE_DEFAULT : p.ratePerWeek;
    if(WEIGHT_RATES.indexOf(rate) === -1) return null;
    if(p.goalDate != null && !weightDate(p.goalDate)) return null;
    if(p.startDate != null && !weightDate(p.startDate)) return null;
    return { heightCm: h, goalKg: g, goalDate: p.goalDate == null ? null : p.goalDate,
             ratePerWeek: rate, startDate: p.startDate == null ? null : p.startDate };
  }

  // Raw list → validated entries, first of a repeated day wins, oldest first.
  function weightLog(list){
    var out = [], seen = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(raw){
      var v = validateWeightEntry(raw);
      if(v && !seen[v.date]){ seen[v.date] = true; out.push(v); }
    });
    return out.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function bmiOf(kg, heightCm){
    if(!num(kg) || !num(heightCm) || heightCm <= 0) return null;
    var m = heightCm / 100;
    return kg / (m * m);
  }
  // Classified by the ROUNDED number, so the label never contradicts the figure shown.
  function bmiClass(bmi){
    if(!num(bmi)) return null;
    var b = roundKg(bmi);
    if(b < BMI_ASIA.under) return { key: "under", label: "Thiếu cân", bmi1: b };
    if(b < BMI_ASIA.over) return { key: "normal", label: "Bình thường", bmi1: b };
    if(b < BMI_ASIA.obese) return { key: "over", label: "Thừa cân", bmi1: b };
    return { key: "obese", label: "Béo phì", bmi1: b };
  }
  // Highest weight (0.1 kg steps) whose BMI still SHOWS as maxBmi1 — floor(22.9·h²) is one step short.
  function bmiMaxKg(heightCm, maxBmi1){
    if(!num(heightCm) || heightCm <= 0) return null;
    var mx = num(maxBmi1) ? maxBmi1 : BMI_NORMAL_MAX, m = heightCm / 100, h2 = m * m;
    var t = Math.floor((mx + 0.05) * h2 * 10);
    while(t > 0 && roundKg(t / 10 / h2) > mx) t--;
    return t / 10;
  }

  // Sums in whole tenths of a kg so 81.6 + 82.0 doesn't pick up float dust.
  function weightTenths(log){
    var m = Object.create(null);
    log.forEach(function(e){ m[e.date] = Math.round(e.kg * 10); });
    return m;
  }
  function avgAt(map, idx){
    var s = 0, n = 0;
    for(var k = idx - WEIGHT_AVG_DAYS + 1; k <= idx; k++){
      var v = map[idxToStr(k)];
      if(v !== undefined){ s += v; n++; }
    }
    return n >= WEIGHT_AVG_MIN ? s / n / 10 : null;
  }
  // Mean of the weigh-ins in the 7 calendar days ending on `date` (VN days, gaps not filled); null under 3.
  function weightAvg7(log, date){
    try{
      if(!isValidDate(date)) return null;
      return avgAt(weightTenths(weightLog(log)), dayIdx(date));
    }catch(e){ return null; }
  }

  // Least-squares slope over the last 14 days; rate in kg/week, positive = losing.
  function weightTrend(log, today){
    try{
      if(!isValidDate(today)) return null;
      var t = dayIdx(today), pts = [];
      weightLog(log).forEach(function(e){
        var i = dayIdx(e.date);
        if(i >= t - WEIGHT_TREND_DAYS + 1 && i <= t) pts.push([i, e.kg]);
      });
      var n = pts.length;
      if(n < WEIGHT_TREND_MIN || pts[n - 1][0] - pts[0][0] < WEIGHT_TREND_SPAN) return null;
      var mx = 0, my = 0, sxy = 0, sxx = 0;
      pts.forEach(function(p){ mx += p[0]; my += p[1]; });
      mx /= n; my /= n;
      pts.forEach(function(p){ sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); });
      if(!sxx) return null;
      return { rate: -7 * sxy / sxx, n: n, from: idxToStr(pts[0][0]), to: idxToStr(pts[n - 1][0]) };
    }catch(e){ return null; }
  }

  function weightStart(profile, log){
    for(var i = 0; i < log.length; i++){
      if(!profile || !profile.startDate || log[i].date >= profile.startDate) return { date: log[i].date, kg: log[i].kg };
    }
    return null;
  }

  // Straight line from the start weight to the goal: by date when goalDate is set, else by ratePerWeek.
  function weightPlan(profile, log){
    try{
      var p = validateWeightProfile(profile);
      if(!p) return null;
      var start = weightStart(p, weightLog(log));
      if(!start || start.kg <= p.goalKg) return null;
      var drop = Math.round(start.kg * 10) - Math.round(p.goalKg * 10), slope, endDate, mode;
      if(p.goalDate){
        var days = dayIdx(p.goalDate) - dayIdx(start.date);
        if(days <= 0) return null;
        mode = "date"; slope = drop / 10 / days; endDate = p.goalDate;
      } else {
        mode = "rate"; slope = p.ratePerWeek / 7;
        endDate = addDays(start.date, ceilDays(drop * 7 / (p.ratePerWeek * 10)));
      }
      return { start: start, goalKg: p.goalKg, slope: slope, endDate: endDate, mode: mode, needRate: slope * 7 };
    }catch(e){ return null; }
  }
  function weightPlanAt(plan, date){
    try{
      if(!plan || !plan.start || !isValidDate(date) || date < plan.start.date) return null;
      return Math.max(plan.goalKg, plan.start.kg - plan.slope * (dayIdx(date) - dayIdx(plan.start.date)));
    }catch(e){ return null; }
  }

  // Everything the pane and the Home card show, from the RAW record. "cur" is
  // the 7-day average (the latest weigh-in until there are 3 in the week); a
  // weigh-in dated after today (clock ran ahead) is ignored. null = unreadable.
  function weightStats(rawWeight, nowMs){
    try{
      if(!rawWeight || typeof rawWeight !== "object" || Array.isArray(rawWeight) || !Array.isArray(rawWeight.log) || !num(nowMs)) return null;
      var all = weightLog(rawWeight.log), t = todayIdx(nowMs), today = idxToStr(t);
      var log = all.filter(function(e){ return e.date <= today; });
      var map = weightTenths(log), profile = validateWeightProfile(rawWeight.profile);
      var latest = log.length ? log[log.length - 1] : null;
      var todayEntry = latest && latest.date === today ? latest : null;
      var avg7 = avgAt(map, t);
      var cur = avg7 != null ? avg7 : latest ? latest.kg : null;
      var start = weightStart(profile, log);
      var a7 = avgAt(map, t - 7), a30 = avgAt(map, t - 30);
      var trend = weightTrend(log, today);
      var plan = profile ? weightPlan(profile, log) : null;
      var planToday = plan ? weightPlanAt(plan, today) : null;
      var bmi = profile && latest ? bmiOf(latest.kg, profile.heightCm) : null;
      var leftKg = profile && cur != null ? cur - profile.goalKg : null;
      var goalReached = leftKg != null && leftKg <= 1e-9;
      var eta = null;
      if(trend && trend.rate >= 0.05 && leftKg != null && !goalReached){
        var days = ceilDays(leftKg / (trend.rate / 7));
        eta = days > WEIGHT_ETA_MAX_DAYS ? "slow" : { date: idxToStr(t + days), days: days };
      }
      var pct = null;
      if(profile && start && cur != null && start.kg > profile.goalKg)
        pct = Math.max(0, Math.min(100, Math.round(100 * (start.kg - cur) / (start.kg - profile.goalKg))));
      var marks = null;
      if(start){
        var best = Infinity;
        for(var i = dayIdx(start.date); i <= t; i++){ var v = avgAt(map, i); if(v != null && v < best) best = v; }
        var bestLost = start.kg - (best === Infinity ? latest.kg : best);
        var mk = Math.max(0, Math.floor(bestLost + 1e-9));
        marks = { kg: mk, pct5: Math.max(0, Math.floor(bestLost / start.kg * 20 + 1e-9) * 5),
                  nextKg: mk + 1, nextKgLeft: mk + 1 - bestLost, bestLost: bestLost };
      }
      return { today: today, hasProfile: !!profile, profile: profile, count: all.length,
               hasToday: !!todayEntry, todayEntry: todayEntry, latest: latest, avg7: avg7, cur: cur,
               bmi: bmi, bmiClass: bmiClass(bmi), bmiMaxKg: profile ? bmiMaxKg(profile.heightCm) : null,
               start: start, lostTotal: start && cur != null ? start.kg - cur : null,
               lost7: a7 != null && avg7 != null ? a7 - avg7 : null,
               lost30: a30 != null && avg7 != null ? a30 - avg7 : null,
               trend: trend, plan: plan, planToday: planToday,
               vsPlan: planToday != null && cur != null ? cur - planToday : null,
               pct: pct, leftKg: leftKg, goalReached: goalReached, eta: eta,
               fast: !!trend && trend.rate > WEIGHT_FAST, marks: marks };
    }catch(err){ return null; }
  }

  function dm(s){ return s.slice(8, 10) + "/" + s.slice(5, 7); }

  // Chart geometry as plain numbers (viewBox 340×200), so it can be checked in
  // node. A goal far below the data is pinned to the bottom edge instead of
  // stretching the Y axis (that would flatten the real day-to-day moves) — in
  // every range, "Tất cả" included.
  // range: "30" | "90" | "all". Never throws.
  function weightChart(rawWeight, range, nowMs){
    var G = WEIGHT_CHART, fail = { ok: false, W: G.W, H: G.H };
    try{
      if(!rawWeight || typeof rawWeight !== "object" || Array.isArray(rawWeight) || !Array.isArray(rawWeight.log) || !num(nowMs)) return fail;
      var t = todayIdx(nowMs), today = idxToStr(t);
      var log = weightLog(rawWeight.log).filter(function(e){ return e.date <= today; });
      if(log.length < 2) return fail;
      var profile = validateWeightProfile(rawWeight.profile), plan = profile ? weightPlan(profile, log) : null;
      var map = weightTenths(log), first = dayIdx(log[0].date), all = range === "all";
      var xMin, xMax;
      // "Tất cả" runs a little past today (≤ max(14 days, a quarter of the data's span)) so a plan
      // ending years away is cut at the right edge instead of squeezing the real weigh-ins into a corner.
      if(all){
        xMin = first; xMax = t;
        var pe0 = plan ? dayIdx(plan.endDate) : t;
        if(pe0 > t) xMax = t + Math.min(pe0 - t, Math.max(14, Math.ceil(0.25 * (t - first))));
      }
      else { xMin = Math.max(t - (range === "90" ? 89 : 29), first); xMax = t; }
      if(xMax - xMin < 6) xMin = xMax - 6;
      var pts = log.filter(function(e){ var i = dayIdx(e.date); return i >= xMin && i <= xMax; });
      if(pts.length < 2) return fail;
      var plotW = G.W - G.L - G.R, plotH = G.H - G.T - G.B;
      var X = function(i){ return r2(G.L + plotW * (i - xMin) / (xMax - xMin)); };
      var avgs = [], planVals = [], lo = Infinity, hi = -Infinity, i, v;
      for(i = xMin; i <= xMax; i++){
        v = avgAt(map, i); avgs.push(v);
        if(v != null){ lo = Math.min(lo, v); hi = Math.max(hi, v); }
        var pv = plan ? weightPlanAt(plan, idxToStr(i)) : null;
        if(pv != null) planVals.push(pv);
      }
      pts.forEach(function(e){ lo = Math.min(lo, e.kg); hi = Math.max(hi, e.kg); });
      var refs = planVals.slice();
      if(profile) refs.push(profile.goalKg);
      var th = 1.5 * Math.max(hi - lo, 2), lo0 = lo, hi0 = hi;
      refs.forEach(function(r){ if(r >= lo0 - th && r <= hi0 + th){ lo = Math.min(lo, r); hi = Math.max(hi, r); } });
      var span = Math.max(hi - lo, 2), mid = (lo + hi) / 2, pad = 0.1 * span;
      var step = span <= 3 ? 0.5 : span <= 8 ? 1 : 2;
      var yMin = Math.floor((mid - span / 2 - pad) / step + 1e-9) * step;
      var yMax = Math.ceil((mid + span / 2 + pad) / step - 1e-9) * step;
      var Y = function(val){ return r2(G.T + plotH * (yMax - val) / (yMax - yMin)); };
      var yTicks = [];
      for(var k = 0; yMin + k * step <= yMax + 1e-9; k++){ v = roundKg(yMin + k * step); yTicks.push({ v: v, y: Y(v) }); }
      var xTicks = [], tickIdx = [];
      if(all && xMax - xMin > 120){
        var perDay = plotW / (xMax - xMin), every = 1;
        [1, 2, 3, 6, 12, 24, 60].some(function(n){ every = n; return n * 30.4 * perDay >= 44; });
        var p0 = parseYMD(idxToStr(xMin)), mk = p0.y * 12 + p0.m - 1 + (p0.d > 1 ? 1 : 0);
        for(; ; mk++){
          var y = Math.floor(mk / 12), m = mk - y * 12 + 1, di = dayIdx({ y: y, m: m, d: 1 });
          if(di > xMax) break;
          if(mk % every === 0) xTicks.push({ date: idxToStr(di), x: X(di), label: pad2(m) + "/" + y });
        }
      } else {
        var gap = range === "30" && !all ? 7 : 14;
        for(i = xMax; i >= xMin; i -= gap) tickIdx.push(i);
        tickIdx.reverse().forEach(function(d){ xTicks.push({ date: idxToStr(d), x: X(d), label: dm(idxToStr(d)) }); });
      }
      var near = xTicks.reduce(function(best, tk){ return Math.min(best, Math.abs(dayIdx(tk.date) - xMin)); }, Infinity);
      var nearX = xTicks.reduce(function(best, tk){ return Math.min(best, Math.abs(tk.x - G.L)); }, Infinity);
      if(near >= 3 && nearX >= 30) xTicks.unshift({ date: idxToStr(xMin), x: X(xMin), label: dm(idxToStr(xMin)) });
      xTicks.forEach(function(tk){ tk.anchor = tk.x > G.W - G.R - 20 ? "end" : tk.x < G.L + 4 ? "start" : "middle"; });
      var points = pts.map(function(e){ return { date: e.date, kg: e.kg, x: X(dayIdx(e.date)), y: Y(e.kg) }; });
      points.forEach(function(p, j){
        p.hit = { x0: j ? r2((points[j - 1].x + p.x) / 2) : G.L, x1: j < points.length - 1 ? r2((p.x + points[j + 1].x) / 2) : G.W - G.R };
      });
      var avgPath = "", pen = false;
      avgs.forEach(function(a, j){
        if(a == null){ pen = false; return; }
        avgPath += (pen ? "L" : "M") + X(xMin + j) + "," + Y(a);
        pen = true;
      });
      var planPath = "", planClip = null;
      if(plan){
        var ps = Math.max(xMin, dayIdx(plan.start.date)), pe = dayIdx(plan.endDate);
        if(ps <= xMax){
          var at = function(d){ return weightPlanAt(plan, idxToStr(d)); };
          planPath = "M" + X(ps) + "," + Y(at(ps));
          if(pe > ps && pe < xMax) planPath += "L" + X(pe) + "," + Y(at(pe));
          if(xMax > ps) planPath += "L" + X(xMax) + "," + Y(at(xMax));
          var pmin = Math.min(at(ps), at(xMax)), pmax = Math.max(at(ps), at(xMax));
          planClip = pmin < yMin - 1e-9 ? "below" : pmax > yMax + 1e-9 ? "above" : null;
        }
      }
      var goal = null;
      if(profile){
        var gv = profile.goalKg;
        goal = gv < yMin - 1e-9 ? { v: gv, y: G.T + plotH, pinned: "below" }
             : gv > yMax + 1e-9 ? { v: gv, y: G.T, pinned: "above" }
             : { v: gv, y: Y(gv), pinned: null };
      }
      var a1 = idxToStr(xMin), a2 = idxToStr(xMax);
      var label = "Biểu đồ cân nặng " + (a1.slice(0, 4) === a2.slice(0, 4) ? dm(a1) : dmy(a1)) + " – " + dmy(a2) + ": " +
                  fmtInt(pts.length) + " lần cân, mới nhất " + kgText(pts[pts.length - 1].kg) + " kg";
      var lastAvg = avgs[avgs.length - 1];
      if(xMax >= t && avgAt(map, t) != null) lastAvg = avgAt(map, t);
      if(lastAvg != null) label += ", trung bình 7 ngày " + kgText(lastAvg) + " kg";
      var pt = plan ? weightPlanAt(plan, today) : null;
      if(pt != null) label += ", lộ trình hôm nay " + kgText(pt) + " kg";
      if(goal) label += ", mục tiêu " + kgText(goal.v) + " kg" + (goal.pinned === "below" ? " (thấp hơn khung)" : goal.pinned === "above" ? " (cao hơn khung)" : "");
      label += ".";
      return { ok: true, W: G.W, H: G.H, L: G.L, R: G.R, T: G.T, B: G.B, xMin: idxToStr(xMin), xMax: idxToStr(xMax),
               yMin: yMin, yMax: yMax, step: step, yTicks: yTicks, xTicks: xTicks, points: points,
               avgPath: avgPath, planPath: planPath, planClip: planClip, goal: goal, label: label };
    }catch(err){ return fail; }
  }

  // Import "Gộp": days are joined, on the same day the device's weigh-in wins;
  // the device's goal is kept, the file's is taken only when the device has
  // none. The import preview and the import itself both call this.
  function mergeWeight(local, incoming){
    local = local && typeof local === "object" ? local : {};
    incoming = incoming && typeof incoming === "object" ? incoming : {};
    var log = weightLog(local.log), seen = Object.create(null);
    var out = { profile: null, log: log, addedDays: 0, sameDays: 0, over: 0, profileAdded: false, profileKept: false };
    log.forEach(function(e){ seen[e.date] = true; });
    weightLog(incoming.log).forEach(function(f){
      if(seen[f.date]){ out.sameDays++; return; }
      if(log.length >= WEIGHT_MAX_LOG){ out.over++; return; }
      seen[f.date] = true;
      log.push(f);
      out.addedDays++;
    });
    log.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var lp = validateWeightProfile(local.profile), ip = validateWeightProfile(incoming.profile);
    if(lp){ out.profile = lp; out.profileKept = true; }
    else if(ip){ out.profile = ip; out.profileAdded = true; }
    return out;
  }

  // The morning notification's reminder: only with a goal set, only when today
  // has no weigh-in yet, never with a number in it (lock screen). Never throws.
  function weightMorningLines(rawWeight, rawMeta, nowMs){
    try{
      if(!num(nowMs) || (rawMeta && typeof rawMeta === "object" && rawMeta.weightMorning === false)) return [];
      if(!rawWeight || typeof rawWeight !== "object" || Array.isArray(rawWeight) || !Array.isArray(rawWeight.log)) return [];
      if(!validateWeightProfile(rawWeight.profile)) return [];
      var today = todayStr(nowMs);
      return weightLog(rawWeight.log).some(function(e){ return e.date === today; }) ? [] : [WEIGHT_MORNING_LINE];
    }catch(e){ return []; }
  }

  // ---------- "Ngày này năm xưa" ----------
  // What happened on today's day and month in earlier years.
  // src = { milestones, wishes, photos, journal } (validated records).
  // → { today, years: [{ year, yearsAgo, date, milestones, wishes, photos, journal }] }, latest year first.
  // One rule for everything: an item dated d, n years before this year, is in
  // when addYearsClamp(d, n) is today — so 29/02 shows on 28/02 of a non-leap
  // year and on 29/02 of a leap one, and 28/02 never shows on 29/02.
  // milestones: by their stored date. wishes: by doneDate, left out when they
  // link to a milestone of that same day (it is already listed).
  // photos: only those with a real taken date, read as a VN day.
  // date = the earliest original date in the group. Never throws.
  function onThisDay(src, nowMs){
    var out = { today: null, years: [] };
    try{
      var today = todayStr(nowMs), ty = +today.slice(0, 4), by = Object.create(null);
      out.today = today;
      src = src || {};
      var hit = function(d){
        if(!isValidDate(d)) return false;
        var n = ty - (+d.slice(0, 4));
        return n > 0 && addYearsClamp(d, n) === today;
      };
      var group = function(d){
        var y = d.slice(0, 4), g = by[y];
        if(!g) g = by[y] = { year: +y, yearsAgo: ty - (+y), date: d, milestones: [], wishes: [], photos: [], journal: [] };
        if(d < g.date) g.date = d;
        return g;
      };
      var byId = function(a, b){ return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; };
      var msDate = Object.create(null);
      (Array.isArray(src.milestones) ? src.milestones : []).forEach(function(m){
        if(!m) return;
        msDate[m.id] = m.date;
        if(hit(m.date)) group(m.date).milestones.push(m);
      });
      (Array.isArray(src.wishes) ? src.wishes : []).forEach(function(w){
        if(!w || w.doneDate == null || !hit(w.doneDate)) return;
        if(w.milestoneId != null && msDate[w.milestoneId] === w.doneDate) return;
        group(w.doneDate).wishes.push(w);
      });
      (Array.isArray(src.photos) ? src.photos : []).forEach(function(p){
        if(!p || !num(p.takenAt)) return;
        var d = todayStr(p.takenAt);
        if(hit(d)) group(d).photos.push(p);
      });
      (Array.isArray(src.journal) ? src.journal : []).forEach(function(e){
        if(e && hit(e.date)) group(e.date).journal.push(e);
      });
      out.years = Object.keys(by).map(function(y){ return by[y]; }).sort(function(a, b){ return b.year - a.year; });
      out.years.forEach(function(g){
        g.milestones.sort(function(a, b){ return a.createdAt - b.createdAt || byId(a, b); });
        g.wishes.sort(function(a, b){ return a.createdAt - b.createdAt || byId(a, b); });
        g.photos.sort(function(a, b){ return a.takenAt - b.takenAt || a.addedAt - b.addedAt || byId(a, b); });
        g.journal.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      });
    }catch(e){ out.years = []; }
    return out;
  }

  // ---------- "Tổng kết năm" ----------
  var RECAP_TOP = 4;

  // This year (VN) down to the start year; [] when the start date is unusable or after today.
  function recapYears(startDate, nowMs){
    var out = [];
    try{
      if(!isValidDate(startDate) || !num(nowMs)) return out;
      var ty = +todayStr(nowMs).slice(0, 4);
      for(var y = ty; y >= +startDate.slice(0, 4); y--) out.push(y);
    }catch(e){ out = []; }
    return out;
  }

  // src = { startDate, milestones, wishes, photos, journal } (validated records).
  // asOf = the last day counted (today, or 31/12 of a past year); days = day number of asOf,
  // daysInYear = days together within that year. milestones: user milestones dated in the
  // year and not after today; wishesDone: doneDate in the year; photos: the VN day of
  // takenAt, else addedAt (the Album's "Ngày chụp" fallback); journalDays: distinct dates.
  // topPhotoIds (≤ 4): the first photo of each counted milestone in date order, then evenly
  // spread picks (index floor(i·n/k)) from the year's other photos in date order.
  // null when the year is outside recapYears. Never throws.
  function yearRecap(src, year, nowMs){
    try{
      src = src || {};
      var start = src.startDate, today = todayStr(nowMs);
      if(!isValidDate(start) || !isValidDate(today) || typeof year !== "number" || Math.floor(year) !== year) return null;
      var Y = String(year), first = Y + "-01-01", last = Y + "-12-31";
      if(year < +start.slice(0, 4) || year > +today.slice(0, 4) || start > today) return null;
      var asOf = today < last ? today : last, from = start > first ? start : first;
      var list = function(v){ return Array.isArray(v) ? v : []; };
      var inYear = function(d){ return isValidDate(d) && d.slice(0, 4) === Y; };
      var key = function(p){ return num(p.takenAt) ? p.takenAt : num(p.addedAt) ? p.addedAt : null; };
      var byId = function(a, b){ return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; };
      var byDate = function(a, b){ return key(a) - key(b) || (num(a.addedAt) && num(b.addedAt) ? a.addedAt - b.addedAt : 0) || byId(a, b); };

      var ms = list(src.milestones).filter(function(m){ return m && typeof m.id === "string" && inYear(m.date) && m.date <= today; });
      ms.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0) || byId(a, b); });
      var wishesDone = list(src.wishes).filter(function(w){ return w && inYear(w.doneDate); }).length;
      var photoById = Object.create(null), yearPhotos = [];
      list(src.photos).forEach(function(p){
        if(!p || typeof p.id !== "string" || key(p) === null || photoById[p.id]) return;
        photoById[p.id] = p;
        if(inYear(todayStr(key(p)))) yearPhotos.push(p);
      });
      yearPhotos.sort(byDate);
      var days = Object.create(null), journalDays = 0;
      list(src.journal).forEach(function(e){
        if(e && inYear(e.date) && !days[e.date]){ days[e.date] = true; journalDays++; }
      });

      var top = [], taken = Object.create(null);
      ms.forEach(function(m){
        if(top.length >= RECAP_TOP) return;
        var own = list(m.photoIds).map(function(id){ return typeof id === "string" ? photoById[id] : null; })
          .filter(function(p){ return p && !taken[p.id]; }).sort(byDate);
        if(own.length){ top.push(own[0].id); taken[own[0].id] = true; }
      });
      var rest = yearPhotos.filter(function(p){ return !taken[p.id]; }), n = rest.length, k = Math.min(RECAP_TOP - top.length, n);
      for(var i = 0; i < k; i++) top.push(rest[Math.floor(i * n / k)].id);

      var out = { year: year, isCurrent: asOf === today, asOf: asOf,
                  days: dayIdx(asOf) - dayIdx(start) + 1, daysInYear: dayIdx(asOf) - dayIdx(from) + 1,
                  milestones: ms.length, wishesDone: wishesDone, photos: yearPhotos.length, journalDays: journalDays,
                  topPhotoIds: top };
      out.hasData = out.milestones + out.wishesDone + out.photos + out.journalDays > 0;
      return out;
    }catch(e){ return null; }
  }

  // ---------- Reminders in the morning push ----------
  var REMIND_AHEAD = [7, 1, 0];   // milestones, birthdays, "Ngày thứ K", yearly anniversary: days left that get a line
  var WISH_AHEAD = [1, 0];        // open wishes with a planned date
  var REMIND_MAX_LINES = 3;
  var REMIND_TITLE_MAX = 40;
  var PUSH_BODY_MAX = 300;        // code points
  var REMIND_WISH_EMOJI = { go: "✈️", eat: "🍜", watch: "🎬", other: "✨" };
  var REMIND_RANK = { birthday: 0, anniversary: 1, hundred: 1, user: 2, wish: 3 };

  // What the morning notification should mention today, most pressing first:
  // [{ kind: 'birthday'|'anniversary'|'hundred'|'user'|'wish', id, emoji, title, daysLeft }].
  // Takes everything as stored (the service worker reads straight from
  // IndexedDB): each record goes through its validator, a bad one or a
  // repeated id is dropped on its own, an unreadable profile gives [], a list
  // that is not an array is left out. Never throws.
  // The round-hundred day and the yearly anniversary are left out ON the day:
  // the main line of the notification already says "Hôm nay tròn …".
  function dayReminders(rawProfile, rawMilestones, rawWishItems, nowMs){
    var out = [];
    try{
      if(!num(nowMs)) return out;
      var profile = validateProfile(rawProfile, nowMs);
      if(!profile || profile.startStatus !== "ok") return out;
      var tIdx = todayIdx(nowMs);
      var add = function(kind, id, emoji, title, date, ahead){
        var left = dayIdx(date) - tIdx;
        if(ahead.indexOf(left) !== -1) out.push({ kind: kind, id: id, emoji: emoji, title: title, daysLeft: left });
      };
      try{
        autoMilestones(profile, nowMs).forEach(function(m){
          if(m.kind !== "birthday" && dayIdx(m.date) === tIdx) return;
          add(m.kind, m.id, m.emoji, m.title, m.date, REMIND_AHEAD);
        });
      }catch(e){}
      var seen = Object.create(null);
      (Array.isArray(rawMilestones) ? rawMilestones : []).forEach(function(raw){
        try{
          var m = validateMilestone(raw);
          if(!m || seen[m.id]) return;
          seen[m.id] = true;
          var v = userMilestoneView(m, tIdx);
          add("user", v.id, v.emoji, v.title, v.date, REMIND_AHEAD);
        }catch(e){}
      });
      seen = Object.create(null);
      (Array.isArray(rawWishItems) ? rawWishItems : []).forEach(function(raw){
        try{
          var w = validateWish(raw);
          if(!w || seen[w.id]) return;
          seen[w.id] = true;
          if(w.doneDate != null || w.planDate == null) return;
          add("wish", w.id, REMIND_WISH_EMOJI[w.cat] || "✨", w.title, w.planDate, WISH_AHEAD);
        }catch(e){}
      });
      // Plain code-unit order for the title: localeCompare differs between engines.
      out.sort(function(a, b){
        return a.daysLeft - b.daysLeft || REMIND_RANK[a.kind] - REMIND_RANK[b.kind] ||
          (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      });
    }catch(e){}
    return out;
  }

  // One line per reminder: "🎂 Hôm nay: …" | "🎂 Ngày mai: …" | "🎂 Còn 7 ngày: …".
  // More than maxLines items → maxLines − 1 of them + "… và N mục khác".
  // These show on the lock screen. Never throws.
  function dayReminderLines(list, maxLines){
    try{
      var max = posInt(maxLines) ? maxLines : REMIND_MAX_LINES;
      var items = (Array.isArray(list) ? list : []).filter(function(x){
        return x && typeof x === "object" && typeof x.title === "string" && num(x.daysLeft) && x.daysLeft >= 0;
      });
      var shown = items.length > max ? items.slice(0, max - 1) : items;
      var lines = shown.map(function(x){
        var title = wellFormed(x.title).replace(/\s+/g, " ").trim();
        if(title.length > REMIND_TITLE_MAX) title = clipGraphemes(title, REMIND_TITLE_MAX).trim() + "…";
        var when = x.daysLeft === 0 ? "Hôm nay" : x.daysLeft === 1 ? "Ngày mai" : "Còn " + fmtInt(x.daysLeft) + " ngày";
        var emoji = typeof x.emoji === "string" && x.emoji ? wellFormed(x.emoji) + " " : "";
        return emoji + when + ": " + title;
      });
      if(items.length > max) lines.push("… và " + (items.length - shown.length) + " mục khác");
      return lines;
    }catch(e){ return []; }
  }

  // The notification body: main line, then the period line (if any), then the
  // reminder lines — as many as fit in PUSH_BODY_MAX code points, dropped from
  // the end. Counted by code point so an emoji is never cut in half. Never throws.
  function pushBody(main, cycleLine, lines){
    var len = function(s){ return Array.from(s).length; };
    var body = typeof main === "string" ? wellFormed(main) : "";
    try{
      if(typeof cycleLine === "string" && cycleLine) body += "\n" + wellFormed(cycleLine);
      if(len(body) > PUSH_BODY_MAX) return Array.from(body).slice(0, PUSH_BODY_MAX - 1).join("") + "…";
      var used = len(body), list = Array.isArray(lines) ? lines : [];
      for(var i = 0; i < list.length; i++){
        if(typeof list[i] !== "string" || !list[i]) continue;
        var line = wellFormed(list[i]), n = len(line) + 1;
        if(used + n > PUSH_BODY_MAX) break;
        body += "\n" + line;
        used += n;
      }
    }catch(e){}
    return body;
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
    validateMilestone: validateMilestone, MAX_MS_PHOTOS: MAX_MS_PHOTOS, clipGraphemes: clipGraphemes, validateBlob: validateBlob, validatePhoto: validatePhoto,
    DEFAULT_PERSONS: DEFAULT_PERSONS, PROFILE_BLOB_IDS: PROFILE_BLOB_IDS, genForWrite: genForWrite,
    CYCLE_MIN: CYCLE_MIN, CYCLE_MAX: CYCLE_MAX, CYCLE_AVG_N: CYCLE_AVG_N, CYCLE_DEFAULT: CYCLE_DEFAULT,
    CYCLE_OPEN_MAX: CYCLE_OPEN_MAX, CYCLE_MAX_LEN: CYCLE_MAX_LEN, MAX_CYCLES: MAX_CYCLES,
    validateCycle: validateCycle, newCycleId: newCycleId, cycleConflict: cycleConflict,
    mergeCycles: mergeCycles, cycleStats: cycleStats,
    monthGrid: monthGrid, cycleDayMarks: cycleDayMarks, REMIND_DAYS: REMIND_DAYS,
    cycleReminder: cycleReminder, reminderLine: reminderLine,
    MAX_WISHES: MAX_WISHES, validateWish: validateWish, newWishId: newWishId, wishView: wishView, mergeWishes: mergeWishes,
    MAX_JOURNAL: MAX_JOURNAL, JOURNAL_TEXT_MAX: JOURNAL_TEXT_MAX, MOODS: MOODS,
    validateJournal: validateJournal, journalMonth: journalMonth, mergeJournal: mergeJournal,
    MED_MAX_COURSES: MED_MAX_COURSES, MED_MAX_LOG: MED_MAX_LOG, MED_NAME_MAX: MED_NAME_MAX, MED_NOTE_MAX: MED_NOTE_MAX,
    MED_PILLS_MAX: MED_PILLS_MAX, MED_PERDAY_MAX: MED_PERDAY_MAX, MED_LOW_DAYS: MED_LOW_DAYS, MED_MIN_DATE: MED_MIN_DATE,
    MED_TIME_LABEL: MED_TIME_LABEL, MED_VISIT_AHEAD: MED_VISIT_AHEAD,
    validateMedCourse: validateMedCourse, validateMedEntry: validateMedEntry, newMedId: newMedId,
    medCourseAt: medCourseAt, medOverlap: medOverlap, medConflict: medConflict, medCloses: medCloses,
    medStats: medStats, medMonth: medMonth, mergeMed: mergeMed,
    medMorningLines: medMorningLines, medPushContent: medPushContent,
    WEIGHT_MAX_LOG: WEIGHT_MAX_LOG, WEIGHT_MIN: WEIGHT_MIN, WEIGHT_MAX: WEIGHT_MAX, HEIGHT_MIN: HEIGHT_MIN, HEIGHT_MAX: HEIGHT_MAX,
    WEIGHT_NOTE_MAX: WEIGHT_NOTE_MAX, WEIGHT_RATES: WEIGHT_RATES, WEIGHT_RATE_DEFAULT: WEIGHT_RATE_DEFAULT,
    WEIGHT_AVG_DAYS: WEIGHT_AVG_DAYS, WEIGHT_AVG_MIN: WEIGHT_AVG_MIN, WEIGHT_TREND_DAYS: WEIGHT_TREND_DAYS,
    WEIGHT_TREND_MIN: WEIGHT_TREND_MIN, WEIGHT_TREND_SPAN: WEIGHT_TREND_SPAN, WEIGHT_FAST: WEIGHT_FAST,
    WEIGHT_ETA_MAX_DAYS: WEIGHT_ETA_MAX_DAYS, BMI_ASIA: BMI_ASIA, BMI_NORMAL_MAX: BMI_NORMAL_MAX,
    WEIGHT_MIN_DATE: WEIGHT_MIN_DATE, WEIGHT_MORNING_LINE: WEIGHT_MORNING_LINE,
    parseDecimal1: parseDecimal1, roundKg: roundKg, kgText: kgText,
    validateWeightEntry: validateWeightEntry, validateWeightProfile: validateWeightProfile, weightLog: weightLog,
    bmiOf: bmiOf, bmiClass: bmiClass, bmiMaxKg: bmiMaxKg, weightAvg7: weightAvg7, weightTrend: weightTrend,
    weightPlan: weightPlan, weightPlanAt: weightPlanAt, weightStats: weightStats, weightChart: weightChart,
    mergeWeight: mergeWeight, weightMorningLines: weightMorningLines,
    onThisDay: onThisDay, RECAP_TOP: RECAP_TOP, recapYears: recapYears, yearRecap: yearRecap,
    REMIND_AHEAD: REMIND_AHEAD, WISH_AHEAD: WISH_AHEAD, REMIND_MAX_LINES: REMIND_MAX_LINES, REMIND_TITLE_MAX: REMIND_TITLE_MAX,
    PUSH_BODY_MAX: PUSH_BODY_MAX, dayReminders: dayReminders, dayReminderLines: dayReminderLines, pushBody: pushBody,
    upgrade: upgrade, openDb: openDb, idbGet: idbGet, idbGetAll: idbGetAll,
    idbPut: idbPut, idbDelete: idbDelete, reqP: reqP, txDone: txDone, cleanupGenerations: cleanupGenerations
  };
})(typeof self !== "undefined" ? self : this);
