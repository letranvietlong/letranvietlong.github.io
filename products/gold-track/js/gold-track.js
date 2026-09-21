(function(){
  "use strict";
  var STORAGE_KEY = "goldtrack_v1";

  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { transactions:[] };
      var parsed = JSON.parse(raw);
      return {
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : []
      };
    }catch(e){ return { transactions:[] }; }
  }
  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    markGistDirty();
    syncToGist();
  }

  var state = loadState();

  // ---------- helpers ----------
  function fmtVND(n){ return Math.round(n).toLocaleString('vi-VN'); }
  function fmtAmount(n){
    var r = Math.round(n*100)/100;
    return (r % 1 === 0) ? String(r) : r.toLocaleString('vi-VN',{maximumFractionDigits:2});
  }
  function parseDigits(str){
    var d = String(str||'').replace(/[^\d]/g,'');
    return d ? parseInt(d,10) : NaN;
  }
  function parseDecimal(str){
    var s = String(str||'').replace(',', '.').replace(/[^\d.]/g,'');
    return s ? parseFloat(s) : NaN;
  }
  function fmtDate(iso){
    var d = new Date(iso+"T00:00:00");
    if(isNaN(d)) return iso;
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    return dd+"/"+mm+"/"+d.getFullYear();
  }
  function pad2(n){ return String(n).padStart(2,'0'); }
  // Measures the active button's own box and slides the indicator pill to
  // match, rather than hardcoding a width per control — works for any
  // number of equal-width segments without a separate CSS rule each time.
  function positionSegmentedIndicator(segmentedEl){
    var indicator = segmentedEl.querySelector('.segmented-indicator');
    var active = segmentedEl.querySelector('button.active');
    if(!indicator || !active) return;
    indicator.style.width = active.offsetWidth + 'px';
    indicator.style.transform = 'translateX(' + active.offsetLeft + 'px)';
    indicator.classList.toggle('sell', active.getAttribute('data-type') === 'sell');
  }
  // Calendar day in the device's own timezone. Timestamps from the bot are
  // UTC; slicing those directly would put anything before 07:00 VN time on
  // the previous day.
  function localDayKey(dateOrIso){
    var d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
    return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate());
  }
  function todayISO(){ return localDayKey(new Date()); }
  function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  // escapeHtml only entity-escapes — it does nothing to stop a
  // javascript:/data: URI from executing on click. News article links come
  // from third-party RSS feeds (fetch_gold_news.py already rejects
  // non-http(s) links at the source, but this is a second, independent
  // check before anything from that data ever lands in an href).
  function safeUrl(u){
    return /^https?:\/\//i.test(String(u||'')) ? u : '#';
  }
  function txType(tx){ return tx.type === 'sell' ? 'sell' : 'buy'; }

  var toastEl = document.getElementById('toast');
  var toastMsgEl = document.getElementById('toastMsg');
  var toastActionEl = document.getElementById('toastAction');
  var toastTimer = null;
  var toastActionHandler = null;
  // action: { label, onClick } — shows an inline button (e.g. "Hoàn tác") and
  // keeps the toast up longer so there's time to tap it.
  function showToast(msg, type, action){
    toastMsgEl.textContent = msg;
    toastEl.className = 'toast show' + (type ? ' '+type : '');
    clearTimeout(toastTimer);
    if(toastActionHandler){ toastActionEl.removeEventListener('click', toastActionHandler); toastActionHandler = null; }
    if(action){
      toastActionEl.textContent = action.label;
      toastActionEl.hidden = false;
      toastActionHandler = function(){
        clearTimeout(toastTimer);
        toastEl.className = 'toast';
        action.onClick();
      };
      toastActionEl.addEventListener('click', toastActionHandler);
    } else {
      toastActionEl.hidden = true;
    }
    toastTimer = setTimeout(function(){ toastEl.className = 'toast'; toastActionEl.hidden = true; }, action ? 5000 : 2400);
  }

  // Deletes immediately (no confirm dialog) and offers a few seconds to undo
  // via the toast — the iOS Mail/swipe-to-delete pattern: the swipe/tap is
  // already a deliberate action, so a confirm dialog on top is redundant.
  // The toast can only show one undo action at a time, so a second delete
  // within the window must join the same pending batch rather than replace
  // it — otherwise the first transaction becomes unreachable and is lost
  // for good once its own toast is gone, defeating the point of undo.
  var pendingDeleteBatch = null;
  function deleteTxWithUndo(id){
    var idx = state.transactions.findIndex(function(t){ return t.id === id; });
    if(idx === -1) return;
    var tx = state.transactions[idx];
    state.transactions.splice(idx, 1);
    saveState();
    renderAll();

    if(!pendingDeleteBatch) pendingDeleteBatch = { items: [] };
    pendingDeleteBatch.items.push(tx);
    clearTimeout(pendingDeleteBatch.timer);
    pendingDeleteBatch.timer = setTimeout(function(){ pendingDeleteBatch = null; }, 5000);

    var batch = pendingDeleteBatch;
    var n = batch.items.length;
    showToast(n > 1 ? ('Đã xoá ' + n + ' giao dịch') : 'Đã xoá giao dịch', 'ok', {
      label: 'Hoàn tác',
      onClick: function(){
        clearTimeout(batch.timer);
        if(pendingDeleteBatch === batch) pendingDeleteBatch = null;
        // Where restored items land in the array doesn't matter — every
        // consumer (computePortfolio, renderTx, computePortfolioSeries,
        // renderStoreSummary) re-sorts or aggregates independent of array
        // order, so appending is sufficient and, unlike reconstructing
        // original indices, can't reorder two restored items relative to
        // each other.
        batch.items.forEach(function(restoredTx){ state.transactions.push(restoredTx); });
        saveState();
        renderAll();
        showToast(batch.items.length > 1 ? ('Đã khôi phục ' + batch.items.length + ' giao dịch') : 'Đã khôi phục giao dịch', 'ok');
      }
    });
  }

  // ---------- in-app confirm dialog (replaces window.confirm) ----------
  var confirmBackdrop = document.getElementById('confirmBackdrop');
  var confirmDialog = document.getElementById('confirmDialog');
  var confirmOkBtn = document.getElementById('confirmOk');
  var confirmCancelBtn = document.getElementById('confirmCancel');
  function showConfirm(message, opts){
    opts = opts || {};
    document.getElementById('confirmTitle').textContent = opts.title || 'Xác nhận';
    document.getElementById('confirmMessage').textContent = message;
    confirmOkBtn.textContent = opts.confirmText || 'Đồng ý';
    confirmCancelBtn.textContent = opts.cancelText || 'Huỷ';
    confirmOkBtn.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-gold');
    confirmBackdrop.classList.add('open');
    confirmDialog.classList.add('open');
    return new Promise(function(resolve){
      function cleanup(result){
        confirmBackdrop.classList.remove('open');
        confirmDialog.classList.remove('open');
        confirmOkBtn.removeEventListener('click', onOk);
        confirmCancelBtn.removeEventListener('click', onCancel);
        confirmBackdrop.removeEventListener('click', onCancel);
        resolve(result);
      }
      function onOk(){ cleanup(true); }
      function onCancel(){ cleanup(false); }
      confirmOkBtn.addEventListener('click', onOk);
      confirmCancelBtn.addEventListener('click', onCancel);
      confirmBackdrop.addEventListener('click', onCancel);
    });
  }

  // ---------- tab navigation ----------
  var TAB_VIEWS = { overview: 'viewOverview', history: 'viewHistory', news: 'viewNews', assistant: 'viewAssistant', settings: 'viewSettings' };
  function switchTab(tab){
    Object.keys(TAB_VIEWS).forEach(function(key){
      var el = document.getElementById(TAB_VIEWS[key]);
      el.hidden = (key !== tab);
      el.classList.remove('tab-enter');
    });
    document.querySelectorAll('.tabbar-btn').forEach(function(btn){
      var isActive = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('active', isActive);
      if(isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    if(tab === 'settings') refreshGistUI();
    if(tab === 'news') renderNews();
    if(tab === 'assistant') renderAssistant();
    // #txFilter lives inside a hidden tab-view (display:none), so its
    // offsetWidth is 0 until the tab is actually shown — any earlier
    // positioning attempt (e.g. at page load) would leave the pill at
    // zero width. Position it fresh now that layout is measurable.
    // Any .segmented living inside a hidden (display:none) tab-view has
    // offsetWidth 0 until that tab is actually shown, so an earlier
    // positioning attempt (e.g. at page load) would have left its pill at
    // zero width. Generic re-check on every tab switch — not just
    // hardcoded for #txFilter/history — so this doesn't quietly break again
    // the next time a .segmented is added to some other tab.
    document.querySelectorAll('.segmented').forEach(function(seg){
      if(seg.offsetWidth > 0) positionSegmentedIndicator(seg);
    });
    document.querySelector('.app').scrollTop = 0;
    var activeEl = document.getElementById(TAB_VIEWS[tab]);
    void activeEl.offsetWidth; // restart the animation even if the class never left
    activeEl.classList.add('tab-enter');
  }
  document.querySelectorAll('.tabbar-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ switchTab(btn.getAttribute('data-tab')); });
  });

  // ---------- GitHub Gist sync (personal, private backup + cross-device sync) ----------
  var GIST_CONFIG_KEY = "goldtrack_gist_v1";
  var GIST_FILENAME = "goldtrack-data.json";
  var GIST_DESCRIPTION = "GoldTrack backup data — managed automatically, do not edit manually";

  function loadGistConfig(){
    try{ return JSON.parse(localStorage.getItem(GIST_CONFIG_KEY)) || null; }catch(e){ return null; }
  }
  function saveGistConfig(cfg){
    if(cfg) localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(GIST_CONFIG_KEY);
    gistConfig = cfg;
  }
  var gistConfig = loadGistConfig();

  function githubApi(path, token, method, body){
    return fetch("https://api.github.com" + path, {
      method: method || "GET",
      headers: {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(res){
      return res.json().catch(function(){ return null; }).then(function(json){
        if(!res.ok) throw new Error((json && json.message) || ("GitHub API lỗi " + res.status));
        return json;
      });
    });
  }

  function buildGistFiles(){
    var content = JSON.stringify({ transactions: state.transactions }, null, 2);
    var files = {};
    files[GIST_FILENAME] = { content: content };
    return files;
  }

  // Real last-sync time, persisted — setGistStatus('synced') used to just
  // stamp new Date() at DISPLAY time, so reopening Settings hours after the
  // last actual sync silently relabeled that stale sync as "just now".
  var GIST_LAST_SYNC_KEY = "goldtrack_gist_last_sync_v1";
  // Survives app close, unlike an in-memory flag: a change made while
  // offline (or with an expired token) used to sit only in localStorage,
  // and the next launch's pull silently overwrote it with the older remote
  // copy. While this is set, local is the newer truth and must be pushed
  // up rather than pulled over.
  var GIST_DIRTY_KEY = "goldtrack_gist_dirty_v1";
  function markGistDirty(){
    if(!gistConfig) return;
    try{ localStorage.setItem(GIST_DIRTY_KEY, '1'); }catch(e){}
  }
  function hasUnsyncedChanges(){
    try{ return localStorage.getItem(GIST_DIRTY_KEY) === '1'; }catch(e){ return false; }
  }
  function markSynced(){
    try{ localStorage.removeItem(GIST_DIRTY_KEY); }catch(e){}
    localStorage.setItem(GIST_LAST_SYNC_KEY, new Date().toISOString());
    setGistStatus('synced');
  }
  var lastGistStatus = null; // remembered so reopening Settings doesn't clobber the real sync state
  function setGistStatus(kind, detail){
    if(kind !== 'disconnected') lastGistStatus = { kind: kind, detail: detail };
    var el = document.getElementById('gistStatusText');
    if(!el) return;
    el.style.color = '';
    if(kind === 'synced'){
      var iso = localStorage.getItem(GIST_LAST_SYNC_KEY);
      var d = iso ? new Date(iso) : new Date();
      el.textContent = "Đã đồng bộ " + pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear()+' lúc '+pad2(d.getHours())+':'+pad2(d.getMinutes());
    } else if(kind === 'syncing'){
      el.textContent = "Đang đồng bộ…";
    } else if(kind === 'error'){
      el.textContent = "Lỗi đồng bộ: " + detail;
      el.style.color = 'var(--red)';
    } else if(kind === 'connected'){
      el.textContent = "Đã kết nối GitHub Gist";
    } else {
      el.textContent = "Chưa kết nối — dữ liệu chỉ lưu trên máy này";
    }
  }

  function doGistPush(){
    return githubApi('/gists/' + gistConfig.gistId, gistConfig.token, 'PATCH', { files: buildGistFiles() });
  }

  var gistSyncTimer = null;
  function syncToGist(){
    if(!gistConfig) return;
    clearTimeout(gistSyncTimer);
    gistSyncTimer = setTimeout(function(){
      setGistStatus('syncing');
      doGistPush().then(markSynced).catch(function(e){ setGistStatus('error', e.message); });
    }, 400);
  }

  function refreshGistUI(){
    var connected = !!gistConfig;
    document.getElementById('gistConnectForm').hidden = connected;
    document.getElementById('gistConnectedActions').hidden = !connected;
    if(!connected){ setGistStatus('disconnected'); return; }
    if(lastGistStatus) setGistStatus(lastGistStatus.kind, lastGistStatus.detail);
    // lastGistStatus only lives in memory (this session) — on a fresh page
    // load it's null even though we may well have synced before, so fall
    // back to the persisted timestamp rather than the vague "connected".
    else if(localStorage.getItem(GIST_LAST_SYNC_KEY)) setGistStatus('synced');
    else setGistStatus('connected');
  }

  function pullFromGist(){
    if(!gistConfig) return Promise.resolve(false);
    return githubApi('/gists/' + gistConfig.gistId, gistConfig.token, 'GET').then(function(gist){
      var file = gist.files && gist.files[GIST_FILENAME];
      if(!file || !file.content) return false;
      var data = JSON.parse(file.content);
      state.transactions = Array.isArray(data.transactions) ? data.transactions : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      markSynced();
      return true;
    });
  }

  document.getElementById('btnGistConnect').addEventListener('click', function(){
    var token = document.getElementById('gistToken').value.trim();
    if(!token){ showToast('Nhập Personal Access Token trước', 'err'); return; }
    var btn = document.getElementById('btnGistConnect');
    btn.disabled = true; btn.textContent = 'Đang kết nối…';
    githubApi('/gists', token, 'GET').then(function(gists){
      var existing = (gists || []).find(function(g){ return g.description === GIST_DESCRIPTION; });
      if(existing) return { gistId: existing.id, isExisting: true };
      return githubApi('/gists', token, 'POST', { description: GIST_DESCRIPTION, public: false, files: buildGistFiles() })
        .then(function(g){ return { gistId: g.id, isExisting: false }; });
    }).then(function(result){
      var askProceed = (result.isExisting && state.transactions.length > 0)
        ? showConfirm('Tìm thấy dữ liệu sao lưu sẵn có trên GitHub. Tải về sẽ THAY THẾ dữ liệu hiện có trên máy này. Tiếp tục?', { title: 'Khôi phục dữ liệu', confirmText: 'Tải về', cancelText: 'Giữ máy này' })
        : Promise.resolve(true);
      return askProceed.then(function(proceed){
        saveGistConfig({ token: token, gistId: result.gistId });
        if(result.isExisting && proceed){
          return pullFromGist().then(function(){ renderAll(); });
        }
      });
    }).then(function(){
      document.getElementById('gistToken').value = '';
      refreshGistUI();
      showToast('Đã kết nối đồng bộ GitHub Gist', 'ok');
    }).catch(function(e){
      showToast('Kết nối thất bại: ' + e.message, 'err');
    }).finally(function(){
      btn.disabled = false; btn.textContent = 'Kết nối';
    });
  });

  document.getElementById('btnGistSyncNow').addEventListener('click', function(){
    if(!gistConfig) return;
    clearTimeout(gistSyncTimer); // an auto-sync debounce firing right after would just repeat this
    var btn = document.getElementById('btnGistSyncNow');
    btn.disabled = true;
    setGistStatus('syncing');
    doGistPush().then(function(){
      markSynced();
      showToast('Đã đồng bộ lên GitHub Gist', 'ok');
    }).catch(function(e){
      setGistStatus('error', e.message);
      showToast('Đồng bộ thất bại: ' + e.message, 'err');
    }).finally(function(){
      btn.disabled = false;
    });
  });

  document.getElementById('btnGistDisconnect').addEventListener('click', function(){
    showConfirm('Ngắt đồng bộ? Dữ liệu trên máy này vẫn được giữ, bản sao lưu trên GitHub Gist cũng không bị xoá.', { title: 'Ngắt kết nối đồng bộ', confirmText: 'Ngắt kết nối', danger: true }).then(function(ok){
      if(!ok) return;
      saveGistConfig(null);
      lastGistStatus = null;
      localStorage.removeItem(GIST_LAST_SYNC_KEY);
      refreshGistUI();
      showToast('Đã ngắt kết nối đồng bộ', 'ok');
    });
  });

  // ---------- live-format inputs ----------
  function bindThousandFormat(input){
    input.addEventListener('input', function(){
      var digits = parseDigits(input.value);
      input.value = isNaN(digits) ? '' : digits.toLocaleString('vi-VN');
    });
  }
  bindThousandFormat(document.getElementById('txPrice'));

  // ---------- sheets ----------
  // No document.body.style.overflow toggle here — body is permanently
  // overflow:hidden (see .app's CSS comment: it never scrolls, .app is the
  // only scrollable region), so that toggle was a no-op read on background
  // scroll-locking, and writing to body.style during a sheet open/close
  // transition is exactly the kind of extra layout churn that can leave
  // iOS Safari's dynamic viewport height (100dvh) stuck stale — a plausible
  // cause of the bottom tab bar intermittently sitting short of the real
  // bottom edge.
  function openSheet(sheetId, backdropId){
    document.getElementById(sheetId).classList.add('open');
    document.getElementById(backdropId).classList.add('open');
  }
  function closeSheet(sheetId, backdropId){
    document.getElementById(sheetId).classList.remove('open');
    document.getElementById(backdropId).classList.remove('open');
  }
  function wireSheet(sheetId, backdropId, closeBtnId){
    document.getElementById(closeBtnId).addEventListener('click', function(){ closeSheet(sheetId, backdropId); });
    document.getElementById(backdropId).addEventListener('click', function(){ closeSheet(sheetId, backdropId); });
  }
  wireSheet('txSheet','txBackdrop','txClose');
  wireSheet('versionSheet','versionBackdrop','versionClose');

  // Drag-to-dismiss via the handle only — the sheet body itself may scroll
  // (long forms, changelog list) so dragging is scoped to the handle's own
  // hit area rather than the whole sheet, avoiding a fight with that scroll.
  function enableSheetDrag(sheetId, backdropId){
    var sheet = document.getElementById(sheetId);
    var handle = sheet.querySelector('.sheet-handle-hit');
    var startY = 0, currentY = 0, dragging = false;
    handle.addEventListener('pointerdown', function(e){
      dragging = true; currentY = 0; startY = e.clientY;
      sheet.style.transition = 'none';
      try{ handle.setPointerCapture(e.pointerId); }catch(err){}
    });
    handle.addEventListener('pointermove', function(e){
      if(!dragging) return;
      currentY = Math.max(0, e.clientY - startY);
      sheet.style.transform = 'translateY(' + currentY + 'px)';
    });
    function endDrag(){
      if(!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if(currentY > 120) closeSheet(sheetId, backdropId);
      currentY = 0;
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }
  enableSheetDrag('txSheet','txBackdrop');
  enableSheetDrag('versionSheet','versionBackdrop');

  // ---------- version / update history ----------
  var changelogData = null;
  function loadChangelog(){
    return fetch('/products/gold-track/data/changelog.json', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(data){
      if(!data || !Array.isArray(data.entries)) return;
      changelogData = data;
      document.getElementById('btnVersion').textContent = 'v' + data.version;
    }).catch(function(){ /* keep placeholder badge */ });
  }
  function renderChangelog(){
    var el = document.getElementById('versionContent');
    if(!changelogData){
      el.innerHTML = '<p class="field-hint">Không tải được lịch sử cập nhật.</p>';
      return;
    }
    el.innerHTML = changelogData.entries.map(function(entry){
      return (
        '<div class="version-entry">' +
          '<div class="version-entry-head"><span class="version-num">v'+entry.version+'</span><span class="version-date">'+fmtDate(entry.date)+'</span></div>' +
          '<ul class="version-changes">' + entry.changes.map(function(c){ return '<li>'+escapeHtml(c)+'</li>'; }).join('') + '</ul>' +
        '</div>'
      );
    }).join('');
  }
  document.getElementById('btnVersion').addEventListener('click', function(){
    renderChangelog();
    openSheet('versionSheet','versionBackdrop');
  });

  // ---------- live price (auto-fetched, static JSON updated by GitHub Actions) ----------
  var liveData = null;
  var liveHistory = [];
  var liveLoading = true;

  // ---------- chart range selection (shared markup, independent state per chart) ----------
  var RANGE_DAYS = { '7':7, '30':30, '90':90, 'all':Infinity };
  var RANGE_LABELS = { '7':'7N', '30':'30N', '90':'90N', 'all':'Tất cả' };
  var PRICE_RANGE_KEY = "goldtrack_price_range_v1";
  var PORTFOLIO_RANGE_KEY = "goldtrack_portfolio_range_v1";
  var priceChartRange = localStorage.getItem(PRICE_RANGE_KEY) || 'all';
  var portfolioChartRange = localStorage.getItem(PORTFOLIO_RANGE_KEY) || 'all';
  if(!RANGE_DAYS.hasOwnProperty(priceChartRange)) priceChartRange = 'all';
  if(!RANGE_DAYS.hasOwnProperty(portfolioChartRange)) portfolioChartRange = 'all';
  var pnlGroupBy = 'month';
  function renderRangeTabs(id, activeKey){
    return '<div class="range-tabs" id="'+id+'" role="group" aria-label="Khoảng thời gian">' +
      Object.keys(RANGE_LABELS).map(function(key){
        return '<button type="button" data-range="'+key+'" class="'+(activeKey===key?'active':'')+'">'+RANGE_LABELS[key]+'</button>';
      }).join('') +
    '</div>';
  }
  document.getElementById('priceCard').addEventListener('click', function(e){
    var btn = e.target.closest('#priceRangeTabs button');
    if(!btn) return;
    priceChartRange = btn.getAttribute('data-range');
    localStorage.setItem(PRICE_RANGE_KEY, priceChartRange);
    renderPrice();
  });
  document.getElementById('summaryCard').addEventListener('click', function(e){
    var btn = e.target.closest('#portfolioRangeTabs button');
    if(!btn) return;
    portfolioChartRange = btn.getAttribute('data-range');
    localStorage.setItem(PORTFOLIO_RANGE_KEY, portfolioChartRange);
    renderSummary();
  });
  document.getElementById('pnlGroupBy').addEventListener('click', function(e){
    var btn = e.target.closest('button');
    if(!btn) return;
    document.querySelectorAll('#pnlGroupBy button').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    pnlGroupBy = btn.getAttribute('data-group');
    positionSegmentedIndicator(document.getElementById('pnlGroupBy'));
    renderPnlReport();
  });

  function getEffectivePrice(){
    if(liveData){
      return { buy: liveData.buy, sell: liveData.sell, at: liveData.fetchedAt };
    }
    return null;
  }

  function loadLiveData(){
    return Promise.all([
      fetch('/products/gold-track/data/gold-price.json', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
      fetch('/products/gold-track/data/gold-price-history.json', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
    ]).then(function(results){
      if(results[0]) liveData = results[0];
      if(Array.isArray(results[1])) liveHistory = results[1];
      liveLoading = false;
      renderAll();
      return !!results[0];
    });
  }

  // The old "Làm mới" button only re-read the committed JSON, which read as
  // "fetch a fresh price" and misled people. Instead, quietly re-read it
  // whenever the app comes back to the foreground.
  // Also re-sync --app-height here (function declared further down, hoisted):
  // a screen lock/unlock or app-switcher backgrounding doesn't reliably fire
  // visualViewport's own resize event the way the on-screen keyboard does,
  // so without this the tab bar could come back from a locked screen still
  // sized to whatever height was last known before the screen turned off,
  // leaving a gap or offset until something else forced a recompute.
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible'){
      syncAppHeight(); loadLiveData(); loadNews();
      // A push that failed while offline is never retried on its own —
      // coming back to the foreground is the natural moment to heal it.
      if(gistConfig && hasUnsyncedChanges()) syncToGist();
    }
  });
  window.addEventListener('pageshow', function(e){ syncAppHeight(); if(e.persisted){ loadLiveData(); loadNews(); } });

  // ---------- news (auto-fetched, static JSON updated hourly by GitHub Actions) ----------
  var newsData = null;
  function loadNews(){
    return fetch('/products/gold-track/data/gold-news.json', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }).then(function(data){
      if(data && Array.isArray(data.articles)) newsData = data;
      if(!document.getElementById('viewNews').hidden) renderNews();
      if(!document.getElementById('viewAssistant').hidden) renderAssistant();
    });
  }
  function fmtNewsDate(iso){
    if(!iso) return '';
    var d = new Date(iso);
    if(isNaN(d)) return '';
    var dayKey = localDayKey(d);
    var timeTxt = pad2(d.getHours())+':'+pad2(d.getMinutes());
    if(dayKey === localDayKey(new Date())) return 'Hôm nay ' + timeTxt;
    if(dayKey === localDayKey(new Date(Date.now()-86400000))) return 'Hôm qua ' + timeTxt;
    return fmtDate(dayKey) + ' ' + timeTxt;
  }
  function renderNewsSkeleton(){
    var one = '<div class="news-skeleton"><div class="news-skeleton-line"></div><div class="news-skeleton-line"></div></div>';
    return one + one + one;
  }
  function renderNews(){
    var list = document.getElementById('newsList');
    var updatedEl = document.getElementById('newsUpdatedAt');
    if(!newsData){
      updatedEl.textContent = '';
      list.innerHTML = renderNewsSkeleton();
      return;
    }
    updatedEl.textContent = newsData.fetchedAt ? 'Cập nhật ' + fmtNewsDate(newsData.fetchedAt) : '';
    var articles = newsData.articles || [];
    if(articles.length === 0){
      list.innerHTML =
        '<div class="empty-state">' +
          '<svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>' +
          '<p>Chưa có tin tức nào.</p>' +
        '</div>';
      return;
    }
    list.innerHTML = articles.map(function(a){
      return (
        '<a class="news-item" href="'+escapeHtml(safeUrl(a.link))+'" target="_blank" rel="noopener">' +
          '<div class="news-item-title">'+escapeHtml(a.title)+'</div>' +
          '<div class="news-item-meta">' +
            '<span class="news-item-source">'+escapeHtml(a.source||'')+'</span>' +
            '<span class="news-item-dot"></span>' +
            '<span>'+fmtNewsDate(a.publishedAt)+'</span>' +
          '</div>' +
        '</a>'
      );
    }).join('');
  }

  // ---------- assistant (rule-based trend read from data already in the app —
  // NOT a predictive model; see the disclaimer card in the tab itself) ----------
  function computeTrendStats(hist){
    var daily = buildDailyPriceSeries(hist);
    if(daily.length < 2) return null;
    var lastBuy = daily[daily.length-1].buy;
    // Returns the actual date compared against, not just a percentage —
    // "days" is a position N points back in a day-deduplicated array, which
    // only equals N calendar days if the bot recorded every single day with
    // no gap. Labeling this "N ngày qua" would assert a precision the data
    // doesn't guarantee if a day was ever missed; showing the real date
    // (same convention as the price card's day-over-day delta) is honest
    // regardless of gaps.
    function changeFromDaysAgo(days){
      var idx = daily.length - 1 - days;
      if(idx < 0) return null;
      var base = daily[idx].buy;
      if(!base) return null;
      return { pct: (lastBuy - base) / base * 100, day: daily[idx].day };
    }
    function movingAvg(days){
      var slice = daily.slice(-Math.min(days, daily.length));
      var sum = 0;
      slice.forEach(function(p){ sum += p.buy; });
      return slice.length ? sum / slice.length : null;
    }
    var upDays = 0, downDays = 0;
    for(var i=1;i<daily.length;i++){
      if(daily[i].buy > daily[i-1].buy) upDays++;
      else if(daily[i].buy < daily[i-1].buy) downDays++;
    }
    // Volatility: how wide a band the price has moved in recently, as a %
    // of the low — a flat +0.4% trend during a 5%-wide swing reads very
    // differently than the same trend during a 0.5%-wide one.
    var volSlice = daily.slice(-Math.min(14, daily.length));
    var volVals = volSlice.map(function(p){ return p.buy; });
    var volMin = Math.min.apply(null, volVals), volMax = Math.max.apply(null, volVals);
    var ma7 = daily.length >= 3 ? movingAvg(7) : null;
    var maDiffPct = (ma7 && lastBuy) ? (lastBuy - ma7) / ma7 * 100 : null;
    // Verdict signal, best available first: current-vs-recent-average is the
    // most stable read; fall back to the 7-point change, then to a plain
    // up/down day tally when there's too little history for either.
    var FLAT_THRESHOLD = 0.15; // %, below this reads as sideways rather than a real move
    var verdictPct = maDiffPct !== null ? maDiffPct : (changeFromDaysAgo(7) ? changeFromDaysAgo(7).pct : null);
    var verdict = 'flat';
    if(verdictPct !== null){
      verdict = verdictPct > FLAT_THRESHOLD ? 'up' : (verdictPct < -FLAT_THRESHOLD ? 'down' : 'flat');
    } else if(upDays !== downDays){
      verdict = upDays > downDays ? 'up' : 'down';
    }
    return {
      change7: changeFromDaysAgo(7),
      change30: changeFromDaysAgo(30),
      ma7: ma7,
      maDiffPct: maDiffPct,
      volatilityPct: volMin ? (volMax - volMin) / volMin * 100 : null,
      upDays: upDays,
      downDays: downDays,
      totalPoints: daily.length,
      verdict: verdict,
      verdictPct: verdictPct
    };
  }
  function trendRowHtml(label, pct){
    var cls = pct > 0 ? 'up' : (pct < 0 ? 'down' : '');
    return '<div class="trend-row"><span class="trend-label">'+label+'</span><span class="trend-val '+cls+'">'+(pct>=0?'+':'')+pct.toFixed(2)+'%</span></div>';
  }
  function renderAssistant(){
    var el = document.getElementById('assistantContent');
    var trend = computeTrendStats(liveHistory);
    var eff = getEffectivePrice();
    var p = computePortfolio();
    var html = '';

    if(trend){
      var vIcon = trend.verdict === 'up' ? '<path d="M12 19V6M6 12l6-6 6 6"/>' : (trend.verdict === 'down' ? '<path d="M12 5v13M6 12l6 6 6-6"/>' : '<path d="M5 12h14"/>');
      var vTitle = trend.verdict === 'up' ? 'Đang tăng' : (trend.verdict === 'down' ? 'Đang giảm' : 'Đi ngang');
      var vSub = trend.verdictPct !== null
        ? (trend.maDiffPct !== null ? 'So với trung bình gần đây: ' : 'So với ' + fmtDate(trend.change7.day).slice(0,5) + ': ') + (trend.verdictPct>=0?'+':'') + trend.verdictPct.toFixed(2) + '%'
        : trend.upDays + ' lần tăng / ' + trend.downDays + ' lần giảm trong ' + trend.totalPoints + ' lần ghi nhận gần đây';
      html += '<div class="card"><div class="assistant-section-title">Tổng quan xu hướng</div>' +
        '<div class="verdict-banner ' + trend.verdict + '">' +
          '<div class="verdict-badge"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + vIcon + '</svg></div>' +
          '<div><div class="verdict-title">' + vTitle + '</div><div class="verdict-sub">' + vSub + '</div></div>' +
        '</div></div>';
    }

    html += '<div class="card"><div class="assistant-section-title">Chi tiết xu hướng giá</div>';
    if(!trend){
      html += '<p class="field-hint">Cần thêm dữ liệu giá qua nhiều lần cập nhật hơn để phân tích xu hướng.</p>';
    } else {
      if(trend.change7) html += trendRowHtml('So với ' + fmtDate(trend.change7.day).slice(0,5), trend.change7.pct);
      if(trend.change30) html += trendRowHtml('So với ' + fmtDate(trend.change30.day).slice(0,5), trend.change30.pct);
      if(trend.maDiffPct !== null){
        html += trendRowHtml('So với trung bình gần đây', trend.maDiffPct);
      }
      if(trend.volatilityPct !== null){
        html += '<div class="trend-row"><span class="trend-label">Biên độ dao động</span><span class="trend-val">' + trend.volatilityPct.toFixed(2) + '%</span></div>';
      }
      html += '<div class="assistant-note">Trong '+trend.totalPoints+' lần ghi nhận gần đây: <b>'+trend.upDays+'</b> lần tăng, <b>'+trend.downDays+'</b> lần giảm so với lần trước đó.</div>';
    }
    html += '</div>';

    html += '<div class="card"><div class="assistant-section-title">So với giá vốn của bạn</div>';
    if(p.holdingAmount <= 0 || !(p.avgCost > 0)){
      html += '<p class="field-hint">Bạn chưa có vàng đang nắm giữ để so sánh với giá vốn.</p>';
    } else if(!eff){
      html += '<p class="field-hint">Chưa có giá hiện tại để so sánh.</p>';
    } else {
      var diffPct = (eff.buy - p.avgCost) / p.avgCost * 100;
      html += trendRowHtml('Giá mua vào hiện tại', diffPct);
      var note;
      if(diffPct > 0){
        note = 'Giá hiện tại <b>cao hơn</b> giá vốn trung bình của bạn '+Math.abs(diffPct).toFixed(2)+'%. Đây thường là lúc nhiều người cân nhắc chốt lời một phần.';
      } else if(diffPct < 0){
        note = 'Giá hiện tại <b>thấp hơn</b> giá vốn trung bình của bạn '+Math.abs(diffPct).toFixed(2)+'%. Đây thường là lúc nhiều người mua thêm để hạ giá vốn trung bình (DCA).';
      } else {
        note = 'Giá hiện tại đang bằng đúng giá vốn trung bình của bạn.';
      }
      html += '<div class="assistant-note">'+note+'</div>';
    }
    html += '</div>';

    html += '<div class="card"><div class="assistant-section-title">Tin tức có thể ảnh hưởng</div>';
    var articles = (newsData && newsData.articles) || [];
    if(articles.length === 0){
      html += '<p class="field-hint">Chưa có tin tức để tham khảo.</p>';
    } else {
      html += articles.slice(0, 4).map(function(a){
        return '<a class="mini-news-item" href="'+escapeHtml(safeUrl(a.link))+'" target="_blank" rel="noopener">' +
          '<span class="mini-news-title">'+escapeHtml(a.title)+'</span>' +
          '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>' +
        '</a>';
      }).join('');
    }
    html += '</div>';

    el.innerHTML = html;
  }

  function setFieldError(inputId, on){
    var field = document.getElementById(inputId).closest('.field');
    field.classList.toggle('invalid', !!on);
  }
  function clearFieldError(inputId){ setFieldError(inputId, false); }

  // ---------- portfolio math (moving-average cost method, buy + sell aware) ----------
  function computePortfolio(){
    var chrono = state.transactions.slice().sort(function(a,b){
      return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
    });
    var holdingAmount = 0, holdingCost = 0, realizedPL = 0, totalBuyCost = 0;
    var perTx = {};
    chrono.forEach(function(tx){
      if(txType(tx) === 'sell'){
        var avgCost = holdingAmount > 0 ? holdingCost / holdingAmount : 0;
        var sellAmt = Math.min(tx.amount, holdingAmount);
        var costOfSold = avgCost * sellAmt;
        // Book the P&L on the clamped amount, same as the holdings/cost
        // reduction. Using the raw tx.amount here meant an oversized sell
        // (only reachable now via imported or Gist-synced data, since the
        // form validates the timeline) invented profit on gold never held.
        var pl = sellAmt * (tx.price - avgCost);
        holdingCost -= costOfSold;
        holdingAmount -= sellAmt;
        if(holdingAmount < 1e-9){ holdingAmount = 0; holdingCost = 0; }
        realizedPL += pl;
        perTx[tx.id] = { avgCostAtSale: avgCost, pl: pl };
      } else {
        holdingCost += tx.amount * tx.price;
        holdingAmount += tx.amount;
        totalBuyCost += tx.amount * tx.price;
      }
    });
    return {
      holdingAmount: holdingAmount,
      holdingCost: holdingCost,
      avgCost: holdingAmount > 0 ? holdingCost / holdingAmount : 0,
      realizedPL: realizedPL,
      totalBuyCost: totalBuyCost,
      perTx: perTx
    };
  }

  function chronoSort(list){
    return list.slice().sort(function(a,b){
      return a.date.localeCompare(b.date) || (a.createdAt||0) - (b.createdAt||0);
    });
  }

  // Gold actually held at the moment a transaction sits in the timeline —
  // NOT the net total across all dates. A date-blind total let a sell dated
  // before its matching buy pass validation, and computePortfolio (which
  // does replay chronologically) then clamped that sell to zero: holdings
  // never dropped, yet the full sale was still booked as realized profit.
  function holdingsAsOf(dateStr, createdAt, excludeId){
    var held = 0;
    chronoSort(state.transactions).forEach(function(t){
      if(t.id === excludeId) return;
      var isBefore = t.date < dateStr || (t.date === dateStr && (t.createdAt||0) < createdAt);
      if(!isBefore) return;
      held += (txType(t) === 'sell' ? -t.amount : t.amount);
    });
    return Math.max(0, held);
  }

  // Replays a prospective ledger and returns the first sell that would run
  // the balance negative, or null if the whole timeline stays consistent.
  // Checks every point in time, so it also catches the reverse direction:
  // backdating a sell (or shrinking an earlier buy) that starves a sell
  // recorded later on.
  function findLedgerViolation(txList){
    var held = 0, chrono = chronoSort(txList);
    for(var i=0;i<chrono.length;i++){
      var t = chrono[i];
      if(txType(t) === 'sell'){
        if(t.amount > held + 1e-9) return { tx: t, available: held };
        held -= t.amount;
      } else {
        held += t.amount;
      }
    }
    return null;
  }

  // ---------- transaction sheet ----------
  var editingTxId = null;
  var selectedType = 'buy';
  var typeButtons = document.querySelectorAll('#txForm .segmented button');
  typeButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      typeButtons.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      selectedType = btn.getAttribute('data-type');
      updateTxFormLabels();
      positionSegmentedIndicator(btn.closest('.segmented'));
    });
  });
  // The sellable-amount hint depends on the chosen date now, so it has to
  // refresh when the date changes, not just when buy/sell is toggled.
  document.getElementById('txDate').addEventListener('change', function(){
    updateTxFormLabels();
    clearFieldError('txAmount');
  });
  function updateTxFormLabels(){
    var isSell = selectedType === 'sell';
    document.getElementById('txPriceLabel').textContent = isSell ? 'Giá bán (VNĐ / chỉ)' : 'Giá mua (VNĐ / chỉ)';
    document.getElementById('txDateLabel').textContent = isSell ? 'Ngày bán' : 'Ngày mua';
    document.getElementById('txStoreLabel').textContent = isSell ? 'Nơi bán' : 'Cửa hàng';
    document.getElementById('txSheetTitle').textContent = editingTxId ? 'Sửa giao dịch' : (isSell ? 'Thêm giao dịch bán vàng' : 'Thêm giao dịch mua vàng');
    // Holdings as of the date currently in the form, not the net total —
    // picking an earlier date genuinely changes how much there is to sell.
    var dateVal = document.getElementById('txDate').value || todayISO();
    var editing = editingTxId ? state.transactions.find(function(t){ return t.id === editingTxId; }) : null;
    var holdings = holdingsAsOf(dateVal, editing ? (editing.createdAt || 0) : Date.now(), editingTxId);
    document.getElementById('txAmountHint').textContent = isSell ? ('Ngày ' + fmtDate(dateVal) + ' có ' + fmtAmount(holdings) + ' chỉ để bán.') : '';
  }
  function setType(type){
    selectedType = type;
    typeButtons.forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-type') === type); });
    positionSegmentedIndicator(document.querySelector('#txForm .segmented'));
  }

  function openAddTx(){
    editingTxId = null;
    document.getElementById('txDeleteBtn').hidden = true;
    document.getElementById('txAmount').value = '';
    document.getElementById('txPrice').value = '';
    document.getElementById('txStore').value = '';
    document.getElementById('txAddress').value = '';
    document.getElementById('txNote').value = '';
    document.getElementById('txDate').value = todayISO();
    document.getElementById('txDate').max = todayISO();
    setType('buy');
    updateTxFormLabels();
    clearFieldError('txAmount'); clearFieldError('txPrice');
    openSheet('txSheet','txBackdrop');
  }
  function openEditTx(tx){
    editingTxId = tx.id;
    document.getElementById('txDeleteBtn').hidden = false;
    document.getElementById('txAmount').value = fmtAmount(tx.amount);
    document.getElementById('txPrice').value = fmtVND(tx.price);
    document.getElementById('txStore').value = tx.store || '';
    document.getElementById('txAddress').value = tx.address || '';
    document.getElementById('txNote').value = tx.note || '';
    document.getElementById('txDate').value = tx.date;
    document.getElementById('txDate').max = todayISO();
    setType(txType(tx));
    updateTxFormLabels();
    clearFieldError('txAmount'); clearFieldError('txPrice');
    openSheet('txSheet','txBackdrop');
  }
  document.getElementById('fabAdd').addEventListener('click', openAddTx);

  document.getElementById('txForm').addEventListener('submit', function(e){
    e.preventDefault();
    var amount = parseDecimal(document.getElementById('txAmount').value);
    var price = parseDigits(document.getElementById('txPrice').value);
    var store = document.getElementById('txStore').value.trim();
    var address = document.getElementById('txAddress').value.trim();
    var note = document.getElementById('txNote').value.trim();
    var date = document.getElementById('txDate').value;
    var ok = true;
    if(!(amount > 0)){ setFieldError('txAmount', true); ok = false; } else clearFieldError('txAmount');
    if(!(price > 0)){ setFieldError('txPrice', true); ok = false; } else clearFieldError('txPrice');
    // Validate the whole prospective timeline, not just this one row: a buy
    // edited downwards (or a backdated sell) can invalidate a DIFFERENT sell
    // recorded later, so both directions have to be checked here.
    if(ok){
      var editing = editingTxId ? state.transactions.find(function(t){ return t.id === editingTxId; }) : null;
      var candidate = {
        id: editingTxId || '__candidate__',
        type: selectedType,
        amount: amount,
        date: date,
        createdAt: editing ? (editing.createdAt || 0) : Date.now()
      };
      var prospective = state.transactions.filter(function(t){ return t.id !== editingTxId; }).concat([candidate]);
      var violation = findLedgerViolation(prospective);
      if(violation){
        setFieldError('txAmount', true);
        document.getElementById('txAmountError').textContent = violation.tx.id === candidate.id
          ? 'Ngày ' + fmtDate(date) + ' bạn chỉ có ' + fmtAmount(violation.available) + ' chỉ để bán.'
          : 'Thay đổi này khiến giao dịch bán ngày ' + fmtDate(violation.tx.date) + ' không còn đủ vàng (chỉ còn ' + fmtAmount(violation.available) + ' chỉ).';
        ok = false;
      }
    }
    if(!ok) return;
    document.getElementById('txAmountError').textContent = 'Nhập số lượng lớn hơn 0.';
    if(editingTxId){
      var tx = state.transactions.find(function(t){ return t.id === editingTxId; });
      tx.amount = amount; tx.price = price; tx.store = store; tx.address = address; tx.note = note; tx.date = date; tx.type = selectedType;
    } else {
      state.transactions.push({ id: uid(), type: selectedType, amount: amount, price: price, store: store, address: address, note: note, date: date, createdAt: Date.now() });
    }
    saveState();
    renderAll();
    closeSheet('txSheet','txBackdrop');
    showToast(editingTxId ? 'Đã cập nhật giao dịch' : 'Đã thêm giao dịch', 'ok');
  });

  document.getElementById('txDeleteBtn').addEventListener('click', function(){
    if(!editingTxId) return;
    closeSheet('txSheet','txBackdrop');
    deleteTxWithUndo(editingTxId);
  });

  // ---------- settings ----------
  document.getElementById('btnExport').addEventListener('click', function(){
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'goldtrack-backup-' + todayISO() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã xuất file sao lưu', 'ok');
  });
  document.getElementById('btnImport').addEventListener('click', function(){
    document.getElementById('fileImport').click();
  });
  function isValidTx(t){
    return t && typeof t === 'object' &&
      typeof t.id === 'string' && t.id &&
      (t.type === 'buy' || t.type === 'sell') &&
      typeof t.amount === 'number' && isFinite(t.amount) && t.amount > 0 &&
      typeof t.price === 'number' && isFinite(t.price) && t.price > 0 &&
      typeof t.date === 'string' && !isNaN(new Date(t.date+"T00:00:00"));
  }
  document.getElementById('fileImport').addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var data;
      try{
        data = JSON.parse(reader.result);
        if(!data || typeof data !== 'object') throw new Error('bad');
      }catch(err){
        showToast('File không đúng định dạng JSON', 'err');
        e.target.value = '';
        return;
      }

      var rawTx = Array.isArray(data.transactions) ? data.transactions : [];
      var validTx = rawTx.filter(isValidTx);
      var skipped = rawTx.length - validTx.length;

      if(rawTx.length > 0 && validTx.length === 0){
        showToast('File không chứa giao dịch hợp lệ nào — có thể sai file', 'err');
        e.target.value = '';
        return;
      }

      var msg = 'Nhập ' + validTx.length + ' giao dịch từ file này sẽ THAY THẾ toàn bộ dữ liệu hiện có trên máy (' + state.transactions.length + ' giao dịch). Tiếp tục?';
      if(skipped > 0) msg += '\n(' + skipped + ' dòng trong file bị bỏ qua vì thiếu dữ liệu hoặc sai định dạng.)';
      showConfirm(msg, { title: 'Nhập dữ liệu', confirmText: 'Nhập, ghi đè', danger: true }).then(function(ok){
        e.target.value = '';
        if(!ok) return;
        state = { transactions: validTx };
        saveState();
        renderAll();
        showToast(skipped > 0 ? 'Đã nhập ' + validTx.length + ' giao dịch, bỏ qua ' + skipped + ' dòng lỗi' : 'Đã nhập dữ liệu thành công', 'ok');
      });
    };
    reader.readAsText(file);
  });
  document.getElementById('btnClearAll').addEventListener('click', function(){
    showConfirm('Xoá toàn bộ dữ liệu? Hành động này không thể hoàn tác.', { title: 'Xoá toàn bộ dữ liệu', confirmText: 'Xoá hết', danger: true }).then(function(ok){
      if(!ok) return;
      state = { transactions:[] };
      saveState();
      renderAll();
      showToast('Đã xoá toàn bộ dữ liệu', 'ok');
    });
  });

  // ---------- render: price card ----------
  // Small up/down/flat % chip for a price box, comparing to the previous
  // local day's last reading (not the previous 30-minute poll — the bot only
  // records real changes now, but a day-over-day figure is what actually
  // answers "is gold up or down?"). No VND amount, just direction + %.
  function priceChangeHtml(key, current){
    var daily = aggregateDailyHistory(liveHistory, 2);
    var todayKey = localDayKey(new Date());
    if(daily.length !== 2 || daily[1].day !== todayKey) return '';
    var prevVal = daily[0][key];
    if(!prevVal) return '';
    var diff = current - prevVal;
    var pct = diff / prevVal * 100;
    var cls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');
    var arrowPath = diff > 0 ? '<path d="M12 19V6M6 12l6-6 6 6"/>' : (diff < 0 ? '<path d="M12 5v13M6 12l6 6 6-6"/>' : '<path d="M5 12h14"/>');
    return '<div class="pb-change '+cls+'"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'+arrowPath+'</svg>'+(pct>=0?'+':'')+pct.toFixed(2)+'%</div>';
  }

  function renderPrice(){
    var el = document.getElementById('priceContent');
    var subEl = document.getElementById('priceUpdatedSub');
    var eff = getEffectivePrice();

    if(!eff){
      subEl.textContent = liveLoading ? 'Đang tải giá vàng…' : 'Chưa lấy được giá tự động';
      el.innerHTML =
        '<div class="price-empty">' +
          '<p>'+(liveLoading ? 'Đang tải giá vàng…' : 'Chưa lấy được giá tự động.')+'</p>' +
        '</div>';
      return;
    }
    var d = new Date(eff.at);
    var whenTxt = pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear()+' lúc '+pad2(d.getHours())+':'+pad2(d.getMinutes());
    subEl.textContent = 'Cập nhật lần cuối ' + whenTxt;

    var p = computePortfolio();
    var avgCost = p.holdingAmount > 0 ? p.avgCost : null;

    el.innerHTML =
      '<div class="price-grid">' +
        '<div class="price-box"><div class="pb-label">Mua vào</div><div class="pb-val">'+fmtVND(eff.buy)+'<span class="pb-unit">đ/chỉ</span></div>'+priceChangeHtml('buy', eff.buy)+'</div>' +
        '<div class="price-box"><div class="pb-label">Bán ra</div><div class="pb-val">'+fmtVND(eff.sell)+'<span class="pb-unit">đ/chỉ</span></div>'+priceChangeHtml('sell', eff.sell)+'</div>' +
      '</div>' +
      '<div class="chart-head">' +
        '<span class="chart-title">Xu hướng giá mua vào</span>' +
      '</div>' +
      renderRangeTabs('priceRangeTabs', priceChartRange) +
      '<div class="chart-wrap">' + renderChart(liveHistory, priceChartRange, avgCost) + '</div>';
  }

  function buildDailyPriceSeries(hist){
    var byDay = {};
    hist.forEach(function(p){ byDay[localDayKey(p.at)] = p; }); // last entry of each local day wins (chronological order)
    return Object.keys(byDay).sort().map(function(day){
      return { buy: byDay[day].buy, sell: byDay[day].sell, day: day };
    });
  }
  function aggregateDailyHistory(hist, days){
    return buildDailyPriceSeries(hist).slice(-days);
  }

  // Maps a daily series to SVG coordinates. minOverride/maxOverride let two
  // series (e.g. portfolio value + cost) share one Y axis.
  function mapPointsToSvg(daily, key, w, h, padTop, padBottom, padX, minOverride, maxOverride){
    var vals = daily.map(function(p){ return p[key]; });
    var min = minOverride != null ? minOverride : Math.min.apply(null, vals);
    var max = maxOverride != null ? maxOverride : Math.max.apply(null, vals);
    if(min === max){ min -= 1; max += 1; }
    var plotH = h - padTop - padBottom;
    var n = daily.length;
    return daily.map(function(p, i){
      var x = n === 1 ? w/2 : padX + (i/(n-1)) * (w - padX*2);
      var y = padTop + plotH - ((p[key]-min)/(max-min)) * plotH;
      return { x: x, y: y, day: p.day };
    });
  }
  // Evenly-spaced label indices so wide ranges (90d/all) don't overlap text.
  function pickLabelIndices(n, maxLabels){
    if(n <= maxLabels) return Array.from({length:n}, function(_,i){ return i; });
    var idxs = [];
    for(var i=0;i<maxLabels;i++){ idxs.push(Math.round(i*(n-1)/(maxLabels-1))); }
    return idxs.filter(function(v,i,a){ return a.indexOf(v) === i; });
  }

  // The bright yellow tuned for dark cards reads as a pale, low-contrast
  // smudge on a light card, so the price line/dots pick a deeper amber when
  // the system is in Light mode. Everything else on the chart already
  // themes for free via CSS custom properties.
  function isLightScheme(){
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }
  function renderChart(hist, rangeKey, avgCost){
    var days = RANGE_DAYS[rangeKey] || 7;
    var daily = aggregateDailyHistory(hist, days);
    if(daily.length < 2){
      return '<div class="chart-empty">Cần thêm dữ liệu qua nhiều ngày hơn để xem xu hướng</div>';
    }
    var light = isLightScheme();
    var lineColor = light ? '#B45309' : '#FBBF24';
    var fillColor = light ? '#B45309' : '#F59E0B';
    var dotColor = light ? '#92400E' : '#F59E0B';
    var lastDotColor = light ? '#B45309' : '#FDE68A';
    var w = 300, h = 92, padTop = 8, padBottom = 24, padX = 20;
    var n = daily.length;

    // Extend the Y range to include the average cost so its reference line
    // never falls off-chart even when the current price has moved well
    // above or below it. A margin beyond the line itself keeps it from
    // sitting flush against the plot edge, which used to read as a
    // disconnected artifact rather than a chart element.
    var hasAvgLine = typeof avgCost === 'number' && avgCost > 0;
    var vals = daily.map(function(p){ return p.buy; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if(hasAvgLine){
      // Solved so the margin itself is exactly MARGIN_FRAC of the *final*
      // range — a margin sized off the pre-extension span shrinks to nothing
      // once avgCost sits far outside it, leaving the line flush on the edge.
      var MARGIN_FRAC = 0.15;
      var k = MARGIN_FRAC / (1 - MARGIN_FRAC);
      if(avgCost > max) max = avgCost + k * Math.max(avgCost - min, 1);
      else if(avgCost < min) min = avgCost - k * Math.max(max - avgCost, 1);
    }
    if(min === max){ min -= 1; max += 1; }

    var pts = mapPointsToSvg(daily, 'buy', w, h, padTop, padBottom, padX, min, max);
    var plotBottom = padTop + (h - padTop - padBottom);
    var line = pts.map(function(p,i){ return (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');
    var area = line + ' L'+pts[n-1].x.toFixed(1)+','+plotBottom+' L'+pts[0].x.toFixed(1)+','+plotBottom+' Z';
    var showAllDots = n <= 10;
    var dots = pts.map(function(p,i){
      if(!showAllDots && i!==0 && i!==n-1) return '';
      var isLast = i===n-1;
      return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(isLast?3:2)+'" fill="'+(isLast?lastDotColor:dotColor)+'"/>';
    }).join('');
    var labelIdxs = pickLabelIndices(n, 7);
    var labels = labelIdxs.map(function(i){
      var p = pts[i];
      var d = new Date(p.day+"T00:00:00");
      var lbl = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
      return '<text class="chart-axis-label" x="'+p.x.toFixed(1)+'" y="'+(h-6)+'" font-size="9" text-anchor="middle">'+lbl+'</text>';
    }).join('');

    var avgLineSvg = '';
    if(hasAvgLine){
      var plotH = h - padTop - padBottom;
      var avgY = padTop + plotH - ((avgCost-min)/(max-min))*plotH;
      avgLineSvg = '<line class="chart-cost-line" x1="'+padX+'" x2="'+(w-padX)+'" y1="'+avgY.toFixed(1)+'" y2="'+avgY.toFixed(1)+'" stroke-width="1.4" stroke-dasharray="4 3"/>';
    }

    return '<svg class="chart-svg" viewBox="0 0 '+w+' '+h+'">' +
      '<defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="'+fillColor+'" stop-opacity="0.35"/><stop offset="1" stop-color="'+fillColor+'" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="'+area+'" fill="url(#chartFill)"/>' +
      avgLineSvg +
      '<path d="'+line+'" fill="none" stroke="'+lineColor+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      dots + labels +
    '</svg>' +
    (hasAvgLine ?
      '<div class="chart-legend">' +
        '<span class="chart-legend-item"><span class="chart-legend-dot" style="background:'+lineColor+'"></span>Giá mua vào</span>' +
        '<span class="chart-legend-item"><span class="chart-legend-dash"></span>Giá vốn TB của bạn</span>' +
      '</div>'
    : '');
  }

  // ---------- portfolio value over time (holding amount x historical price, day by day) ----------
  function computePortfolioSeries(rangeKey){
    if(state.transactions.length === 0) return [];
    var priceSeries = buildDailyPriceSeries(liveHistory);
    if(priceSeries.length === 0) return [];

    var chrono = state.transactions.slice().sort(function(a,b){
      return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
    });
    var firstTxDay = chrono[0].date;
    var firstPriceDay = priceSeries[0].day;
    var startDay = firstTxDay > firstPriceDay ? firstTxDay : firstPriceDay; // before this we either have no price data or no holdings
    var today = todayISO();
    var days = RANGE_DAYS[rangeKey] || Infinity;
    if(days !== Infinity){
      var cutoff = localDayKey(new Date(Date.now() - (days-1)*86400000));
      if(cutoff > startDay) startDay = cutoff;
    }
    if(startDay > today) return [];

    var holdingAmount = 0, holdingCost = 0;
    function applyTx(tx){
      if(txType(tx) === 'sell'){
        var avgCost = holdingAmount > 0 ? holdingCost / holdingAmount : 0;
        var sellAmt = Math.min(tx.amount, holdingAmount);
        holdingCost -= avgCost * sellAmt;
        holdingAmount -= sellAmt;
        if(holdingAmount < 1e-9){ holdingAmount = 0; holdingCost = 0; }
      } else {
        holdingCost += tx.amount * tx.price;
        holdingAmount += tx.amount;
      }
    }
    var txIdx = 0;
    while(txIdx < chrono.length && chrono[txIdx].date < startDay){ applyTx(chrono[txIdx]); txIdx++; }

    var priceIdx = 0, lastKnownBuy = null;
    while(priceIdx < priceSeries.length && priceSeries[priceIdx].day <= startDay){ lastKnownBuy = priceSeries[priceIdx].buy; priceIdx++; }

    var series = [];
    var d = new Date(startDay+"T00:00:00");
    var endD = new Date(today+"T00:00:00");
    var guard = 0;
    while(d <= endD && guard < 2000){
      guard++;
      var dayKey = localDayKey(d);
      while(txIdx < chrono.length && chrono[txIdx].date === dayKey){ applyTx(chrono[txIdx]); txIdx++; }
      while(priceIdx < priceSeries.length && priceSeries[priceIdx].day <= dayKey){ lastKnownBuy = priceSeries[priceIdx].buy; priceIdx++; }
      if(lastKnownBuy != null){
        series.push({ day: dayKey, value: holdingAmount * lastKnownBuy, cost: holdingCost });
      }
      d = new Date(d.getTime() + 86400000);
    }
    return series;
  }

  function renderPortfolioChart(rangeKey){
    var series = computePortfolioSeries(rangeKey);
    if(series.length < 2){
      return '<div class="chart-empty">Cần thêm dữ liệu qua nhiều ngày hơn để xem giá trị danh mục theo thời gian</div>';
    }
    var w = 300, h = 110, padTop = 10, padBottom = 24, padX = 20;
    var allVals = series.map(function(p){ return p.value; }).concat(series.map(function(p){ return p.cost; }));
    var min = Math.min.apply(null, allVals), max = Math.max.apply(null, allVals);
    if(min === max){ min -= 1; max += 1; }
    var n = series.length;
    var valuePts = mapPointsToSvg(series, 'value', w, h, padTop, padBottom, padX, min, max);
    var costPts = mapPointsToSvg(series, 'cost', w, h, padTop, padBottom, padX, min, max);
    var plotBottom = padTop + (h - padTop - padBottom);
    var lastVal = series[n-1].value, lastCost = series[n-1].cost;
    var up = lastVal >= lastCost;
    var light = isLightScheme();
    var lineColor = up ? (light ? '#059669' : '#34D399') : (light ? '#DC2626' : '#FB7185');

    var valueLine = valuePts.map(function(p,i){ return (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');
    var area = valueLine + ' L'+valuePts[n-1].x.toFixed(1)+','+plotBottom+' L'+valuePts[0].x.toFixed(1)+','+plotBottom+' Z';
    var costLine = costPts.map(function(p,i){ return (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');

    var showAllDots = n <= 10;
    var dots = valuePts.map(function(p,i){
      if(!showAllDots && i!==0 && i!==n-1) return '';
      var isLast = i===n-1;
      return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(isLast?3:2)+'" fill="'+lineColor+'"/>';
    }).join('');

    var labelIdxs = pickLabelIndices(n, 7);
    var labels = labelIdxs.map(function(i){
      var p = valuePts[i];
      var d = new Date(series[i].day+"T00:00:00");
      var lbl = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
      return '<text class="chart-axis-label" x="'+p.x.toFixed(1)+'" y="'+(h-6)+'" font-size="9" text-anchor="middle">'+lbl+'</text>';
    }).join('');

    return '<svg class="chart-svg" viewBox="0 0 '+w+' '+h+'">' +
      '<defs><linearGradient id="pvChartFill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="'+lineColor+'" stop-opacity="0.30"/><stop offset="1" stop-color="'+lineColor+'" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="'+area+'" fill="url(#pvChartFill)"/>' +
      '<path class="chart-cost-line" d="'+costLine+'" fill="none" stroke-width="1.6" stroke-dasharray="4 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<path d="'+valueLine+'" fill="none" stroke="'+lineColor+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      dots + labels +
    '</svg>' +
    '<div class="chart-legend">' +
      '<span class="chart-legend-item"><span class="chart-legend-dot" style="background:'+lineColor+'"></span>Giá trị thị trường</span>' +
      '<span class="chart-legend-item"><span class="chart-legend-dash"></span>Vốn đã bỏ ra</span>' +
    '</div>';
  }

  // ---------- render: summary ----------
  function renderSummary(){
    var card = document.getElementById('summaryCard');
    var content = document.getElementById('summaryContent');
    if(state.transactions.length === 0){ card.hidden = true; return; }
    card.hidden = false;

    var eff = getEffectivePrice();
    var hasVal = !!eff;
    var p = computePortfolio();
    var unrealizedPL = hasVal ? (p.holdingAmount * eff.buy - p.holdingCost) : 0;
    var totalPL = p.realizedPL + unrealizedPL;
    var totalPlPct = p.totalBuyCost ? (totalPL / p.totalBuyCost * 100) : 0;
    var bannerCls = !hasVal ? 'flat' : (totalPL > 0 ? 'up' : (totalPL < 0 ? 'down' : 'flat'));
    var arrowPath = totalPL >= 0
      ? '<path d="M6 15l6-6 6 6"/>'
      : '<path d="M6 9l6 6 6-6"/>';
    var realizedCls = p.realizedPL > 0 ? 'up' : (p.realizedPL < 0 ? 'down' : '');

    content.innerHTML =
      '<div class="summary-row"><span class="summary-label">Đang nắm giữ</span><span class="summary-val">'+fmtAmount(p.holdingAmount)+' chỉ</span></div>' +
      '<div class="summary-row"><span class="summary-label">Giá vốn trung bình</span><span class="summary-val">'+(p.holdingAmount>0 ? fmtVND(p.avgCost)+' đ/chỉ' : '—')+'</span></div>' +
      '<div class="summary-row"><span class="summary-label">Tổng vốn hiện tại</span><span class="summary-val">'+fmtVND(p.holdingCost)+' đ</span></div>' +
      '<div class="summary-row"><span class="summary-label">Giá trị hiện tại</span><span class="summary-val">'+(hasVal ? fmtVND(p.holdingAmount*eff.buy)+' đ' : '—')+'</span></div>' +
      (p.realizedPL !== 0 ? '<div class="summary-row"><span class="summary-label">Lãi/lỗ đã chốt (đã bán)</span><span class="summary-val '+realizedCls+'">'+(p.realizedPL>=0?'+':'')+fmtVND(p.realizedPL)+' đ</span></div>' : '') +
      '<div class="pl-banner '+bannerCls+'">' +
        '<div class="pl-left">' +
          '<div class="pl-badge"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">'+arrowPath+'</svg></div>' +
          '<div><div class="pl-title">'+(!hasVal?'Chưa có giá hiện tại':'Tổng lãi/lỗ')+'</div><div class="pl-amount">'+(hasVal ? (totalPL>=0?'+':'')+fmtVND(totalPL)+' đ' : 'Cập nhật giá để tính')+'</div></div>' +
        '</div>' +
        (hasVal && p.totalBuyCost ? '<span class="pl-pct">'+(totalPlPct>=0?'+':'')+totalPlPct.toFixed(2)+'%</span>' : '') +
      '</div>' +
      '<div class="chart-head" style="margin-top:16px">' +
        '<span class="chart-title">Giá trị danh mục theo thời gian</span>' +
      '</div>' +
      renderRangeTabs('portfolioRangeTabs', portfolioChartRange) +
      '<div class="chart-wrap">' + renderPortfolioChart(portfolioChartRange) + '</div>';
  }

  // ---------- monthly/yearly P&L report ----------
  function computePnlReport(groupBy){
    var p = computePortfolio();
    var groups = {};
    state.transactions.forEach(function(tx){
      if(txType(tx) !== 'sell') return;
      var rec = p.perTx[tx.id];
      if(!rec) return;
      var key = groupBy === 'year' ? tx.date.slice(0,4) : tx.date.slice(0,7);
      if(!groups[key]) groups[key] = { pl: 0, count: 0, isCurrent: false };
      groups[key].pl += rec.pl;
      groups[key].count += 1;
    });
    var currentKey = groupBy === 'year' ? todayISO().slice(0,4) : todayISO().slice(0,7);
    if(!groups[currentKey]) groups[currentKey] = { pl: 0, count: 0, isCurrent: false };
    var eff = getEffectivePrice();
    var hasVal = !!eff;
    var unrealizedPL = hasVal ? (p.holdingAmount * eff.buy - p.holdingCost) : 0;
    groups[currentKey].pl += unrealizedPL;
    groups[currentKey].isCurrent = true;
    var order = Object.keys(groups).filter(function(key){
      if(groups[key].count > 0) return true;
      return key === currentKey && p.holdingAmount > 0;
    }).sort(function(a,b){ return b.localeCompare(a); });
    return { groups: groups, order: order };
  }

  function renderPnlReport(){
    var card = document.getElementById('pnlReportCard');
    var content = document.getElementById('pnlReportContent');
    var report = computePnlReport(pnlGroupBy);
    if(report.order.length === 0){ card.hidden = true; return; }
    card.hidden = false;
    positionSegmentedIndicator(document.getElementById('pnlGroupBy'));
    content.innerHTML = report.order.map(function(key){
      var g = report.groups[key];
      var label = pnlGroupBy === 'year' ? ('Năm '+key) : ('Tháng '+parseInt(key.slice(5,7),10)+'/'+key.slice(0,4));
      if(g.isCurrent) label += ' (hiện tại)';
      var cls = g.pl > 0 ? 'up' : (g.pl < 0 ? 'down' : '');
      return '<div class="summary-row"><span class="summary-label">'+label+'</span><span class="summary-val '+cls+'">'+(g.pl>=0?'+':'')+fmtVND(g.pl)+' đ</span></div>';
    }).join('');
  }

  // ---------- store breakdown ----------
  function renderStoreSummary(){
    var el = document.getElementById('storeSummary');
    var buys = state.transactions.filter(function(t){ return txType(t) === 'buy'; });
    var byStore = {};
    var storeNames = [];
    buys.forEach(function(t){
      var key = (t.store && t.store.trim()) ? t.store.trim() : 'Không rõ';
      if(!byStore[key]){ byStore[key] = { amount: 0, cost: 0 }; storeNames.push(key); }
      byStore[key].amount += t.amount;
      byStore[key].cost += t.amount * t.price;
    });
    if(storeNames.length === 0){ el.hidden = true; return; }
    storeNames.sort(function(a,b){ return byStore[b].cost - byStore[a].cost; });
    var totalCost = storeNames.reduce(function(sum,name){ return sum + byStore[name].cost; }, 0);
    var bestName = null, bestAvg = Infinity;
    storeNames.forEach(function(name){
      if(name === 'Không rõ') return;
      var s = byStore[name];
      var avg = s.amount ? s.cost / s.amount : Infinity;
      if(avg < bestAvg){ bestAvg = avg; bestName = name; }
    });
    el.hidden = false;
    el.innerHTML =
      '<div class="card" style="padding:14px 18px">' +
        '<div class="settings-row-title" style="margin-bottom:8px">Theo cửa hàng</div>' +
        storeNames.map(function(name){
          var s = byStore[name];
          var avg = s.amount ? s.cost / s.amount : 0;
          var pct = totalCost ? (s.cost / totalCost * 100) : 0;
          var isBest = name === bestName;
          return '<div class="store-bar-row">' +
            '<div class="store-bar-top"><span class="store-bar-name">'+escapeHtml(name)+(isBest ? ' <span class="store-bar-best">Giá tốt nhất</span>' : '')+'</span></div>' +
            '<div class="store-bar-track"><div class="store-bar-fill" style="width:'+pct.toFixed(1)+'%"></div></div>' +
            '<div class="summary-row"><span class="summary-label">'+fmtAmount(s.amount)+' chỉ</span><span class="summary-val">'+fmtVND(avg)+' đ/chỉ TB</span></div>' +
          '</div>';
        }).join('') +
      '</div>';
  }

  // ---------- render: transactions ----------
  var txFilter = 'all';
  var txSearchQuery = '';
  var txDateFrom = '';
  var txDateTo = '';
  document.querySelectorAll('#txFilter button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#txFilter button').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      txFilter = btn.getAttribute('data-filter');
      renderTx();
      positionSegmentedIndicator(document.getElementById('txFilter'));
    });
  });
  var txSearchTimer = null;
  document.getElementById('txSearch').addEventListener('input', function(e){
    var val = e.target.value;
    clearTimeout(txSearchTimer);
    txSearchTimer = setTimeout(function(){
      txSearchQuery = val.trim().toLowerCase();
      renderTx();
    }, 150);
  });
  document.getElementById('btnDateFilter').addEventListener('click', function(){
    document.getElementById('dateFilterRow').hidden = !document.getElementById('dateFilterRow').hidden;
    // .active reflects whether a date filter is applied (updateDateFilterBtn),
    // not whether the panel is open — collapsing it must not hide the fact
    // that transactions are still being filtered out.
  });
  document.getElementById('txDateFrom').addEventListener('change', function(e){
    txDateFrom = e.target.value;
    updateDateFilterBtn();
    renderTx();
  });
  document.getElementById('txDateTo').addEventListener('change', function(e){
    txDateTo = e.target.value;
    updateDateFilterBtn();
    renderTx();
  });
  document.getElementById('btnClearDateFilter').addEventListener('click', function(){
    txDateFrom = ''; txDateTo = '';
    document.getElementById('txDateFrom').value = '';
    document.getElementById('txDateTo').value = '';
    updateDateFilterBtn();
    renderTx();
  });
  function updateDateFilterBtn(){
    document.getElementById('btnDateFilter').classList.toggle('active', !!(txDateFrom || txDateTo));
  }

  function renderTx(){
    var list = document.getElementById('txList');
    var count = document.getElementById('txCount');
    var eff = getEffectivePrice();
    var p = computePortfolio();
    renderStoreSummary();
    var all = state.transactions.slice().sort(function(a,b){ return b.date.localeCompare(a.date) || b.createdAt-a.createdAt; });
    count.textContent = all.length;
    var txs = all.filter(function(t){
      if(txFilter !== 'all' && txType(t) !== txFilter) return false;
      if(txDateFrom && t.date < txDateFrom) return false;
      if(txDateTo && t.date > txDateTo) return false;
      if(txSearchQuery){
        var haystack = ((t.store||'') + ' ' + (t.note||'')).toLowerCase();
        if(haystack.indexOf(txSearchQuery) === -1) return false;
      }
      return true;
    });
    if(txs.length === 0){
      var emptyMsg = all.length === 0
        ? 'Chưa có giao dịch nào. Nhấn nút + để thêm giao dịch mua vàng đầu tiên.'
        : 'Không có giao dịch nào khớp bộ lọc này.';
      list.innerHTML =
        '<div class="empty-state">' +
          '<svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>' +
          '<p>'+emptyMsg+'</p>' +
        '</div>';
      return;
    }
    list.innerHTML = txs.map(function(tx){
      var isSell = txType(tx) === 'sell';
      var badge = '<span class="tx-badge '+(isSell?'sell':'buy')+'">'+(isSell?'BÁN':'MUA')+'</span>';
      var metaTxt = (isSell ? 'Bán ngày ' : 'Mua ngày ') + fmtDate(tx.date) + (tx.store ? ' · '+escapeHtml(tx.store) : '') + (tx.address ? ' · '+escapeHtml(tx.address) : '');
      var noteHtml = tx.note ? '<div class="tx-note">'+escapeHtml(tx.note)+'</div>' : '';

      var grid;
      if(isSell){
        var sellInfo = p.perTx[tx.id] || { avgCostAtSale: 0, pl: 0 };
        var plCls = sellInfo.pl > 0 ? 'up' : (sellInfo.pl < 0 ? 'down' : '');
        grid =
          '<div class="tx-grid">' +
            '<div><div class="tx-cell-label">Giá bán</div><div class="tx-cell-val">'+fmtVND(tx.price)+' đ</div></div>' +
            '<div><div class="tx-cell-label">Giá vốn lúc bán</div><div class="tx-cell-val">'+fmtVND(sellInfo.avgCostAtSale)+' đ</div></div>' +
            '<div style="grid-column:1/-1"><div class="tx-cell-label">Lãi/Lỗ đã chốt</div><div class="tx-cell-val '+plCls+'">'+(sellInfo.pl>=0?'+':'')+fmtVND(sellInfo.pl)+' đ</div></div>' +
          '</div>';
      } else {
        var cost = tx.amount * tx.price;
        var currentVal = eff ? tx.amount * eff.buy : null;
        var pl = currentVal === null ? null : currentVal - cost;
        var plPct = (pl === null || cost === 0) ? null : (pl/cost*100);
        var plCls2 = pl === null ? '' : (pl > 0 ? 'up' : (pl < 0 ? 'down' : ''));
        var plTxt = pl === null ? '—' : ((pl>=0?'+':'')+fmtVND(pl)+' đ ('+(plPct>=0?'+':'')+plPct.toFixed(1)+'%)');
        grid =
          '<div class="tx-grid">' +
            '<div><div class="tx-cell-label">Giá mua</div><div class="tx-cell-val">'+fmtVND(tx.price)+' đ</div></div>' +
            '<div><div class="tx-cell-label">Giá trị hiện tại</div><div class="tx-cell-val">'+(currentVal===null?'—':fmtVND(currentVal)+' đ')+'</div></div>' +
            '<div style="grid-column:1/-1"><div class="tx-cell-label">Lời/Lỗ chưa chốt</div><div class="tx-cell-val '+plCls2+'">'+plTxt+'</div></div>' +
          '</div>';
      }

      return (
        '<div class="tx-row" data-row-id="'+tx.id+'">' +
          '<div class="tx-swipe-action">' +
            '<button class="tx-swipe-del" data-del="'+tx.id+'" aria-label="Xoá giao dịch" type="button">' +
              '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"/></svg>' +
              '<span>Xoá</span>' +
            '</button>' +
          '</div>' +
          '<div class="tx-item" data-id="'+tx.id+'">' +
            '<div class="tx-top">' +
              '<div><div class="tx-amount">'+badge+fmtAmount(tx.amount)+' chỉ</div><div class="tx-date">'+metaTxt+'</div></div>' +
            '</div>' +
            grid +
            noteHtml +
          '</div>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('.tx-swipe-del').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        openSwipeRowId = null;
        deleteTxWithUndo(btn.getAttribute('data-del'));
      });
    });
    list.querySelectorAll('.tx-row').forEach(function(row){
      bindSwipeRow(row);
    });
  }

  // ---------- swipe-to-delete (iOS list pattern) ----------
  // touch-action:pan-y on .tx-item hands vertical drags straight to the
  // browser's native scroll of `.app`; only horizontal drags reach here.
  var SWIPE_ACTION_WIDTH = 84;
  var openSwipeRowId = null;
  function closeSwipeRow(row){
    if(!row) return;
    var item = row.querySelector('.tx-item');
    item.classList.remove('swiping');
    item.style.transform = '';
    row.classList.remove('swipe-open');
  }
  function bindSwipeRow(row){
    var id = row.getAttribute('data-row-id');
    var item = row.querySelector('.tx-item');
    var startX = 0, startY = 0, baseX = 0, dragging = false, axisLocked = null, suppressClick = false;

    item.addEventListener('pointerdown', function(e){
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; axisLocked = null;
      startX = e.clientX; startY = e.clientY;
      baseX = openSwipeRowId === id ? -SWIPE_ACTION_WIDTH : 0;
      item.classList.add('swiping');
    });
    item.addEventListener('pointermove', function(e){
      if(!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if(axisLocked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)){
        axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if(axisLocked === 'x'){ try{ item.setPointerCapture(e.pointerId); }catch(err){} }
      }
      if(axisLocked !== 'x') return;
      var nx = baseX + dx;
      if(nx > 0) nx = 0;
      if(nx < -SWIPE_ACTION_WIDTH) nx = -SWIPE_ACTION_WIDTH;
      item.style.transform = 'translateX(' + nx + 'px)';
    });
    function endDrag(e){
      if(!dragging) return;
      dragging = false;
      item.classList.remove('swiping');
      if(axisLocked === 'x'){
        var dx = (typeof e.clientX === 'number' ? e.clientX : startX) - startX;
        var finalX = baseX + dx;
        var open = finalX < -SWIPE_ACTION_WIDTH/2;
        item.style.transform = open ? 'translateX(-'+SWIPE_ACTION_WIDTH+'px)' : '';
        row.classList.toggle('swipe-open', open);
        if(open){ closeOpenSwipeExcept(id); openSwipeRowId = id; }
        else if(openSwipeRowId === id) openSwipeRowId = null;
        suppressClick = true;
      } else {
        item.style.transform = baseX ? 'translateX(-'+SWIPE_ACTION_WIDTH+'px)' : '';
      }
    }
    item.addEventListener('pointerup', endDrag);
    item.addEventListener('pointercancel', endDrag);
    item.addEventListener('click', function(){
      if(suppressClick){ suppressClick = false; return; }
      if(row.classList.contains('swipe-open')){ closeSwipeRow(row); openSwipeRowId = null; return; }
      var tx = state.transactions.find(function(t){ return t.id === id; });
      if(tx) openEditTx(tx);
    });
  }
  function closeOpenSwipeExcept(keepId){
    if(openSwipeRowId && openSwipeRowId !== keepId){
      closeSwipeRow(document.querySelector('.tx-row[data-row-id="'+openSwipeRowId+'"]'));
    }
  }
  // Tapping anywhere outside the open row closes it, matching iOS list behavior.
  document.addEventListener('pointerdown', function(e){
    if(!openSwipeRowId) return;
    if(e.target.closest && e.target.closest('.tx-row[data-row-id="'+openSwipeRowId+'"]')) return;
    closeSwipeRow(document.querySelector('.tx-row[data-row-id="'+openSwipeRowId+'"]'));
    openSwipeRowId = null;
  });

  function renderAll(){
    renderPrice(); renderSummary(); renderPnlReport(); renderTx();
    // Assistant reads liveData/liveHistory/computePortfolio() too, so it
    // must refresh on every state or price change, not just when its own
    // tab is switched into — otherwise it silently shows stale numbers
    // after a background price refresh (loadLiveData) or portfolio edit.
    if(!document.getElementById('viewAssistant').hidden) renderAssistant();
  }
  renderAll();
  loadLiveData();
  loadChangelog();
  loadNews();

  // ---------- real viewport height (fixes the intermittent bottom tab bar gap) ----------
  // See body's CSS comment: 100dvh can get stuck at the on-screen-keyboard-open
  // (or screen-locked) size after an input loses focus, or after the phone's
  // screen was turned off and back on, on iOS. A plain function declaration
  // (not a var assigned later) so it's hoisted and safe to call from the
  // visibilitychange/pageshow handlers above, which run earlier in the file
  // but need this exact recompute for the screen lock/unlock case.
  function syncAppHeight(){
    if(!window.visualViewport) return;
    document.documentElement.style.setProperty('--app-height', window.visualViewport.height + 'px');
  }
  syncAppHeight();
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', syncAppHeight);
    window.visualViewport.addEventListener('scroll', syncAppHeight);
  }
  // txForm's segmented control lives inside a sheet (hidden via transform,
  // not display:none), so unlike #txFilter it's already measurable now.
  positionSegmentedIndicator(document.querySelector('#txForm .segmented'));
  var segmentedResizeTimer = null;
  window.addEventListener('resize', function(){
    clearTimeout(segmentedResizeTimer);
    segmentedResizeTimer = setTimeout(function(){
      document.querySelectorAll('.segmented').forEach(function(seg){
        if(seg.offsetWidth > 0) positionSegmentedIndicator(seg);
      });
    }, 150);
  });

  // ---------- fixed header height sync ----------
  // #appHeader is position:fixed (see its CSS comment for why), so .app's
  // content needs padding-top matching its real rendered height or content
  // would start underneath it. Measured live, not hardcoded, since
  // safe-area-inset-top varies by device.
  (function(){
    var appHeaderEl = document.getElementById('appHeader');
    function syncHeaderHeight(){
      document.documentElement.style.setProperty('--header-h', appHeaderEl.getBoundingClientRect().height + 'px');
    }
    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);
    window.addEventListener('orientationchange', syncHeaderHeight);
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderHeight);
  })();

  // ---------- pull-to-refresh ----------
  // Custom, not native — .app already sets overscroll-behavior-y:contain
  // (needed to stop the whole scroll-lock/rubber-band drift fix elsewhere),
  // which also suppresses the browser's own pull-to-refresh, so this is the
  // only way to offer it back as a deliberate, visible gesture.
  (function(){
    var ptr = document.getElementById('ptrIndicator');
    var appEl = document.querySelector('.app');
    var PTR_THRESHOLD = 60, PTR_MAX = 90;
    // At non-integer browser/OS zoom levels scrollTop can rest a fraction of
    // a pixel above 0 even when visually at the top — treat "at the top" as
    // a tolerance, not a strict === 0, or the gesture silently never starts.
    var PTR_TOP_EPSILON = 1;
    var startX = 0, startY = 0, activePointerId = null, axisLocked = null, refreshing = false, startedOnRow = false, pullBaseHeight = 0;

    appEl.addEventListener('pointerdown', function(e){
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      // Ignore a second touch mid-gesture (e.g. a resting thumb) rather than
      // resilvering startX/startY out from under the first finger's drag.
      if(activePointerId !== null) return;
      if(refreshing || appEl.scrollTop > PTR_TOP_EPSILON) return;
      activePointerId = e.pointerId; axisLocked = null;
      startX = e.clientX; startY = e.clientY;
      // A transaction row already claims vertical drags for itself:
      // touch-action:pan-y on .tx-item hands native vertical panning
      // straight to the browser (ignoring our preventDefault below), and
      // bindSwipeRow runs its own pointer capture + drag lifecycle there —
      // capturing the same pointer here too would steal its pointerup and
      // leave that row's internal state stuck mid-gesture. So a gesture
      // starting on a row is simply not eligible to become a pull here at
      // all; it's the row's (or the native scroller's) to handle.
      startedOnRow = !!(e.target.closest && e.target.closest('.tx-item'));
      // Leave any in-flight .settling snap-back transition alone here — a
      // new touch landing mid-animation (a quick re-pull) shouldn't rip the
      // CSS transition away and start setting `height` inline from scratch,
      // which would jump the indicator from wherever the snap-back had
      // reached down to the new gesture's (still tiny) live value. It gets
      // removed instead right when a new pull is actually confirmed below.
    });
    appEl.addEventListener('pointermove', function(e){
      if(e.pointerId !== activePointerId) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      // iOS Safari decides whether a touch sequence is a native scroll on
      // the very first touchmove — a preventDefault() called later, only
      // once axis-lock confirms 'pull' a few pixels in, is frequently too
      // late and gets ignored for the rest of the gesture. Suppress the
      // default from the first movement for anything that could plausibly
      // become a pull (still at the top, didn't start on a row), before
      // axis-lock even resolves; it's a no-op for gestures that turn out
      // horizontal or start elsewhere, since startedOnRow already excludes
      // rows from this branch entirely.
      if(!startedOnRow && appEl.scrollTop <= PTR_TOP_EPSILON) e.preventDefault();
      if(axisLocked === null){
        if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // Vertical must dominate horizontal, same rule bindSwipeRow uses for
        // its own axis lock — otherwise a diagonal drag on a transaction row
        // (swiping to delete) also reads as a downward pull here, since both
        // handlers see the same bubbled pointermove.
        axisLocked = (!startedOnRow && Math.abs(dy) > Math.abs(dx) && dy > 0 && appEl.scrollTop <= PTR_TOP_EPSILON) ? 'pull' : 'none';
        if(axisLocked === 'pull'){
          try{ appEl.setPointerCapture(e.pointerId); }catch(err){}
          // Freeze at wherever an in-flight .settling snap-back currently
          // sits (not 0) before taking over live control, so a re-pull
          // mid-animation continues smoothly instead of visibly jumping to
          // this gesture's own (still small) dy-based height.
          pullBaseHeight = parseFloat(getComputedStyle(ptr).height) || 0;
          ptr.classList.remove('settling');
        }
      }
      if(axisLocked !== 'pull') return;
      if(appEl.scrollTop > PTR_TOP_EPSILON){ ptr.style.height = '0px'; pullBaseHeight = 0; axisLocked = 'none'; return; }
      ptr.style.height = Math.max(0, Math.min(PTR_MAX, pullBaseHeight + dy * 0.5)) + 'px';
    });
    function endDrag(e){
      if(e.pointerId !== activePointerId) return;
      activePointerId = null;
      var wasPulling = axisLocked === 'pull';
      axisLocked = null;
      if(!wasPulling) return;
      var h = parseFloat(ptr.style.height) || 0;
      ptr.classList.add('settling');
      if(h >= PTR_THRESHOLD) doRefresh();
      else ptr.style.height = '0px';
    }
    appEl.addEventListener('pointerup', endDrag);
    appEl.addEventListener('pointercancel', endDrag);

    function doRefresh(){
      refreshing = true;
      ptr.classList.add('loading');
      ptr.style.height = '52px';
      // loadLiveData/loadNews/loadChangelog each catch their own network
      // errors internally and resolve anyway (so their callers don't need
      // to special-case a failed background refresh) — meaning Promise.all
      // here never actually rejects. loadLiveData is the only one of the
      // three with a real success/failure return value (!!results[0]), so
      // it's what decides which toast to show; the others are best-effort.
      function settle(priceOk){
        ptr.classList.remove('loading');
        ptr.style.height = '0px';
        refreshing = false;
        showToast(priceOk ? 'Đã làm mới dữ liệu' : 'Không thể làm mới — kiểm tra kết nối mạng', priceOk ? 'ok' : 'err');
      }
      // The loaders shouldn't reject (they catch their own network errors),
      // but they do call renderAll()/renderNews() synchronously inside their
      // own .then — an unrelated throw there (e.g. a malformed JSON payload
      // reaching a render function unguarded) would otherwise reject this
      // Promise.all with no handler, leaving `refreshing` stuck true and the
      // spinner frozen forever (the pointerdown guard above blocks every
      // future pull while it's true). Catch defensively so a render bug
      // degrades to a failed refresh instead of permanently wedging the
      // gesture until a full page reload.
      Promise.all([loadLiveData(), loadNews(), loadChangelog()]).then(function(results){
        settle(results[0]);
      }).catch(function(){
        settle(false);
      });
    }
  })();
  if(gistConfig){
    if(hasUnsyncedChanges()){
      // Local edits never reached the Gist (app was offline, token had
      // expired, API hiccup...). Pulling here would overwrite and destroy
      // them, so push local up instead — it's the newer copy.
      setGistStatus('syncing');
      doGistPush().then(markSynced).catch(function(e){ setGistStatus('error', e.message); });
    } else {
      pullFromGist().then(function(changed){ if(changed) renderAll(); }).catch(function(e){ setGistStatus('error', e.message); });
    }
  }

  // Offline support: caches this page + the live price/history/changelog JSON
  // so the app still opens with last-known data with no network. See
  // products/gold-track/sw-gold-track.js for why this file lives there
  // (scope must cover the whole gold-track/ folder, not just js/).
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      // One-time migration: this SW used to be registered from the site root
      // (/sw-gold-track.js, scope "/") before it moved into products/gold-track/.
      // A returning visitor's browser still has that origin-wide registration
      // active until something unregisters it — harmless (it already guards
      // every request via GOLDTRACK_PATHS) but pointless now that the new
      // registration's narrower scope covers GoldTrack just as well. Clean it
      // up so old visitors end up with exactly one registration, like a fresh
      // install would.
      navigator.serviceWorker.getRegistrations().then(function(regs){
        regs.forEach(function(reg){
          if(reg.scope === location.origin + '/') reg.unregister();
        });
      }).catch(function(){});
      navigator.serviceWorker.register('/products/gold-track/sw-gold-track.js').catch(function(){ /* offline support just won't be available */ });
    });
  }
})();
