// Vỏ của GameHub: lưu trữ, tab, danh sách game, host chạy game, cài đặt, sao lưu, service worker.
// Game nằm ở mini-game-hub-games-*.js và chỉ nói chuyện với vỏ qua đối tượng `host`
// (hợp đồng: products/mini-game-hub/docs/mini-game-hub.md).
(function(){
  'use strict';
  var C = window.GameHubCore;
  var KEY = 'gamehub_v3', LEGACY_PROFILE_KEY = 'gamehub_profile_v2';
  var CHANGELOG_URL = '/products/mini-game-hub/data/changelog.json';
  var THEME_SWATCH = { default: ['#60A5FA', '#A78BFA'], ocean: ['#38BDF8', '#22D3EE'], sunset: ['#FDBA74', '#FB923C'], forest: ['#34D399', '#4ADE80'], neon: ['#A78BFA', '#C084FC'] };
  var SUGGEST = ['flappy', 'tictactoe', 'idleMine', 'snake', 'g2048', 'memory', 'mole', 'tapRace'];
  var html = document.documentElement;
  function $(id){ return document.getElementById(id); }
  function h(tag, attrs, kids){
    var el = document.createElement(tag), k;
    for(k in attrs || {}){
      if(k === 'text') el.textContent = attrs[k];
      else if(k === 'class') el.className = attrs[k];
      else if(attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function(c){ if(c) el.appendChild(c); });
    return el;
  }
  function svgIcon(name){
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }
  function fmtNum(n){ return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 }); }
  function fmtDate(day){ return day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(0, 4); }
  function showError(id, msg){
    var el = $(id);
    el.textContent = msg || '';
    el.hidden = !msg;
  }
  function focusQuiet(el){ try{ if(el) el.focus({ preventScroll: true }); }catch(e){} }

  // ---------- Danh sách game ----------
  // File game đẩy định nghĩa vào window.GameHubGames; id nào thiếu định nghĩa thì thẻ bị vô hiệu chứ không lỗi.
  var DEFS = Object.create(null), lowIds = ['reaction'];
  (Array.isArray(window.GameHubGames) ? window.GameHubGames : []).forEach(function(def){
    if(!def || typeof def !== 'object' || typeof def.mount !== 'function' || !C.catalogOf(def.id) || DEFS[def.id]) return;
    DEFS[def.id] = def;
    if(def.score && def.score.better === 'low' && lowIds.indexOf(def.id) === -1) lowIds.push(def.id);
  });
  function info(id){
    var c = C.catalogOf(id), d = DEFS[id] || {};
    function pick(k){ return typeof d[k] === 'string' && d[k] ? d[k] : c[k]; }
    return { id: id, name: pick('name'), icon: pick('icon'), desc: pick('desc'), cat: c.cat, dur: C.own(C.DUR_LABEL, d.dur) ? d.dur : c.dur,
      help: typeof d.help === 'string' ? d.help : '', score: d.score && typeof d.score === 'object' ? d.score : null, ready: !!DEFS[id] };
  }
  function fmtScore(inf, v){
    return fmtNum(v) + (inf.score && inf.score.unit ? ' ' + inf.score.unit : '');
  }

  // ---------- Lưu trữ: MỘT khoá gamehub_v3 ----------
  // Đọc hỏng ≠ chưa có dữ liệu: khi đọc hỏng thì bật cờ corrupt, chơi bằng trạng thái tạm và
  // KHÔNG ghi gì lên khoá, để bản lỗi còn nguyên cho người dùng lưu ra file.
  var state = C.defaultState(), corrupt = false, brokenRaw = null, saveFailed = false;
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return undefined; } }
  function readStore(){
    var raw = lsGet(KEY), parsed, st;
    if(raw === undefined) return { blocked: true };
    if(raw === null) return { none: true };
    try{ parsed = JSON.parse(raw); }catch(e){ return { corrupt: true, raw: raw }; }
    st = C.validateState(parsed);
    return st ? { state: st } : { corrupt: true, raw: raw };
  }
  function writeStore(st){
    st.updatedAt = Date.now();
    try{
      localStorage.setItem(KEY, JSON.stringify(st));
      saveFailed = false;
      return true;
    }catch(e){
      if(!saveFailed){ saveFailed = true; toast('Máy không cho lưu — tiến trình lần này có thể mất khi đóng app'); }
      return false;
    }
  }
  function collectLegacy(){
    var profRaw = lsGet(LEGACY_PROFILE_KEY), profile = null, local = {};
    if(profRaw === null || profRaw === undefined) return null;
    try{ profile = JSON.parse(profRaw); }catch(e){}
    C.GAME_IDS.forEach(function(id){
      ['hs_' + id, 'save_' + id].forEach(function(k){ var v = lsGet(k); if(typeof v === 'string') local[k] = v; });
    });
    var br = lsGet('bestReaction');
    if(typeof br === 'string') local.bestReaction = br;
    return C.extractLegacy(profile, local);
  }
  function loadState(){
    var r = readStore();
    if(r.state){ state = r.state; corrupt = false; brokenRaw = null; }
    else if(r.corrupt){ corrupt = true; brokenRaw = r.raw; state = C.defaultState(); }
    else if(r.none){
      // Chạy đúng một lần: sau đó gamehub_v3 đã tồn tại. Khoá cũ được giữ nguyên
      // (trang chủ của site cũng dùng hs_snake, hs_flappy).
      var legacy = collectLegacy();
      state = legacy ? C.migrateV2(legacy, Date.now()) : C.defaultState();
      corrupt = false; brokenRaw = null;
      if(legacy) writeStore(state);
    }
  }
  // Mọi lần ghi đi qua đây: đọc lại bản mới nhất (tab khác có thể vừa ghi) → áp fn → ghi.
  function update(fn){
    if(!corrupt){
      var r = readStore();
      if(r.state) state = r.state;
      else if(r.corrupt){ corrupt = true; brokenRaw = r.raw; state = C.defaultState(); renderBanner(); }
    }
    var out = fn(state);
    if(!corrupt) writeStore(state);
    return out;
  }
  // Thay đổi do việc chơi: kèm kiểm huy hiệu và báo lên cấp. Trả tổng XP vừa nhận.
  function play(fn){
    var before = state.level, fresh = [], xp = update(function(s){
      before = s.level;
      var got = fn(s) || 0;
      fresh = C.checkAchievements(s, Date.now(), lowIds);
      return got + fresh.length * C.XP_ACHIEVEMENT;
    });
    var msgs = fresh.map(function(a){ return 'Mở khoá huy hiệu ' + a.name + ' · +' + C.XP_ACHIEVEMENT + ' XP'; });
    if(state.level > before){
      var opened = C.THEMES.filter(function(t){ return t.level > before && t.level <= state.level; }).map(function(t){ return t.name; });
      msgs.push('Lên cấp ' + state.level + (opened.length ? ' · mở giao diện ' + opened.join(', ') : ''));
      sfx('win');
    }
    if(msgs.length) toast(msgs.join(' — '));
    applyPrefs();
    return xp;
  }

  // ---------- Toast ----------
  var toastTimer = 0;
  function toast(msg){
    var t = $('toast');
    if(!t) return;
    clearTimeout(toastTimer);
    t.hidden = true;
    t.textContent = msg;
    void t.offsetWidth;
    t.hidden = false;
    toastTimer = setTimeout(function(){ t.hidden = true; t.textContent = ''; }, 2600);
  }

  // ---------- Âm thanh (Web Audio, chỉ tạo sau cú chạm đầu tiên) ----------
  var audioCtx = null, gestured = false;
  var TONES = { tap: [[440, .05]], good: [[660, .09]], bad: [[170, .18]], win: [[523, .09], [784, .16]] };
  function sfx(name){
    if(!state.sound || !gestured || !C.own(TONES, name)) return;
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      audioCtx = audioCtx || new AC();
      if(audioCtx.state === 'suspended') audioCtx.resume();
      var at = audioCtx.currentTime;
      TONES[name].forEach(function(n){
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = n[0];
        g.gain.setValueAtTime(.05, at);
        g.gain.exponentialRampToValueAtTime(.0001, at + n[1]);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(at); o.stop(at + n[1]);
        at += n[1];
      });
    }catch(e){}
  }
  function markGesture(){ gestured = true; }
  document.addEventListener('pointerdown', markGesture, { capture: true, passive: true });

  // ---------- Sheet + backdrop ----------
  // Đóng = hidden (display:none). Gỡ .open rồi mới đặt hidden sau CLOSE_MS (CSS trượt xuống trong 100ms);
  // không dùng transitionend vì prefers-reduced-motion tắt transition. Ngay khi gỡ .open, backdrop thôi
  // chặn chạm (pointer-events trong CSS) và nút của sheet đang đóng bị bỏ qua (inClosingSheet).
  var CLOSE_MS = 120;
  var sheetStack = [], hideTimers = {}, backdropTimer = 0;
  function inClosingSheet(el){
    var sh = el.closest('.sheet');
    return !!sh && !sh.classList.contains('open');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function(sh){
    sh.addEventListener('click', function(e){ if(!sh.classList.contains('open')){ e.stopPropagation(); e.preventDefault(); } }, true);
  });
  // Nút của vỏ phản hồi ngay ở touchend thay vì chờ click: sau một cú vuốt nhanh trong vùng chơi,
  // Chromium coi cú chạm kế tiếp là "dừng quán tính" và không phát click (đo: 0/10 lần mở được "?").
  // preventDefault ở touchend để trình duyệt không phát thêm click vào thứ nằm dưới sau khi nút biến mất.
  // Chuột và bàn phím vẫn đi qua click.
  function onTap(el, fn){
    var tid = null, sx = 0, sy = 0;
    el.addEventListener('touchstart', function(e){
      var t = e.changedTouches[0];
      tid = t.identifier; sx = t.clientX; sy = t.clientY;
    }, { passive: true });
    el.addEventListener('touchcancel', function(){ tid = null; });
    el.addEventListener('touchend', function(e){
      var t = null, i, r;
      for(i = 0; i < e.changedTouches.length; i++) if(e.changedTouches[i].identifier === tid) t = e.changedTouches[i];
      tid = null;
      if(!t || el.disabled) return;
      r = el.getBoundingClientRect();
      if(Math.abs(t.clientX - sx) > 12 || Math.abs(t.clientY - sy) > 12 || t.clientX < r.left || t.clientX > r.right || t.clientY < r.top || t.clientY > r.bottom) return;
      if(e.cancelable) e.preventDefault();
      if(!inClosingSheet(el)) fn(e);
    });
    el.addEventListener('click', function(e){ fn(e); });
  }
  function topSheet(){ return sheetStack.length ? sheetStack[sheetStack.length - 1] : null; }
  function showBackdrop(){
    var b = $('backdrop');
    clearTimeout(backdropTimer);
    b.hidden = false;
    void b.offsetWidth;
    b.classList.add('open');
  }
  function hideBackdrop(){
    var b = $('backdrop');
    b.classList.remove('open');
    clearTimeout(backdropTimer);
    backdropTimer = setTimeout(function(){ b.hidden = true; }, CLOSE_MS);
  }
  function openSheet(id, onDismiss){
    var el = $(id);
    if(sheetStack.some(function(s){ return s.id === id; })) return;
    clearTimeout(hideTimers[id]);
    sheetStack.push({ id: id, onDismiss: onDismiss, opener: document.activeElement });
    el.hidden = false;
    el.scrollTop = 0;
    void el.offsetWidth;
    el.classList.add('open');
    showBackdrop();
    focusQuiet(el.querySelector('button:not([hidden]):not(:disabled)'));
  }
  function closeSheet(id){
    var i = sheetStack.map(function(s){ return s.id; }).indexOf(id), el = $(id);
    if(i === -1) return;
    var entry = sheetStack.splice(i, 1)[0];
    el.classList.remove('open');
    clearTimeout(hideTimers[id]);
    hideTimers[id] = setTimeout(function(){ el.hidden = true; }, CLOSE_MS);
    if(!sheetStack.length) hideBackdrop();
    if(entry.opener && document.contains(entry.opener) && !entry.opener.closest('[hidden]')) focusQuiet(entry.opener);
  }
  // Người dùng bỏ qua lớp trên cùng (Esc, chạm nền).
  function dismissTop(fromBackdrop){
    var top = topSheet();
    if(!top) return false;
    if(top.id === 'resultSheet'){ if(!fromBackdrop) closeGame(false); return true; }
    if(top.onDismiss) top.onDismiss(); else closeSheet(top.id);
    return true;
  }
  $('backdrop').addEventListener('click', function(){ dismissTop(true); });

  var confirmResolve = null, confirmArmedAt = 0;
  function settleConfirm(ok){
    var r = confirmResolve;
    confirmResolve = null;
    closeSheet('confirmSheet');
    if(r) r(ok);
  }
  function askConfirm(opts){
    if(confirmResolve) settleConfirm(false);
    $('confirmTitle').textContent = opts.title || 'Bạn chắc chứ?';
    $('confirmBody').textContent = opts.body || '';
    $('confirmBody').hidden = !opts.body;
    $('confirmOk').textContent = opts.okLabel || 'Đồng ý';
    $('confirmOk').className = 'btn ' + (opts.danger ? 'danger' : 'primary');
    $('confirmCancel').textContent = opts.cancelLabel || 'Thôi';
    // Nút nguy hiểm chỉ nhận chạm sau 400ms: cú chạm đúp ở bước trước không lọt sang bước này.
    confirmArmedAt = performance.now() + (opts.danger ? 400 : 0);
    return new Promise(function(resolve){
      confirmResolve = resolve;
      openSheet('confirmSheet', function(){ settleConfirm(false); });
      if(opts.danger) focusQuiet($('confirmCancel'));
    });
  }
  $('confirmOk').addEventListener('click', function(){ if(performance.now() >= confirmArmedAt) settleConfirm(true); });
  $('confirmCancel').addEventListener('click', function(){ settleConfirm(false); });

  // ---------- Tab ----------
  var VIEWS = { home: 'viewHome', games: 'viewGames', settings: 'viewSettings' }, currentTab = 'home';
  function switchTab(tab, keepScroll){
    if(!C.own(VIEWS, tab)) return;
    currentTab = tab;
    Object.keys(VIEWS).forEach(function(k){ $(VIEWS[k]).hidden = k !== tab; });
    Array.prototype.forEach.call(document.querySelectorAll('.tabbar-btn'), function(b){
      if(b.getAttribute('data-tab') === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderAll();
    if(!keepScroll) window.scrollTo(0, 0);
  }
  $('tabbar').addEventListener('click', function(e){
    var b = e.target.closest('.tabbar-btn');
    if(b) switchTab(b.getAttribute('data-tab'));
  });

  // ---------- Trang chủ ----------
  function gameButtonLabel(inf){ return 'Chơi ' + inf.name; }
  function renderHome(){
    var today = C.vnToday(), need = C.xpNeed(state.level), streak = C.streak(state, today);
    $('levelText').textContent = 'Cấp ' + state.level;
    $('streakText').textContent = 'Chuỗi ' + streak + ' ngày';
    $('xpFill').style.width = Math.min(100, Math.round(state.xp / need * 100)) + '%';
    $('xpBar').setAttribute('aria-valuemax', need);
    $('xpBar').setAttribute('aria-valuenow', state.xp);
    $('xpText').textContent = fmtNum(state.xp) + ' / ' + fmtNum(need) + ' XP';

    var recent = Object.keys(state.stats).filter(function(id){ return DEFS[id] && state.stats[id].plays > 0; })
      .sort(function(a, b){ return state.stats[b].last - state.stats[a].last; }).slice(0, 6);
    $('recentTitle').textContent = recent.length ? 'Chơi tiếp' : 'Thử ngay';
    SUGGEST.concat(C.GAME_IDS).forEach(function(id){ if(recent.length < 3 && DEFS[id] && recent.indexOf(id) === -1) recent.push(id); });
    var row = $('recentRow');
    row.textContent = '';
    recent.forEach(function(id){
      var inf = info(id);
      row.appendChild(h('button', { type: 'button', class: 'recent-card', 'data-open': id, 'aria-label': gameButtonLabel(inf) }, [
        h('span', { class: 'recent-icon', 'aria-hidden': 'true', text: inf.icon }), h('span', { class: 'recent-name', text: inf.name })
      ]));
    });
    $('newNote').hidden = corrupt || C.hasProgress(state);
    if($('newNote').hidden) showError('emptyError', null);

    var ml = $('missionList');
    ml.textContent = '';
    C.missionsFor(state, today).forEach(function(m){
      var fill = h('i');
      fill.style.width = Math.round(m.cur / m.goal * 100) + '%';
      ml.appendChild(h('div', { class: 'mission' }, [
        h('div', { class: 'mission-main' }, [
          h('div', { class: 'mission-title', text: m.title }),
          h('div', { class: 'mission-sub', text: m.progress + ' · +' + m.reward + ' XP' }),
          h('div', { class: 'bar', 'aria-hidden': 'true' }, [fill])
        ]),
        h('button', { type: 'button', class: 'btn small' + (m.done && !m.claimed ? ' primary' : ''), 'data-claim': m.id,
          disabled: !m.done || m.claimed, text: m.claimed ? 'Đã nhận' : 'Nhận',
          'aria-label': (m.claimed ? 'Đã nhận thưởng: ' : 'Nhận thưởng: ') + m.title })
      ]));
    });

    var al = $('achList');
    al.textContent = '';
    C.achievementProgress(state, lowIds).forEach(function(a){
      var fill = h('i');
      fill.style.width = (a.unlocked ? 100 : Math.round(a.cur / a.goal * 100)) + '%';
      al.appendChild(h('div', { class: 'ach' + (a.unlocked ? ' done' : '') }, [
        h('div', { class: 'ach-icon', 'aria-hidden': 'true', text: a.icon }),
        h('div', { class: 'ach-main' }, [
          h('div', { class: 'ach-name', text: a.name }), h('div', { class: 'ach-sub', text: a.desc }),
          h('div', { class: 'bar', 'aria-hidden': 'true' }, [fill])
        ]),
        h('div', { class: 'ach-state', text: a.unlocked ? 'Đã đạt' : a.reached ? 'Chơi để nhận' : a.cur + '/' + a.goal })
      ]));
    });

    var top = null;
    Object.keys(state.stats).forEach(function(id){
      if(C.catalogOf(id) && state.stats[id].plays > 0 && (!top || state.stats[id].plays > state.stats[top].plays)) top = id;
    });
    var sg = $('statGrid');
    sg.textContent = '';
    function stat(label, value, unit, wide){
      var v = h('div', { class: 'stat-value', text: value });
      if(unit) v.appendChild(h('small', { text: ' ' + unit }));
      sg.appendChild(h('div', { class: 'stat' + (wide ? ' wide' : '') }, [h('div', { class: 'stat-label', text: label }), v]));
    }
    stat('Tổng lượt chơi', fmtNum(state.plays), 'lượt');
    stat('Tổng thời gian', fmtNum(Math.floor(state.seconds / 60)), 'phút');
    if(top) stat('Chơi nhiều nhất', info(top).icon + ' ' + info(top).name, fmtNum(state.stats[top].plays) + ' lượt', true);
    else stat('Chơi nhiều nhất', 'Chưa chơi game nào', '', true);
  }
  $('missionList').addEventListener('click', function(e){
    var b = e.target.closest('[data-claim]');
    if(!b || b.disabled) return;
    var got = play(function(s){ return C.claimMission(s, b.getAttribute('data-claim'), C.vnToday()); });
    if(got){ sfx('good'); toast('Nhận ' + got + ' XP'); }
    renderAll();
  });
  $('recentRow').addEventListener('click', function(e){
    var b = e.target.closest('[data-open]');
    if(b) openGame(b.getAttribute('data-open'));
  });

  // ---------- Trò chơi ----------
  var filter = 'all', query = '';
  function fold(s){ return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
  function renderChips(){
    var box = $('chips');
    if(!box.firstChild){
      [['all', 'Tất cả'], ['fav', 'Yêu thích']].concat(C.CATS.map(function(c){ return [c, c]; })).forEach(function(c){
        box.appendChild(h('button', { type: 'button', class: 'chip', 'data-filter': c[0], text: c[1] }));
      });
    }
    Array.prototype.forEach.call(box.children, function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-filter') === filter ? 'true' : 'false'); });
  }
  function renderGames(){
    renderChips();
    $('searchClear').hidden = !query;
    var q = fold(query.trim()), grid = $('gameGrid'), list = C.CATALOG.map(function(c){ return info(c.id); }).filter(function(g){
      if(filter === 'fav' && state.favorites.indexOf(g.id) === -1) return false;
      if(filter !== 'all' && filter !== 'fav' && g.cat !== filter) return false;
      // Khớp từ đầu mỗi từ: gõ "ran" ra "Rắn", không ra "tránh".
      return !q || (' ' + fold(g.name + ' ' + g.desc + ' ' + g.cat)).indexOf(' ' + q) !== -1;
    });
    grid.textContent = '';
    if(!list.length){
      var empty;
      if(q) empty = h('div', { class: 'empty' }, [
        h('div', { class: 'empty-icon', 'aria-hidden': 'true', text: '🔎' }),
        h('p', { text: 'Không có game nào khớp “' + query.trim() + '”' + (filter === 'all' ? '.' : ' trong mục này.') }),
        h('button', { type: 'button', class: 'btn small', 'data-clear': '1', text: 'Xoá tìm kiếm' })
      ]);
      else if(filter === 'fav') empty = h('div', { class: 'empty' }, [
        h('div', { class: 'empty-icon', 'aria-hidden': 'true', text: '♡' }),
        h('p', { text: 'Chưa có game yêu thích. Chạm hình tim trên thẻ game để ghim vào đây.' }),
        h('button', { type: 'button', class: 'btn small', 'data-filter': 'all', text: 'Xem tất cả game' })
      ]);
      else empty = h('div', { class: 'empty' }, [h('p', { text: 'Mục này chưa có game.' })]);
      grid.appendChild(empty);
      return;
    }
    list.forEach(function(g){
      var fav = state.favorites.indexOf(g.id) !== -1, best = C.own(state.best, g.id) ? state.best[g.id].v : null;
      var meta = h('span', { class: 'card-meta' }, [h('span', { text: C.DUR_LABEL[g.dur] })]);
      if(!g.ready) meta.appendChild(h('span', { class: 'card-soon', text: 'Chưa chơi được' }));
      else if(best !== null && (g.score || !DEFS[g.id])) meta.appendChild(h('span', { class: 'card-best', text: 'Kỷ lục ' + fmtScore(g, best) }));
      grid.appendChild(h('div', { class: 'game-card' + (g.ready ? '' : ' soon') }, [
        h('button', { type: 'button', class: 'card-main', 'data-open': g.id, disabled: !g.ready,
          'aria-label': g.ready ? gameButtonLabel(g) : g.name + ' — chưa chơi được' }, [
          h('span', { class: 'card-icon', 'aria-hidden': 'true', text: g.icon }),
          h('span', { class: 'card-name', text: g.name }), h('span', { class: 'card-desc', text: g.desc }), meta
        ]),
        h('button', { type: 'button', class: 'fav-btn', 'data-fav': g.id, 'aria-pressed': fav ? 'true' : 'false',
          'aria-label': (fav ? 'Bỏ yêu thích ' : 'Yêu thích ') + g.name }, [svgIcon('heart')])
      ]));
    });
  }
  function setFilter(f){ filter = f; renderGames(); }
  $('chips').addEventListener('click', function(e){
    var b = e.target.closest('[data-filter]');
    if(b) setFilter(b.getAttribute('data-filter'));
  });
  function clearSearch(){
    query = '';
    $('searchInput').value = '';
    renderGames();
  }
  $('searchInput').addEventListener('input', function(){ query = this.value; renderGames(); });
  $('searchInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') this.blur(); });
  $('searchClear').addEventListener('click', function(){ clearSearch(); focusQuiet($('searchInput')); });
  $('gameGrid').addEventListener('click', function(e){
    var fav = e.target.closest('[data-fav]'), open = e.target.closest('[data-open]');
    if(fav){
      var id = fav.getAttribute('data-fav');
      update(function(s){
        var i = s.favorites.indexOf(id);
        if(i === -1) s.favorites.push(id); else s.favorites.splice(i, 1);
      });
      sfx('tap');
      renderGames();
      focusQuiet($('gameGrid').querySelector('[data-fav="' + id + '"]'));
    } else if(open && !open.disabled) openGame(open.getAttribute('data-open'));
    else if(e.target.closest('[data-clear]')) clearSearch();
    else if(e.target.closest('[data-filter]')) setFilter('all');
  });

  // ---------- Host chạy game ----------
  var game = null, playClock = 0, carrySeconds = 0;
  function gameActive(g){ return !!g && g === game && !g.paused && !g.ended && !g.failed; }

  function createHost(g){
    var dead = false, frozen = false, timers = {}, nextId = 1, loops = [], rafHandle = 0, lastTs = 0, offs = [], swipes = [];
    function guard(fn){
      return function(){
        if(dead) return undefined;
        try{ return fn.apply(null, arguments); }catch(e){ failGame(g, e); return undefined; }
      };
    }
    function arm(t){
      t.due = performance.now() + t.left;
      t.handle = window.setTimeout(function(){
        if(dead || frozen || timers[t.id] !== t) return;
        if(t.repeat){ t.left = t.delay; arm(t); } else delete timers[t.id];
        t.fn();
      }, t.left);
    }
    function addTimer(fn, delay, repeat){
      if(dead || typeof fn !== 'function') return 0;
      var ms = Math.max(repeat ? 16 : 0, Number(delay) || 0), t = { id: nextId++, fn: guard(fn), delay: ms, left: ms, repeat: repeat };
      timers[t.id] = t;
      if(!frozen) arm(t);
      return t.id;
    }
    function clearTimer(id){
      if(!C.own(timers, id)) return;
      window.clearTimeout(timers[id].handle);
      delete timers[id];
    }
    function kick(){
      if(!rafHandle && !dead && !frozen && loops.length) rafHandle = window.requestAnimationFrame(frame);
    }
    function frame(ts){
      rafHandle = 0;
      if(dead || frozen) return;
      // Tiết kiệm pin: bỏ khung tới sớm hơn 30ms → khoảng 30 khung hình/giây.
      if(lastTs && state.batterySaver && ts - lastTs < 30){ kick(); return; }
      var dt = lastTs ? Math.max(0, Math.min(50, ts - lastTs)) : 16;
      lastTs = ts;
      loops = loops.filter(function(l){ return l.on; });
      loops.forEach(function(l){ if(l.on && !dead && !frozen) l.fn(dt); });
      kick();
    }
    function on(el, type, fn, opts){
      if(dead) return function(){};
      if(!el || typeof el.addEventListener !== 'function' || el === window || el === document || el === document.body || el === html) throw new Error('host.on: chỉ nghe sự kiện trên phần tử của game, không nghe trên document/window');
      var safe = guard(fn), wrapped = function(e){ if(!frozen) safe(e); };
      el.addEventListener(type, wrapped, opts);
      var off = function(){ el.removeEventListener(type, wrapped, opts); };
      offs.push(off);
      return off;
    }
    // Lỗi ném trong .then() của game phải rơi vào lớp "Game gặp lỗi", không thành unhandled rejection.
    function guardThen(p){
      var then = p.then;
      p.then = function(ok, bad){
        return guardThen(then.call(p, typeof ok === 'function' ? guard(ok) : ok, typeof bad === 'function' ? guard(bad) : bad));
      };
      p['catch'] = function(bad){ return p.then(undefined, bad); };
      return p;
    }
    var api = {
      root: $('gameRoot'),
      size: function(){ var r = $('gameRoot').getBoundingClientRect(); return { w: Math.floor(r.width), h: Math.floor(r.height) }; },
      setStats: function(list){
        if(dead) return;
        g.custom = (Array.isArray(list) ? list : []).slice(0, g.info.score ? 2 : 4).map(function(x){ return { label: String(x && x.label), value: String(x && x.value) }; });
        renderGameStats();
      },
      setScore: function(n){
        if(dead || typeof n !== 'number' || !isFinite(n) || n === g.score) return;
        g.score = n;
        if(g.peak === null || n > g.peak) g.peak = n;
        renderGameStats();
      },
      end: function(result){ if(!dead) endRound(g, result || {}); },
      setTimeout: function(fn, ms){ return addTimer(fn, ms, false); },
      setInterval: function(fn, ms){ return addTimer(fn, ms, true); },
      clearTimeout: clearTimer,
      clearInterval: clearTimer,
      raf: function(fn){
        if(dead || typeof fn !== 'function') return function(){};
        var l = { fn: guard(fn), on: true };
        loops.push(l);
        kick();
        return function(){ l.on = false; };
      },
      on: on,
      swipe: function(el, cb){
        var sx = 0, sy = 0, down = false, safe = guard(cb);
        swipes.push(safe);
        on(el, 'pointerdown', function(e){ down = true; sx = e.clientX; sy = e.clientY; });
        on(el, 'pointercancel', function(){ down = false; });
        on(el, 'pointerup', function(e){
          if(!down) return;
          down = false;
          var dx = e.clientX - sx, dy = e.clientY - sy;
          if(Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          safe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        });
      },
      sfx: function(name){ if(!dead) sfx(name); },
      load: function(){
        var v = C.own(state.idle, g.id) ? state.idle[g.id] : null;
        return v ? JSON.parse(JSON.stringify(v)) : null;
      },
      save: function(obj){
        if(dead) return;
        var clean = C.cleanSave(obj);
        if(!clean) throw new Error('host.save: chỉ nhận object phẳng gồm các số hữu hạn ≥ 0');
        g.roundXp += play(function(s){ s.idle[g.id] = clean; return 0; });
      },
      best: function(){ return C.own(state.best, g.id) ? state.best[g.id].v : null; },
      confirm: function(opts){
        if(dead) return Promise.resolve(false);
        g.holds++;
        syncPause(g);
        return guardThen(askConfirm(opts || {}).then(function(ok){
          // Ván đã bị huỷ (chơi lại/đóng) trong lúc hỏi: không đụng tới bộ đếm của ván mới.
          if(dead) return false;
          g.holds--;
          syncPause(g);
          return ok;
        }));
      }
    };
    Object.defineProperty(api, 'saver', { enumerable: true, get: function(){ return !!state.batterySaver; } });
    return {
      api: api,
      freeze: function(){
        if(frozen) return;
        frozen = true;
        Object.keys(timers).forEach(function(id){
          window.clearTimeout(timers[id].handle);
          timers[id].left = Math.max(0, timers[id].due - performance.now());
        });
        if(rafHandle){ window.cancelAnimationFrame(rafHandle); rafHandle = 0; }
      },
      unfreeze: function(){
        if(!frozen || dead) return;
        frozen = false;
        lastTs = 0;
        Object.keys(timers).forEach(function(id){ arm(timers[id]); });
        kick();
      },
      // Phím mũi tên trên máy tính đi vào cùng callback với vuốt.
      key: function(dir){
        if(dead || frozen || !swipes.length) return false;
        swipes.forEach(function(cb){ cb(dir); });
        return true;
      },
      destroy: function(){
        dead = true;
        Object.keys(timers).forEach(function(id){ window.clearTimeout(timers[id].handle); });
        timers = {};
        if(rafHandle){ window.cancelAnimationFrame(rafHandle); rafHandle = 0; }
        loops = [];
        offs.forEach(function(off){ off(); });
        offs = []; swipes = [];
      }
    };
  }

  function renderGameStats(){
    var g = game;
    if(!g) return;
    var inf = g.info, best = C.own(state.best, g.id) ? state.best[g.id].v : null, items = [];
    if(inf.score){
      items.push({ label: inf.score.label || 'Điểm', value: g.score === null ? '—' : fmtScore(inf, g.score) });
      items.push({ label: 'Kỷ lục', value: best === null ? '—' : fmtScore(inf, best) });
    }
    items = items.concat(g.custom);
    var box = $('gameStats'), sig = items.map(function(x){ return x.label; }).join('\u0001');
    if(box.getAttribute('data-sig') !== sig){
      box.setAttribute('data-sig', sig);
      box.classList.toggle('tight', items.length > 3);
      box.textContent = '';
      items.forEach(function(x){
        box.appendChild(h('div', { class: 'gstat' }, [h('div', { class: 'gstat-label', text: x.label }), h('div', { class: 'gstat-value', text: x.value })]));
      });
      return;
    }
    items.forEach(function(x, i){
      var v = box.children[i].lastChild;
      if(v.textContent !== x.value) v.textContent = x.value;
    });
  }
  function callInst(g, name){
    if(!g.inst || typeof g.inst[name] !== 'function') return;
    try{ g.inst[name](); }catch(e){ failGame(g, e); }
  }
  // Một nguồn sự thật cho tạm dừng: lớp "Tạm dừng" đang hiện, hoặc có sheet đè lên game.
  function syncPause(g){
    if(g !== game || g.ended || g.failed || !g.host) return;
    var want = g.autoPaused || g.holds > 0;
    if(want && !g.paused){ g.paused = true; callInst(g, 'pause'); if(g.host) g.host.freeze(); }
    else if(!want && g.paused){ g.paused = false; g.host.unfreeze(); callInst(g, 'resume'); }
  }
  function lowBetter(g){ return !!g.info.score && g.info.score.better === 'low'; }
  function saveBest(g, v){
    if(!g.info.score || v === null) return false;
    var isNew = false;
    g.roundXp += play(function(s){ isNew = C.recordBest(s, g.def, v, Date.now()); return 0; });
    return isNew;
  }
  function teardownRound(g){
    // Bỏ dở giữa ván: game "càng cao càng tốt" giữ điểm cao nhất đã đạt trong ván; game "càng thấp
    // càng tốt" không ghi gì (số đang đếm dở sẽ thành kỷ lục không bao giờ phá được).
    if(!g.ended && !g.failed && !lowBetter(g)) saveBest(g, g.peak);
    if(g.inst && typeof g.inst.destroy === 'function'){ try{ g.inst.destroy(); }catch(e){ console.error(e); } }
    if(g.host) g.host.destroy();
    g.inst = null; g.host = null;
    $('gameRoot').textContent = '';
  }
  function startRound(g){
    g.ended = false; g.failed = false; g.paused = false; g.autoPaused = false; g.holds = 0; g.helpOpen = false; g.score = null; g.peak = null; g.custom = [];
    $('pauseLayer').hidden = true;
    $('errorLayer').hidden = true;
    $('gameRoot').textContent = '';
    $('gameStats').removeAttribute('data-sig');
    renderGameStats();
    g.host = createHost(g);
    try{
      g.inst = g.def.mount(g.host.api) || {};
    }catch(e){ failGame(g, e); }
  }
  function failGame(g, err){
    if(g !== game || g.failed) return;
    g.failed = true;
    console.error('GameHub: game "' + g.id + '" gặp lỗi', err);
    ['resultSheet', 'helpSheet'].forEach(closeSheet);
    if(confirmResolve) settleConfirm(false);
    if(g.inst && typeof g.inst.destroy === 'function'){ try{ g.inst.destroy(); }catch(e){} }
    if(g.host) g.host.destroy();
    g.inst = null; g.host = null;
    $('gameRoot').textContent = '';
    $('pauseLayer').hidden = true;
    $('errorLayer').hidden = false;
    focusQuiet($('btnErrRetry'));
  }
  function endRound(g, result){
    if(g !== game || g.ended || g.failed) return;
    if(typeof result.score === 'number' && isFinite(result.score)) g.score = result.score;
    var inf = g.info, old = C.own(state.best, g.id) ? state.best[g.id].v : null;
    g.ended = true;
    // Đóng băng mọi timer/raf của ván: không gì chạy tiếp phía sau bảng kết quả.
    if(g.host) g.host.freeze();
    // Game "càng thấp càng tốt" chỉ có kết quả khi ván không thua (mines trúng mìn ở giây 3 không phải kỷ lục 3 giây).
    var counted = !(lowBetter(g) && result.won === false);
    // Game "càng cao càng tốt" có điểm tụt được (oẳn tù tì, chọn màu): kỷ lục là mức cao nhất của ván,
    // giống hệt lúc bỏ dở — chơi hết ván không được thiệt hơn bỏ ngang.
    var finalScore = !lowBetter(g) && typeof g.peak === 'number' && typeof g.score === 'number' ? Math.max(g.peak, g.score) : g.score;
    var isNew = counted && saveBest(g, finalScore);
    renderGameStats();
    $('resultTitle').textContent = typeof result.message === 'string' && result.message ? result.message
      : result.won === true ? 'Bạn thắng!' : result.won === false ? 'Thua mất rồi' : 'Hết ván';
    var hasScore = !!inf.score && g.score !== null && counted;
    $('resultScore').hidden = !hasScore;
    $('resultScore').textContent = '';
    if(hasScore){
      $('resultScore').appendChild(document.createTextNode(fmtNum(g.score)));
      $('resultScore').appendChild(h('small', { text: ' ' + (inf.score.unit || (inf.score.label || 'điểm').toLowerCase()) }));
    }
    $('resultBadge').hidden = !isNew;
    var sub = !hasScore ? '' : isNew ? (old === null ? '' : 'Kỷ lục cũ: ' + fmtScore(inf, old)) : (old === null ? '' : 'Kỷ lục: ' + fmtScore(inf, old));
    $('resultSub').textContent = sub;
    $('resultSub').hidden = !sub;
    $('resultXp').textContent = '+' + g.roundXp + ' XP';
    $('resultXp').hidden = !g.roundXp;
    sfx(isNew || result.won === true ? 'win' : result.won === false ? 'bad' : 'good');
    openSheet('resultSheet');
  }
  function openGame(id){
    if(game || !DEFS[id]) return;
    var g = { id: id, def: DEFS[id], info: info(id), scrollY: window.scrollY, roundXp: 0, score: null, peak: null, custom: [], holds: 0,
      inst: null, host: null, ended: false, failed: false, paused: false, autoPaused: false };
    game = g;
    $('gameTitle').textContent = g.info.icon + ' ' + g.info.name;
    $('gameHelp').hidden = !g.info.help;
    $('gameScreen').hidden = false;
    html.classList.add('game-open');
    $('app').inert = true;
    $('tabbar').inert = true;
    g.roundXp += play(function(s){ return C.recordOpen(s, id, Date.now()); });
    sfx('tap');
    clearInterval(playClock);
    // Đếm theo nhịp 1 giây thay vì trừ Date.now(): chỉ cộng khi đang thật sự chơi,
    // và không nhảy vọt khi máy ngủ rồi thức.
    playClock = setInterval(function(){
      if(!gameActive(game) || document.visibilityState !== 'visible') return;
      if(++carrySeconds >= 15){
        carrySeconds -= 15;
        var cur = game;
        cur.roundXp += play(function(s){ return C.recordSeconds(s, cur.id, 15, Date.now()); });
      }
    }, 1000);
    startRound(g);
    focusQuiet($('gameClose'));
  }
  function restartGame(){
    var g = game;
    if(!g) return;
    ['resultSheet', 'helpSheet'].forEach(closeSheet);
    if(confirmResolve) settleConfirm(false);
    teardownRound(g);
    g.roundXp = 0;
    startRound(g);
  }
  function closeGame(toGames){
    var g = game;
    if(!g) return;
    ['resultSheet', 'helpSheet'].forEach(closeSheet);
    if(confirmResolve) settleConfirm(false);
    teardownRound(g);
    clearInterval(playClock);
    playClock = 0;
    game = null;
    $('gameScreen').hidden = true;
    $('pauseLayer').hidden = true;
    $('errorLayer').hidden = true;
    $('gameStats').textContent = '';
    $('gameStats').removeAttribute('data-sig');
    html.classList.remove('game-open');
    $('app').inert = false;
    $('tabbar').inert = false;
    if(toGames && currentTab !== 'games') switchTab('games');
    else {
      renderAll();
      // Trả đúng vị trí cuộn lúc mở game (nền không bị khoá bằng position:fixed).
      window.scrollTo(0, g.scrollY);
    }
    focusQuiet($(VIEWS[currentTab]).querySelector('[data-open="' + g.id + '"]'));
  }
  onTap($('gameClose'), function(){ closeGame(false); });
  onTap($('gameRestart'), restartGame);
  onTap($('btnAgain'), restartGame);
  onTap($('btnOther'), function(){ closeGame(true); });
  onTap($('btnErrRetry'), restartGame);
  onTap($('btnErrOther'), function(){ closeGame(true); });
  onTap($('btnResume'), function(){
    var g = game;
    if(!g) return;
    g.autoPaused = false;
    $('pauseLayer').hidden = true;
    syncPause(g);
  });
  function closeHelp(){
    closeSheet('helpSheet');
    var g = game;
    if(g && g.helpOpen){ g.helpOpen = false; g.holds--; syncPause(g); }
  }
  onTap($('gameHelp'), function(){
    var g = game;
    if(!g || g.helpOpen || !g.info.help) return;
    $('helpText').textContent = g.info.help;
    if(!g.ended && !g.failed){ g.helpOpen = true; g.holds++; syncPause(g); }
    openSheet('helpSheet', closeHelp);
  });
  onTap($('btnHelpOk'), closeHelp);

  // ---------- Cài đặt ----------
  function applyPrefs(){
    html.setAttribute('data-theme', state.theme);
    html.classList.toggle('saver', !!state.batterySaver);
  }
  function renderSettings(){
    $('swSound').setAttribute('aria-checked', state.sound ? 'true' : 'false');
    $('swSaver').setAttribute('aria-checked', state.batterySaver ? 'true' : 'false');
    var grid = $('themeGrid');
    grid.textContent = '';
    C.THEMES.forEach(function(t){
      var open = C.themeUnlocked(state, t.id), on = state.theme === t.id;
      var tile = h('button', { type: 'button', class: 'theme-tile', 'data-theme-id': t.id, 'aria-pressed': on ? 'true' : 'false', 'aria-disabled': open ? null : 'true' }, [
        h('span', { class: 'theme-swatch', 'aria-hidden': 'true' }), h('span', { class: 'theme-name', text: t.name }),
        h('span', { class: 'theme-state', text: on ? 'Đang dùng' : open ? 'Đã mở' : 'Mở ở cấp ' + t.level })
      ]);
      tile.style.setProperty('--sw1', THEME_SWATCH[t.id][0]);
      tile.style.setProperty('--sw2', THEME_SWATCH[t.id][1]);
      grid.appendChild(tile);
    });
    $('btnBackup').disabled = corrupt;
    $('backupHint').textContent = corrupt ? 'Dữ liệu đang lỗi — dùng “Lưu bản lỗi ra file” ở đầu trang' : 'Giữ tiến trình thành một file để cất hoặc chuyển máy';
    $('btnReset').hidden = corrupt;
    if(currentTab === 'settings' && $('diagBox').open) renderDiag();
  }
  $('swSound').addEventListener('click', function(){
    update(function(s){ s.sound = !s.sound; });
    renderSettings();
    sfx('good');
  });
  $('swSaver').addEventListener('click', function(){
    update(function(s){ s.batterySaver = !s.batterySaver; });
    applyPrefs();
    renderSettings();
  });
  $('themeGrid').addEventListener('click', function(e){
    var b = e.target.closest('[data-theme-id]');
    if(!b) return;
    var id = b.getAttribute('data-theme-id'), t = C.THEMES.filter(function(x){ return x.id === id; })[0];
    if(!C.themeUnlocked(state, id)){ toast('Lên cấp ' + t.level + ' để mở giao diện ' + t.name); return; }
    update(function(s){
      if(!C.themeUnlocked(s, id)) return;
      if(s.unlockedThemes.indexOf(id) === -1) s.unlockedThemes.push(id);
      s.theme = id;
    });
    applyPrefs();
    renderSettings();
    focusQuiet($('themeGrid').querySelector('[data-theme-id="' + id + '"]'));
  });

  function isStandalone(){
    return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  }
  function renderDiag(){
    var probe = getComputedStyle($('safeProbe')), bar = $('tabbar').getBoundingClientRect();
    // Lớp fixed có nền chạm mép trên có thể nhuộm dải thanh trạng thái iOS; không mở gì thì phải là 0.
    var topFixed = Array.prototype.filter.call(document.querySelectorAll('body *'), function(el){
      var cs = getComputedStyle(el);
      return cs.position === 'fixed' && cs.display !== 'none' && el.getBoundingClientRect().top <= 0 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    }).length;
    $('diagLine').textContent = [
      'standalone ' + (isStandalone() ? 'có' : 'không'),
      'màn hình ' + screen.width + '×' + screen.height + ' / viewport ' + window.innerWidth + '×' + window.innerHeight,
      'safe-area ' + parseFloat(probe.paddingTop) + '/' + parseFloat(probe.paddingBottom),
      'tab bar đáy ' + Math.round(bar.bottom),
      'lớp phủ chạm mép trên ' + topFixed,
      'offline ' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'sẵn sàng' : 'chưa'),
      'game ' + Object.keys(DEFS).length + '/' + C.GAME_IDS.length,
      'lưu ' + (corrupt ? 'lỗi' : saveFailed ? 'bị chặn' : 'ổn'),
      'hôm nay (giờ VN) ' + fmtDate(C.vnToday())
    ].join(' · ');
  }
  $('diagBox').addEventListener('toggle', function(){ if(this.open) renderDiag(); });

  // ---------- Sao lưu / khôi phục ----------
  function backupFile(){
    return new File([JSON.stringify(C.makeBackup(state), null, 1)], 'game-hub-' + C.vnToday() + '.json', { type: 'application/json' });
  }
  // Phải chạy đồng bộ ngay trong cú chạm: sau một await Safari bỏ user activation và
  // navigator.share() ném NotAllowedError. done(ok, errMsg): ok=false + errMsg=null = người dùng huỷ.
  function saveFile(file, done){
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
        navigator.share({ files: [file] }).then(function(){ done(true); }, function(err){
          if(err && err.name === 'AbortError') done(false, null);
          else done(false, 'Không mở được bảng chia sẻ (' + (err && err.name || 'lỗi') + '). Hãy thử lại.');
        });
        return;
      }
    }catch(e){}
    var url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Thu hồi ngay có thể làm hỏng lượt tải trên iOS Safari.
    setTimeout(function(){ URL.revokeObjectURL(url); }, 10000);
    done(true);
  }
  function clearDataErrors(){ ['dataError', 'brokenError', 'emptyError', 'legacyError'].forEach(function(id){ showError(id, null); }); $('legacyText').removeAttribute('aria-invalid'); }
  $('btnBackup').addEventListener('click', function(){
    if(corrupt) return;
    clearDataErrors();
    saveFile(backupFile(), function(ok, err){
      if(ok) toast('Đã lưu file tiến trình');
      else if(err) showError('dataError', err);
    });
  });
  $('btnBrokenSave').addEventListener('click', function(){
    if(!corrupt) return;
    clearDataErrors();
    saveFile(new File([brokenRaw || ''], 'game-hub-loi-' + C.vnToday() + '.json', { type: 'application/json' }), function(ok, err){
      if(ok) toast('Đã lưu bản lỗi ra file');
      else if(err) showError('brokenError', err);
    });
  });

  var restoreErrorId = 'dataError', pendingRestore = null;
  function pickRestore(errorId){
    restoreErrorId = errorId;
    clearDataErrors();
    $('restoreFile').value = '';
    $('restoreFile').click();
  }
  $('btnRestore').addEventListener('click', function(){ pickRestore('dataError'); });
  $('btnBrokenRestore').addEventListener('click', function(){ pickRestore('brokenError'); });
  $('btnEmptyRestore').addEventListener('click', function(){ pickRestore('emptyError'); });
  function summary(st){ return 'Cấp ' + st.level + ' · ' + fmtNum(st.plays) + ' lượt chơi'; }
  function closeRestore(){
    pendingRestore = null;
    closeSheet('restoreSheet');
  }
  function offerRestore(r){
    pendingRestore = r.state;
    var overwrite = !corrupt && C.hasProgress(state);
    $('restoreInfo').textContent = summary(r.state) + (r.legacy ? ' · đọc từ mã save bản cũ'
      : r.exportedAt ? ' · lưu ngày ' + fmtDate(C.vnToday(Date.parse(r.exportedAt))) : '') + '.';
    $('restoreWarn').textContent = corrupt ? 'Bản đang lỗi trên máy sẽ bị thay thế. Nếu chưa, hãy đóng bảng này và bấm “Lưu bản lỗi ra file” trước.'
      : 'Tiến trình đang có trên máy này (' + summary(state) + ') sẽ bị thay thế.';
    $('restoreWarn').hidden = !corrupt && !overwrite;
    $('btnRestoreSaveFirst').hidden = !overwrite;
    $('btnRestoreNow').textContent = overwrite ? 'Khôi phục, bỏ bản hiện tại' : 'Khôi phục';
    $('btnRestoreNow').className = 'btn ' + (overwrite ? 'danger-soft' : 'primary');
    showError('restoreError', null);
    openSheet('restoreSheet', closeRestore);
  }
  function applyRestore(){
    var next = pendingRestore && C.validateState(pendingRestore);
    if(!next){ showError('restoreError', 'Bản khôi phục không còn hợp lệ. Hãy chọn lại file.'); return; }
    next.updatedAt = Date.now();
    try{ localStorage.setItem(KEY, JSON.stringify(next)); }
    catch(e){ showError('restoreError', 'Máy không cho ghi dữ liệu (bộ nhớ đầy hoặc bị chặn). Tiến trình cũ vẫn còn nguyên.'); return; }
    state = next; corrupt = false; brokenRaw = null; saveFailed = false;
    try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){}); }catch(e){}
    closeRestore();
    $('legacyText').value = '';
    applyPrefs();
    renderAll();
    toast('Đã khôi phục tiến trình');
  }
  $('btnRestoreNow').addEventListener('click', applyRestore);
  $('btnRestoreCancel').addEventListener('click', closeRestore);
  $('btnRestoreSaveFirst').addEventListener('click', function(){
    showError('restoreError', null);
    saveFile(backupFile(), function(ok, err){
      if(ok) applyRestore();
      else if(err) showError('restoreError', err);
    });
  });
  $('restoreFile').addEventListener('change', function(){
    var file = this.files && this.files[0], errId = restoreErrorId;
    if(!file) return;
    if(file.size > 2 * 1024 * 1024){ showError(errId, 'File quá lớn (tối đa 2 MB) — đây không phải file sao lưu của GameHub.'); return; }
    file.text().then(function(text){
      var r = C.parseBackup(text, Date.now());
      if(r.error) showError(errId, r.error); else offerRestore(r);
    }, function(){ showError(errId, 'Không đọc được file này. Hãy thử chọn lại.'); });
  });
  $('btnLegacy').addEventListener('click', function(){
    clearDataErrors();
    var r = C.parseBackup($('legacyText').value, Date.now());
    if(r.error){
      $('legacyText').setAttribute('aria-invalid', 'true');
      showError('legacyError', r.error);
      return;
    }
    $('legacyText').blur();
    offerRestore(r);
  });

  function resetAll(){
    var next = C.defaultState();
    next.updatedAt = Date.now();
    // Ghi mặc định chứ không removeItem: khoá còn tồn tại thì bước chuyển dữ liệu 1.x không chạy lại.
    try{ localStorage.setItem(KEY, JSON.stringify(next)); }
    catch(e){ toast('Máy không cho ghi dữ liệu — chưa xoá được'); return; }
    state = next; corrupt = false; brokenRaw = null; saveFailed = false;
    clearDataErrors();
    applyPrefs();
    renderAll();
    toast('Đã xoá hết tiến trình');
  }
  function askReset(broken){
    askConfirm({ title: broken ? 'Bắt đầu lại từ đầu?' : 'Xoá hết tiến trình?',
      body: broken ? 'Bản dữ liệu đang lỗi sẽ bị thay bằng hồ sơ trống. Nên bấm “Lưu bản lỗi ra file” trước, phòng khi cần xem lại.'
        : 'Cấp, XP, kỷ lục, huy hiệu, mục yêu thích và tiến trình các game IDLE đều về 0. Còn muốn giữ thì Lưu file trước.',
      okLabel: 'Tiếp tục', cancelLabel: 'Thôi', danger: true }).then(function(ok){
      if(!ok) return null;
      return askConfirm({ title: 'Xoá thật chứ?', body: 'Không lấy lại được sau khi xoá.', okLabel: broken ? 'Xoá bản lỗi, bắt đầu lại' : 'Xoá hết tiến trình', cancelLabel: 'Giữ lại', danger: true });
    }).then(function(ok){ if(ok) resetAll(); });
  }
  $('btnReset').addEventListener('click', function(){ askReset(false); });
  $('btnBrokenReset').addEventListener('click', function(){ askReset(true); });
  function renderBanner(){ $('corruptBanner').hidden = !corrupt; }

  // ---------- Lịch sử cập nhật ----------
  var changelog = null;
  function fetchChangelog(){
    return fetch(CHANGELOG_URL, { cache: 'no-cache' }).then(function(res){
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function(doc){
      if(!doc || !Array.isArray(doc.entries)) throw new Error('shape');
      changelog = doc;
      $('versionText').textContent = 'Phiên bản ' + String(doc.version);
      return doc;
    });
  }
  function renderChangelog(){
    var body = $('changelogBody');
    body.textContent = '';
    if(changelog){
      changelog.entries.forEach(function(en){
        var ul = h('ul');
        (Array.isArray(en.changes) ? en.changes : []).forEach(function(c){ ul.appendChild(h('li', { text: String(c) })); });
        body.appendChild(h('div', { class: 'log-entry' }, [
          h('div', { class: 'log-head' }, [document.createTextNode('Phiên bản ' + String(en.version)), h('span', { text: C.isDay(en.date) ? fmtDate(en.date) : '' })]), ul
        ]));
      });
      return;
    }
    ['short', 'mid', '', 'short', 'mid'].forEach(function(c){ body.appendChild(h('div', { class: 'skel ' + c, 'aria-hidden': 'true' })); });
    body.appendChild(h('p', { class: 'sr-only', text: 'Đang tải…' }));
    fetchChangelog().then(renderChangelog, function(){
      body.textContent = '';
      body.appendChild(h('p', { class: 'sheet-text', text: 'Không tải được lịch sử cập nhật. Kiểm tra mạng rồi thử lại.' }));
      body.appendChild(h('div', { class: 'sheet-actions' }, [h('button', { type: 'button', class: 'btn', 'data-retry': '1', text: 'Thử lại' })]));
    });
  }
  $('btnChangelog').addEventListener('click', function(){
    openSheet('changelogSheet');
    renderChangelog();
  });
  $('changelogClose').addEventListener('click', function(){ closeSheet('changelogSheet'); });
  $('changelogBody').addEventListener('click', function(e){ if(e.target.closest('[data-retry]')) renderChangelog(); });

  // ---------- Bàn phím, hiển thị, nhiều tab ----------
  var ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  document.addEventListener('keydown', function(e){
    markGesture();
    var top = topSheet(), active = document.activeElement;
    if(e.key === 'Escape'){
      // Blur ô đang gõ: Esc xong Enter không được kích lại hành động cũ.
      if(active && /^(INPUT|TEXTAREA)$/.test(active.tagName)) active.blur();
      if(dismissTop(false)) e.preventDefault();
      else if(game){ closeGame(false); e.preventDefault(); }
      return;
    }
    if(e.key === 'Tab'){
      var layer = top ? $(top.id) : game ? $('gameScreen') : null;
      if(!layer) return;
      var items = Array.prototype.filter.call(layer.querySelectorAll('button,[href],input,textarea,[tabindex]:not([tabindex="-1"])'), function(el){
        return !el.disabled && !el.closest('[hidden]') && el.getClientRects().length;
      });
      if(!items.length){ e.preventDefault(); return; }
      var first = items[0], last = items[items.length - 1];
      if(!layer.contains(active)){ e.preventDefault(); focusQuiet(first); }
      else if(e.shiftKey && active === first){ e.preventDefault(); focusQuiet(last); }
      else if(!e.shiftKey && active === last){ e.preventDefault(); focusQuiet(first); }
      return;
    }
    if(game && !top && C.own(ARROWS, e.key) && gameActive(game) && game.host && game.host.key(ARROWS[e.key])) e.preventDefault();
  });
  function refreshFromStore(){
    if(game) return;
    loadState();
    applyPrefs();
    renderAll();
  }
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){
      var g = game;
      if(g && !g.ended && !g.failed && !g.autoPaused){
        g.autoPaused = true;
        $('pauseLayer').hidden = false;
        syncPause(g);
      }
    } else refreshFromStore();   // cũng để "hôm nay" sang ngày mới khi quay lại app
  });
  window.addEventListener('storage', function(e){ if(e.key === KEY || e.key === null) refreshFromStore(); });

  // Chỉ vẽ lại thẻ và danh sách; không đụng ô tìm kiếm hay ô dán mã đang gõ dở.
  function renderAll(){
    renderBanner();
    if(currentTab === 'home') renderHome();
    else if(currentTab === 'games') renderGames();
    else renderSettings();
  }

  loadState();
  applyPrefs();
  renderAll();
  fetchChangelog().catch(function(){ $('versionText').textContent = ''; });

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      // Đường dẫn tuyệt đối: đường dẫn tương đối trong register() tính theo URL của trang (…/html/), không theo file này.
      navigator.serviceWorker.register('/products/mini-game-hub/sw-mini-game-hub.js').catch(function(){});
    });
  }
})();
