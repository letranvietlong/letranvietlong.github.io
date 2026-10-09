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
  // Dots/spaces group thousands; commas too, but only in exact 3-digit groups
  // ("93,100") — "93,1" stays invalid rather than guessing a decimal.
  function parseInteger(str){
    var s = String(str || '').replace(/\s/g, '');
    if(/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    s = s.replace(/\./g, '');
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
    // Null-prototype maps: with {} an id like "toString" would look present.
    var vids = Object.create(null);
    for(var i = 0; i < d.vehicles.length; i++){
      var v = d.vehicles[i];
      if(!v || typeof v.id !== 'string' || !ID_RE.test(v.id) || v.id.length > 40 || v.id === '__proto__' || vids[v.id] ||
         typeof v.name !== 'string' || !v.name.trim() || v.name.length > 40) return 'Danh sách xe trong file không hợp lệ.';
      vids[v.id] = true;
    }
    if(!Array.isArray(d.fills) || d.fills.length > MAX_FILLS) return 'Danh sách lần đổ trong file không hợp lệ.';
    var fids = Object.create(null);
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
  // Order of fills: by date; within a day by entry order, except that fills
  // with an odometer reading are put in odometer order among the slots they
  // occupy. A pairwise comparator "odo if both have one, else entry order" is
  // not transitive (A 50 km, B no km, C 100 km entered C, B, A), so the result
  // depended on array order and a valid log could load as corrupt.
  function cmpEntry(a, b){
    if(a.date !== b.date) return a.date < b.date ? -1 : 1;
    if((a.createdAt || 0) !== (b.createdAt || 0)) return (a.createdAt || 0) - (b.createdAt || 0);
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  function sortFills(fills){
    var list = fills.slice().sort(cmpEntry);
    for(var i = 0; i < list.length;){
      var j = i, slots = [], withOdo = [];
      while(j < list.length && list[j].date === list[i].date){
        if(list[j].odo != null){ slots.push(j); withOdo.push(list[j]); }
        j++;
      }
      withOdo.sort(function(a, b){ return a.odo - b.odo || cmpEntry(a, b); });
      slots.forEach(function(s, k){ list[s] = withOdo[k]; });
      i = j;
    }
    return list;
  }
  function fillsOf(fills, vehicleId){ return sortFills(fills.filter(function(f){ return f.vehicleId === vehicleId; })); }
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
    var latest = sortFills(data.fills).pop();
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
        '<p class="sum-note" id="sumPaidDiff">' + diffTxt + ' · niêm yết TB ' + fmtVnd(Math.round(p.avgList)) +
        (p.count < st.total.count ? ' · tính trên ' + p.count + '/' + st.total.count + ' lần có giá niêm yết' : '') + '</p>';
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
  // Fill 2 of 3: litres (L), money (A), price/litre (P). form.order = fields
  // the user set, oldest first; the newest two valid ones decide the third.
  // An automatic list price sits at the oldest position, so anything typed
  // outranks it (L then A typed → price = A ÷ L, both kept).
  // pMode = where the price came from: 'list' (auto), 'chip' (tapped list
  // price), 'user' (typed), 'derived' (A ÷ L), 'stored' (editing), 'empty'.
  // Editing a saved fill: litres and money are what was paid, so they start
  // as the two inputs and a date/fuel change never rewrites them — the list
  // price of the new date is only offered as a chip.
  var form = { editing: null, pMode: 'empty', order: [], derived: null, priceSet: false };
  var FIELD_IDS = { L: 'fLiters', A: 'fAmount', P: 'fPrice' };

  function setFieldError(id, msg){ $(id).textContent = msg || ''; $(id).hidden = !msg; }
  function clearErrors(){ ['fDateErr', 'fQtyErr', 'fPriceErr', 'fOdoErr', 'fillError'].forEach(function(id){ setFieldError(id, null); }); }

  function fuelChoices(day, keep){
    var ids = S.itemsOn(day);
    if(!ids.length) ids = S.itemOrder();
    if(!ids.length) ids = ['e10-ron95-iii', 'e5-ron92-ii', 'do-005s-ii', 'ko'];
    keep.forEach(function(k){ if(k && ids.indexOf(k) < 0) ids = ids.concat(k); });
    return ids;
  }
  // keepCurrent: a background refresh must not change the selected fuel.
  function refreshFuelOptions(keepCurrent){
    var sel = $('fFuel'), prev = sel.value;
    var keep = [form.editing ? form.editing.fuelId : null, keepCurrent ? prev : null];
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
    if($('fPrice').value) form.priceSet = true;
  }
  // List price for the form's date + fuel: { adj, auto, hint }.
  function listInfo(){
    var day = $('fDate').value, id = $('fFuel').value;
    if(!realDate(day) || !id) return { adj: null, auto: null, hint: '' };
    var adj = S.adjustmentOn(id, day);
    if(adj){
      if(day === S.vnToday()){
        var after = today15Passed();
        return { adj: adj, auto: after ? adj.after : adj.before, hint: after ? '· từ 15h' : '· trước 15h' };
      }
      return { adj: adj, auto: null, hint: '· ngày đổi giá, chọn bên dưới' };
    }
    var p = S.priceOn(id, day);
    return { adj: null, auto: p, hint: p != null ? '· niêm yết' : '' };
  }
  function changedFromStored(){
    var ed = form.editing;
    return !!ed && ($('fDate').value !== ed.date || $('fFuel').value !== ed.fuelId);
  }
  function renderChips(li){
    var box = $('fPriceChips'), chips = [];
    if(li.adj) chips = [['Trước 15h', li.adj.before], ['Từ 15h', li.adj.after]];
    else if(li.auto != null && changedFromStored() && li.auto !== parseInteger($('fPrice').value)) chips = [['Niêm yết ' + fmtDM($('fDate').value), li.auto]];
    if(!chips.length){ box.hidden = true; box.innerHTML = ''; return; }
    var P = parseInteger($('fPrice').value);
    box.innerHTML = chips.map(function(c){
      var on = P === c[1];
      return '<button type="button" class="price-chip' + (on ? ' active' : '') + '" data-price="' + c[1] + '" aria-pressed="' + on + '">' + c[0] + ' <b>' + fmtVnd(c[1]) + '</b></button>';
    }).join('');
    box.hidden = false;
  }
  function touch(f){
    form.order = form.order.filter(function(x){ return x !== f; }).concat(f);
    if(form.derived === f) form.derived = null;
  }
  function setAutoPrice(li){
    setPrice(li.auto, li.auto == null ? 'empty' : 'list');
    form.order = form.order.filter(function(x){ return x !== 'P'; });
    if(form.pMode === 'list') form.order.unshift('P');
    if(form.derived === 'P') form.derived = null;
    $('fPriceHint').textContent = li.hint;
  }
  function setLiters(v){ $('fLiters').value = v.toFixed(3).replace('.', ','); }
  function formValues(){
    return { L: parseLiters($('fLiters').value), A: parseInteger($('fAmount').value), P: parseInteger($('fPrice').value) };
  }
  // onlyEmpty: may fill an empty field but never rewrite one (background
  // refresh, save). src: the field being typed in — never computed into.
  function recalc(onlyEmpty, src){
    var v = formValues();
    var inputs = form.order.filter(function(f){ return v[f] > 0; }).slice(-2);
    if(inputs.length < 2){
      // A value computed from inputs that are gone would be stale.
      var d = form.derived;
      if(d && !onlyEmpty && d !== src){
        form.derived = null;
        if(d === 'P'){ setPrice('', 'empty'); $('fPriceHint').textContent = ''; if(!form.editing) setAutoPrice(listInfo()); }
        else $(FIELD_IDS[d]).value = '';
      }
      return;
    }
    var target = ['L', 'A', 'P'].filter(function(f){ return inputs.indexOf(f) < 0; })[0];
    if(target === src) return;
    if(onlyEmpty && $(FIELD_IDS[target]).value.trim()) return;
    form.order = form.order.filter(function(f){ return f !== target; });
    form.derived = target;
    if(target === 'A') $('fAmount').value = fmtVnd(Math.round(v.L * v.P));
    else if(target === 'L') setLiters(Math.round(v.A / v.P * 1000) / 1000);
    else { setPrice(Math.round(v.A / v.L), 'derived'); $('fPriceHint').textContent = '· tính từ tiền ÷ lít'; }
  }
  $('fLiters').addEventListener('input', function(){ touch('L'); setFieldError('fQtyErr', null); recalc(false, 'L'); renderChips(listInfo()); });
  $('fAmount').addEventListener('input', function(){ touch('A'); setFieldError('fQtyErr', null); recalc(false, 'A'); renderChips(listInfo()); });
  $('fPrice').addEventListener('input', function(){
    if($('fPrice').value.trim()){ form.pMode = 'user'; form.priceSet = true; touch('P'); }
    else { form.pMode = 'empty'; form.order = form.order.filter(function(x){ return x !== 'P'; }); }
    if(form.derived === 'P') form.derived = null;
    $('fPriceHint').textContent = '';
    setFieldError('fPriceErr', null);
    recalc(false, 'P');
    renderChips(listInfo());
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
    setPrice(+b.getAttribute('data-price'), 'chip');
    touch('P');
    $('fPriceHint').textContent = '';
    setFieldError('fPriceErr', null);
    recalc(false, 'P');
    renderChips(listInfo());
  });
  // The user changed date or fuel.
  function onDateOrFuel(){
    var li = listInfo();
    if(form.editing){
      $('fPriceHint').textContent = '';
    } else if(form.pMode !== 'user' && form.pMode !== 'derived'){
      setAutoPrice(li);
      recalc();
    }
    renderChips(li);
  }
  $('fDate').addEventListener('change', function(){ setFieldError('fDateErr', null); refreshFuelOptions(false); onDateOrFuel(); });
  $('fFuel').addEventListener('change', onDateOrFuel);
  $('fOdo').addEventListener('input', function(){ setFieldError('fOdoErr', null); });
  // Price list reloaded while the form is open (app came back to the
  // foreground, periodic refresh). Values the user chose or that come from
  // the saved record are never touched; only a price that was never set may
  // be filled in, and nothing is recomputed over an existing value.
  function refreshOpenForm(){
    refreshFuelOptions(true);
    var li = listInfo();
    if(!form.editing && form.pMode === 'empty' && !form.priceSet && li.auto != null){
      setAutoPrice(li);
      recalc(true);
    }
    renderChips(li);
  }

  function openForm(fill){
    if(broken) return;
    clearErrors();
    form = { editing: fill || null, pMode: 'empty', order: fill ? ['L', 'A'] : [], derived: null, priceSet: false };
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
    refreshFuelOptions(false);
    var last = fillsOf(data.fills, vid).pop();
    var fuel = fill ? fill.fuelId : (last ? last.fuelId : null);
    if(fuel && Array.prototype.some.call($('fFuel').options, function(o){ return o.value === fuel; })) $('fFuel').value = fuel;
    if(fill){
      $('fLiters').value = fmtLiters(fill.liters);
      $('fAmount').value = fmtVnd(fill.amount);
      setPrice(fill.price, 'stored');
      $('fOdo').value = fill.odo != null ? fmtVnd(fill.odo) : '';
      $('fFull').checked = fill.full;
      $('fNote').value = fill.note;
      $('fPriceHint').textContent = '';
      renderChips(listInfo());
    } else {
      $('fLiters').value = ''; $('fAmount').value = ''; $('fOdo').value = ''; $('fNote').value = '';
      $('fFull').checked = last ? last.full : false;
      setPrice('', 'empty');
      onDateOrFuel();
    }
    S.openSheet('fillSheet', function(){ form.editing = null; });
  }
  $('btnAddFill').addEventListener('click', function(){ openForm(null); });
  $('fillClose').addEventListener('click', function(){ S.closeSheet('fillSheet'); });

  // Odometer must fit between its chronological neighbours (not just be
  // above the newest reading — a back-dated fill sits in the middle).
  function odoBoundsError(candidate, others){
    var list = sortFills(others.concat(candidate).filter(function(f){ return f.vehicleId === candidate.vehicleId; }));
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
    recalc(true);
    var v = formValues(), L = v.L, A = v.A, P = v.P;
    var aBad = $('fAmount').value.trim() && isNaN(A), lBad = $('fLiters').value.trim() && isNaN(L);
    if(aBad){ setFieldError('fQtyErr', 'Số tiền chỉ gồm chữ số, ví dụ 93.100.'); ok = false; }
    else if(lBad){ setFieldError('fQtyErr', 'Số lít không đúng dạng, ví dụ 3,5.'); ok = false; }
    else if(!(L > 0 && L <= 1000)){ setFieldError('fQtyErr', 'Nhập số lít (lớn hơn 0, tối đa 1.000).'); ok = false; }
    else if(!(A > 0 && A <= 1e9)){ setFieldError('fQtyErr', 'Nhập số tiền.'); ok = false; }
    if(!(P > 0 && P <= 1e6)){
      setFieldError('fPriceErr', $('fPrice').value.trim() && isNaN(P) ? 'Giá/lít chỉ gồm chữ số, ví dụ 26.560.' :
        $('fPriceChips').hidden ? 'Nhập giá/lít.' : 'Chọn giá trước hay từ 15h, hoặc nhập giá.');
      ok = false;
    }
    var li = listInfo();
    var isList = li.adj ? P === li.adj.before || P === li.adj.after : li.auto != null && P === li.auto;
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
      liters: L, amount: A, price: P, priceSource: isList ? 'list' : 'user',
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
    var counts = Object.create(null);
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
    // Not in validateDataset: a stored log must not turn "corrupt" just
    // because the device clock went back a day.
    var today = S.vnToday();
    for(var i = 0; i < ds.fills.length; i++){
      if(ds.fills[i].date > today) return { error: 'Lần đổ thứ ' + (i + 1) + ': ngày ' + S.fmtDate(ds.fills[i].date) + ' sau hôm nay.' };
    }
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
      // Renamed/added vehicles with no fills are data too.
      var def = emptyData().vehicles[0];
      var customVehicles = data.vehicles.length !== 1 || data.vehicles[0].id !== def.id || data.vehicles[0].name !== def.name;
      var hasCurrent = broken || data.fills.length > 0 || customVehicles;
      if(!hasCurrent){
        confirmDialog({ title: 'Khôi phục sổ xăng?', text: info, ok: 'Khôi phục', onOk: function(){ applyBackup(r.data); } });
        return;
      }
      var curTxt = broken ? 'Dữ liệu hiện tại (bị lỗi)' : 'Sổ hiện tại (' + data.fills.length + ' lần đổ, ' + data.vehicles.length + ' xe)';
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
    if($('fillSheet').classList.contains('open')) refreshOpenForm();
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
