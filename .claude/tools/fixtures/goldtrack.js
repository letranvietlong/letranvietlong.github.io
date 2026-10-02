// Standard GoldTrack test scenario with hand-computed expectations.
// Pair with harness.open({ now: gt.now, mocks: gt.mocks, localStorage: gt.localStorage }).
//
// Data shapes (the real bot-written files follow the same shape):
//   data/gold-price.json         { <shop>: { name, sourceUrl, fetchedAt, unit:'chi', types: { <typeId>: { label, buy, sell } } } }
//   data/gold-price-history.json { <shop>: { <typeId>: [ { buy, sell, at } ... ] } }
//   localStorage goldtrack_v1    { transactions: [ { id, type:'buy'|'sell', amount (chỉ), price (đ/chỉ), date 'YYYY-MM-DD',
//                                   shop:'ngoc-thinh'|'huy-thanh'|'khac', goldType, address, note, createdAt,
//                                   owner?:'Viết Long'|'Minh Thư' (v1.59+; missing = 'Viết Long') } ] }
//   localStorage goldtrack_owner_filter_v1  'Viết Long' | 'Minh Thư' (absent/other = Tất cả) — header filter, per device
// `buy` = the shop's buying price (what the user receives when selling) — used for valuation.
//
// Scenario: buy 2 chỉ @13.100.000 on 20/09, sell 1 chỉ @13.300.000 on 23/09.
// History 20/09 13.000.000 · 22/09 13.200.000 · 24/09 13.100.000; live price
// today (27/09) 13.150.000 — deliberately DIFFERENT from the last history point,
// so a test also proves "today uses the live price".

const now = '2026-09-27T10:00:00+07:00';

const price = {
  'ngoc-thinh': { name: 'Ngọc Thịnh Jewelry', sourceUrl: 'test', fetchedAt: '2026-09-27T03:00:00+00:00', unit: 'chi',
    types: { '9999-nhan-tron': { label: 'Vàng 9999 (nhẫn tròn)', buy: 13150000, sell: 13250000 } } },
  'huy-thanh': { name: 'Huy Thanh Jewelry', sourceUrl: 'test', fetchedAt: '2026-09-27T03:00:00+00:00', unit: 'chi',
    types: { '24k-huy-thanh': { label: 'Vàng Huy Thanh 24k', buy: 14140000, sell: 14520000 } } }
};

const history = {
  'ngoc-thinh': { '9999-nhan-tron': [
    { buy: 13000000, sell: 13100000, at: '2026-09-20T03:00:00+00:00' },
    { buy: 13200000, sell: 13300000, at: '2026-09-22T03:00:00+00:00' },
    { buy: 13100000, sell: 13200000, at: '2026-09-24T03:00:00+00:00' }
  ] },
  'huy-thanh': { '24k-huy-thanh': [
    { buy: 14150000, sell: 14530000, at: '2026-09-26T03:00:00+00:00' },
    { buy: 14140000, sell: 14520000, at: '2026-09-27T03:00:00+00:00' }
  ] }
};

const tx = (id, type, amount, price, date, createdAt) => ({ id, type, amount, price, date, shop: 'ngoc-thinh', goldType: '9999-nhan-tron', address: '', note: '', createdAt });
const transactions = [
  tx('b1', 'buy', 2, 13100000, '2026-09-20', 1),
  tx('s1', 'sell', 1, 13300000, '2026-09-23', 2)
];

// Hand-computed. Held after the sell: 1 chỉ, cost 13.100.000.
const expected = {
  realizedPL: 200000,                 // 1 × (13.300.000 − 13.100.000)
  unrealizedPL: 50000,                // 1 × 13.150.000 − 13.100.000
  totalPL: 250000,                    // Overview "Tổng lãi/lỗ"
  holdingCost: 13100000,              // "Tổng vốn hiện tại"
  currentValue: 13150000,             // "Giá trị hiện tại"
  dailyCells: { 20: '-200k', 21: '0', 22: '+400k', 23: '+100k', 24: '-100k', 25: '0', 26: '0', 27: '+50k' },
  detail23: 'Ngày 23/09/2026: +100.000 đ (đã chốt +200.000 đ)',
  monthTotal: '+250.000 đ',           // must equal totalPL
  monthRow: 'Tháng 9/2026 +200.000 đ',          // "Theo tháng" = realized only
  unrealizedRow: 'Chưa chốt (theo giá hôm nay) +50.000 đ'
};

// Selectors that tests keep needing.
const sel = {
  overviewTotal: '#summaryContent .pl-amount',
  overviewRows: '#summaryContent .summary-row',
  pnlModes: '#pnlGroupBy button',                 // data-group = day | month | year
  pnlActive: '#pnlGroupBy button.active',
  pnlContent: '#pnlReportContent',
  calDay: n => '[data-cal-day="2026-09-' + String(n).padStart(2, '0') + '"]',
  calDetail: '.pnl-cal-detail',
  tab: name => '.tabbar-btn[data-tab="' + name + '"]',   // overview | prices | history | settings
  storeSummary: '#storeSummary',
  txRow: id => '.tx-item[data-id="' + id + '"]',
  addTx: '#fabAdd',
  diag: '#displayDiag'
};

module.exports = {
  now, price, history, transactions, expected, sel,
  mocks: { 'data/gold-price.json': price, 'data/gold-price-history.json': history },
  localStorage: { goldtrack_v1: { transactions } }
};
