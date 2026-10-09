// Standard FuelTrack test scenario with hand-computed expectations (v1.9).
// Pair with harness.open({ path: ft.path, now: ft.now.B, mocks: ft.mocks.full, localStorage: ft.localStorage }).
//
// Data shapes (the real bot-written files follow the same shape):
//   data/fuel-price-history.json { items: {id: label}, changes: [ { date 'YYYY-MM-DD', detectedAt, prices: {id: đ/lít} } ] }
//       — change points only; each entry is a FULL snapshot; the page forward-fills per VN day.
//         A new price applies from 15:00 VN on its date (so that day has two list prices) — unless
//         detectedAt is before 07:00 VN of that date: then it applied all day (one price).
//   data/fuel-price.json         { effectiveDate, unit, items: [ { id, label, price, prevPrice, change, source } ] }
//   localStorage fueltrack_log_v1 { version:1, vehicles:[{id,name}], fills:[ { id, date, vehicleId, fuelId, fuelLabel,
//                                   liters (3 dp), amount (int đ), price (int đ/L), priceSource:'list'|'user',
//                                   odo:int|null, full:bool, note, createdAt, updatedAt } ] }
//   localStorage fueltrack_log_last_backup_v1  ISO string of the last "Lưu file"
//   localStorage fueltrack_push_v1             { deviceLabel, lastCopiedEndpointHash }
// Backup file: { app:'fuel-track', kind:'fuel-log', version:1, exportedAt, vehicles, fills }, name fuel-track-so-xang-YYYY-MM-DD.json (VN date).
//
// History below = the real data from 27/08/2026 to 08/10/2026. H_trunc = without 08/10.

const path = '/products/fuel-track/html/index.html';

const items = {
  'e10-ron95-iii': 'Xăng E10 RON 95-III', 'e5-ron92-ii': 'Xăng E5 RON 92-II', 'ron95-iii': 'Xăng RON 95-III',
  'do-005s-ii': 'Dầu DO 0,05S-II', 'ko': 'Dầu hỏa (KO)'
};
const P = (e10, e5, dO, ko) => ({ 'e10-ron95-iii': e10, 'e5-ron92-ii': e5, 'do-005s-ii': dO, 'ko': ko });
const changesFull = [
  { date: '2026-08-27', detectedAt: '2026-08-27T08:00:04Z', prices: P(22600, 21760, 28080, 26630) },
  { date: '2026-09-03', detectedAt: '2026-09-03T08:00:04Z', prices: P(23270, 22480, 27740, 26730) },
  { date: '2026-09-10', detectedAt: '2026-09-10T08:00:04Z', prices: P(24230, 23740, 28480, 28370) },
  { date: '2026-09-17', detectedAt: '2026-09-17T08:00:05Z', prices: P(25630, 25130, 29940, 31470) },
  { date: '2026-09-24', detectedAt: '2026-09-24T07:50:03Z', prices: P(27080, 26390, 30490, 30020) },
  { date: '2026-10-01', detectedAt: '2026-10-01T08:10:03Z', prices: P(27180, 26560, 29710, 29770) },
  { date: '2026-10-08', detectedAt: '2026-10-08T08:00:04Z', prices: P(28250, 27700, 29120, 30630) }
];
const historyFull = { items, changes: changesFull };
const historyTrunc = { items, changes: changesFull.slice(0, -1) };
// Holiday shift: the period of the week of 31/12/2026 was moved to Wednesday 30/12.
const historyHoliday = { items, changes: [
  { date: '2026-12-17', detectedAt: '2026-12-17T08:00:00Z', prices: P(28000, 27000, 29000, 30000) },
  { date: '2026-12-24', detectedAt: '2026-12-24T08:00:00Z', prices: P(28100, 27100, 29100, 30100) },
  { date: '2026-12-30', detectedAt: '2026-12-30T08:00:00Z', prices: P(28200, 27200, 29200, 30200) }
] };

