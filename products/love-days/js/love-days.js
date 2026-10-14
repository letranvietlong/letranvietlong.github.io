(function(){
  "use strict";

  // VAPID PUBLIC key (base64url, 87 chars, starts with "B"): the "publicKey"
  // half of `npx --yes web-push generate-vapid-keys --json`, run on your own
  // machine OUTSIDE this repo. The matching privateKey goes ONLY into the
  // GitHub secret LOVE_VAPID_PRIVATE_KEY — never into any file here (the repo
  // is public and a Stop hook pushes every change). Empty = notifications off.
  // Changing it invalidates every existing subscription (see docs/love-days.md).
  var VAPID_PUBLIC_KEY = 'BOiIqG0zhuwGbzvByX4y58FNcP4rV_Qm54q3LkWSQw1Fks2jETdEMPnHBmNUDZFXxOw2ZmiDrNWxJxhArdK0-h0';

  var C = self.LoveCore, M = self.LoveMedia, B = self.LoveBackup, S = self.LoveShare;
  var $ = function(id){ return document.getElementById(id); };

  var PHOTO_IDS = ["avatar-long", "avatar-thu", "cover"];
  var EMOJI_PICKS = ["💗", "💐", "💍", "✈️", "🏖️", "🎂", "🍰", "🎬", "🌙", "⭐"];
  var WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

  var state = {
    db: null, profile: null, milestones: [], blobs: {}, urls: {},
    computed: null, lastIdx: null, timer: null, tab: "home", mode: "loading", editingId: null, loadFailed: false, dbError: null,
    photos: [], albumOrder: [], arranging: false,
    cycles: [], cyclesBad: [], cyclesBroken: false, cyclesStamp: null,
    wishes: [], wishesBad: [], wishesBroken: false, wishesStamp: null,
    journal: [], journalBad: [], journalBroken: false, journalStamp: null,
    // cycleRemind (days ahead, 0 = off), cycleRemindQuiet and dayRemind are read by the
    // service worker's push handler; like the rest of meta they stay on this device.
    meta: { key: "meta", schemaVersion: 1, lastBackupAt: null, albumSort: "taken", showCycle: true, cycleRemind: 2, cycleRemindQuiet: true, dayRemind: true,
            showJournal: true }
  };
  var REMIND_OPTS = [0, 1, 2, 3, 5];
  var mem = { kv: {}, milestones: {}, blobs: {}, photos: {} };
  // One long job at a time: album add, backup build, import.
  var busy = null;
  var banners = {};

  function now(){ return Date.now(); }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function fmtDate(s){ return s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4); }
  function fmtDayMonth(s){ return s.slice(8, 10) + "/" + s.slice(5, 7); }
  function weekday(s){ return WEEKDAYS[((C.dayIdx(s) + 4) % 7 + 7) % 7]; }
  function pad2(n){ return (n < 10 ? "0" : "") + n; }
  var fmtInt = C.fmtInt;
  function initial(name){
    var parts = String(name).trim().split(/\s+/);
    return (parts[parts.length - 1] || "♥").charAt(0).toUpperCase();
  }
  function daysLeftText(x){
    if(x.daysLeft === 0) return "hôm nay";
    if(x.past) return "đã qua " + fmtInt(-x.daysLeft) + " ngày";
    return "còn " + fmtInt(x.daysLeft) + " ngày";
  }
  // Big number + small unit; the row's aria-label carries the full wording.
  function bigDays(x, cls){
    if(x.daysLeft === 0) return '<span class="' + cls + ' today">Hôm nay 🎉</span>';
    var n = fmtInt(Math.abs(x.daysLeft));
    return '<span class="' + cls + (x.past ? " past" : "") + '"><span class="sr-only">' + n + ' ngày</span><span class="ms-num" aria-hidden="true">' + n +
      '</span><span class="ms-unit" aria-hidden="true">ngày</span></span>';
  }
  function clockText(b){
    return b.years + " năm " + b.months + " tháng " + b.days + " ngày · " + pad2(b.h) + ":" + pad2(b.mi) + ":" + pad2(b.s);
  }
  function showError(id, msg){ var el = $(id); el.textContent = msg || ""; el.hidden = !msg; }

  // ---------- Banners ----------
  // action: { label, run } adds a button to the banner.
  function setBanner(key, text, kind, action){
    if(text) banners[key] = { text: text, kind: kind || "warn", action: action || null }; else delete banners[key];
    $("banners").innerHTML = Object.keys(banners).map(function(k){
      var b = banners[k];
      return '<div class="banner banner-' + b.kind + '"><span>' + escapeHtml(b.text) + "</span>" +
        (b.action ? '<button type="button" class="banner-btn" data-banner="' + k + '">' + escapeHtml(b.action.label) + "</button>" : "") + "</div>";
    }).join("");
  }
  $("banners").addEventListener("click", function(e){
    var btn = e.target.closest("[data-banner]");
    var b = btn && banners[btn.getAttribute("data-banner")];
    if(b && b.action) b.action.run();
  });

  // ---------- Storage (IndexedDB, or memory when it can't be opened) ----------
  function put(store, value){
    if(state.db) return C.idbPut(state.db, store, value);
    mem[store][store === "kv" ? value.key : value.id] = value;
    return Promise.resolve();
  }
  function del(store, key){
    if(state.db) return C.idbDelete(state.db, store, key);
    delete mem[store][key];
    return Promise.resolve();
  }
  function profileRecord(p){
    return { key: "profile", startDate: p.startDate, persons: p.persons, hasCover: p.hasCover,
             activeGen: C.genForWrite(p, state.photos).write, updatedAt: p.updatedAt };
  }

  function loadAll(){
    var db = state.db;
    var safe = function(p, fallback){ return p.catch(function(){ return fallback; }); };
    // A failed read of profile/milestones/photos/meta/cycles/wishes/journal rejects the whole load:
    // treating it as "nothing stored" would show first-run setup and let the
    // next save overwrite the real data. Only avatar/cover reads may fail soft.
    return Promise.all([
      C.idbGet(db, "kv", "profile"),
      C.idbGetAll(db, "milestones"),
      Promise.all(PHOTO_IDS.map(function(id){ return safe(C.idbGet(db, "blobs", id), undefined); })),
      C.idbGetAll(db, "photos"),
      C.idbGet(db, "kv", "meta"),
      C.idbGet(db, "kv", "cycles"),
      C.idbGet(db, "kv", "wishes"),
      C.idbGet(db, "kv", "journal")
    ]).then(function(r){
      var skipped = 0;
      if(r[0] !== undefined){
        state.profile = C.validateProfile(r[0], now());
        if(!state.profile) skipped++;
      }
      state.milestones = r[1].map(function(m){
        var v = C.validateMilestone(m);
        if(!v) skipped++;
        return v;
      }).filter(Boolean);
      r[2].forEach(function(b, i){
        if(b === undefined) return;
        var v = C.validateBlob(b);
        if(!v){ skipped++; return; }
        state.blobs[PHOTO_IDS[i]] = v;
        setUrl(PHOTO_IDS[i]);
      });
      // Only trust activeGen when it was stored valid — validateProfile
      // substitutes "g1" otherwise, and deleting by a guessed gen loses photos.
      var gen = state.profile && state.profile.activeGenOk ? state.profile.activeGen : null;
      state.photos = r[3].map(function(ph){
        var v = C.validatePhoto(ph);
        if(!v) skipped++;
        return v;
      }).filter(function(v){ return v && (!gen || v.gen === gen); });
      var meta = r[4];
      if(meta && typeof meta === "object"){
        if(typeof meta.lastBackupAt === "number" && isFinite(meta.lastBackupAt)) state.meta.lastBackupAt = meta.lastBackupAt;
        if(SORTS.indexOf(meta.albumSort) !== -1) state.meta.albumSort = meta.albumSort;
        if(meta.showCycle === false) state.meta.showCycle = false;
        if(REMIND_OPTS.indexOf(meta.cycleRemind) !== -1) state.meta.cycleRemind = meta.cycleRemind;
        if(meta.cycleRemindQuiet === false) state.meta.cycleRemindQuiet = false;
        if(meta.dayRemind === false) state.meta.dayRemind = false;
        if(meta.showJournal === false) state.meta.showJournal = false;
      }
      skipped += applyCyclesRec(r[5]);
      skipped += applyWishesRec(r[6]);
      skipped += applyJournalRec(r[7]);
      if(skipped) setBanner("skipped", "Bỏ qua " + skipped + " mục hỏng; phần còn lại vẫn bình thường.", "warn");
      return C.cleanupGenerations(db, gen).catch(function(){});
    });
  }

  function setUrl(id){
    if(state.urls[id]) URL.revokeObjectURL(state.urls[id]);
    var b = state.blobs[id];
    state.urls[id] = b ? URL.createObjectURL(new Blob([b.data], { type: b.mime || "image/jpeg" })) : null;
  }

  // ---------- View switching ----------
  function render(){
    $("loadingView").hidden = true;
    if(state.loadFailed){ showLoadFailed(); return; }
    var p = state.profile;
    if(!p || p.startStatus !== "ok") showSetup(); else showApp();
  }

  function showLoadFailed(){
    state.mode = "failed";
    closeSheets();
    stopClock();
    $("tabbar").hidden = true;
    $("setupView").hidden = true;
    ["home", "milestones", "cycle", "album", "settings"].forEach(function(t){ $("tab-" + t).hidden = true; });
    $("loadingView").hidden = false;
    $("loadingView").classList.add("failed");
    setBanner("load", state.dbError
      ? "Không mở được bộ nhớ của app (" + state.dbError + "). Dữ liệu đã lưu không bị ảnh hưởng — đóng các cửa sổ LoveDays khác rồi tải lại."
      : "Không đọc được dữ liệu đã lưu — dữ liệu vẫn còn nguyên.", "error",
      { label: "Tải lại app", run: function(){ location.reload(); } });
  }

  function showSetup(){
    state.mode = "setup";
    stopClock();
    $("tabbar").hidden = true;
    ["home", "milestones", "cycle", "album", "settings"].forEach(function(t){ $("tab-" + t).hidden = true; });
    $("setupView").hidden = false;
    var p = state.profile;
    if(p){
      $("setupNameLong").value = p.persons[0].name;
      $("setupNameThu").value = p.persons[1].name;
      setDateValue("setupDobLong", p.persons[0].dob || "");
      setDateValue("setupDobThu", p.persons[1].dob || "");
      if(p.startStatus === "future"){
        setDateValue("setupStart", p.startDate);
        setBanner("start", "Ngày bắt đầu đã lưu (" + fmtDate(p.startDate) + ") sau hôm nay — kiểm tra giờ máy hoặc chọn lại. Dữ liệu khác vẫn giữ nguyên.", "warn");
      } else {
        setBanner("start", "Ngày bắt đầu bị hỏng — hãy chọn lại. Dữ liệu khác vẫn giữ nguyên.", "warn");
      }
    }
  }

  function showApp(){
    state.mode = "app";
    setBanner("start", null);
    $("setupView").hidden = true;
    $("tabbar").hidden = false;
    recompute();
    renderHome();
    renderMilestones();
    renderWishes();
    renderJournal();
    fillProfileForm();
    renderPhotoRows();
    renderBackupCard();
    switchTab(state.tab);
    startClock();
    updateBadge();
  }

  function switchTab(name){
    if(state.tab === "album" && name !== "album") releaseAlbumThumbs();
    // The timeline pool serves the Kỷ niệm tab and the "Ngày này năm xưa" card on Home.
    if((state.tab === "milestones" || state.tab === "home") && name !== state.tab) releaseTl();
    showError("cycleCardErr", null);
    showError("cycleTabErr", null);
    showError("wishErr", null);
    showError("journalErr", null);
    showError("journalCardErr", null);
    state.tab = name;
    ["home", "milestones", "cycle", "album", "settings"].forEach(function(t){ $("tab-" + t).hidden = t !== name; });
    Array.prototype.forEach.call(document.querySelectorAll(".tabbar-btn"), function(b){
      if(b.getAttribute("data-tab") === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if(name === "settings"){
      refreshStorage(); renderDiag(); renderBackupCard(); renderPush(); renderCycleRemind(); renderDayRemind();
      refreshSub().then(function(){ renderPush(); checkPushChanged(); });
    }
    window.scrollTo(0, 0);
    if(name === "album") renderAlbum();
    if(name === "home" && state.mode === "app") renderOnThisDay();
    if(name === "milestones"){ syncTl(); placeSegPill($("msSeg"), true); }
    if(name === "cycle" && C.cycleStats) renderCycleSheet();
  }
  Array.prototype.forEach.call(document.querySelectorAll(".tabbar-btn"), function(b){
    b.addEventListener("click", function(){ switchTab(b.getAttribute("data-tab")); });
  });

  // ---------- Home ----------
  function recompute(){
    var t = now();
    state.computed = C.computeAll(state.profile, state.milestones, t);
    state.lastIdx = C.todayIdx(t);
  }

  function paintImg(container, url){
    var img = container.querySelector("img");
    if(url){ img.src = url; img.hidden = false; container.classList.add("has-img"); }
    else { img.removeAttribute("src"); img.hidden = true; container.classList.remove("has-img"); }
  }

  function renderHome(){
    var p = state.profile, c = state.computed;
    $("nameLong").textContent = p.persons[0].name;
    $("nameThu").textContent = p.persons[1].name;
    $("avatarLong").querySelector(".avatar-initial").textContent = initial(p.persons[0].name);
    $("avatarThu").querySelector(".avatar-initial").textContent = initial(p.persons[1].name);
    paintImg($("avatarLong"), state.urls["avatar-long"]);
    paintImg($("avatarThu"), state.urls["avatar-thu"]);
    paintImg($("cover"), state.urls.cover);
    $("dayCount").textContent = fmtInt(c.n);
    $("hoursCount").textContent = fmtInt(c.hours);
    $("liveClock").textContent = clockText(c.breakdown);
    $("sinceLine").textContent = "Từ " + fmtDate(p.startDate);
    renderGoal(c.n);
    renderUpcoming();

    $("birthdays").innerHTML = p.persons.map(function(person){
      var b = null;
      c.birthdays.forEach(function(x){ if(x.personId === person.id) b = x; });
      var head = '<p class="bday-head"><span class="bday-emoji" aria-hidden="true">🎂</span><span class="bday-name">' + escapeHtml(person.name) + "</span></p>";
      if(!b){
        return '<div class="card bday-card empty">' + head +
          '<button type="button" class="btn btn-soft btn-sm" data-goto="settings">Thêm ngày sinh</button></div>';
      }
      var meta = fmtDayMonth(b.date) + (b.turning > 0 ? " · tròn " + b.turning + " tuổi" : "");
      if(b.daysLeft === 0){
        return '<div class="card bday-card today">' + head + '<p class="bday-left today">Hôm nay 🎂</p><p class="bday-meta">' + meta + "</p></div>";
      }
      return '<div class="card bday-card">' + head +
        // Visible spans sit in a flex row, which drops the space between them for
        // screen readers ("13ngày") — so they're aria-hidden and an sr-only copy is read instead.
        '<p class="bday-left"><span class="sr-only">còn ' + fmtInt(b.daysLeft) + ' ngày</span><span class="bday-num" aria-hidden="true">' + fmtInt(b.daysLeft) + '</span><span class="bday-unit" aria-hidden="true">ngày</span></p>' +
        '<p class="bday-meta">' + meta + "</p></div>";
    }).join("");
    renderJournalCard();
    renderCycleCard();
    renderOnThisDay();
  }

  // ---------- "Ngày này năm xưa" ----------
  // Milestones, done wishes and photos of today's day and month in earlier years (LoveCore.onThisDay).
  // Read-only: a row opens the form of that record, a tile opens the viewer on that year's photos.
  var otd = { years: [] };
  function renderOnThisDay(){
    var card = $("otdCard");
    // An older cached love-days-core.js can be paired with this page offline.
    if(!C.onThisDay || state.mode !== "app"){ card.hidden = true; return; }
    var v = C.onThisDay({ milestones: state.milestones, wishes: wishesLocked() ? [] : state.wishes, photos: state.photos,
                          journal: journalLocked() ? [] : state.journal }, now());
    otd.years = v.years;
    card.hidden = !v.years.length;
    function row(attr, id, emoji, title, sub, said){
      return '<button type="button" class="up-row" ' + attr + '="' + escapeHtml(id) + '" aria-haspopup="dialog" aria-label="' + escapeHtml(said) + '">' +
        '<span class="up-emoji" aria-hidden="true">' + escapeHtml(emoji) + "</span>" +
        '<span class="up-main"><span class="up-title">' + escapeHtml(title) + "</span>" +
        (sub ? '<span class="otd-sub">' + escapeHtml(sub) + "</span>" : "") + "</span>" + CHEV + "</button>";
    }
    $("otdBody").innerHTML = v.years.map(function(g){
      var when = weekday(g.date) + ", " + fmtDate(g.date), n = g.photos.length, more = n - TL_MAX;
      var h = '<div class="otd-group"><h3 class="otd-year">' + g.yearsAgo + " năm trước · " + when + "</h3>";
      g.milestones.forEach(function(m){
        h += row("data-otd-ms", m.id, m.emoji || "💗", m.title, m.note, m.title + ", " + g.yearsAgo + " năm trước" + (m.note ? ". " + m.note : "") + ". Mở kỷ niệm");
      });
      g.wishes.forEach(function(w){
        h += row("data-otd-wish", w.id, wishEmoji(w.cat), w.title, "Đã làm cùng nhau", w.title + ", đã làm cùng nhau " + g.yearsAgo + " năm trước. Mở việc này");
      });
      (g.journal || []).forEach(function(e){
        var mood = e.mood ? MOOD[e.mood].label : "";
        h += row("data-otd-j", e.date, journalEmoji(e), e.text || mood, "Nhật ký" + (e.text && mood ? " · " + mood : ""),
          "Nhật ký " + g.yearsAgo + " năm trước" + (mood ? ": " + mood : "") + (e.text ? ". " + e.text : "") + ". Mở nhật ký ngày này");
      });
      if(n){
        h += '<ul class="tl-photos otd-photos" aria-label="' + escapeHtml("Ảnh chụp " + g.yearsAgo + " năm trước") + '">' + g.photos.slice(0, TL_MAX).map(function(p, i){
          return '<li><button type="button" class="tl-photo" data-otd-photo="' + p.id + '" data-otd-year="' + g.year + '" aria-label="' +
            escapeHtml("Ảnh " + (i + 1) + " trên " + n + ", chụp " + vnDate(p.takenAt)) + '">' + tlImg(p.id) +
            (more > 0 && i === TL_MAX - 1 ? '<span class="tl-more" aria-hidden="true">+' + more + "</span>" : "") + "</button></li>";
        }).join("") + "</ul>";
      }
      return h + "</div>";
    }).join("");
    syncTl();
  }
  $("otdBody").addEventListener("click", function(e){
    var el = e.target.closest("[data-otd-photo]");
    if(el){
      var year = +el.getAttribute("data-otd-year"), ids = null;
      otd.years.forEach(function(g){ if(g.year === year) ids = g.photos.map(function(p){ return p.id; }); });
      if(ids){ viewer.otdYear = year; openViewer(el.getAttribute("data-otd-photo"), ids, "home"); }
      return;
    }
    el = e.target.closest("[data-otd-ms]");
    if(el){
      var id = el.getAttribute("data-otd-ms"), m = null;
      state.milestones.forEach(function(x){ if(x.id === id) m = x; });
      if(m) openMilestoneSheet(m);
      return;
    }
    el = e.target.closest("[data-otd-j]");
    if(el){ openJournalSheet(el.getAttribute("data-otd-j")); return; }
    el = e.target.closest("[data-otd-wish]");
    var w = el ? wishById(el.getAttribute("data-otd-wish")) : null;
    if(w) openWishSheet(w);
  });

  // The "Sắp tới" card: the nearest milestone, then the nearest dated wish (if any).
  function renderUpcoming(){
    var u = state.computed.upcoming;
    var w = state.wishesBroken || !C.wishView ? null : C.wishView(state.wishes, now()).nearest;
    function row(seg, emoji, title, date, daysLeft, todayText, more){
      var when = weekday(date) + ", " + fmtDate(date);
      return '<button type="button" class="up-row" data-goto="milestones"' + (seg ? ' data-seg="' + seg + '"' : "") + ' aria-label="' +
        escapeHtml(title + ", " + weekday(date) + " " + fmtDate(date) + ", " + (daysLeft === 0 ? "hôm nay" : "còn " + fmtInt(daysLeft) + " ngày") + ". " + more) + '">' +
        '<span class="up-emoji" aria-hidden="true">' + escapeHtml(emoji) + '</span>' +
        '<span class="up-main"><span class="up-title">' + escapeHtml(title) + '</span><span class="up-date">' + when + "</span></span>" +
        (daysLeft === 0
          ? '<span class="up-left today">' + todayText + "</span>"
          : '<span class="up-left"><span class="up-num">' + fmtInt(daysLeft) + '</span><span class="up-unit">ngày nữa</span></span>') +
        "</button>";
    }
    var rows = [];
    if(u) rows.push(row("", u.emoji, u.title, u.date, u.daysLeft, "Hôm nay 🎉", "Xem tất cả kỷ niệm"));
    if(w) rows.push(row("wishes", wishEmoji(w.cat), w.title, w.planDate, w.daysLeft, "Hôm nay", "Xem việc muốn làm"));
    $("upcomingBody").innerHTML = rows.length ? rows.join('<span class="up-sep" aria-hidden="true"></span>')
      : '<p class="card-text">Chưa có mốc nào sắp tới.</p>';
  }
  function goTo(e){
    var btn = e.target.closest("[data-goto]");
    if(!btn) return;
    var tab = btn.getAttribute("data-goto");
    if(tab === "milestones") setMsSeg(btn.getAttribute("data-seg") === "wishes" ? "wishes" : "ms");
    switchTab(tab);
  }
  $("birthdays").addEventListener("click", goTo);
  $("upcomingBody").addEventListener("click", goTo);

  // Progress toward the next multiple of 100 days (the same K as the
  // "Ngày thứ K" milestone): K-100 → K fills the bar.
  function renderGoal(n){
    var K = Math.max(100, Math.ceil(n / 100) * 100), left = K - n;
    $("goalText").textContent = left === 0 ? "Hôm nay tròn " + fmtInt(K) + " ngày 🎉" : fmtInt(left) + " ngày nữa → " + fmtInt(K);
    $("goalFill").style.transform = "scaleX(" + (left === 0 ? 1 : (n - (K - 100)) / 100) + ")";
    $("goalFill").parentNode.parentNode.classList.toggle("done", left === 0);
  }

  $("btnCountInfo").addEventListener("click", function(){
    var open = $("countInfo").hidden;
    $("countInfo").hidden = !open;
    this.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // ---------- Live clock + day rollover ----------
  function tick(){
    if(state.mode !== "app") return;
    var t = now();
    if(C.todayIdx(t) !== state.lastIdx){
      recompute();
      renderHome();
      renderMilestones();
      renderWishes(); // countdowns follow the date; the form in #wishSheet is the user's and is never touched
      renderJournal(); // "today" moved; the open #journalSheet keeps its own day and text (Home card: renderHome above)
      renderBackupCard(); // "hôm nay"/"N ngày trước" and the stale colour depend on the date
      renderDayRemind();
      // The Chu kỳ tab follows the date; the form in the sheet is the user's and is never touched.
      if(C.cycleStats) renderCycleSheet();
      if(shareSheetOpen()) renderShare();
      updateBadge();
      return;
    }
    $("hoursCount").textContent = fmtInt(C.hoursTogether(state.profile.startDate, t));
    $("liveClock").textContent = clockText(C.breakdown(state.profile.startDate, t));
  }
  function startClock(){
    stopClock();
    tick();
    state.timer = setInterval(tick, 1000);
  }
  function stopClock(){
    if(state.timer) clearInterval(state.timer);
    state.timer = null;
  }
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "hidden"){ stopClock(); return; }
    if(state.mode === "app"){ startClock(); updateBadge(); }
  });

  // Only when the user already granted notifications (Phase 2 asks); never
  // prompts, never throws.
  function updateBadge(){
    try{
      if(!state.computed || !("setAppBadge" in navigator)) return;
      if(typeof Notification === "undefined" || Notification.permission !== "granted") return;
      var r = navigator.setAppBadge(state.computed.n);
      if(r && r.catch) r.catch(function(){});
    }catch(e){}
  }

  // ---------- Milestones ----------
  function renderMilestones(){
    var list = state.computed.list;
    function row(x){
      var sub = fmtDate(x.date);
      if(x.kind === "birthday" && x.turning > 0) sub += " · tròn " + x.turning + " tuổi";
      else if(x.kind === "user" && x.repeatYearly && x.years > 0) sub += " · lần thứ " + x.years;
      var label = escapeHtml(x.title + ", " + fmtDate(x.date) + ", " + daysLeftText(x));
      var inner = '<span class="ms-emoji" aria-hidden="true">' + escapeHtml(x.emoji) + "</span>" +
        '<span class="ms-main"><span class="ms-title">' + escapeHtml(x.title) + '</span><span class="ms-sub">' + escapeHtml(sub) + "</span></span>" +
        bigDays(x, "ms-left");
      var today = x.daysLeft === 0 ? " is-today" : "";
      if(x.auto) return '<li class="ms-item-wrap"><button type="button" class="ms-item auto' + today + '" data-ms-id="' + x.id + '" aria-haspopup="dialog" aria-label="' + label + '">' + inner + SHARE_ICON + "</button></li>";
      return '<li class="ms-item-wrap"><button type="button" class="ms-item' + today + '" data-ms-id="' + escapeHtml(x.id) + '" aria-label="' + label + '">' + inner +
        '<svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></li>';
    }
    function group(title, items){
      if(!items.length) return "";
      return '<h3 class="group-title">' + title + '</h3><ul class="ms-group">' + items.map(row).join("") + "</ul>";
    }
    $("milestoneList").innerHTML = group("Sắp tới", list.filter(function(x){ return !x.past; })) + timelineHtml();
    syncTl();
  }

  // Everything the user recorded that has already happened, newest first, at
  // its ORIGINAL date (a yearly one also sits in "Sắp tới" at its next date).
  function timelineHtml(){
    var tIdx = state.lastIdx, start = state.profile.startDate;
    var entries = state.milestones.filter(function(m){ return C.dayIdx(m.date) <= tIdx; }).map(function(m){
      return { idx: C.dayIdx(m.date), date: m.date, m: m };
    });
    var head = '<h3 class="group-title">Dòng thời gian</h3>';
    if(!entries.length){
      return head + '<div class="card empty-state"><p class="empty-text">Chưa có kỷ niệm nào đã qua. Thêm một ngày đáng nhớ và gắn ảnh từ Album.</p></div>';
    }
    entries.push({ idx: C.dayIdx(start), date: start, m: null });
    entries.sort(function(a, b){
      if(a.idx !== b.idx) return b.idx - a.idx;
      if(!a.m || !b.m) return a.m ? -1 : 1;
      return b.m.createdAt - a.m.createdAt || (a.m.id < b.m.id ? -1 : 1);
    });
    function item(e){
      var m = e.m, when = weekday(e.date) + ", " + fmtDate(e.date);
      if(!m){
        return '<li class="ms-item-wrap"><div class="ms-item tl-start"><span class="ms-emoji" aria-hidden="true">💕</span>' +
          '<span class="ms-main"><span class="ms-title">Ngày bắt đầu</span><span class="ms-sub">' + when + "</span></span></div></li>";
      }
      var ago = tIdx - e.idx, agoText = ago === 0 ? "hôm nay" : fmtInt(ago) + " ngày trước";
      var photos = msPhotos(m.photoIds);
      return '<li class="ms-item-wrap"><button type="button" class="ms-item" data-ms-id="' + escapeHtml(m.id) + '" aria-label="' + escapeHtml(m.title + ", " + when + ", " + agoText) + '">' +
        '<span class="ms-emoji" aria-hidden="true">' + escapeHtml(m.emoji || "💗") + "</span>" +
        '<span class="ms-main"><span class="ms-title">' + escapeHtml(m.title) + '</span><span class="ms-sub">' + when + "</span>" +
        (m.note ? '<span class="tl-note">' + escapeHtml(m.note) + "</span>" : "") + "</span>" +
        (ago === 0 ? '<span class="ms-left today">Hôm nay 🎉</span>'
          : '<span class="ms-left past"><span class="sr-only">' + agoText + '</span><span class="ms-num" aria-hidden="true">' + fmtInt(ago) +
            '</span><span class="ms-unit" aria-hidden="true">ngày trước</span></span>') + CHEV + "</button>" +
        (photos.length ? '<ul class="tl-photos" aria-label="' + escapeHtml("Ảnh của " + m.title) + '">' + photoStrip(photos, m.title, m.id) + "</ul>" : "") + "</li>";
    }
    var h = head, year = null;
    entries.forEach(function(e){
      var y = e.date.slice(0, 4);
      if(y !== year){
        h += (year === null ? "" : "</ul>") + '<h3 class="group-title tl-year">' + y + '</h3><ul class="ms-group">';
        year = y;
      }
      h += item(e);
    });
    return h + "</ul>";
  }

  // ---------- Milestone photos ----------
  // photoIds on a milestone point at album photos. A link whose photo is gone
  // is skipped when read; it only leaves the record when the user saves it again.
  var MAX_MS = C.MAX_MS_PHOTOS || 60, TL_MAX = 4;
  // photoIds = what "Lưu kỷ niệm" will write; pick = the working copy while choosing (null otherwise).
  var msDraft = { photoIds: [], pick: null, saving: false };
  var PICK_CHECK = '<span class="pick-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';

  // Shown by the day they were taken, whatever order they were picked in.
  function msPhotos(ids){
    return (ids || []).map(photoById).filter(Boolean).sort(function(a, b){
      var ka = a.takenAt != null ? a.takenAt : a.addedAt, kb = b.takenAt != null ? b.takenAt : b.addedAt;
      return ka - kb || a.addedAt - b.addedAt || (a.id < b.id ? -1 : 1);
    });
  }
  function msPhotoIds(ids){ return msPhotos(ids).map(function(p){ return p.id; }); }
  function tlImg(id){ return '<img alt="" data-tl="' + id + '"' + (tlUrls[id] ? ' src="' + tlUrls[id] + '"' : "") + ">"; }
  // At most TL_MAX tiles, the last one carrying "+N" for the rest. With msId
  // the tiles are buttons that open the viewer; without, plain pictures.
  function photoStrip(photos, title, msId){
    var n = photos.length, more = n - TL_MAX;
    return photos.slice(0, TL_MAX).map(function(p, i){
      var over = more > 0 && i === TL_MAX - 1 ? '<span class="tl-more" aria-hidden="true">+' + more + "</span>" : "";
      if(!msId) return '<li class="tl-photo">' + tlImg(p.id) + over + "</li>";
      return '<li><button type="button" class="tl-photo" data-tl-open="' + p.id + '" data-tl-ms="' + escapeHtml(msId) + '" aria-label="' +
        escapeHtml("Ảnh " + (i + 1) + " trên " + n + " của " + title) + '">' + tlImg(p.id) + over + "</button></li>";
    }).join("");
  }

  // Thumbnails of the timeline, of the milestone sheet and of the Home "Ngày này năm xưa" card. A pool of its own:
  // the album's is tied to the Album tab and emptied on leaving it. A URL
  // lives only while an <img data-tl> that is on show uses it.
  var tlUrls = Object.create(null), tlWanted = [], tlTimer = null;
  var tlIO = "IntersectionObserver" in window ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      tlIO.unobserve(e.target);
      wantTl(e.target.getAttribute("data-tl"));
    });
  }, { rootMargin: "300px 0px" }) : null;

  function msSheetOpen(){ return $("milestoneSheet").classList.contains("open"); }
  function tlImgs(){
    var out = [];
    function add(root){ Array.prototype.push.apply(out, root.querySelectorAll("img[data-tl]")); }
    if(state.mode === "app" && state.tab === "milestones") add($("milestoneList"));
    if(state.mode === "app" && state.tab === "home") add($("otdCard"));
    if(msSheetOpen()) add($("milestoneSheet"));
    return out;
  }
  function wantTl(id){
    tlWanted.push(id);
    if(!tlTimer) tlTimer = setTimeout(flushTl, 16);
  }
  function flushTl(){
    tlTimer = null;
    var ids = tlWanted.filter(function(id, i, a){ return a.indexOf(id) === i && !tlUrls[id]; });
    tlWanted = [];
    if(!ids.length) return;
    readBlobs(ids).then(function(recs){
      var imgs = tlImgs();
      recs.forEach(function(rec, i){
        var id = ids[i];
        var mine = imgs.filter(function(img){ return img.getAttribute("data-tl") === id; });
        if(!rec || !mine.length || !photoById(id)) return;
        if(!tlUrls[id]){
          var buf = rec.thumb instanceof ArrayBuffer && rec.thumb.byteLength ? rec.thumb : rec.data;
          if(!(buf instanceof ArrayBuffer)) return;
          tlUrls[id] = URL.createObjectURL(new Blob([buf], { type: "image/jpeg" }));
        }
        mine.forEach(function(img){ img.src = tlUrls[id]; });
      });
    });
  }
  function revokeTl(id){
    if(tlUrls[id]){ URL.revokeObjectURL(tlUrls[id]); delete tlUrls[id]; }
  }
  // Gives every thumbnail on show its URL and revokes the ones nothing shows any more.
  function syncTl(){
    if(tlIO) tlIO.disconnect();
    var imgs = tlImgs(), need = Object.create(null);
    imgs.forEach(function(img){ need[img.getAttribute("data-tl")] = true; });
    Object.keys(tlUrls).forEach(function(id){ if(!need[id]) revokeTl(id); });
    imgs.forEach(function(img){
      var id = img.getAttribute("data-tl");
      if(tlUrls[id]){ if(img.getAttribute("src") !== tlUrls[id]) img.src = tlUrls[id]; }
      else if(tlIO) tlIO.observe(img);
      else wantTl(id);
    });
  }
  function releaseTl(){
    if(tlIO) tlIO.disconnect();
    Object.keys(tlUrls).forEach(revokeTl);
    Array.prototype.forEach.call(document.querySelectorAll("img[data-tl][src]"), function(img){ img.removeAttribute("src"); });
  }

  function openMsViewer(msId, photoId){
    var m = null;
    state.milestones.forEach(function(x){ if(x.id === msId) m = x; });
    if(!m) return;
    viewer.msId = msId;
    openViewer(photoId, msPhotoIds(m.photoIds), "ms");
  }

  $("milestoneList").addEventListener("click", function(e){
    var tile = e.target.closest("[data-tl-open]");
    if(tile){ openMsViewer(tile.getAttribute("data-tl-ms"), tile.getAttribute("data-tl-open")); return; }
    var btn = e.target.closest("button[data-ms-id]");
    if(!btn) return;
    var id = btn.getAttribute("data-ms-id");
    var m = null, auto = null;
    state.milestones.forEach(function(x){ if(x.id === id) m = x; });
    if(m){ openMilestoneSheet(m); return; }
    state.computed.list.forEach(function(x){ if(x.auto && x.id === id) auto = x; });
    // "Ngày thứ 1.000" already says the day number — no second line for it.
    if(auto) openShare("milestone", { title: auto.title, emoji: auto.emoji, date: auto.date, dayNo: auto.kind === "hundred" ? null : undefined });
  });
  // One "Thêm" button for the tab: it adds whichever list is on show.
  $("btnAddMilestone").addEventListener("click", function(){
    if(wish.seg === "wishes") openWishSheet(null);
    else if(wish.seg === "journal") openJournalSheet(C.todayStr(now()));
    else openMilestoneSheet(null);
  });

  $("emojiPicks").innerHTML = EMOJI_PICKS.map(function(e){
    return '<button type="button" class="emoji-pick" data-emoji="' + e + '" aria-label="Chọn ' + e + '" aria-pressed="false">' + e + "</button>";
  }).join("");
  // An empty field saves as 💗 (LoveCore's default), so 💗 shows as picked.
  function markEmoji(){
    var v = $("msEmoji").value.trim() || "💗";
    Array.prototype.forEach.call($("emojiPicks").children, function(b){
      b.setAttribute("aria-pressed", b.getAttribute("data-emoji") === v ? "true" : "false");
    });
  }
  $("emojiPicks").addEventListener("click", function(e){
    var b = e.target.closest("[data-emoji]");
    if(!b) return;
    $("msEmoji").value = b.getAttribute("data-emoji");
    markEmoji();
  });
  $("msEmoji").addEventListener("input", markEmoji);

  function openMilestoneSheet(m){
    pendingWishId = null;
    state.editingId = m ? m.id : null;
    $("msSheetTitle").textContent = m ? "Sửa kỷ niệm" : "Thêm kỷ niệm";
    $("msTitle").value = m ? m.title : "";
    setDateValue("msDate", m ? m.date : C.todayStr(now()));
    $("msEmoji").value = m ? m.emoji : "";
    markEmoji();
    $("msNote").value = m ? m.note : "";
    $("msRepeat").checked = m ? m.repeatYearly : false;
    $("msDelete").hidden = !m;
    $("msConfirm").hidden = true;
    $("msShare").hidden = !m;
    showError("msError", null);
    msDraft.photoIds = m ? msPhotoIds(m.photoIds) : [];
    msDraft.saving = false;
    setPickMode(false);
    renderMsPhotos();
    openSheet("milestoneSheet");
    syncTl();
  }

  function renderMsPhotos(){
    var photos = msPhotos(msDraft.photoIds), n = photos.length;
    $("msPhotos").innerHTML = photoStrip(photos, "", null);
    $("msPhotos").hidden = !n;
    $("msPickOpen").textContent = "Chọn ảnh từ Album" + (n ? " · " + n + " ảnh" : "");
  }

  // Choosing happens inside the same sheet (a second sheet can't stack): the
  // form is only hidden, so whatever was typed in it is still there afterwards.
  function setPickMode(on){
    msDraft.pick = on ? msDraft.photoIds.slice() : null;
    $("milestoneForm").hidden = on;
    $("msPick").hidden = !on;
    $("msPickBack").hidden = !on;
    $("milestoneSheet").classList.toggle("picking", on);
    $("msSheetTitle").textContent = on ? "Chọn ảnh" : state.editingId ? "Sửa kỷ niệm" : "Thêm kỷ niệm";
    if(!on){ $("msPickGrid").innerHTML = ""; return; }
    var list = sortedPhotos();
    $("msPickEmpty").hidden = list.length > 0;
    $("msPickGrid").hidden = !list.length;
    $("msPickGrid").innerHTML = list.map(function(p, i){
      var label = "Ảnh " + (i + 1) + ", " + photoDateText(p).toLowerCase() + (p.caption ? ": " + p.caption : "");
      return '<li class="album-tile"><button type="button" class="album-thumb pick-tile" data-pick="' + p.id + '" aria-label="' + escapeHtml(label) + '">' +
        tlImg(p.id) + PICK_CHECK + "</button></li>";
    }).join("");
    paintPick();
    $("milestoneSheet").scrollTop = 0;
  }
  function paintPick(){
    var sel = Object.create(null), n = msDraft.pick.length, full = n >= MAX_MS;
    msDraft.pick.forEach(function(id){ sel[id] = true; });
    Array.prototype.forEach.call($("msPickGrid").querySelectorAll("[data-pick]"), function(b){
      var on = !!sel[b.getAttribute("data-pick")];
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if(full && !on) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
    });
    $("msPickDone").textContent = "Xong" + (n ? " · " + n + " ảnh" : "");
    $("msPickLimit").hidden = !full;
  }
  function leavePick(){
    setPickMode(false);
    renderMsPhotos();
    syncTl();
    $("msPickOpen").focus({ preventScroll: true });
  }
  $("msPickOpen").addEventListener("click", function(){
    if(msDraft.saving) return;
    setPickMode(true);
    syncTl();
    $("msPickBack").focus({ preventScroll: true });
  });
  $("msPickGrid").addEventListener("click", function(e){
    var b = e.target.closest("[data-pick]");
    if(!b || !msDraft.pick) return;
    var id = b.getAttribute("data-pick"), i = msDraft.pick.indexOf(id);
    if(i !== -1) msDraft.pick.splice(i, 1);
    else if(msDraft.pick.length < MAX_MS) msDraft.pick.push(id);
    paintPick();
  });
  $("msPickDone").addEventListener("click", function(){
    if(!msDraft.pick) return;
    msDraft.photoIds = msDraft.pick.slice();
    leavePick();
  });
  $("msPickBack").addEventListener("click", leavePick);
  // After the slide-out, so the pictures don't blank while the sheet is still on screen.
  function cleanMsSheet(){
    if(msSheetOpen()) return;
    msDraft.pick = null;
    $("msPickGrid").innerHTML = "";
    $("msPhotos").innerHTML = "";
    syncTl();
  }

  $("milestoneForm").addEventListener("submit", function(e){
    e.preventDefault();
    var title = $("msTitle").value.trim(), date = $("msDate").value;
    if(!title){ showError("msError", "Hãy đặt tên cho kỷ niệm."); return; }
    if(!C.isValidDate(date)){ showError("msError", "Hãy chọn ngày hợp lệ."); return; }
    if(msDraft.saving) return;
    // An import gives photos new ids in its last step; links saved now could point at nothing.
    if(busy === "import"){ showError("msError", "Đang nhập bản sao lưu — đợi xong rồi thử lại."); return; }
    // An older cached core has no photoIds in validateMilestone and would drop the links without a word.
    if(!C.MAX_MS_PHOTOS){ showError("msError", "App vừa cập nhật — hãy đóng hẳn rồi mở lại app, sau đó lưu lại."); return; }
    var old = null;
    state.milestones.forEach(function(x){ if(x.id === state.editingId) old = x; });
    var rec = C.validateMilestone({
      id: old ? old.id : "m" + now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: title, date: date, emoji: C.clipGraphemes($("msEmoji").value.trim(), 16), note: $("msNote").value.trim(),
      repeatYearly: $("msRepeat").checked, createdAt: old ? old.createdAt : now(),
      photoIds: msPhotoIds(msDraft.photoIds)
    });
    if(!rec){ showError("msError", "Dữ liệu chưa hợp lệ, hãy kiểm tra lại."); return; }
    msDraft.saving = true;
    Promise.resolve().then(function(){ return put("milestones", rec); }).then(function(){
      msDraft.saving = false;
      var linkId = old ? null : pendingWishId;
      state.milestones = state.milestones.filter(function(x){ return x.id !== rec.id; }).concat([rec]);
      dataChanged();
      closeSheets();
      recompute(); renderHome(); renderMilestones();
      toast(old ? "Đã lưu kỷ niệm ✓" : "Đã thêm kỷ niệm 💕");
      if(linkId) linkWish(linkId, rec.id);
    }, function(){
      msDraft.saving = false;
      showError("msError", "Không lưu được vào bộ nhớ máy. Hãy thử lại.");
    });
  });

  // The picture is made from the SAVED record; unsaved edits in the form are
  // never thrown away by leaving for the share sheet.
  $("msShare").addEventListener("click", function(){
    var m = null;
    state.milestones.forEach(function(x){ if(x.id === state.editingId) m = x; });
    if(!m) return;
    if($("msTitle").value.trim() !== m.title || $("msDate").value !== m.date || C.clipGraphemes($("msEmoji").value.trim(), 16) !== (m.emoji || "") ||
       $("msNote").value.trim() !== (m.note || "") || $("msRepeat").checked !== !!m.repeatYearly ||
       msDraft.photoIds.slice().sort().join() !== msPhotoIds(m.photoIds).sort().join()){
      showError("msError", "Hãy lưu kỷ niệm trước rồi tạo ảnh.");
      return;
    }
    closeSheets();
    openShare("milestone", { title: m.title, emoji: m.emoji || "💗", date: m.date });
  });

  $("msDelete").addEventListener("click", function(){
    var id = state.editingId, m = null;
    state.milestones.forEach(function(x){ if(x.id === id) m = x; });
    if(!m || msDraft.saving) return;
    $("msConfirmText").textContent = "Xoá kỷ niệm “" + m.title + "”? Ảnh trong Album vẫn còn.";
    $("msDelete").hidden = true;
    $("msConfirm").hidden = false;
    $("msConfirmNo").focus({ preventScroll: true });
    $("msConfirm").scrollIntoView({ block: "nearest" });
  });
  $("msConfirmNo").addEventListener("click", function(){
    if(msDraft.saving) return;
    $("msConfirm").hidden = true;
    $("msDelete").hidden = false;
    $("msDelete").focus({ preventScroll: true });
  });
  $("msConfirmYes").addEventListener("click", function(){
    var id = state.editingId, m = null;
    state.milestones.forEach(function(x){ if(x.id === id) m = x; });
    if(!m || msDraft.saving) return;
    if(busy === "import"){ showError("msError", "Đang nhập bản sao lưu — đợi xong rồi thử lại."); return; }
    msDraft.saving = true;
    Promise.resolve().then(function(){ return del("milestones", id); }).then(function(){
      msDraft.saving = false;
      state.milestones = state.milestones.filter(function(x){ return x.id !== id; });
      dataChanged();
      closeSheets();
      recompute(); renderHome(); renderMilestones();
      toast("Đã xoá kỷ niệm");
    }, function(){
      msDraft.saving = false;
      showError("msError", "Không xoá được. Hãy thử lại.");
    });
  });

  // ---------- Cycles ----------
  // The whole log is one kv record, so every write carries state.cyclesBad
  // (items the validator rejected, kept verbatim) back with it, and nothing is
  // written at all when the stored record itself was unreadable.
  var cyc = { mode: "list", editingId: null, saving: false, quiet: false, lastDate: null };
  var CYCLE_BROKEN_TEXT = "Không đọc được dữ liệu chu kỳ — dữ liệu vẫn còn nguyên";
  var SHARE_ICON = '<svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M8 7l4-4 4 4M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H18"/></svg>';
  var CHEV = '<svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  // Identifies the stored record this window last saw; undefined (no record
  // yet) and a record without a numeric updatedAt each get their own value.
  function cyclesStampOf(rec){
    return rec === undefined ? null : rec && typeof rec.updatedAt === "number" ? rec.updatedAt : "?";
  }
  // Puts a stored kv 'cycles' record into state; returns how many items were set aside.
  function applyCyclesRec(cy){
    var skipped = 0, seen = Object.create(null);
    state.cycles = []; state.cyclesBad = []; state.cyclesBroken = false;
    state.cyclesStamp = cyclesStampOf(cy);
    if(cy === undefined) return 0;
    if(!cy || typeof cy !== "object" || !Array.isArray(cy.items)){ state.cyclesBroken = true; return 0; }
    // Without validateCycle (older cached core) nothing can be judged: keep it all verbatim.
    if(!C.validateCycle){ state.cyclesBad = cy.items.slice(); return 0; }
    cy.items.forEach(function(it){
      var v = C.validateCycle(it);
      // A repeated id is set aside too: editing "that" cycle would otherwise drop its twin.
      if(v && !seen[v.id]){ seen[v.id] = true; state.cycles.push(v); }
      else { state.cyclesBad.push(it); skipped++; }
    });
    return skipped;
  }

  // The stored record is re-read inside the write transaction: if another
  // LoveDays window changed it since this one loaded it, nothing is written —
  // the newer log is loaded instead and the caller reports it.
  function saveCycles(next){
    if(state.loadFailed || state.cyclesBroken || !C.cycleStats) return Promise.reject(new Error("cycles locked"));
    // An import works from a snapshot and writes the log back in its last step.
    if(busy === "import") return Promise.reject(userErr("Đang nhập bản sao lưu. Hãy đợi xong rồi thử lại."));
    var stamp = now();
    // Two writes inside the same millisecond must still get different stamps.
    if(typeof state.cyclesStamp === "number" && stamp <= state.cyclesStamp) stamp = state.cyclesStamp + 1;
    var rec = { key: "cycles", items: next.concat(state.cyclesBad), updatedAt: stamp };
    function done(){
      state.cycles = next;
      state.cyclesStamp = stamp;
      dataChanged();
    }
    if(!state.db) return put("kv", rec).then(done);
    var tx = state.db.transaction("kv", "readwrite"), st = tx.objectStore("kv"), stale = false, found;
    var rq = st.get("cycles");
    rq.onsuccess = function(){
      found = rq.result;
      if(cyclesStampOf(found) !== state.cyclesStamp) stale = true; else st.put(rec);
    };
    return C.txDone(tx).then(function(){
      if(!stale){ done(); return; }
      applyCyclesRec(found);
      renderCycleCard();
      renderCycleSheet();
      throw userErr("Sổ vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.");
    });
  }
  function cycleById(id){
    for(var i = 0; i < state.cycles.length; i++) if(state.cycles[i].id === id) return state.cycles[i];
    return null;
  }
  function fmtAvg(x){
    var r = Math.round(x * 10) / 10;
    return (r === Math.floor(r) ? String(r) : r.toFixed(1).replace(".", ",")) + " ngày";
  }
  function fmtCycleRange(c){
    if(c.end == null || c.end === c.start) return fmtDate(c.start);
    return (c.start.slice(0, 4) === c.end.slice(0, 4) ? fmtDayMonth(c.start) : fmtDate(c.start)) + " – " + fmtDate(c.end);
  }
  function cycleErrText(cf){
    if(cf.code === "dupStart") return "Đã có kỳ bắt đầu ngày " + fmtDate(cf.other.start);
    if(cf.code === "overlap") return "Trùng với kỳ " + fmtCycleRange(cf.other);
    if(cf.code === "openOverlap"){
      return cf.self ? "Kỳ này cách kỳ " + fmtDate(cf.other.start) + " chưa tới " + C.CYCLE_OPEN_MAX + " ngày — hãy ghi ngày kết thúc."
        : "Kỳ " + fmtDate(cf.other.start) + " chưa ghi ngày kết thúc — hãy ghi ngày kết thúc cho kỳ đó trước.";
    }
    if(cf.code === "endBeforeStart") return "Ngày kết thúc phải từ ngày bắt đầu trở đi";
    if(cf.code === "tooLong") return "Một kỳ dài tối đa " + C.CYCLE_MAX_LEN + " ngày";
    if(cf.code === "future") return "Chưa ghi được ngày ở tương lai";
    return "Đã đủ " + C.MAX_CYCLES + " kỳ";
  }
  function cycleView(st){
    if(st.inPeriod) return { kind: "in", status: "Ngày thứ " + st.dayOfPeriod + " của kỳ" };
    if(st.daysLeft > 0) return { kind: "left", status: "Còn " + fmtInt(st.daysLeft) + " ngày" };
    if(st.daysLeft === 0) return { kind: "today", status: "Dự kiến hôm nay" };
    // Late is counted from the predicted day. Only when the wait is past twice
    // the usual cycle does it stop being "late" and start looking like a
    // period that was never logged.
    if(st.sinceLast <= Math.max(C.CYCLE_MAX, st.cycleLen * 2)) return { kind: "late", status: "Trễ " + (-st.daysLeft) + " ngày" };
    return { kind: "long", status: "Đã " + fmtInt(st.sinceLast) + " ngày từ kỳ gần nhất" };
  }
  function bigRight(num, unit, unitFirst){
    var n = '<span class="up-num">' + num + "</span>", u = '<span class="up-unit">' + unit + "</span>";
    return '<span class="up-left" aria-hidden="true">' + (unitFirst ? u + n : n + u) + "</span>";
  }

  function renderCycleCard(){
    var card = $("cycleCard");
    // An older cached love-days-core.js can be paired with this page offline.
    if(!C.cycleStats){
      card.hidden = true; $("cycleSetCard").hidden = true; $("cycleSetTitle").hidden = true;
      document.querySelector('.tabbar-btn[data-tab="cycle"]').hidden = true;
      return;
    }
    card.hidden = state.meta.showCycle === false;
    $("cycleShow").checked = state.meta.showCycle !== false;
    var body = $("cycleBody"), quick = $("cycleQuick"), past = $("cycleAddPast");
    if(state.cyclesBroken){
      body.innerHTML = '<p class="card-text">' + CYCLE_BROKEN_TEXT + ".</p>";
      quick.hidden = true; past.hidden = true;
      return;
    }
    var t = now(), st = C.cycleStats(state.cycles, t);
    if(!st.last){
      body.innerHTML = '<p class="card-text">Chưa ghi kỳ nào</p>';
      quick.hidden = false; quick.setAttribute("data-act", "start"); quick.textContent = "Bắt đầu hôm nay";
      past.hidden = false;
      return;
    }
    var v = cycleView(st), title = "Kỳ tới dự kiến", sub = weekday(st.next) + ", " + fmtDate(st.next), right;
    if(v.kind === "in"){
      title = "Đang trong kỳ"; sub = "Kỳ tới dự kiến " + fmtDate(st.next);
      right = bigRight(st.dayOfPeriod, "ngày thứ", true);
    } else if(v.kind === "left") right = bigRight(fmtInt(st.daysLeft), "ngày nữa");
    else if(v.kind === "today") right = '<span class="up-left today" aria-hidden="true">Hôm nay</span>';
    else if(v.kind === "late") right = '<span class="status-tag warn" aria-hidden="true">' + v.status + "</span>";
    else {
      title = "Kỳ gần nhất"; sub = weekday(st.last.start) + ", " + fmtDate(st.last.start);
      right = bigRight(fmtInt(st.sinceLast), "ngày trước");
    }
    var est = st.usedDefault && v.kind !== "long" ? "Ước tính theo " + C.CYCLE_DEFAULT + " ngày" : "";
    body.innerHTML = '<button type="button" class="up-row cycle-row" id="cycleOpen" aria-label="' +
      escapeHtml(v.status + ". " + title + ": " + sub + (est ? ". " + est : "") + ". Mở tab Chu kỳ") + '">' +
      '<span class="up-main"><span class="up-title">' + title + '</span><span class="up-date">' + sub + "</span>" +
      (est ? '<span class="up-date">' + est + "</span>" : "") + "</span>" + right + CHEV + "</button>";
    past.hidden = true;
    var ending = st.last.end == null && st.inPeriod;
    quick.hidden = st.last.end != null && st.inPeriod;
    quick.setAttribute("data-act", ending ? "end" : "start");
    quick.textContent = ending ? "Kết thúc hôm nay" : "Bắt đầu hôm nay";
  }

  // Bars = days between consecutive period starts (latest 12), dashed line =
  // the average in use. Gaps left out of the average are drawn faint.
  function cycleChartHtml(st){
    var gaps = st.list.filter(function(x){ return x.gap !== null; }).slice(-12);
    if(gaps.length < 2) return "";
    var W = 320, H = 150, padL = 6, padR = 6, top = 22, base = 118;
    var max = 0;
    gaps.forEach(function(x){ if(x.gap > max) max = x.gap; });
    if(st.avgGap && st.avgGap > max) max = st.avgGap;
    var slot = (W - padL - padR) / gaps.length, bw = Math.min(30, slot * 0.62), s = "";
    gaps.forEach(function(x, i){
      var cx = padL + slot * i + slot / 2, bh = Math.max(2, (base - top) * x.gap / max), y = base - bh;
      s += '<rect class="cy-bar' + (x.gapOk ? "" : " off") + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4"/>' +
        '<text class="cy-val" x="' + cx.toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle">' + x.gap + "</text>" +
        '<text class="cy-lbl" x="' + cx.toFixed(1) + '" y="' + (base + 15) + '" text-anchor="middle">' + fmtDayMonth(x.start) + "</text>";
    });
    if(st.n){
      var ay = base - (base - top) * st.avgGap / max;
      s += '<line class="cy-avg" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + ay.toFixed(1) + '" y2="' + ay.toFixed(1) + '"/>';
    }
    var label = "Khoảng cách giữa các kỳ, tính bằng ngày: " + gaps.map(function(x){ return fmtDayMonth(x.start) + " " + x.gap; }).join(", ") +
      (st.n ? ". Trung bình " + fmtAvg(st.avgGap) : "");
    return '<h4 class="import-step">Khoảng cách giữa các kỳ <span class="cycle-stat-sub">(ngày)</span></h4>' +
      '<div class="cycle-chart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + escapeHtml(label) + '">' + s + "</svg>" +
      '<p class="cycle-legend">Mỗi cột là số ngày từ kỳ trước tới kỳ bắt đầu ngày ghi dưới cột' + (st.n ? " · nét đứt: trung bình " + fmtAvg(st.avgGap) : "") +
      (gaps.some(function(x){ return !x.gapOk; }) ? " · cột nhạt: không tính trung bình" : "") + "</p></div>";
  }

  // ---------- Month calendar on the Chu kỳ tab ----------
  // ym: "YYYY-MM" on show, null = follow today's month. sel: the tapped day.
  // Kept outside the render so a rebuild of the tab (day rollover, after a
  // write) stays on the month being looked at.
  var cal = { ym: null, sel: null, swiped: false };
  var CAL_WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  var CAL_MIN_YM = "2000-01";
  function calArrow(d){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  function ymShift(ym, k){
    var p = C.addMonthsClamp({ y: +ym.slice(0, 4), m: +ym.slice(5, 7), d: 1 }, k);
    return p.y + "-" + pad2(p.m);
  }
  function calCtx(st){
    var tIdx = C.todayIdx(now()), today = C.idxToStr(tIdx);
    var isLong = !!st.last && cycleView(st).kind === "long";
    var far = (!isLong && (st.nextMax || st.next)) || today;
    var maxYm = ymShift((far > today ? far : today).slice(0, 7), 1);
    var ym = cal.ym || today.slice(0, 7);
    if(ym > maxYm) ym = maxYm;
    if(ym < CAL_MIN_YM) ym = CAL_MIN_YM;
    return { st: st, today: today, tIdx: tIdx, ym: ym, maxYm: maxYm, marks: C.cycleDayMarks(st, tIdx, isLong) };
  }
  // What the line under the grid says about a day, and the one action offered:
  // "add" (log a period starting that day) or "end" (close the open period `c`).
  function calDayInfo(day, x){
    var list = x.st.list, dIdx = C.dayIdx(day), mk = x.marks[day], i, c;
    var past = dIdx <= x.tIdx, open = null, prev = null;
    for(i = 0; i < list.length; i++){
      var s = C.dayIdx(list[i].start);
      if(list[i].end == null && dIdx > s && dIdx <= s + C.CYCLE_OPEN_MAX - 1) open = list[i];
      if(s < dIdx) prev = list[i];
    }
    var act = past && open ? "end" : null;
    if(mk && mk.period){
      c = null;
      for(i = 0; i < list.length; i++) if(list[i].id === mk.period) c = list[i];
      return { text: "Kỳ " + fmtCycleRange(c) + " · ngày thứ " + (dIdx - C.dayIdx(c.start) + 1) + (c.end == null ? " · chưa ghi ngày kết thúc" : ""),
               act: act, c: open };
    }
    var text;
    if(mk && mk.predicted) text = "Dự đoán kỳ tới";
    else if(mk && mk.range) text = "Có thể rơi vào " + fmtDayMonth(x.st.nextMin) + " – " + fmtDate(x.st.nextMax);
    else if(!past) text = "Chưa tới ngày này";
    else if(prev) text = "Ngày thứ " + fmtInt(dIdx - C.dayIdx(prev.start) + 1) + " kể từ kỳ " + (prev.start.slice(0, 4) === day.slice(0, 4) ? fmtDayMonth(prev.start) : fmtDate(prev.start));
    else text = "Chưa ghi kỳ nào trước ngày này";
    return { text: text, act: act || (past ? "add" : null), c: open };
  }
  function calInfoHtml(x){
    if(!cal.sel) return '<p class="cal-info-text muted">Chạm một ngày để xem hoặc ghi kỳ.</p>';
    var info = calDayInfo(cal.sel, x);
    return '<p class="cal-info-date">' + weekday(cal.sel) + ", " + fmtDate(cal.sel) + '</p><p class="cal-info-text">' + info.text + "</p>" +
      (info.act === "add" ? '<button type="button" class="btn btn-soft btn-block" data-cy="add-on">Ghi kỳ bắt đầu ngày này</button>' : "") +
      (info.act === "end" ? '<button type="button" class="btn btn-soft btn-block" data-cy="end-on">Ghi ngày kết thúc ngày này</button>' : "");
  }
  function calHtml(x){
    var y = +x.ym.slice(0, 4), m = +x.ym.slice(5, 7);
    var h = '<div class="cal-head"><h4 class="cal-title" id="calTitle">Tháng ' + m + "/" + y + "</h4>" +
      (x.ym !== x.today.slice(0, 7) ? '<button type="button" class="cal-today" data-cal-nav="today">Hôm nay</button>' : "") +
      '<button type="button" class="cal-nav" data-cal-nav="prev" aria-label="Tháng trước"' + (x.ym <= CAL_MIN_YM ? " disabled" : "") + ">" + calArrow("M15 5l-7 7 7 7") + "</button>" +
      '<button type="button" class="cal-nav" data-cal-nav="next" aria-label="Tháng sau"' + (x.ym >= x.maxYm ? " disabled" : "") + ">" + calArrow("M9 5l7 7-7 7") + "</button></div>" +
      '<div class="cal-week" aria-hidden="true">' + CAL_WD.map(function(w){ return "<span>" + w + "</span>"; }).join("") + "</div>" +
      '<div class="cal-grid" role="group" aria-labelledby="calTitle">';
    C.monthGrid(y, m).forEach(function(d){
      var mk = x.marks[d], cls = "cal-day", label = weekday(d) + ", " + fmtDate(d), mark = false;
      if(d.slice(0, 7) !== x.ym) cls += " is-out";
      if(d === x.today){ cls += " is-today"; label += ", hôm nay"; }
      if(mk && mk.period){ cls += " is-period"; label += ", đã ghi" + (mk.open ? ", chưa ghi ngày kết thúc" : ""); }
      else if(mk){
        if(mk.predicted){ cls += " is-pred"; label += ", dự đoán kỳ tới"; }
        if(mk.range){ cls += " is-range"; label += ", có thể rơi vào"; }
        mark = true;
      }
      h += '<button type="button" class="' + cls + '" data-cal-day="' + d + '" aria-pressed="' + (d === cal.sel ? "true" : "false") + '" aria-label="' + label + '">' +
        '<span class="cal-num">' + (+d.slice(8, 10)) + "</span>" + (mark ? '<i class="cal-mark" aria-hidden="true"></i>' : "") + "</button>";
    });
    function key(cls, text, mark){
      return '<span class="cal-key"><i class="cal-swatch ' + cls + '" aria-hidden="true">' + (mark ? '<i class="cal-mark"></i>' : "") + "</i>" + text + "</span>";
    }
    return h + '</div><p class="cal-legend">' + key("is-period", "Đã ghi") + key("is-pred", "Dự đoán", true) + key("is-range", "Có thể rơi vào", true) + key("is-today", "Hôm nay") + "</p>" +
      '<div class="cal-info" id="calInfo" role="status">' + calInfoHtml(x) + "</div>";
  }
  // An older cached love-days-core.js (no monthGrid) can be paired with this page offline.
  function calWrapHtml(st){
    return C.monthGrid ? '<div class="cal" id="cycleCal">' + calHtml(calCtx(st)) + "</div>" : "";
  }
  function renderCal(){
    var box = $("cycleCal");
    if(!box || state.cyclesBroken) return;
    var a = document.activeElement, nav = a && box.contains(a) ? a.getAttribute("data-cal-nav") : null;
    box.innerHTML = calHtml(calCtx(C.cycleStats(state.cycles, now())));
    if(nav){
      var back = box.querySelector('[data-cal-nav="' + nav + '"]:not([disabled])') || box.querySelector("[data-cal-nav]:not([disabled])");
      if(back) back.focus({ preventScroll: true });
    }
  }
  function calNav(dir){
    var x = calCtx(C.cycleStats(state.cycles, now())), thisYm = x.today.slice(0, 7), ym = x.ym;
    if(dir === "today") ym = thisYm;
    else if(dir === "prev"){ if(ym > CAL_MIN_YM) ym = ymShift(ym, -1); }
    else if(ym < x.maxYm) ym = ymShift(ym, 1);
    cal.ym = ym === thisYm ? null : ym;
    renderCal();
  }
  function calSelect(day){
    var box = $("cycleCal");
    if(!box || !C.isValidDate(day)) return;
    cal.sel = cal.sel === day ? null : day;
    Array.prototype.forEach.call(box.querySelectorAll("[data-cal-day]"), function(b){
      b.setAttribute("aria-pressed", b.getAttribute("data-cal-day") === cal.sel ? "true" : "false");
    });
    $("calInfo").innerHTML = calInfoHtml(calCtx(C.cycleStats(state.cycles, now())));
  }
  // The two buttons under the grid. What the day allows is worked out again at
  // the tap; if that no longer matches the button (date rolled over), only refresh.
  function calAct(kind){
    var day = cal.sel;
    if(!day) return;
    var info = calDayInfo(day, calCtx(C.cycleStats(state.cycles, now())));
    if(info.act !== kind || (kind === "end" && !cycleById(info.c.id))){ renderCal(); return; }
    if(kind === "end"){
      openCycleForm(cycleById(info.c.id));
      setDateValue("cyEnd", day);
      cyc.lastDate = "cyEnd";
    } else {
      openCycleForm(null);
      setDateValue("cyStart", day);
    }
    openSheet("cycleSheet");
  }
  // Horizontal swipe on the grid changes month. No pointer capture: it would
  // retarget the click of a plain tap away from the day button.
  (function(){
    var el = $("cycleList"), sx = 0, sy = 0, active = false;
    el.addEventListener("pointerdown", function(e){
      active = !!e.target.closest(".cal-grid") && !(e.pointerType === "mouse" && e.button !== 0);
      sx = e.clientX; sy = e.clientY;
    });
    el.addEventListener("pointerup", function(e){
      if(!active) return;
      active = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if(Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
      // A mouse drag that ends on the cell it began on still fires a click.
      cal.swiped = true;
      setTimeout(function(){ cal.swiped = false; }, 50);
      calNav(dx < 0 ? "next" : "prev");
    });
    el.addEventListener("pointercancel", function(){ active = false; });
  })();

  function renderCycleRemind(){
    var ok = !!C.reminderLine, days = state.meta.cycleRemind, quiet = state.meta.cycleRemindQuiet !== false;
    $("cycleRemindBox").hidden = !ok;
    if(!ok) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-remind]"), function(b){
      b.setAttribute("aria-pressed", +b.getAttribute("data-remind") === days ? "true" : "false");
    });
    $("cycleRemindQuiet").checked = quiet;
    $("cycleRemindPreview").hidden = !days;
    if(days) $("cycleRemindPreview").textContent = "Trên thông báo: “" + C.reminderLine({ daysLeft: days }, quiet) + "”";
    placeSegPill($("cycleRemindSeg"));
  }
  $("cycleRemindSeg").addEventListener("click", function(e){
    var b = e.target.closest("[data-remind]"), days = b ? +b.getAttribute("data-remind") : -1;
    if(REMIND_OPTS.indexOf(days) === -1 || days === state.meta.cycleRemind) return;
    state.meta.cycleRemind = days;
    saveMeta();
    renderCycleRemind();
  });
  $("cycleRemindQuiet").addEventListener("change", function(){
    state.meta.cycleRemindQuiet = this.checked;
    saveMeta();
    renderCycleRemind();
  });

  // Rebuilds the Chu kỳ tab only; the form in the sheet is never re-rendered from here.
  function renderCycleSheet(){
    var el = $("cycleList");
    if(state.cyclesBroken){ el.innerHTML = '<p class="card-text">' + CYCLE_BROKEN_TEXT + ".</p>"; return; }
    var st = C.cycleStats(state.cycles, now()), h = "";
    function stat(label, value, extra){
      return '<div class="cycle-stat"><dt>' + label + "</dt><dd><b>" + value + "</b>" + (extra ? " " + extra : "") + "</dd></div>";
    }
    if(st.last){
      var v = cycleView(st);
      h += '<dl class="cycle-stats">' +
        (v.kind === "long"
          ? stat("Kỳ gần nhất", weekday(st.last.start) + ", " + fmtDate(st.last.start), '<span class="status-tag warn">' + fmtInt(st.sinceLast) + " ngày trước</span>")
          : stat("Kỳ tới dự kiến", weekday(st.next) + ", " + fmtDate(st.next),
              '<span class="status-tag' + (v.kind === "late" ? " warn" : " ok") + '">' + v.status + "</span>")) +
        (st.nextMin && v.kind !== "long" ? stat("Có thể rơi vào", fmtDayMonth(st.nextMin) + " – " + fmtDate(st.nextMax),
          '<span class="cycle-stat-sub">(chu kỳ gần đây từ ' + st.gapMin + " đến " + st.gapMax + " ngày)</span>") : "") +
        stat("Chu kỳ trung bình", st.n ? fmtAvg(st.avgGap) : st.list.length < 2 ? "Cần ít nhất 2 kỳ" : "Chưa có khoảng cách nào từ " + C.CYCLE_MIN + " đến " + C.CYCLE_MAX + " ngày",
          '<span class="cycle-stat-sub">' + (st.n ? "(" + st.n + " chu kỳ gần nhất)" : "Ước tính theo " + C.CYCLE_DEFAULT + " ngày") + "</span>") +
        stat("Số ngày mỗi kỳ", st.avgLen !== null ? fmtAvg(st.avgLen) : "Chưa ghi ngày kết thúc",
          st.lenN ? '<span class="cycle-stat-sub">(trung bình ' + st.lenN + " kỳ gần nhất)</span>" : "") +
        "</dl>";
      if(v.kind === "long") h += '<p class="card-text cycle-hint">Đã quá hai lần chu kỳ thường lệ — có thể còn một kỳ chưa ghi.</p>';
      var ending = st.last.end == null && st.inPeriod;
      if(!(st.last.end != null && st.inPeriod)){
        h += '<button type="button" class="btn btn-primary btn-block" data-cy="quick" data-act="' + (ending ? "end" : "start") + '">' +
          (ending ? "Kết thúc hôm nay" : "Bắt đầu hôm nay") + "</button>";
      }
      h += '<button type="button" class="btn btn-soft btn-block" data-cy="add">Thêm kỳ đã qua</button>';
      h += calWrapHtml(st);
      h += cycleChartHtml(st);
    } else {
      h += '<p class="card-text cycle-empty">Chưa ghi kỳ nào. Ghi ngày bắt đầu mỗi kỳ để app tính khoảng cách và dự đoán kỳ tới.</p>' +
        '<button type="button" class="btn btn-primary btn-block" data-cy="quick" data-act="start">Bắt đầu hôm nay</button>' +
        '<button type="button" class="btn btn-soft btn-block" data-cy="add">Thêm kỳ đã qua</button>' +
        calWrapHtml(st);
    }
    if(st.list.length){
      h += '<h4 class="import-step">Các kỳ đã ghi</h4><ul class="ms-group">' + st.list.slice().reverse().map(function(x){
        var title = fmtCycleRange(x) + (x.len !== null ? " · " + x.len + " ngày" : "");
        var gap = x.gap === null ? "Kỳ đầu tiên đã ghi" : x.gapOk ? "Cách kỳ trước " + x.gap + " ngày" : "Cách kỳ trước " + x.gap + " ngày · không tính trung bình";
        var gapHtml = x.gap === null || x.gapOk ? gap : 'Cách kỳ trước <span class="status-tag warn">' + x.gap + " ngày · không tính trung bình</span>";
        var open = x.len === null ? " · chưa ghi ngày kết thúc" : "";
        return '<li class="ms-item-wrap"><button type="button" class="ms-item cycle-item" data-cy-id="' + escapeHtml(x.id) + '" aria-label="' +
          escapeHtml("Kỳ " + title + ", " + gap + open + (x.note ? ", " + x.note : "") + ". Sửa") + '">' +
          '<span class="ms-main"><span class="ms-title">' + title + '</span><span class="ms-sub">' + gapHtml + open + "</span>" +
          (x.note ? '<span class="ms-sub cycle-note">' + escapeHtml(x.note) + "</span>" : "") + "</span>" + CHEV + "</button></li>";
      }).join("") + "</ul>";
    }
    el.innerHTML = h;
  }

  function showCycleMode(mode){
    cyc.mode = mode;
    $("cycleSheetTitle").textContent = cyc.editingId ? "Sửa kỳ" : "Thêm kỳ";
    $("cycleSheet").scrollTop = 0;
  }
  function cycleFieldError(id, msg){
    showError(id + "Err", msg);
    if(msg) $(id + "Btn").setAttribute("aria-invalid", "true"); else $(id + "Btn").removeAttribute("aria-invalid");
  }
  function clearCycleErrors(){
    cycleFieldError("cyStart", null);
    cycleFieldError("cyEnd", null);
    showError("cycleFormErr", null);
  }
  function openCycleList(){
    cyc.editingId = null;
    renderCycleSheet();
    showCycleMode("list");
  }
  function openCycleForm(c){
    cyc.editingId = c ? c.id : null;
    setDateValue("cyStart", c ? c.start : "");
    setDateValue("cyEnd", c && c.end ? c.end : "");
    $("cyNote").value = c ? c.note : "";
    $("cycleDelete").hidden = !c;
    $("cycleConfirm").hidden = true;
    cyc.lastDate = null;
    clearCycleErrors();
    showCycleMode("form");
  }
  // form = true opens the add form; otherwise the Chu kỳ tab is shown.
  function openCycleSheet(form){
    if(!C.cycleStats) return;
    if(form && !state.cyclesBroken){ openCycleForm(null); openSheet("cycleSheet"); }
    else switchTab("cycle");
  }

  // One write at a time: the flag goes up before the put and comes down on
  // both outcomes, so a double tap can't log two cycles.
  function cycleWrite(btn, next, ok, fail){
    if(cyc.saving) return;
    var label = btn.textContent;
    cyc.saving = true;
    btn.disabled = true;
    btn.textContent = "Đang lưu…";
    function release(){ cyc.saving = false; btn.disabled = false; btn.textContent = label; }
    // Inside a then() so that a synchronous throw (db.transaction on a closing
    // connection) also lands in the failure branch and the button is released.
    Promise.resolve().then(function(){ return saveCycles(next); }).then(function(){
      release();
      // The layout has just moved under the finger: the second tap of a double
      // tap must not land on whatever slid into that spot.
      cyc.quiet = true;
      setTimeout(function(){ cyc.quiet = false; }, 400);
      showError("cycleCardErr", null);
      renderCycleCard();
      ok();
    }, function(err){
      release();
      fail((err && err.userMessage) || "Không lưu được vào bộ nhớ máy. Hãy thử lại.");
    });
  }

  ["cycleCard", "cycleSheet", "tab-cycle"].forEach(function(id){
    $(id).addEventListener("click", function(e){
      if(cyc.quiet){ e.stopPropagation(); e.preventDefault(); }
    }, true);
  });
  $("cycleBody").addEventListener("click", function(e){
    if(e.target.closest("#cycleOpen")) openCycleSheet(false);
  });
  $("cycleAddPast").addEventListener("click", function(){ openCycleSheet(true); });
  $("btnCycleBook").addEventListener("click", function(){ openCycleSheet(false); });
  $("cycleShow").addEventListener("change", function(){
    state.meta.showCycle = this.checked;
    saveMeta();
    renderCycleCard();
  });

  // Shared by the Home card button and the one on the Chu kỳ tab.
  function cycleQuickAct(btn, errId){
    if(cyc.saving || state.cyclesBroken || !C.cycleStats) return;
    showError(errId, null);
    var t = now(), today = C.todayStr(t), st = C.cycleStats(state.cycles, t);
    var ending = !!st.last && st.last.end == null && st.inPeriod;
    // The label may be a moment behind the date (midnight): act only on what it says.
    if((btn.getAttribute("data-act") === "end") !== ending){ renderCycleCard(); renderCycleSheet(); return; }
    var cand = ending
      ? { id: st.last.id, start: st.last.start, end: today, note: st.last.note, createdAt: st.last.createdAt }
      : { id: C.newCycleId(t), start: today, end: null, note: "", createdAt: t };
    var cf = C.cycleConflict(state.cycles, cand, t);
    if(cf){ showError(errId, cycleErrText(cf)); return; }
    var next = state.cycles.filter(function(x){ return x.id !== cand.id; }).concat([cand]);
    cycleWrite(btn, next, function(){
      showError(errId, null);
      renderCycleSheet();
      toast(ending ? "Đã ghi kỳ kết thúc hôm nay" : "Đã ghi kỳ bắt đầu hôm nay");
    }, function(msg){ showError(errId, msg); });
  }
  $("cycleQuick").addEventListener("click", function(){ cycleQuickAct(this, "cycleCardErr"); });

  $("cycleList").addEventListener("click", function(e){
    if(state.cyclesBroken) return;
    var quick = e.target.closest('[data-cy="quick"]');
    if(quick){ cycleQuickAct(quick, "cycleTabErr"); return; }
    var nav = e.target.closest("[data-cal-nav]");
    if(nav){ calNav(nav.getAttribute("data-cal-nav")); return; }
    var dayBtn = e.target.closest("[data-cal-day]");
    if(dayBtn){ if(!cal.swiped) calSelect(dayBtn.getAttribute("data-cal-day")); return; }
    if(e.target.closest('[data-cy="add-on"]')){ calAct("add"); return; }
    if(e.target.closest('[data-cy="end-on"]')){ calAct("end"); return; }
    var item = e.target.closest("[data-cy-id]");
    var c = item ? cycleById(item.getAttribute("data-cy-id")) : null;
    if(!c && !e.target.closest('[data-cy="add"]')) return;
    openCycleForm(c);
    openSheet("cycleSheet");
  });
  // After a save or delete: close the form sheet and refresh the tab behind it.
  function backToCycleList(){
    cyc.editingId = null;
    cyc.mode = "list";
    closeSheets();
    renderCycleSheet();
  }
  ["cyStart", "cyEnd"].forEach(function(id){
    $(id).addEventListener("change", function(){ cyc.lastDate = id; clearCycleErrors(); });
  });

  $("cycleForm").addEventListener("submit", function(e){
    e.preventDefault();
    if(cyc.saving) return;
    clearCycleErrors();
    var t = now(), start = $("cyStart").value, end = $("cyEnd").value || null;
    if(!C.isValidDate(start)){ cycleFieldError("cyStart", "Hãy chọn ngày bắt đầu"); return; }
    var old = cyc.editingId ? cycleById(cyc.editingId) : null;
    if(cyc.editingId && !old){ showError("cycleFormErr", "Kỳ này không còn trong sổ. Quay lại danh sách rồi thử lại."); return; }
    var cand = { id: old ? old.id : C.newCycleId(t), start: start, end: end, note: $("cyNote").value.trim(), createdAt: old ? old.createdAt : t };
    // Dates untouched = a note-only edit: nothing new to check, and a record
    // that was already off (clock moved back, old data) stays editable.
    var cf = old && old.start === start && old.end === end ? null : C.cycleConflict(state.cycles, cand, t);
    if(cf){
      if(cf.code === "full") showError("cycleFormErr", cycleErrText(cf));
      else {
        // The message goes to the date the user just moved.
        var startMoved = cf.code === "endBeforeStart" && cyc.lastDate === "cyStart";
        var fid = cf.field === "end" && !startMoved ? "cyEnd" : "cyStart";
        cycleFieldError(fid, startMoved ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc" : cycleErrText(cf));
        $(fid + "Err").scrollIntoView({ block: "nearest" });
      }
      return;
    }
    var rec = C.validateCycle(cand);
    if(!rec){ showError("cycleFormErr", "Dữ liệu chưa hợp lệ, hãy kiểm tra lại."); return; }
    var next = state.cycles.filter(function(x){ return x.id !== rec.id; }).concat([rec]);
    cycleWrite($("cycleSave"), next, function(){
      backToCycleList();
      toast(old ? "Đã lưu kỳ ✓" : "Đã thêm kỳ");
    }, function(msg){ showError("cycleFormErr", msg); });
  });

  $("cycleDelete").addEventListener("click", function(){
    var c = cycleById(cyc.editingId);
    if(!c || cyc.saving) return;
    $("cycleConfirmText").textContent = "Xoá kỳ " + fmtDate(c.start) + "?";
    $("cycleDelete").hidden = true;
    $("cycleConfirm").hidden = false;
    $("cycleConfirmNo").focus({ preventScroll: true });
    $("cycleConfirm").scrollIntoView({ block: "nearest" });
  });
  $("cycleConfirmNo").addEventListener("click", function(){
    if(cyc.saving) return;
    $("cycleConfirm").hidden = true;
    $("cycleDelete").hidden = false;
    $("cycleDelete").focus({ preventScroll: true });
  });
  $("cycleConfirmYes").addEventListener("click", function(){
    var id = cyc.editingId;
    if(cyc.saving || !cycleById(id)) return;
    showError("cycleFormErr", null);
    cycleWrite(this, state.cycles.filter(function(x){ return x.id !== id; }), function(){
      backToCycleList();
      toast("Đã xoá kỳ");
    }, function(msg){ showError("cycleFormErr", msg); });
  });

  // ---------- Wishes ("Muốn làm") ----------
  // Stored exactly like the cycle log: one kv record ('wishes'), items the
  // validator rejects kept verbatim in state.wishesBad and written back with
  // every save, nothing written at all while the stored record is unreadable.
  // seg = which list the Kỷ niệm tab shows ("ms" | "wishes"); not persisted.
  // undone: done dates just removed by a tap on the circle, so tapping again within a minute puts the same date back.
  // saving = one write at a time. writingId = the row whose round button is being written; taps on OTHER
  // rows meanwhile wait in queue ({id, today} — today as of the tap) instead of being dropped.
  // tap = the last real tap in the list; quiet = that spot, held back for 400ms after the rows moved.
  var wish = { seg: "ms", editingId: null, cat: "", saving: false, writingId: null, queue: [], tap: null, quiet: null, sheetQuiet: false,
               undone: Object.create(null) };
  // Set while the milestone form is open from "Thêm vào Kỷ niệm": saving that
  // milestone links it to this wish; closing the form without saving drops it.
  var pendingWishId = null;
  var WISH_BROKEN_TEXT = "Không đọc được danh sách — dữ liệu vẫn còn nguyên";
  var WISH_EMOJI = { go: "✈️", eat: "🍜", watch: "🎬", other: "✨" };
  var WISH_CHECK = '<span class="wish-ring" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';

  function wishEmoji(cat){ return WISH_EMOJI[cat] || "✨"; }
  function wishById(id){
    for(var i = 0; i < state.wishes.length; i++) if(state.wishes[i].id === id) return state.wishes[i];
    return null;
  }
  function wishesLocked(){ return state.wishesBroken || !C.wishView; }

  function applyWishesRec(rec){
    var skipped = 0, seen = Object.create(null);
    state.wishes = []; state.wishesBad = []; state.wishesBroken = false;
    state.wishesStamp = cyclesStampOf(rec);
    if(rec === undefined) return 0;
    if(!rec || typeof rec !== "object" || !Array.isArray(rec.items)){ state.wishesBroken = true; return 0; }
    // Without validateWish (older cached core) nothing can be judged: keep it all verbatim.
    if(!C.validateWish){ state.wishesBad = rec.items.slice(); return 0; }
    rec.items.forEach(function(it){
      var v = C.validateWish(it);
      if(v && !seen[v.id]){ seen[v.id] = true; state.wishes.push(v); }
      else { state.wishesBad.push(it); skipped++; }
    });
    return skipped;
  }

  // saveCycles' twin: the record is re-read inside the write transaction and
  // nothing is written when another window changed it since this one loaded it.
  function saveWishes(next){
    if(state.loadFailed || wishesLocked()) return Promise.reject(new Error("wishes locked"));
    if(busy === "import") return Promise.reject(userErr("Đang nhập bản sao lưu. Hãy đợi xong rồi thử lại."));
    var stamp = now();
    if(typeof state.wishesStamp === "number" && stamp <= state.wishesStamp) stamp = state.wishesStamp + 1;
    var rec = { key: "wishes", items: next.concat(state.wishesBad), updatedAt: stamp };
    function done(){
      state.wishes = next;
      state.wishesStamp = stamp;
      dataChanged();
    }
    if(!state.db) return put("kv", rec).then(done);
    var tx = state.db.transaction("kv", "readwrite"), st = tx.objectStore("kv"), stale = false, found;
    var rq = st.get("wishes");
    rq.onsuccess = function(){
      found = rq.result;
      if(cyclesStampOf(found) !== state.wishesStamp) stale = true; else st.put(rec);
    };
    return C.txDone(tx).then(function(){
      if(!stale){ done(); return; }
      applyWishesRec(found);
      renderWishes();
      renderUpcoming();
      renderOnThisDay();
      throw userErr("Danh sách vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.");
    });
  }

  // One write at a time; btn (optional) shows "Đang lưu…" meanwhile.
  function wishWrite(btn, next, ok, fail){
    if(wish.saving) return;
    var label = btn ? btn.textContent : "";
    wish.saving = true;
    if(btn){ btn.disabled = true; btn.textContent = "Đang lưu…"; }
    var toggled = wish.writingId !== null;
    function release(){
      wish.saving = false;
      wish.writingId = null;
      if(btn){ btn.disabled = false; btn.textContent = label; }
    }
    // Inside a then() so a synchronous throw also releases the flag.
    Promise.resolve().then(function(){ return saveWishes(next); }).then(function(){
      release();
      // Rows have just moved under the finger: the second tap of a double tap must not land on another
      // row. Only the spot that was tapped is held back, so a quick tap on a different row still counts.
      if(toggled && wish.tap){
        var spot = wish.quiet = { x: wish.tap.x, y: wish.tap.y };
        setTimeout(function(){ if(wish.quiet === spot) wish.quiet = null; }, 400);
      }
      wish.sheetQuiet = true;
      setTimeout(function(){ wish.sheetQuiet = false; }, 400);
      showError("wishErr", null);
      renderWishes();
      renderUpcoming();
      renderOnThisDay();
      ok();
      wishDrain();
    }, function(err){
      release();
      // The list may have been reloaded from another window: taps made on the old one are dropped.
      wish.queue = [];
      fail((err && err.userMessage) || "Không lưu được vào bộ nhớ máy. Hãy thử lại.");
    });
  }
  function wishDrain(){
    while(!wish.saving && wish.queue.length){
      var q = wish.queue.shift();
      wishToggle(q.id, q.today);
    }
  }
  // Key presses (detail 0) and .click() from code are never held back.
  $("wishList").addEventListener("click", function(e){
    if(!e.isTrusted || !e.detail) return;
    var q = wish.quiet;
    if(q && Math.abs(e.clientX - q.x) < 32 && Math.abs(e.clientY - q.y) < 32){ e.stopPropagation(); e.preventDefault(); return; }
    wish.tap = { x: e.clientX, y: e.clientY };
  }, true);
  $("wishSheet").addEventListener("click", function(e){
    if(wish.sheetQuiet){ e.stopPropagation(); e.preventDefault(); }
  }, true);

  // seg: "ms" | "wishes" | "journal" (the journal needs a core that knows it).
  function setMsSeg(seg){
    wish.seg = seg === "wishes" || (seg === "journal" && C.validateJournal) ? seg : "ms";
    Array.prototype.forEach.call($("msSeg").querySelectorAll("[data-ms-seg]"), function(b){
      b.setAttribute("aria-pressed", b.getAttribute("data-ms-seg") === wish.seg ? "true" : "false");
    });
    $("milestoneList").hidden = wish.seg !== "ms";
    $("wishPane").hidden = wish.seg !== "wishes";
    $("journalPane").hidden = wish.seg !== "journal";
    showError("wishErr", null);
    showError("journalErr", null);
    syncWishAdd();
    placeSegPill($("msSeg"));
  }
  function syncWishAdd(){
    var s = wish.seg, btn = $("btnAddMilestone");
    btn.hidden = s === "wishes" ? wishesLocked() : s === "journal" ? journalLocked() : false;
    btn.setAttribute("aria-label", s === "wishes" ? "Thêm việc muốn làm" : s === "journal" ? "Ghi nhật ký hôm nay" : "Thêm kỷ niệm");
  }
  $("msSeg").addEventListener("click", function(e){
    var b = e.target.closest("[data-ms-seg]");
    if(b) setMsSeg(b.getAttribute("data-ms-seg"));
  });

  function renderWishes(){
    var el = $("wishList");
    syncWishAdd();
    if(wishesLocked()){ el.innerHTML = '<div class="card"><p class="card-text">' + WISH_BROKEN_TEXT + ".</p></div>"; return; }
    if(!state.wishes.length){
      el.innerHTML = '<div class="card empty-state"><p class="empty-text">Chưa có việc nào. Ghi lại nơi muốn đi, món muốn ăn, phim muốn xem cùng nhau.</p>' +
        '<button type="button" class="btn btn-primary empty-action" data-wish-add>Thêm việc muốn làm</button></div>';
      return;
    }
    var v = C.wishView(state.wishes, now());
    function row(x){
      var sub, right = "", said;
      if(x.done){
        sub = "Đã làm " + fmtDate(x.doneDate);
        said = sub;
        right = '<span class="status-tag ok">Đã làm</span>';
      } else if(x.daysLeft === null){
        sub = ""; said = "chưa hẹn ngày";
      } else if(x.daysLeft < 0){
        sub = "Dự định " + fmtDate(x.planDate) + " đã qua " + fmtInt(-x.daysLeft) + " ngày";
        said = sub;
      } else {
        sub = weekday(x.planDate) + ", " + fmtDate(x.planDate);
        said = sub + ", " + (x.daysLeft === 0 ? "hôm nay" : "còn " + fmtInt(x.daysLeft) + " ngày");
        right = x.daysLeft === 0 ? '<span class="ms-left today">Hôm nay</span>'
          : '<span class="ms-left"><span class="ms-num" aria-hidden="true">' + fmtInt(x.daysLeft) + '</span><span class="ms-unit" aria-hidden="true">ngày nữa</span></span>';
      }
      var id = escapeHtml(x.id);
      return '<li class="ms-item-wrap wish-row' + (x.done ? " is-done" : "") + '">' +
        '<button type="button" class="wish-check" data-wish-check="' + id + '" aria-pressed="' + (x.done ? "true" : "false") + '" aria-label="' +
        escapeHtml("Đánh dấu đã làm: " + x.title) + '">' + WISH_CHECK + "</button>" +
        '<button type="button" class="ms-item wish-item" data-wish-id="' + id + '" aria-label="' + escapeHtml(x.title + ", " + said + ". Sửa") + '">' +
        '<span class="ms-emoji" aria-hidden="true">' + wishEmoji(x.cat) + "</span>" +
        '<span class="ms-main"><span class="ms-title">' + escapeHtml(x.title) + "</span>" +
        (sub ? '<span class="ms-sub">' + sub + "</span>" : "") +
        (x.note ? '<span class="tl-note">' + escapeHtml(x.note) + "</span>" : "") + "</span>" + right + CHEV + "</button></li>";
    }
    function group(title, items){
      if(!items.length) return "";
      return '<h3 class="group-title">' + title + '</h3><ul class="ms-group">' + items.map(row).join("") + "</ul>";
    }
    // An older cached core has no passed/undated: fall back to its single "open" group.
    el.innerHTML = group("Sắp tới", v.soon) +
      (v.passed ? group("Đã qua ngày dự định", v.passed) + group("Chưa hẹn ngày", v.undated) : group("Chưa hẹn ngày", v.open)) +
      group("Đã làm", v.done);
  }

  // today = the VN day of the tap (a queued tap keeps the day it was made on).
  function wishToggle(id, today){
    var w = wishById(id);
    if(!w || wishesLocked()) return;
    if(!today) today = C.todayStr(now());
    if(wish.saving){
      // The same row again is a double tap; another row waits for its turn.
      var known = wish.writingId === id || wish.queue.some(function(q){ return q.id === id; });
      if(!known && wish.queue.length < 8) wish.queue.push({ id: id, today: today });
      return;
    }
    var done = !w.doneDate, prev = wish.undone[id];
    var back = done && prev && now() - prev.at < 60000 && prev.date <= today ? prev.date : null;
    var rec = C.validateWish(Object.assign({}, w, { doneDate: done ? back || today : null }));
    if(!rec) return;
    showError("wishErr", null);
    wish.writingId = id;
    wishWrite(null, state.wishes.map(function(x){ return x.id === id ? rec : x; }), function(){
      if(done) delete wish.undone[id]; else wish.undone[id] = { date: w.doneDate, at: now() };
      toast(done ? "Đã làm ✓" : "Đã bỏ đánh dấu");
    }, function(msg){ showError("wishErr", msg); });
  }
  $("wishList").addEventListener("click", function(e){
    if(wishesLocked()) return;
    var check = e.target.closest("[data-wish-check]");
    if(check){ wishToggle(check.getAttribute("data-wish-check")); return; }
    if(e.target.closest("[data-wish-add]")){ openWishSheet(null); return; }
    var item = e.target.closest("[data-wish-id]");
    var w = item ? wishById(item.getAttribute("data-wish-id")) : null;
    if(w) openWishSheet(w);
  });

  function setWishCat(cat){
    wish.cat = cat;
    Array.prototype.forEach.call($("wCats").children, function(b){
      b.setAttribute("aria-pressed", b.getAttribute("data-wish-cat") === cat ? "true" : "false");
    });
  }
  $("wCats").addEventListener("click", function(e){
    var b = e.target.closest("[data-wish-cat]");
    if(!b) return;
    var cat = b.getAttribute("data-wish-cat");
    setWishCat(wish.cat === cat ? "" : cat);
  });
  // el = the control the message belongs to (the text input, or the date button).
  function wishFieldError(id, el, msg){
    showError(id + "Err", msg);
    if(msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
  }
  function clearWishErrors(){
    wishFieldError("wTitle", $("wTitle"), null);
    wishFieldError("wDone", $("wDoneBtn"), null);
    showError("wishFormErr", null);
  }
  function wishLinked(w){
    return !!w && !!w.milestoneId && state.milestones.some(function(m){ return m.id === w.milestoneId; });
  }
  function openWishSheet(w){
    if(wishesLocked()) return;
    wish.editingId = w ? w.id : null;
    $("wishSheetTitle").textContent = w ? "Sửa việc muốn làm" : "Thêm việc muốn làm";
    $("wTitle").value = w ? w.title : "";
    setWishCat(w ? w.cat : "");
    setDateValue("wPlan", w && w.planDate ? w.planDate : "");
    setDateValue("wDone", w && w.doneDate ? w.doneDate : "");
    $("wDoneField").hidden = !w;
    $("wNote").value = w ? w.note : "";
    var linked = wishLinked(w);
    $("wishLinked").hidden = !linked;
    $("wishToMs").hidden = !w || !w.doneDate || linked;
    $("wishDelete").hidden = !w;
    $("wishConfirm").hidden = true;
    clearWishErrors();
    $("wishSheet").scrollTop = 0;
    openSheet("wishSheet");
  }
  $("wTitle").addEventListener("input", function(){ wishFieldError("wTitle", this, null); });
  $("wDone").addEventListener("change", function(){ wishFieldError("wDone", $("wDoneBtn"), null); });

  $("wishForm").addEventListener("submit", function(e){
    e.preventDefault();
    if(wish.saving) return;
    clearWishErrors();
    var t = now(), old = wish.editingId ? wishById(wish.editingId) : null;
    if(wish.editingId && !old){ showError("wishFormErr", "Việc này không còn trong danh sách. Đóng bảng này rồi thử lại."); return; }
    var title = $("wTitle").value.trim();
    if(!title){
      wishFieldError("wTitle", $("wTitle"), "Hãy ghi việc muốn làm");
      $("wTitleErr").scrollIntoView({ block: "nearest" });
      return;
    }
    var done = old ? $("wDone").value || null : null;
    // Only when the date was moved: a record that is already off stays editable.
    if(done && done !== old.doneDate && done > C.todayStr(t)){
      wishFieldError("wDone", $("wDoneBtn"), "Ngày đã làm không được sau hôm nay");
      $("wDoneErr").scrollIntoView({ block: "nearest" });
      return;
    }
    if(!old && state.wishes.length >= C.MAX_WISHES){
      showError("wishFormErr", "Đã đủ " + C.MAX_WISHES + " việc — xoá bớt việc đã làm rồi thêm tiếp.");
      return;
    }
    var rec = C.validateWish({
      id: old ? old.id : C.newWishId(t), title: title, cat: wish.cat, note: $("wNote").value.trim(),
      planDate: $("wPlan").value || null, doneDate: done, milestoneId: old ? old.milestoneId : null, createdAt: old ? old.createdAt : t
    });
    if(!rec){ showError("wishFormErr", "Dữ liệu chưa hợp lệ, hãy kiểm tra lại."); return; }
    var next = old ? state.wishes.map(function(x){ return x.id === rec.id ? rec : x; }) : state.wishes.concat([rec]);
    wishWrite($("wishSave"), next, function(){
      closeSheets();
      toast(old ? "Đã lưu ✓" : "Đã thêm việc muốn làm");
    }, function(msg){ showError("wishFormErr", msg); });
  });

  // The milestone form opens pre-filled from the SAVED wish; nothing is created until "Lưu kỷ niệm".
  $("wishToMs").addEventListener("click", function(){
    var w = wishById(wish.editingId);
    if(!w || !w.doneDate || wish.saving) return;
    if($("wTitle").value.trim() !== w.title || wish.cat !== w.cat || ($("wPlan").value || null) !== w.planDate ||
       ($("wDone").value || null) !== w.doneDate || $("wNote").value.trim() !== w.note.trim()){
      showError("wishFormErr", "Hãy lưu việc này trước rồi thêm vào Kỷ niệm.");
      return;
    }
    closeSheets();
    openMilestoneSheet(null);
    $("msTitle").value = w.title;
    setDateValue("msDate", w.doneDate);
    $("msEmoji").value = wishEmoji(w.cat);
    markEmoji();
    $("msNote").value = w.note;
    pendingWishId = w.id;
  });
  // Losing this write only loses the "Đã có trong Kỷ niệm" mark, so it never reports an error.
  // It takes the same one-write-at-a-time flag as every other write, and tries again when another
  // window changed the list meanwhile (saveWishes has reloaded it by then).
  function linkWish(wishId, milestoneId, left){
    if(left === undefined) left = 2;
    var w = wishById(wishId);
    if(!w) return;
    function again(){ if(left > 0) setTimeout(function(){ linkWish(wishId, milestoneId, left - 1); }, 250); }
    if(wish.saving){ again(); return; }
    var rec = Object.assign({}, w, { milestoneId: milestoneId });
    wish.saving = true;
    Promise.resolve().then(function(){
      return saveWishes(state.wishes.map(function(x){ return x.id === wishId ? rec : x; }));
    }).then(function(){ wish.saving = false; renderWishes(); renderOnThisDay(); wishDrain(); }, function(){ wish.saving = false; wish.queue = []; again(); });
  }

  $("wishDelete").addEventListener("click", function(){
    var w = wishById(wish.editingId);
    if(!w || wish.saving) return;
    $("wishConfirmText").textContent = "Xoá “" + w.title + "”?";
    $("wishDelete").hidden = true;
    $("wishConfirm").hidden = false;
    $("wishConfirmNo").focus({ preventScroll: true });
    $("wishConfirm").scrollIntoView({ block: "nearest" });
  });
  $("wishConfirmNo").addEventListener("click", function(){
    if(wish.saving) return;
    $("wishConfirm").hidden = true;
    $("wishDelete").hidden = false;
    $("wishDelete").focus({ preventScroll: true });
  });
  $("wishConfirmYes").addEventListener("click", function(){
    var id = wish.editingId;
    if(wish.saving || !wishById(id)) return;
    showError("wishFormErr", null);
    wishWrite(this, state.wishes.filter(function(x){ return x.id !== id; }), function(){
      closeSheets();
      toast("Đã xoá việc này");
    }, function(msg){ showError("wishFormErr", msg); });
  });

  // ---------- Journal ("Nhật ký") ----------
  // Stored like the wish list: one kv record ('journal'), one entry per day. Entries the validator
  // rejects, and a second entry for a day already read, stay verbatim in state.journalBad and are
  // written back with every save; nothing is written while the stored record is unreadable or the
  // cached core is too old to judge it (journalLocked).
  // jr.date = the day of the open sheet, fixed when it opens: a rollover or a return to the app never moves it.
  // saving = one write at a time. tap/quiet = the spot of the last real tap on the Home card, held
  // back for 400ms after a quick mood tap, because the card changes under the finger.
  var jr = { date: null, mood: 0, saving: false, tap: null, quiet: null };
  // ym = month on show ("YYYY-MM"; null follows today's month).
  var jcal = { ym: null, swiped: false };
  var JOURNAL_BROKEN_TEXT = "Không đọc được nhật ký — dữ liệu vẫn còn nguyên";
  var MOOD = { 1: { emoji: "😢", label: "Buồn" }, 2: { emoji: "😕", label: "Hơi chán" }, 3: { emoji: "😐", label: "Bình thường" },
               4: { emoji: "🙂", label: "Vui" }, 5: { emoji: "🥰", label: "Rất vui" } };

  function journalLocked(){ return state.journalBroken || !C.validateJournal; }
  function journalByDate(d){
    for(var i = 0; i < state.journal.length; i++) if(state.journal[i].date === d) return state.journal[i];
    return null;
  }
  function journalEmoji(e){ return e.mood ? MOOD[e.mood].emoji : "📝"; }
  function journalFullText(){ return "Đã đủ " + fmtInt(C.MAX_JOURNAL) + " ngày — xoá bớt rồi ghi tiếp."; }

  function applyJournalRec(rec){
    var skipped = 0, seen = Object.create(null);
    state.journal = []; state.journalBad = []; state.journalBroken = false;
    state.journalStamp = cyclesStampOf(rec);
    if(rec === undefined) return 0;
    if(!rec || typeof rec !== "object" || !Array.isArray(rec.items)){ state.journalBroken = true; return 0; }
    if(!C.validateJournal){ state.journalBad = rec.items.slice(); return 0; }
    rec.items.forEach(function(it){
      var v = C.validateJournal(it);
      if(v && !seen[v.date]){ seen[v.date] = true; state.journal.push(v); }
      else { state.journalBad.push(it); skipped++; }
    });
    return skipped;
  }

  // saveWishes' twin: the record is re-read inside the write transaction and
  // nothing is written when another window changed it since this one loaded it.
  function saveJournal(next){
    if(state.loadFailed || journalLocked()) return Promise.reject(new Error("journal locked"));
    if(busy === "import") return Promise.reject(userErr("Đang nhập bản sao lưu. Hãy đợi xong rồi thử lại."));
    var stamp = now();
    if(typeof state.journalStamp === "number" && stamp <= state.journalStamp) stamp = state.journalStamp + 1;
    var rec = { key: "journal", items: next.concat(state.journalBad), updatedAt: stamp };
    function done(){
      state.journal = next;
      state.journalStamp = stamp;
      dataChanged();
    }
    if(!state.db) return put("kv", rec).then(done);
    var tx = state.db.transaction("kv", "readwrite"), st = tx.objectStore("kv"), stale = false, found;
    var rq = st.get("journal");
    rq.onsuccess = function(){
      found = rq.result;
      if(cyclesStampOf(found) !== state.journalStamp) stale = true; else st.put(rec);
    };
    return C.txDone(tx).then(function(){
      if(!stale){ done(); return; }
      applyJournalRec(found);
      renderJournal();
      renderJournalCard();
      renderOnThisDay();
      throw userErr("Nhật ký vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.");
    });
  }

  // One write at a time; btn (optional) shows "Đang lưu…" meanwhile.
  function journalWrite(btn, next, ok, fail){
    if(jr.saving) return;
    var label = btn ? btn.textContent : "";
    jr.saving = true;
    if(btn){ btn.disabled = true; btn.textContent = "Đang lưu…"; }
    function release(){
      jr.saving = false;
      if(btn){ btn.disabled = false; btn.textContent = label; }
    }
    // Inside a then() so a synchronous throw also releases the flag.
    Promise.resolve().then(function(){ return saveJournal(next); }).then(function(){
      release();
      renderJournal();
      renderJournalCard();
      renderOnThisDay();
      ok();
    }, function(err){
      release();
      fail((err && err.userMessage) || "Không lưu được vào bộ nhớ máy. Hãy thử lại.");
    });
  }

  // ---- Home card "Hôm nay thế nào?" ----
  function renderJournalCard(){
    var card = $("journalCard"), core = !!C.validateJournal;
    $("journalSetTitle").hidden = !core;
    $("journalSetCard").hidden = !core;
    $("msSegJournal").hidden = !core;
    $("journalShow").checked = state.meta.showJournal !== false;
    if(state.mode !== "app" || journalLocked() || state.meta.showJournal === false){ card.hidden = true; return; }
    card.hidden = false;
    var today = C.todayStr(now()), e = journalByDate(today), body = $("journalCardBody");
    if(!e){
      body.innerHTML = '<div class="j-moods" role="group" aria-label="Chọn tâm trạng hôm nay">' + C.MOODS.map(function(n){
        return '<button type="button" class="j-mood" data-j-quick="' + n + '"><span class="j-mood-emoji" aria-hidden="true">' + MOOD[n].emoji +
          '</span><span class="j-mood-label">' + MOOD[n].label + "</span></button>";
      }).join("") + "</div>";
      return;
    }
    var mood = e.mood ? MOOD[e.mood].label : "";
    body.innerHTML = '<button type="button" class="up-row j-open" id="journalOpen" data-j-day="' + today + '" aria-haspopup="dialog" aria-label="' +
      escapeHtml("Nhật ký hôm nay" + (mood ? ": " + mood : "") + (e.text ? ". " + e.text : "") + ". Sửa") + '">' +
      '<span class="up-emoji" aria-hidden="true">' + journalEmoji(e) + "</span>" +
      '<span class="up-main"><span class="up-title j-line' + (e.text ? "" : " j-placeholder") + '">' + (e.text ? escapeHtml(e.text) : "Thêm vài dòng…") + "</span>" +
      (mood ? '<span class="up-date">' + mood + "</span>" : "") + "</span>" + CHEV + "</button>";
  }
  // The day is the one of the tap. If that day already has an entry (another window, a stale card), nothing is overwritten.
  function journalQuick(mood){
    if(jr.saving || journalLocked() || !MOOD[mood]) return;
    var t = now(), today = C.todayStr(t);
    showError("journalCardErr", null);
    if(journalByDate(today)){ renderJournalCard(); return; }
    if(state.journal.length >= C.MAX_JOURNAL){ showError("journalCardErr", journalFullText()); return; }
    var rec = C.validateJournal({ date: today, mood: mood, text: "", updatedAt: t });
    if(!rec) return;
    journalWrite(null, state.journal.concat([rec]), function(){
      if(jr.tap){
        var spot = jr.quiet = { x: jr.tap.x, y: jr.tap.y };
        setTimeout(function(){ if(jr.quiet === spot) jr.quiet = null; }, 400);
      }
      toast("Đã ghi hôm nay ✓");
    }, function(msg){ showError("journalCardErr", msg); });
  }
  // Key presses (detail 0) and .click() from code are never held back.
  $("journalCard").addEventListener("click", function(e){
    if(!e.isTrusted || !e.detail) return;
    var q = jr.quiet;
    if(q && Math.abs(e.clientX - q.x) < 32 && Math.abs(e.clientY - q.y) < 32){ e.stopPropagation(); e.preventDefault(); return; }
    jr.tap = { x: e.clientX, y: e.clientY };
  }, true);
  $("journalCardBody").addEventListener("click", function(e){
    var q = e.target.closest("[data-j-quick]");
    if(q){ journalQuick(+q.getAttribute("data-j-quick")); return; }
    var open = e.target.closest("#journalOpen");
    if(open) openJournalSheet(open.getAttribute("data-j-day"));
  });
  $("journalShow").addEventListener("change", function(){
    state.meta.showJournal = this.checked;
    saveMeta();
    renderJournalCard();
  });

  // ---- The "Nhật ký" pane of the Kỷ niệm tab: month calendar + that month's entries ----
  function jcalCtx(){
    var today = C.todayStr(now()), max = today.slice(0, 7), ym = jcal.ym || max;
    if(ym > max) ym = max;
    if(ym < CAL_MIN_YM) ym = CAL_MIN_YM;
    return { today: today, max: max, ym: ym };
  }
  function renderJournal(){
    var el = $("journalBody");
    syncWishAdd();
    if(journalLocked()){ el.innerHTML = '<div class="card"><p class="card-text">' + JOURNAL_BROKEN_TEXT + ".</p></div>"; return; }
    if(!state.journal.length){
      el.innerHTML = '<div class="card empty-state"><p class="empty-text">Chưa ghi ngày nào. Mỗi ngày một dòng và một tâm trạng — xem lại theo lịch.</p>' +
        '<button type="button" class="btn btn-primary empty-action" data-j-add>Ghi hôm nay</button></div>';
      return;
    }
    var a = document.activeElement, nav = a && el.contains(a) ? a.getAttribute("data-jcal-nav") : null;
    var x = jcalCtx(), y = +x.ym.slice(0, 4), m = +x.ym.slice(5, 7), v = C.journalMonth(state.journal, y, m);
    var h = '<div class="cal j-cal"><div class="cal-head"><h4 class="cal-title" id="jCalTitle">Tháng ' + m + "/" + y + "</h4>" +
      (x.ym !== x.max ? '<button type="button" class="cal-today" data-jcal-nav="today">Hôm nay</button>' : "") +
      '<button type="button" class="cal-nav" data-jcal-nav="prev" aria-label="Tháng trước"' + (x.ym <= CAL_MIN_YM ? " disabled" : "") + ">" + calArrow("M15 5l-7 7 7 7") + "</button>" +
      '<button type="button" class="cal-nav" data-jcal-nav="next" aria-label="Tháng sau"' + (x.ym >= x.max ? " disabled" : "") + ">" + calArrow("M9 5l7 7-7 7") + "</button></div>" +
      '<div class="cal-week" aria-hidden="true">' + CAL_WD.map(function(w){ return "<span>" + w + "</span>"; }).join("") + "</div>" +
      '<div class="cal-grid" role="group" aria-labelledby="jCalTitle">';
    v.grid.forEach(function(d){
      var mk = v.marks[d], future = d > x.today, cls = "cal-day j-day", label = weekday(d) + ", " + fmtDate(d);
      if(d.slice(0, 7) !== x.ym) cls += " is-out";
      if(d === x.today){ cls += " is-today"; label += ", hôm nay"; }
      if(future) cls += " is-future";
      if(mk){
        cls += " j-logged";
        if(mk.mood) label += ", " + MOOD[mk.mood].label;
        if(mk.hasText) label += ", có vài dòng";
      } else if(!future) label += ", chưa ghi";
      var inner = mk && mk.mood ? '<span class="j-emoji" aria-hidden="true">' + MOOD[mk.mood].emoji + "</span>"
        : '<span class="cal-num">' + (+d.slice(8, 10)) + "</span>" + (mk && mk.hasText ? '<i class="j-dot" aria-hidden="true"></i>' : "");
      h += '<button type="button" class="' + cls + '" data-j-day="' + d + '"' + (future ? ' aria-disabled="true"' : ' aria-haspopup="dialog"') +
        ' aria-label="' + label + '">' + inner + "</button>";
    });
    h += "</div></div>";
    h += '<h4 class="group-title j-month">Tháng ' + m + "/" + y + " · " + (v.count ? v.count + " ngày đã ghi" : "chưa ghi ngày nào") + "</h4>";
    if(v.count){
      h += '<ul class="ms-group" id="journalList">' + v.list.map(function(e){
        var when = weekday(e.date) + ", " + fmtDate(e.date), mood = e.mood ? MOOD[e.mood].label : "";
        return '<li class="ms-item-wrap"><button type="button" class="ms-item j-item" data-j-day="' + e.date + '" aria-haspopup="dialog" aria-label="' +
          escapeHtml(when + (mood ? ", " + mood : "") + (e.text ? ". " + e.text : "") + ". Sửa") + '">' +
          '<span class="ms-emoji" aria-hidden="true">' + journalEmoji(e) + "</span>" +
          '<span class="ms-main"><span class="ms-title">' + when + "</span>" + (mood ? '<span class="ms-sub">' + mood + "</span>" : "") +
          (e.text ? '<span class="tl-note j-text">' + escapeHtml(e.text) + "</span>" : "") + "</span>" + CHEV + "</button></li>";
      }).join("") + "</ul>";
    }
    el.innerHTML = h;
    if(nav){
      var back = el.querySelector('[data-jcal-nav="' + nav + '"]:not([disabled])') || el.querySelector("[data-jcal-nav]:not([disabled])");
      if(back) back.focus({ preventScroll: true });
    }
  }
  function journalNav(dir){
    var x = jcalCtx(), ym = x.ym;
    if(dir === "today") ym = x.max;
    else if(dir === "prev"){ if(ym > CAL_MIN_YM) ym = ymShift(ym, -1); }
    else if(ym < x.max) ym = ymShift(ym, 1);
    jcal.ym = ym === x.max ? null : ym;
    showError("journalErr", null);
    renderJournal();
  }
  $("journalBody").addEventListener("click", function(e){
    if(journalLocked()) return;
    if(e.target.closest("[data-j-add]")){ openJournalSheet(C.todayStr(now())); return; }
    var nav = e.target.closest("[data-jcal-nav]");
    if(nav){ journalNav(nav.getAttribute("data-jcal-nav")); return; }
    var day = e.target.closest("[data-j-day]");
    if(!day || jcal.swiped) return;
    var d = day.getAttribute("data-j-day");
    showError("journalErr", null);
    if(d > C.todayStr(now())){ showError("journalErr", "Chưa ghi được cho ngày ở tương lai."); return; }
    openJournalSheet(d);
  });
  // Same swipe as the Chu kỳ calendar (no pointer capture, see there).
  (function(){
    var el = $("journalBody"), sx = 0, sy = 0, active = false;
    el.addEventListener("pointerdown", function(e){
      active = !!e.target.closest(".cal-grid") && !(e.pointerType === "mouse" && e.button !== 0);
      sx = e.clientX; sy = e.clientY;
    });
    el.addEventListener("pointerup", function(e){
      if(!active) return;
      active = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if(Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
      jcal.swiped = true;
      setTimeout(function(){ jcal.swiped = false; }, 50);
      journalNav(dx < 0 ? "next" : "prev");
    });
    el.addEventListener("pointercancel", function(){ active = false; });
  })();

  // ---- The sheet: one day's mood + a few lines ----
  function setJournalMood(m){
    jr.mood = m;
    Array.prototype.forEach.call($("jMoods").children, function(b){
      b.setAttribute("aria-pressed", +b.getAttribute("data-j-mood") === m ? "true" : "false");
    });
  }
  function journalFieldError(msg){
    showError("jErr", msg);
    if(msg) $("jText").setAttribute("aria-invalid", "true"); else $("jText").removeAttribute("aria-invalid");
  }
  function clearJournalErrors(){
    journalFieldError(null);
    showError("journalFormErr", null);
  }
  function renderJournalCount(){ $("jCount").textContent = $("jText").value.length + "/" + C.JOURNAL_TEXT_MAX; }
  function openJournalSheet(date){
    if(journalLocked() || !C.isValidDate(date)) return;
    var e = journalByDate(date);
    jr.date = date;
    $("journalSheetTitle").textContent = "Nhật ký · " + weekday(date) + ", " + fmtDate(date);
    $("jMoodLabel").textContent = date === C.todayStr(now()) ? "Hôm nay thế nào?" : "Hôm đó thế nào?";
    setJournalMood(e ? e.mood : 0);
    $("jText").value = e ? e.text : "";
    renderJournalCount();
    $("journalDelete").hidden = !e;
    $("journalConfirm").hidden = true;
    clearJournalErrors();
    $("journalSheet").scrollTop = 0;
    openSheet("journalSheet");
  }
  $("jMoods").addEventListener("click", function(e){
    var b = e.target.closest("[data-j-mood]");
    if(!b) return;
    var m = +b.getAttribute("data-j-mood");
    setJournalMood(jr.mood === m ? 0 : m);
    journalFieldError(null);
  });
  $("jText").addEventListener("input", function(){ renderJournalCount(); journalFieldError(null); });

  $("journalForm").addEventListener("submit", function(e){
    e.preventDefault();
    if(jr.saving || !jr.date) return;
    clearJournalErrors();
    var t = now(), date = jr.date;
    if(date > C.todayStr(t)){ journalFieldError("Chưa ghi được cho ngày ở tương lai"); return; }
    var text = C.clipGraphemes($("jText").value.trim(), C.JOURNAL_TEXT_MAX).trim();
    if(!jr.mood && !text){ journalFieldError("Hãy chọn tâm trạng hoặc viết vài dòng"); return; }
    var old = journalByDate(date);
    if(!old && state.journal.length >= C.MAX_JOURNAL){ showError("journalFormErr", journalFullText()); return; }
    var rec = C.validateJournal({ date: date, mood: jr.mood, text: text, updatedAt: t });
    if(!rec){ showError("journalFormErr", "Dữ liệu chưa hợp lệ, hãy kiểm tra lại."); return; }
    var next = old ? state.journal.map(function(x){ return x.date === date ? rec : x; }) : state.journal.concat([rec]);
    journalWrite($("journalSave"), next, function(){
      closeSheets();
      toast(old ? "Đã lưu nhật ký ✓" : "Đã ghi nhật ký ✓");
    }, function(msg){ showError("journalFormErr", msg); });
  });

  $("journalDelete").addEventListener("click", function(){
    if(!journalByDate(jr.date) || jr.saving) return;
    $("journalConfirmText").textContent = "Xoá nhật ký ngày " + fmtDate(jr.date) + "?";
    $("journalDelete").hidden = true;
    $("journalConfirm").hidden = false;
    $("journalConfirmNo").focus({ preventScroll: true });
    $("journalConfirm").scrollIntoView({ block: "nearest" });
  });
  $("journalConfirmNo").addEventListener("click", function(){
    if(jr.saving) return;
    $("journalConfirm").hidden = true;
    $("journalDelete").hidden = false;
    $("journalDelete").focus({ preventScroll: true });
  });
  $("journalConfirmYes").addEventListener("click", function(){
    var date = jr.date;
    if(jr.saving || !journalByDate(date)) return;
    showError("journalFormErr", null);
    journalWrite(this, state.journal.filter(function(x){ return x.date !== date; }), function(){
      closeSheets();
      toast("Đã xoá nhật ký ngày này");
    }, function(msg){ showError("journalFormErr", msg); });
  });

  // ---------- Date fields + wheel picker ----------
  // Each date is a hidden input (its .value stays 'YYYY-MM-DD' or '') plus a
  // button showing it. Always write through setDateValue so the button never
  // goes stale. "Today" and the bounds come from LoveCore (VN time).
  var DATE_FIELDS = {
    setupStart:   { min: "1950-01-01", optional: false },
    setupDobLong: { min: "1900-01-01", optional: true, def: "2000-01-01", empty: "Tuỳ chọn" },
    setupDobThu:  { min: "1900-01-01", optional: true, def: "2000-01-01", empty: "Tuỳ chọn" },
    pfStart:      { min: "1950-01-01", optional: false },
    pfDobLong:    { min: "1900-01-01", optional: true, def: "2000-01-01" },
    pfDobThu:     { min: "1900-01-01", optional: true, def: "2000-01-01" },
    // 1900 matches validateMilestone, so an older stored milestone opens on its
    // own date instead of being moved to the bound when "Xong" is pressed.
    msDate:       { min: "1900-01-01", optional: false, futureYears: 20 },
    cyStart:      { min: "2000-01-01", optional: false },
    cyEnd:        { min: "2000-01-01", optional: true, empty: "Chưa kết thúc", defFrom: "cyStart" },
    wPlan:        { min: "2000-01-01", optional: true, empty: "Chưa hẹn ngày", futureYears: 20 },
    wDone:        { min: "2000-01-01", optional: true, empty: "Chưa làm" }
  };

  function setDateValue(id, v){
    $(id).value = v || "";
    renderDateField(id);
  }
  function renderDateField(id){
    var v = $(id).value, btn = $(id + "Btn"), ok = C.isValidDate(v);
    btn.classList.toggle("is-empty", !ok);
    btn.querySelector(".date-field-text").innerHTML = ok
      ? '<span class="date-field-wd">' + weekday(v) + ", </span>" + fmtDate(v)
      : (DATE_FIELDS[id].optional ? DATE_FIELDS[id].empty || "Chưa đặt" : "Chọn ngày");
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-date-for]"), function(btn){
    btn.addEventListener("click", function(){ openDatePicker(btn.getAttribute("data-date-for")); });
  });

  var DP_ROW = 40;
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  var dp = { open: false, id: null, y: 2000, m: 1, d: 1, min: "", max: "", today: "", minY: 1900, maxY: 2000, raf: 0, dayTimer: 0 };
  var dpCols = [
    { key: "d", el: $("dpDay"), timer: null, prog: false, touching: false },
    { key: "m", el: $("dpMonth"), timer: null, prog: false, touching: false },
    { key: "y", el: $("dpYear"), timer: null, prog: false, touching: false }
  ];

  function ymd(y, m, d){ return y + "-" + pad2(m) + "-" + pad2(d); }
  function monthLen(y, m){ return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function colCount(col){ return col.key === "d" ? 31 : col.key === "m" ? 12 : dp.maxY - dp.minY + 1; }
  function colValue(col, i){ return col.key === "y" ? dp.minY + i : i + 1; }
  function colIndexOf(col, v){ return col.key === "y" ? v - dp.minY : v - 1; }
  function colScrollIndex(col){
    return Math.max(0, Math.min(colCount(col) - 1, Math.round(col.el.scrollTop / DP_ROW)));
  }

  function dpSetParts(s){ dp.y = +s.slice(0, 4); dp.m = +s.slice(5, 7); dp.d = +s.slice(8, 10); }
  // Clamp the day to the month's length, then the date into [min, max].
  function dpNormalize(){
    dp.d = Math.min(dp.d, monthLen(dp.y, dp.m));
    var s = ymd(dp.y, dp.m, dp.d);
    if(s < dp.min) dpSetParts(dp.min);
    else if(s > dp.max) dpSetParts(dp.max);
  }
  function dpValue(){ return ymd(dp.y, dp.m, dp.d); }

  function dpBuild(){
    dpCols.forEach(function(col){
      var html = "";
      for(var i = 0, n = colCount(col); i < n; i++){
        var v = colValue(col, i);
        html += '<div class="dp-opt" role="option" id="' + col.el.id + "-" + i + '" data-i="' + i + '" aria-selected="false">' +
          (col.key === "m" ? "Tháng " + v : v) + "</div>";
      }
      col.el.innerHTML = html;
      col.opts = col.el.children;
    });
  }

  function dpPaintDisabled(){
    var dim = monthLen(dp.y, dp.m), day = dpCols[0], mon = dpCols[1];
    for(var d = 1; d <= 31; d++){
      var s = ymd(dp.y, dp.m, d);
      day.opts[d - 1].setAttribute("aria-disabled", d > dim || s < dp.min || s > dp.max ? "true" : "false");
    }
    for(var m = 1; m <= 12; m++){
      var off = ymd(dp.y, m, monthLen(dp.y, m)) < dp.min || ymd(dp.y, m, 1) > dp.max;
      mon.opts[m - 1].setAttribute("aria-disabled", off ? "true" : "false");
    }
  }

  // Puts every wheel on the current value. Columns the user is still moving
  // are left alone; their own settle re-runs this.
  function dpSync(smooth){
    dpPaintDisabled();
    dpCols.forEach(function(col){
      var i = colIndexOf(col, dp[col.key]);
      var prev = col.el.querySelector('[aria-selected="true"]');
      if(prev) prev.setAttribute("aria-selected", "false");
      col.opts[i].setAttribute("aria-selected", "true");
      col.el.setAttribute("aria-activedescendant", col.opts[i].id);
      if(col.touching || (col.timer && !col.prog)) return;
      if(Math.abs(col.el.scrollTop - i * DP_ROW) > 0.5){
        col.prog = true;
        col.el.scrollTo({ top: i * DP_ROW, behavior: smooth && !(reduceMotion && reduceMotion.matches) ? "smooth" : "auto" });
      }
    });
    var v = dpValue();
    $("dpPreview").textContent = weekday(v) + ", " + fmtDate(v);
    dpPaintWheels();
  }

  function dpSettle(col){
    clearTimeout(col.timer);
    col.timer = null;
    if(!dp.open || col.touching) return;
    var wasProg = col.prog;
    col.prog = false;
    var v = colValue(col, colScrollIndex(col));
    if(!wasProg) dp[col.key] = v;
    dpNormalize();
    dpSync(true);
  }

  // The 3D tilt and the bold centre row follow the live scroll position.
  function dpPaintWheels(){
    dp.raf = 0;
    var tilt = !(reduceMotion && reduceMotion.matches);
    dpCols.forEach(function(col){
      var center = col.el.scrollTop / DP_ROW, n = colCount(col);
      var lo = Math.max(0, Math.floor(center) - 4), hi = Math.min(n - 1, Math.ceil(center) + 4);
      for(var i = lo; i <= hi; i++){
        var dist = i - center, o = col.opts[i];
        o.classList.toggle("is-center", Math.abs(dist) < 0.5);
        o.style.transform = tilt ? "perspective(320px) rotateX(" + Math.max(-70, Math.min(70, -dist * 20)).toFixed(1) + "deg)" : "";
      }
    });
  }

  dpCols.forEach(function(col){
    var el = col.el;
    el.addEventListener("scroll", function(){
      if(!dp.raf) dp.raf = requestAnimationFrame(dpPaintWheels);
      clearTimeout(col.timer);
      // scrollend isn't in older Safari; the debounce covers it.
      if(!col.touching) col.timer = setTimeout(function(){ dpSettle(col); }, 140);
      else col.timer = null;
    }, { passive: true });
    el.addEventListener("scrollend", function(){ if(col.timer) dpSettle(col); });
    el.addEventListener("touchstart", function(){ col.touching = true; col.prog = false; clearTimeout(col.timer); col.timer = null; }, { passive: true });
    function touchEnd(){
      col.touching = false;
      clearTimeout(col.timer);
      col.timer = setTimeout(function(){ dpSettle(col); }, 140);
    }
    el.addEventListener("touchend", touchEnd, { passive: true });
    el.addEventListener("touchcancel", touchEnd, { passive: true });
    el.addEventListener("wheel", function(){ col.prog = false; }, { passive: true });
    el.addEventListener("click", function(e){
      var o = e.target.closest(".dp-opt");
      if(!o) return;
      dp[col.key] = colValue(col, +o.getAttribute("data-i"));
      dpNormalize();
      dpSync(true);
    });
    el.addEventListener("keydown", function(e){
      var i = colIndexOf(col, dp[col.key]), n = colCount(col), to = null;
      if(e.key === "ArrowUp") to = i - 1;
      else if(e.key === "ArrowDown") to = i + 1;
      else if(e.key === "PageUp") to = i - 5;
      else if(e.key === "PageDown") to = i + 5;
      else if(e.key === "Home") to = 0;
      else if(e.key === "End") to = n - 1;
      else if(e.key === "Enter"){ e.preventDefault(); closeDatePicker(true); return; }
      if(to === null) return;
      e.preventDefault();
      clearTimeout(col.timer); col.timer = null;
      dp[col.key] = colValue(col, Math.max(0, Math.min(n - 1, to)));
      dpNormalize();
      dpSync(true);
    });
  });

  // A closed backdrop must be display:none, not just opacity:0: iOS appears to
  // tint the status-bar strip with the background of a fixed element touching
  // the top edge, even a fully transparent one.
  function showBackdrop(el){
    clearTimeout(el.hideTimer);
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add("open");
  }
  // A timer rather than transitionend: reduced motion switches the transition off.
  function hideBackdrop(el){
    el.classList.remove("open");
    clearTimeout(el.hideTimer);
    el.hideTimer = setTimeout(function(){
      if(!el.classList.contains("open")) el.hidden = true;
    }, 260);
  }

  function openDatePicker(id){
    var cfg = DATE_FIELDS[id], today = C.todayStr(now()), v = $(id).value;
    dp.id = id; dp.today = today; dp.min = cfg.min;
    dp.max = cfg.futureYears ? C.addYearsClamp(today, cfg.futureYears) : today;
    // A stored value outside the bounds (old data, imported backup) widens them
    // so opening the picker and pressing "Xong" never silently moves it; the
    // save path still validates (e.g. future start dates are rejected there).
    if(C.isValidDate(v)){ if(v < dp.min) dp.min = v; if(v > dp.max) dp.max = v; }
    dp.minY = +dp.min.slice(0, 4); dp.maxY = +dp.max.slice(0, 4);
    var from = cfg.defFrom ? $(cfg.defFrom).value : "";
    dpSetParts(C.isValidDate(v) ? v : C.isValidDate(from) ? from : cfg.def || today);
    dpNormalize();
    dpBuild();
    dpCols.forEach(function(col){ clearTimeout(col.timer); col.timer = null; col.touching = false; col.prog = false; });
    $("dpTitle").textContent = $(id + "Btn").getAttribute("data-date-title");
    $("dpToday").hidden = today < dp.min || today > dp.max;
    $("dpClear").hidden = !cfg.optional || !v;
    dp.open = true;
    var sheet = $("datePicker");
    sheet.setAttribute("aria-hidden", "false");
    sheet.classList.add("open");
    showBackdrop($("dpBackdrop"));
    $(id + "Btn").setAttribute("aria-expanded", "true");
    dpSync(false);
    dpCols[0].el.focus({ preventScroll: true });
    dp.dayTimer = setInterval(dpRefreshToday, 15000);
  }

  // The picker may stay open across midnight: "Hôm nay" and a today-bounded
  // max must follow the new day.
  function dpRefreshToday(){
    if(!dp.open) return;
    var today = C.todayStr(now());
    if(today === dp.today) return;
    var cfg = DATE_FIELDS[dp.id], v = $(dp.id).value, oldMaxY = dp.maxY;
    dp.today = today;
    dp.max = cfg.futureYears ? C.addYearsClamp(today, cfg.futureYears) : today;
    if(C.isValidDate(v) && v > dp.max) dp.max = v;
    dp.maxY = +dp.max.slice(0, 4);
    $("dpToday").hidden = today < dp.min || today > dp.max;
    if(dp.maxY !== oldMaxY) dpBuild();
    dpSync(false);
  }

  // how: true = Xong, "clear" = Xoá ngày, false = Huỷ.
  function closeDatePicker(how){
    if(!dp.open) return;
    if(how === true){
      dpCols.forEach(function(col){
        if(col.touching || (col.timer && !col.prog)) dp[col.key] = colValue(col, colScrollIndex(col));
      });
      dpNormalize();
    }
    dp.open = false;
    clearInterval(dp.dayTimer);
    dpCols.forEach(function(col){ clearTimeout(col.timer); col.timer = null; col.touching = false; });
    var sheet = $("datePicker"), id = dp.id;
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    hideBackdrop($("dpBackdrop"));
    if(how){
      var val = how === "clear" ? "" : dpValue(), input = $(id);
      if(input.value !== val){
        setDateValue(id, val);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    $(id + "Btn").setAttribute("aria-expanded", "false");
    $(id + "Btn").focus({ preventScroll: true });
  }

  function onDatePickerKey(e){
    if(e.key === "Escape"){ e.preventDefault(); closeDatePicker(false); return; }
    trapTab($("datePicker"), e);
  }

  // Keeps Tab inside an open dialog (date picker, sheets, viewer).
  function trapTab(root, e){
    if(e.key !== "Tab") return;
    var f = Array.prototype.filter.call(root.querySelectorAll('button,input,textarea,select,summary,a[href],[tabindex]:not([tabindex="-1"])'), function(el){
      return !el.disabled && !el.hidden && el.getClientRects().length > 0;
    });
    if(!f.length){ e.preventDefault(); return; }
    var i = f.indexOf(document.activeElement);
    if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
    else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    else if(i === -1){ e.preventDefault(); f[0].focus(); }
  }

  $("dpCancel").addEventListener("click", function(){ closeDatePicker(false); });
  $("dpDone").addEventListener("click", function(){ closeDatePicker(true); });
  $("dpClear").addEventListener("click", function(){ closeDatePicker("clear"); });
  $("dpBackdrop").addEventListener("click", function(){ closeDatePicker(false); });
  $("dpToday").addEventListener("click", function(){
    dpRefreshToday();
    dpCols.forEach(function(col){ clearTimeout(col.timer); col.timer = null; });
    dpSetParts(dp.today);
    dpNormalize();
    dpSync(true);
  });

  // ---------- Profile (setup + settings share validation) ----------
  function readProfileInputs(ids){
    var start = $(ids.start).value;
    var st = C.checkStartDate(start, now());
    if(st === "invalid") return { error: "Hãy chọn ngày bắt đầu yêu nhau." };
    if(st === "future") return { error: "Ngày bắt đầu không được sau hôm nay." };
    var names = [$(ids.nameLong).value.trim(), $(ids.nameThu).value.trim()];
    if(!names[0] || !names[1]) return { error: "Hãy nhập tên của cả hai bạn." };
    var dobs = [$(ids.dobLong).value, $(ids.dobThu).value];
    for(var i = 0; i < 2; i++){
      if(!dobs[i]){ dobs[i] = null; continue; }
      var ds = C.checkStartDate(dobs[i], now());
      if(ds === "invalid") return { error: "Ngày sinh chưa hợp lệ." };
      if(ds === "future") return { error: "Ngày sinh không được sau hôm nay." };
    }
    var old = state.profile;
    return { record: {
      key: "profile", startDate: start,
      persons: [{ id: "long", name: names[0], dob: dobs[0] }, { id: "thu", name: names[1], dob: dobs[1] }],
      hasCover: old ? old.hasCover : false,
      activeGen: C.genForWrite(old, state.photos).write,
      updatedAt: now()
    } };
  }

  function saveProfile(rec){
    if(state.loadFailed) return Promise.reject(new Error("load failed"));
    return put("kv", rec).then(function(){
      state.profile = C.validateProfile(rec, now());
      dataChanged();
    });
  }

  $("setupForm").addEventListener("submit", function(e){
    e.preventDefault();
    var r = readProfileInputs({ start: "setupStart", nameLong: "setupNameLong", nameThu: "setupNameThu", dobLong: "setupDobLong", dobThu: "setupDobThu" });
    if(r.error){ showError("setupError", r.error); return; }
    showError("setupError", null);
    saveProfile(r.record).then(function(){
      requestPersist();
      state.tab = "home";
      showApp();
    }, function(){ showError("setupError", "Không lưu được vào bộ nhớ máy. Hãy thử lại."); });
  });

  function fillProfileForm(){
    var p = state.profile;
    setDateValue("pfStart", p.startDate);
    $("pfNameLong").value = p.persons[0].name;
    $("pfNameThu").value = p.persons[1].name;
    setDateValue("pfDobLong", p.persons[0].dob || "");
    setDateValue("pfDobThu", p.persons[1].dob || "");
    $("labelAvatarLong").textContent = p.persons[0].name;
    $("labelAvatarThu").textContent = p.persons[1].name;
    profileSnap = profileFormValue();
    syncProfileDirty();
  }

  // "Lưu hồ sơ" stays disabled until something in the form differs from
  // what's stored. Date pickers dispatch input/change on their hidden inputs.
  var PF_IDS = ["pfStart", "pfNameLong", "pfNameThu", "pfDobLong", "pfDobThu"];
  var profileSnap = "";
  function profileFormValue(){
    return JSON.stringify(PF_IDS.map(function(id){ return id.indexOf("Name") > 0 ? $(id).value.trim() : $(id).value; }));
  }
  function syncProfileDirty(){ $("btnSaveProfile").disabled = profileFormValue() === profileSnap; }
  $("profileForm").addEventListener("input", syncProfileDirty);
  $("profileForm").addEventListener("change", syncProfileDirty);

  $("profileForm").addEventListener("submit", function(e){
    e.preventDefault();
    var r = readProfileInputs({ start: "pfStart", nameLong: "pfNameLong", nameThu: "pfNameThu", dobLong: "pfDobLong", dobThu: "pfDobThu" });
    if(r.error){ showError("profileError", r.error); return; }
    showError("profileError", null);
    saveProfile(r.record).then(function(){
      recompute(); renderHome(); renderMilestones(); fillProfileForm(); updateBadge();
      toast("Đã lưu hồ sơ ✓");
    }, function(){ showError("profileError", "Không lưu được vào bộ nhớ máy. Hãy thử lại."); });
  });

  // ---------- Avatar / cover ----------
  var THUMB_IDS = { "avatar-long": "thumbAvatarLong", "avatar-thu": "thumbAvatarThu", cover: "thumbCover" };
  function renderPhotoRows(){
    var p = state.profile;
    PHOTO_IDS.forEach(function(id){
      var box = $(THUMB_IDS[id]);
      paintImg(box, state.urls[id]);
      box.querySelector("span").textContent = id === "cover" ? "♥" : initial(p.persons[id === "avatar-long" ? 0 : 1].name);
      document.querySelector('[data-remove="' + id + '"]').hidden = !state.blobs[id];
    });
  }

  function handlePhoto(id, input){
    var file = input.files && input.files[0];
    if(!file) return;
    showError("photoError", null);
    $("photoBusy").hidden = false;
    var job = id === "cover" ? M.compressCover(file) : M.compressAvatar(file);
    job.then(function(res){
      var rec = { id: id, gen: C.genForWrite(state.profile, state.photos).tag, mime: res.mime, data: res.data, thumb: null, w: res.w, h: res.h };
      return put("blobs", rec).then(function(){
        state.blobs[id] = rec;
        setUrl(id);
        if(id === "cover" && !state.profile.hasCover){
          state.profile.hasCover = true;
          return put("kv", profileRecord(state.profile));
        }
      });
    }).then(function(){
      dataChanged();
      renderPhotoRows(); renderHome();
    }, function(){
      showError("photoError", 'Không xử lý được ảnh "' + file.name + '". Hãy thử ảnh khác.');
    }).then(function(){
      $("photoBusy").hidden = true;
      input.value = "";
    });
  }
  $("fileAvatarLong").addEventListener("change", function(){ handlePhoto("avatar-long", this); });
  $("fileAvatarThu").addEventListener("change", function(){ handlePhoto("avatar-thu", this); });
  $("fileCover").addEventListener("change", function(){ handlePhoto("cover", this); });

  // id = the picture the open confirm row is about.
  var photoRemove = { id: null, busy: false };
  function closePhotoConfirm(){
    var id = photoRemove.id;
    photoRemove.id = null;
    $("photoConfirm").hidden = true;
    return id ? document.querySelector('[data-remove="' + id + '"]') : null;
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-remove]"), function(btn){
    btn.addEventListener("click", function(){
      var id = btn.getAttribute("data-remove");
      if(photoRemove.busy || !state.blobs[id]) return;
      photoRemove.id = id;
      showError("photoError", null);
      $("photoConfirmText").textContent = id === "cover" ? "Gỡ ảnh bìa?"
        : "Gỡ ảnh đại diện của " + state.profile.persons[id === "avatar-long" ? 0 : 1].name + "?";
      $("photoConfirm").hidden = false;
      $("photoConfirmNo").focus({ preventScroll: true });
      $("photoConfirm").scrollIntoView({ block: "nearest" });
    });
  });
  $("photoConfirmNo").addEventListener("click", function(){
    if(photoRemove.busy) return;
    var back = closePhotoConfirm();
    if(back && !back.hidden) back.focus({ preventScroll: true });
  });
  $("photoConfirmYes").addEventListener("click", function(){
    var id = photoRemove.id;
    if(photoRemove.busy || !id) return;
    photoRemove.busy = true;
    del("blobs", id).then(function(){
      delete state.blobs[id];
      setUrl(id);
      if(id === "cover"){
        state.profile.hasCover = false;
        return put("kv", profileRecord(state.profile));
      }
    }).then(function(){
      photoRemove.busy = false;
      closePhotoConfirm();
      dataChanged(); renderPhotoRows(); renderHome();
    }, function(){
      photoRemove.busy = false;
      closePhotoConfirm();
      showError("photoError", "Không gỡ được ảnh. Hãy thử lại.");
    });
  });

  // ---------- Album storage (IndexedDB, or memory) ----------
  var SORTS = ["taken", "added", "custom"];

  function readBlob(id){
    if(state.db) return C.idbGet(state.db, "blobs", id).then(function(b){ return C.validateBlob(b); }, function(){ return null; });
    return Promise.resolve(mem.blobs[id] || null);
  }
  function readBlobs(ids){
    if(!state.db) return Promise.resolve(ids.map(function(id){ return mem.blobs[id] || null; }));
    var st;
    try{ st = state.db.transaction("blobs").objectStore("blobs"); }catch(e){ return Promise.resolve(ids.map(function(){ return null; })); }
    return Promise.all(ids.map(function(id){ return C.reqP(st.get(id)).catch(function(){ return null; }); }));
  }
  function putPhotoAndBlob(photo, blob){
    if(!state.db){ mem.photos[photo.id] = photo; mem.blobs[blob.id] = blob; return Promise.resolve(); }
    var tx = state.db.transaction(["photos", "blobs"], "readwrite");
    tx.objectStore("blobs").put(blob);
    tx.objectStore("photos").put(photo);
    return C.txDone(tx);
  }
  function putPhotos(list){
    if(!state.db){ list.forEach(function(p){ mem.photos[p.id] = p; }); return Promise.resolve(); }
    var tx = state.db.transaction("photos", "readwrite");
    list.forEach(function(p){ tx.objectStore("photos").put(p); });
    return C.txDone(tx);
  }
  // One transaction: the photo, its blob, and the link to it in every
  // milestone (read inside the transaction, so the stored records are the ones
  // rewritten). Resolves with how many milestones in state lost the link.
  function deletePhoto(id){
    function unlink(){
      var n = 0;
      state.milestones = state.milestones.map(function(m){
        if(!m.photoIds || m.photoIds.indexOf(id) === -1) return m;
        n++;
        return Object.assign({}, m, { photoIds: m.photoIds.filter(function(x){ return x !== id; }) });
      });
      return n;
    }
    if(!state.db){
      delete mem.photos[id]; delete mem.blobs[id];
      var n = unlink();
      state.milestones.forEach(function(m){ if(mem.milestones[m.id]) mem.milestones[m.id] = m; });
      return Promise.resolve(n);
    }
    var tx = state.db.transaction(["photos", "blobs", "milestones"], "readwrite");
    tx.objectStore("photos").delete(id);
    tx.objectStore("blobs").delete(id);
    var rq = tx.objectStore("milestones").openCursor();
    rq.onsuccess = function(){
      var cur = rq.result;
      if(!cur) return;
      var v = cur.value;
      if(v && Array.isArray(v.photoIds) && v.photoIds.indexOf(id) !== -1){
        v.photoIds = v.photoIds.filter(function(x){ return x !== id; });
        cur.update(v);
      }
      cur.continue();
    };
    return C.txDone(tx).then(unlink);
  }
  function saveMeta(){ return put("kv", state.meta).catch(function(){}); }
  function photoById(id){
    for(var i = 0; i < state.photos.length; i++) if(state.photos[i].id === id) return state.photos[i];
    return null;
  }
  function newPhotoId(){ return "p" + now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function vnDate(ms){ return fmtDate(C.todayStr(ms)); }
  function photoDateText(p){ return p.takenAt != null ? "Chụp " + vnDate(p.takenAt) : "Thêm vào " + vnDate(p.addedAt); }

  // ---------- Album grid ----------
  // Ngày chụp: oldest first (the story in order; no EXIF → date added).
  // Ngày thêm: newest first, so just-added photos are on top.
  function sortedPhotos(){
    var s = state.meta.albumSort;
    return state.photos.slice().sort(function(a, b){
      if(s === "custom") return a.order - b.order || a.addedAt - b.addedAt || (a.id < b.id ? -1 : 1);
      if(s === "added") return b.addedAt - a.addedAt || b.order - a.order || (a.id < b.id ? -1 : 1);
      var ka = a.takenAt != null ? a.takenAt : a.addedAt, kb = b.takenAt != null ? b.takenAt : b.addedAt;
      return ka - kb || a.addedAt - b.addedAt || (a.id < b.id ? -1 : 1);
    });
  }

  var thumbUrls = {}, thumbWanted = [], thumbTimer = null;
  var thumbIO = "IntersectionObserver" in window ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      thumbIO.unobserve(e.target);
      wantThumb(e.target.getAttribute("data-id"));
    });
  }, { rootMargin: "700px 0px" }) : null;

  function wantThumb(id){
    thumbWanted.push(id);
    if(!thumbTimer) thumbTimer = setTimeout(flushThumbs, 16);
  }
  function flushThumbs(){
    thumbTimer = null;
    var ids = thumbWanted.filter(function(id, i, a){ return a.indexOf(id) === i && !thumbUrls[id]; });
    thumbWanted = [];
    if(!ids.length) return;
    readBlobs(ids).then(function(recs){
      recs.forEach(function(rec, i){
        var id = ids[i];
        if(!rec || thumbUrls[id] || state.tab !== "album" || !photoById(id)) return;
        var buf = rec.thumb instanceof ArrayBuffer && rec.thumb.byteLength ? rec.thumb : rec.data;
        if(!(buf instanceof ArrayBuffer)) return;
        thumbUrls[id] = URL.createObjectURL(new Blob([buf], { type: "image/jpeg" }));
        var img = document.querySelector('.album-tile[data-id="' + id + '"] img');
        if(img) img.src = thumbUrls[id];
      });
    });
  }
  function revokeThumb(id){
    if(thumbUrls[id]){ URL.revokeObjectURL(thumbUrls[id]); delete thumbUrls[id]; }
  }
  function releaseAlbumThumbs(){
    if(thumbIO) thumbIO.disconnect();
    $("albumGrid").innerHTML = "";
    Object.keys(thumbUrls).forEach(revokeThumb);
  }

  var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function renderAlbum(){
    var list = sortedPhotos(), n = list.length, sort = state.meta.albumSort;
    state.albumOrder = list.map(function(p){ return p.id; });
    $("albumSub").textContent = fmtInt(n) + " ảnh";
    $("albumSub").hidden = n === 0;
    $("albumTools").hidden = n === 0;
    $("albumEmpty").hidden = n !== 0 || busy === "album";
    // The empty state carries its own "Thêm ảnh"; one action on screen is enough.
    $("albumAdd").hidden = n === 0 && busy !== "album";
    Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function(b){
      b.setAttribute("aria-pressed", b.getAttribute("data-sort") === sort ? "true" : "false");
    });
    placeSegPill($("albumTools").querySelector(".segmented"));
    var custom = sort === "custom";
    if(!custom || n < 2) state.arranging = false;
    $("arrangeRow").hidden = !custom || n < 2;
    $("btnArrange").textContent = state.arranging ? "Xong" : "Sắp xếp";
    $("btnArrange").className = "btn btn-sm " + (state.arranging ? "btn-primary" : "btn-soft");
    $("arrangeHint").textContent = state.arranging ? "‹ › đổi chỗ · “Lên đầu” đưa ảnh lên đầu" : "";
    $("arrangeHint").hidden = !state.arranging;
    $("albumGrid").classList.toggle("arranging", state.arranging);

    var present = {};
    list.forEach(function(p){ present[p.id] = true; });
    Object.keys(thumbUrls).forEach(function(id){ if(!present[id]) revokeThumb(id); });
    if(thumbIO) thumbIO.disconnect();

    $("albumGrid").innerHTML = list.map(function(p, i){
      var src = thumbUrls[p.id] ? ' src="' + thumbUrls[p.id] + '"' : "";
      if(state.arranging){
        var pos = i + 1;
        return '<li class="album-tile" data-id="' + p.id + '"><div class="album-thumb"><img alt=""' + src + '><span class="tile-pos">' + pos + "</span></div>" +
          '<div class="tile-ctrls">' +
          '<button type="button" class="tile-btn" data-move="-1" aria-label="Đưa ảnh ' + pos + ' lên trước"' + (i === 0 ? " disabled" : "") + ">" + ICON_PREV + "</button>" +
          '<button type="button" class="tile-btn" data-move="1" aria-label="Đưa ảnh ' + pos + ' ra sau"' + (i === n - 1 ? " disabled" : "") + ">" + ICON_NEXT + "</button>" +
          '<button type="button" class="tile-btn tile-top" data-move="top"' + (i === 0 ? " disabled" : "") + ">Lên đầu</button>" +
          "</div></li>";
      }
      var label = "Ảnh " + (i + 1) + ", " + photoDateText(p).toLowerCase() + (p.caption ? ": " + p.caption : "");
      return '<li class="album-tile" data-id="' + p.id + '"><button type="button" class="album-thumb" data-open="' + p.id + '" aria-label="' + escapeHtml(label) + '"><img alt=""' + src + "></button></li>";
    }).join("");

    Array.prototype.forEach.call($("albumGrid").children, function(li){
      var id = li.getAttribute("data-id");
      if(thumbUrls[id]) return;
      if(thumbIO) thumbIO.observe(li); else wantThumb(id);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function(b){
    b.addEventListener("click", function(){
      var s = b.getAttribute("data-sort");
      if(s === state.meta.albumSort) return;
      state.meta.albumSort = s;
      state.arranging = false;
      saveMeta();
      renderAlbum();
    });
  });
  $("btnArrange").addEventListener("click", function(){
    state.arranging = !state.arranging;
    renderAlbum();
  });

  $("albumGrid").addEventListener("click", function(e){
    var mv = e.target.closest("[data-move]");
    if(mv){
      if(!mv.disabled) movePhoto(mv.closest(".album-tile").getAttribute("data-id"), mv.getAttribute("data-move"));
      return;
    }
    var open = e.target.closest("[data-open]");
    if(open) openViewer(open.getAttribute("data-open"));
  });

  // Renumbers order 0..n-1 in the new sequence and writes only the photos
  // whose order actually changed (one transaction).
  function movePhoto(id, how){
    if(busy) return;
    var list = sortedPhotos();
    var idx = -1;
    list.forEach(function(p, i){ if(p.id === id) idx = i; });
    if(idx < 0) return;
    var item = list.splice(idx, 1)[0];
    var to = how === "top" ? 0 : Math.max(0, Math.min(list.length, idx + (+how)));
    list.splice(to, 0, item);
    var changed = [];
    list.forEach(function(p, i){ if(p.order !== i) changed.push(Object.assign({}, p, { order: i })); });
    if(!changed.length) return;
    putPhotos(changed).then(function(){
      changed.forEach(function(c){
        for(var i = 0; i < state.photos.length; i++) if(state.photos[i].id === c.id) state.photos[i] = c;
      });
      dataChanged();
      renderAlbum();
      var sel = '.album-tile[data-id="' + id + '"] [data-move="' + how + '"]';
      var again = document.querySelector(sel);
      if(again && !again.disabled) again.focus({ preventScroll: true });
    }, function(){ showError("albumError", "Không lưu được thứ tự mới. Hãy thử lại."); });
  }

  // ---------- Album: add photos ----------
  function onAlbumFiles(){
    var files = Array.prototype.slice.call(this.files || []);
    this.value = "";
    if(files.length) addPhotos(files);
  }
  $("fileAlbum").addEventListener("change", onAlbumFiles);
  $("fileAlbumEmpty").addEventListener("change", onAlbumFiles);

  function setAlbumBusy(on){
    $("albumAdd").classList.toggle("is-busy", on);
    $("fileAlbum").disabled = on;
    $("fileAlbumEmpty").disabled = on;
  }

  async function addPhotos(files){
    if(busy){ showError("albumError", "Đang sao lưu/nhập — đợi xong rồi thêm ảnh."); return; }
    busy = "album";
    setAlbumBusy(true);
    showError("albumError", null);
    if(state.tab === "album") renderAlbum();
    var total = files.length, saved = 0, dupes = 0, failed = [], quotaAt = -1;
    var shas = {}, baseOrder = 0, addedBase = now();
    state.photos.forEach(function(p){
      if(p.sha256) shas[p.sha256] = true;
      if(p.order + 1 > baseOrder) baseOrder = p.order + 1;
    });
    var gen = C.genForWrite(state.profile, state.photos).tag;
    for(var i = 0; i < total; i++){
      $("albumProgress").hidden = false;
      $("albumProgress").textContent = "Đang xử lý " + (i + 1) + "/" + total + "…";
      var file = files[i], name = file.name || "ảnh " + (i + 1), res;
      try{ res = await M.compressAlbum(file); }
      catch(e){ failed.push(name); continue; }
      if(res.sha256 && shas[res.sha256]){ dupes++; continue; }
      var id = newPhotoId();
      var photo = { id: id, gen: gen, caption: "", takenAt: res.takenAt, addedAt: addedBase + i,
                    order: baseOrder + saved, w: res.w, h: res.h, bytes: res.bytes, sha256: res.sha256 };
      try{
        await putPhotoAndBlob(photo, { id: id, gen: gen, mime: res.mime, data: res.data, thumb: res.thumb });
      }catch(e){
        if(B.isQuota(e)){ quotaAt = i; break; }
        failed.push(name);
        continue;
      }
      res = null;
      if(photo.sha256) shas[photo.sha256] = true;
      state.photos.push(photo);
      saved++;
      if(state.tab === "album") renderAlbum();
    }
    busy = null;
    setAlbumBusy(false);
    $("albumProgress").hidden = true;
    if(saved){ dataChanged(); requestPersist(); }
    var errs = [];
    if(quotaAt >= 0) errs.push("Bộ nhớ máy đầy — đã lưu " + saved + "/" + total + " ảnh.");
    if(failed.length) errs.push("Không đọc được " + failed.length + " ảnh (" + failed.slice(0, 5).join(", ") + (failed.length > 5 ? "…" : "") + ") — hãy thử JPEG/PNG.");
    showError("albumError", errs.join(" ") || null);
    var notes = [];
    if(saved) notes.push("Đã thêm " + saved + " ảnh 💕");
    if(dupes) notes.push((saved ? "bỏ qua " : "Bỏ qua ") + dupes + " ảnh đã có");
    if(notes.length) toast(notes.join(" · "));
    if(state.tab === "album") renderAlbum();
    if(saved && state.mode === "app") renderOnThisDay();
  }

  // ---------- Viewer ----------
  // A fixed overlay on top of the album: no navigation, so closing lands on
  // the same grid. The page behind is locked with body{position:fixed} (iOS
  // ignores overflow:hidden on body) and scrollY is restored on close.
  // ctx "album" = every photo, in the album's order. ctx "ms" = only the photos
  // of milestone msId, opened from the timeline at photo `from`: no delete
  // there (it would delete from the Album, not unlink from the milestone).
  // ctx "home" = the photos of one year of "Ngày này năm xưa" (otdYear), no delete either.
  var viewer = { open: false, ids: [], index: 0, urls: {}, scrollY: 0, dirty: false, editing: false, deleting: false, ctx: "album", msId: null, otdYear: null, from: null };

  function lockScroll(){
    viewer.scrollY = window.scrollY;
    var b = document.body.style;
    b.position = "fixed"; b.top = -viewer.scrollY + "px"; b.left = "0"; b.right = "0"; b.width = "100%";
  }
  function unlockScroll(){
    var b = document.body.style;
    b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = "";
    window.scrollTo(0, viewer.scrollY);
  }

  function openViewer(id, ids, ctx){
    ids = ids || state.albumOrder;
    var idx = ids.indexOf(id);
    if(idx < 0) return;
    var where = ctx === "ms" || ctx === "home" ? ctx : "album", noDelete = where !== "album";
    viewer.ids = ids.slice();
    viewer.ctx = where;
    viewer.from = id;
    viewer.open = true;
    viewer.dirty = false;
    $("viewerDelete").hidden = noDelete;
    $("viewer").classList.toggle("no-delete", noDelete);
    $("viewerClose").setAttribute("aria-label", where === "ms" ? "Đóng, quay lại kỷ niệm" : where === "home" ? "Đóng, quay lại Trang chủ" : "Đóng, quay lại album");
    lockScroll();
    $("viewer").hidden = false;
    showViewerAt(idx);
    $("viewerClose").focus({ preventScroll: true });
  }

  function closeViewer(){
    if(!viewer.open) return;
    viewer.open = false;
    endCaptionEdit();
    hideViewerConfirm();
    $("viewer").hidden = true;
    $("viewerImg").removeAttribute("src");
    Object.keys(viewer.urls).forEach(dropFull);
    if(viewer.ctx === "ms"){
      if(viewer.dirty && state.mode === "app") renderMilestones();
      unlockScroll();
      var back = null;
      Array.prototype.forEach.call($("milestoneList").querySelectorAll("[data-tl-open]"), function(b){
        if(b.getAttribute("data-tl-ms") === viewer.msId && b.getAttribute("data-tl-open") === viewer.from) back = b;
      });
      if(back) back.focus({ preventScroll: true });
      return;
    }
    if(viewer.ctx === "home"){
      if(viewer.dirty && state.mode === "app") renderOnThisDay();
      unlockScroll();
      var from = $("otdBody").querySelector('[data-otd-photo="' + viewer.from + '"][data-otd-year="' + viewer.otdYear + '"]');
      if(from) from.focus({ preventScroll: true });
      return;
    }
    if(viewer.dirty) renderAlbum();
    unlockScroll();
    var tile = document.querySelector('.album-tile[data-id="' + viewer.ids[viewer.index] + '"] .album-thumb');
    if(tile && tile.focus) tile.focus({ preventScroll: true });
  }

  function loadFull(id){
    if(!viewer.urls[id]){
      viewer.urls[id] = readBlob(id).then(function(rec){
        if(!rec) return null;
        return URL.createObjectURL(new Blob([rec.data], { type: rec.mime || "image/jpeg" }));
      });
    }
    return viewer.urls[id];
  }
  function dropFull(id){
    var p = viewer.urls[id];
    delete viewer.urls[id];
    if(p) p.then(function(url){ if(url) URL.revokeObjectURL(url); });
  }

  function showViewerAt(i){
    var ids = viewer.ids;
    viewer.index = i;
    var id = ids[i], p = photoById(id);
    if(!p) return;
    endCaptionEdit();
    hideViewerConfirm();
    $("viewerCount").textContent = (i + 1) + " / " + ids.length;
    $("viewerDate").textContent = photoDateText(p);
    renderCaption(p);
    $("viewerPrev").disabled = i === 0;
    $("viewerNext").disabled = i === ids.length - 1;
    var img = $("viewerImg");
    img.style.transform = "";
    var small = tlUrls[id] || thumbUrls[id];
    if(small) img.src = small; else img.removeAttribute("src");
    img.alt = p.caption || photoDateText(p);
    loadFull(id).then(function(url){
      if(url && viewer.open && viewer.ids[viewer.index] === id) img.src = url;
    });
    var keep = {};
    [i - 1, i, i + 1].forEach(function(k){ if(k >= 0 && k < ids.length) keep[ids[k]] = true; });
    Object.keys(viewer.urls).forEach(function(k){ if(!keep[k]) dropFull(k); });
    [i - 1, i + 1].forEach(function(k){
      if(k < 0 || k >= ids.length) return;
      loadFull(ids[k]).then(function(url){
        if(!url) return;
        var pre = new Image();
        pre.src = url;
        if(pre.decode) pre.decode().catch(function(){});
      });
    });
  }

  function viewerStep(d){
    var k = viewer.index + d;
    if(viewer.deleting || k < 0 || k >= viewer.ids.length) return;
    showViewerAt(k);
  }

  function renderCaption(p){
    var b = $("viewerCaption");
    b.textContent = p.caption || "Thêm chú thích…";
    b.classList.toggle("empty", !p.caption);
  }
  function startCaptionEdit(){
    var p = photoById(viewer.ids[viewer.index]);
    if(!p) return;
    viewer.editing = true;
    $("viewerCaption").hidden = true;
    $("viewerCaptionForm").hidden = false;
    $("viewerCaptionInput").value = p.caption;
    $("viewerCaptionInput").focus();
  }
  function endCaptionEdit(){
    viewer.editing = false;
    $("viewerCaptionForm").hidden = true;
    $("viewerCaption").hidden = false;
  }
  $("viewerCaption").addEventListener("click", startCaptionEdit);
  $("viewerCaptionForm").addEventListener("submit", function(e){
    e.preventDefault();
    var p = photoById(viewer.ids[viewer.index]);
    if(!p) return;
    var cap = $("viewerCaptionInput").value.trim().slice(0, 200);
    if(cap === p.caption){ endCaptionEdit(); return; }
    var rec = Object.assign({}, p, { caption: cap });
    endCaptionEdit();
    renderCaption(rec);
    putPhotos([rec]).then(function(){
      for(var i = 0; i < state.photos.length; i++) if(state.photos[i].id === rec.id) state.photos[i] = rec;
      viewer.dirty = true;
      dataChanged();
      toast("Đã lưu chú thích ✓");
    }, function(){
      if(viewer.open && viewer.ids[viewer.index] === p.id){
        renderCaption(p);
        $("viewerCaption").textContent = "Không lưu được chú thích. Chạm để thử lại.";
      }
    });
  });

  $("viewerClose").addEventListener("click", closeViewer);
  $("viewerPrev").addEventListener("click", function(){ viewerStep(-1); });
  $("viewerNext").addEventListener("click", function(){ viewerStep(1); });
  // The confirm row is about the photo on show: stepping to another photo or closing puts it away.
  function viewerConfirmOpen(){ return !$("viewerConfirm").hidden; }
  function hideViewerConfirm(){
    $("viewerConfirm").hidden = true;
    showError("viewerErr", null);
  }
  $("viewerDelete").addEventListener("click", function(){
    var id = viewer.ids[viewer.index];
    if(viewer.ctx !== "album" || !photoById(id) || busy || viewer.deleting) return;
    endCaptionEdit();
    var k = state.milestones.filter(function(m){ return m.photoIds && m.photoIds.indexOf(id) !== -1; }).length;
    $("viewerConfirmText").textContent = "Xoá ảnh này khỏi Album? Không lấy lại được." + (k ? " Ảnh cũng rời khỏi " + fmtInt(k) + " kỷ niệm." : "");
    showError("viewerErr", null);
    $("viewerConfirm").hidden = false;
    $("viewerConfirmNo").focus({ preventScroll: true });
  });
  $("viewerConfirmNo").addEventListener("click", function(){
    if(viewer.deleting) return;
    hideViewerConfirm();
    $("viewerDelete").focus({ preventScroll: true });
  });
  $("viewerConfirmYes").addEventListener("click", function(){
    var id = viewer.ids[viewer.index], btn = this;
    if(viewer.ctx !== "album" || !photoById(id) || viewer.deleting) return;
    if(busy){ showError("viewerErr", "Đang sao lưu hoặc nhập — đợi xong rồi xoá."); return; }
    viewer.deleting = true;
    showError("viewerErr", null);
    btn.disabled = true; btn.textContent = "Đang xoá…";
    function release(){
      viewer.deleting = false;
      btn.disabled = false; btn.textContent = "Xoá ảnh";
    }
    // Inside a then() so a synchronous throw also releases the flag.
    Promise.resolve().then(function(){ return deletePhoto(id); }).then(function(unlinked){
      release();
      state.photos = state.photos.filter(function(p){ return p.id !== id; });
      if(unlinked && state.mode === "app") renderMilestones();
      dropFull(id);
      revokeThumb(id);
      dataChanged();
      if(state.mode === "app") renderOnThisDay();
      // The viewer may have been closed while the delete was on its way.
      var at = viewer.ids.indexOf(id);
      if(at !== -1) viewer.ids.splice(at, 1);
      if(!viewer.open){ if(state.tab === "album") renderAlbum(); return; }
      viewer.dirty = true;
      if(!viewer.ids.length){ closeViewer(); return; }
      showViewerAt(Math.min(viewer.index, viewer.ids.length - 1));
      $("viewerClose").focus({ preventScroll: true });
    }, function(){
      release();
      if(viewer.open) showError("viewerErr", "Không xoá được ảnh. Hãy thử lại.");
    });
  });

  function onViewerKey(e){
    if(e.key === "Tab"){ trapTab($("viewer"), e); return; }
    if(viewer.editing){
      if(e.key === "Escape"){ e.preventDefault(); endCaptionEdit(); }
      return;
    }
    if(viewerConfirmOpen()){
      if(e.key === "Escape"){ e.preventDefault(); if(!viewer.deleting){ hideViewerConfirm(); $("viewerDelete").focus({ preventScroll: true }); } }
      return;
    }
    if(e.key === "Escape"){ e.preventDefault(); closeViewer(); }
    else if(e.key === "ArrowLeft"){ e.preventDefault(); viewerStep(-1); }
    else if(e.key === "ArrowRight"){ e.preventDefault(); viewerStep(1); }
  }

  (function(){
    var stage = $("viewerStage"), img = $("viewerImg");
    var sx = 0, sy = 0, dx = 0, active = false, horizontal = null;
    stage.addEventListener("pointerdown", function(e){
      if(viewer.editing || (e.pointerType === "mouse" && e.button !== 0)) return;
      active = true; sx = e.clientX; sy = e.clientY; dx = 0; horizontal = null;
      img.style.transition = "none";
      try{ stage.setPointerCapture(e.pointerId); }catch(err){}
    });
    stage.addEventListener("pointermove", function(e){
      if(!active) return;
      var mx = e.clientX - sx, my = e.clientY - sy;
      if(horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) horizontal = Math.abs(mx) > Math.abs(my);
      if(!horizontal) return;
      dx = mx;
      var atEdge = (dx > 0 && viewer.index === 0) || (dx < 0 && viewer.index === viewer.ids.length - 1);
      img.style.transform = "translateX(" + (atEdge ? dx / 3 : dx) + "px)";
    });
    function end(){
      if(!active) return;
      active = false;
      img.style.transition = "";
      img.style.transform = "";
      if(horizontal && dx <= -50) viewerStep(1);
      else if(horizontal && dx >= 50) viewerStep(-1);
      dx = 0;
    }
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
  })();

  // ---------- Backup: export ----------
  var backup = { prepared: null, version: 0, saved: false };

  // Any edit makes a prepared file stale.
  function dataChanged(){
    backup.version++;
    if(backup.prepared){
      backup.prepared = null;
      backup.saved = false;
      renderBackupCard();
    }
  }
  function fmtStamp(ms){
    var w = C.wall(ms);
    return pad2(w.d) + "/" + pad2(w.m) + "/" + w.y + ", " + pad2(w.h) + ":" + pad2(w.mi);
  }
  function backupContents(c){
    var parts = [fmtInt(c.photos) + " ảnh", fmtInt(c.milestones) + " kỷ niệm"];
    if(typeof c.wishes === "number") parts.push(fmtInt(c.wishes) + " việc");
    if(typeof c.journal === "number") parts.push(fmtInt(c.journal) + " ngày nhật ký");
    if(typeof c.cycles === "number") parts.push(fmtInt(c.cycles) + " kỳ");
    if(c.images) parts.push(c.images === 1 ? "1 ảnh hồ sơ" : c.images + " ảnh hồ sơ");
    return parts.join(", ");
  }

  // Calendar days in VN time: "hôm nay, 21:30" / "31 ngày trước (01/09/2026)".
  function backupAgo(last){
    var days = C.todayIdx(now()) - C.todayIdx(last), w = C.wall(last);
    var date = pad2(w.d) + "/" + pad2(w.m) + "/" + w.y, time = pad2(w.h) + ":" + pad2(w.mi);
    if(days < 0) return { text: date, days: 0 };
    if(days === 0) return { text: "hôm nay, " + time, days: 0 };
    if(days === 1) return { text: "hôm qua, " + time, days: 1 };
    return { text: days + " ngày trước (" + date + ")", days: days };
  }

  function renderBackupCard(){
    var last = state.meta.lastBackupAt, p = backup.prepared, ago = last ? backupAgo(last) : null;
    $("backupLast").textContent = ago ? "Lần cuối: " + ago.text : "Chưa sao lưu lần nào";
    $("backupLast").classList.toggle("stale", !ago || ago.days >= 30);
    $("btnPrepare").hidden = !!p;
    $("btnPrepare").disabled = !!busy;
    $("btnSaveBackup").hidden = !p;
    if(p) $("btnSaveBackup").textContent = "Lưu file (" + fmtMB(p.size) + ")";
    $("fileImport").disabled = !!busy;
    $("importLabel").classList.toggle("is-busy", !!busy);
    if(busy !== "backup"){
      $("backupStatus").textContent = p
        ? (backup.saved ? "Đã lưu ✓ " : "") + p.name + " · " + backupContents(p.counts)
        : "File .zip gồm hồ sơ, kỷ niệm, việc muốn làm, nhật ký, chu kỳ và ảnh · iPhone: chọn “Lưu vào Tệp”.";
    }
  }

  function prepareBackup(onProgress){
    if(!state.db) return Promise.reject(userErr("Không mở được bộ nhớ trên máy nên chưa sao lưu, để không tạo ra một bản sao lưu trống. Hãy tải lại app."));
    var version = backup.version;
    busy = "backup";
    // An unreadable cycle, wish or journal record is left out of the file.
    return B.buildBackup({ profile: state.profile, milestones: state.milestones, photos: state.photos,
                           cycles: state.cyclesBroken || !C.cycleStats ? null : state.cycles,
                           wishes: wishesLocked() ? null : state.wishes,
                           journal: journalLocked() ? null : state.journal, readBlob: readBlob },
                         now(), onProgress).then(function(r){
      busy = null;
      if(version === backup.version){ backup.prepared = r; backup.saved = false; }
      return r;
    }, function(err){ busy = null; throw err; });
  }

  // Must run synchronously inside the tap: Safari drops the user activation
  // after a long await and navigator.share() then throws NotAllowedError —
  // that's why preparing and saving are two separate buttons.
  // done(ok, message, "share" | "download")
  function shareFile(f, name, done){
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })){
        navigator.share({ files: [f] }).then(function(){ done(true, null, "share"); }, function(err){
          if(err && err.name === "AbortError") done(false, null);
          else done(false, "Không mở được bảng chia sẻ của máy (" + (err && err.name || "lỗi") + "). Hãy thử lại.");
        });
        return;
      }
    }catch(e){}
    var url = URL.createObjectURL(f);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking right away can abort the download on iOS Safari.
    setTimeout(function(){ URL.revokeObjectURL(url); }, 10000);
    done(true, null, "download");
  }
  function saveBackupFile(p, done){
    shareFile(p.file, p.name, function(ok, msg){
      if(ok) markBackedUp();
      done(ok, msg);
    });
  }
  function markBackedUp(){
    state.meta.lastBackupAt = now();
    backup.saved = true;
    saveMeta().then(renderBackupCard);
  }

  $("btnPrepare").addEventListener("click", function(){
    if(busy){ showError("backupError", "Đang có việc khác chạy. Hãy đợi xong rồi thử lại."); return; }
    showError("backupError", null);
    $("btnPrepare").disabled = true;
    prepareBackup(function(d, t){ $("backupStatus").textContent = "Đang chuẩn bị " + d + "/" + t + "…"; })
      .then(function(){ renderBackupCard(); }, function(err){
        renderBackupCard();
        showError("backupError", (err && err.userMessage) || "Không tạo được bản sao lưu. Hãy thử lại.");
      });
  });
  $("btnSaveBackup").addEventListener("click", function(){
    if(!backup.prepared) return;
    showError("backupError", null);
    saveBackupFile(backup.prepared, function(ok, msg){
      if(msg) showError("backupError", msg);
      renderBackupCard();
    });
  });

  // ---------- Share image ----------
  // Painted from what is already in memory (state.blobs); nothing here writes
  // to IndexedDB or marks the data as changed. The picture is always built
  // BEFORE the save button is enabled, so the tap can call navigator.share()
  // at once.
  var share = { mode: "days", milestone: null, template: null, size: "post", blob: null, file: null, url: null, seq: 0 };

  function shareSheetOpen(){ return $("shareSheet").classList.contains("open"); }
  function sharePressed(attr, value){
    Array.prototype.forEach.call(document.querySelectorAll("[" + attr + "]"), function(b){
      b.setAttribute("aria-pressed", b.getAttribute(attr) === value ? "true" : "false");
    });
  }
  // Drops the finished picture: results of an older run are ignored from here
  // on and the preview URL is released. A File already handed to the system
  // share sheet is its own object and stays valid.
  function resetShare(){
    share.seq++;
    if(share.url) URL.revokeObjectURL(share.url);
    share.url = null; share.blob = null; share.file = null;
    var img = $("sharePreview");
    img.removeAttribute("src");
    img.hidden = true;
    $("btnShareSave").disabled = true;
  }
  function openShare(mode, milestone){
    if(!S || !state.profile || !state.computed) return;
    share.mode = mode === "milestone" && milestone ? "milestone" : "days";
    share.milestone = share.mode === "milestone" ? milestone : null;
    if(!share.template) share.template = state.blobs.cover ? "cover" : "plain";
    openSheet("shareSheet");
    renderShare();
  }
  function renderShare(){
    resetShare();
    var seq = share.seq, box = $("shareBox"), img = $("sharePreview"), p = state.profile, ms = share.milestone;
    box.setAttribute("data-size", share.size);
    sharePressed("data-share-tpl", share.template);
    sharePressed("data-share-size", share.size);
    placeSegPill($("shareTplSeg"));
    placeSegPill($("shareSizeSeg"));
    showError("shareError", null);
    img.alt = "Ảnh chia sẻ: " + (ms ? ms.title + ", " + fmtDate(ms.date) : fmtInt(state.computed.n) + " ngày bên nhau");
    if(busy){
      box.classList.remove("is-loading");
      showError("shareError", "Đang xử lý việc khác — đợi xong rồi thử lại.");
      return;
    }
    box.classList.add("is-loading");
    var name = ms ? "long-thu-ky-niem.jpg" : "long-thu-" + state.computed.n + "-ngay.jpg";
    var buf = function(id){ return state.blobs[id] ? state.blobs[id].data : null; };
    var src = { cover: buf("cover"), avatarLong: buf("avatar-long"), avatarThu: buf("avatar-thu") };
    var font = getComputedStyle(document.body).fontFamily + ',"Helvetica Neue",Arial,sans-serif';
    Promise.resolve().then(function(){
      var plan = S.plan({ template: share.template, size: share.size, mode: share.mode, n: state.computed.n, startDate: p.startDate,
                          names: [p.persons[0].name, p.persons[1].name],
                          has: { cover: !!src.cover, avatarLong: !!src.avatarLong, avatarThu: !!src.avatarThu }, milestone: ms }, S.measurer(font));
      return S.render(plan, src, font);
    }).then(function(blob){
      if(seq !== share.seq) return;
      share.blob = blob;
      share.file = new File([blob], name, { type: "image/jpeg" });
      share.url = URL.createObjectURL(blob);
      img.src = share.url;
      img.hidden = false;
      box.classList.remove("is-loading");
      $("btnShareSave").disabled = false;
    }, function(){
      if(seq !== share.seq) return;
      box.classList.remove("is-loading");
      showError("shareError", "Không tạo được ảnh. Hãy thử lại.");
    });
  }
  $("btnShare").addEventListener("click", function(){ openShare("days", null); });
  $("shareTplSeg").addEventListener("click", function(e){
    var b = e.target.closest("[data-share-tpl]");
    if(!b || b.getAttribute("data-share-tpl") === share.template) return;
    share.template = b.getAttribute("data-share-tpl");
    renderShare();
  });
  $("shareSizeSeg").addEventListener("click", function(e){
    var b = e.target.closest("[data-share-size]");
    if(!b || b.getAttribute("data-share-size") === share.size) return;
    share.size = b.getAttribute("data-share-size");
    renderShare();
  });
  // Synchronous inside the tap (see shareFile): the File was built when the
  // picture finished rendering.
  $("btnShareSave").addEventListener("click", function(){
    var f = share.file;
    if(!f) return;
    showError("shareError", null);
    shareFile(f, f.name, function(ok, msg, via){
      if(msg) showError("shareError", msg);
      else if(ok && via === "download") toast("Đã tải ảnh về máy ✓");
    });
  });

  // ---------- Backup: import ----------
  var imp = { phase: "idle", parsed: null, plan: null, mode: "merge", error: null, result: null, done: 0, total: 0, prepMsg: null, confirm: false };

  function localSnapshot(){
    var hasBlob = {};
    PHOTO_IDS.forEach(function(id){ hasBlob[id] = !!state.blobs[id]; });
    return {
      profileOk: !!(state.profile && state.profile.startStatus === "ok"),
      profile: state.profile, photos: state.photos, milestones: state.milestones, hasBlob: hasBlob,
      cycles: state.cycles, cyclesBad: state.cyclesBad, cyclesBroken: state.cyclesBroken, cyclesStamp: state.cyclesStamp,
      // An older cached core can't judge the list, so it counts as unreadable: never imported over.
      wishes: state.wishes, wishesBad: state.wishesBad, wishesBroken: wishesLocked(), wishesStamp: state.wishesStamp,
      journal: state.journal, journalBad: state.journalBad, journalBroken: journalLocked(), journalStamp: state.journalStamp
    };
  }
  function hasLocalData(){
    var l = localSnapshot();
    return l.profileOk || l.photos.length > 0 || l.milestones.length > 0 || l.cycles.length > 0 || l.cyclesBad.length > 0 || l.cyclesBroken ||
      l.wishes.length > 0 || l.wishesBad.length > 0 || l.wishesBroken || l.journal.length > 0 || l.journalBad.length > 0 || state.journalBroken;
  }

  function onImportFile(input){
    var f = input.files && input.files[0];
    input.value = "";
    if(!f) return;
    imp = { phase: "checking", parsed: null, plan: null, mode: "merge", error: null, result: null, done: 0, total: 0, prepMsg: null, confirm: false };
    if(busy){
      imp.phase = "error";
      imp.error = "Đang có việc khác chạy (thêm ảnh hoặc sao lưu). Hãy đợi xong rồi nhập lại.";
    } else if(state.loadFailed){
      imp.phase = "error";
      imp.error = "Chưa đọc được dữ liệu đang có trên máy nên chưa nhập, để không ghi đè lên nó. Hãy tải lại app rồi thử lại.";
    } else if(!state.db){
      imp.phase = "error";
      imp.error = "Không mở được bộ nhớ trên máy nên chưa nhập được. Hãy đóng các cửa sổ LoveDays khác rồi mở lại app.";
    }
    renderImport();
    openSheet("importSheet");
    if(imp.phase !== "checking") return;
    busy = "import";
    B.parseBackup(f, now()).then(function(parsed){
      imp.parsed = parsed;
      imp.plan = B.planMerge(parsed, localSnapshot(), now());
      imp.phase = "ready";
    }, function(err){
      imp.phase = "error";
      imp.error = (err && err.userMessage) || "Không đọc được file này.";
    }).then(function(){
      busy = null;
      renderImport();
      renderBackupCard();
    });
  }
  $("fileImport").addEventListener("change", function(){ onImportFile(this); });
  $("fileImportSetup").addEventListener("change", function(){ onImportFile(this); });

  function renderImport(){
    var el = $("importContent"), h = "";
    if(imp.phase === "checking"){
      h = '<p class="import-status">Đang kiểm tra file…</p>';
    } else if(imp.phase === "error"){
      h = '<div class="import-box import-error" role="alert"><p class="import-box-title">Không nhập được</p><p>' + escapeHtml(imp.error) +
        "</p><p>Dữ liệu hiện tại không bị thay đổi.</p></div>" +
        '<button type="button" class="btn btn-soft btn-block" data-imp="close">Đóng</button>';
    } else if(imp.phase === "importing"){
      h = '<p class="import-status" id="importProgress">' + importProgressText() + "</p>" +
        '<p class="card-hint">Đừng đóng app. Bị gián đoạn thì dữ liệu cũ vẫn nguyên — nhập lại là được.</p>';
    } else if(imp.phase === "done"){
      var r = imp.result;
      var what = fmtInt(r.addedPhotos) + " ảnh, " + fmtInt(r.addedMilestones) + " kỷ niệm" +
        (r.wishesInFile && !r.wishesKept ? ", " + fmtInt(r.addedWishes) + " việc" : "") +
        (r.journalInFile && !r.journalKept ? ", " + fmtInt(r.addedJournal) + " ngày nhật ký" : "") +
        (r.cyclesInFile && !r.cyclesKept ? ", " + fmtInt(r.addedCycles) + " kỳ" : "");
      // Merge can also fill missing avatars/cover — the preview counted them, so the result must too.
      var imgs = imp.mode !== "replace" && r.images ? ", " + fmtInt(r.images) + " ảnh hồ sơ" : "";
      var line = imp.mode === "replace" ? "Đã thay toàn bộ dữ liệu: " + what + "."
        : r.addedPhotos || r.addedMilestones || r.images || r.addedCycles || r.addedWishes || r.addedJournal ? "Đã thêm " + what + imgs + "." : "Không có ảnh hay kỷ niệm mới.";
      var jSkip = (r.skippedJournal || 0) + (r.clashedJournal || 0);
      h = '<div class="import-box import-ok" role="status"><p class="import-box-title">Đã nhập xong 💕</p><p>' + escapeHtml(line) + "</p>" +
        (r.profileKept ? "<p>Hồ sơ hiện tại giữ nguyên.</p>" : "") +
        (r.cyclesKept ? "<p>" + cyclesKeptText(r.cyclesInFile) + "</p>" : "") +
        (r.wishesKept ? "<p>" + wishesKeptText(r.wishesInFile) + "</p>" : "") +
        (r.journalKept ? "<p>" + journalKeptText(r.journalInFile) + "</p>" : "") +
        (r.skippedCycles + r.clashedCycles ? "<p>Bỏ qua " + fmtInt(r.skippedCycles + r.clashedCycles) + " kỳ trùng.</p>" : "") +
        (r.skippedWishes + r.clashedWishes ? "<p>Bỏ qua " + fmtInt(r.skippedWishes + r.clashedWishes) + " việc đã có hoặc trùng.</p>" : "") +
        (r.overWishes ? "<p>" + fmtInt(r.overWishes) + " việc không được thêm vì danh sách đã đủ " + fmtInt(C.MAX_WISHES) + " việc.</p>" : "") +
        (jSkip ? "<p>Bỏ qua " + fmtInt(jSkip) + " ngày nhật ký đã có trên máy hoặc trùng ngày.</p>" : "") +
        (r.overJournal ? "<p>" + fmtInt(r.overJournal) + " ngày nhật ký không được thêm vì nhật ký đã đủ " + fmtInt(C.MAX_JOURNAL) + " ngày.</p>" : "") + "</div>" +
        '<button type="button" class="btn btn-primary btn-block" data-imp="close">Xong</button>';
    } else if(imp.phase === "ready"){
      h = renderImportReady();
    }
    el.innerHTML = h;
    placeSegPill(el.querySelector(".segmented"), true);
  }

  // Why an import left the device's cycle log alone.
  function cyclesKeptText(inFile){
    return inFile ? "Dữ liệu chu kỳ trên máy đang không đọc được nên được giữ nguyên."
      : "Chu kỳ đã ghi trên máy giữ nguyên (bản sao lưu này không có).";
  }

  function wishesKeptText(inFile){
    return inFile ? "Danh sách việc muốn làm trên máy đang không đọc được nên được giữ nguyên."
      : "Việc muốn làm trên máy giữ nguyên (bản sao lưu này không có).";
  }

  function journalKeptText(inFile){
    return inFile ? "Nhật ký trên máy đang không đọc được nên được giữ nguyên."
      : "Nhật ký trên máy giữ nguyên (bản sao lưu này không có).";
  }

  function importProgressText(){
    return imp.total ? "Đang nhập " + imp.done + "/" + imp.total + "…" : "Đang nhập…";
  }

  function renderImportReady(){
    var ps = imp.parsed, pl = imp.plan, local = localSnapshot();
    var when = ps.exportedAt ? "Bản sao lưu ngày " + fmtStamp(ps.exportedAt) : "Bản sao lưu";
    var imgs = Object.keys(ps.images).length;
    var h = '<div class="import-summary"><p class="import-when">' + escapeHtml(when) + "</p><ul>" +
      "<li>" + fmtInt(ps.photos.length) + " ảnh · " + fmtInt(ps.milestones.length) + " kỷ niệm" + (ps.wishes ? " · " + fmtInt(ps.wishes.length) + " việc" : "") +
      (ps.journal ? " · " + fmtInt(ps.journal.length) + " ngày nhật ký" : "") +
      (ps.cycles ? " · " + fmtInt(ps.cycles.length) + " kỳ" : "") +
      (imgs ? " · " + imgs + " ảnh hồ sơ" : "") + "</li>" +
      (ps.cyclesSkipped ? "<li>Bỏ qua " + fmtInt(ps.cyclesSkipped) + " kỳ trùng trong file</li>" : "") +
      (ps.wishesSkipped ? "<li>Bỏ qua " + fmtInt(ps.wishesSkipped) + " việc trùng trong file</li>" : "") +
      (ps.journalSkipped ? "<li>Bỏ qua " + fmtInt(ps.journalSkipped) + " ngày nhật ký trùng trong file</li>" : "") +
      "<li>" + escapeHtml(ps.profile.persons[0].name) + " ♥ " + escapeHtml(ps.profile.persons[1].name) + " · từ " + fmtDate(ps.profile.startDate) + "</li>" +
      "</ul></div>";
    if(!hasLocalData()){
      return h + '<p class="card-text">Máy này chưa có dữ liệu — toàn bộ nội dung bản sao lưu sẽ được nhập.</p>' +
        '<button type="button" class="btn btn-primary btn-block" data-imp="run">Nhập bản sao lưu</button>';
    }
    h += '<div class="segmented import-mode" role="group" aria-label="Cách nhập">' +
      '<button type="button" class="seg-btn" data-imp="mode-merge" aria-pressed="' + (imp.mode === "merge") + '">Gộp (khuyên dùng)</button>' +
      '<button type="button" class="seg-btn" data-imp="mode-replace" aria-pressed="' + (imp.mode === "replace") + '">Thay thế</button></div>';
    if(imp.mode === "merge"){
      // Merge only takes avatars/cover the device doesn't have yet.
      var fillImgs = Object.keys(ps.images).filter(function(id){ return !local.hasBlob[id]; }).length;
      var skipped = pl.skipPhotos + pl.skipMilestones + pl.skipCycles + pl.skipWishes + (pl.skipJournal || 0);
      // The device's cycle record is unreadable: the file's cycles are not imported, and must not be reported as "already here".
      var cyBlocked = !!ps.cycles && local.cyclesBroken;
      var wiBlocked = !!ps.wishes && local.wishesBroken;
      var joBlocked = !!ps.journal && local.journalBroken;
      var blockedNote = (cyBlocked ? '<p class="card-text">Chu kỳ trong bản sao lưu không được nhập vì sổ chu kỳ trên máy đang không đọc được.</p>' : "") +
        (wiBlocked ? '<p class="card-text">Việc muốn làm trong bản sao lưu không được nhập vì danh sách trên máy đang không đọc được.</p>' : "") +
        (joBlocked ? '<p class="card-text">Nhật ký trong bản sao lưu không được nhập vì nhật ký trên máy đang không đọc được.</p>' : "");
      if(!pl.addPhotos && !pl.addMilestones && !pl.addCycles && !pl.addWishes && !pl.addJournal && !fillImgs && local.profileOk){
        var kinds = ["ảnh", "kỷ niệm"];
        if(ps.wishes && !wiBlocked) kinds.push("việc muốn làm");
        if(ps.journal && !joBlocked) kinds.push("ngày nhật ký");
        if(ps.cycles && !cyBlocked) kinds.push("kỳ");
        return h + '<p class="card-text">Không có gì mới — mọi ' + kinds.slice(0, -1).join(", ") + " và " + kinds[kinds.length - 1] + ' đã có trên máy. Hồ sơ hiện tại giữ nguyên.</p>' + blockedNote +
          '<button type="button" class="btn btn-soft btn-block" data-imp="close">Đóng</button>';
      }
      var adds = [fmtInt(pl.addPhotos) + " ảnh", fmtInt(pl.addMilestones) + " kỷ niệm"];
      if(ps.wishes && !wiBlocked) adds.push(fmtInt(pl.addWishes) + " việc");
      if(ps.journal && !joBlocked) adds.push(fmtInt(pl.addJournal) + " ngày nhật ký");
      if(ps.cycles && !cyBlocked) adds.push(fmtInt(pl.addCycles) + " kỳ");
      if(fillImgs) adds.push(fillImgs + " ảnh hồ sơ còn thiếu");
      h += '<p class="card-text">' + escapeHtml("Sẽ thêm " + adds.join(", ") + (skipped ? " (" + fmtInt(skipped) + (pl.skipCycles || pl.skipJournal ? " đã có hoặc trùng ngày, bỏ qua)" : " đã có, bỏ qua)") : "") + ". " +
        (pl.overWishes ? fmtInt(pl.overWishes) + " việc không được thêm vì danh sách chỉ chứa " + fmtInt(C.MAX_WISHES) + " việc. " : "") +
        (pl.overJournal ? fmtInt(pl.overJournal) + " ngày nhật ký không được thêm vì nhật ký chỉ chứa " + fmtInt(C.MAX_JOURNAL) + " ngày. " : "") +
        (local.profileOk ? "Hồ sơ hiện tại giữ nguyên." : "Hồ sơ lấy từ bản sao lưu.")) + "</p>" + blockedNote +
        '<button type="button" class="btn btn-primary btn-block" data-imp="run">Gộp vào dữ liệu hiện tại</button>';
      return h;
    }
    var p = backup.prepared;
    h += '<div class="import-box import-warn"><p class="import-box-title">Toàn bộ dữ liệu hiện tại sẽ bị xoá</p><p>' +
      fmtInt(local.photos.length) + " ảnh, " + local.milestones.length + " kỷ niệm, " + (replacesWishes(ps, local) ? local.wishes.length + " việc, " : "") +
      (replacesJournal(ps, local) ? fmtInt(local.journal.length) + " ngày nhật ký, " : "") +
      (replacesCycles(ps, local) ? local.cycles.length + " kỳ, " : "") +
      "hồ sơ và ảnh đại diện trên máy này sẽ bị thay.</p>" +
      (keepsCycles(ps, local) ? "<p>" + cyclesKeptText(!!ps.cycles) + "</p>" : "") +
      (keepsWishes(ps, local) ? "<p>" + wishesKeptText(!!ps.wishes) + "</p>" : "") +
      (keepsJournal(ps, local) ? "<p>" + journalKeptText(!!ps.journal) + "</p>" : "") + "</div>" +
      '<p class="import-step">Bước 1 · Sao lưu dữ liệu hiện tại trước</p>';
    if(busy === "backup") h += '<p class="import-status" id="importPrep">' + escapeHtml(imp.prepMsg || "Đang chuẩn bị…") + "</p>";
    else if(!p) h += '<button type="button" class="btn btn-soft btn-block" data-imp="prep">Chuẩn bị bản sao lưu hiện tại</button>';
    else h += '<button type="button" class="btn btn-soft btn-block" data-imp="save">' + (backup.saved ? "Đã lưu ✓ · Lưu lần nữa" : "Lưu file (" + fmtMB(p.size) + ")") + "</button>";
    if(imp.prepMsg && busy !== "backup") h += '<p class="form-error">' + escapeHtml(imp.prepMsg) + "</p>";
    h += '<p class="import-step">Bước 2 · Thay thế</p>';
    if(imp.confirm && !busy){
      h += '<div class="confirm-row" id="impConfirm"><p class="confirm-text">' + escapeHtml(replaceAskText(ps, local)) + "</p>" +
        (backup.saved ? "" : '<p class="confirm-note">Bạn chưa lưu bản sao lưu dữ liệu hiện tại — thay xong sẽ không lấy lại được.</p>') +
        '<div class="confirm-btns"><button type="button" class="btn btn-danger-solid" data-imp="run-yes">Thay thế</button>' +
        '<button type="button" class="btn btn-ghost" data-imp="run-no">Giữ lại</button></div></div>';
    } else {
      h += '<button type="button" class="btn btn-danger btn-block" data-imp="run"' + (busy ? " disabled" : "") + ">Thay thế bằng bản sao lưu</button>";
    }
    return h;
  }
  function replaceAskText(ps, l){
    return "Xoá " + fmtInt(l.photos.length) + " ảnh, " + l.milestones.length + " kỷ niệm" + (replacesWishes(ps, l) ? ", " + l.wishes.length + " việc" : "") +
      (replacesJournal(ps, l) ? ", " + fmtInt(l.journal.length) + " ngày nhật ký" : "") +
      (replacesCycles(ps, l) ? ", " + l.cycles.length + " kỳ" : "") + " và hồ sơ hiện tại, thay bằng bản sao lưu?";
  }

  // Mirrors planCycles() in love-days-backup.js for the "Thay thế" wording.
  function replacesCycles(ps, local){ return !!ps.cycles && !local.cyclesBroken; }
  function keepsCycles(ps, local){
    return ps.cycles ? local.cyclesBroken : local.cycles.length > 0 || local.cyclesBad.length > 0 || local.cyclesBroken;
  }

  // Mirror planWishes() the same way.
  function replacesWishes(ps, local){ return !!ps.wishes && !local.wishesBroken; }
  function keepsWishes(ps, local){
    return ps.wishes ? local.wishesBroken : local.wishes.length > 0 || local.wishesBad.length > 0 || local.wishesBroken;
  }

  // And planJournal().
  function replacesJournal(ps, local){ return !!ps.journal && !local.journalBroken; }
  function keepsJournal(ps, local){
    return ps.journal ? local.journalBroken : local.journal.length > 0 || local.journalBad.length > 0 || local.journalBroken;
  }

  $("importContent").addEventListener("click", function(e){
    var b = e.target.closest("[data-imp]");
    if(!b || b.disabled) return;
    var act = b.getAttribute("data-imp");
    // The red row only stands while nothing else was touched since "Thay thế bằng bản sao lưu".
    var asked = imp.confirm;
    imp.confirm = false;
    if(act === "close"){ closeSheets(); return; }
    if(act === "mode-merge" || act === "mode-replace"){ imp.mode = act === "mode-merge" ? "merge" : "replace"; renderImport(); return; }
    if(act === "prep"){
      if(busy) return;
      imp.prepMsg = null;
      prepareBackup(function(d, t){
        imp.prepMsg = "Đang chuẩn bị " + d + "/" + t + "…";
        var el = $("importPrep");
        if(el) el.textContent = imp.prepMsg;
      }).then(function(){ imp.prepMsg = null; }, function(err){
        imp.prepMsg = (err && err.userMessage) || "Không tạo được bản sao lưu.";
      }).then(function(){ renderImport(); renderBackupCard(); });
      renderImport();
      return;
    }
    if(act === "save"){
      if(!backup.prepared) return;
      saveBackupFile(backup.prepared, function(ok, msg){
        imp.prepMsg = msg || null;
        renderImport();
        renderBackupCard();
      });
      return;
    }
    if(act === "run-no"){
      renderImport();
      var again = $("importContent").querySelector('[data-imp="run"]');
      if(again) again.focus({ preventScroll: true });
      return;
    }
    if(act === "run-yes"){ if(asked) runImport(); return; }
    if(act === "run"){
      if(busy || !imp.parsed) return;
      if(imp.mode !== "replace" || !hasLocalData()){ runImport(); return; }
      imp.confirm = true;
      renderImport();
      var row = $("impConfirm");
      if(row){
        row.querySelector('[data-imp="run-no"]').focus({ preventScroll: true });
        row.scrollIntoView({ block: "nearest" });
      }
    }
  });

  function runImport(){
    if(busy || !imp.parsed) return;
    var mode = hasLocalData() ? imp.mode : "merge";
    busy = "import";
    imp.mode = mode;
    imp.phase = "importing";
    imp.done = 0; imp.total = 0;
    renderImport();
    B.importBackup({
      db: state.db, parsed: imp.parsed, mode: mode, local: localSnapshot(), nowMs: now(),
      onProgress: function(d, t){
        imp.done = d; imp.total = t;
        var el = $("importProgress");
        if(el) el.textContent = importProgressText();
      }
    }).then(function(res){
      imp.result = res;
      imp.phase = "done";
      imp.parsed = null;
      requestPersist();
      return reloadAll();
    }, function(err){
      imp.phase = "error";
      imp.error = (err && err.userMessage) || "Không ghi được dữ liệu vào máy.";
    }).then(function(){
      busy = null;
      dataChanged();
      renderImport();
      renderBackupCard();
    });
  }

  function reloadAll(){
    closeViewer();
    releaseAlbumThumbs();
    releaseTl();
    Object.keys(state.urls).forEach(function(k){ if(state.urls[k]) URL.revokeObjectURL(state.urls[k]); });
    state.urls = {}; state.blobs = {}; state.photos = []; state.milestones = []; state.profile = null;
    state.cycles = []; state.cyclesBad = []; state.cyclesBroken = false; state.cyclesStamp = null;
    state.wishes = []; state.wishesBad = []; state.wishesBroken = false; state.wishesStamp = null;
    state.journal = []; state.journalBad = []; state.journalBroken = false; state.journalStamp = null;
    setBanner("skipped", null);
    setBanner("load", null);
    state.loadFailed = false;
    return loadAll().catch(function(){ state.loadFailed = true; }).then(render);
  }

  // ---------- Storage info + diagnostics ----------
  function fmtMB(bytes){ return (bytes / 1048576).toFixed(1).replace(".", ",") + " MB"; }
  function fmtSize(bytes){
    var mb = bytes / 1048576;
    return mb >= 1024 ? (mb / 1024).toFixed(1).replace(".", ",") + " GB" : fmtMB(bytes);
  }
  var storageFacts = { usage: null, quota: null, persisted: null };

  function requestPersist(){
    try{
      if(navigator.storage && navigator.storage.persist){
        navigator.storage.persist().then(refreshStorage, function(){});
      }
    }catch(e){}
  }

  function refreshStorage(){
    var s = navigator.storage;
    var pEst = s && s.estimate ? s.estimate().catch(function(){ return null; }) : Promise.resolve(null);
    var pPer = s && s.persisted ? s.persisted().catch(function(){ return null; }) : Promise.resolve(null);
    Promise.all([pEst, pPer]).then(function(r){
      storageFacts.usage = r[0] ? r[0].usage : null;
      storageFacts.quota = r[0] ? r[0].quota : null;
      storageFacts.persisted = r[1];
      var parts = [];
      parts.push(storageFacts.usage != null
        ? "Bộ nhớ: " + fmtSize(storageFacts.usage) + (storageFacts.quota ? " / " + fmtSize(storageFacts.quota) : "")
        : "Bộ nhớ: không rõ dung lượng");
      if(r[1] === true) parts.push("Bền vững: đã bật ✓");
      else if(r[1] === false) parts.push("Bền vững: chưa bật — máy có thể xoá khi đầy");
      if(state.db === null) parts.push("Đang chạy tạm trong bộ nhớ: dữ liệu sẽ mất khi đóng app.");
      $("storageInfo").innerHTML = parts.map(escapeHtml).join("<br>");
      renderDiag();
    });
  }

  function renderDiag(){
    var probe = getComputedStyle($("safeProbe"));
    var standalone = navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    var bar = $("tabbar").getBoundingClientRect();
    $("diagLine").textContent = [
      "standalone " + (standalone ? "có" : "không"),
      "thông báo " + (typeof Notification === "undefined" ? "không hỗ trợ" : Notification.permission),
      "setAppBadge " + ("setAppBadge" in navigator ? "có" : "không"),
      "push " + (!pushSupported() ? "không hỗ trợ" : currentSub() ? "đã đăng ký" : "chưa đăng ký"),
      "màn hình " + screen.height + " / viewport " + window.innerHeight,
      "safe-area " + parseFloat(probe.paddingTop) + "/" + parseFloat(probe.paddingBottom),
      "tabbar đáy " + Math.round(bar.bottom),
      "bộ nhớ " + (storageFacts.usage != null ? fmtMB(storageFacts.usage) : "?") + (storageFacts.persisted === true ? " (bền vững)" : storageFacts.persisted === false ? " (chưa bền vững)" : ""),
      "IndexedDB " + (state.db ? "OK" : "tạm thời")
    ].join(" · ");
  }

  // ---------- Daily notifications + icon number ----------
  // The page only subscribes and shows the subscription JSON; the daily push
  // comes from .github/workflows/love-days-push.yml and the SW computes N from
  // this device's own start date when it arrives.
  var push = { reg: null, sub: null, busy: false, key: undefined,
               rec: { key: "push", deviceLabel: "", lastCopiedEndpointHash: null } };
  var PUSH_ICON = "/products/love-days/img/love-days-icon-180.png";

  function isStandalone(){
    return navigator.standalone === true || !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  }
  function pushSupported(){
    return "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
  }
  function vapidKey(){
    if(push.key !== undefined) return push.key;
    push.key = null;
    try{
      var s = VAPID_PUBLIC_KEY;
      var bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
      var u8 = new Uint8Array(bin.length);
      for(var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      if(u8.length === 65 && u8[0] === 4) push.key = u8;
    }catch(e){}
    return push.key;
  }
  function keyMatches(sub, key){
    var k = sub && sub.options && sub.options.applicationServerKey;
    if(!k) return true;
    var a = new Uint8Array(k);
    if(a.length !== key.length) return false;
    for(var i = 0; i < a.length; i++) if(a[i] !== key[i]) return false;
    return true;
  }
  function currentSub(){
    var key = vapidKey();
    return push.sub && key && keyMatches(push.sub, key) ? push.sub : null;
  }
  // Only compared with itself, so a short non-crypto hash is enough.
  function endpointHash(s){
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for(var i = 0; i < s.length; i++){
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519) >>> 0;
    }
    return ("0000000" + h1.toString(16)).slice(-8) + ("0000000" + h2.toString(16)).slice(-8);
  }
  function pushLabel(){ return $("pushLabel").value.trim().slice(0, 40) || "iPhone"; }
  function subJson(sub){
    var j = sub.toJSON();
    return JSON.stringify({ label: pushLabel(), endpoint: j.endpoint, expirationTime: j.expirationTime == null ? null : j.expirationTime, keys: j.keys });
  }
  function userErr(msg){ var e = new Error(msg); e.userMessage = msg; return e; }
  function savePushRec(){ return put("kv", push.rec).catch(function(){}); }

  function loadPushRec(){
    var p = state.db ? C.idbGet(state.db, "kv", "push").catch(function(){ return null; }) : Promise.resolve(mem.kv.push || null);
    return p.then(function(r){
      if(!r || typeof r !== "object") return;
      if(typeof r.deviceLabel === "string" && r.deviceLabel.length <= 40) push.rec.deviceLabel = r.deviceLabel;
      if(typeof r.lastCopiedEndpointHash === "string" && /^[0-9a-f]{16}$/.test(r.lastCopiedEndpointHash)) push.rec.lastCopiedEndpointHash = r.lastCopiedEndpointHash;
    });
  }

  // Never waits forever: `ready` doesn't settle when the SW failed to install.
  function swReady(){
    if(push.reg) return Promise.resolve(push.reg);
    return new Promise(function(resolve, reject){
      var t = setTimeout(function(){ reject(userErr("App chưa sẵn sàng chạy nền. Hãy đóng hẳn app, mở lại rồi thử lại.")); }, 8000);
      navigator.serviceWorker.ready.then(function(reg){ clearTimeout(t); push.reg = reg; resolve(reg); });
    });
  }

  function refreshSub(){
    if(!pushSupported()) return Promise.resolve();
    return navigator.serviceWorker.getRegistration("/products/love-days/").then(function(reg){
      if(!reg) return;
      push.reg = reg;
      return reg.pushManager.getSubscription().then(function(sub){ push.sub = sub; });
    }).catch(function(){});
  }

  function renderPush(){
    var perm = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    var key = vapidKey(), sub = currentSub();
    var status = "", ok = false, warn = false, canEnable = false;
    if(!VAPID_PUBLIC_KEY){
      status = "Chưa cấu hình khoá thông báo";
    } else if(!key){
      status = "Khoá thông báo không hợp lệ (VAPID_PUBLIC_KEY).";
      warn = true;
    } else if(!pushSupported() || !isStandalone()){
      status = "Chỉ bật được khi mở từ icon Màn hình chính (iOS 16.4+).";
    } else if(perm === "denied"){
      status = "Đã chặn — bật lại ở Cài đặt iPhone → Thông báo → Long & Thư.";
      warn = true;
    } else if(sub){
      ok = true;
      status = "Đã bật ✓ Nhớ sao chép mã vào secret.";
    } else {
      canEnable = true;
      status = perm === "granted" ? "Đã cho phép, chưa có mã — chạm “Bật thông báo”." : "Chưa bật trên máy này";
    }
    if($("pushStatus").textContent !== status) $("pushStatus").textContent = status;
    $("pushStatus").classList.toggle("ok", ok);
    $("pushStatus").classList.toggle("warn", warn);
    // Without a key nothing can be enabled, so hide the controls for it.
    $("pushLabelField").hidden = !key;
    $("btnPushEnable").hidden = ok || !key;
    $("btnPushEnable").disabled = !canEnable || push.busy;
    $("btnPushEnable").textContent = push.busy ? "Đang bật…" : "Bật thông báo";
    $("btnPushTest").disabled = typeof Notification === "undefined" || perm === "denied" || !("serviceWorker" in navigator) || !state.computed;
    // "denied" is already explained by the status tag.
    var testWhy = typeof Notification === "undefined" ? "Mở app từ icon Màn hình chính để gửi thử." : "";
    var testNote = $("pushTestNote");
    if(testWhy){
      if(testNote.textContent !== testWhy) testNote.textContent = testWhy;
      testNote.hidden = false;
      testNote.dataset.why = "1";
    } else if(testNote.dataset.why){
      testNote.hidden = true;
      testNote.textContent = "";
      delete testNote.dataset.why;
    }
    $("pushSubBox").hidden = !sub;
    if(sub) $("pushSubJson").value = subJson(sub);
  }

  // ---------- Reminders in the morning notification (kv meta dayRemind) ----------
  // The same call the service worker makes when the push arrives, on the same records.
  function dayRemindLines(){
    if(!C.dayReminders || !C.dayReminderLines || !state.profile) return [];
    return C.dayReminderLines(C.dayReminders(state.profile, state.milestones, wishesLocked() ? null : state.wishes, now()), C.REMIND_MAX_LINES);
  }
  // For "Gửi thử" on a day with nothing due: the nearest thing ahead, worded like a real line.
  function dayRemindExample(){
    var best = null;
    if(!C.dayReminderLines) return [];
    ((state.computed && state.computed.list) || []).forEach(function(x){
      if(x.daysLeft > 0 && (!best || x.daysLeft < best.daysLeft)) best = { emoji: x.emoji, title: x.title, daysLeft: x.daysLeft };
    });
    var w = wishesLocked() ? null : C.wishView(state.wishes, now()).nearest;
    if(w && w.daysLeft > 0 && (!best || w.daysLeft < best.daysLeft)) best = { emoji: wishEmoji(w.cat), title: w.title, daysLeft: w.daysLeft };
    return best ? C.dayReminderLines([best], 1) : [];
  }
  function renderDayRemind(){
    // An older cached love-days-core.js can be paired with this page offline.
    var ok = !!(C.dayReminders && C.dayReminderLines && C.pushBody), on = state.meta.dayRemind !== false;
    $("dayRemindBox").hidden = !ok;
    if(!ok) return;
    $("dayRemind").checked = on;
    var lines = on && state.mode === "app" ? dayRemindLines() : null, pre = $("dayRemindPreview");
    var text = !lines ? "" : lines.length ? "Sáng nay sẽ nhắc: " + lines.join(" · ") : "Sáng nay không có gì để nhắc.";
    if(pre.textContent !== text) pre.textContent = text;
    pre.hidden = !text;
  }
  $("dayRemind").addEventListener("change", function(){
    state.meta.dayRemind = this.checked;
    saveMeta();
    renderDayRemind();
  });

  function checkPushChanged(){
    var stored = push.rec.lastCopiedEndpointHash;
    if(!stored || !vapidKey() || !pushSupported()){ setBanner("push", null); return; }
    var sub = currentSub();
    var changed = !sub || endpointHash(sub.endpoint) !== stored;
    // No subscription at all may simply mean the user turned notifications
    // off on purpose — let them say so, which forgets the stored hash.
    var dismiss = sub ? null : { label: "Tôi đã tắt thông báo", run: function(){
      push.rec.lastCopiedEndpointHash = null;
      savePushRec();
      setBanner("push", null);
    } };
    setBanner("push", changed ? "Mã đăng ký thông báo của máy này đã đổi — cần cập nhật secret. Xem Cài đặt → Thông báo." : null, "warn", dismiss);
  }

  function initPush(){
    return loadPushRec().then(function(){
      $("pushLabel").value = push.rec.deviceLabel;
      return refreshSub();
    }).then(function(){
      renderPush();
      checkPushChanged();
    }).catch(function(){});
  }

  $("pushLabel").addEventListener("input", function(){
    var sub = currentSub();
    if(sub) $("pushSubJson").value = subJson(sub);
  });
  $("pushLabel").addEventListener("change", function(){
    push.rec.deviceLabel = $("pushLabel").value.trim().slice(0, 40);
    savePushRec();
  });

  // requestPermission() must be the first thing in the tap (iOS only shows
  // the prompt during a user gesture).
  $("btnPushEnable").addEventListener("click", function(){
    var key = vapidKey();
    if(push.busy || !key || !pushSupported()) return;
    showError("pushError", null);
    var permP = Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
    push.busy = true;
    renderPush();
    Promise.resolve(permP).then(function(perm){
      if(perm !== "granted") throw userErr(perm === "denied" ? "" : "Chưa được cho phép thông báo. Hãy chạm lại và chọn Cho phép.");
      return swReady();
    }).then(function(reg){
      return reg.pushManager.getSubscription().then(function(old){
        if(old && keyMatches(old, key)) return old;
        // A subscription made with another VAPID key can't be reused:
        // subscribe() would throw InvalidStateError.
        return (old ? old.unsubscribe().catch(function(){}) : Promise.resolve()).then(function(){
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        });
      });
    }).then(function(sub){
      push.sub = sub;
      push.rec.deviceLabel = $("pushLabel").value.trim().slice(0, 40);
      savePushRec();
      updateBadge();
    }).catch(function(err){
      showError("pushError", err && typeof err.userMessage === "string" ? err.userMessage : "Không bật được thông báo (" + (err && err.name || "lỗi") + "). Hãy thử lại.");
    }).then(function(){
      push.busy = false;
      renderPush();
      checkPushChanged();
      renderDiag();
    });
  });

  $("btnPushCopy").addEventListener("click", function(){
    var sub = currentSub();
    if(!sub) return;
    var ta = $("pushSubJson"), txt = subJson(sub);
    ta.value = txt;
    function done(msg){
      push.rec.lastCopiedEndpointHash = endpointHash(sub.endpoint);
      push.rec.deviceLabel = $("pushLabel").value.trim().slice(0, 40);
      savePushRec();
      checkPushChanged();
      $("pushCopyNote").textContent = msg;
    }
    function fallback(){
      ta.focus();
      ta.select();
      try{ ta.setSelectionRange(0, txt.length); }catch(e){}
      var ok = false;
      try{ ok = document.execCommand("copy"); }catch(e){}
      done(ok ? "Đã sao chép ✓ Dán vào secret cùng mã máy kia." : "Không tự sao chép được — mã đã được bôi đen, hãy chạm giữ rồi chọn Sao chép.");
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){
        done("Đã sao chép ✓ Dán vào secret cùng mã máy kia.");
      }, fallback);
    } else fallback();
  });

  $("btnPushTest").addEventListener("click", function(){
    if(typeof Notification === "undefined" || !state.computed) return;
    showError("pushError", null);
    var note = $("pushTestNote"), example = false;
    note.hidden = true;
    var permP = Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
    Promise.resolve(permP).then(function(perm){
      if(perm !== "granted") throw userErr(perm === "denied" ? "" : "Cần cho phép thông báo thì mới gửi thử được.");
      return swReady();
    }).then(function(reg){
      var n = state.computed.n;
      // The only way to see the reminder line on a real phone without waiting for the day.
      var remind = state.meta.cycleRemind && C.reminderLine
        ? C.reminderLine({ daysLeft: state.meta.cycleRemind }, state.meta.cycleRemindQuiet !== false) : "";
      var body = "Thông báo thử trên máy này — hôm nay là ngày thứ " + fmtInt(n) + " Long & Thư yêu nhau";
      if(C.pushBody){
        var lines = [];
        if(state.meta.dayRemind !== false){
          lines = dayRemindLines();
          if(!lines.length){ lines = dayRemindExample(); example = lines.length > 0; }
        }
        body = C.pushBody(body, remind, lines);
      } else if(remind) body += "\n" + remind;
      return reg.showNotification("💕 Ngày thứ " + fmtInt(n), { body: body, tag: "love-days-test", icon: PUSH_ICON }).then(function(){ return n; });
    }).then(function(n){
      var badged = false;
      try{
        if("setAppBadge" in navigator){
          var r = navigator.setAppBadge(n);
          if(r && r.catch) r.catch(function(){});
          badged = true;
        }
      }catch(e){}
      note.textContent = "Đã gửi thử ✓ " + (badged ? "Icon hiện số " + fmtInt(n) + ". " : "Máy này không hỗ trợ số trên icon. ") +
        "Không thấy? Xem Cài đặt iPhone → Thông báo." + (example ? " Dòng nhắc trong bản thử là ví dụ từ mốc gần nhất." : "");
      note.hidden = false;
      renderPush();
      renderDiag();
    }).catch(function(err){
      showError("pushError", err && typeof err.userMessage === "string" ? err.userMessage : "Không gửi thử được (" + (err && err.name || "lỗi") + ").");
      renderPush();
    });
  });

  // ---------- Toast + segmented pill ----------
  var toastTimer = null, toastLater = null;
  function toast(msg){
    var t = $("toast");
    clearTimeout(toastTimer);
    clearTimeout(toastLater);
    // A live region only announces a change: the same text again is silent
    // unless it is emptied first and refilled on a later task.
    if(t.textContent === msg){
      t.textContent = "";
      toastLater = setTimeout(function(){ showToast(t, msg); }, 30);
    } else showToast(t, msg);
  }
  function showToast(t, msg){
    // In the viewer the bottom holds the caption just edited — show it up top.
    t.classList.toggle("over-viewer", viewer.open);
    t.textContent = msg;
    void t.offsetWidth; // the first toast leaves display:none (.toast:empty) — reflow so it slides in instead of popping
    t.classList.add("show");
    toastTimer = setTimeout(function(){
      t.classList.remove("show");
      // Emptied after the slide-out so VoiceOver can't reach a stale message.
      toastLater = setTimeout(function(){ if(!t.classList.contains("show")) t.textContent = ""; }, 250);
    }, 2500);
  }

  // One pill per segmented control, slid under the pressed button. Measure
  // only while visible: inside display:none every offsetWidth is 0.
  function placeSegPill(seg, instant){
    if(!seg) return;
    var pill = seg.querySelector(".seg-pill");
    if(!pill){
      pill = document.createElement("span");
      pill.className = "seg-pill";
      pill.setAttribute("aria-hidden", "true");
      seg.insertBefore(pill, seg.firstChild);
      instant = true;
    }
    var on = seg.querySelector('[aria-pressed="true"]');
    if(!on || !on.offsetWidth){ pill.style.opacity = "0"; return; }
    // Coming out of hiding the pill still holds its old position — sliding from there looks like a glitch.
    if(pill.style.opacity === "0") instant = true;
    if(instant) pill.classList.add("no-anim");
    pill.style.width = on.offsetWidth + "px";
    pill.style.transform = "translateX(" + on.offsetLeft + "px)";
    pill.style.opacity = "";
    if(instant){ void pill.offsetWidth; pill.classList.remove("no-anim"); }
  }
  window.addEventListener("resize", function(){
    Array.prototype.forEach.call(document.querySelectorAll(".segmented"), function(seg){ placeSegPill(seg, true); });
  });

  // ---------- Sheets ----------
  var sheetOpener = null;
  function openSheet(id){
    var a = document.activeElement;
    if(!document.querySelector(".sheet.open")) sheetOpener = a && a !== document.body ? a : null;
    $(id).classList.add("open");
    showBackdrop($("sheetBackdrop"));
    // The close button rather than the first field: focusing an input would
    // pop the iPhone keyboard over the sheet.
    $(id).querySelector("[data-close-sheet]").focus({ preventScroll: true });
  }
  // A closed sheet stops taking taps at once, so the second tap of a double tap on "Lưu" used to
  // land on the tab or row underneath. Only a real tap at the same spot is held back — a tap
  // somewhere else right after closing, a key press (detail 0) and code calling .click() go through.
  var sheetQuiet = null, lastTap = null;
  document.addEventListener("click", function(e){
    if(!e.isTrusted || !e.detail) return;
    if(sheetQuiet && Math.abs(e.clientX - sheetQuiet.x) < 48 && Math.abs(e.clientY - sheetQuiet.y) < 48){
      e.stopPropagation(); e.preventDefault();
      return;
    }
    lastTap = { x: e.clientX, y: e.clientY, at: Date.now() };
  }, true);
  function closeSheets(){
    if(imp.phase === "importing") return;
    var open = document.querySelectorAll(".sheet.open");
    if(!open.length) return;
    if(shareSheetOpen()) resetShare();
    if(msSheetOpen()){ pendingWishId = null; setTimeout(cleanMsSheet, 300); }
    Array.prototype.forEach.call(open, function(s){ s.classList.remove("open"); });
    hideBackdrop($("sheetBackdrop"));
    // The save behind a tap on "Lưu" is asynchronous, so the tap that closed the sheet can be a moment old.
    if(lastTap && Date.now() - lastTap.at < 700){
      var spot = sheetQuiet = lastTap;
      setTimeout(function(){ if(sheetQuiet === spot) sheetQuiet = null; }, 500);
    }
    var back = sheetOpener;
    sheetOpener = null;
    if(back && document.contains(back) && back.getClientRects().length) back.focus({ preventScroll: true });
  }
  $("sheetBackdrop").addEventListener("click", closeSheets);
  Array.prototype.forEach.call(document.querySelectorAll("[data-close-sheet]"), function(b){ b.addEventListener("click", closeSheets); });
  document.addEventListener("keydown", function(e){
    if(dp.open){ onDatePickerKey(e); return; }
    if(viewer.open){ onViewerKey(e); return; }
    var sheet = document.querySelector(".sheet.open");
    if(!sheet) return;
    if(e.key === "Escape"){
      if(msDraft.pick && sheet.id === "milestoneSheet") leavePick(); else closeSheets();
    } else trapTab(sheet, e);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".sheet"), function(sheet){
    var handle = sheet.querySelector(".sheet-handle-hit");
    var startY = 0, currentY = 0, dragging = false;
    handle.addEventListener("pointerdown", function(e){
      dragging = true; currentY = 0; startY = e.clientY;
      sheet.style.transition = "none";
      try{ handle.setPointerCapture(e.pointerId); }catch(err){}
    });
    handle.addEventListener("pointermove", function(e){
      if(!dragging) return;
      currentY = Math.max(0, e.clientY - startY);
      sheet.style.transform = "translateY(" + currentY + "px)";
    });
    function endDrag(){
      if(!dragging) return;
      dragging = false;
      sheet.style.transition = "";
      sheet.style.transform = "";
      if(currentY > 120) closeSheets();
      currentY = 0;
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  });

  // ---------- Changelog ----------
  var changelogData = null;
  function renderChangelog(){
    var el = $("versionContent");
    if(!changelogData){
      el.innerHTML = '<p class="card-text">Không tải được lịch sử cập nhật.</p>';
      return;
    }
    el.innerHTML = changelogData.entries.map(function(entry){
      return '<div class="version-entry">' +
        '<div class="version-entry-head"><span class="version-num">v' + escapeHtml(entry.version) + '</span><span class="version-date">' + (C.isValidDate(entry.date) ? fmtDate(entry.date) : "") + "</span></div>" +
        '<ul class="version-changes">' + (entry.changes || []).map(function(c){ return "<li>" + escapeHtml(c) + "</li>"; }).join("") + "</ul>" +
        "</div>";
    }).join("");
  }
  $("btnVersion").addEventListener("click", function(){ renderChangelog(); openSheet("versionSheet"); });
  fetch("/products/love-days/data/changelog.json").then(function(r){
    if(!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function(d){
    if(d && Array.isArray(d.entries)){
      changelogData = d;
      $("versionText").textContent = "v" + d.version;
    }
  }).catch(function(){});

  // ---------- Boot ----------
  C.openDb().then(function(db){
    state.db = db;
    return Promise.resolve().then(loadAll).catch(function(){ state.loadFailed = true; });
  }, function(err){
    // Without the DB, first run and "data exists but is locked" look the same:
    // a setup form here would take input that is lost on close, and a backup
    // made from memory would be an empty file that looks real.
    state.dbError = err && err.code === "blocked" ? "đang bị một cửa sổ LoveDays khác giữ" : err && err.code === "timeout" ? "quá thời gian chờ" : "trình duyệt từ chối";
    state.loadFailed = true;
  }).then(render).catch(function(){
    $("loadingView").hidden = true;
    setBanner("render", "Có lỗi khi hiển thị dữ liệu. Dữ liệu vẫn còn trên máy — hãy thử mở lại app.", "error");
  }).then(initPush);

  // Offline: the shell lives in products/love-days/ (scope). Absolute path —
  // a relative one would resolve against html/, not the shell's folder.
  if("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("/products/love-days/sw-love-days.js").catch(function(){});
    });
  }
})();

// No page zoom in the Home Screen app (LongLTV_ios-pwa-pitfalls §19): iOS still fires its own pinch
// gesture events even with user-scalable=no in some contexts. Only gesture* is cancelled — never a
// global touchend preventDefault (that swallowed rapid taps in GameHub 1.x).
(function(){
  ["gesturestart", "gesturechange", "gestureend"].forEach(function(t){
    document.addEventListener(t, function(e){ e.preventDefault(); }, { passive: false });
  });
})();
