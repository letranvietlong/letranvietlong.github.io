// Sổ xăng: fill-ups logged on this device (localStorage), monthly spend,
// full-to-full consumption, paid vs list price, file backup/restore.
// Loaded after fuel-track.js, which exposes the price helpers it needs.
(function(){
  'use strict';

  var S = window.FuelTrackShared;
  if(!S) return;

  var KEY = 'fueltrack_log_v1';
  var BACKUP_KEY = 'fueltrack_log_last_backup_v1';
  var DAY_MS = 86400000;
  var FILL_PAGE = 20;
  var MAX_FILLS = 20000;
  var ID_RE = /^[\w-]+$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function $(id){ return document.getElementById(id); }
  var esc = S.escapeHtml, fmtVnd = S.fmtVnd;

  // ---------- Format / parse (vi-VN: dot thousands, comma decimals) ----------
  function fmtDec(n, digits){ return n.toFixed(digits).replace('.', ','); }
  // 3 decimals stored; show at least 2 ("4,00", "3,456").
  function fmtLiters(n){
    var s = (Math.round(n * 1000) / 1000).toFixed(3);
    if(s.slice(-1) === '0') s = s.slice(0, -1);
    return s.replace('.', ',');
  }
  function fmtDM(day){ return day.slice(8, 10) + '/' + day.slice(5, 7); }
  function monthLabel(ym){ return 'T' + (+ym.slice(5, 7)) + '/' + ym.slice(0, 4); }
  function parseLiters(str){
    var s = String(str || '').replace(/\s/g, '').replace(',', '.');
    if(!/^\d+(\.\d+)?$/.test(s) && !/^\.\d+$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 1000) / 1000;
  }
  function parseInteger(str){
    var s = String(str || '').replace(/[.\s]/g, '');
    if(!/^\d+$/.test(s) || s.length > 12) return NaN;
    return parseInt(s, 10);
  }
  function realDate(s){
    if(typeof s !== 'string' || !DATE_RE.test(s)) return false;
    var p = s.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  }
  function isInt(n){ return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function newId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- Data ----------
  function emptyData(){ return { version: 1, vehicles: [{ id: 'v1', name: 'Xe của tôi' }], fills: [] }; }
  var data = emptyData();
  var broken = false;     // stored log unreadable → never overwrite it implicitly
  var brokenRaw = null;
  var selectedVehicle = null;
  var fillsShown = FILL_PAGE;

  // Returns a Vietnamese error message, or null when the dataset is valid.
  function validateDataset(d){
    if(!d || typeof d !== 'object' || Array.isArray(d)) return 'File không đúng định dạng sổ xăng FuelTrack.';
    if(d.version !== 1){
      return typeof d.version === 'number' && d.version > 1 ?
        'File được tạo bởi phiên bản mới hơn (định dạng ' + d.version + '). Hãy cập nhật app rồi thử lại.' :
        'Định dạng file không hợp lệ.';
    }
    if(!Array.isArray(d.vehicles) || !d.vehicles.length || d.vehicles.length > 50) return 'Danh sách xe trong file không hợp lệ.';
    var vids = {};
    for(var i = 0; i < d.vehicles.length; i++){
      var v = d.vehicles[i];
      if(!v || typeof v.id !== 'string' || !ID_RE.test(v.id) || v.id.length > 40 || vids[v.id] ||
         typeof v.name !== 'string' || !v.name.trim() || v.name.length > 40) return 'Danh sách xe trong file không hợp lệ.';
      vids[v.id] = true;
    }
    if(!Array.isArray(d.fills) || d.fills.length > MAX_FILLS) return 'Danh sách lần đổ trong file không hợp lệ.';
    var fids = {};
    for(var j = 0; j < d.fills.length; j++){
      var f = d.fills[j], n = 'Lần đổ thứ ' + (j + 1) + ': ';
      if(!f || typeof f !== 'object') return n + 'không hợp lệ.';
      if(typeof f.id !== 'string' || !ID_RE.test(f.id) || f.id.length > 40 || fids[f.id]) return n + 'mã không hợp lệ hoặc bị trùng.';
      fids[f.id] = true;
      if(!realDate(f.date)) return n + 'ngày không hợp lệ.';
      if(!vids[f.vehicleId]) return n + 'xe không có trong danh sách xe.';
      if(typeof f.fuelId !== 'string' || !ID_RE.test(f.fuelId) || f.fuelId.length > 40) return n + 'loại nhiên liệu không hợp lệ.';
      if(typeof f.fuelLabel !== 'string' || f.fuelLabel.length > 60) return n + 'tên nhiên liệu không hợp lệ.';
      if(typeof f.liters !== 'number' || !isFinite(f.liters) || f.liters <= 0 || f.liters > 1000) return n + 'số lít phải lớn hơn 0 và tối đa 1.000.';
      if(!isInt(f.amount) || f.amount < 0 || f.amount > 1e9) return n + 'số tiền không hợp lệ.';
      if(!isInt(f.price) || f.price <= 0 || f.price > 1e6) return n + 'giá/lít không hợp lệ.';
      if(f.priceSource !== 'list' && f.priceSource !== 'user') return n + 'nguồn giá không hợp lệ.';
      if(f.odo !== null && (!isInt(f.odo) || f.odo < 0 || f.odo > 9999999)) return n + 'số km không hợp lệ.';
      if(typeof f.full !== 'boolean') return n + 'trường "Đầy bình" không hợp lệ.';
      if(typeof f.note !== 'string' || f.note.length > 200) return n + 'ghi chú quá dài.';
      if(!isInt(f.createdAt) || !isInt(f.updatedAt)) return n + 'thời điểm tạo không hợp lệ.';
    }
    for(var k = 0; k < d.vehicles.length; k++){
      var bad = findOdoViolation(d.fills, d.vehicles[k].id);
      if(bad) return 'Số km giảm ở lần đổ ' + S.fmtDate(bad.fill.date) + ' (' + fmtVnd(bad.fill.odo) + ' km, trước đó ' + fmtVnd(bad.prev.odo) + ' km — xe ' + d.vehicles[k].name + ').';
    }
    return null;
  }
  function cleanDataset(d){
    return {
      version: 1,
      vehicles: d.vehicles.map(function(v){ return { id: v.id, name: v.name.trim() }; }),
      fills: d.fills.map(function(f){
        return { id: f.id, date: f.date, vehicleId: f.vehicleId, fuelId: f.fuelId, fuelLabel: f.fuelLabel,
          liters: Math.round(f.liters * 1000) / 1000, amount: f.amount, price: f.price, priceSource: f.priceSource,
          odo: f.odo, full: f.full, note: f.note, createdAt: f.createdAt, updatedAt: f.updatedAt };
      })
    };
  }

  function load(){
    broken = false; brokenRaw = null;
    var raw = null;
    try{ raw = localStorage.getItem(KEY); }catch(e){}
    if(!raw){ data = emptyData(); return; }
    try{
      var obj = JSON.parse(raw);
      if(validateDataset(obj)) throw new Error('invalid');
      data = cleanDataset(obj);
    }catch(e){
      data = emptyData();
      broken = true;
      brokenRaw = raw;
    }
  }
  // Writes, reads back and verifies; on any failure the previous stored
  // value is put back and an error message returned.
  function persist(next){
    var prev = null;
    try{ prev = localStorage.getItem(KEY); }catch(e){}
    var text = JSON.stringify(next);
    try{
      localStorage.setItem(KEY, text);
      if(localStorage.getItem(KEY) !== text) throw new Error('readback');
    }catch(e){
      try{ if(prev == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, prev); }catch(e2){}
      return 'Không lưu được trên máy này (bộ nhớ đầy hoặc bị chặn).';
    }
    data = next;
    broken = false; brokenRaw = null;
    return null;
  }
  function cloneData(){ return JSON.parse(JSON.stringify(data)); }

  // ---------- Calculations ----------
  // Per vehicle: by date, then odometer (when both have one), then entry order.
  function cmpFill(a, b){
    if(a.date !== b.date) return a.date < b.date ? -1 : 1;
    if(a.odo != null && b.odo != null && a.odo !== b.odo) return a.odo - b.odo;
    return (a.createdAt || 0) - (b.createdAt || 0);
  }
  function fillsOf(fills, vehicleId){ return fills.filter(function(f){ return f.vehicleId === vehicleId; }).sort(cmpFill); }
  // First fill whose odometer is below that of the previous fill (by date)
  // that has one. Replayed in date order — never compared with the newest.
  function findOdoViolation(fills, vehicleId){
    var list = fillsOf(fills, vehicleId), prev = null;
    for(var i = 0; i < list.length; i++){
      var f = list[i];
      if(f.odo == null) continue;
      if(prev && f.odo < prev.odo) return { fill: f, prev: prev };
      prev = f;
    }
    return null;
  }
  // On an adjustment day the list had two prices; take the one the fill matches best.
  function listPriceFor(f){
    var adj = S.adjustmentOn(f.fuelId, f.date);
    if(adj) return Math.abs(f.price - adj.before) <= Math.abs(f.price - adj.after) ? adj.before : adj.after;
    return S.priceOn(f.fuelId, f.date);
  }
  function computeStats(list){
    var months = {}, total = { money: 0, liters: 0, count: 0 };
    var segs = [], open = null, acc = null;
    var cmp = { money: 0, liters: 0, listMoney: 0, count: 0 };
    list.forEach(function(f){
      var ym = f.date.slice(0, 7);
      var m = months[ym] || (months[ym] = { ym: ym, money: 0, liters: 0, count: 0 });
      m.money += f.amount; m.liters += f.liters; m.count++;
      total.money += f.amount; total.liters += f.liters; total.count++;
      // Full-to-full: the litres that refill the tank after a full fill are
      // what the km since then consumed — every fill after the opening one,
      // partial ones included, up to and including the next full fill.
      if(open){ acc.liters += f.liters; acc.money += f.amount; }
      if(f.full){
        if(f.odo != null){
          if(open && f.odo > open.odo) segs.push({ from: open, to: f, km: f.odo - open.odo, liters: acc.liters, money: acc.money });
          open = f; acc = { liters: 0, money: 0 };
        } else {
          open = null;
        }
      }
      var lp = listPriceFor(f);
      if(lp != null){
        cmp.money += f.amount; cmp.liters += f.liters; cmp.listMoney += f.liters * lp; cmp.count++;
      }
    });
    var km = 0, sl = 0, sm = 0;
    segs.forEach(function(s){ km += s.km; sl += s.liters; sm += s.money; });
    return {
      months: Object.keys(months).sort().reverse().map(function(k){ return months[k]; }),
      total: total, segments: segs,
      consumption: km > 0 ? { km: km, liters: sl, money: sm, per100: sl / km * 100, perKm: sm / km } : null,
      paid: cmp.liters > 0 ? { avgPaid: cmp.money / cmp.liters, avgList: cmp.listMoney / cmp.liters, diff: cmp.money - Math.round(cmp.listMoney), count: cmp.count } : null
    };
  }

  // ---------- Render: Sổ xăng ----------
  function vehicleName(id){
    var v = data.vehicles.filter(function(x){ return x.id === id; })[0];
    return v ? v.name : '';
  }
  function defaultVehicle(){
    if(selectedVehicle && vehicleName(selectedVehicle)) return selectedVehicle;
    var latest = data.fills.slice().sort(cmpFill).pop();
    return latest ? latest.vehicleId : data.vehicles[0].id;
  }
  function renderLog(){
    selectedVehicle = defaultVehicle();
    $('logBroken').hidden = !broken;
    $('btnAddFill').disabled = broken;

    var pick = $('vehiclePick');
    pick.hidden = data.vehicles.length < 2;
    pick.innerHTML = data.vehicles.length < 2 ? '' : data.vehicles.map(function(v){
      var on = v.id === selectedVehicle;
      return '<button type="button" data-vehicle="' + esc(v.id) + '" class="' + (on ? 'active' : '') + '" aria-pressed="' + on + '">' + esc(v.name) + '</button>';
    }).join('');

    var list = fillsOf(data.fills, selectedVehicle);
    var none = !list.length;
    $('logEmpty').hidden = !none || broken;
    $('logEmpty').querySelector('.empty-title').textContent = data.fills.length ?
      'Xe này chưa có lần đổ nào. Bấm + để ghi lần đầu.' : 'Chưa có lần đổ nào. Bấm + để ghi lần đầu.';
    $('sumCard').hidden = none;
    $('monthCard').hidden = none;
    $('fillsCard').hidden = none;
    if(none) return;

    var st = computeStats(list);
    var thisYm = S.vnToday().slice(0, 7);
    var cur = st.months.filter(function(m){ return m.ym === thisYm; })[0];
    $('sumMeta').textContent = data.vehicles.length > 1 ? vehicleName(selectedVehicle) : '';
    var html = '<div class="sum-month"><span class="sum-label">Tháng này (' + monthLabel(thisYm) + ')</span>' +
      (cur ? '<span class="sum-big" id="sumThisMonth">' + fmtVnd(cur.money) + ' đ</span><span class="sum-sub">' + fmtDec(cur.liters, 2) + ' L · ' + cur.count + ' lần</span>'
           : '<span class="sum-big muted" id="sumThisMonth">0 đ</span><span class="sum-sub">Chưa đổ lần nào</span>') +
    '</div>';
    html += '<div class="sum-rows">';
    if(st.consumption){
      var c = st.consumption;
      html += '<div class="sum-row" id="sumConsumption"><span class="sum-k">Tiêu hao</span><span class="sum-v">' + fmtDec(c.per100, 2) + ' L/100km · ' + fmtVnd(Math.round(c.perKm)) + ' đ/km</span></div>' +
        '<p class="sum-note">Đổ đầy tới đầy, trên ' + fmtVnd(c.km) + ' km</p>';
    } else {
      html += '<div class="sum-row" id="sumConsumption"><span class="sum-k">Tiêu hao</span><span class="sum-v muted">Chưa đủ dữ liệu</span></div>' +
        '<p class="sum-note">Cần 2 lần đổ đầy bình có ghi km.</p>';
    }
    if(st.paid){
      var p = st.paid, d = p.diff;
      var diffTxt = d > 0 ? 'Trả hơn niêm yết ' + fmtVnd(d) + ' đ' : d < 0 ? 'Trả ít hơn niêm yết ' + fmtVnd(-d) + ' đ' : 'Đúng giá niêm yết';
      html += '<div class="sum-row" id="sumPaid"><span class="sum-k">Giá trả TB</span><span class="sum-v">' + fmtVnd(Math.round(p.avgPaid)) + ' đ/L</span></div>' +
        '<p class="sum-note" id="sumPaidDiff">' + diffTxt + ' · niêm yết TB ' + fmtVnd(Math.round(p.avgList)) + '</p>';
    }
    html += '<div class="sum-row" id="sumTotal"><span class="sum-k">Tổng cộng</span><span class="sum-v">' + fmtVnd(st.total.money) + ' đ · ' + fmtDec(st.total.liters, 2) + ' L · ' + st.total.count + ' lần</span></div>';
    html += '</div>';
    $('sumContent').innerHTML = html;

    $('monthList').innerHTML = st.months.map(function(m){
      return '<div class="month-row" data-month="' + m.ym + '"><span class="month-name">' + monthLabel(m.ym) + '</span>' +
        '<span class="month-right"><span class="month-money">' + fmtVnd(m.money) + ' đ</span><span class="month-sub">' + fmtDec(m.liters, 2) + ' L · ' + m.count + ' lần</span></span></div>';
    }).join('');

    var rev = list.slice().reverse();
    $('fillList').innerHTML = rev.slice(0, fillsShown).map(function(f){
      var meta = [fmtLiters(f.liters) + ' L × ' + fmtVnd(f.price)];
      if(f.odo != null) meta.push(fmtVnd(f.odo) + ' km');
      return '<button type="button" class="fill-row" data-fill="' + esc(f.id) + '">' +
        '<span class="fill-main"><span class="fill-date">' + S.fmtDate(f.date) + ' · ' + esc(S.shortLabel(f.fuelId)) + '</span>' +
          '<span class="fill-meta">' + meta.join(' · ') + (f.full ? '<span class="tag">Đầy</span>' : '') + '</span>' +
          (f.note ? '<span class="fill-note">' + esc(f.note) + '</span>' : '') + '</span>' +
        '<span class="fill-amount">' + fmtVnd(f.amount) + ' đ</span>' +
      '</button>';
    }).join('');
    $('fillMore').hidden = fillsShown >= rev.length;
  }

  $('vehiclePick').addEventListener('click', function(e){
    var b = e.target.closest('button[data-vehicle]');
    if(!b) return;
    selectedVehicle = b.getAttribute('data-vehicle');
    fillsShown = FILL_PAGE;
    renderLog();
  });
  $('fillMore').addEventListener('click', function(){ fillsShown += FILL_PAGE; renderLog(); });
  $('fillList').addEventListener('click', function(e){
    var b = e.target.closest('[data-fill]');
    if(!b) return;
    var f = data.fills.filter(function(x){ return x.id === b.getAttribute('data-fill'); })[0];
    if(f) openForm(f);
  });

  // ---------- Form ----------
  // Fill 2 of 3: litres, money, price/litre. pMode says where the price came
  // from: 'list' (auto from the price list), 'user' (typed), 'derived'
  // (= money / litres), 'empty'. A list price never overwrites a typed one.
  var form = { editing: null, pMode: 'empty', anchor: 'L', lUser: false, aUser: false, chipPick: null };

  function setFieldError(id, msg){ $(id).textContent = msg || ''; $(id).hidden = !msg; }
  function clearErrors(){ ['fDateErr', 'fQtyErr', 'fPriceErr', 'fOdoErr', 'fillError'].forEach(function(id){ setFieldError(id, null); }); }

  function fuelChoices(day, keep){
    var ids = S.itemsOn(day);
    if(!ids.length) ids = S.itemOrder();
    if(!ids.length) ids = ['e10-ron95-iii', 'e5-ron92-ii', 'do-005s-ii', 'ko'];
    if(keep && ids.indexOf(keep) < 0) ids = ids.concat(keep);
    return ids;
  }
  function refreshFuelOptions(){
    var sel = $('fFuel'), prev = sel.value;
    var keep = form.editing ? form.editing.fuelId : null;
    var ids = fuelChoices($('fDate').value, keep);
    sel.innerHTML = ids.map(function(id){
      var label = form.editing && form.editing.fuelId === id && form.editing.fuelLabel ? form.editing.fuelLabel : S.itemLabel(id);
      return '<option value="' + esc(id) + '">' + esc(label) + '</option>';
    }).join('');
    if(prev && ids.indexOf(prev) >= 0) sel.value = prev;
  }
  function today15Passed(){
    var t = S.vnToday();
    return Date.now() >= S.dayToMs(t) + 8 * 3600000;
  }
  function setPrice(v, mode){
    $('fPrice').value = v == null || v === '' ? '' : fmtVnd(v);
    form.pMode = mode;
  }
  function renderChips(adj){
    var box = $('fPriceChips');
    if(!adj){ box.hidden = true; box.innerHTML = ''; return; }
    var P = parseInteger($('fPrice').value);
    box.innerHTML = [['before', 'Trước 15h', adj.before], ['after', 'Từ 15h', adj.after]].map(function(c){
      var on = form.pMode === 'list' && P === c[2];
      return '<button type="button" class="price-chip' + (on ? ' active' : '') + '" data-price="' + c[2] + '" aria-pressed="' + on + '">' + c[1] + ' <b>' + fmtVnd(c[2]) + '</b></button>';
    }).join('');
    box.hidden = false;
  }
  function refreshListPrice(){
    var day = $('fDate').value, id = $('fFuel').value;
    var hint = '';
    var adj = realDate(day) && id ? S.adjustmentOn(id, day) : null;
    if(form.pMode !== 'user' && form.pMode !== 'derived'){
      if(adj){
        if(day === S.vnToday()){
          var after = today15Passed();
          setPrice(after ? adj.after : adj.before, 'list');
          hint = after ? '· từ 15h' : '· trước 15h';
        } else {
          setPrice('', 'empty');
          hint = '· ngày đổi giá, chọn bên dưới';
        }
      } else {
        var p = realDate(day) && id ? S.priceOn(id, day) : null;
        if(p != null){ setPrice(p, 'list'); hint = '· niêm yết'; }
        else setPrice('', 'empty');
      }
      recalc();
    }
    $('fPriceHint').textContent = hint;
    renderChips(adj);
  }
  function setLiters(v){ $('fLiters').value = v.toFixed(3).replace('.', ','); }
  function recalc(){
    var L = parseLiters($('fLiters').value), A = parseInteger($('fAmount').value), P = parseInteger($('fPrice').value);
    if((form.pMode === 'list' || form.pMode === 'user') && P > 0){
      if(form.anchor === 'L' && L > 0){ $('fAmount').value = fmtVnd(Math.round(L * P)); form.aUser = false; }
      else if(form.anchor === 'A' && A > 0){ setLiters(Math.round(A / P * 1000) / 1000); form.lUser = false; }
    } else if((form.pMode === 'derived' || form.pMode === 'empty') && L > 0 && A > 0 && form.lUser && form.aUser){
      setPrice(Math.round(A / L), 'derived');
      $('fPriceHint').textContent = '· tính từ tiền ÷ lít';
    }
  }
  $('fLiters').addEventListener('input', function(){ form.lUser = true; form.anchor = 'L'; setFieldError('fQtyErr', null); recalc(); });
  $('fAmount').addEventListener('input', function(){ form.aUser = true; form.anchor = 'A'; setFieldError('fQtyErr', null); recalc(); });
  $('fPrice').addEventListener('input', function(){
    form.pMode = $('fPrice').value.trim() ? 'user' : 'empty';
    $('fPriceHint').textContent = '';
    setFieldError('fPriceErr', null);
    recalc();
    renderChips($('fDate').value && $('fFuel').value ? S.adjustmentOn($('fFuel').value, $('fDate').value) : null);
  });
  ['fAmount', 'fPrice', 'fOdo'].forEach(function(id){
    $(id).addEventListener('blur', function(){
      var n = parseInteger($(id).value);
      if(isFinite(n)) $(id).value = fmtVnd(n);
    });
  });
  $('fPriceChips').addEventListener('click', function(e){
    var b = e.target.closest('button[data-price]');
    if(!b) return;
    setPrice(+b.getAttribute('data-price'), 'list');
    $('fPriceHint').textContent = '';
    setFieldError('fPriceErr', null);
    recalc();
    renderChips(S.adjustmentOn($('fFuel').value, $('fDate').value));
  });
  $('fDate').addEventListener('change', function(){ setFieldError('fDateErr', null); refreshFuelOptions(); refreshListPrice(); });
  $('fFuel').addEventListener('change', refreshListPrice);
  $('fOdo').addEventListener('input', function(){ setFieldError('fOdoErr', null); });

  function openForm(fill){
    if(broken) return;
    clearErrors();
    form = { editing: fill || null, pMode: 'empty', anchor: 'L', lUser: !!fill, aUser: !!fill };
    var vid = fill ? fill.vehicleId : selectedVehicle || data.vehicles[0].id;
    $('fillSheetTitle').textContent = fill ? 'Sửa lần đổ' : 'Thêm lần đổ';
    $('btnFillDelete').hidden = !fill;
    $('fVehicleField').hidden = data.vehicles.length < 2;
    $('fVehicle').innerHTML = data.vehicles.map(function(v){ return '<option value="' + esc(v.id) + '">' + esc(v.name) + '</option>'; }).join('');
    $('fVehicle').value = vid;
    var today = S.vnToday();
    $('fDate').max = today;
    $('fDate').value = fill ? fill.date : today;
    $('fFuel').innerHTML = '';
    refreshFuelOptions();
    var last = fillsOf(data.fills, vid).pop();
    var fuel = fill ? fill.fuelId : (last ? last.fuelId : null);
    if(fuel && Array.prototype.some.call($('fFuel').options, function(o){ return o.value === fuel; })) $('fFuel').value = fuel;
    if(fill){
      $('fLiters').value = fmtLiters(fill.liters);
      $('fAmount').value = fmtVnd(fill.amount);
      setPrice(fill.price, fill.priceSource === 'list' ? 'list' : 'user');
      $('fOdo').value = fill.odo != null ? fmtVnd(fill.odo) : '';
      $('fFull').checked = fill.full;
      $('fNote').value = fill.note;
      $('fPriceHint').textContent = '';
      renderChips(S.adjustmentOn(fill.fuelId, fill.date));
    } else {
      $('fLiters').value = ''; $('fAmount').value = ''; $('fOdo').value = ''; $('fNote').value = '';
      $('fFull').checked = last ? last.full : false;
      setPrice('', 'empty');
      refreshListPrice();
    }
    S.openSheet('fillSheet', function(){ form.editing = null; });
  }
  $('btnAddFill').addEventListener('click', function(){ openForm(null); });
  $('fillClose').addEventListener('click', function(){ S.closeSheet('fillSheet'); });

  // Odometer must fit between its chronological neighbours (not just be
  // above the newest reading — a back-dated fill sits in the middle).
  function odoBoundsError(candidate, others){
    var list = others.concat(candidate).filter(function(f){ return f.vehicleId === candidate.vehicleId; }).sort(cmpFill);
    var idx = list.indexOf(candidate), lo = null, hi = null;
    for(var i = idx - 1; i >= 0; i--){ if(list[i].odo != null){ lo = list[i]; break; } }
    for(var j = idx + 1; j < list.length; j++){ if(list[j].odo != null){ hi = list[j]; break; } }
    if(lo && candidate.odo < lo.odo) return 'Số km phải ≥ ' + fmtVnd(lo.odo) + ' (lần đổ ' + fmtDM(lo.date) + ')';
    if(hi && candidate.odo > hi.odo) return 'Số km phải ≤ ' + fmtVnd(hi.odo) + ' (lần đổ ' + fmtDM(hi.date) + ')';
    return null;
  }

  $('fillForm').addEventListener('submit', function(e){
    e.preventDefault();
    if(broken) return;
    clearErrors();
    var ok = true;
    var day = $('fDate').value, today = S.vnToday();
    if(!realDate(day)){ setFieldError('fDateErr', 'Chọn ngày đổ.'); ok = false; }
    else if(day > today){ setFieldError('fDateErr', 'Ngày không được sau hôm nay.'); ok = false; }
    var fuelId = $('fFuel').value;
    if(!fuelId){ setFieldError('fDateErr', 'Chọn loại nhiên liệu.'); ok = false; }
    var L = parseLiters($('fLiters').value), A = parseInteger($('fAmount').value), P = parseInteger($('fPrice').value);
    if(form.pMode === 'derived' && L > 0 && A > 0) P = Math.round(A / L);
    if(!(L > 0 && L <= 1000)){ setFieldError('fQtyErr', 'Nhập số lít (lớn hơn 0, tối đa 1.000).'); ok = false; }
    else if(!(A > 0 && A <= 1e9)){ setFieldError('fQtyErr', 'Nhập số tiền.'); ok = false; }
    if(!(P > 0 && P <= 1e6)){
      setFieldError('fPriceErr', $('fPriceChips').hidden ? 'Nhập giá/lít.' : 'Chọn giá trước hay từ 15h, hoặc nhập giá.');
      ok = false;
    }
    var odoTxt = $('fOdo').value.trim(), odo = null;
    if(odoTxt){
      odo = parseInteger(odoTxt);
      if(!isFinite(odo) || odo > 9999999){ setFieldError('fOdoErr', 'Số km chỉ gồm chữ số.'); ok = false; odo = null; }
    }
    var note = $('fNote').value.trim().slice(0, 200);
    if(!ok) return;

    var now = Date.now();
    var ed = form.editing;
    var fill = {
      id: ed ? ed.id : newId('f'), date: day, vehicleId: $('fVehicle').value || selectedVehicle,
      fuelId: fuelId,
      fuelLabel: ed && ed.fuelId === fuelId ? ed.fuelLabel : S.itemLabel(fuelId),
      liters: L, amount: A, price: P, priceSource: form.pMode === 'list' ? 'list' : 'user',
      odo: odo, full: $('fFull').checked, note: note,
      createdAt: ed ? ed.createdAt : now, updatedAt: now
    };
    var others = data.fills.filter(function(f){ return !ed || f.id !== ed.id; });
    if(odo != null){
      var bound = odoBoundsError(fill, others);
      if(bound){ setFieldError('fOdoErr', bound); return; }
    }
    var next = cloneData();
    next.fills = others.map(function(f){ return JSON.parse(JSON.stringify(f)); }).concat(fill);
    if(findOdoViolation(next.fills, fill.vehicleId)){ setFieldError('fOdoErr', 'Số km không khớp thứ tự ngày.'); return; }
    var err = validateDataset(next) || persist(next);
    if(err){ setFieldError('fillError', err); return; }
    selectedVehicle = fill.vehicleId;
    S.closeSheet('fillSheet');
    S.toast(ed ? 'Đã lưu thay đổi' : 'Đã thêm lần đổ');
    renderAll();
  });

  $('btnFillDelete').addEventListener('click', function(){
    var ed = form.editing;
    if(!ed) return;
    confirmDialog({
      title: 'Xoá lần đổ ' + S.fmtDate(ed.date) + '?',
      text: fmtLiters(ed.liters) + ' L · ' + fmtVnd(ed.amount) + ' đ. Không hoàn tác được.',
      ok: 'Xoá', danger: true,
      onOk: function(){
        var next = cloneData();
        next.fills = next.fills.filter(function(f){ return f.id !== ed.id; });
        var err = persist(next);
        if(err){ S.showError('confirmError', err); return; }
        S.closeSheet('confirmSheet');
        S.closeSheet('fillSheet');
        S.toast('Đã xoá');
        renderAll();
      }
    });
  });

  // ---------- Confirm sheet ----------
  var confirmState = null;
  function confirmDialog(opts){
    confirmState = opts;
    $('confirmTitle').textContent = opts.title;
    $('confirmText').textContent = opts.text || '';
    $('confirmOk').textContent = opts.ok;
    $('confirmOk').classList.toggle('btn-danger', !!opts.danger);
    $('confirmOk').classList.toggle('btn-primary', !opts.danger);
    S.showError('confirmError', null);
    S.openSheet('confirmSheet', function(){ confirmState = null; });
  }
  $('confirmOk').addEventListener('click', function(){ if(confirmState) confirmState.onOk(); });
  $('confirmCancel').addEventListener('click', function(){ S.closeSheet('confirmSheet'); });

  // ---------- Settings: vehicles ----------
  var vehEditing = null;
  function renderVehicles(){
    var counts = {};
    data.fills.forEach(function(f){ counts[f.vehicleId] = (counts[f.vehicleId] || 0) + 1; });
    $('vehicleList').innerHTML = data.vehicles.map(function(v){
      return '<div class="veh-row"><span class="veh-name">' + esc(v.name) + '<small>' + (counts[v.id] || 0) + ' lần đổ</small></span>' +
        '<button type="button" class="btn btn-soft btn-sm" data-veh="' + esc(v.id) + '"' + (broken ? ' disabled' : '') + '>Đổi tên</button></div>';
    }).join('');
    $('btnAddVehicle').disabled = broken;
  }
  function openVehicle(v){
    vehEditing = v || null;
    $('vehSheetTitle').textContent = v ? 'Đổi tên xe' : 'Thêm xe';
    $('vehName').value = v ? v.name : '';
    S.showError('vehError', null);
    var hasFills = v && data.fills.some(function(f){ return f.vehicleId === v.id; });
    // Only an unused vehicle can go — deleting one with fills would orphan them.
    $('btnVehDelete').hidden = !v || hasFills || data.vehicles.length < 2;
    S.openSheet('vehSheet', function(){ vehEditing = null; });
  }
  $('vehicleList').addEventListener('click', function(e){
    var b = e.target.closest('button[data-veh]');
    if(!b) return;
    openVehicle(data.vehicles.filter(function(v){ return v.id === b.getAttribute('data-veh'); })[0]);
  });
  $('btnAddVehicle').addEventListener('click', function(){ openVehicle(null); });
  $('vehClose').addEventListener('click', function(){ S.closeSheet('vehSheet'); });
  $('vehForm').addEventListener('submit', function(e){
    e.preventDefault();
    var name = $('vehName').value.trim().slice(0, 40);
    if(!name){ S.showError('vehError', 'Nhập tên xe.'); return; }
    var next = cloneData();
    if(vehEditing) next.vehicles.forEach(function(v){ if(v.id === vehEditing.id) v.name = name; });
    else {
      if(next.vehicles.length >= 50){ S.showError('vehError', 'Tối đa 50 xe.'); return; }
      next.vehicles.push({ id: newId('v'), name: name });
    }
    var err = persist(next);
    if(err){ S.showError('vehError', err); return; }
    S.closeSheet('vehSheet');
    S.toast(vehEditing ? 'Đã đổi tên' : 'Đã thêm xe');
    renderAll();
  });
  $('btnVehDelete').addEventListener('click', function(){
    if(!vehEditing) return;
    var id = vehEditing.id;
    var next = cloneData();
    next.vehicles = next.vehicles.filter(function(v){ return v.id !== id; });
    var err = persist(next);
    if(err){ S.showError('vehError', err); return; }
    if(selectedVehicle === id) selectedVehicle = null;
    S.closeSheet('vehSheet');
    S.toast('Đã xoá xe');
    renderAll();
  });

  // ---------- Settings: backup / restore ----------
  function backupName(){ return 'fuel-track-so-xang-' + S.vnToday() + '.json'; }
  function backupFile(){
    var doc = { app: 'fuel-track', kind: 'fuel-log', version: 1, exportedAt: new Date().toISOString(), vehicles: data.vehicles, fills: data.fills };
    return new File([JSON.stringify(doc, null, 1)], backupName(), { type: 'application/json' });
  }
  function lastBackup(){
    try{
      var s = localStorage.getItem(BACKUP_KEY);
      return s && isFinite(Date.parse(s)) ? s : null;
    }catch(e){ return null; }
  }
  function vnDayOf(ms){ return S.msToDay(ms + 7 * 3600000); }
  function renderBackup(){
    var el = $('backupLast'), last = lastBackup(), warn = false, txt;
    if(!last){
      txt = data.fills.length ? 'Chưa sao lưu lần nào.' : 'Chưa có gì để sao lưu.';
      warn = data.fills.length > 0;
    } else {
      var day = vnDayOf(Date.parse(last));
      var days = Math.round((S.dayToMs(S.vnToday()) - S.dayToMs(day)) / DAY_MS);
      txt = 'Sao lưu lần cuối: ' + (days <= 0 ? 'hôm nay' : days === 1 ? 'hôm qua' : S.fmtDate(day) + ' (' + days + ' ngày trước)');
      warn = days >= 30;
    }
    el.textContent = txt;
    el.classList.toggle('warn-text', warn);
    $('btnBackup').disabled = broken || !data.fills.length;
    $('btnRestore').disabled = false;
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
    if(broken || !data.fills.length) return;
    S.showError('backupError', null);
    saveFile(backupFile(), function(ok, err){
      if(ok){ markBackedUp(); S.toast('Đã lưu file sao lưu'); }
      else if(err) S.showError('backupError', err);
    });
  });
  $('btnRestore').addEventListener('click', function(){
    S.showError('backupError', null);
    $('restoreFile').value = '';
    $('restoreFile').click();
  });
  function parseBackup(text){
    var obj;
    try{ obj = JSON.parse(text); }catch(e){ return { error: 'File không đọc được (không phải JSON).' }; }
    if(!obj || typeof obj !== 'object' || obj.app !== 'fuel-track' || obj.kind !== 'fuel-log') return { error: 'File này không phải bản sao lưu sổ xăng FuelTrack.' };
    var ds = { version: obj.version, vehicles: obj.vehicles, fills: obj.fills };
    var err = validateDataset(ds);
    if(err) return { error: err };
    var clean = cleanDataset(ds);
    try{
      clean.vehicles.forEach(function(v){
        var st = computeStats(fillsOf(clean.fills, v.id));
        st.months.forEach(function(m){ monthLabel(m.ym); fmtDec(m.liters, 2); fmtVnd(m.money); });
      });
    }catch(e){
      return { error: 'File có dữ liệu app không tính được — không khôi phục.' };
    }
    return { data: clean, exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null };
  }
  function applyBackup(next){
    var err = persist(next);
    if(err){ S.showError('confirmError', err); return false; }
    selectedVehicle = null;
    fillsShown = FILL_PAGE;
    S.closeSheet('confirmSheet');
    S.toast('Đã khôi phục ' + next.fills.length + ' lần đổ');
    renderAll();
    return true;
  }
  $('restoreFile').addEventListener('change', function(){
    var file = this.files && this.files[0];
    if(!file) return;
    if(file.size > 5 * 1024 * 1024){ S.showError('backupError', 'File quá lớn (tối đa 5 MB).'); return; }
    file.text().then(function(text){
      var r = parseBackup(text);
      if(r.error){ S.showError('backupError', r.error); return; }
      var info = 'File có ' + r.data.fills.length + ' lần đổ, ' + r.data.vehicles.length + ' xe' +
        (r.exportedAt && isFinite(Date.parse(r.exportedAt)) ? ', lưu ngày ' + S.fmtDate(vnDayOf(Date.parse(r.exportedAt))) : '') + '.';
      var hasCurrent = broken || data.fills.length > 0;
      if(!hasCurrent){
        confirmDialog({ title: 'Khôi phục sổ xăng?', text: info, ok: 'Khôi phục', onOk: function(){ applyBackup(r.data); } });
        return;
      }
      var curTxt = broken ? 'Dữ liệu hiện tại (bị lỗi)' : 'Sổ hiện tại (' + data.fills.length + ' lần đổ)';
      confirmDialog({
        title: 'Thay toàn bộ sổ xăng?',
        text: info + ' ' + curTxt + ' sẽ bị thay — app lưu nó ra file trước.',
        ok: 'Lưu bản hiện tại rồi khôi phục',
        onOk: function(){
          S.showError('confirmError', null);
          var cur = broken ? new File([brokenRaw || ''], 'fuel-track-so-xang-loi-' + S.vnToday() + '.json', { type: 'application/json' }) : backupFile();
          saveFile(cur, function(ok, err){
            if(ok){ if(!broken) markBackedUp(); applyBackup(r.data); }
            else if(err) S.showError('confirmError', err);
            else S.showError('confirmError', 'Chưa lưu bản hiện tại nên chưa khôi phục.');
          });
        }
      });
    }, function(){ S.showError('backupError', 'Không đọc được file.'); });
  });

  // ---------- Wiring ----------
  function renderAll(){
    renderLog();
    renderVehicles();
    renderBackup();
  }
  document.addEventListener('fueltrack:history', function(){
    renderLog();
    if($('fillSheet').classList.contains('open')){ refreshFuelOptions(); refreshListPrice(); }
  });
  document.addEventListener('fueltrack:tab', function(e){
    if(e.detail === 'log' || e.detail === 'settings') renderAll();
  });
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') renderAll(); });
  // Another tab/window of the app changed the log — never keep editing a stale copy.
  window.addEventListener('storage', function(e){
    if(e.key !== KEY && e.key !== BACKUP_KEY && e.key !== null) return;
    load();
    S.closeSheet('fillSheet');
    renderAll();
  });

  load();
  renderAll();
})();