function priceDoc(changes) {
  const last = changes[changes.length - 1], prev = changes[changes.length - 2];
  return {
    brand: 'PVOIL', region: 'Đà Nẵng', zone: 'Vùng 1', unit: 'đ/lít', effectiveDate: last.date, detectedAt: last.detectedAt,
    items: Object.keys(last.prices).map(id => ({ id, label: items[id], price: last.prices[id], prevPrice: prev.prices[id],
      change: last.prices[id] - prev.prices[id], source: 'petrolimex-v1' }))
  };
}

const mocks = {
  full: { 'data/fuel-price.json': priceDoc(changesFull), 'data/fuel-price-history.json': historyFull },
  trunc: { 'data/fuel-price.json': priceDoc(historyTrunc.changes), 'data/fuel-price-history.json': historyTrunc },
  holiday: { 'data/fuel-price.json': priceDoc(historyHoliday.changes), 'data/fuel-price-history.json': historyHoliday }
};

// "Now" cases (pass as harness `now`; tz Asia/Ho_Chi_Minh unless noted).
const now = {
  A: '2026-10-08T03:00:00Z',   // Thu 10:00 VN — use with mocks.trunc
  B: '2026-10-08T09:00:00Z',   // Thu 16:00 VN — mocks.full (or .trunc for "Đang chờ giá")
  D: '2026-10-09T02:00:00Z',   // Fri 09:00 VN
  TZ: '2026-10-08T17:30:00Z'   // Fri 00:30 VN — run with timezoneId 'America/Los_Angeles'
};

// T3 logbook seed: one vehicle, E5.
const fill = (id, date, liters, price, priceSource, amount, odo, full, createdAt) => ({
  id, date, vehicleId: 'v1', fuelId: 'e5-ron92-ii', fuelLabel: 'Xăng E5 RON 92-II', liters, amount, price, priceSource,
  odo, full, note: '', createdAt, updatedAt: createdAt
});
const fills = [
  fill('f1', '2026-09-05', 4, 22480, 'list', 89920, 12000, true, 1),
  fill('f2', '2026-09-15', 2, 23740, 'list', 47480, 12120, false, 2),
  fill('f3', '2026-09-20', 3, 25130, 'list', 75390, 12300, true, 3),
  fill('f4', '2026-10-03', 3.5, 26600, 'user', 93100, 12450, true, 4)   // list that day 26.560
];
const log = { version: 1, vehicles: [{ id: 'v1', name: 'Xe của tôi' }], fills };

