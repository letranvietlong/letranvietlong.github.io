// Standard PowerTrack test scenario with hand-computed expectations (v1.1: entry by amount, kWh derived backwards).
// Pair with harness.open({ path: pt.path, now: pt.now.main, mocks: pt.mocks, localStorage: pt.localStorage }).
//
// Data shapes:
//   json/electricity-tariff.json { version:1, checkedAt, unit, notice?, tariffs:[{ effectiveFrom, decision, note?, tiers:[{ upTo:int|null, price }] }],
//                                  vat:[{ effectiveFrom, pct, provisional? }] }   — hand-written; prices are before VAT.
//   localStorage powertrack_v1   { version:1, places:[{ id, name ≤30, customerCode ≤20 }] (1–3),
//                                  bills:[{ id, placeId, period 'YYYY-MM', fromDate|null, toDate|null, oldIndex|null, newIndex|null,
//                                           kwh int (null only for source 'amount' in a period without tariff), amount int|null (VAT included),
//                                           source 'amount'|'kwh'|'index'|'paste', note ≤200, createdAt, updatedAt,
//                                           kwhInferred?: true (kWh derived from the amount; key absent otherwise) }] }   — one bill per (placeId, period)
//   localStorage powertrack_last_backup_v1   ISO string of the last "Lưu file"
// Backup file: { app:'power-track', kind:'power-log', version:1, exportedAt, places, bills }, name power-track-YYYY-MM-DD.json (VN date).
// Pure maths lives in window.PowerTrackCore (also loadable with node: require('<repo>/products/power-track/js/power-track-core.js')).
//
// The tariff below is a frozen copy of the real file as of 2026-10-11, so the
// expectations stay valid after a future price decision is added to the app.

const path = '/products/power-track/html/index.html';

const T = (effectiveFrom, decision, p) => ({ effectiveFrom, decision,
  tiers: [50, 100, 200, 300, 400, null].map((upTo, i) => ({ upTo, price: p[i] })) });
const tariff = {
  version: 1, checkedAt: '2026-10-11', unit: 'đ/kWh', notice: 'Biểu giá 5 bậc (QĐ 14/2025/QĐ-TTg) chưa áp dụng.',
  tariffs: [
    T('2023-05-04', '1062/QĐ-BCT', [1728, 1786, 2074, 2612, 2919, 3015]),
    T('2023-11-09', '2941/QĐ-BCT', [1806, 1866, 2167, 2729, 3050, 3151]),
    T('2024-10-11', '2699/QĐ-BCT', [1893, 1956, 2271, 2860, 3197, 3302]),
    T('2025-05-10', '1279/QĐ-BCT', [1984, 2050, 2380, 2998, 3350, 3460])
  ],
  vat: [
    { effectiveFrom: '2023-01-01', pct: 10 },
    { effectiveFrom: '2023-07-01', pct: 8 },
    { effectiveFrom: '2027-01-01', pct: 10, provisional: true }
  ]
};
const mocks = { 'json/electricity-tariff.json': tariff };

const now = {
  main: '2026-10-11T03:00:00Z',     // 10:00 VN
  tzLA: '2026-10-31T18:30:00Z',     // 01:30 VN on 01/11 — run with timezoneId 'America/Los_Angeles' (device still 31/10)
  tzTokyo: '2026-09-30T16:00:00Z'   // 23:00 VN on 30/09 — run with timezoneId 'Asia/Tokyo' (device already 01/10)
};

// Calculator, QĐ 1279 + VAT 8%: kWh → [before VAT, VAT, total].
const calculator = {
  0: [0, 0, 0], 50: [99200, 7936, 107136], 51: [101250, 8100, 109350], 100: [201700, 16136, 217836],
  187: [408760, 32701, 441461], 200: [439700, 35176, 474876], 300: [739500, 59160, 798660],
  350: [907000, 72560, 979560], 400: [1074500, 85960, 1160460], 401: [1077960, 86237, 1164197],
  612: [1808020, 144642, 1952662]
};
const lines612 = [99200, 102500, 238000, 299800, 335000, 733520];

