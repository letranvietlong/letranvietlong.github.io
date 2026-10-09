(function(){
  "use strict";

  // VAPID PUBLIC key (base64url, 87 chars, starts with "B"): the "publicKey"
  // half of `npx --yes web-push generate-vapid-keys --json`, run on your own
  // machine OUTSIDE this repo. The matching privateKey goes ONLY into the
  // GitHub secret LOVE_VAPID_PRIVATE_KEY — never into any file here (the repo
  // is public and a Stop hook pushes every change). Empty = notifications off.
  // Changing it invalidates every existing subscription (see docs/love-days.md).
  var VAPID_PUBLIC_KEY = '';

  var C = self.LoveCore, M = self.LoveMedia, B = self.LoveBackup;
  var $ = function(id){ return document.getElementById(id); };

  var PHOTO_IDS = ["avatar-long", "avatar-thu", "cover"];
  var EMOJI_PICKS = ["💗", "💐", "💍", "✈️", "🏖️", "🎂", "🍰", "🎬", "🌙", "⭐"];
  var WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

  var state = {
    db: null, profile: null, milestones: [], blobs: {}, urls: {},
    computed: null, lastIdx: null, timer: null, tab: "home", mode: "loading", editingId: null, loadFailed: false,
    photos: [], albumOrder: [], arranging: false,
    meta: { key: "meta", schemaVersion: 1, lastBackupAt: null, albumSort: "taken" }
  };
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
    // A failed read of profile/milestones/photos/meta rejects the whole load:
    // treating it as "nothing stored" would show first-run setup and let the
    // next save overwrite the real data. Only avatar/cover reads may fail soft.
    return Promise.all([
      C.idbGet(db, "kv", "profile"),
      C.idbGetAll(db, "milestones"),
      Promise.all(PHOTO_IDS.map(function(id){ return safe(C.idbGet(db, "blobs", id), undefined); })),
      C.idbGetAll(db, "photos"),
      C.idbGet(db, "kv", "meta")
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
      }
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
    stopClock();
    $("tabbar").hidden = true;
    $("setupView").hidden = true;
    ["home", "milestones", "album", "settings"].forEach(function(t){ $("tab-" + t).hidden = true; });
    $("loadingView").hidden = false;
    $("loadingView").classList.add("failed");
    setBanner("load", "Không đọc được dữ liệu đã lưu — dữ liệu vẫn còn nguyên.", "error",
              { label: "Tải lại app", run: function(){ location.reload(); } });
  }

  function showSetup(){
    state.mode = "setup";
    stopClock();
    $("tabbar").hidden = true;
    ["home", "milestones", "album", "settings"].forEach(function(t){ $("tab-" + t).hidden = true; });
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
    fillProfileForm();
    renderPhotoRows();
    renderBackupCard();
    switchTab(state.tab);
    startClock();
    updateBadge();
  }

  function switchTab(name){
    if(state.tab === "album" && name !== "album") releaseAlbumThumbs();
    state.tab = name;
    ["home", "milestones", "album", "settings"].forEach(function(t){ $("tab-" + t).hidden = t !== name; });
    Array.prototype.forEach.call(document.querySelectorAll(".tabbar-btn"), function(b){
      if(b.getAttribute("data-tab") === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if(name === "settings"){
      refreshStorage(); renderDiag(); renderBackupCard(); renderPush();
      refreshSub().then(function(){ renderPush(); checkPushChanged(); });
    }
    window.scrollTo(0, 0);
    if(name === "album") renderAlbum();
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

    var u = c.upcoming;
    $("upcomingBody").innerHTML = u ?
      '<button type="button" class="up-row" data-goto="milestones" aria-label="' +
      escapeHtml(u.title + ", " + weekday(u.date) + " " + fmtDate(u.date) + ", " + (u.daysLeft === 0 ? "hôm nay" : "còn " + fmtInt(u.daysLeft) + " ngày") + ". Xem tất cả kỷ niệm") + '">' +
      '<span class="up-emoji" aria-hidden="true">' + escapeHtml(u.emoji) + '</span>' +
      '<span class="up-main"><span class="up-title">' + escapeHtml(u.title) + '</span><span class="up-date">' + weekday(u.date) + ", " + fmtDate(u.date) + "</span></span>" +
      (u.daysLeft === 0
        ? '<span class="up-left today">Hôm nay 🎉</span>'
        : '<span class="up-left"><span class="up-num">' + fmtInt(u.daysLeft) + '</span><span class="up-unit">ngày nữa</span></span>') +
      "</button>"
      : '<p class="card-text">Chưa có mốc nào sắp tới.</p>';

    $("birthdays").innerHTML = p.persons.map(function(person){
      var b = null;
      c.birthdays.forEach(function(x){ if(x.personId === person.id) b = x; });
      var head = '<p class="bday-head"><span class="bday-emoji" aria-hidden="true">🎂</span><span class="bday-name">' + escapeHtml(person.name) + "</span></p>";
      if(!b){
        return '<div class="card bday-card empty">' + head +
          '<button type="button" class="btn btn-soft btn-sm" data-goto="settings">Thêm ngày sinh</button></div>';
      }
      var meta = fmtDayMonth(b.date) + " · tròn " + b.turning + " tuổi";
      if(b.daysLeft === 0){
        return '<div class="card bday-card today">' + head + '<p class="bday-left today">Hôm nay 🎂</p><p class="bday-meta">' + meta + "</p></div>";
      }
      return '<div class="card bday-card">' + head +
        // Visible spans sit in a flex row, which drops the space between them for
        // screen readers ("13ngày") — so they're aria-hidden and an sr-only copy is read instead.
        '<p class="bday-left"><span class="sr-only">còn ' + fmtInt(b.daysLeft) + ' ngày</span><span class="bday-num" aria-hidden="true">' + fmtInt(b.daysLeft) + '</span><span class="bday-unit" aria-hidden="true">ngày</span></p>' +
        '<p class="bday-meta">' + meta + "</p></div>";
    }).join("");
  }
  function goTo(e){
    var btn = e.target.closest("[data-goto]");
    if(btn) switchTab(btn.getAttribute("data-goto"));
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
      renderBackupCard(); // "hôm nay"/"N ngày trước" and the stale colour depend on the date
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
      if(x.kind === "birthday") sub += " · tròn " + x.turning + " tuổi";
      else if(x.kind === "user" && x.repeatYearly && x.years > 0) sub += " · lần thứ " + x.years;
      var label = escapeHtml(x.title + ", " + fmtDate(x.date) + ", " + daysLeftText(x));
      var inner = '<span class="ms-emoji" aria-hidden="true">' + escapeHtml(x.emoji) + "</span>" +
        '<span class="ms-main"><span class="ms-title">' + escapeHtml(x.title) + '</span><span class="ms-sub">' + escapeHtml(sub) + "</span></span>" +
        bigDays(x, "ms-left");
      var today = x.daysLeft === 0 ? " is-today" : "";
      if(x.auto) return '<li class="ms-item auto' + today + '" data-ms-id="' + x.id + '" aria-label="' + label + '">' + inner + "</li>";
      return '<li class="ms-item-wrap"><button type="button" class="ms-item' + today + '" data-ms-id="' + escapeHtml(x.id) + '" aria-label="' + label + '">' + inner +
        '<svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></li>';
    }
    function group(title, items){
      if(!items.length) return "";
      return '<h3 class="group-title">' + title + '</h3><ul class="ms-group">' + items.map(row).join("") + "</ul>";
    }
    $("milestoneList").innerHTML = group("Sắp tới", list.filter(function(x){ return !x.past; })) +
      group("Đã qua", list.filter(function(x){ return x.past; }));
  }
  $("milestoneList").addEventListener("click", function(e){
    var btn = e.target.closest("button[data-ms-id]");
    if(!btn) return;
    var id = btn.getAttribute("data-ms-id");
    var m = null;
    state.milestones.forEach(function(x){ if(x.id === id) m = x; });
    if(m) openMilestoneSheet(m);
  });
  $("btnAddMilestone").addEventListener("click", function(){ openMilestoneSheet(null); });

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
    state.editingId = m ? m.id : null;
    $("msSheetTitle").textContent = m ? "Sửa kỷ niệm" : "Thêm kỷ niệm";
    $("msTitle").value = m ? m.title : "";
    setDateValue("msDate", m ? m.date : C.todayStr(now()));
    $("msEmoji").value = m ? m.emoji : "";
    markEmoji();
    $("msNote").value = m ? m.note : "";
    $("msRepeat").checked = m ? m.repeatYearly : false;
    $("msDelete").hidden = !m;
    showError("msError", null);
    openSheet("milestoneSheet");
  }

  $("milestoneForm").addEventListener("submit", function(e){
    e.preventDefault();
    var title = $("msTitle").value.trim(), date = $("msDate").value;
    if(!title){ showError("msError", "Hãy đặt tên cho kỷ niệm."); return; }
    if(!C.isValidDate(date)){ showError("msError", "Hãy chọn ngày hợp lệ."); return; }
    var old = null;
    state.milestones.forEach(function(x){ if(x.id === state.editingId) old = x; });
    var rec = C.validateMilestone({
      id: old ? old.id : "m" + now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: title, date: date, emoji: $("msEmoji").value.trim().slice(0, 8), note: $("msNote").value.trim(),
      repeatYearly: $("msRepeat").checked, createdAt: old ? old.createdAt : now()
    });
    if(!rec){ showError("msError", "Dữ liệu chưa hợp lệ, hãy kiểm tra lại."); return; }
    put("milestones", rec).then(function(){
      state.milestones = state.milestones.filter(function(x){ return x.id !== rec.id; }).concat([rec]);
      dataChanged();
      closeSheets();
      recompute(); renderHome(); renderMilestones();
      toast(old ? "Đã lưu kỷ niệm ✓" : "Đã thêm kỷ niệm 💕");
    }, function(){ showError("msError", "Không lưu được vào bộ nhớ máy. Hãy thử lại."); });
  });

  $("msDelete").addEventListener("click", function(){
    var id = state.editingId;
    var m = null;
    state.milestones.forEach(function(x){ if(x.id === id) m = x; });
    if(!m || !window.confirm('Xoá kỷ niệm "' + m.title + '"?')) return;
    del("milestones", id).then(function(){
      state.milestones = state.milestones.filter(function(x){ return x.id !== id; });
      dataChanged();
      closeSheets();
      recompute(); renderHome(); renderMilestones();
      toast("Đã xoá kỷ niệm");
    }, function(){ showError("msError", "Không xoá được. Hãy thử lại."); });
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
    msDate:       { min: "1900-01-01", optional: false, futureYears: 20 }
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
  var dp = { open: false, id: null, y: 2000, m: 1, d: 1, min: "", max: "", today: "", minY: 1900, maxY: 2000, raf: 0 };
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

  function openDatePicker(id){
    var cfg = DATE_FIELDS[id], today = C.todayStr(now()), v = $(id).value;
    dp.id = id; dp.today = today; dp.min = cfg.min;
    dp.max = cfg.futureYears ? C.addYearsClamp(today, cfg.futureYears) : today;
    // A stored value outside the bounds (old data, imported backup) widens them
    // so opening the picker and pressing "Xong" never silently moves it; the
    // save path still validates (e.g. future start dates are rejected there).
    if(C.isValidDate(v)){ if(v < dp.min) dp.min = v; if(v > dp.max) dp.max = v; }
    dp.minY = +dp.min.slice(0, 4); dp.maxY = +dp.max.slice(0, 4);
    dpSetParts(C.isValidDate(v) ? v : cfg.def || today);
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
    $("dpBackdrop").classList.add("open");
    $(id + "Btn").setAttribute("aria-expanded", "true");
    dpSync(false);
    dpCols[0].el.focus({ preventScroll: true });
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
    dpCols.forEach(function(col){ clearTimeout(col.timer); col.timer = null; col.touching = false; });
    var sheet = $("datePicker"), id = dp.id;
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    $("dpBackdrop").classList.remove("open");
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
    if(e.key !== "Tab") return;
    var f = Array.prototype.filter.call($("datePicker").querySelectorAll("button,[tabindex]"), function(el){ return !el.hidden; });
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

  Array.prototype.forEach.call(document.querySelectorAll("[data-remove]"), function(btn){
    btn.addEventListener("click", function(){
      var id = btn.getAttribute("data-remove");
      if(!window.confirm(id === "cover" ? "Gỡ ảnh bìa?" : "Gỡ ảnh đại diện này?")) return;
      del("blobs", id).then(function(){
        delete state.blobs[id];
        setUrl(id);
        if(id === "cover"){
          state.profile.hasCover = false;
          return put("kv", profileRecord(state.profile));
        }
      }).then(function(){ dataChanged(); renderPhotoRows(); renderHome(); }, function(){
        showError("photoError", "Không gỡ được ảnh. Hãy thử lại.");
      });
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
  function deletePhoto(id){
    if(!state.db){ delete mem.photos[id]; delete mem.blobs[id]; return Promise.resolve(); }
    var tx = state.db.transaction(["photos", "blobs"], "readwrite");
    tx.objectStore("photos").delete(id);
    tx.objectStore("blobs").delete(id);
    return C.txDone(tx);
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
  }

  // ---------- Viewer ----------
  // A fixed overlay on top of the album: no navigation, so closing lands on
  // the same grid. The page behind is locked with body{position:fixed} (iOS
  // ignores overflow:hidden on body) and scrollY is restored on close.
  var viewer = { open: false, ids: [], index: 0, urls: {}, scrollY: 0, dirty: false, editing: false };

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

  function openViewer(id){
    var idx = state.albumOrder.indexOf(id);
    if(idx < 0) return;
    viewer.ids = state.albumOrder.slice();
    viewer.open = true;
    viewer.dirty = false;
    lockScroll();
    $("viewer").hidden = false;
    showViewerAt(idx);
    $("viewerClose").focus({ preventScroll: true });
  }

  function closeViewer(){
    if(!viewer.open) return;
    viewer.open = false;
    endCaptionEdit();
    $("viewer").hidden = true;
    $("viewerImg").removeAttribute("src");
    Object.keys(viewer.urls).forEach(dropFull);
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
    $("viewerCount").textContent = (i + 1) + " / " + ids.length;
    $("viewerDate").textContent = photoDateText(p);
    renderCaption(p);
    $("viewerPrev").disabled = i === 0;
    $("viewerNext").disabled = i === ids.length - 1;
    var img = $("viewerImg");
    img.style.transform = "";
    if(thumbUrls[id]) img.src = thumbUrls[id]; else img.removeAttribute("src");
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
    if(k < 0 || k >= viewer.ids.length) return;
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
  $("viewerDelete").addEventListener("click", function(){
    var id = viewer.ids[viewer.index];
    if(!photoById(id) || busy) return;
    if(!window.confirm("Xoá ảnh này khỏi album? Không thể hoàn tác.")) return;
    deletePhoto(id).then(function(){
      state.photos = state.photos.filter(function(p){ return p.id !== id; });
      dropFull(id);
      revokeThumb(id);
      viewer.ids.splice(viewer.index, 1);
      viewer.dirty = true;
      dataChanged();
      if(!viewer.ids.length){ closeViewer(); return; }
      showViewerAt(Math.min(viewer.index, viewer.ids.length - 1));
    }, function(){ window.alert("Không xoá được ảnh. Hãy thử lại."); });
  });

  function onViewerKey(e){
    if(viewer.editing){
      if(e.key === "Escape"){ e.preventDefault(); endCaptionEdit(); }
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
        : "File .zip gồm hồ sơ, kỷ niệm và ảnh · iPhone: chọn “Lưu vào Tệp”.";
    }
  }

  function prepareBackup(onProgress){
    var version = backup.version;
    busy = "backup";
    return B.buildBackup({ profile: state.profile, milestones: state.milestones, photos: state.photos, readBlob: readBlob },
                         now(), onProgress).then(function(r){
      busy = null;
      if(version === backup.version){ backup.prepared = r; backup.saved = false; }
      return r;
    }, function(err){ busy = null; throw err; });
  }

  // Must run synchronously inside the tap: Safari drops the user activation
  // after a long await and navigator.share() then throws NotAllowedError —
  // that's why preparing and saving are two separate buttons.
  function saveBackupFile(p, done){
    var f = p.file;
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })){
        navigator.share({ files: [f] }).then(function(){ markBackedUp(); done(true); }, function(err){
          if(err && err.name === "AbortError") done(false, null);
          else done(false, "Không mở được bảng chia sẻ của máy (" + (err && err.name || "lỗi") + "). Hãy thử lại.");
        });
        return;
      }
    }catch(e){}
    var url = URL.createObjectURL(f);
    var a = document.createElement("a");
    a.href = url; a.download = p.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking right away can abort the download on iOS Safari.
    setTimeout(function(){ URL.revokeObjectURL(url); }, 10000);
    markBackedUp();
    done(true);
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

  // ---------- Backup: import ----------
  var imp = { phase: "idle", parsed: null, plan: null, mode: "merge", error: null, result: null, done: 0, total: 0, prepMsg: null };

  function localSnapshot(){
    var hasBlob = {};
    PHOTO_IDS.forEach(function(id){ hasBlob[id] = !!state.blobs[id]; });
    return {
      profileOk: !!(state.profile && state.profile.startStatus === "ok"),
      profile: state.profile, photos: state.photos, milestones: state.milestones, hasBlob: hasBlob
    };
  }
  function hasLocalData(){
    var l = localSnapshot();
    return l.profileOk || l.photos.length > 0 || l.milestones.length > 0;
  }

  function onImportFile(input){
    var f = input.files && input.files[0];
    input.value = "";
    if(!f) return;
    imp = { phase: "checking", parsed: null, plan: null, mode: "merge", error: null, result: null, done: 0, total: 0, prepMsg: null };
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
      imp.plan = B.planMerge(parsed, localSnapshot());
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
      var what = fmtInt(r.addedPhotos) + " ảnh, " + fmtInt(r.addedMilestones) + " kỷ niệm";
      // Merge can also fill missing avatars/cover — the preview counted them, so the result must too.
      var imgs = imp.mode !== "replace" && r.images ? ", " + fmtInt(r.images) + " ảnh hồ sơ" : "";
      var line = imp.mode === "replace" ? "Đã thay toàn bộ dữ liệu: " + what + "."
        : r.addedPhotos || r.addedMilestones || r.images ? "Đã thêm " + what + imgs + "." : "Không có ảnh hay kỷ niệm mới.";
      h = '<div class="import-box import-ok" role="status"><p class="import-box-title">Đã nhập xong 💕</p><p>' + escapeHtml(line) + "</p>" +
        (r.profileKept ? "<p>Hồ sơ hiện tại giữ nguyên.</p>" : "") + "</div>" +
        '<button type="button" class="btn btn-primary btn-block" data-imp="close">Xong</button>';
    } else if(imp.phase === "ready"){
      h = renderImportReady();
    }
    el.innerHTML = h;
    placeSegPill(el.querySelector(".segmented"), true);
  }

  function importProgressText(){
    return imp.total ? "Đang nhập " + imp.done + "/" + imp.total + "…" : "Đang nhập…";
  }

  function renderImportReady(){
    var ps = imp.parsed, pl = imp.plan, local = localSnapshot();
    var when = ps.exportedAt ? "Bản sao lưu ngày " + fmtStamp(ps.exportedAt) : "Bản sao lưu";
    var imgs = Object.keys(ps.images).length;
    var h = '<div class="import-summary"><p class="import-when">' + escapeHtml(when) + "</p><ul>" +
      "<li>" + fmtInt(ps.photos.length) + " ảnh · " + fmtInt(ps.milestones.length) + " kỷ niệm" + (imgs ? " · " + imgs + " ảnh hồ sơ" : "") + "</li>" +
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
      var skipped = pl.skipPhotos + pl.skipMilestones;
      if(!pl.addPhotos && !pl.addMilestones && !fillImgs && local.profileOk){
        return h + '<p class="card-text">Không có gì mới — mọi ảnh và kỷ niệm đã có trên máy. Hồ sơ hiện tại giữ nguyên.</p>' +
          '<button type="button" class="btn btn-soft btn-block" data-imp="close">Đóng</button>';
      }
      var adds = [fmtInt(pl.addPhotos) + " ảnh", fmtInt(pl.addMilestones) + " kỷ niệm"];
      if(fillImgs) adds.push(fillImgs + " ảnh hồ sơ còn thiếu");
      h += '<p class="card-text">' + escapeHtml("Sẽ thêm " + adds.join(", ") + (skipped ? " (" + fmtInt(skipped) + " đã có, bỏ qua)" : "") + ". " +
        (local.profileOk ? "Hồ sơ hiện tại giữ nguyên." : "Hồ sơ lấy từ bản sao lưu.")) + "</p>" +
        '<button type="button" class="btn btn-primary btn-block" data-imp="run">Gộp vào dữ liệu hiện tại</button>';
      return h;
    }
    var p = backup.prepared;
    h += '<div class="import-box import-warn"><p class="import-box-title">Toàn bộ dữ liệu hiện tại sẽ bị xoá</p><p>' +
      fmtInt(local.photos.length) + " ảnh, " + local.milestones.length + " kỷ niệm, hồ sơ và ảnh đại diện trên máy này sẽ bị thay.</p></div>" +
      '<p class="import-step">Bước 1 · Sao lưu dữ liệu hiện tại trước</p>';
    if(busy === "backup") h += '<p class="import-status" id="importPrep">' + escapeHtml(imp.prepMsg || "Đang chuẩn bị…") + "</p>";
    else if(!p) h += '<button type="button" class="btn btn-soft btn-block" data-imp="prep">Chuẩn bị bản sao lưu hiện tại</button>';
    else h += '<button type="button" class="btn btn-soft btn-block" data-imp="save">' + (backup.saved ? "Đã lưu ✓ · Lưu lần nữa" : "Lưu file (" + fmtMB(p.size) + ")") + "</button>";
    if(imp.prepMsg && busy !== "backup") h += '<p class="form-error">' + escapeHtml(imp.prepMsg) + "</p>";
    h += '<p class="import-step">Bước 2 · Thay thế</p>' +
      '<button type="button" class="btn btn-danger btn-block" data-imp="run"' + (busy ? " disabled" : "") + ">Thay thế bằng bản sao lưu</button>";
    return h;
  }

  $("importContent").addEventListener("click", function(e){
    var b = e.target.closest("[data-imp]");
    if(!b || b.disabled) return;
    var act = b.getAttribute("data-imp");
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
    if(act === "run") runImport();
  });

  function runImport(){
    if(busy || !imp.parsed) return;
    var mode = hasLocalData() ? imp.mode : "merge";
    if(mode === "replace"){
      var l = localSnapshot();
      var msg = "Xoá " + l.photos.length + " ảnh, " + l.milestones.length + " kỷ niệm và hồ sơ hiện tại, thay bằng bản sao lưu?" +
        (backup.saved ? "" : "\n\nBạn CHƯA lưu bản sao lưu dữ liệu hiện tại — sau khi thay sẽ không lấy lại được.");
      if(!window.confirm(msg)) return;
    }
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
    Object.keys(state.urls).forEach(function(k){ if(state.urls[k]) URL.revokeObjectURL(state.urls[k]); });
    state.urls = {}; state.blobs = {}; state.photos = []; state.milestones = []; state.profile = null;
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
    var testWhy = typeof Notification === "undefined" ? "Mở app từ icon Màn hình chính để gửi thử." :
      perm === "denied" ? "Đã chặn — bật lại ở Cài đặt iPhone → Thông báo → Long & Thư." : "";
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
      if(perm !== "granted") throw userErr(perm === "denied" ? "Bạn đã chọn Không cho phép. Bật lại trong Cài đặt iPhone → Thông báo → Long & Thư." : "Chưa được cho phép thông báo. Hãy chạm lại và chọn Cho phép.");
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
      showError("pushError", (err && err.userMessage) || "Không bật được thông báo (" + (err && err.name || "lỗi") + "). Hãy thử lại.");
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
    var note = $("pushTestNote");
    note.hidden = true;
    var permP = Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
    Promise.resolve(permP).then(function(perm){
      if(perm !== "granted") throw userErr("Cần cho phép thông báo thì mới gửi thử được.");
      return swReady();
    }).then(function(reg){
      var n = state.computed.n;
      return reg.showNotification("💕 Ngày thứ " + fmtInt(n), {
        body: "Thông báo thử trên máy này — hôm nay là ngày thứ " + fmtInt(n) + " Long & Thư yêu nhau",
        tag: "love-days-test", icon: PUSH_ICON
      }).then(function(){ return n; });
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
        "Không thấy? Xem Cài đặt iPhone → Thông báo.";
      note.hidden = false;
      renderPush();
      renderDiag();
    }).catch(function(err){
      showError("pushError", (err && err.userMessage) || "Không gửi thử được (" + (err && err.name || "lỗi") + ").");
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
  function openSheet(id){
    $(id).classList.add("open");
    $("sheetBackdrop").classList.add("open");
  }
  function closeSheets(){
    if(imp.phase === "importing") return;
    Array.prototype.forEach.call(document.querySelectorAll(".sheet.open"), function(s){ s.classList.remove("open"); });
    $("sheetBackdrop").classList.remove("open");
  }
  $("sheetBackdrop").addEventListener("click", closeSheets);
  Array.prototype.forEach.call(document.querySelectorAll("[data-close-sheet]"), function(b){ b.addEventListener("click", closeSheets); });
  document.addEventListener("keydown", function(e){
    if(dp.open){ onDatePickerKey(e); return; }
    if(viewer.open){ onViewerKey(e); return; }
    if(e.key === "Escape" && document.querySelector(".sheet.open")) closeSheets();
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
      $("btnVersion").textContent = "v" + d.version;
    }
  }).catch(function(){});

  // ---------- Boot ----------
  C.openDb().then(function(db){
    state.db = db;
    return Promise.resolve().then(loadAll).catch(function(){ state.loadFailed = true; });
  }, function(err){
    var why = err && err.code === "blocked" ? "đang bị một cửa sổ LoveDays khác giữ" : err && err.code === "timeout" ? "quá thời gian chờ" : "trình duyệt từ chối";
    setBanner("db", "Không mở được bộ nhớ (" + why + ") — thay đổi sẽ không được lưu. Đóng các cửa sổ LoveDays khác rồi mở lại.", "error");
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