const expected = {
  next: {
    A: { date: 'Thứ năm 08/10 · 15:00', left: 'còn 5 giờ 0 phút' },
    B: { date: 'Thứ năm 15/10 · 15:00', left: 'còn 6 ngày 23 giờ' },
    C: { waiting: 'Đang chờ giá kỳ 08/10' },
    D: { date: 'Thứ năm 15/10 · 15:00', left: 'còn 6 ngày 6 giờ' },
    TZ: { date: 'Thứ năm 15/10 · 15:00', left: 'còn 6 ngày 14 giờ' },
    // mocks.full at Thu 14:45 VN ('2026-10-08T07:45:00Z'): bot already recorded today → count to today 15:00
    early: { date: 'Thứ năm 08/10 · 15:00', left: 'còn 0 giờ 15 phút', meta: 'đã có giá mới' },
    // mocks.holiday: Wed 30/12 16:00 ('2026-12-30T09:00:00Z') and Thu 31/12 16:00 ('2026-12-31T09:00:00Z') — never "Đang chờ"
    holidayWed: { date: 'Thứ năm 07/01 · 15:00', left: 'còn 7 ngày 23 giờ' },
    holidayThu: { date: 'Thứ năm 07/01 · 15:00', left: 'còn 6 ngày 23 giờ' }
  },
  // now B + mocks.full. 30N base = price in effect on 08/09 = point 03/09.
  // Compare chips by textContent — innerText adds a space after ▲/▼ (flex gap).
  trendFull: {
    'e10-ron95-iii': { deltas: ['▲1.400', '▲1.450', '▲100', '▲1.070'], streak: 'Tăng 4 kỳ liền', d30: '▲4.980 (+21,40%)' },
    'e5-ron92-ii': { deltas: ['▲1.390', '▲1.260', '▲170', '▲1.140'], streak: 'Tăng 4 kỳ liền', d30: '▲5.220 (+23,22%)' },
    'do-005s-ii': { deltas: ['▲1.460', '▲550', '▼780', '▼590'], streak: '', d30: '▲1.380 (+4,97%)' },
    'ko': { deltas: ['▲3.100', '▼1.450', '▼250', '▲860'], streak: '', d30: '▲3.900 (+14,59%)' }
  },
  // now A + mocks.trunc
  trend30Trunc: { 'e10-ron95-iii': '▲3.910 (+16,80%)', 'e5-ron92-ii': '▲4.080 (+18,15%)', 'do-005s-ii': '▲1.970 (+7,10%)', 'ko': '▲3.040 (+11,37%)' },
  // now B + mocks.full + localStorage seed
  months: [
    { ym: '2026-10', text: 'T10/2026 · 93.100 đ · 3,50 L · 1 lần' },
    { ym: '2026-09', text: 'T9/2026 · 212.790 đ · 9,00 L · 3 lần' }
  ],
  thisMonth: '93.100 đ',
  total: '305.890 đ · 12,50 L · 4 lần',
  paidAvg: '24.471 đ/L',
  paidDiff: 'Trả hơn niêm yết 140 đ · niêm yết TB 24.460',
  consumption: '1,89 L/100km · 480 đ/km',        // segments 1,67 / 410 (300 km) and 2,33 / 621 (150 km)
  consumptionKm: 'Đổ đầy tới đầy, trên 450 km',
  // wrong methods would give: F1 litres included → 2,78; average of ratios → 2,00; total money ÷ km → 680 đ/km
  afterAdd0909: { month: 'T9/2026 · 235.270 đ · 10,00 L · 4 lần', consumption: '2,11 L/100km · 530 đ/km' },
  odoBlocked2509: 'Số km phải ≥ 12.300 (lần đổ 20/09)'
};

const sel = {
  tab: name => '.tabbar-btn[data-tab="' + name + '"]',      // prices | log | settings
  nextDate: '#nextContent .next-date',
  nextLeft: '#nextContent .next-left',
  trendRow: id => '.trend-row[data-item="' + id + '"]',
  addFill: '#btnAddFill',
  monthRow: ym => '.month-row[data-month="' + ym + '"]',
  fillRow: id => '.fill-row[data-fill="' + id + '"]',
  thisMonth: '#sumThisMonth',
  consumption: '#sumConsumption .sum-v',
  consumptionNote: '#sumConsumption + .sum-note',
  paid: '#sumPaid .sum-v',
  paidDiff: '#sumPaidDiff',
  total: '#sumTotal .sum-v',
  form: { date: '#fDate', fuel: '#fFuel', liters: '#fLiters', amount: '#fAmount', price: '#fPrice', chips: '#fPriceChips',
    odo: '#fOdo', full: '#fFull', save: '#btnFillSave', odoErr: '#fOdoErr' },
  backup: '#btnBackup', restore: '#btnRestore', restoreInput: '#restoreFile', backupError: '#backupError',
  confirmOk: '#confirmOk', confirmError: '#confirmError',
  push: { status: '#pushStatus', enable: '#btnPushEnable', test: '#btnPushTest', json: '#pushSubJson', copy: '#btnPushCopy', changed: '#pushChanged' },
  diag: '#diagLine'
};

module.exports = {
  path, items, historyFull, historyTrunc, historyHoliday, priceDoc, mocks, now, fills, log, expected, sel,
  localStorage: { fueltrack_log_v1: log }
};
