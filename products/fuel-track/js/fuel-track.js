(function(){
  'use strict';

  var DATA_BASE = '/products/fuel-track/data/';
  var RANGE_DAYS = { '7':7, '30':30, '90':90, 'all':Infinity };
  var DEFAULT_ITEM = 'e5-ron92-ii';
  var HISTORY_PAGE = 8;
  var DAY_MS = 86400000;

  var priceDoc = null;
  var historyDoc = null;
  var changelogData = null;
  var selectedItem = DEFAULT_ITEM;
  var selectedRange = '30';
  var historyShown = HISTORY_PAGE;

  function $(id){ return document.getElementById(id); }
  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function fmtVnd(n){
    var s = String(Math.round(Math.abs(n)));
    return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function fmtDate(iso){
    var p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }
  // Vietnam has no DST, so shifting by a fixed +7h and reading the UTC fields
  // gives the VN calendar date regardless of the device's own timezone.
  function vnToday(){
    return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  }
  function dayToMs(day){
    var p = day.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function msToDay(ms){ return new Date(ms).toISOString().slice(0, 10); }

  function fetchJson(name){
    return fetch(DATA_BASE + name, { cache: 'no-store' }).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function itemLabel(id){
    if(historyDoc && historyDoc.items && historyDoc.items[id]) return historyDoc.items[id];
    var found = priceDoc && (priceDoc.items || []).filter(function(it){ return it.id === id; })[0];
    return found ? found.label : id;
  }
  function itemOrder(){
    if(historyDoc && historyDoc.items) return Object.keys(historyDoc.items);
    return priceDoc ? priceDoc.items.map(function(it){ return it.id; }) : [];
  }
  function getChanges(){
    return historyDoc && Array.isArray(historyDoc.changes) ? historyDoc.changes : [];
  }

  function changeChip(diff, small){
    if(diff == null) return '';
    if(diff === 0) return small ? '' : '<span class="chip flat">Không đổi</span>';
    var up = diff > 0;
    var amount = fmtVnd(Math.abs(diff));
    return '<span class="chip ' + (up ? 'up' : 'down') + '" aria-label="' + (up ? 'Tăng ' : 'Giảm ') + amount + ' đồng">' +
      '<span aria-hidden="true">' + (up ? '▲' : '▼') + '</span>' + amount + '</span>';
  }

  // ---------- Giá hôm nay ----------
  function renderPrices(){
    var list = $('priceList');
    if(!priceDoc || !Array.isArray(priceDoc.items) || !priceDoc.items.length){
      list.innerHTML = '<p class="state-msg">Không tải được giá. Kiểm tra kết nối rồi mở lại app.</p>';
      $('effectiveDate').textContent = '';
      return;
    }
    $('effectiveDate').textContent = priceDoc.effectiveDate ? 'Áp dụng từ ' + fmtDate(priceDoc.effectiveDate) : '';
    var unit = escapeHtml(priceDoc.unit || 'đ/lít');
    list.innerHTML = priceDoc.items.map(function(it){
      var note = it.source === 'petrolimex-v1' ? '<small>Theo giá Vùng 1 Petrolimex</small>' : '';
      return '<div class="price-row">' +
        '<div class="price-name">' + escapeHtml(it.label) + note + '</div>' +
        '<div class="price-right">' +
          '<span class="price-val">' + fmtVnd(it.price) + '<span class="price-unit">' + unit + '</span></span>' +
          changeChip(it.change, false) +
        '</div>' +
      '</div>';
    }).join('');
    $('e10Note').hidden = !priceDoc.items.some(function(it){ return it.source === 'petrolimex-v1'; });
  }

  // ---------- Biểu đồ ----------
  // Forward-fills the change points into one price per VN calendar day.
  function dailySeries(changes, itemId, days){
    var withItem = changes.filter(function(c){ return c.prices && c.prices[itemId] != null; });
    if(!withItem.length) return [];
    var firstMs = dayToMs(withItem[0].date);
    var endMs = dayToMs(vnToday());
    var lastMs = dayToMs(withItem[withItem.length - 1].date);
    if(lastMs > endMs) endMs = lastMs;
    var startMs = isFinite(days) ? Math.max(endMs - (days - 1) * DAY_MS, firstMs) : firstMs;

    var out = [];
    var idx = 0, current = null;
    for(var ms = firstMs; ms <= endMs; ms += DAY_MS){
      var day = msToDay(ms);
      while(idx < withItem.length && withItem[idx].date <= day){
        current = withItem[idx].prices[itemId];
        idx++;
      }
      if(ms >= startMs && current != null) out.push({ day: day, price: current });
    }
    return out;
  }

  function pickLabelIndices(n, maxLabels){
    if(n <= maxLabels) return Array.from({ length: n }, function(_, i){ return i; });
    var idxs = [];
    for(var i = 0; i < maxLabels; i++){ idxs.push(Math.round(i * (n - 1) / (maxLabels - 1))); }
    return idxs.filter(function(v, i, a){ return a.indexOf(v) === i; });
  }

  function renderChart(series){
    if(series.length < 2){
      return '<div class="chart-empty">Chưa đủ dữ liệu để vẽ biểu đồ.</div>';
    }
    var w = 300, h = 110, padTop = 10, padBottom = 20, padLeft = 40, padRight = 8;
    var n = series.length;
    var vals = series.map(function(p){ return p.price; });
    var dataMin = Math.min.apply(null, vals), dataMax = Math.max.apply(null, vals);
    var pad = Math.max((dataMax - dataMin) * 0.12, dataMax * 0.004, 1);
    var min = dataMin - pad, max = dataMax + pad;
    var plotW = w - padLeft - padRight, plotH = h - padTop - padBottom;
    function xAt(i){ return padLeft + (i / (n - 1)) * plotW; }
    function yAt(v){ return padTop + plotH - ((v - min) / (max - min)) * plotH; }

    var d = 'M' + xAt(0).toFixed(1) + ',' + yAt(vals[0]).toFixed(1);
    for(var i = 1; i < n; i++){
      d += ' H' + xAt(i).toFixed(1);
      if(vals[i] !== vals[i - 1]) d += ' V' + yAt(vals[i]).toFixed(1);
    }
    var plotBottom = padTop + plotH;
    var area = d + ' V' + plotBottom + ' H' + xAt(0).toFixed(1) + ' Z';

    var gridVals = dataMin === dataMax ? [dataMin] : [dataMax, dataMin];
    var grid = gridVals.map(function(v){
      var y = yAt(v).toFixed(1);
      return '<line class="chart-grid" x1="' + padLeft + '" x2="' + (w - padRight) + '" y1="' + y + '" y2="' + y + '" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>' +
        '<text class="chart-axis-label" x="' + (padLeft - 5) + '" y="' + (+y + 3) + '" font-size="9" text-anchor="end">' + fmtVnd(v) + '</text>';
    }).join('');

    var longRange = n > 120;
    var labels = pickLabelIndices(n, 5).map(function(idx, k, arr){
      var p = series[idx].day.split('-');
      var lbl = longRange ? p[1] + '/' + p[0].slice(2) : p[2] + '/' + p[1];
      var anchor = k === 0 ? 'start' : (k === arr.length - 1 ? 'end' : 'middle');
      return '<text class="chart-axis-label" x="' + xAt(idx).toFixed(1) + '" y="' + (h - 5) + '" font-size="9" text-anchor="' + anchor + '">' + lbl + '</text>';
    }).join('');

    var lastX = xAt(n - 1).toFixed(1), lastY = yAt(vals[n - 1]).toFixed(1);
    return '<svg class="chart-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Biểu đồ giá ' + escapeHtml(itemLabel(selectedItem)) + '">' +
      '<defs><linearGradient id="ftChartFill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" style="stop-color:var(--chart-fill);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--chart-fill);stop-opacity:0"/>' +
      '</linearGradient></defs>' +
      grid +
      '<path d="' + area + '" fill="url(#ftChartFill)"/>' +
      '<path d="' + d + '" fill="none" style="stroke:var(--chart-line)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + lastX + '" cy="' + lastY + '" r="3" style="fill:var(--chart-line)"/>' +
      labels +
    '</svg>';
  }

  function renderStats(series){
    var el = $('chartStats');
    if(series.length < 2){ el.innerHTML = ''; return; }
    var vals = series.map(function(p){ return p.price; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var first = vals[0], last = vals[vals.length - 1];
    var diff = last - first;
    var pct = first ? diff / first * 100 : 0;
    var cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
    var arrow = diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '';
    el.innerHTML =
      '<div class="chart-stat"><div class="chart-stat-label">Thấp nhất</div><div class="chart-stat-val">' + fmtVnd(lo) + '</div><div class="chart-stat-sub">đ/lít</div></div>' +
      '<div class="chart-stat"><div class="chart-stat-label">Cao nhất</div><div class="chart-stat-val">' + fmtVnd(hi) + '</div><div class="chart-stat-sub">đ/lít</div></div>' +
      '<div class="chart-stat"><div class="chart-stat-label">Thay đổi</div><div class="chart-stat-val ' + cls + '">' +
        (diff === 0 ? 'Không đổi' : arrow + fmtVnd(Math.abs(diff))) + '</div>' +
        '<div class="chart-stat-sub">' + (diff === 0 ? '0%' : (diff > 0 ? '+' : '−') + Math.abs(pct).toFixed(2).replace('.', ',') + '%') + '</div></div>';
  }

  function chartItems(){
    // Only items still sold today — discontinued ones (e.g. RON 95-III)
    // remain in the history list but get no chart tab.
    if(!priceDoc || !Array.isArray(priceDoc.items)) return [];
    var changes = getChanges();
    return priceDoc.items.filter(function(it){
      return changes.some(function(c){ return c.prices && c.prices[it.id] != null; });
    });
  }

  function renderItemTabs(){
    var items = chartItems();
    if(items.length && !items.some(function(it){ return it.id === selectedItem; })){
      selectedItem = items.some(function(it){ return it.id === DEFAULT_ITEM; }) ? DEFAULT_ITEM : items[0].id;
    }
    $('itemTabs').innerHTML = items.map(function(it){
      var active = it.id === selectedItem;
      return '<button type="button" data-item="' + escapeHtml(it.id) + '"' + (active ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"') + '>' + escapeHtml(it.label) + '</button>';
    }).join('');
  }

  function renderChartCard(){
    renderItemTabs();
    var buttons = $('rangeTabs').querySelectorAll('button');
    Array.prototype.forEach.call(buttons, function(b){
      var active = b.getAttribute('data-range') === selectedRange;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if(!historyDoc){
      $('chart').innerHTML = '<div class="chart-empty">Không tải được lịch sử giá. Kiểm tra kết nối rồi mở lại app.</div>';
      $('chartStats').innerHTML = '';
      return;
    }
    var series = dailySeries(getChanges(), selectedItem, RANGE_DAYS[selectedRange]);
    $('chart').innerHTML = renderChart(series);
    renderStats(series);
  }

  $('itemTabs').addEventListener('click', function(e){
    var btn = e.target.closest('button[data-item]');
    if(!btn) return;
    selectedItem = btn.getAttribute('data-item');
    renderChartCard();
  });
  $('rangeTabs').addEventListener('click', function(e){
    var btn = e.target.closest('button[data-range]');
    if(!btn) return;
    selectedRange = btn.getAttribute('data-range');
    renderChartCard();
  });

  // ---------- Lịch sử điều chỉnh ----------
  function renderHistory(){
    var list = $('historyList');
    var more = $('historyMore');
    if(!historyDoc){
      list.innerHTML = '<p class="state-msg">Không tải được lịch sử giá. Kiểm tra kết nối rồi mở lại app.</p>';
      more.hidden = true;
      return;
    }
    var changes = getChanges();
    if(!changes.length){
      list.innerHTML = '<p class="state-msg">Chưa có kỳ điều chỉnh nào được ghi nhận.</p>';
      more.hidden = true;
      return;
    }
    var order = itemOrder();
    var html = [];
    for(var i = changes.length - 1; i >= 0 && html.length < historyShown; i--){
      var entry = changes[i];
      var prev = i > 0 ? changes[i - 1] : null;
      var rows = order.map(function(id){
        var price = entry.prices[id];
        var prevPrice = prev ? prev.prices[id] : null;
        if(price == null){
          if(prevPrice == null) return '';
          return '<div class="hist-item same"><span class="hist-item-name">' + escapeHtml(itemLabel(id)) + '</span>' +
            '<span class="hist-item-right"><span class="hist-item-price">Ngừng niêm yết</span></span></div>';
        }
        var diff = prevPrice != null ? price - prevPrice : null;
        var same = prev && diff === 0;
        return '<div class="hist-item' + (same ? ' same' : '') + '"><span class="hist-item-name">' + escapeHtml(itemLabel(id)) + '</span>' +
          '<span class="hist-item-right"><span class="hist-item-price">' + fmtVnd(price) + '</span>' + changeChip(diff, true) + '</span></div>';
      }).join('');
      html.push('<div class="hist-entry"><div class="hist-date">' + fmtDate(entry.date) +
        (i === 0 ? '<span>Mốc đầu tiên</span>' : '') + '</div>' + rows + '</div>');
    }
    list.innerHTML = html.join('');
    more.hidden = historyShown >= changes.length;
  }
  $('historyMore').addEventListener('click', function(){
    historyShown += HISTORY_PAGE;
    renderHistory();
  });

  // ---------- Changelog ----------
  function renderChangelog(){
    var el = $('versionContent');
    if(!changelogData){
      el.innerHTML = '<p class="state-msg">Không tải được lịch sử cập nhật.</p>';
      return;
    }
    el.innerHTML = changelogData.entries.map(function(entry){
      return '<div class="version-entry">' +
        '<div class="version-entry-head"><span class="version-num">v' + escapeHtml(entry.version) + '</span><span class="version-date">' + fmtDate(entry.date) + '</span></div>' +
        '<ul class="version-changes">' + (entry.changes || []).map(function(c){ return '<li>' + escapeHtml(c) + '</li>'; }).join('') + '</ul>' +
      '</div>';
    }).join('');
  }
  function openSheet(){
    renderChangelog();
    $('versionSheet').classList.add('open');
    $('versionBackdrop').classList.add('open');
  }
  function closeSheet(){
    $('versionSheet').classList.remove('open');
    $('versionBackdrop').classList.remove('open');
  }
  $('btnVersion').addEventListener('click', openSheet);
  $('versionClose').addEventListener('click', closeSheet);
  $('versionBackdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && $('versionSheet').classList.contains('open')) closeSheet();
  });
  (function enableSheetDrag(){
    var sheet = $('versionSheet');
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
      if(currentY > 120) closeSheet();
      currentY = 0;
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  })();

  // ---------- Tải dữ liệu ----------
  var loading = false;
  function loadAll(isRefresh){
    if(loading) return;
    loading = true;
    var pPrice = fetchJson('fuel-price.json').then(function(d){ priceDoc = d; }, function(){ if(!isRefresh) priceDoc = null; });
    var pHist = fetchJson('fuel-price-history.json').then(function(d){ historyDoc = d; }, function(){ if(!isRefresh) historyDoc = null; });
    var pLog = fetchJson('changelog.json').then(function(d){
      if(d && Array.isArray(d.entries)){
        changelogData = d;
        $('btnVersion').textContent = 'v' + d.version;
      }
    }, function(){});
    Promise.all([pPrice, pHist, pLog]).then(function(){
      loading = false;
      renderPrices();
      renderChartCard();
      renderHistory();
    });
  }
  loadAll(false);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible') loadAll(true);
  });

  // Offline: see products/fuel-track/sw-fuel-track.js for why the shell lives
  // in products/fuel-track/ (scope). Absolute path — a relative one would
  // resolve against html/, not the shell's folder.
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/products/fuel-track/sw-fuel-track.js').catch(function(){});
    });
  }
})();
