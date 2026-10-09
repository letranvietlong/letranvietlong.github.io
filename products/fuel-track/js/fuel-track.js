(function(){
  'use strict';

  // VAPID PUBLIC key (base64url, 87 chars, starts with "B") for price-change
  // notifications. Its private half lives ONLY in the GitHub secret
  // PUSH_VAPID_PRIVATE_KEY, and it must be the SAME key as in GoldTrack and
  // LoveDays (one key pair for all apps — a mismatch makes every push 403).
  // Empty = notifications off. See docs/fuel-track.md → "Thông báo giá".
  var VAPID_PUBLIC_KEY = '';

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
  var SHORT_LABELS = { 'e10-ron95-iii':'E10', 'e5-ron92-ii':'E5', 'ron95-iii':'RON 95', 'do-005s-ii':'DO', 'ko':'Dầu hỏa' };
  function shortLabel(id){ return SHORT_LABELS[id] || itemLabel(id); }
  // Index of the change point in effect on `day` (last one with date ≤ day),
  // the same forward-fill as dailySeries; -1 before the first point.
  function pointIndexOn(day){
    var changes = getChanges();
    for(var i = changes.length - 1; i >= 0; i--){ if(changes[i].date <= day) return i; }
    return -1;
  }
  // Each change point is a full snapshot, so an item missing from it (e.g.
  // RON 95-III after 06/2026) had no listed price that day.
  function priceOn(id, day){
    var i = pointIndexOn(day);
    var p = i >= 0 ? getChanges()[i].prices || {} : {};
    return p[id] != null ? p[id] : null;
  }
  // On an adjustment day the new price only applies from 15:00, so the day
  // has two list prices: { before, after } (before = null for the first point).
  function adjustmentOn(id, day){
    var changes = getChanges();
    var i = pointIndexOn(day);
    if(i < 0 || changes[i].date !== day) return null;
    var after = (changes[i].prices || {})[id];
    var before = i > 0 ? (changes[i - 1].prices || {})[id] : null;
    if(after == null || before == null || after === before) return null;
    return { before: before, after: after };
  }
  function itemsOn(day){
    var i = pointIndexOn(day);
    if(i < 0) return [];
    var prices = getChanges()[i].prices || {};
    return itemOrder().filter(function(id){ return prices[id] != null; });
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

  // ---------- Kỳ điều chỉnh tới ----------
  // Weekly on Thursday, effective 15:00 VN (Decree 80/2023). Holidays shift it
  // and there's no reliable list, so it is labelled "dự kiến". No direction
  // forecast on purpose: VN prices follow paid Platts data + the stabilisation
  // fund, which nothing free predicts (see docs/fuel-track.md).
  var WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  var EFFECTIVE_UTC_HOUR = 8;  // 15:00 VN
  function nextAdjustment(nowMs){
    var vn = new Date(nowMs + 7 * 3600000);
    var y = vn.getUTCFullYear(), m = vn.getUTCMonth(), d = vn.getUTCDate();
    var today = msToDay(Date.UTC(y, m, d));
    var changes = getChanges();
    var last = changes.length ? changes[changes.length - 1].date : null;
    var days = (4 - vn.getUTCDay() + 7) % 7;
    if(days === 0){
      if(last === today) days = 7;
      // Past 15:00 on Thursday but the hourly bot hasn't recorded it yet.
      else if(nowMs >= Date.UTC(y, m, d, EFFECTIVE_UTC_HOUR)) return { waiting: true, day: today };
    }
    var targetMs = Date.UTC(y, m, d + days, EFFECTIVE_UTC_HOUR);
    return { waiting: false, day: msToDay(Date.UTC(y, m, d + days)), weekday: WEEKDAYS[(vn.getUTCDay() + days) % 7], leftMs: targetMs - nowMs };
  }
  function fmtLeft(ms){
    var mins = Math.max(0, Math.floor(ms / 60000));
    var dd = Math.floor(mins / 1440), hh = Math.floor(mins % 1440 / 60), mm = mins % 60;
    return dd >= 1 ? 'còn ' + dd + ' ngày ' + hh + ' giờ' : 'còn ' + hh + ' giờ ' + mm + ' phút';
  }
  function dayMonth(day){ return day.slice(8, 10) + '/' + day.slice(5, 7); }
  // Last `max` real moves of one item between consecutive change points
  // (points where only other items moved are skipped).
  function recentDeltas(id, max){
    var changes = getChanges(), out = [];
    for(var i = changes.length - 1; i > 0 && out.length < max; i--){
      var a = (changes[i - 1].prices || {})[id], b = (changes[i].prices || {})[id];
      if(a == null || b == null || a === b) continue;
      out.unshift(b - a);
    }
    return out;
  }
  function trendInfo(id){
    var deltas = recentDeltas(id, 4);
    var today = vnToday();
    var cur = priceOn(id, today);
    var base = priceOn(id, msToDay(dayToMs(today) - 30 * DAY_MS));
    var streak = '';
    if(deltas.length >= 2){
      if(deltas.every(function(x){ return x > 0; })) streak = 'Tăng ' + deltas.length + ' kỳ liền';
      else if(deltas.every(function(x){ return x < 0; })) streak = 'Giảm ' + deltas.length + ' kỳ liền';
    }
    return { deltas: deltas, d30: cur != null && base != null ? cur - base : null, base30: base, streak: streak };
  }
  function renderForecast(){
    var el = $('nextContent');
    if(!historyDoc || !getChanges().length){
      el.innerHTML = '<p class="state-msg">Chưa có lịch sử giá để tính kỳ tới.</p>';
      return;
    }
    var nx = nextAdjustment(Date.now());
    var head = nx.waiting ?
      '<div class="next-when"><span class="next-date">Đang chờ giá kỳ ' + dayMonth(nx.day) + '</span></div>' +
      '<p class="next-meta">Giá mới áp dụng từ 15:00, app tự cập nhật khi có.</p>' :
      '<div class="next-when"><span class="next-date">' + nx.weekday + ' ' + dayMonth(nx.day) + ' · 15:00</span></div>' +
      '<p class="next-meta"><span class="next-left">' + fmtLeft(nx.leftMs) + '</span> · dự kiến</p>' +
      '<p class="next-note">Có thể dời dịp lễ</p>';
    var rows = chartItems().map(function(it){
      var t = trendInfo(it.id);
      var chips = t.deltas.map(function(dl){ return changeChip(dl, true); }).join('');
      return '<div class="trend-row" data-item="' + escapeHtml(it.id) + '">' +
        '<div class="trend-top"><span class="trend-name">' + escapeHtml(it.label) + '</span>' +
          (t.d30 != null ? '<span class="trend-30"><span class="trend-30-lbl">30N</span>' + rangeChip(t.d30, t.base30) + '</span>' : '') +
        '</div>' +
        '<div class="trend-deltas">' + (chips || '<span class="trend-none">Chưa có kỳ đổi giá</span>') +
          (t.streak ? '<span class="trend-streak">' + t.streak + '</span>' : '') + '</div>' +
      '</div>';
    }).join('');
    el.innerHTML = head + (rows ? '<p class="trend-cap">4 kỳ đổi giá gần nhất</p><div class="trend-list">' + rows + '</div>' : '');
  }

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
  // ---------- Sheets (shared with fuel-track-log.js) ----------
  // sheet id → backdrop id; onClose hooks let a sheet clean up however it was
  // dismissed (button, backdrop, Escape, drag).
  var SHEETS = { versionSheet: 'versionBackdrop', fillSheet: 'fillBackdrop', vehSheet: 'vehBackdrop', confirmSheet: 'confirmBackdrop' };
  var sheetHooks = {};
  var sheetStack = [];
  function openSheet(id, onClose){
    sheetHooks[id] = onClose || null;
    $(id).classList.add('open');
    $(SHEETS[id]).classList.add('open');
    sheetStack = sheetStack.filter(function(s){ return s !== id; }).concat(id);
  }
  function closeSheet(id){
    if(!$(id).classList.contains('open')) return;
    $(id).classList.remove('open');
    $(SHEETS[id]).classList.remove('open');
    sheetStack = sheetStack.filter(function(s){ return s !== id; });
    var hook = sheetHooks[id];
    sheetHooks[id] = null;
    if(hook) hook();
  }
  Object.keys(SHEETS).forEach(function(id){
    $(SHEETS[id]).addEventListener('click', function(){ closeSheet(id); });
    var sheet = $(id);
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
      if(currentY > 120) closeSheet(id);
      currentY = 0;
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && sheetStack.length) closeSheet(sheetStack[sheetStack.length - 1]);
  });
  $('btnVersion').addEventListener('click', function(){ renderChangelog(); openSheet('versionSheet'); });
  $('versionClose').addEventListener('click', function(){ closeSheet('versionSheet'); });

  // iOS: 100dvh/svh can stay stale after the keyboard closes; visualViewport
  // resize is reliable, so sheets size themselves from it (ios-pwa-pitfalls §3).
  function syncViewport(){
    if(window.visualViewport) document.documentElement.style.setProperty('--vv-height', Math.round(window.visualViewport.height) + 'px');
  }
  syncViewport();
  if(window.visualViewport) window.visualViewport.addEventListener('resize', syncViewport);

  var toastTimer = null;
  function toast(msg){
    var t = $('toast');
    t.textContent = msg;
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      t.classList.remove('show');
      // Clear the role=status text once hidden so screen readers can't land on a stale message.
      toastTimer = setTimeout(function(){ if(!t.classList.contains('show')) t.textContent = ''; }, 300);
    }, 2600);
  }

  // ---------- Tabs ----------
  var TAB_VIEWS = { prices: 'viewPrices', log: 'viewLog', settings: 'viewSettings' };
  var currentTab = 'prices';
  function switchTab(tab){
    if(!TAB_VIEWS[tab]) return;
    currentTab = tab;
    Object.keys(TAB_VIEWS).forEach(function(key){ $(TAB_VIEWS[key]).hidden = key !== tab; });
    Array.prototype.forEach.call(document.querySelectorAll('.tabbar-btn'), function(btn){
      var active = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('active', active);
      if(active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    hideCursor();
    window.scrollTo(0, 0);
    if(tab === 'settings'){ renderPush(); renderDiag(); }
    document.dispatchEvent(new CustomEvent('fueltrack:tab', { detail: tab }));
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tabbar-btn'), function(btn){
    btn.addEventListener('click', function(){ switchTab(btn.getAttribute('data-tab')); });
  });

  // ---------- Thông báo khi giá đổi ----------
  // The page only subscribes and shows the subscription JSON; the push itself
  // comes from py/notify_fuel_price.py in the price workflow.
  var PUSH_STORE = 'fueltrack_push_v1';
  var PUSH_ICON = '/products/fuel-track/img/fuel-track-icon-180.png';
  var push = { reg: null, sub: null, busy: false, key: undefined, rec: { deviceLabel: '', lastCopiedEndpointHash: null } };

  function isStandalone(){
    return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  }
  function pushSupported(){
    return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
  }
  function vapidKey(){
    if(push.key !== undefined) return push.key;
    push.key = null;
    try{
      var s = VAPID_PUBLIC_KEY;
      var bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
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
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  }
  function loadPushRec(){
    try{
      var r = JSON.parse(localStorage.getItem(PUSH_STORE) || 'null');
      if(!r || typeof r !== 'object') return;
      if(typeof r.deviceLabel === 'string' && r.deviceLabel.length <= 40) push.rec.deviceLabel = r.deviceLabel;
      if(typeof r.lastCopiedEndpointHash === 'string' && /^[0-9a-f]{16}$/.test(r.lastCopiedEndpointHash)) push.rec.lastCopiedEndpointHash = r.lastCopiedEndpointHash;
    }catch(e){}
  }
  function savePushRec(){
    try{ localStorage.setItem(PUSH_STORE, JSON.stringify(push.rec)); }catch(e){}
  }
  function pushLabel(){ return $('pushLabel').value.trim().slice(0, 40) || 'iPhone'; }
  function subJson(sub){
    var j = sub.toJSON();
    return JSON.stringify({ label: pushLabel(), endpoint: j.endpoint, expirationTime: j.expirationTime == null ? null : j.expirationTime, keys: j.keys });
  }
  function userErr(msg){ var e = new Error(msg); e.userMessage = msg; return e; }
  function showError(id, msg){
    $(id).textContent = msg || '';
    $(id).hidden = !msg;
  }
  // Never waits forever: `ready` doesn't settle when the SW failed to install.
  function swReady(){
    if(push.reg) return Promise.resolve(push.reg);
    return new Promise(function(resolve, reject){
      var t = setTimeout(function(){ reject(userErr('App chưa sẵn sàng chạy nền. Hãy đóng hẳn app, mở lại rồi thử lại.')); }, 8000);
      navigator.serviceWorker.ready.then(function(reg){ clearTimeout(t); push.reg = reg; resolve(reg); });
    });
  }
  function refreshSub(){
    if(!pushSupported()) return Promise.resolve();
    return navigator.serviceWorker.getRegistration('/products/fuel-track/').then(function(reg){
      if(!reg) return;
      push.reg = reg;
      return reg.pushManager.getSubscription().then(function(sub){ push.sub = sub; });
    }).catch(function(){});
  }
  function testBlockedReason(){
    if(typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'Gửi thử cần mở app từ icon Màn hình chính (iOS 16.4+).';
    if(Notification.permission === 'denied') return 'Gửi thử bị tắt vì thông báo đang bị chặn.';
    return '';
  }
  function renderPush(){
    var perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    var key = vapidKey(), sub = currentSub();
    var status = '', ok = false, warn = false, canEnable = false;
    if(!VAPID_PUBLIC_KEY){
      status = 'Chưa cấu hình khoá thông báo';
    } else if(!key){
      status = 'Khoá thông báo không hợp lệ';
      warn = true;
    } else if(!pushSupported() || !isStandalone()){
      status = 'Chỉ bật được khi mở từ icon Màn hình chính (iOS 16.4+)';
    } else if(perm === 'denied'){
      status = 'Đã chặn — bật lại ở Cài đặt iPhone → Thông báo → FuelTrack';
      warn = true;
    } else if(sub){
      ok = true;
      status = 'Đã bật ✓';
    } else {
      canEnable = true;
      status = perm === 'granted' ? 'Đã cho phép, chưa có mã' : 'Chưa bật trên máy này';
    }
    // role=status: only write when the text changes, or it re-announces on every visit.
    if($('pushStatus').textContent !== status) $('pushStatus').textContent = status;
    $('pushStatus').classList.toggle('ok', ok);
    $('pushStatus').classList.toggle('warn', warn);
    $('pushLabelField').hidden = !key;
    $('btnPushEnable').hidden = ok || !key;
    $('btnPushEnable').disabled = !canEnable || push.busy;
    $('btnPushEnable').textContent = push.busy ? 'Đang bật…' : 'Bật thông báo';
    var blocked = testBlockedReason();
    $('btnPushTest').disabled = !!blocked;
    var note = $('pushTestNote');
    if(blocked){ note.textContent = blocked; note.hidden = false; }
    else if(note.getAttribute('data-kind') !== 'result') note.hidden = true;
    $('pushSubBox').hidden = !sub;
    if(sub) $('pushSubJson').value = subJson(sub);
    checkPushChanged();
  }
  function checkPushChanged(){
    var stored = push.rec.lastCopiedEndpointHash;
    var sub = currentSub();
    var changed = !!stored && !!vapidKey() && pushSupported() && (!sub || endpointHash(sub.endpoint) !== stored);
    $('pushChanged').hidden = !changed;
    // No subscription at all may simply mean notifications were turned off
    // on purpose — let the user say so, which forgets the stored hash.
    $('btnPushDismiss').hidden = !changed || !!sub;
  }
  function testBody(){
    var changes = getChanges();
    if(!changes.length) return 'Thông báo thử trên máy này';
    var last = changes[changes.length - 1].prices || {};
    var prev = changes.length > 1 ? changes[changes.length - 2].prices || {} : {};
    var parts = itemOrder().filter(function(id){ return last[id] != null; }).map(function(id){
      if(prev[id] == null) return shortLabel(id) + ' ' + fmtVnd(last[id]) + ' (mới)';
      if(last[id] === prev[id]) return '';
      var d = last[id] - prev[id];
      return shortLabel(id) + ' ' + fmtVnd(last[id]) + ' (' + (d > 0 ? '+' : '−') + fmtVnd(Math.abs(d)) + ')';
    }).filter(Boolean);
    return parts.join(' · ') || 'Thông báo thử trên máy này';
  }
  function initPush(){
    loadPushRec();
    $('pushLabel').value = push.rec.deviceLabel;
    renderPush();
    refreshSub().then(renderPush);
  }
  $('pushLabel').addEventListener('input', function(){
    var sub = currentSub();
    if(sub) $('pushSubJson').value = subJson(sub);
  });
  $('pushLabel').addEventListener('change', function(){
    push.rec.deviceLabel = $('pushLabel').value.trim().slice(0, 40);
    savePushRec();
  });
  $('btnPushDismiss').addEventListener('click', function(){
    push.rec.lastCopiedEndpointHash = null;
    savePushRec();
    checkPushChanged();
  });
  // requestPermission() must be the first thing in the tap (iOS only shows
  // the prompt during a user gesture).
  $('btnPushEnable').addEventListener('click', function(){
    var key = vapidKey();
    if(push.busy || !key || !pushSupported()) return;
    showError('pushError', null);
    var permP = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
    push.busy = true;
    renderPush();
    Promise.resolve(permP).then(function(perm){
      if(perm !== 'granted') throw userErr(perm === 'denied' ? 'Bạn đã chọn Không cho phép. Bật lại trong Cài đặt iPhone → Thông báo → FuelTrack.' : 'Chưa được cho phép. Hãy chạm lại và chọn Cho phép.');
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
      push.rec.deviceLabel = $('pushLabel').value.trim().slice(0, 40);
      savePushRec();
    }).catch(function(err){
      showError('pushError', (err && err.userMessage) || 'Không bật được thông báo (' + (err && err.name || 'lỗi') + '). Hãy thử lại.');
    }).then(function(){
      push.busy = false;
      renderPush();
      renderDiag();
    });
  });
  $('btnPushCopy').addEventListener('click', function(){
    var sub = currentSub();
    if(!sub) return;
    var ta = $('pushSubJson'), txt = subJson(sub);
    ta.value = txt;
    function done(msg){
      push.rec.lastCopiedEndpointHash = endpointHash(sub.endpoint);
      push.rec.deviceLabel = $('pushLabel').value.trim().slice(0, 40);
      savePushRec();
      checkPushChanged();
      $('pushCopyNote').textContent = msg;
    }
    function fallback(){
      ta.focus();
      ta.select();
      try{ ta.setSelectionRange(0, txt.length); }catch(e){}
      var ok = false;
      try{ ok = document.execCommand('copy'); }catch(e){}
      done(ok ? 'Đã sao chép ✓ Dán vào secret FUEL_PUSH_SUBSCRIPTIONS.' : 'Không tự sao chép được — mã đã được bôi đen, chạm giữ rồi chọn Sao chép.');
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){
        done('Đã sao chép ✓ Dán vào secret FUEL_PUSH_SUBSCRIPTIONS.');
      }, fallback);
    } else fallback();
  });
  $('btnPushTest').addEventListener('click', function(){
    if(testBlockedReason()) return;
    showError('pushError', null);
    var note = $('pushTestNote');
    note.hidden = true;
    note.removeAttribute('data-kind');
    var permP = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
    Promise.resolve(permP).then(function(perm){
      if(perm !== 'granted') throw userErr('Cần cho phép thông báo thì mới gửi thử được.');
      return swReady();
    }).then(function(reg){
      return reg.showNotification('Giá xăng dầu (thử)', { body: testBody(), tag: 'fuel-price-test', icon: PUSH_ICON });
    }).then(function(){
      note.textContent = 'Đã gửi thử ✓ Không thấy? Xem Cài đặt iPhone → Thông báo.';
      note.setAttribute('data-kind', 'result');
      note.hidden = false;
      renderPush();
      renderDiag();
    }).catch(function(err){
      showError('pushError', (err && err.userMessage) || 'Không gửi thử được (' + (err && err.name || 'lỗi') + ').');
      renderPush();
    });
  });

  function renderDiag(){
    var probe = getComputedStyle($('safeProbe'));
    var bar = $('tabbar').getBoundingClientRect();
    $('diagLine').textContent = [
      'standalone ' + (isStandalone() ? 'có' : 'không'),
      'thông báo ' + (typeof Notification === 'undefined' ? 'không hỗ trợ' : Notification.permission),
      'push ' + (!pushSupported() ? 'không hỗ trợ' : currentSub() ? 'đã đăng ký' : 'chưa đăng ký'),
      'màn hình ' + screen.height + ' / viewport ' + window.innerHeight,
      'safe-area ' + parseFloat(probe.paddingTop) + '/' + parseFloat(probe.paddingBottom),
      'tabbar đáy ' + Math.round(bar.bottom)
    ].join(' · ');
  }

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
      renderForecast();
      renderChartCard();
      renderHistory();
      document.dispatchEvent(new Event('fueltrack:history'));
    });
  }

  window.FuelTrackShared = {
    getChanges: getChanges, priceOn: priceOn, adjustmentOn: adjustmentOn, itemsOn: itemsOn,
    itemLabel: itemLabel, shortLabel: shortLabel, itemOrder: itemOrder,
    vnToday: vnToday, fmtVnd: fmtVnd, fmtDate: fmtDate, dayToMs: dayToMs, msToDay: msToDay,
    escapeHtml: escapeHtml, changeChip: changeChip,
    openSheet: openSheet, closeSheet: closeSheet, toast: toast, showError: showError,
    currentTab: function(){ return currentTab; }
  };

  initPush();
  loadAll(false);
  // The countdown ticks by the minute.
  setInterval(function(){ if(document.visibilityState === 'visible') renderForecast(); }, 60000);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState !== 'visible') return;
    renderForecast();
    refreshSub().then(renderPush);
    loadAll(true);
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
