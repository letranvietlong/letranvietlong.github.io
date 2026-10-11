// PowerTrack: tính tiền điện, đọc thông báo, kiểm tra dữ liệu — không đụng DOM.
// Nạp trước power-track.js; cũng chạy được bằng node (module.exports) để test.
(function(root){
  'use strict';

  var DAY_MS = 86400000;
  var ID_RE = /^[\w-]+$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  var MAX_PLACES = 3, MAX_BILLS = 2000, MAX_KWH = 100000, MAX_AMOUNT = 1e9, MAX_INDEX = 999999999;
  var MAX_NAME = 30, MAX_CODE = 20, MAX_NOTE = 200, MAX_SPAN_DAYS = 100;
  var SOURCES = { index: 1, kwh: 1, paste: 1, amount: 1 };

  function isInt(n){ return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }

  // ---------- Ngày (chuỗi YYYY-MM-DD, tính trên UTC — không phụ thuộc múi giờ máy) ----------
  function realDate(s){
    if(typeof s !== 'string' || !DATE_RE.test(s)) return false;
    var p = s.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  }
  function dayToMs(day){
    var p = day.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function msToDay(ms){ return new Date(ms).toISOString().slice(0, 10); }
  // Vietnam has no DST: a fixed +7h shift read through UTC getters gives the
  // VN calendar date whatever the device's own timezone is.
  function vnToday(nowMs){ return msToDay((nowMs == null ? Date.now() : nowMs) + 7 * 3600000); }
  function vnMonth(nowMs){ return vnToday(nowMs).slice(0, 7); }
  function validPeriod(p){ return typeof p === 'string' && PERIOD_RE.test(p) && +p.slice(0, 4) >= 2000; }
  function daysInMonth(period){ return new Date(Date.UTC(+period.slice(0, 4), +period.slice(5, 7), 0)).getUTCDate(); }
  function lastDay(period){ return period + '-' + pad2(daysInMonth(period)); }
  function addMonths(period, n){
    var t = +period.slice(0, 4) * 12 + (+period.slice(5, 7) - 1) + n;
    return Math.floor(t / 12) + '-' + pad2(t % 12 + 1);
  }
  function addDays(day, n){ return msToDay(dayToMs(day) + n * DAY_MS); }
  // Both ends counted: 21/04 → 20/05 is 30 days.
  function daysInclusive(a, b){ return Math.round((dayToMs(b) - dayToMs(a)) / DAY_MS) + 1; }

  // ---------- Biểu giá ----------
  function validTariffDoc(doc){
    if(!doc || typeof doc !== 'object' || doc.version !== 1) return false;
    if(!Array.isArray(doc.tariffs) || !doc.tariffs.length || !Array.isArray(doc.vat) || !doc.vat.length) return false;
    var ok = doc.tariffs.every(function(t){
      if(!t || !realDate(t.effectiveFrom) || typeof t.decision !== 'string' || !Array.isArray(t.tiers) || !t.tiers.length) return false;
      var prev = 0;
      return t.tiers.every(function(x, i){
        if(!x || !isInt(x.price) || x.price <= 0) return false;
        if(i === t.tiers.length - 1) return x.upTo === null;
        if(!isInt(x.upTo) || x.upTo <= prev) return false;
        prev = x.upTo;
        return true;
      });
    });
    return ok && doc.vat.every(function(v){
      return v && realDate(v.effectiveFrom) && typeof v.pct === 'number' && isFinite(v.pct) && v.pct >= 0 && v.pct <= 100;
    });
  }
  function pickByDate(list, day){
    var best = null;
    for(var i = 0; i < list.length; i++){
      var e = list[i];
      if(e.effectiveFrom <= day && (!best || e.effectiveFrom > best.effectiveFrom)) best = e;
    }
    return best;
  }
  function tariffOn(doc, day){ return doc && Array.isArray(doc.tariffs) ? pickByDate(doc.tariffs, day) : null; }
  function vatOn(doc, day){ return doc && Array.isArray(doc.vat) ? pickByDate(doc.vat, day) : null; }

  // scale = { days, total } shrinks every tier quota for a part-period.
  function tierLines(kwh, tiers, scale){
    var lines = [], left = kwh, prev = 0;
    for(var i = 0; i < tiers.length && left > 0; i++){
      var size = tiers[i].upTo == null ? Infinity : tiers[i].upTo - prev;
      if(tiers[i].upTo != null) prev = tiers[i].upTo;
      if(scale && isFinite(size)) size = Math.round(size * scale.days / scale.total);
      var use = Math.min(left, size);
      if(use > 0) lines.push({ tier: i + 1, kwh: use, price: tiers[i].price, amount: use * tiers[i].price });
      left -= use;
    }
    return lines;
  }

  // bill: { kwh, period, fromDate, toDate }. The tariff is the one in force on
  // toDate (else the last day of the period); quotas are NOT scaled by days.
  // Only when both dates are known and a price or VAT change falls inside the
  // period (after fromDate, up to toDate) is the bill split by days — EVN's
  // exact rounding there is not verified, hence `estimated`.
  function calcBill(bill, doc){
    var none = { segments: [], subtotal: 0, vat: 0, total: 0, estimated: false, noTariff: true };
    if(!bill || !isInt(bill.kwh) || bill.kwh < 0 || !validPeriod(bill.period) || !doc) return none;
    var d = usableDates(bill);
    var to = d.to || lastDay(bill.period);
    var from = d.from && d.to ? d.from : null;

    var ranges = [];
    if(from){
      var seen = Object.create(null), cuts = [];
      (doc.tariffs || []).concat(doc.vat || []).forEach(function(e){
        var c = e.effectiveFrom;
        if(c > from && c <= to && !seen[c]){ seen[c] = true; cuts.push(c); }
      });
      cuts.sort();
      var start = from;
      cuts.forEach(function(c){ ranges.push([start, addDays(c, -1)]); start = c; });
      ranges.push([start, to]);
    }
    var out = ranges.length ? sumRanges(bill.kwh, ranges, d.from, doc) : null;
    if(out) return out;
    // No dates — or the period starts before the first tariff on file: price
    // the whole bill at the tariff of its end date. In the second case that
    // is only an approximation, so it is flagged.
    out = sumRanges(bill.kwh, [[null, to]], d.from, doc);
    if(!out) return none;
    if(ranges.length) out.estimated = true;
    return out;
  }
  // Reading dates that can be trusted for this bill: the end date must fall in
  // the period's month or a neighbouring one. A date far from the period (a
  // typo, an old backup) is ignored rather than picking a years-old tariff.
  function dateFitsPeriod(day, period, back){
    var m = day.slice(0, 7);
    return m >= addMonths(period, -(back || 1)) && m <= addMonths(period, 1);
  }
  function usableDates(bill){
    var from = realDate(bill.fromDate) ? bill.fromDate : null, to = realDate(bill.toDate) ? bill.toDate : null;
    if(to && !dateFitsPeriod(to, bill.period)) return { from: null, to: null };
    if(from && !dateFitsPeriod(from, bill.period, 4)) return { from: null, to: null };
    if(from && to && from > to) from = null;
    return { from: from, to: to };
  }
  function sumRanges(billKwh, ranges, fromDate, doc){
    var split = ranges.length > 1;
    var totalDays = split ? daysInclusive(ranges[0][0], ranges[ranges.length - 1][1]) : null;
    var out = { segments: [], subtotal: 0, vat: 0, total: 0, estimated: split, noTariff: false };
    var used = 0;
    for(var i = 0; i < ranges.length; i++){
      var r = ranges[i], ref = r[0] || r[1];
      var tariff = tariffOn(doc, ref), vatRule = vatOn(doc, ref);
      if(!tariff || !vatRule) return null;
      var days = r[0] ? daysInclusive(r[0], r[1]) : null;
      var kwh = !split ? billKwh :
        i < ranges.length - 1 ? Math.min(billKwh - used, Math.round(billKwh * days / totalDays)) : billKwh - used;
      used += kwh;
      var lines = tierLines(kwh, tariff.tiers, split ? { days: days, total: totalDays } : null);
      var subtotal = lines.reduce(function(s, l){ return s + l.amount; }, 0);
      var vat = Math.round(subtotal * vatRule.pct / 100);
      out.segments.push({ from: r[0] || fromDate, to: r[1], days: days, kwh: kwh,
        decision: tariff.decision, vatPct: vatRule.pct, lines: lines, subtotal: subtotal, vat: vat, total: subtotal + vat });
      out.subtotal += subtotal; out.vat += vat; out.total += subtotal + vat;
    }
    return out;
  }

  // The reverse of calcBill: the whole number of kWh whose bill is closest to
  // `amount` (a payment receipt gives the money but no meter figures). The
  // total grows with every kWh, so a binary search over calcBill itself
  // finds it — every rule (tariff of the period, VAT, split periods) is the
  // forward one by construction. A tie goes to the smaller kWh.
  // → { kwh, calcTotal, diff = amount − calcTotal, exact (|diff| ≤ 2 đ), noTariff }
  function kwhFromAmount(bill, doc){
    var none = { kwh: null, calcTotal: null, diff: null, exact: false, noTariff: true };
    if(!bill || !isInt(bill.amount) || bill.amount < 0) return none;
    function total(k){ return calcBill({ kwh: k, period: bill.period, fromDate: bill.fromDate, toDate: bill.toDate }, doc); }
    if(total(0).noTariff) return none;
    var lo = 0, hi = MAX_KWH;
    if(total(hi).total < bill.amount) lo = hi;
    while(lo < hi){
      var mid = Math.floor((lo + hi) / 2);
      if(total(mid).total >= bill.amount) hi = mid; else lo = mid + 1;
    }
    var k = lo, t = total(k).total;
    if(k > 0){
      var below = total(k - 1).total;
      if(Math.abs(bill.amount - below) <= Math.abs(t - bill.amount)){ k = k - 1; t = below; }
    }
    return { kwh: k, calcTotal: t, diff: bill.amount - t, exact: Math.abs(bill.amount - t) <= 2, noTariff: false };
  }

  function compareBill(amount, total){
    var diff = amount - total;
    return { diff: diff, match: Math.abs(diff) <= Math.max(1000, 0.005 * total) };
  }

  // kWh per day: by the reading dates when both are known, else by the days
  // of the calendar month (approx = true → the UI adds "≈").
  function perDay(bill){
    if(!isInt(bill.kwh)) return { value: null, approx: true };
    var d = usableDates(bill);
    if(d.from && d.to) return { value: bill.kwh / daysInclusive(d.from, d.to), approx: false };
    return { value: bill.kwh / daysInMonth(bill.period), approx: true };
  }

  // ---------- Đọc số gõ tay: CHẶT, sai dạng là NaN chứ không đoán ----------
  // Accepts "12612", "12.612", "12,612" (exact 3-digit groups). Rejects
  // "-1", "1e3", "1,5,5", "1.5", "12 612".
  function parseIntStrict(str){
    var s = String(str == null ? '' : str).trim();
    if(/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if(/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    if(!/^\d+$/.test(s) || s.length > 12) return NaN;
    return parseInt(s, 10);
  }

  // ---------- Đọc thông báo tiền điện dán vào ----------
  function stripMarks(s){
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }
  function parseGrouped(tok){
    if(/^\d+$/.test(tok)) return tok.length > 12 ? NaN : parseInt(tok, 10);
    if(/^\d{1,3}([.,]\d{3})+$/.test(tok)) return parseInt(tok.replace(/[.,]/g, ''), 10);
    return NaN;
  }
  // Every number that follows `labelRe` (global) through `gapRe` (anchored,
  // group 1 = the numeric token). Returns [{ value, after }].
  function numbersAfter(text, labelRe, gapRe){
    var out = [], m;
    labelRe.lastIndex = 0;
    while((m = labelRe.exec(text))){
      if(!m[0].length){ labelRe.lastIndex++; continue; }
      var rest = text.slice(m.index + m[0].length);
      var g = gapRe.exec(rest);
      if(!g) continue;
      var tok = g[1].replace(/[.,]+$/, '');
      out.push({ value: parseGrouped(tok), after: rest.slice(g[0].length - (g[1].length - tok.length)) });
    }
    return out;
  }
  // undefined = nothing found; null = found but ambiguous/unreadable.
  function single(values){
    if(!values.length) return undefined;
    for(var i = 0; i < values.length; i++){
      if(!isFinite(values[i]) || values[i] !== values[0]) return null;
    }
    return values[0];
  }
  var D_SRC = '(\\d{1,2})\\s*[\\/\\-.]\\s*(\\d{1,2})\\s*[\\/\\-.]\\s*(\\d{4})';
  function isoOf(d, m, y){
    var s = y + '-' + pad2(+m) + '-' + pad2(+d);
    return realDate(s) ? s : null;
  }
  var CURRENCY_RE = /^\s?(?:d|dong|vnd)\b(?!\s*\/)/;
  function isMoney(c){ return CURRENCY_RE.test(c.after); }
  // Money after a label: the first number in the same sentence (within 60
  // chars) that carries a currency unit — "tien dien t9: 990.000d" must skip
  // the 9. Returns [{ value, start, end }].
  function moneyAfter(text, labelRe){
    var out = [], m;
    labelRe.lastIndex = 0;
    while((m = labelRe.exec(text))){
      var from = m.index + m[0].length;
      var span = text.slice(from, from + 60).split(/[.;!?]\s+(?=[a-z])|\n/)[0];
      var tokRe = /\d[\d.,]*/g, x;
      while((x = tokRe.exec(span))){
        var tok = x[0].replace(/[.,]+$/, ''), end = from + x.index + tok.length;
        if(CURRENCY_RE.test(text.slice(end))){ out.push({ value: parseGrouped(tok), start: m.index, end: end }); break; }
      }
    }
    return out;
  }
  function blank(text, spans){
    spans.forEach(function(s){ text = text.slice(0, s.start) + new Array(s.end - s.start + 1).join(' ') + text.slice(s.end); });
    return text;
  }

  // Returns only the fields it is sure about; anything ambiguous stays null.
  // Nothing of the text itself (name, address, customer code) is kept.
  function parsePaste(text){
    var out = { period: null, fromDate: null, toDate: null, oldIndex: null, newIndex: null, kwh: null, amount: null };
    if(typeof text !== 'string' || !text.trim()) return out;
    var t = stripMarks(text.slice(0, 5000)).toLowerCase().replace(/[\u00a0\t\r]+/g, ' ');

    // Digits that are not readings: customer/bill/meter codes, phone numbers.
    t = t.replace(/\b(?:ma\s*(?:kh|khach\s*hang|k\/h|pe|so|thanh\s*toan|dinh\s*danh|tra\s*cuu)|makh|khach\s*hang|so\s*(?:hoa\s*don|hd|cong\s*to|seri|serial|tai\s*khoan|tk)|hoa\s*don\s*so)\s*[:#]?\s*[a-z0-9]*\d[a-z0-9]*/g, ' ');
    t = t.replace(/[a-z0-9]+/g, function(tok){
      return /[a-z]/.test(tok) && /\d/.test(tok) && tok.length >= 8 && !/^\d+(?:kwh|d|dong|vnd)$/.test(tok) ? ' ' : tok;
    });
    t = t.replace(/\b(?:dt|sdt|dien\s*thoai|hotline|tong\s*dai|lien\s*he|lh|cskh)\s*:?\s*\d[\d.]{5,}/g, ' ');
    t = t.replace(/\b(?:1[89]00[\s.]?\d{4}(?:[\s.]?\d{2})?|0\d{2,3}[\s.]?\d{3,4}[\s.]?\d{3,4})\b/g, ' ');
    // Payment window ("thoi gian thanh toan tu … den …") and deadline: not reading dates.
    t = t.replace(new RegExp('\\bthanh\\s*toan[^.\\n\\d]{0,25}' + D_SRC + '(?:\\s*(?:den|toi|[-\u2013\u2014~])\\s*(?:het\\s*)?(?:ngay\\s*)?:?\\s*' + D_SRC + ')?', 'g'), ' ');
    t = t.replace(new RegExp('(?:\\bhan\\b[^.\\n\\d]{0,30}|\\btruoc\\s*(?:ngay\\s*)?)' + D_SRC, 'g'), ' ');

    var m, pairs = [];
    var rangeRe = new RegExp(D_SRC + '\\s*(?:den|toi|[-\u2013\u2014~])\\s*(?:het\\s*)?(?:ngay\\s*)?:?\\s*' + D_SRC, 'g');
    while((m = rangeRe.exec(t))){
      var a = isoOf(m[1], m[2], m[3]), b = isoOf(m[4], m[5], m[6]);
      pairs.push(a && b && a <= b ? a + '|' + b : '');
    }
    if(pairs.length && pairs[0] && pairs.every(function(p){ return p === pairs[0]; })){
      out.fromDate = pairs[0].split('|')[0];
      out.toDate = pairs[0].split('|')[1];
    }

    var periods = [];
    [/\bky\s*(?:hoa\s*don|hd|thanh\s*toan|cuoc)?\s*(?:\d\s+)?(?:thang\s*)?:?\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})\b/g,
     /\bthang\s*:?\s*(\d{1,2})\s*(?:[\/\-.]|nam)\s*(\d{4})\b/g,
     /\bt\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})\b/g].forEach(function(re){
      var x;
      while((x = re.exec(t))){
        var mo = +x[1], yr = +x[2];
        periods.push(mo >= 1 && mo <= 12 && yr >= 2000 && yr <= 2100 ? yr + '-' + pad2(mo) : '');
      }
    });
    if(periods.length && periods[0] && periods.every(function(p){ return p === periods[0]; })) out.period = periods[0];

    // Dates and month/year pairs are done with — their digits must not be
    // read as readings or money below.
    t = t.replace(new RegExp(D_SRC, 'g'), ' ').replace(/(^|[^\d.,])\d{1,2}\s*[\/\-]\s*\d{4}\b/g, '$1 ');

    var tight = /^\s*[:=]?\s*(?:la\s*)?(\d[\d.,]*)/;
    function values(list){ return list.map(function(c){ return c.value; }); }
    var oldV = single(values(numbersAfter(t, /\b(?:cs|chi\s*so)\s*(?:cong\s*to\s*)?(?:cu|dau(?:\s*ky)?)\b|\bcsdk\b/g, tight)));
    var newV = single(values(numbersAfter(t, /\b(?:cs|chi\s*so)\s*(?:cong\s*to\s*)?(?:moi|cuoi(?:\s*ky)?)\b|\bcsck\b/g, tight)));
    if(isInt(oldV) && isInt(newV) && oldV <= MAX_INDEX && newV <= MAX_INDEX && newV >= oldV){
      out.oldIndex = oldV; out.newIndex = newV;
    }

    var labelled = numbersAfter(t, /\b(?:tieu\s*thu|san\s*luong|dntt|dien\s*nang|so\s*dien)\b/g, tight).filter(function(c){ return !isMoney(c); });
    var kwhV = single(values(labelled));
    if(kwhV === undefined){
      var units = [], u, unitRe = /(\d[\d.,]*)\s*kwh/g;
      while((u = unitRe.exec(t))) units.push(parseGrouped(u[1].replace(/[.,]+$/, '')));
      // Only when it appears exactly once: tier lines ("bac 1: 50 kwh. bac 2:
      // 50 kwh") repeat a figure that is not the month's total.
      kwhV = units.length === 1 ? single(units) : null;
    }
    if(isInt(kwhV) && kwhV <= MAX_KWH) out.kwh = kwhV;

    // Money. "Total to pay" labels first, then "this period" labels on what is
    // left (so "so tien phai thanh toan" is not read twice). With an old debt
    // in the text the total includes it, so this period's figure wins.
    function moneyValues(list){ return list.map(function(c){ return c.value; }); }
    var totals = moneyAfter(t, /\b(?:tong\s*(?:cong|tien|so\s*tien)|tong\s*(?:phai\s*)?(?:thanh\s*toan|tra|nop)|so\s*tien(?:\s*phai)?\s*(?:thanh\s*toan|tra|nop)|phai\s*(?:thanh\s*toan|tra|nop)|thanh\s*tien)\b/g);
    var rest = blank(t, totals);
    var debtRe = /\b(?:no\s*(?:cu|ky\s*truoc|truoc|ton|qua\s*han)|con\s*no|tien\s*no|du\s*no)\b/g;
    var hasDebt = debtRe.test(rest);
    rest = blank(rest, moneyAfter(rest, debtRe));
    var own = moneyAfter(rest, /\b(?:tien\s*dien|so\s*tien)\b/g);
    var totalV = single(moneyValues(totals)), ownV = single(moneyValues(own));
    var amountV = hasDebt && ownV !== undefined ? ownV : totalV !== undefined ? totalV : ownV;
    // An unlabelled "… đ" counts only in a text that is about electricity,
    // and never a house number ("so 12 d. le loi").
    if(amountV === undefined && /\b(?:dien|evn\w*|kwh)\b/.test(t)){
      var all = [], x, tokRe = /\d[\d.,]*/g;
      rest = blank(rest, own);
      while((x = tokRe.exec(rest))){
        var tok = x[0].replace(/[.,]+$/, '');
        if(/\b(?:so|nha|ngo|ngach|hem|kiet|to|ap|khu|duong|phong|tang|lo)\s*$/.test(rest.slice(0, x.index))) continue;
        if(CURRENCY_RE.test(rest.slice(x.index + tok.length))) all.push(parseGrouped(tok));
      }
      amountV = single(all);
    }
    if(isInt(amountV) && amountV <= MAX_AMOUNT) out.amount = amountV;
    return out;
  }

  // ---------- Dữ liệu người dùng ----------
  function emptyData(){ return { version: 1, places: [{ id: 'p1', name: 'Nhà', customerCode: '' }], bills: [] }; }
  function isDefaultData(d){
    var def = emptyData().places[0];
    return !d.bills.length && d.places.length === 1 && d.places[0].id === def.id && d.places[0].name === def.name && !d.places[0].customerCode;
  }
  function optDate(v){ return v === null || realDate(v); }
  function optIndex(v){ return v === null || (isInt(v) && v >= 0 && v <= MAX_INDEX); }

  // Returns a Vietnamese error message, or null when the dataset is valid.
  function validateDataset(d){
    if(!d || typeof d !== 'object' || Array.isArray(d)) return 'File không đúng định dạng dữ liệu PowerTrack.';
    if(d.version !== 1){
      return typeof d.version === 'number' && d.version > 1 ?
        'File được tạo bởi phiên bản mới hơn (định dạng ' + d.version + '). Hãy cập nhật app rồi thử lại.' :
        'Định dạng file không hợp lệ.';
    }
    if(!Array.isArray(d.places) || !d.places.length || d.places.length > MAX_PLACES) return 'Danh sách nơi dùng điện không hợp lệ (cần 1–' + MAX_PLACES + ' nơi).';
    // Null-prototype maps: with {} an id like "toString" would look present.
    var pids = Object.create(null);
    for(var i = 0; i < d.places.length; i++){
      var p = d.places[i];
      if(!p || typeof p !== 'object' || typeof p.id !== 'string' || !ID_RE.test(p.id) || p.id.length > 40 || p.id === '__proto__' || pids[p.id] ||
         typeof p.name !== 'string' || !p.name.trim() || p.name.length > MAX_NAME ||
         (p.customerCode != null && (typeof p.customerCode !== 'string' || p.customerCode.length > MAX_CODE))) return 'Danh sách nơi dùng điện không hợp lệ.';
      pids[p.id] = true;
    }
    if(!Array.isArray(d.bills) || d.bills.length > MAX_BILLS) return 'Danh sách hoá đơn không hợp lệ (tối đa ' + MAX_BILLS + ').';
    var ids = Object.create(null), slots = Object.create(null);
    for(var j = 0; j < d.bills.length; j++){
      var b = d.bills[j], n = 'Hoá đơn thứ ' + (j + 1) + ': ';
      if(!b || typeof b !== 'object' || Array.isArray(b)) return n + 'không hợp lệ.';
      if(typeof b.id !== 'string' || !ID_RE.test(b.id) || b.id.length > 40 || b.id === '__proto__' || ids[b.id]) return n + 'mã không hợp lệ hoặc bị trùng.';
      ids[b.id] = true;
      if(typeof b.placeId !== 'string' || !pids[b.placeId]) return n + 'nơi dùng điện không có trong danh sách.';
      if(!validPeriod(b.period)) return n + 'kỳ không hợp lệ.';
      var slot = b.placeId + '|' + b.period;
      if(slots[slot]) return n + 'trùng kỳ ' + b.period.slice(5) + '/' + b.period.slice(0, 4) + ' với một hoá đơn khác của cùng nơi.';
      slots[slot] = true;
      if(!optDate(b.fromDate) || !optDate(b.toDate)) return n + 'ngày ghi chỉ số không hợp lệ.';
      if(b.fromDate && b.toDate && b.fromDate > b.toDate) return n + 'từ ngày nằm sau đến ngày.';
      if(!optIndex(b.oldIndex) || !optIndex(b.newIndex)) return n + 'chỉ số công tơ không hợp lệ.';
      if(b.oldIndex !== null && b.newIndex !== null && b.newIndex < b.oldIndex) return n + 'chỉ số mới nhỏ hơn chỉ số cũ.';
      if(typeof b.source !== 'string' || SOURCES[b.source] !== 1) return n + 'cách nhập không hợp lệ.';
      // Only a bill entered by amount for a period without a tariff may lack kWh.
      if(!(b.kwh === null && b.source === 'amount') && (!isInt(b.kwh) || b.kwh < 0 || b.kwh > MAX_KWH)) return n + 'số kWh phải từ 0 đến 100.000.';
      if(b.kwhInferred != null && typeof b.kwhInferred !== 'boolean') return n + 'trường "kWh suy ra" không hợp lệ.';
      if(b.kwhInferred === true && b.kwh === null) return n + 'trường "kWh suy ra" không hợp lệ.';
      if(b.amount !== null && (!isInt(b.amount) || b.amount < 0 || b.amount > MAX_AMOUNT)) return n + 'số tiền không hợp lệ.';
      if(typeof b.note !== 'string' || b.note.length > MAX_NOTE) return n + 'ghi chú quá dài.';
      if(!isInt(b.createdAt) || !isInt(b.updatedAt)) return n + 'thời điểm tạo không hợp lệ.';
    }
    return null;
  }
  function cleanDataset(d){
    return {
      version: 1,
      places: d.places.map(function(p){ return { id: p.id, name: p.name.trim(), customerCode: typeof p.customerCode === 'string' ? p.customerCode.trim() : '' }; }),
      bills: d.bills.map(function(b){
        var out = { id: b.id, placeId: b.placeId, period: b.period, fromDate: b.fromDate, toDate: b.toDate,
          oldIndex: b.oldIndex, newIndex: b.newIndex, kwh: b.kwh, amount: b.amount, source: b.source,
          note: b.note, createdAt: b.createdAt, updatedAt: b.updatedAt };
        // Written only when true, so records from 1.0 stay byte-identical.
        if(b.kwhInferred === true) out.kwhInferred = true;
        return out;
      })
    };
  }

  // Backup file text → { data, exportedAt } or { error }. "Not in the future"
  // is checked here only (not in validateDataset): stored data must not turn
  // "corrupt" because the device clock went back.
  function parseBackup(text, tariffDoc, nowMs){
    var obj;
    try{ obj = JSON.parse(text); }catch(e){ return { error: 'File không đọc được (không phải JSON).' }; }
    if(!obj || typeof obj !== 'object' || obj.app !== 'power-track' || obj.kind !== 'power-log') return { error: 'File này không phải bản sao lưu của PowerTrack.' };
    var ds = { version: obj.version, places: obj.places, bills: obj.bills };
    var err = validateDataset(ds);
    if(err) return { error: err };
    var month = vnMonth(nowMs), today = vnToday(nowMs);
    for(var i = 0; i < ds.bills.length; i++){
      var b = ds.bills[i], n = 'Hoá đơn thứ ' + (i + 1) + ': ';
      if(b.period > month) return { error: n + 'kỳ ' + b.period.slice(5) + '/' + b.period.slice(0, 4) + ' nằm sau tháng này.' };
      if((b.fromDate && b.fromDate > today) || (b.toDate && b.toDate > today)) return { error: n + 'ngày ghi chỉ số nằm sau hôm nay.' };
    }
    var clean = cleanDataset(ds);
    try{
      clean.bills.forEach(function(b){
        var c = calcBill(b, tariffDoc);
        if(!isFinite(c.total) || c.total < 0) throw new Error('calc');
        perDay(b);
        if(b.amount !== null) kwhFromAmount(b, tariffDoc);
      });
    }catch(e){
      return { error: 'File có dữ liệu app không tính được — không khôi phục.' };
    }
    return { data: clean, exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null };
  }

  var api = {
    MAX_PLACES: MAX_PLACES, MAX_BILLS: MAX_BILLS, MAX_KWH: MAX_KWH, MAX_AMOUNT: MAX_AMOUNT, MAX_INDEX: MAX_INDEX,
    MAX_NAME: MAX_NAME, MAX_CODE: MAX_CODE, MAX_NOTE: MAX_NOTE, MAX_SPAN_DAYS: MAX_SPAN_DAYS,
    realDate: realDate, dayToMs: dayToMs, msToDay: msToDay, vnToday: vnToday, vnMonth: vnMonth, validPeriod: validPeriod,
    daysInMonth: daysInMonth, lastDay: lastDay, addMonths: addMonths, addDays: addDays, daysInclusive: daysInclusive,
    validTariffDoc: validTariffDoc, usableDates: usableDates, dateFitsPeriod: dateFitsPeriod, tariffOn: tariffOn, vatOn: vatOn, tierLines: tierLines,
    calcBill: calcBill, kwhFromAmount: kwhFromAmount, compareBill: compareBill, perDay: perDay,
    parseIntStrict: parseIntStrict, parsePaste: parsePaste,
    emptyData: emptyData, isDefaultData: isDefaultData, validateDataset: validateDataset, cleanDataset: cleanDataset, parseBackup: parseBackup
  };
  root.PowerTrackCore = api;
  if(typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