// calcBill cases: the tariff follows the reading date, VAT follows its own schedule.
const calcCases = [
  { name: 'QĐ 2699, VAT 8%', bill: { kwh: 187, period: '2025-04', fromDate: '2025-03-21', toDate: '2025-04-20' },
    lines: [[94650, 97800, 197577]], subtotal: 390027, vat: 31202, total: 421229, estimated: false },
  { name: 'QĐ 1062, VAT 10%', bill: { kwh: 100, period: '2023-06', fromDate: '2023-05-21', toDate: '2023-06-20' },
    lines: [[86400, 89300]], subtotal: 175700, vat: 17570, total: 193270, estimated: false },
  // 21/04–20/05/2025 straddles 10/05/2025: 19 days old price (190 kWh, quotas 32/32/63/63), 11 days new (110 kWh, 18/18/37/37).
  { name: 'vắt qua ngày đổi giá', bill: { kwh: 300, period: '2025-05', fromDate: '2025-04-21', toDate: '2025-05-20' },
    lines: [[60576, 62592, 143073, 180180], [35712, 36900, 88060, 110926]], segKwh: [190, 110], segDays: [19, 11],
    segSubtotal: [446421, 271598], subtotal: 718019, vat: 57442, total: 775461, estimated: true },
  { name: 'trước biểu giá đầu tiên', bill: { kwh: 100, period: '2023-03', fromDate: null, toDate: null }, noTariff: true },
  // Starts before the first tariff on file (04/05/2023) but ends after it: priced whole at the end date's tariff, flagged estimated.
  { name: 'từ ngày trước biểu giá đầu', bill: { kwh: 100, period: '2023-05', fromDate: '2023-04-11', toDate: '2023-05-10' },
    lines: [[86400, 89300]], subtotal: 175700, vat: 17570, total: 193270, estimated: true },
  // Reading dates more than a month away from the period are ignored (period decides): QĐ 1279, not QĐ 2941 (which would give 432.324).
  { name: 'ngày lệch kỳ bị bỏ qua', bill: { kwh: 200, period: '2026-07', fromDate: '2024-01-01', toDate: '2024-01-31' },
    lines: [[99200, 102500, 238000]], subtotal: 439700, vat: 35176, total: 474876, estimated: false }
];

// kwhFromAmount({amount, period}) → kWh whose bill is closest to the amount. [amount, period, kwh, exact, calcTotal, diff]
const amountCases = [
  [1388405, '2026-09', 461, true, 1388405, 0],     // 1.074.500 + 61×3.460 = 1.285.560; VAT 102.845
  [107136, '2026-09', 50, true, 107136, 0],
  [217836, '2026-09', 100, true, 217836, 0],
  [1952662, '2026-09', 612, true, 1952662, 0],
  [990000, '2026-09', 353, false, 990414, -414],   // 352 kWh = 986.796 is further away
  [0, '2026-09', 0, true, 0, 0],
  [1000, '2026-09', 0, false, 0, 1000],            // 1 kWh = 2.143, 0 is nearer
  [421229, '2025-03', 187, true, 421229, 0],       // QĐ 2699 (end of 03/2025)
  [193270, '2023-06', 100, true, 193270, 0],       // QĐ 1062, VAT 10%
  [500000, '2023-03', null, false, null, null]     // no tariff
];
// UI scenario from an empty app: add 2026-09 with 1.388.405, then 2026-08 with 990.000 (both by "Số tiền").
const amountFlow = {
  first: { inferKwh: '≈ 461 kWh', note: 'Khớp chính xác biểu giá', saved: { period: '2026-09', kwh: 461, amount: 1388405, source: 'amount', kwhInferred: true },
    money: '1.388.405 đ', kwh: '≈461 kWh', perKwh: '≈3.012 đ/kWh' },      // 1.388.405 / 461 = 3.011,7
  second: { inferKwh: '≈ 353 kWh', note: 'Gần nhất: 353 kWh (990.414 đ), lệch −414 đ' },
  prev: { money: '▲398.405 đ (+40,24%)', kwh: '▲108 kWh (+30,59%)' }
};

