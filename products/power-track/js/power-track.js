// PowerTrack giao diện: tổng quan, hoá đơn, giá điện, cài đặt, sao lưu.
// Mọi phép tính nằm ở power-track-core.js (window.PowerTrackCore).
(function(){
  'use strict';

  var C = window.PowerTrackCore;
  if(!C) return;

  var KEY = 'powertrack_v1';
  var BACKUP_KEY = 'powertrack_last_backup_v1';
  var BASE = '/products/power-track/';
  var DAY_MS = 86400000;
  var MINUS = '−';

  function $(id){ return document.getElementById(id); }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function fmtVnd(n){
    var s = String(Math.round(Math.abs(n)));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 && s !== '0' ? '-' : '') + s;
  }
  // vi-VN: comma decimals. Rounded on the absolute value so +x and −x agree.
  function fmtDec(n, digits){
    if(!isFinite(n)) return '—';
    return Math.abs(n).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function fmtDate(iso){
    var p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }
  function monthName(period){ return 'tháng ' + (+period.slice(5, 7)) + '/' + period.slice(0, 4); }
  function capFirst(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
  function newId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  // By code point (never half an emoji), down to at most n UTF-16 units —
  // the unit the stored-data limits are counted in.
  function clip(s, n){
    var a = Array.from(s);
    while(a.join('').length > n) a.pop();
    return a.join('');
  }

  // ---------- Dữ liệu ----------
  var data = C.emptyData();
  var broken = false;      // stored data unreadable → never overwrite it implicitly
  var brokenRaw = null;
  var selectedPlace = null;
  // The exact stored string `data` was read from (null = nothing stored).
  // Another window of the app may have saved since: every write first checks
  // that storage still holds this string, and refuses if it does not.
  var loadedRaw = null;
  var STALE_MSG = 'Dữ liệu vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.';

  function readRaw(){
    try{ return localStorage.getItem(KEY); }catch(e){ return null; }
  }
  function load(){
    broken = false; brokenRaw = null;
    var raw = readRaw();
    loadedRaw = raw;
    if(!raw){ data = C.emptyData(); return; }
    try{
      var obj = JSON.parse(raw);
      if(C.validateDataset(obj)) throw new Error('invalid');
      data = C.cleanDataset(obj);
    }catch(e){
      data = C.emptyData();
      broken = true;
      brokenRaw = raw;
    }
  }
  // Writes, reads back and verifies; on any failure the previous stored value
  // is put back and an error message returned.
  function persist(next){
    var prev = readRaw();
    if(prev !== loadedRaw){
      reloadData();
      return STALE_MSG;
    }
    var text = JSON.stringify(next);
    try{
      localStorage.setItem(KEY, text);
      if(localStorage.getItem(KEY) !== text) throw new Error('readback');
    }catch(e){
      try{ if(prev == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, prev); }catch(e2){}
      return 'Không lưu được trên máy này (bộ nhớ đầy hoặc bị chặn).';
    }
    data = next;
    loadedRaw = text;
    broken = false; brokenRaw = null;
    return null;
  }
  // Storage changed under us: take the stored copy and redraw everything
  // except an open form, whose typed text stays as it is.
  function reloadData(){
    load();
    if(selectedPlace && !placeById(selectedPlace)) selectedPlace = null;
    chartSel = null;
    closeSheet('placePickSheet');
    renderAll();
  }
  function cloneData(){ return JSON.parse(JSON.stringify(data)); }
  function askPersist(){
    try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){}); }catch(e){}
  }

  function placeById(id){ return data.places.filter(function(p){ return p.id === id; })[0] || null; }
  function placeBills(pid){
    return data.bills.filter(function(b){ return b.placeId === pid; }).sort(function(a, b){ return a.period < b.period ? -1 : a.period > b.period ? 1 : 0; });
  }
  function billAt(pid, period, exceptId){
    return data.bills.filter(function(b){ return b.placeId === pid && b.period === period && b.id !== exceptId; })[0] || null;
  }
  function defaultPlace(){
    if(selectedPlace && placeById(selectedPlace)) return selectedPlace;
    var latest = data.bills.slice().sort(function(a, b){ return a.period < b.period ? -1 : a.period > b.period ? 1 : a.updatedAt - b.updatedAt; }).pop();
    return latest ? latest.placeId : data.places[0].id;
  }

  // ---------- Biểu giá ----------
  var tariffDoc = null;
  var tariffState = 'loading';   // 'loading' | 'error' — only matters while tariffDoc is null
  var changelog = null;
  var loading = false;

  // A request that never answers would leave the skeleton up for good, so
  // every fetch is aborted after 15 s.
  var FETCH_TIMEOUT_MS = 15000;
  function fetchJson(path){
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, FETCH_TIMEOUT_MS) : null;
    function done(){ if(timer) clearTimeout(timer); }
    return fetch(BASE + path, ctrl ? { cache: 'no-store', signal: ctrl.signal } : { cache: 'no-store' }).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(d){ done(); return d; }, function(e){ done(); throw e; });
  }
  function loadAll(){
    if(loading) return;
    loading = true;
    if(!tariffDoc){ tariffState = 'loading'; renderTariff(); }
    var pT = fetchJson('json/electricity-tariff.json').then(function(d){
      if(!C.validTariffDoc(d)) throw new Error('shape');
      tariffDoc = d;
    }).catch(function(){ if(!tariffDoc) tariffState = 'error'; });
    var pC = fetchJson('data/changelog.json').then(function(d){
      if(d && Array.isArray(d.entries)) changelog = d;
    }, function(){});
    Promise.all([pT, pC]).then(function(){
      loading = false;
      renderAll();
      // An open form keeps every input as it is; only its computed line follows the tariff.
      if($('billSheet').classList.contains('open')) updateCalc();
    });
  }

  // What to show for one bill: the amount on the bill when there is one,
  // else the estimate from the tariff — never the two mixed without a label.
  function billView(b){
    var calc = tariffDoc ? C.calcBill(b, tariffDoc) : null;
    var hasCalc = !!calc && !calc.noTariff;
    var money = b.amount != null ? b.amount : hasCalc ? calc.total : null;
    // kWh derived from the amount itself: comparing it back with the amount
    // would always "match", so no comparison is shown for such a bill.
    var inferred = b.kwhInferred === true;
    return {
      calc: calc, hasCalc: hasCalc, money: money, inferred: inferred,
      kind: b.amount != null ? 'bill' : money != null ? 'est' : 'none',
      cmp: b.amount != null && hasCalc && !inferred && b.kwh != null ? C.compareBill(b.amount, calc.total) : null
    };
  }
  function badgeHtml(kind){
    return kind === 'bill' ? '<span class="badge bill">Theo hoá đơn</span>' :
      kind === 'est' ? '<span class="badge est">Ước tính</span>' :
      '<span class="badge none">' + (tariffLoading() ? 'Đang tải biểu giá…' : 'Chưa có tiền') + '</span>';
  }
  function tariffLoading(){ return !tariffDoc && tariffState === 'loading'; }
  function noMoneyReason(){
    return tariffDoc ? 'Chưa có biểu giá cho kỳ này' : tariffState === 'error' ? 'Chưa tải được biểu giá nên chưa ước tính được' : 'Đang tải biểu giá…';
  }
  function cmpText(cmp){
    if(cmp.match) return 'Khớp biểu giá';
    return 'Lệch ' + (cmp.diff > 0 ? '+' : MINUS) + fmtVnd(Math.abs(cmp.diff)) + ' đ so với biểu giá';
  }
  // Dearer/more = red ▲, cheaper/less = green ▼ — never colour alone.
  function deltaChip(delta, base, unit, key){
    var attr = ' data-k="' + key + '"';
    if(!delta) return '<span class="chip flat"' + attr + '>không đổi</span>';
    var up = delta > 0;
    var pct = base > 0 ? ' (' + (up ? '+' : MINUS) + fmtDec(delta / base * 100, 2) + '%)' : '';
    return '<span class="chip ' + (up ? 'up' : 'down') + '"' + attr + '>' + (up ? '▲' : '▼') + fmtVnd(Math.abs(delta)) + ' ' + unit + pct + '</span>';
  }
  function compareRow(cur, curView, other, label){
    var ov = billView(other), chips = '';
    if(curView.money != null && ov.money != null) chips += deltaChip(curView.money - ov.money, ov.money, 'đ', 'money');
    if(cur.kwh != null && other.kwh != null) chips += deltaChip(cur.kwh - other.kwh, other.kwh, 'kWh', 'kwh');
    var tags = [];
    if(ov.kind === 'est') tags.push('số ước tính');
    if(ov.inferred) tags.push('kWh suy ra');
    return '<span class="cmp-label">' + label + ' ' + monthName(other.period) + (tags.length ? ' (' + tags.join(', ') + ')' : '') + '</span>' +
      '<div class="cmp-chips">' + chips + '</div>';
  }
  function yearSummary(list, year){
    var s = { money: 0, kwh: 0, est: 0, none: 0, count: 0, inferred: 0, noKwh: 0 };
    list.forEach(function(b){
      if(b.period.slice(0, 4) !== year) return;
      var v = billView(b);
      s.count++;
      if(b.kwh != null) s.kwh += b.kwh; else s.noKwh++;
      if(v.inferred) s.inferred++;
      if(v.money != null) s.money += v.money;
      if(v.kind === 'est') s.est++;
      if(v.kind === 'none') s.none++;
    });
    return s;
  }
  function yearNote(s){
    var parts = [];
    if(s.est) parts.push('gồm ' + s.est + ' tháng ước tính');
    if(s.none) parts.push('chưa tính ' + s.none + ' tháng không có số tiền');
    if(s.inferred) parts.push('gồm ' + s.inferred + ' tháng kWh suy ra');
    if(s.noKwh) parts.push(s.noKwh + ' tháng chưa có số kWh');
    return parts.join(' · ');
  }

  // ---------- Header ----------
  function renderHeader(){
    selectedPlace = defaultPlace();
    var many = data.places.length > 1;
    $('btnPlace').hidden = !many;
    if(many){
      var p = placeById(selectedPlace);
      $('placeBtnName').textContent = p ? p.name : '';
      $('btnPlace').setAttribute('aria-label', 'Đang xem ' + (p ? p.name : '') + ' — đổi nơi');
    }
    $('brokenBanner').hidden = !broken;
  }
  $('btnPlace').addEventListener('click', function(){
    $('placePickList').innerHTML = data.places.map(function(p){
      var on = p.id === selectedPlace;
      return '<button type="button" class="pick-row" role="radio" aria-checked="' + on + '" data-place="' + esc(p.id) + '">' + esc(p.name) +
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></button>';
    }).join('');
    openSheet('placePickSheet');
  });
  $('placePickList').addEventListener('click', function(e){
    var b = e.target.closest('button[data-place]');
    if(!b) return;
    selectedPlace = b.getAttribute('data-place');
    chartSel = null;
    closeSheet('placePickSheet');
    renderAll();
  });

  // ---------- Tổng quan ----------
  var chartMode = 'money';   // not persisted on purpose
  var chartSel = null;

  function renderOverview(){
    var list = placeBills(selectedPlace), none = !list.length;
    $('ovEmpty').hidden = !none || broken;
    $('ovMain').hidden = none;
    $('ovChartCard').hidden = none;
    $('ovDiffCard').hidden = none;
    $('ovYearCard').hidden = none;
    if(none){
      var first = !data.bills.length;
      $('ovEmptyTitle').textContent = first ? 'Chưa có hoá đơn nào' : 'Nơi này chưa có hoá đơn nào';
      $('ovEmptyNote').hidden = !first;
      $('btnAddFirst').textContent = first ? 'Thêm hoá đơn đầu tiên' : 'Thêm hoá đơn';
      $('btnEmptyRestore').hidden = !C.isDefaultData(data);
      return;
    }
    var cur = list[list.length - 1], v = billView(cur);
    var map = Object.create(null);
    list.forEach(function(b){ map[b.period] = b; });

    $('ovTitle').textContent = 'Tiền điện ' + monthName(cur.period);
    $('ovBadge').outerHTML = badgeHtml(v.kind).replace('<span ', '<span id="ovBadge" ');
    $('ovMoney').innerHTML = v.money != null ? fmtVnd(v.money) + ' <span class="unit">đ</span>' : '<span class="muted">' + (tariffLoading() ? '…' : '—') + '</span>';
    var note = v.kind === 'none' ? noMoneyReason() :
      v.kind === 'est' && v.calc.estimated ? 'Kỳ vắt qua ngày đổi giá — chia theo số ngày, chỉ là ước tính.' :
      v.inferred ? 'kWh suy ra từ số tiền' :
      cur.kwh == null ? 'Chưa có biểu giá cho kỳ này nên chưa tính được số kWh' : '';
    $('ovNote').textContent = note;
    $('ovNote').hidden = !note;
    var ap = v.inferred ? '≈' : '';
    $('ovKwh').innerHTML = cur.kwh == null ? '—' : ap + fmtVnd(cur.kwh) + '<small>kWh</small>';
    $('ovPerKwh').innerHTML = v.money != null && cur.kwh > 0 ? ap + fmtVnd(Math.round(v.money / cur.kwh)) + '<small>đ/kWh</small>' : '—';
    var pd = C.perDay(cur);
    $('ovPerDay').innerHTML = pd.value == null ? '—' : (pd.approx || v.inferred ? '≈' : '') + fmtDec(pd.value, 2) + '<small>kWh/ngày</small>';

    var prev = map[C.addMonths(cur.period, -1)];
    $('ovPrev').hidden = !prev;
    $('ovPrev').innerHTML = prev ? compareRow(cur, v, prev, 'So với') : '';

    var yoy = map[C.addMonths(cur.period, -12)];
    $('ovYoY').hidden = !yoy;
    $('ovYoY').innerHTML = yoy ? compareRow(cur, v, yoy, 'Cùng kỳ năm trước,') : '';
    var year = cur.period.slice(0, 4), ys = yearSummary(list, year);
    $('yearTitle').textContent = yoy ? 'So sánh' : 'Cả năm';
    $('ovYear').innerHTML = '<span class="sum-k">Tổng năm ' + year + '</span><span class="sum-v">' + fmtVnd(ys.money) + ' đ · ' + fmtVnd(ys.kwh) + ' kWh</span>';
    var yn = yearNote(ys);
    $('ovYearNote').textContent = yn;
    $('ovYearNote').hidden = !yn;

    renderChart(cur.period, map);
    renderDiffChart(map);
  }

  function niceMax(v){
    if(!(v > 0)) return 1;
    var pow = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for(var i = 0; i < steps.length; i++){ if(steps[i] * pow >= v) return steps[i] * pow; }
    return 10 * pow;
  }
  function axisLabel(v, money){
    if(!money) return fmtVnd(v);
    if(v >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tr';
    if(v >= 1e3) return fmtVnd(Math.round(v / 1e3)) + 'k';
    return fmtVnd(v);
  }
  // Bars, so the Y axis starts at 0. A month without a bill (or without any
  // money figure) gets no bar; an estimated amount is drawn lighter.
  function renderChart(endPeriod, map){
    var money = chartMode === 'money';
    var months = [];
    for(var i = 11; i >= 0; i--) months.push(C.addMonths(endPeriod, -i));
    var pts = months.map(function(p){
      var b = map[p];
      if(!b) return { period: p, value: null };
      var v = billView(b);
      return { period: p, value: money ? v.money : b.kwh, est: money ? v.kind === 'est' : v.inferred, kind: v.kind, inferred: v.inferred };
    });
    var have = pts.filter(function(p){ return p.value != null; });
    if(!chartSel || months.indexOf(chartSel) < 0) chartSel = endPeriod;
    chartMonths = months;
    $('chartRange').textContent = (+months[0].slice(5, 7)) + '/' + months[0].slice(0, 4) + ' – ' + (+endPeriod.slice(5, 7)) + '/' + endPeriod.slice(0, 4);

    var W = 320, H = 168, L = 38, R = 2, T = 8, B = 22;
    var plotW = W - L - R, plotH = H - T - B, slot = plotW / 12, barW = Math.min(18, slot * 0.64);
    var max = niceMax(Math.max.apply(null, have.map(function(p){ return p.value; }).concat(0)));
    var unit = money ? 'đ' : 'kWh';
    var svg = '';
    [0, 0.5, 1].forEach(function(f){
      var y = T + plotH - plotH * f;
      svg += '<line class="chart-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="chart-axis" x="' + (L - 5) + '" y="' + (y + 3.5) + '" text-anchor="end">' + axisLabel(max * f, money) + '</text>';
    });
    pts.forEach(function(p, idx){
      var cx = L + slot * idx + slot / 2;
      svg += '<text class="chart-axis" x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + (+p.period.slice(5, 7)) + '</text>';
      if(p.value != null){
        var h = Math.max(p.value > 0 ? 2 : 0.5, plotH * p.value / max);
        svg += '<rect class="bar' + (p.est ? ' est' : '') + (p.period === chartSel ? ' sel' : '') + '" x="' + (cx - barW / 2).toFixed(2) + '" y="' + (T + plotH - h).toFixed(2) +
          '" width="' + barW.toFixed(2) + '" height="' + h.toFixed(2) + '" rx="3"/>';
      }
      svg += '<rect class="hit" data-period="' + p.period + '" x="' + (L + slot * idx).toFixed(2) + '" y="0" width="' + slot.toFixed(2) + '" height="' + H + '"/>';
    });
    var top = have.slice().sort(function(a, b){ return b.value - a.value; })[0];
    var last = have[have.length - 1];
    var label = 'Biểu đồ cột ' + (money ? 'tiền điện' : 'số kWh') + ' 12 tháng, từ ' + monthName(months[0]) + ' đến ' + monthName(endPeriod) + ': ' +
      (have.length ? have.length + ' tháng có số liệu, cao nhất ' + monthName(top.period) + ' ' + fmtVnd(top.value) + ' ' + unit +
        ', mới nhất ' + monthName(last.period) + ' ' + fmtVnd(last.value) + ' ' + unit + '.' : 'chưa có số liệu.');
    $('chart').innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">' + svg + '</svg>';
    $('chartLegend').hidden = !pts.some(function(p){ return p.est; });
    $('chartLegendText').textContent = money ? 'Cột nhạt: ước tính theo biểu giá' : 'Cột nhạt: kWh suy ra từ số tiền';

    var sel = pts.filter(function(p){ return p.period === chartSel; })[0];
    var txt = capFirst(monthName(chartSel)) + ': ';
    if(!map[chartSel]) txt += 'chưa có hoá đơn';
    else if(sel.value == null) txt += money ? noMoneyReason().toLowerCase() : 'chưa có số kWh';
    else txt += (!money && sel.inferred ? '≈' : '') + fmtVnd(sel.value) + ' ' + unit + (money ? (sel.kind === 'est' ? ' · ước tính' : ' · theo hoá đơn') : sel.inferred ? ' · suy ra từ số tiền' : '');
    if($('chartValue').textContent !== txt) $('chartValue').textContent = txt;
  }
  // Month-over-month change for the same 12 months as the chart above, sharing
  // its Tiền/kWh switch and selected month. Up = more than the month before
  // (red, ▲ in the text), down = less (green, ▼). A bar exists only when both
  // consecutive months have a figure — a missing month never becomes a fake 0.
  function renderDiffChart(map){
    var money = chartMode === 'money', unit = money ? 'đ' : 'kWh';
    function val(p){
      var b = map[p];
      if(!b) return null;
      var v = billView(b), x = money ? v.money : b.kwh;
      return x == null ? null : { value: x, soft: money ? v.kind === 'est' : !!v.inferred };
    }
    var pts = chartMonths.map(function(p){
      var prevP = C.addMonths(p, -1), a = val(p), b = val(prevP);
      return { period: p, prev: prevP, cur: a, base: b, delta: a && b ? a.value - b.value : null, soft: !!(a && b && (a.soft || b.soft)) };
    });
    var have = pts.filter(function(p){ return p.delta != null; });
    $('diffUnit').textContent = unit;
    $('diffEmpty').hidden = have.length > 0;
    $('diffBody').hidden = !have.length;
    if(!have.length){ $('diffChart').innerHTML = ''; return; }

    var W = 320, H = 168, L = 46, R = 2, T = 10, B = 22;
    var plotW = W - L - R, plotH = H - T - B, half = plotH / 2, mid = T + half, slot = plotW / 12, barW = Math.min(18, slot * 0.64);
    var max = niceMax(Math.max.apply(null, have.map(function(p){ return Math.abs(p.delta); })));
    var svg = '';
    [1, 0, -1].forEach(function(f){
      var y = mid - half * f;
      svg += '<line class="chart-grid' + (f === 0 ? ' zero' : '') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="chart-axis" x="' + (L - 5) + '" y="' + (y + 3.5) + '" text-anchor="end">' + (f === 0 ? '0' : (f > 0 ? '+' : MINUS) + axisLabel(max, money)) + '</text>';
    });
    pts.forEach(function(p, idx){
      var cx = L + slot * idx + slot / 2;
      svg += '<text class="chart-axis" x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + (+p.period.slice(5, 7)) + '</text>';
      if(p.delta != null){
        var h = p.delta === 0 ? 1.5 : Math.max(2, half * Math.abs(p.delta) / max);
        var y = p.delta > 0 ? mid - h : p.delta < 0 ? mid : mid - 0.75;
        svg += '<rect class="dbar ' + (p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : 'flat') + (p.soft ? ' soft' : '') + (p.period === chartSel ? ' sel' : '') +
          '" x="' + (cx - barW / 2).toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + h.toFixed(2) + '" rx="2"/>';
      }
      svg += '<rect class="hit" data-period="' + p.period + '" x="' + (L + slot * idx).toFixed(2) + '" y="0" width="' + slot.toFixed(2) + '" height="' + H + '"/>';
    });
    function signed(d){ return (d > 0 ? '+' : MINUS) + fmtVnd(Math.abs(d)) + ' ' + unit; }
    function shortMonth(p){ return 'T' + (+p.slice(5, 7)) + '/' + p.slice(0, 4); }
    var ups = have.filter(function(p){ return p.delta > 0; }).sort(function(a, b){ return b.delta - a.delta; });
    var downs = have.filter(function(p){ return p.delta < 0; }).sort(function(a, b){ return a.delta - b.delta; });
    var label = 'Biểu đồ chênh lệch ' + (money ? 'tiền điện' : 'số kWh') + ' từng tháng so với tháng trước: ' + have.length + ' tháng so được' +
      (ups.length ? ', tăng nhiều nhất ' + monthName(ups[0].period) + ' ' + signed(ups[0].delta) : '') +
      (downs.length ? ', giảm nhiều nhất ' + monthName(downs[0].period) + ' ' + signed(downs[0].delta) : '') + '.';
    $('diffChart').innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">' + svg + '</svg>';
    $('diffLegend').hidden = !pts.some(function(p){ return p.soft; });
    $('diffLegendText').textContent = money ? 'Cột nhạt: có tháng là số ước tính' : 'Cột nhạt: có tháng kWh suy ra từ số tiền';

    var sel = pts.filter(function(p){ return p.period === chartSel; })[0];
    var txt = capFirst(monthName(chartSel)) + ': ';
    if(!sel || !map[chartSel]) txt += 'chưa có hoá đơn';
    else if(!sel.cur) txt += money ? 'chưa có số tiền để so' : 'chưa có số kWh để so';
    else if(!sel.base) txt += 'chưa đủ dữ liệu để so (thiếu ' + monthName(sel.prev) + ')';
    else if(sel.delta === 0) txt += 'không đổi so với ' + monthName(sel.prev);
    else {
      var up = sel.delta > 0;
      txt += (up ? '▲' : '▼') + fmtVnd(Math.abs(sel.delta)) + ' ' + unit +
        (sel.base.value > 0 ? ' (' + (up ? '+' : MINUS) + fmtDec(sel.delta / sel.base.value * 100, 2) + '%)' : '') + ' so với ' + monthName(sel.prev);
    }
    if($('diffValue').textContent !== txt) $('diffValue').textContent = txt;

    var sum = [];
    if(have.length >= 2){
      if(ups.length) sum.push('Tăng nhiều nhất: ' + shortMonth(ups[0].period) + ' (' + signed(ups[0].delta) + ')');
      if(downs.length) sum.push('Giảm nhiều nhất: ' + shortMonth(downs[0].period) + ' (' + signed(downs[0].delta) + ')');
    }
    $('diffSum').hidden = !sum.length;
    $('diffSum').textContent = sum.join(' · ');
  }
  // The chart box itself takes focus; ←/→ walk the months.
  var chartMonths = [];
  $('chart').addEventListener('keydown', function(e){
    var step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if(!step || !chartMonths.length) return;
    e.preventDefault();
    var i = Math.max(0, Math.min(chartMonths.length - 1, chartMonths.indexOf(chartSel) + step));
    chartSel = chartMonths[i];
    renderOverview();
  });
  $('chart').addEventListener('click', function(e){
    var hit = e.target.closest ? e.target.closest('.hit') : null;
    if(!hit) return;
    chartSel = hit.getAttribute('data-period');
    renderOverview();
  });
  // The difference chart follows the same selected month.
  $('diffChart').addEventListener('keydown', function(e){
    var step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if(!step || !chartMonths.length) return;
    e.preventDefault();
    chartSel = chartMonths[Math.max(0, Math.min(chartMonths.length - 1, chartMonths.indexOf(chartSel) + step))];
    renderOverview();
    $('diffChart').focus({ preventScroll: true });
  });
  $('diffChart').addEventListener('click', function(e){
    var hit = e.target.closest ? e.target.closest('.hit') : null;
    if(!hit) return;
    chartSel = hit.getAttribute('data-period');
    renderOverview();
  });
  $('chartSeg').addEventListener('click', function(e){
    var b = e.target.closest('button[data-mode]');
    if(!b) return;
    chartMode = b.getAttribute('data-mode');
    setSeg('chartSeg', 'data-mode', chartMode);
    renderOverview();
  });
  // Updated in place: rebuilding the buttons would drop keyboard focus.
  function setSeg(id, attr, value){
    Array.prototype.forEach.call($(id).querySelectorAll('button'), function(x){
      var on = x.getAttribute(attr) === value;
      x.classList.toggle('active', on);
      x.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  // ---------- Hoá đơn ----------
  function renderBills(){
    var list = placeBills(selectedPlace);
    $('btnAddBill').disabled = broken;
    $('billsEmpty').hidden = !!list.length || broken;
    $('billsEmptyTitle').textContent = data.bills.length ? 'Nơi này chưa có hoá đơn nào' : 'Chưa có hoá đơn nào';
    var years = [];
    list.forEach(function(b){ var y = b.period.slice(0, 4); if(years.indexOf(y) < 0) years.push(y); });
    years.sort().reverse();
    $('billGroups').innerHTML = years.map(function(year){
      var ys = yearSummary(list, year), yn = yearNote(ys);
      var rows = list.filter(function(b){ return b.period.slice(0, 4) === year; }).reverse().map(function(b){
        var v = billView(b);
        var ap = v.inferred ? '≈' : '';
        var meta = (b.kwh == null ? '— kWh' : ap + fmtVnd(b.kwh) + ' kWh') + (v.money != null && b.kwh > 0 ? ' · ' + ap + fmtVnd(Math.round(v.money / b.kwh)) + ' đ/kWh' : '');
        return '<button type="button" class="bill-row" data-bill="' + esc(b.id) + '">' +
          '<span class="bill-main"><span class="bill-period">' + capFirst(monthName(b.period)) + '</span>' +
            '<span class="bill-meta">' + meta + '</span>' +
            (v.cmp ? '<span class="bill-cmp ' + (v.cmp.match ? 'ok' : 'off') + '">' + cmpText(v.cmp) + '</span>' : '') +
            (v.inferred ? '<span class="bill-hint">kWh suy ra từ số tiền</span>' : '') + '</span>' +
          '<span class="bill-right"><span class="bill-amount">' + (v.money != null ? fmtVnd(v.money) + ' đ' : tariffLoading() ? '…' : '—') + '</span>' + badgeHtml(v.kind) + '</span>' +
        '</button>';
      }).join('');
      return '<section class="card bill-card" data-year="' + year + '"><div class="card-head"><h2 class="card-title">' + year + '</h2>' +
        '<span class="card-meta">' + fmtVnd(ys.money) + ' đ · ' + fmtVnd(ys.kwh) + ' kWh' + (yn ? ' · ' + yn : '') + '</span></div>' + rows + '</section>';
    }).join('');
  }
  $('billGroups').addEventListener('click', function(e){
    var row = e.target.closest('[data-bill]');
    if(!row) return;
    var b = data.bills.filter(function(x){ return x.id === row.getAttribute('data-bill'); })[0];
    if(b) openBill(b);
  });

  // ---------- Form hoá đơn ----------
  // mode: which inputs give the kWh ('amount' | 'kwh' | 'index' | 'paste').
  // source: how the saved figures were entered. oldAuto: "Chỉ số cũ" holds a
  // suggestion (last month's new reading) the user has not touched. kwhAuto:
  // "Số kWh" holds the figure derived from the amount, not typed by the user.
  var form = { editing: null, mode: 'amount', source: 'amount', placeId: null, oldAuto: false, kwhAuto: false };

  // Error line → the inputs it speaks for (red border + aria-invalid);
  // `inputs` narrows it to the field actually wrong.
  var ERR_INPUTS = { fPeriodErr: ['fPeriod'], fIdxErr: ['fOld', 'fNew'], fKwhErr: ['fKwh'], fPasteErr: ['fPaste'], fAmountErr: ['fAmount'],
    fDateErr: ['fFrom', 'fTo'], pNameErr: ['pName'], calcErr: ['calcKwh'] };
  function setFieldError(id, msg, inputs){
    $(id).textContent = msg || '';
    $(id).hidden = !msg;
    var group = ERR_INPUTS[id];
    if(!group) return;
    group.forEach(function(f){ $(f).removeAttribute('aria-invalid'); $(f).removeAttribute('aria-describedby'); });
    if(msg) (inputs || group).forEach(function(f){ $(f).setAttribute('aria-invalid', 'true'); $(f).setAttribute('aria-describedby', id); });
  }
  function clearBillErrors(){
    ['fPeriodErr', 'fIdxErr', 'fKwhErr', 'fPasteErr', 'fAmountErr', 'fDateErr', 'billError'].forEach(function(id){ setFieldError(id, null); });
  }
  var MSG_INDEX = 'Chỉ số chỉ gồm chữ số, ví dụ 12612.';
  var MSG_KWH = 'Số kWh chỉ gồm chữ số, ví dụ 350.';
  var MSG_AMOUNT = 'Số tiền chỉ gồm chữ số, ví dụ 990.000.';
  function sheetOpen(id){ return $(id).classList.contains('open'); }

  function setMode(mode){
    form.mode = mode;
    setSeg('fModeSeg', 'data-mode', mode);
    $('fIdxBox').hidden = mode !== 'index';
    $('fKwhBox').hidden = mode !== 'kwh';
    $('fPasteBox').hidden = mode !== 'paste';
    // One money field for every mode: in "Số tiền" it is the input the kWh is
    // derived from (required); elsewhere it is the optional bill amount.
    $('fAmountLabel').innerHTML = mode === 'amount' ? 'Số tiền đã trả <em>(đ)</em>' : 'Tiền trên hoá đơn <em>(đ, không bắt buộc)</em>';
    // Nothing can be saved straight from the pasted text: it has to be
    // filled into the fields and checked first.
    $('btnBillSave').hidden = mode === 'paste';
  }
  function formKwh(){
    if(form.mode === 'kwh') return C.parseIntStrict($('fKwh').value);
    if(form.mode === 'index'){
      var o = C.parseIntStrict($('fOld').value), n = C.parseIntStrict($('fNew').value);
      return isFinite(o) && isFinite(n) && n >= o ? n - o : NaN;
    }
    return NaN;
  }
  function linesHtml(calc){
    return calc.segments.map(function(s){
      var head = calc.segments.length > 1 ?
        '<p class="calc-seg-title">' + fmtDate(s.from).slice(0, 5) + '–' + fmtDate(s.to).slice(0, 5) + ' · ' + s.days + ' ngày · ' + fmtVnd(s.kwh) + ' kWh · QĐ ' + esc(s.decision) + ' · VAT ' + fmtDec(s.vatPct, 0) + '%</p>' : '';
      return head + s.lines.map(function(l){
        return '<div class="calc-line"><span class="calc-line-k">Bậc ' + l.tier + ': ' + fmtVnd(l.kwh) + ' kWh × ' + fmtVnd(l.price) + '</span><span class="calc-line-v">' + fmtVnd(l.amount) + ' đ</span></div>';
      }).join('');
    }).join('');
  }
  var WHY_OFF = '<details class="more" data-key="why"><summary><span class="more-head">Vì sao có thể lệch?</span></summary><ul>' +
    '<li>Kỳ ghi chỉ số vắt qua ngày đổi giá — thêm từ ngày, đến ngày ở “Thêm chi tiết”.</li>' +
    '<li>Nhiều hộ dùng chung một công tơ nên định mức mỗi bậc được nhân lên.</li>' +
    '<li>Công tơ tính theo giá khác giá sinh hoạt (kinh doanh, thuê trọ…).</li>' +
    '<li>Biểu giá trong app chưa cập nhật quyết định mới nhất.</li></ul></details>';
  function formDates(){
    var from = $('fFrom').value, to = $('fTo').value;
    return { fromDate: C.realDate(from) ? from : null, toDate: C.realDate(to) ? to : null };
  }
  // "Số tiền" mode: the kWh for the amount in the form.
  // → null (nothing to derive from yet) | { wait: true } (no tariff loaded) | kwhFromAmount's result.
  // A saved bill whose amount, period and dates are untouched keeps the kWh it
  // was saved with, even if the tariff file has been corrected since.
  function inferNow(){
    var txt = $('fAmount').value.trim(), amount = C.parseIntStrict(txt), period = $('fPeriod').value;
    if(!txt || !isFinite(amount) || amount > C.MAX_AMOUNT || !C.validPeriod(period)) return null;
    var d = formDates(), ed = form.editing;
    if(ed && ed.source === 'amount' && ed.amount === amount && ed.period === period && ed.fromDate === ($('fFrom').value || null) && ed.toDate === ($('fTo').value || null)){
      return { kwh: ed.kwh, noTariff: ed.kwh == null, kept: true, exact: true, calcTotal: amount, diff: 0 };
    }
    if(!tariffDoc) return { wait: true };
    return C.kwhFromAmount({ amount: amount, period: period, fromDate: d.fromDate, toDate: d.toDate }, tariffDoc);
  }
  function inferHtml(){
    var r = inferNow();
    if(!r) return '';
    if(r.wait) return '<div class="calc-box-row"><span class="calc-box-k">' + noMoneyReason() + '</span></div>';
    if(r.noTariff) return '<div class="calc-box-row"><span class="calc-box-k" id="fInferNote">Chưa có biểu giá cho kỳ này — vẫn lưu được số tiền</span></div>';
    var html = '<div class="calc-box-row"><span class="calc-box-k">Số kWh suy ra</span><b id="fInferKwh">≈ ' + fmtVnd(r.kwh) + ' kWh</b></div>';
    if(r.kept) return html;
    html += r.exact ? '<p class="cmp ok" id="fInferNote">Khớp chính xác biểu giá</p>' :
      '<p class="cmp near" id="fInferNote">Gần nhất: ' + fmtVnd(r.kwh) + ' kWh (' + fmtVnd(r.calcTotal) + ' đ), lệch ' + (r.diff > 0 ? '+' : MINUS) + fmtVnd(Math.abs(r.diff)) + ' đ</p>';
    var d = formDates();
    var calc = C.calcBill({ kwh: r.kwh, period: $('fPeriod').value, fromDate: d.fromDate, toDate: d.toDate }, tariffDoc);
    return html + '<details class="more" data-key="lines"><summary><span class="more-head">Chi tiết từng bậc</span></summary>' + linesHtml(calc) +
      '<div class="calc-line"><span class="calc-line-k">Trước VAT</span><span class="calc-line-v">' + fmtVnd(calc.subtotal) + ' đ</span></div>' +
      '<div class="calc-line"><span class="calc-line-k">VAT</span><span class="calc-line-v">' + fmtVnd(calc.vat) + ' đ</span></div>' +
      (calc.estimated ? '<p class="field-hint">Kỳ vắt qua ngày đổi giá: chia theo số ngày, chỉ là ước tính.</p>' : '') + '</details>';
  }
  // Rewrites only the computed box — never an input.
  function updateCalc(){
    var box = $('fCalc');
    var kwh = formKwh(), period = $('fPeriod').value;
    var html = form.mode === 'amount' ? inferHtml() : '';
    if(form.mode === 'index' && isFinite(kwh)) html += '<div class="calc-box-row"><span class="calc-box-k">Tiêu thụ</span><b id="fUsage">' + fmtVnd(kwh) + ' kWh</b></div>';
    if(isFinite(kwh) && kwh <= C.MAX_KWH && C.validPeriod(period)){
      if(!tariffDoc){
        html += '<div class="calc-box-row"><span class="calc-box-k">' + noMoneyReason() + '</span></div>';
      } else {
        var from = $('fFrom').value, to = $('fTo').value;
        var calc = C.calcBill({ kwh: kwh, period: period, fromDate: C.realDate(from) ? from : null, toDate: C.realDate(to) ? to : null }, tariffDoc);
        if(calc.noTariff){
          html += '<div class="calc-box-row"><span class="calc-box-k">Chưa có biểu giá cho kỳ này</span></div>';
        } else {
          html += '<div class="calc-box-row"><span class="calc-box-k">Theo biểu giá' + (calc.estimated ? ' (ước tính)' : '') + '</span><b id="fCalcTotal">' + fmtVnd(calc.total) + ' đ</b></div>';
          var amount = C.parseIntStrict($('fAmount').value);
          var cmp = $('fAmount').value.trim() && isFinite(amount) ? C.compareBill(amount, calc.total) : null;
          if(cmp) html += '<p class="cmp ' + (cmp.match ? 'ok' : 'off') + '" id="fCalcCmp">' + cmpText(cmp) + '</p>';
          html += '<details class="more" data-key="lines"><summary><span class="more-head">Chi tiết từng bậc</span></summary>' + linesHtml(calc) +
            '<div class="calc-line"><span class="calc-line-k">Trước VAT</span><span class="calc-line-v">' + fmtVnd(calc.subtotal) + ' đ</span></div>' +
            '<div class="calc-line"><span class="calc-line-k">VAT</span><span class="calc-line-v">' + fmtVnd(calc.vat) + ' đ</span></div>' +
            (calc.estimated ? '<p class="field-hint">Kỳ vắt qua ngày đổi giá: số kWh và định mức từng bậc chia theo số ngày — cách làm tròn của EVN có thể khác đôi chút.</p>' : '') + '</details>';
          if(cmp && !cmp.match) html += WHY_OFF;
        }
      }
    }
    // Keep the <details> the user opened open across keystrokes.
    var open = Object.create(null);
    Array.prototype.forEach.call(box.querySelectorAll('details[data-key]'), function(d){ if(d.open) open[d.getAttribute('data-key')] = true; });
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('details[data-key]'), function(d){ if(open[d.getAttribute('data-key')]) d.open = true; });
    box.hidden = !html;
  }

  // Last month's new reading is offered as this month's old one — only into a
  // field that is empty or still holds an untouched suggestion, and only for
  // a new bill. Meters get replaced, so it is never enforced.
  function suggestOld(){
    if(form.editing) return;
    if($('fOld').value.trim() && !form.oldAuto) return;
    var period = $('fPeriod').value;
    var prev = C.validPeriod(period) ? billAt(form.placeId, C.addMonths(period, -1)) : null;
    if(prev && prev.newIndex != null){
      $('fOld').value = String(prev.newIndex);
      form.oldAuto = true;
      $('fOldHint').textContent = '· gợi ý từ ' + monthName(prev.period);
    } else if(form.oldAuto){
      $('fOld').value = '';
      form.oldAuto = false;
      $('fOldHint').textContent = '';
    }
  }
  function checkPeriod(){
    var period = $('fPeriod').value;
    if(!period) return true;
    if(!C.validPeriod(period)){ setFieldError('fPeriodErr', 'Kỳ chưa đúng — chọn tháng và năm, ví dụ 2026-09.'); return false; }
    if(period > C.vnMonth()){ setFieldError('fPeriodErr', 'Kỳ không được sau tháng này.'); return false; }
    var dup = billAt(form.placeId, period, form.editing ? form.editing.id : null);
    if(dup){
      var p = placeById(form.placeId);
      setFieldError('fPeriodErr', capFirst(monthName(period)) + ' đã có hoá đơn' + (data.places.length > 1 && p ? ' ở ' + p.name : '') + '. Mở hoá đơn đó để sửa, hoặc chọn kỳ khác.');
      return false;
    }
    setFieldError('fPeriodErr', null);
    return true;
  }
  function checkIndex(showEmpty){
    var ot = $('fOld').value.trim(), nt = $('fNew').value.trim();
    var o = C.parseIntStrict(ot), n = C.parseIntStrict(nt);
    if(ot && (isNaN(o) || o > C.MAX_INDEX)){ setFieldError('fIdxErr', MSG_INDEX, ['fOld']); return false; }
    if(nt && (isNaN(n) || n > C.MAX_INDEX)){ setFieldError('fIdxErr', MSG_INDEX, ['fNew']); return false; }
    if(showEmpty && !ot){ setFieldError('fIdxErr', 'Nhập chỉ số cũ.', ['fOld']); return false; }
    if(showEmpty && !nt){ setFieldError('fIdxErr', 'Nhập chỉ số mới.', ['fNew']); return false; }
    if(ot && nt && n < o){ setFieldError('fIdxErr', 'Chỉ số mới phải ≥ chỉ số cũ (' + fmtVnd(o) + ').', ['fNew']); return false; }
    if(ot && nt && n - o > C.MAX_KWH){ setFieldError('fIdxErr', 'Mức tiêu thụ tối đa 100.000 kWh — kiểm tra lại hai chỉ số.', ['fNew']); return false; }
    setFieldError('fIdxErr', null);
    return true;
  }
  function checkKwh(showEmpty){
    var t = $('fKwh').value.trim(), n = C.parseIntStrict(t);
    if(!t){
      if(showEmpty){ setFieldError('fKwhErr', 'Nhập số kWh đã dùng.'); return false; }
      return true;
    }
    if(isNaN(n)){ setFieldError('fKwhErr', MSG_KWH); return false; }
    if(n > C.MAX_KWH){ setFieldError('fKwhErr', 'Số kWh tối đa 100.000.'); return false; }
    setFieldError('fKwhErr', null);
    return true;
  }
  function checkAmount(showEmpty){
    var t = $('fAmount').value.trim(), n = C.parseIntStrict(t);
    if(!t && showEmpty){ setFieldError('fAmountErr', 'Nhập số tiền đã trả, ví dụ 990.000.'); return false; }
    if(t && isNaN(n)){ setFieldError('fAmountErr', MSG_AMOUNT); return false; }
    if(t && n > C.MAX_AMOUNT){ setFieldError('fAmountErr', 'Số tiền tối đa 1.000.000.000 đ.'); return false; }
    setFieldError('fAmountErr', null);
    return true;
  }
  function checkDates(){
    var from = $('fFrom').value, to = $('fTo').value, today = C.vnToday();
    if(from && !C.realDate(from)){ setFieldError('fDateErr', 'Từ ngày chưa đúng.', ['fFrom']); return false; }
    if(to && !C.realDate(to)){ setFieldError('fDateErr', 'Đến ngày chưa đúng.', ['fTo']); return false; }
    if(from && from > today){ setFieldError('fDateErr', 'Từ ngày không được sau hôm nay.', ['fFrom']); return false; }
    if(to && to > today){ setFieldError('fDateErr', 'Đến ngày không được sau hôm nay.', ['fTo']); return false; }
    if(from && to && from > to){ setFieldError('fDateErr', 'Đến ngày phải từ ngày bắt đầu trở đi.', ['fTo']); return false; }
    var period = $('fPeriod').value;
    if(C.validPeriod(period)){
      var off = to && !C.dateFitsPeriod(to, period) ? 'fTo' : from && !C.dateFitsPeriod(from, period, 4) ? 'fFrom' : null;
      if(off){ setFieldError('fDateErr', 'Ngày ghi chỉ số không khớp kỳ ' + monthName(period) + '.', [off]); return false; }
    }
    if(from && to && C.daysInclusive(from, to) > C.MAX_SPAN_DAYS){ setFieldError('fDateErr', 'Từ ngày và đến ngày cách nhau quá xa (tối đa ' + C.MAX_SPAN_DAYS + ' ngày).', ['fTo']); return false; }
    setFieldError('fDateErr', null);
    return true;
  }

  // Typing clears that field's error and refreshes the computed box; leaving a
  // field reports a malformed number right away (an empty field is not an
  // error until save). Nothing here rewrites a value the user typed, except
  // tidying a valid amount ("990000" → "990.000", same number).
  ['fOld', 'fNew'].forEach(function(id){
    $(id).addEventListener('input', function(){
      if(id === 'fOld'){ form.oldAuto = false; $('fOldHint').textContent = ''; }
      setFieldError('fIdxErr', null);
      updateCalc();
    });
    $(id).addEventListener('blur', function(){ if(sheetOpen('billSheet')) checkIndex(false); });
  });
  $('fKwh').addEventListener('input', function(){ form.kwhAuto = false; setFieldError('fKwhErr', null); updateCalc(); });
  $('fKwh').addEventListener('blur', function(){ if(sheetOpen('billSheet')) checkKwh(false); });
  $('fAmount').addEventListener('input', function(){
    // A kWh carried over from "Số tiền" belongs to the old amount.
    if(form.mode !== 'amount') form.kwhAuto = false;
    setFieldError('fAmountErr', null);
    updateCalc();
  });
  $('fAmount').addEventListener('blur', function(){
    if(!sheetOpen('billSheet')) return;
    if(checkAmount() && $('fAmount').value.trim()) $('fAmount').value = fmtVnd(C.parseIntStrict($('fAmount').value));
  });
  function onPeriodChange(){
    checkPeriod();
    if(($('fFrom').value || $('fTo').value) && !checkDates()) $('fMore').open = true;
    suggestOld();
    updateCalc();
  }
  $('fPeriod').addEventListener('change', onPeriodChange);
  $('fPeriod').addEventListener('input', onPeriodChange);
  ['fFrom', 'fTo'].forEach(function(id){
    $(id).addEventListener('change', function(){ checkDates(); updateCalc(); });
  });
  $('fPaste').addEventListener('input', function(){ setFieldError('fPasteErr', null); });

  $('fModeSeg').addEventListener('click', function(e){
    var b = e.target.closest('button[data-mode]');
    if(!b) return;
    var mode = b.getAttribute('data-mode');
    if(mode === form.mode) return;
    // Going to plain kWh: carry over what the current mode already knows —
    // the difference of the readings, or the kWh derived from the amount —
    // into an empty field only.
    if(mode === 'kwh' && (!$('fKwh').value.trim() || form.kwhAuto)){
      if(form.mode === 'index' && isFinite(formKwh())){ $('fKwh').value = String(formKwh()); form.kwhAuto = false; }
      else if(form.mode === 'amount'){
        var inf = inferNow();
        if(inf && inf.kwh != null){ $('fKwh').value = String(inf.kwh); form.kwhAuto = true; }
      }
    }
    if(mode !== 'paste') form.source = mode;
    setMode(mode);
    updateCalc();
  });
  function renderPlaceSeg(){
    var many = data.places.length > 1;
    $('fPlaceField').hidden = !many;
    $('fPlaceSeg').innerHTML = !many ? '' : data.places.map(function(p){
      var on = p.id === form.placeId;
      return '<button type="button" role="radio" data-place="' + esc(p.id) + '" aria-checked="' + on + '"' + (on ? ' class="active"' : '') + '>' + esc(p.name) + '</button>';
    }).join('');
  }
  $('fPlaceSeg').addEventListener('click', function(e){
    var b = e.target.closest('button[data-place]');
    if(!b) return;
    form.placeId = b.getAttribute('data-place');
    setSeg('fPlaceSeg', 'data-place', form.placeId);
    checkPeriod();
    suggestOld();
    updateCalc();
  });

  $('btnPasteFill').addEventListener('click', function(){
    setFieldError('fPasteErr', null);
    var r = C.parsePaste($('fPaste').value);
    var names = [];
    if(r.period) names.push('kỳ');
    if(r.fromDate) names.push('từ/đến ngày');
    if(r.oldIndex != null) names.push('chỉ số');
    if(r.kwh != null) names.push('số kWh');
    if(r.amount != null) names.push('số tiền');
    if(!names.length){
      setFieldError('fPasteErr', 'Không tìm thấy kỳ, chỉ số, số kWh hay số tiền trong nội dung này. Hãy nhập tay ở “Số tiền” hoặc “Số kWh”.');
      return;
    }
    clearBillErrors();
    if(r.period) $('fPeriod').value = r.period;
    if(r.fromDate){ $('fFrom').value = r.fromDate; $('fTo').value = r.toDate; $('fMore').open = true; }
    // A receipt with only the period and the money goes to "Số tiền".
    var mode = 'amount';
    if(r.oldIndex != null){
      $('fOld').value = String(r.oldIndex); $('fNew').value = String(r.newIndex);
      form.oldAuto = false; $('fOldHint').textContent = '';
      mode = 'index';
    }
    if(r.kwh != null){
      $('fKwh').value = String(r.kwh);
      form.kwhAuto = false;
      // Readings that don't add up to the stated kWh (meter multiplier,
      // replaced meter): trust the kWh figure.
      if(r.oldIndex == null || r.newIndex - r.oldIndex !== r.kwh) mode = 'kwh';
    }
    if(r.amount != null) $('fAmount').value = fmtVnd(r.amount);
    // The text itself is not kept anywhere.
    $('fPaste').value = '';
    form.source = mode === 'amount' ? 'amount' : 'paste';
    setMode(mode);
    var missing = [];
    if(!r.period) missing.push('kỳ');
    if(r.oldIndex == null && r.kwh == null && r.amount == null) missing.push('chỉ số hoặc số kWh');
    if(r.amount == null) missing.push('số tiền');
    $('fPasteMsg').textContent = 'Đã điền ' + names.join(', ') + '.' + (missing.length ? ' Chưa thấy ' + missing.join(', ') + '.' : '') + ' Soát lại các ô trước khi lưu.';
    $('fPasteMsg').hidden = false;
    checkPeriod();
    updateCalc();
  });

  function openBill(bill){
    if(broken) return;
    if(!bill && data.bills.length >= C.MAX_BILLS){ toast('Đã đủ ' + fmtVnd(C.MAX_BILLS) + ' hoá đơn — xoá bớt trước khi thêm.'); return; }
    clearBillErrors();
    var hasIdx = !!bill && bill.oldIndex != null && bill.newIndex != null;
    form = { editing: bill || null, mode: 'amount', source: bill ? bill.source : 'amount',
      placeId: bill ? bill.placeId : selectedPlace || data.places[0].id, oldAuto: false, kwhAuto: false };
    $('billSheetTitle').textContent = bill ? 'Sửa hoá đơn ' + monthName(bill.period) : 'Thêm hoá đơn';
    $('btnBillSave').textContent = bill ? 'Lưu thay đổi' : 'Lưu hoá đơn';
    $('btnBillDelete').hidden = !bill;
    renderPlaceSeg();
    $('fPeriod').max = C.vnMonth();
    $('fPeriod').value = bill ? bill.period : C.vnMonth();
    $('fFrom').max = $('fTo').max = C.vnToday();
    $('fOld').value = bill && bill.oldIndex != null ? String(bill.oldIndex) : '';
    $('fNew').value = bill && bill.newIndex != null ? String(bill.newIndex) : '';
    // Readings that don't add up to the stored kWh (meter multiplier, a
    // restored file): show the stored kWh, never recompute it from them.
    var byIndex = hasIdx && bill.newIndex - bill.oldIndex === bill.kwh;
    var byAmount = !!bill && (bill.source === 'amount' || bill.kwh == null);
    $('fKwh').value = bill && !byIndex && !byAmount ? String(bill.kwh) : '';
    $('fAmount').value = bill && bill.amount != null ? fmtVnd(bill.amount) : '';
    $('fFrom').value = bill && bill.fromDate ? bill.fromDate : '';
    $('fTo').value = bill && bill.toDate ? bill.toDate : '';
    $('fNote').value = bill ? bill.note : '';
    $('fPaste').value = '';
    $('fPasteMsg').hidden = true; $('fPasteMsg').textContent = '';
    $('fOldHint').textContent = '';
    $('fMore').open = !!bill;
    $('fCalc').innerHTML = '';
    setMode(!bill || byAmount ? 'amount' : byIndex ? 'index' : 'kwh');
    suggestOld();
    updateCalc();
    openSheet('billSheet', function(){ form.editing = null; });
  }
  $('btnAddBill').addEventListener('click', function(){ openBill(null); });
  $('btnAddFirst').addEventListener('click', function(){ openBill(null); });

  $('billForm').addEventListener('submit', function(e){
    e.preventDefault();
    // A successful save closes the sheet synchronously, so a second submit
    // right behind it (double tap, Enter + tap) stops here instead of
    // writing the bill twice.
    if(!sheetOpen('billSheet') || broken) return;
    clearBillErrors();
    var ok = true;
    var period = $('fPeriod').value;
    if(!period){ setFieldError('fPeriodErr', 'Chọn kỳ hoá đơn (tháng và năm).'); ok = false; }
    else if(!checkPeriod()) ok = false;

    var kwh = NaN, oldIndex = null, newIndex = null, source = form.source, inferred = false;
    if(form.mode === 'amount'){
      if(checkAmount(true)){
        var inf = inferNow();
        if(!inf) ok = false;   // the period is wrong; its own error is already showing
        else if(inf.wait){
          setFieldError('fAmountErr', 'Chưa tải được biểu giá nên chưa tính được số kWh — thử lại sau, hoặc chọn “Số kWh”.');
          ok = false;
        } else {
          kwh = inf.kwh; inferred = kwh != null && (!inf.kept || form.editing.kwhInferred === true); source = 'amount';
        }
      } else ok = false;
    } else if(form.mode === 'paste'){
      setFieldError('fPasteErr', $('fPaste').value.trim() ? 'Bấm “Điền từ thông báo” để điền vào các ô, soát lại rồi mới lưu.' :
        'Dán thông báo rồi bấm “Điền từ thông báo”, hoặc chọn cách nhập khác.');
      ok = false;
    } else if(form.mode === 'index'){
      if(checkIndex(true)){
        oldIndex = C.parseIntStrict($('fOld').value); newIndex = C.parseIntStrict($('fNew').value);
        kwh = newIndex - oldIndex;
      } else ok = false;
    } else {
      if(checkKwh(true)){
        kwh = C.parseIntStrict($('fKwh').value);
        // Saved from "Số kWh" with the kWh the record already had (or the
        // difference of its readings): the readings are still true, keep them.
        var e0 = form.editing;
        if(e0 && e0.oldIndex != null && e0.newIndex != null && (kwh === e0.kwh || kwh === e0.newIndex - e0.oldIndex)){
          oldIndex = e0.oldIndex; newIndex = e0.newIndex; source = e0.source;
        }
        // The kWh shown was carried over from "Số tiền" and never retyped:
        // it is still a derived figure.
        if(form.kwhAuto && $('fAmount').value.trim()){ source = 'amount'; inferred = true; }
      } else ok = false;
    }
    if(form.mode !== 'amount' && !checkAmount()) ok = false;
    if(!checkDates()){ ok = false; $('fMore').open = true; }
    if(!ok) return;
    var stale = readRaw() !== loadedRaw;
    if(stale) reloadData();
    var gone = staleEdit();
    if(stale || gone){ setFieldError('billError', gone || STALE_MSG); return; }

    var amountTxt = $('fAmount').value.trim();
    var now = Date.now(), ed = form.editing;
    var bill = {
      id: ed ? ed.id : newId('b'), placeId: form.placeId, period: period,
      fromDate: $('fFrom').value || null, toDate: $('fTo').value || null,
      oldIndex: oldIndex, newIndex: newIndex, kwh: kwh,
      amount: amountTxt ? C.parseIntStrict(amountTxt) : null,
      source: source, note: clip($('fNote').value.trim(), C.MAX_NOTE),
      createdAt: ed ? ed.createdAt : now, updatedAt: now
    };
    if(inferred) bill.kwhInferred = true;
    var next = cloneData();
    next.bills = next.bills.filter(function(b){ return !ed || b.id !== ed.id; }).concat(bill);
    var err = C.validateDataset(next) || persist(next);
    if(err){ setFieldError('billError', err); return; }
    selectedPlace = bill.placeId;
    chartSel = null;
    // No focus back on "Thêm hoá đơn": a second Enter would open a new form.
    closeSheet('billSheet', true);
    toast(ed ? 'Đã lưu thay đổi' : 'Đã thêm hoá đơn ' + monthName(period));
    if(!ed) askPersist();
    renderAll();
  });

  // The bill being edited was deleted or changed in another window after this
  // form opened: say so once, and let a second "Lưu" go through knowingly.
  function staleEdit(){
    var ed = form.editing;
    if(!ed) return null;
    var cur = data.bills.filter(function(b){ return b.id === ed.id; })[0];
    if(!cur){
      form.editing = null;
      $('billSheetTitle').textContent = 'Thêm hoá đơn';
      $('btnBillSave').textContent = 'Lưu hoá đơn';
      $('btnBillDelete').hidden = true;
      return 'Hoá đơn này vừa bị xoá ở cửa sổ khác. Bấm Lưu lần nữa nếu vẫn muốn lưu nội dung đang nhập.';
    }
    if(cur.updatedAt !== ed.updatedAt){
      form.editing = cur;
      return 'Hoá đơn này vừa được sửa ở cửa sổ khác. Bấm Lưu lần nữa để ghi đè bằng nội dung đang nhập.';
    }
    return null;
  }
  $('btnBillDelete').addEventListener('click', function(){
    var ed = form.editing;
    if(!ed) return;
    var v = billView(ed);
    confirmDialog({
      title: 'Xoá hoá đơn ' + monthName(ed.period) + '?',
      text: [ed.kwh != null ? fmtVnd(ed.kwh) + ' kWh' : '', v.money != null ? fmtVnd(v.money) + ' đ' : ''].filter(Boolean).join(' · ') + '.',
      ok: 'Xoá hoá đơn', danger: true,
      onOk: function(){
        var next = cloneData();
        next.bills = next.bills.filter(function(b){ return b.id !== ed.id; });
        var err = persist(next);
        if(err){ showError('confirmError', err); return; }
        closeSheet('confirmSheet');
        closeSheet('billSheet');
        chartSel = null;
        renderAll();
        toast('Đã xoá hoá đơn ' + monthName(ed.period), { label: 'Hoàn tác', run: function(){ undoDelete(ed); } });
      }
    });
  });
  function undoDelete(bill){
    if(broken) return;
    if(!placeById(bill.placeId)){ toast('Không hoàn tác được: nơi dùng điện đã bị xoá.'); return; }
    if(data.bills.some(function(b){ return b.id === bill.id; }) || billAt(bill.placeId, bill.period)){
      toast('Không hoàn tác được: ' + monthName(bill.period) + ' đã có hoá đơn khác.');
      return;
    }
    var next = cloneData();
    next.bills.push(JSON.parse(JSON.stringify(bill)));
    var err = C.validateDataset(next) || persist(next);
    if(err){ toast(err); return; }
    chartSel = null;
    renderAll();
    toast('Đã khôi phục hoá đơn ' + monthName(bill.period));
  }

  // ---------- Giá điện ----------
  function retryHtml(msg){
    return '<div class="state-msg"><p>' + msg + '</p><button type="button" class="btn btn-soft" data-retry>Thử lại</button></div>';
  }
  var TABLE_SKELETON = '<div class="skeleton-row skeleton-th"></div>' + new Array(7).join('<div class="skeleton-row skeleton-tr"></div>');
  function tierRange(tiers, i){
    var lo = i ? tiers[i - 1].upTo + 1 : 0;
    return tiers[i].upTo == null ? 'từ ' + fmtVnd(lo) : fmtVnd(lo) + '–' + fmtVnd(tiers[i].upTo);
  }
  function renderTariff(){
    var tbl = $('tariffTable');
    var failed = !tariffDoc && tariffState === 'error';
    $('calcCard').hidden = failed;
    $('tariffHistCard').hidden = failed;
    $('calcBody').hidden = !tariffDoc;
    $('calcSkeleton').hidden = !!tariffDoc;
    // While loading, the meta line is a skeleton block of its own so the
    // table skeleton is exactly as tall as the table.
    var meta = $('tariffMeta');
    meta.hidden = failed;
    meta.className = tariffDoc ? 'card-hint' : 'skeleton-row skeleton-meta';
    if(!tariffDoc) meta.textContent = '';
    $('tariffNotice').hidden = true;
    if(!tariffDoc){
      if(failed) tbl.innerHTML = retryHtml('Chưa tải được biểu giá điện. Kiểm tra mạng rồi thử lại.');
      else {
        tbl.innerHTML = TABLE_SKELETON;
        $('tariffHist').innerHTML = new Array(5).join('<div class="skeleton-row skeleton-hist"></div>');
      }
      return;
    }
    var today = C.vnToday();
    var t = C.tariffOn(tariffDoc, today), v = C.vatOn(tariffDoc, today);
    if(!t || !v){
      tbl.innerHTML = '<p class="state-msg">Chưa có biểu giá cho hôm nay.</p>';
      $('tariffMeta').hidden = true;
    } else {
      var vatTxt = fmtDec(v.pct, 0) + '%';
      tbl.innerHTML = '<table class="tariff-table"><thead><tr><th scope="col">Bậc (kWh)</th><th scope="col">Chưa VAT</th><th scope="col">Đã VAT ' + vatTxt + '</th></tr></thead><tbody>' +
        t.tiers.map(function(x, i){
          return '<tr><td>Bậc ' + (i + 1) + ' <small>' + tierRange(t.tiers, i) + '</small></td><td class="pre">' + fmtVnd(x.price) + '</td><td>' + fmtVnd(Math.round(x.price * (100 + v.pct) / 100)) + '</td></tr>';
        }).join('') + '</tbody></table>';
      $('tariffMeta').textContent = 'Áp dụng từ ' + fmtDate(t.effectiveFrom) + ' · QĐ ' + t.decision + ' · VAT ' + vatTxt +
        (v.provisional ? ' (theo quy định hiện hành)' : '') + ' · đối chiếu ' + fmtDate(tariffDoc.checkedAt);
      $('calcVatLabel').textContent = 'VAT ' + vatTxt;
      if(tariffDoc.notice){
        $('tariffNotice').textContent = tariffDoc.notice + ' App vẫn tính theo ' + t.tiers.length + ' bậc ở bảng trên.';
        $('tariffNotice').hidden = false;
      }
    }
    var list = tariffDoc.tariffs.slice().sort(function(a, b){ return a.effectiveFrom < b.effectiveFrom ? 1 : -1; });
    $('tariffHist').innerHTML = list.map(function(x){
      return '<div class="hist-entry"><p class="hist-date">' + fmtDate(x.effectiveFrom) + '<span>QĐ ' + esc(x.decision) + (x === t ? ' · đang áp dụng' : '') + '</span></p>' +
        '<p class="hist-prices">' + x.tiers.map(function(y){ return fmtVnd(y.price); }).join(' · ') + '</p></div>';
    }).join('') +
      '<div class="hist-entry"><p class="hist-date">Thuế VAT</p><p class="hist-prices">' +
      tariffDoc.vat.slice().sort(function(a, b){ return a.effectiveFrom < b.effectiveFrom ? 1 : -1; }).map(function(x){
        return fmtDec(x.pct, 0) + '% từ ' + fmtDate(x.effectiveFrom) + (x.provisional ? ' (theo quy định hiện hành)' : '');
      }).join(' · ') + '</p></div>';
    renderCalc(false);
  }
  $('tariffTable').addEventListener('click', function(e){
    if(e.target.closest('[data-retry]')) loadAll();
  });
  function renderCalc(showError){
    var txt = $('calcKwh').value.trim(), n = C.parseIntStrict(txt);
    var bad = txt && isNaN(n) ? MSG_KWH : txt && n > C.MAX_KWH ? 'Số kWh tối đa 100.000.' : null;
    if(showError || !bad) setFieldError('calcErr', bad);
    var calc = !txt || bad || !tariffDoc ? null : C.calcBill({ kwh: n, period: C.vnMonth(), fromDate: null, toDate: C.vnToday() }, tariffDoc);
    $('calcResult').hidden = !calc || calc.noTariff;
    if(!calc || calc.noTariff) return;
    $('calcLines').innerHTML = linesHtml(calc);
    $('calcSubtotal').textContent = fmtVnd(calc.subtotal) + ' đ';
    $('calcVat').textContent = fmtVnd(calc.vat) + ' đ';
    $('calcTotal').textContent = fmtVnd(calc.total) + ' đ';
  }
  $('calcKwh').addEventListener('input', function(){ renderCalc(false); });
  $('calcKwh').addEventListener('blur', function(){ renderCalc(true); });

  // ---------- Cài đặt: nơi dùng điện ----------
  var placeEditing = null;
  function renderPlaces(){
    var counts = Object.create(null);
    data.bills.forEach(function(b){ counts[b.placeId] = (counts[b.placeId] || 0) + 1; });
    $('placeList').innerHTML = data.places.map(function(p){
      var n = counts[p.id] || 0;
      return '<button type="button" class="row-link" data-place="' + esc(p.id) + '"' + (broken ? ' disabled' : '') + '>' +
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>' +
        '<span class="row-link-text">' + esc(p.name) + '<span class="row-link-meta">' + (n ? n + ' hoá đơn' : 'Chưa có hoá đơn') + (p.customerCode ? ' · mã ' + esc(p.customerCode) : '') + '</span></span>' +
        '<svg class="icon chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>';
    }).join('');
    var full = data.places.length >= C.MAX_PLACES;
    $('btnAddPlace').hidden = full;
    $('btnAddPlace').disabled = broken;
    $('placeHint').textContent = full ? 'Tối đa ' + C.MAX_PLACES + ' nơi. Chạm một nơi để đổi tên.' : 'Chạm một nơi để đổi tên hoặc ghi mã khách hàng.';
  }
  function openPlace(p){
    if(broken) return;
    placeEditing = p || null;
    $('placeSheetTitle').textContent = p ? 'Sửa nơi dùng điện' : 'Thêm nơi';
    $('btnPlaceSave').textContent = p ? 'Lưu thay đổi' : 'Thêm nơi';
    $('pName').value = p ? p.name : '';
    $('pCode').value = p ? p.customerCode : '';
    setFieldError('pNameErr', null);
    showError('placeError', null);
    var n = p ? data.bills.filter(function(b){ return b.placeId === p.id; }).length : 0;
    // Only an unused place can go — deleting one with bills would orphan them.
    $('btnPlaceDelete').hidden = !p || n > 0 || data.places.length < 2;
    $('placeDeleteHint').hidden = !p || (n === 0 && data.places.length > 1);
    $('placeDeleteHint').textContent = !p ? '' : n > 0 ? 'Nơi này đang có ' + n + ' hoá đơn nên chưa xoá được — xoá hết hoá đơn của nó trước.' : 'Cần giữ ít nhất một nơi.';
    openSheet('placeSheet', function(){ placeEditing = null; });
  }
  $('placeList').addEventListener('click', function(e){
    var b = e.target.closest('button[data-place]');
    if(b) openPlace(placeById(b.getAttribute('data-place')));
  });
  $('btnAddPlace').addEventListener('click', function(){ openPlace(null); });
  $('pName').addEventListener('input', function(){ setFieldError('pNameErr', null); });
  $('placeForm').addEventListener('submit', function(e){
    e.preventDefault();
    if(!sheetOpen('placeSheet') || broken) return;
    var name = clip($('pName').value.trim(), C.MAX_NAME), code = clip($('pCode').value.trim(), C.MAX_CODE);
    if(!name){ setFieldError('pNameErr', 'Nhập tên nơi dùng điện, ví dụ Nhà.'); return; }
    var ed = placeEditing;
    if(readRaw() !== loadedRaw){ reloadData(); showError('placeError', STALE_MSG); return; }
    if(ed && !placeById(ed.id)){ showError('placeError', 'Nơi này vừa bị xoá ở cửa sổ khác.'); return; }
    if(data.places.some(function(p){ return p.name.toLowerCase() === name.toLowerCase() && (!ed || p.id !== ed.id); })){
      setFieldError('pNameErr', 'Đã có nơi tên “' + name + '” — đặt tên khác để khỏi nhầm.');
      return;
    }
    var next = cloneData();
    if(ed) next.places.forEach(function(p){ if(p.id === ed.id){ p.name = name; p.customerCode = code; } });
    else {
      if(next.places.length >= C.MAX_PLACES){ showError('placeError', 'Tối đa ' + C.MAX_PLACES + ' nơi.'); return; }
      next.places.push({ id: newId('p'), name: name, customerCode: code });
    }
    var err = C.validateDataset(next) || persist(next);
    if(err){ showError('placeError', err); return; }
    closeSheet('placeSheet', true);
    toast(ed ? 'Đã lưu thay đổi' : 'Đã thêm ' + name);
    renderAll();
  });
  $('btnPlaceDelete').addEventListener('click', function(){
    var ed = placeEditing;
    if(!ed) return;
    confirmDialog({
      title: 'Xoá nơi “' + ed.name + '”?',
      text: 'Nơi này chưa có hoá đơn nào.',
      ok: 'Xoá nơi này', danger: true,
      onOk: function(){
        if(data.bills.some(function(b){ return b.placeId === ed.id; }) || data.places.length < 2){ showError('confirmError', 'Nơi này vừa có hoá đơn nên chưa xoá được.'); return; }
        var next = cloneData();
        next.places = next.places.filter(function(p){ return p.id !== ed.id; });
        var err = C.validateDataset(next) || persist(next);
        if(err){ showError('confirmError', err); return; }
        if(selectedPlace === ed.id) selectedPlace = null;
        closeSheet('confirmSheet');
        closeSheet('placeSheet');
        toast('Đã xoá ' + ed.name);
        renderAll();
      }
    });
  });

  // ---------- Cài đặt: sao lưu / khôi phục ----------
  function showError(id, msg){
    $(id).textContent = msg || '';
    $(id).hidden = !msg;
  }
  function backupFile(){
    var doc = { app: 'power-track', kind: 'power-log', version: 1, exportedAt: new Date().toISOString(), places: data.places, bills: data.bills };
    return new File([JSON.stringify(doc, null, 1)], 'power-track-' + C.vnToday() + '.json', { type: 'application/json' });
  }
  function brokenFile(){
    return new File([brokenRaw || ''], 'power-track-loi-' + C.vnToday() + '.json', { type: 'application/json' });
  }
  function lastBackup(){
    try{
      var s = localStorage.getItem(BACKUP_KEY);
      return s && isFinite(Date.parse(s)) ? s : null;
    }catch(e){ return null; }
  }
  function renderBackup(){
    var el = $('backupLast'), last = lastBackup(), has = !C.isDefaultData(data), warn = false, txt;
    if(broken){
      txt = 'Dữ liệu đang lỗi — lưu bản lỗi ra file ở đầu trang trước khi khôi phục.';
    } else if(!last){
      txt = has ? 'Chưa sao lưu lần nào.' : 'Chưa có gì để sao lưu.';
      warn = has;
    } else {
      var day = C.vnToday(Date.parse(last));
      var days = Math.round((C.dayToMs(C.vnToday()) - C.dayToMs(day)) / DAY_MS);
      txt = 'Sao lưu lần cuối: ' + (days <= 0 ? 'hôm nay' : days === 1 ? 'hôm qua' : fmtDate(day) + ' (' + days + ' ngày trước)');
      warn = has && days >= 30;
    }
    el.textContent = txt;
    el.classList.toggle('warn-text', warn);
    $('btnBackup').disabled = broken || !has;
  }
  function markBackedUp(){
    try{ localStorage.setItem(BACKUP_KEY, new Date().toISOString()); }catch(e){}
    renderBackup();
  }
  // Must run synchronously inside the tap: Safari drops the user activation
  // after an await and navigator.share() then throws NotAllowedError.
  // done(ok, errMsg): ok=false + errMsg=null means the user cancelled.
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
    var url = URL.createObjectURL(file);
    var a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking right away can abort the download on iOS Safari.
    setTimeout(function(){ URL.revokeObjectURL(url); }, 10000);
    done(true);
  }
  $('btnBackup').addEventListener('click', function(){
    if(broken || C.isDefaultData(data)) return;
    showError('backupError', null);
    saveFile(backupFile(), function(ok, err){
      if(ok){ markBackedUp(); toast('Đã lưu file sao lưu'); }
      else if(err) showError('backupError', err);
    });
  });
  $('btnBrokenSave').addEventListener('click', function(){
    if(!broken) return;
    showError('brokenError', null);
    saveFile(brokenFile(), function(ok, err){
      if(ok) toast('Đã lưu bản lỗi ra file');
      else if(err) showError('brokenError', err);
    });
  });
  var restoreErrorId = 'backupError';
  function pickRestore(errorId){
    restoreErrorId = errorId;
    showError('backupError', null); showError('brokenError', null);
    $('restoreFile').value = '';
    $('restoreFile').click();
  }
  $('btnRestore').addEventListener('click', function(){ pickRestore('backupError'); });
  $('btnBrokenRestore').addEventListener('click', function(){ pickRestore('brokenError'); });
  $('btnEmptyRestore').addEventListener('click', function(){ switchTab('settings'); pickRestore('backupError'); });

  function applyBackup(next){
    var err = persist(next);
    if(err){ showError('confirmError', err); return false; }
    selectedPlace = null;
    chartSel = null;
    closeSheet('confirmSheet');
    askPersist();
    renderAll();
    toast('Đã khôi phục ' + next.bills.length + ' hoá đơn');
    return true;
  }
  $('restoreFile').addEventListener('change', function(){
    var file = this.files && this.files[0];
    if(!file) return;
    var errId = restoreErrorId;
    if(file.size > 5 * 1024 * 1024){ showError(errId, 'File quá lớn (tối đa 5 MB).'); return; }
    file.text().then(function(text){
      var r = C.parseBackup(text, tariffDoc, Date.now());
      if(r.error){ showError(errId, r.error); return; }
      var info = 'File có ' + r.data.bills.length + ' hoá đơn, ' + r.data.places.length + ' nơi' +
        (r.exportedAt && isFinite(Date.parse(r.exportedAt)) ? ', lưu ngày ' + fmtDate(C.vnToday(Date.parse(r.exportedAt))) : '') + '.';
      // A renamed or added place with no bills is data too.
      if(!broken && C.isDefaultData(data)){
        confirmDialog({ title: 'Khôi phục từ file này?', text: info, ok: 'Khôi phục', onOk: function(){ applyBackup(r.data); } });
        return;
      }
      var curTxt = broken ? 'Dữ liệu hiện tại (đang lỗi)' : 'Dữ liệu hiện tại (' + data.bills.length + ' hoá đơn, ' + data.places.length + ' nơi)';
      confirmDialog({
        title: 'Thay toàn bộ dữ liệu?',
        text: info + ' ' + curTxt + ' sẽ bị thay — app lưu nó ra file trước.',
        ok: 'Lưu bản hiện tại rồi khôi phục',
        onOk: function(){
          showError('confirmError', null);
          saveFile(broken ? brokenFile() : backupFile(), function(ok, err){
            if(ok){ if(!broken) markBackedUp(); applyBackup(r.data); }
            else if(err) showError('confirmError', err);
            else showError('confirmError', 'Chưa lưu bản hiện tại nên chưa khôi phục.');
          });
        }
      });
    }, function(){ showError(errId, 'Không đọc được file.'); });
  });

  // ---------- Lịch sử cập nhật ----------
  function renderVersion(){
    $('versionLabel').textContent = changelog ? '· v' + changelog.version : '';
  }
  $('btnVersion').addEventListener('click', function(){
    $('versionContent').innerHTML = !changelog ? '<p class="state-msg">Chưa tải được lịch sử cập nhật.</p>' : changelog.entries.map(function(entry){
      return '<div class="version-entry">' +
        '<div class="version-entry-head"><span class="version-num">v' + esc(entry.version) + '</span><span class="version-date">' + esc(fmtDate(entry.date)) + '</span></div>' +
        '<ul class="version-changes">' + (entry.changes || []).map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '</div>';
    }).join('');
    openSheet('versionSheet');
  });

  // ---------- Sheets ----------
  // sheet id → backdrop id. Closed layers are `hidden`; see the CSS note.
  var SHEETS = { placePickSheet: 'placePickBackdrop', billSheet: 'billBackdrop', placeSheet: 'placeBackdrop', versionSheet: 'versionBackdrop', confirmSheet: 'confirmBackdrop' };
  var sheetHooks = {};
  var sheetStack = [];
  // Element that had focus when each sheet opened — per sheet, because the
  // confirm sheet opens on top of the bill form.
  var sheetOpener = {};
  var backdropArmed = {}, backdropTimers = {};
  function focusQuiet(el){
    try{ el.focus({ preventScroll: true }); }catch(e){}
  }
  function showLayer(el){
    clearTimeout(el.hideTimer);
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('open');
  }
  // A timer rather than transitionend: reduced motion switches the transition off.
  function hideLayer(el){
    el.classList.remove('open');
    clearTimeout(el.hideTimer);
    el.hideTimer = setTimeout(function(){
      if(!el.classList.contains('open')) el.hidden = true;
    }, 260);
  }
  function openSheet(id, onClose){
    var sheet = $(id);
    sheetHooks[id] = onClose || null;
    if(!sheet.classList.contains('open')) sheetOpener[id] = document.activeElement;
    // An old toast would sit on top of the sheet's buttons.
    hideToast();
    showLayer($(SHEETS[id]));
    showLayer(sheet);
    var body = sheet.querySelector('.sheet-body');
    if(body) body.scrollTop = 0;
    // A double tap on the button that opened this sheet lands its second tap
    // on the backdrop; ignore the backdrop for a moment. A timer, not a
    // timestamp: tests freeze Date.now().
    backdropArmed[id] = false;
    clearTimeout(backdropTimers[id]);
    backdropTimers[id] = setTimeout(function(){ backdropArmed[id] = true; }, 400);
    sheetStack = sheetStack.filter(function(s){ return s !== id; }).concat(id);
    // The close button, never an input: focusing one would pop the keyboard.
    var first = id === 'confirmSheet' ? $('confirmCancel') : sheet.querySelector('.sheet-head .icon-btn');
    if(first) focusQuiet(first);
  }
  // stay: leave focus nowhere instead of handing it back to the opener.
  function closeSheet(id, stay){
    var sheet = $(id);
    if(!sheet.classList.contains('open')) return;
    hideLayer(sheet);
    hideLayer($(SHEETS[id]));
    sheetStack = sheetStack.filter(function(s){ return s !== id; });
    var active = document.activeElement;
    var inside = !!active && sheet.contains(active);
    if(inside) active.blur();
    var opener = sheetOpener[id];
    sheetOpener[id] = null;
    // Focus goes back only when it would otherwise be lost, never into a
    // closed sheet, and never to a text field (that would reopen the keyboard).
    var lost = inside || !active || active === document.body;
    if(!stay && lost && opener && opener.closest && document.contains(opener) &&
       !opener.closest('.sheet:not(.open)') && !/^(INPUT|TEXTAREA|SELECT)$/.test(opener.tagName)) focusQuiet(opener);
    var hook = sheetHooks[id];
    sheetHooks[id] = null;
    if(hook) hook();
  }
  Object.keys(SHEETS).forEach(function(id){
    $(SHEETS[id]).addEventListener('click', function(){ if(backdropArmed[id]) closeSheet(id); });
    var sheet = $(id);
    var closeBtn = sheet.querySelector('[data-close]');
    if(closeBtn) closeBtn.addEventListener('click', function(){ closeSheet(id); });
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
    if(!sheetStack.length) return;
    var top = $(sheetStack[sheetStack.length - 1]);
    // closeSheet blurs the field inside, so Enter after Escape cannot submit.
    if(e.key === 'Escape'){ closeSheet(top.id); return; }
    if(e.key !== 'Tab') return;
    // Tab stays inside the top layer.
    var items = Array.prototype.filter.call(top.querySelectorAll('button,input,textarea,summary,[tabindex]'), function(el){
      return !el.disabled && el.getClientRects().length > 0;
    });
    if(!items.length) return;
    var first = items[0], last = items[items.length - 1], active = document.activeElement;
    if(!top.contains(active)){ e.preventDefault(); focusQuiet(first); }
    else if(e.shiftKey && active === first){ e.preventDefault(); focusQuiet(last); }
    else if(!e.shiftKey && active === last){ e.preventDefault(); focusQuiet(first); }
  });

  var confirmState = null;
  function confirmDialog(opts){
    confirmState = opts;
    $('confirmTitle').textContent = opts.title;
    $('confirmText').textContent = opts.text || '';
    $('confirmOk').textContent = opts.ok;
    $('confirmOk').classList.toggle('btn-danger', !!opts.danger);
    $('confirmOk').classList.toggle('btn-primary', !opts.danger);
    showError('confirmError', null);
    openSheet('confirmSheet', function(){ confirmState = null; });
  }
  $('confirmOk').addEventListener('click', function(){ if(confirmState) confirmState.onOk(); });
  $('confirmCancel').addEventListener('click', function(){ closeSheet('confirmSheet'); });

  // iOS: 100dvh/svh can stay stale after the keyboard closes; visualViewport
  // resize is reliable, so sheets size themselves from it (ios-pwa §3).
  function syncViewport(){
    if(window.visualViewport) document.documentElement.style.setProperty('--vv-height', Math.round(window.visualViewport.height) + 'px');
  }
  syncViewport();
  if(window.visualViewport) window.visualViewport.addEventListener('resize', syncViewport);

  // ---------- Toast ----------
  var toastTimer = null, toastRun = null;
  function hideToast(){
    var t = $('toast');
    t.classList.remove('show');
    toastRun = null;
    clearTimeout(toastTimer);
    // Clear the role=status text once hidden so screen readers can't land on a stale message.
    toastTimer = setTimeout(function(){
      if(!t.classList.contains('show')){ $('toastMsg').textContent = ''; $('toastAction').hidden = true; }
    }, 300);
  }
  // action: { label, run } → a tappable button, kept up longer.
  function toast(msg, action){
    var t = $('toast');
    clearTimeout(toastTimer);
    $('toastMsg').textContent = msg;
    toastRun = action ? action.run : null;
    $('toastAction').hidden = !action;
    $('toastAction').textContent = action ? action.label : '';
    void t.offsetWidth;
    t.classList.add('show');
    toastTimer = setTimeout(hideToast, action ? 7000 : 2800);
  }
  $('toastAction').addEventListener('click', function(){
    var run = toastRun;
    hideToast();
    if(run) run();
  });

  // ---------- Tabs ----------
  var TAB_VIEWS = { overview: 'viewOverview', bills: 'viewBills', tariff: 'viewTariff', settings: 'viewSettings' };
  function switchTab(tab){
    if(!TAB_VIEWS[tab]) return;
    Object.keys(TAB_VIEWS).forEach(function(key){ $(TAB_VIEWS[key]).hidden = key !== tab; });
    Array.prototype.forEach.call(document.querySelectorAll('.tabbar-btn'), function(btn){
      var active = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('active', active);
      if(active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if(tab === 'settings') renderDiag();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tabbar-btn'), function(btn){
    btn.addEventListener('click', function(){ switchTab(btn.getAttribute('data-tab')); });
  });

  function isStandalone(){
    return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  }
  function renderDiag(){
    var probe = getComputedStyle($('safeProbe'));
    var bar = $('tabbar').getBoundingClientRect();
    // Fixed layers with a background touching the top edge may tint the iOS
    // status-bar strip; this should read 0 while nothing is open.
    var topFixed = Array.prototype.filter.call(document.querySelectorAll('body *'), function(el){
      var cs = getComputedStyle(el);
      return cs.position === 'fixed' && cs.display !== 'none' && el.getBoundingClientRect().top <= 0 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    }).length;
    $('diagLine').textContent = [
      'standalone ' + (isStandalone() ? 'có' : 'không'),
      'màn hình ' + screen.width + '×' + screen.height + ' / viewport ' + window.innerWidth + '×' + window.innerHeight,
      'safe-area ' + parseFloat(probe.paddingTop) + '/' + parseFloat(probe.paddingBottom),
      'tabbar đáy ' + Math.round(bar.bottom),
      'lớp phủ chạm mép trên ' + topFixed,
      'offline ' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'sẵn sàng' : 'chưa'),
      'hôm nay (giờ VN) ' + fmtDate(C.vnToday())
    ].join(' · ');
  }

  // ---------- Wiring ----------
  // Never touches an open form: only cards, lists and the header.
  function renderAll(){
    renderHeader();
    renderOverview();
    renderBills();
    renderTariff();
    renderPlaces();
    renderBackup();
    renderVersion();
    if(!$('viewSettings').hidden) renderDiag();
  }
  function inputSheetOpen(){
    return sheetStack.some(function(id){ return id === 'billSheet' || id === 'placeSheet' || id === 'confirmSheet'; });
  }
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState !== 'visible') return;
    // Another window may have saved meanwhile. With a form open the stored
    // copy is left alone here — the next save notices and refuses (persist).
    if(!inputSheetOpen() && readRaw() !== loadedRaw) reloadData();
    else renderAll();
    loadAll();
  });
  // Another window of the app changed the data. An open form is never closed
  // under the user's fingers: the data behind it is reloaded, the typed text
  // stays, and saving re-checks the record being edited (staleEdit).
  window.addEventListener('storage', function(e){
    if(e.key === BACKUP_KEY){ renderBackup(); return; }
    if(e.key !== KEY && e.key !== null) return;
    if(readRaw() === loadedRaw) return;
    reloadData();
    toast('Dữ liệu vừa được cập nhật ở cửa sổ khác');
  });

  load();
  renderAll();
  loadAll();

  // Offline: the shell lives in products/power-track/ (scope). Absolute path —
  // a relative one would resolve against html/, not the shell's folder.
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/products/power-track/sw-power-track.js').catch(function(){});
    });
  }
})();
