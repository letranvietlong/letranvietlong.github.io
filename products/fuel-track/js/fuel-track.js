(function(){
  'use strict';

  var DATA_BASE = '/products/fuel-track/data/';
  var RANGE_DAYS = { '7':7, '30':30, '90':90, 'all':Infinity };
  var HISTORY_PAGE = 3;
  var DAY_MS = 86400000;

  var priceDoc = null;
  var historyDoc = null;
  var changelogData = null;
  var selectedRange = '7';
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
    var allPlx = priceDoc.items.every(function(it){ return it.source === 'petrolimex-v1'; });
    list.innerHTML = priceDoc.items.map(function(it){
      var note = !allPlx && it.source === 'petrolimex-v1' ? '<small>Theo giá Vùng 1 Petrolimex</small>' : '';
      return '<div class="price-row">' +
        '<div class="price-name">' + escapeHtml(it.label) + note + '</div>' +
        '<div class="price-right">' +
          '<span class="price-val">' + fmtVnd(it.price) + '<span class="price-unit">' + unit + '</span></span>' +
          (it.change != null ? rangeChip(it.change, it.prevPrice) : '') +
        '</div>' +
      '</div>';
    }).join('') + (allPlx ? '<p class="price-note">Theo giá Vùng 1 Petrolimex</p>' : '');
  }

  // ---------- Biểu đồ ----------
  var SERIES_COLORS = 4;
  var chartState = null;

  // Items still listed in the latest change point — discontinued ones (e.g.
  // RON 95-III) stay in the history list but are not drawn.
  function chartItems(){
    var changes = getChanges();
    if(!changes.length) return [];
    var last = changes[changes.length - 1].prices || {};
    var ids = [];
    if(priceDoc && Array.isArray(priceDoc.items)){
      priceDoc.items.forEach(function(it){ if(last[it.id] != null) ids.push(it.id); });
    }
    Object.keys(last).forEach(function(id){ if(last[id] != null && ids.indexOf(id) < 0) ids.push(id); });
    return ids.map(function(id){
      var found = priceDoc && Array.isArray(priceDoc.items) && priceDoc.items.filter(function(it){ return it.id === id; })[0];
      return { id: id, label: found ? found.label : itemLabel(id) };
    });
  }

  // Forward-fills the change points into one price per VN calendar day, for
  // every item on a shared day axis (null before an item's first appearance).
  function dailySeries(changes, items, days){
    var firstMs = Infinity;
    items.forEach(function(it){
      for(var i = 0; i < changes.length; i++){
        if(changes[i].prices && changes[i].prices[it.id] != null){
          firstMs = Math.min(firstMs, dayToMs(changes[i].date));
          break;
        }
      }
    });
    if(!isFinite(firstMs)) return { days: [], series: [] };
    var endMs = dayToMs(vnToday());
    var lastMs = dayToMs(changes[changes.length - 1].date);
    if(lastMs > endMs) endMs = lastMs;
    var startMs = isFinite(days) ? Math.max(endMs - (days - 1) * DAY_MS, firstMs) : firstMs;

    var current = {};
    var series = items.map(function(it){ return { id: it.id, label: it.label, vals: [] }; });
    var out = [];
    var idx = 0;
    for(var ms = firstMs; ms <= endMs; ms += DAY_MS){
      var day = msToDay(ms);
      while(idx < changes.length && changes[idx].date <= day){
        var prices = changes[idx].prices || {};
        items.forEach(function(it){ if(prices[it.id] != null) current[it.id] = prices[it.id]; });
        idx++;
      }
      if(ms >= startMs){
        out.push(day);
        series.forEach(function(s){ s.vals.push(current[s.id] != null ? current[s.id] : null); });
      }
    }
    return { days: out, series: series };
  }

  var DAY_DOT_MAX = 10;

  function pickLabelIndices(n, maxLabels){
    if(n <= maxLabels) return Array.from({ length: n }, function(_, i){ return i; });
    var idxs = [];
    for(var i = 0; i < maxLabels; i++){ idxs.push(Math.round(i * (n - 1) / (maxLabels - 1))); }
    return idxs.filter(function(v, i, a){ return a.indexOf(v) === i; });
  }

  function seriesColor(i){ return 'var(--series-' + (i % SERIES_COLORS + 1) + ')'; }
  function firstLast(vals){
    var first = null, last = null;
    for(var i = 0; i < vals.length; i++){
      if(vals[i] == null) continue;
      if(first == null) first = vals[i];
      last = vals[i];
    }
    return { first: first, last: last };
  }

  // Monotone cubic (Fritsch–Carlson) through the daily points: soft corners
  // like GoldTrack's line, but never overshoots — a flat week stays flat and a
  // price jump never dips/peaks past the real values, so the Y labels stay true.
  function smoothPath(pts){
    var n = pts.length;
    if(!n) return '';
    var f = function(v){ return v.toFixed(1); };
    var d = 'M' + f(pts[0].x) + ',' + f(pts[0].y);
    if(n === 1) return d;
    var dx = [], m = [], t = [];
    for(var i = 0; i < n - 1; i++){
      dx[i] = pts[i+1].x - pts[i].x;
      m[i] = dx[i] ? (pts[i+1].y - pts[i].y) / dx[i] : 0;
    }
    t[0] = m[0]; t[n-1] = m[n-2];
    for(var j = 1; j < n - 1; j++){
      if(m[j-1] * m[j] <= 0) t[j] = 0;
      else {
        var w1 = 2 * dx[j] + dx[j-1], w2 = dx[j] + 2 * dx[j-1];
        t[j] = (w1 + w2) / (w1 / m[j-1] + w2 / m[j]);
      }
    }
    for(var k = 0; k < n - 1; k++){
      var h = dx[k] / 3;
      d += ' C' + f(pts[k].x + h) + ',' + f(pts[k].y + t[k] * h) +
           ' ' + f(pts[k+1].x - h) + ',' + f(pts[k+1].y - t[k+1] * h) +
           ' ' + f(pts[k+1].x) + ',' + f(pts[k+1].y);
    }
    return d;
  }

  function renderChart(data){
    chartState = null;
    var n = data.days.length;
    var all = [];
    data.series.forEach(function(s){ s.vals.forEach(function(v){ if(v != null) all.push(v); }); });
    if(n < 2 || !all.length){
      return '<div class="chart-empty">Chưa đủ dữ liệu để vẽ biểu đồ.</div>';
    }
    var w = 300, h = 170, padTop = 8, padBottom = 20, padLeft = 40;
    var padRight = n <= DAY_DOT_MAX ? 14 : 8;  // room for the last centred day label
    var dataMin = Math.min.apply(null, all), dataMax = Math.max.apply(null, all);
    var pad = Math.max((dataMax - dataMin) * 0.06, dataMax * 0.004, 1);
    var min = dataMin - pad, max = dataMax + pad;
    var plotW = w - padLeft - padRight, plotH = h - padTop - padBottom;
    function xAt(i){ return padLeft + (i / (n - 1)) * plotW; }
    function yAt(v){ return padTop + plotH - ((v - min) / (max - min)) * plotH; }

    var paths = data.series.map(function(s, si){
      var pts = [];
      for(var i = 0; i < n; i++){
        if(s.vals[i] != null) pts.push({ x: xAt(i), y: yAt(s.vals[i]) });
      }
      var d = smoothPath(pts);
      if(!d) return '';
      // One dot per day on short ranges (like GoldTrack's ≤10-point rule);
      // on 30N+ they'd merge into a bead chain and hide the line itself.
      var marks = n <= DAY_DOT_MAX ? pts.map(function(pt){
        return '<circle class="chart-point" r="2.6" cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" style="fill:' + seriesColor(si) + '"/>';
      }).join('') : '';
      return '<path d="' + d + '" fill="none" style="stroke:' + seriesColor(si) + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' + marks;
    }).join('');

    var gridVals = [dataMin];
    if(dataMax !== dataMin){
      gridVals = [dataMax];
      var mid = Math.round((dataMin + dataMax) / 20) * 10;
      if(mid > dataMin && mid < dataMax) gridVals.push(mid);
      gridVals.push(dataMin);
    }
    var grid = gridVals.map(function(v){
      var y = yAt(v).toFixed(1);
      return '<line class="chart-grid" x1="' + padLeft + '" x2="' + (w - padRight) + '" y1="' + y + '" y2="' + y + '" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>' +
        '<text class="chart-axis-label" x="' + (padLeft - 5) + '" y="' + (+y + 3) + '" font-size="9" text-anchor="end">' + fmtVnd(v) + '</text>';
    }).join('');

    var longRange = n > 120;
    var labels = pickLabelIndices(n, n <= DAY_DOT_MAX ? n : 5).map(  // short ranges: label every day, matching the dots
      function(idx, k, arr){
      var p = data.days[idx].split('-');
      var lbl = longRange ? 'T' + (+p[1]) + '/' + p[0].slice(2) : p[2] + '/' + p[1];  // "T9/25", not "09/25" which reads as a day/month
      // Every-day labels sit centred under their dots; sparse ones hug the edges.
      var anchor = n <= DAY_DOT_MAX ? 'middle' : (k === 0 ? 'start' : (k === arr.length - 1 ? 'end' : 'middle'));
      return '<text class="chart-axis-label" x="' + xAt(idx).toFixed(1) + '" y="' + (h - 5) + '" font-size="9" text-anchor="' + anchor + '">' + lbl + '</text>';
    }).join('');

    var dots = data.series.map(function(s, si){
      return '<circle class="chart-dot" r="3.5" cx="0" cy="0" style="fill:' + seriesColor(si) + '" visibility="hidden"/>';
    }).join('');

    var summary = data.series.map(function(s){
      var fl = firstLast(s.vals);
      return s.label + ' ' + (fl.last != null ? fmtVnd(fl.last) + ' đồng' : 'không có dữ liệu');
    }).join('; ');
    var aria = 'Biểu đồ giá ' + data.series.length + ' loại xăng dầu từ ' + fmtDate(data.days[0]) + ' đến ' + fmtDate(data.days[n - 1]) +
      ', giá cuối kỳ: ' + summary;

    chartState = { data: data, w: w, n: n, padLeft: padLeft, plotW: plotW, padTop: padTop, xAt: xAt, yAt: yAt, idx: -1 };

    return '<svg class="chart-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + escapeHtml(aria) + '">' +
      grid + paths + labels +
      '<line class="chart-cursor" x1="0" x2="0" y1="' + padTop + '" y2="' + (padTop + plotH) + '" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/>' +
      dots +
    '</svg>' +
    '<div class="chart-tip" aria-hidden="true" hidden></div>';
  }

  function rangeChip(diff, base){
    if(diff === 0) return '<span class="chip flat">Không đổi</span>';
    var up = diff > 0;
    var amount = fmtVnd(Math.abs(diff));
    var pct = (up ? '+' : '−') + (base ? Math.abs(diff / base * 100) : 0).toFixed(2).replace('.', ',') + '%';
    return '<span class="chip ' + (up ? 'up' : 'down') + '" aria-label="' + (up ? 'Tăng ' : 'Giảm ') + amount + ' đồng, ' + pct + '">' +
      '<span aria-hidden="true">' + (up ? '▲' : '▼') + '</span>' + amount + ' (' + pct + ')</span>';
  }

  function renderLegend(data){
    var el = $('chartLegend');
    if(data.days.length < 2){ el.innerHTML = ''; return; }
    // Colour key only — current prices and changes already sit in "Giá hôm nay".
    el.innerHTML = data.series.map(function(s, si){
      return '<li class="legend-row">' +
        '<span class="legend-swatch" style="background:' + seriesColor(si) + '"></span>' +
        '<span class="legend-name">' + escapeHtml(s.label) + '</span>' +
      '</li>';
    }).join('');
  }

  function hideCursor(){
    var wrap = $('chart');
    var tip = wrap.querySelector('.chart-tip');
    if(!tip) return;
    tip.hidden = true;
    Array.prototype.forEach.call(wrap.querySelectorAll('.chart-cursor,.chart-dot'), function(el){ el.setAttribute('visibility', 'hidden'); });
    if(chartState) chartState.idx = -1;
  }

  function showCursorAt(clientX){
    var st = chartState;
    var wrap = $('chart');
    var svg = wrap.querySelector('.chart-svg');
    var tip = wrap.querySelector('.chart-tip');
    if(!st || !svg || !tip) return;
    var rect = svg.getBoundingClientRect();
    if(!rect.width) return;
    var scale = rect.width / st.w;
    var vx = (clientX - rect.left) / scale;
    var idx = Math.round((vx - st.padLeft) / st.plotW * (st.n - 1));
    idx = Math.max(0, Math.min(st.n - 1, idx));
    if(idx === st.idx && !tip.hidden) return;
    st.idx = idx;

    var x = st.xAt(idx).toFixed(1);
    var cursor = wrap.querySelector('.chart-cursor');
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
    cursor.setAttribute('visibility', 'visible');
    var dots = wrap.querySelectorAll('.chart-dot');
    var rows = st.data.series.map(function(s, si){
      var v = s.vals[idx];
      if(v == null){
        dots[si].setAttribute('visibility', 'hidden');
        return '';
      }
      dots[si].setAttribute('cx', x);
      dots[si].setAttribute('cy', st.yAt(v).toFixed(1));
      dots[si].setAttribute('visibility', 'visible');
      return '<div class="chart-tip-row"><span class="legend-swatch" style="background:' + seriesColor(si) + '"></span>' +
        '<span class="chart-tip-name">' + escapeHtml(s.label) + '</span><span class="chart-tip-val">' + fmtVnd(v) + '</span></div>';
    }).join('');
    tip.innerHTML = '<div class="chart-tip-date">' + fmtDate(st.data.days[idx]) + '</div>' + rows;
    tip.hidden = false;

    var wrapRect = wrap.getBoundingClientRect();
    var px = rect.left - wrapRect.left + st.xAt(idx) * scale;
    tip.style.left = '0px';  // measure at full width, not squeezed against the right edge by the previous position
    var tw = tip.offsetWidth;
    var gap = 10;
    var top = rect.top - wrapRect.top + st.padTop * scale;
    var left;
    if (px + gap + tw <= wrapRect.width) left = px + gap;
    else if (px - gap - tw >= 0) left = px - gap - tw;
    else {
      // Fits on neither side (narrow phones, cursor mid-chart): clamping it
      // sideways would cover the very point being inspected, so drop it below
      // the chart instead, over the legend.
      left = Math.max(0, Math.min(wrapRect.width - tw, px - tw / 2));
      top = rect.bottom - wrapRect.top + 6;
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  (function enableChartCursor(){
    var wrap = $('chart');
    var pressed = false;
    wrap.addEventListener('pointerdown', function(e){
      if(!e.target.closest('.chart-svg')){ hideCursor(); return; }
      pressed = true;
      showCursorAt(e.clientX);
    });
    wrap.addEventListener('pointermove', function(e){
      if(e.pointerType === 'mouse' ? !e.target.closest('.chart-svg') : !pressed) return;
      showCursorAt(e.clientX);
    });
    wrap.addEventListener('pointerup', function(){ pressed = false; });
    // Touch pointers also fire pointerleave right after pointerup; the
    // tooltip should stay up after a tap, so only a mouse leaving hides it.
    wrap.addEventListener('pointerleave', function(e){
      pressed = false;
      if(e.pointerType === 'mouse') hideCursor();
    });
    wrap.addEventListener('pointercancel', function(){ pressed = false; hideCursor(); });
    document.addEventListener('pointerdown', function(e){
      if(!wrap.contains(e.target)) hideCursor();
    });
  })();

  function renderChartCard(){
    var buttons = $('rangeTabs').querySelectorAll('button');
    Array.prototype.forEach.call(buttons, function(b){
      var active = b.getAttribute('data-range') === selectedRange;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if(!historyDoc){
      chartState = null;
      $('chart').innerHTML = '<div class="chart-empty">Không tải được lịch sử giá. Kiểm tra kết nối rồi mở lại app.</div>';
      $('chartLegend').innerHTML = '';
      return;
    }
    var data = dailySeries(getChanges(), chartItems(), RANGE_DAYS[selectedRange]);
    $('chart').innerHTML = renderChart(data);
    renderLegend(data);
  }

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