// Overview scenario, place "Nhà", now.main.
const bill = (id, period, kwh, amount, extra) => Object.assign({ id, placeId: 'p1', period, fromDate: null, toDate: null,
  oldIndex: null, newIndex: null, kwh, amount, source: 'kwh', note: '', createdAt: 1, updatedAt: 1 }, extra || {});
const bills = [
  bill('b1', '2025-04', 187, null, { fromDate: '2025-03-21', toDate: '2025-04-20' }),
  bill('b2', '2025-05', 300, 775461, { fromDate: '2025-04-21', toDate: '2025-05-20' }),
  bill('b3', '2025-09', 350, 979560),
  bill('b4', '2026-08', 612, 1952662, { oldIndex: 12000, newIndex: 12612, source: 'index' }),
  bill('b5', '2026-09', 350, 990000)
];
const data = { version: 1, places: [{ id: 'p1', name: 'Nhà', customerCode: '' }], bills };

const expected = {
  title: 'Tiền điện tháng 9/2026',
  money: '990.000 đ', badge: 'Theo hoá đơn',
  kwh: '350 kWh', perKwh: '2.829 đ/kWh', perDay: '≈11,67 kWh/ngày',
  prev: { money: '▼962.662 đ (−49,30%)', kwh: '▼262 kWh (−42,81%)' },      // vs 8/2026
  yoy: { money: '▲10.440 đ (+1,07%)', kwh: 'không đổi' },                  // vs 9/2025
  year: '2.942.662 đ · 962 kWh',                                           // 2026
  chartBars: 2,                                                            // 10/2025–9/2026
  rows: {
    b5: { amount: '990.000 đ', badge: 'Theo hoá đơn', cmp: 'Lệch +10.440 đ so với biểu giá' },
    b2: { amount: '775.461 đ', badge: 'Theo hoá đơn', cmp: 'Khớp biểu giá' },
    b1: { amount: '421.229 đ', badge: 'Ước tính', cmp: '' }
  }
};

// Made-up notices (fake customer code). Every variant must give `pasteExpected`;
// the deadline, the customer code and the phone number must not land anywhere.
const pasteExpected = { period: '2026-09', fromDate: '2026-08-21', toDate: '2026-09-20', oldIndex: 12612, newIndex: 12962, kwh: 350, amount: 990000 };
const paste = [
  'Ma KH PP01000123456, ky thang 09/2026 tu 21/08/2026 den 20/09/2026. CS cu 12612, CS moi 12962, dien tieu thu 350 kWh. Tien dien 990.000 dong. Han thanh toan 27/09/2026.',
  'Mã KH: PP01000123456. Kỳ hoá đơn tháng 09/2026 (từ ngày 21/08/2026 đến ngày 20/09/2026). Chỉ số cũ: 12.612; chỉ số mới: 12.962. Điện tiêu thụ: 350 kWh. Tổng tiền thanh toán: 990.000 đ. Hạn thanh toán: 27/09/2026. Tổng đài 19009000.',
  'EVN: Tiền điện T9/2026 của KH PP01000123456 là 990.000đ. Tiêu thụ 350kWh (CS mới 12962 - CS cũ 12612), từ 21/08/2026 - 20/09/2026. Thanh toán trước 27/09/2026. LH 19001909.'
];
// Harder notices: [text, fields that must come out (others not checked unless listed)].
const pasteMore = [
  // old debt: this period's amount wins over the total to pay
  ['Tiền điện T9: 990.000đ. Nợ cũ: 500.000đ. Tổng tiền phải thanh toán: 1.490.000đ', { amount: 990000 }],
  ['SO TIEN 990.000D. NO CU 150.000D. TONG PHAI TRA 1.140.000D', { amount: 990000 }],
  ['Dien thang 9: tieu thu 350 kWh. Tong tien phai thanh toan: 990.000d', { amount: 990000, kwh: 350 }],
  // pre-VAT + VAT + total, no debt: the total
  ['Tien dien 916.667 d, thue GTGT 73.333 d, tong cong 990.000 d. Tieu thu 350 kWh', { amount: 990000, kwh: 350 }],
  // a payment window is not the reading period
  ['Tien dien thang 09/2026: 990.000 dong. Thoi gian thanh toan tu 21/09/2026 den 27/09/2026', { period: '2026-09', fromDate: null, toDate: null, amount: 990000 }],
  // tier lines repeat "N kWh": not the month's total
  ['Bậc 1: 50 kWh. Bậc 2: 50 kWh. Tiền điện 217.836 đ', { kwh: null, amount: 217836 }],
  // e-wallet receipt (made up): only the payment period and the money
  ['Thanh toan tien dien thanh cong. Ky thanh toan 09/2026. So tien 1.388.405 d. Ma giao dich 88001234567', { period: '2026-09', amount: 1388405, kwh: null, oldIndex: null, fromDate: null }],
  // a house number followed by "Đ." is not money
  ['Khach hang tai so 12 Đ. Le Loi, dien tieu thu 350 kWh', { kwh: 350, amount: null }]
];
const pasteGarbage = ['', 'xin chao 123 abc 4567890', 'Chuyen khoan 500.000 d cho Lan truoc 27/09/2026, sdt 0905123456'];

const sel = {
  tab: name => '.tabbar-btn[data-tab="' + name + '"]',     // overview | bills | tariff | settings
  ov: { title: '#ovTitle', money: '#ovMoney', badge: '#ovBadge', kwh: '#ovKwh', perKwh: '#ovPerKwh', perDay: '#ovPerDay',
    prevMoney: '#ovPrev .chip[data-k="money"]', prevKwh: '#ovPrev .chip[data-k="kwh"]',
    yoyMoney: '#ovYoY .chip[data-k="money"]', yoyKwh: '#ovYoY .chip[data-k="kwh"]', year: '#ovYear .sum-v',
    empty: '#ovEmpty', addFirst: '#btnAddFirst', chartBars: '#chart rect.bar', chartSeg: mode => '#chartSeg button[data-mode="' + mode + '"]',
    chartHit: period => '#chart rect.hit[data-period="' + period + '"]', chartValue: '#chartValue' },
  addBill: '#btnAddBill',
  billRow: id => '.bill-row[data-bill="' + id + '"]',
  form: { sheet: '#billSheet', mode: m => '#fModeSeg button[data-mode="' + m + '"]',   // amount (default) | kwh | index | paste
    inferKwh: '#fInferKwh', inferNote: '#fInferNote', amountLabel: '#fAmountLabel', place: id => '#fPlaceSeg button[data-place="' + id + '"]',
    period: '#fPeriod', old: '#fOld', neu: '#fNew', kwh: '#fKwh', paste: '#fPaste', pasteFill: '#btnPasteFill', pasteMsg: '#fPasteMsg',
    amount: '#fAmount', from: '#fFrom', to: '#fTo', note: '#fNote', more: '#fMore', calc: '#fCalc', calcTotal: '#fCalcTotal',
    save: '#btnBillSave', del: '#btnBillDelete',
    err: { period: '#fPeriodErr', idx: '#fIdxErr', kwh: '#fKwhErr', amount: '#fAmountErr', date: '#fDateErr', paste: '#fPasteErr', form: '#billError' } },
  confirmOk: '#confirmOk', confirmCancel: '#confirmCancel', confirmError: '#confirmError',
  toast: '#toast', toastAction: '#toastAction',
  tariff: { table: '#tariffTable', meta: '#tariffMeta', kwh: '#calcKwh', lines: '#calcLines .calc-line', subtotal: '#calcSubtotal', vat: '#calcVat', total: '#calcTotal',
    history: '#tariffHist', notice: '#tariffNotice', retry: '#tariffTable [data-retry]' },
  settings: { places: '#placeList', addPlace: '#btnAddPlace', backup: '#btnBackup', restore: '#btnRestore', restoreInput: '#restoreFile',
    backupError: '#backupError', backupLast: '#backupLast', version: '#btnVersion', diag: '#diagLine' },
  broken: '#brokenBanner'
};

module.exports = {
  path, tariff, mocks, now, calculator, lines612, calcCases, amountCases, amountFlow, bills, data, expected, paste, pasteExpected, pasteMore, pasteGarbage, sel,
  localStorage: { powertrack_v1: data }
};
