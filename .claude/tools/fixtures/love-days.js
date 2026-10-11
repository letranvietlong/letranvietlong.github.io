// Standard LoveDays test scenario with hand-computed expectations.
// LoveDays keeps everything in IndexedDB (DB "love-days", version 1), which the
// harness can't seed — open the page, call seed(page, ...), then reload:
//   const s = await h.open({ path: ld.path, now: ld.now });
//   await ld.seed(s.page, { profile: ld.profile, milestones: ld.milestones });
//   await s.page.reload({ waitUntil: 'networkidle' });
//
// Stores (see products/love-days/js/love-days-core.js upgrade()):
//   kv         keyPath key   — { key:'profile', startDate:'YYYY-MM-DD', persons:[{id:'long',name,dob|null},{id:'thu',name,dob|null}],
//                                hasCover:bool, activeGen:'g1', updatedAt }
//   milestones keyPath id    — { id, title, date:'YYYY-MM-DD', emoji, note, repeatYearly:bool, createdAt }
//   photos     keyPath id    — album metadata { id, gen, caption, takenAt:ms|null, addedAt:ms, order, w, h, bytes, sha256 }
//   blobs      keyPath id    — { id:'avatar-long'|'avatar-thu'|'cover'|<photoId>, gen, mime:'image/jpeg', data:ArrayBuffer, thumb:ArrayBuffer|null }
//   kv 'meta'                — { key:'meta', schemaVersion:1, lastBackupAt:ms|null, albumSort:'taken'|'added'|'custom' }
//
// Day-count convention: start day = day 1, always UTC+7 regardless of the
// device timezone. Breakdown = time elapsed since 00:00 (+07) of the start day.

const path = '/products/love-days/html/index.html';
const now = '2026-10-02T21:30:00+07:00';

const profile = {
  key: 'profile', startDate: '2024-02-14',
  persons: [{ id: 'long', name: 'Viết Long', dob: '1998-05-20' }, { id: 'thu', name: 'Minh Thư', dob: '2000-10-15' }],
  hasCover: false, activeGen: 'g1', updatedAt: 1
};
const milestones = [
  { id: 'm-gap', title: 'Ngày gặp nhau', date: '2023-10-05', emoji: '💗', note: '', repeatYearly: true, createdAt: 1 },
  { id: 'm-dalat', title: 'Du lịch Đà Lạt', date: '2026-12-24', emoji: '✈️', note: '', repeatYearly: false, createdAt: 2 },
  { id: 'm-hoa', title: 'Lần đầu tặng hoa', date: '2024-03-08', emoji: '💐', note: '', repeatYearly: false, createdAt: 3 }
];

// Rows: `now` is +07 wall time; timezoneId is the DEVICE timezone (harness option).
// "wrong" = what code reading the device timezone would show.
const dayCountTable = [
  { now: '2026-10-02T21:30:00+07:00', timezoneId: 'Asia/Ho_Chi_Minh', n: '962', hours: '23.085', clock: '2 năm 7 tháng 18 ngày · 21:30:00' },
  { now: '2026-10-02T08:00:00+07:00', timezoneId: 'America/Bogota', n: '962', hours: '23.072', clock: '2 năm 7 tháng 18 ngày · 08:00:00', wrong: 'N=961, 23.060' },
  { now: '2026-10-02T23:30:00+07:00', timezoneId: 'Asia/Tokyo', n: '962', hours: '23.087', clock: '2 năm 7 tháng 18 ngày · 23:30:00', wrong: 'N=963, 23.089' }
];
// setFixedTime(before) → load → setFixedTime(after) → wait 1.2s → N and badge roll over.
const rollover = { before: '2026-10-02T23:59:59+07:00', after: '2026-10-03T00:00:01+07:00',
  n: ['962', '963'], hours: ['23.087', '23.088'], badge: 963 };

const edges = [
  { startDate: '2026-10-02', now, n: '1', hours: '21', clock: '0 năm 0 tháng 0 ngày · 21:30:00' },
  { startDate: '2026-10-03', now, blocked: 'Ngày bắt đầu không được sau hôm nay.' },
  { startDate: '2026-01-31', now: '2026-03-01T12:00:00+07:00', n: '30', clock: '0 năm 1 tháng 1 ngày · 12:00:00' }
];

// Milestones tab at `now`, in display order (= each .ms-item's aria-label;
// visibly the row shows only the big number + "ngày"). The first 6 sit under
// the "Sắp tới" group title, the last under "Đã qua". Upcoming card = first row.
const milestoneRows = [
  'Ngày gặp nhau, 05/10/2026, còn 3 ngày',             // .ms-sub "05/10/2026 · lần thứ 3" (repeat yearly from 2023)
  'Sinh nhật Minh Thư, 15/10/2026, còn 13 ngày',       // .ms-sub "… · tròn 26 tuổi"
  'Ngày thứ 1.000, 09/11/2026, còn 38 ngày',           // wrong convention → 10/11, 39
  'Du lịch Đà Lạt, 24/12/2026, còn 83 ngày',
  'Kỷ niệm 3 năm, 14/02/2027, còn 135 ngày',
  'Sinh nhật Viết Long, 20/05/2027, còn 230 ngày',     // .ms-sub "… · tròn 29 tuổi"
  'Lần đầu tặng hoa, 08/03/2024, đã qua 938 ngày'
];
// Home birthday tiles: big number (.bday-num) + .bday-meta. No current age shown.
const birthdays = { long: { left: '230', meta: '20/05 · tròn 29 tuổi' }, thu: { left: '13', meta: '15/10 · tròn 26 tuổi' } };
// Home progress chip toward the next multiple of 100 (#goalText, #goalFill transform).
const goal = [
  { startDate: '2024-02-14', text: '38 ngày nữa → 1.000', scale: 0.62 },
  { startDate: '2026-10-02', text: '99 ngày nữa → 100', scale: 0.01 },
  { startDate: '2024-01-07', text: 'Hôm nay tròn 1.000 ngày 🎉', scale: 1 }
];
// start 2024-02-29 → anniversary on 28/02 in non-leap years.
const leap = { startDate: '2024-02-29', row: 'Kỷ niệm 3 năm, 28/02/2027, còn 149 ngày' };

const sel = {
  tab: name => '.tabbar-btn[data-tab="' + name + '"]',    // home | milestones | album | settings
  dayCount: '#dayCount', hours: '#hoursCount', clock: '#liveClock',
  upcoming: '#upcomingBody', birthdays: '#birthdays .bday-card',
  milestoneRows: '#milestoneList .ms-item',               // aria-label = milestoneRows; .ms-title, .ms-sub, .ms-left (.ms-num + .ms-unit); editable rows are <button> with .ms-chev
  goalText: '#goalText', goalFill: '#goalFill', countInfo: '#btnCountInfo', toast: '#toast',
  addMilestone: '#btnAddMilestone',
  setupView: '#setupView', setupStart: '#setupStart', setupError: '#setupError',
  banners: '#banners .banner',
  avatarLongImg: '#avatarLong img', avatarThuImg: '#avatarThu img', coverImg: '#coverImg',
  fileAvatarLong: '#fileAvatarLong', fileAvatarThu: '#fileAvatarThu', fileCover: '#fileCover',
  diag: '#diagLine', version: '#btnVersion',             // #diagLine sits in a closed <details>: read textContent, not innerText
  // Album: tiles carry data-id; .album-thumb opens the viewer (aria-label "Ảnh N, chụp dd/mm/yyyy").
  fileAlbum: '#fileAlbum', albumGrid: '#albumGrid', albumTiles: '#albumGrid .album-tile', albumSub: '#albumSub',
  albumProgress: '#albumProgress', albumError: '#albumError', sort: k => '[data-sort="' + k + '"]', // taken | added | custom
  arrange: '#btnArrange', viewer: '#viewer', viewerCount: '#viewerCount', viewerCaption: '#viewerCaption',
  viewerDelete: '#viewerDelete', viewerClose: '#viewerClose',
  // Backup: prepare → save (download in Chromium); import opens #importSheet, buttons [data-imp=run|mode-replace|prep|save|close].
  prepare: '#btnPrepare', saveBackup: '#btnSaveBackup', fileImport: '#fileImport', fileImportSetup: '#fileImportSetup',
  importContent: '#importContent', backupLast: '#backupLast'
};

// ---------- Chu kỳ (v1.8) ----------
// kv 'cycles' — { key:'cycles', items:[{ id, start:'YYYY-MM-DD', end:'YYYY-MM-DD'|null, note:'', createdAt }], updatedAt }
// updatedAt doubles as the "did another window write since I loaded" stamp: a save is refused when it changed.
// A cycle without an end date holds start..start+9 (openOverlap); a repeated id in the stored list is treated as a broken item.
// After a successful write the card and the sheet ignore taps for 400ms — wait ≥500ms before the next click.
// Seed: ld.seed(page, { profile: ld.profile, extra: [['kv', ld.cyclesRecord(ld.cycles.S1.items)]] })
// Gap = days between consecutive starts; valid 15..90 (60 before v1.10); average = latest 6 VALID gaps;
// next = last start + round-half-up(average); no valid gap → 28.
// Card: status sentence is in #cycleOpen's aria-label (visible: big number + unit, or the
// "Trễ N ngày" badge); the sheet shows it as a .status-tag next to "Kỳ tới dự kiến".
const cy = (start, end, id) => ({ id: id || 'c' + start.replace(/-/g, ''), start, end: end === undefined ? null : end, note: '', createdAt: 1 });
const fiveDays = starts => starts.map(s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 4); return cy(s, d.toISOString().slice(0, 10)); });
const cyclesRecord = items => ({ key: 'cycles', items, updatedAt: 1 });
const cycleNow = '2026-10-11T12:00:00+07:00'; // Chủ nhật
const S1items = [cy('2026-06-03', '2026-06-07'), cy('2026-07-01', '2026-07-05'), cy('2026-07-30', '2026-08-04'), cy('2026-08-27', '2026-08-31'), cy('2026-09-25', '2026-09-29')];
const cycles = {
  // gaps 28, 29, 28, 29 → 28,5 → 29 → next 24/10/2026 (Thứ bảy); lengths 5,5,6,5,5 → 5,2
  S1: { items: S1items, avg: '28,5 ngày', n: 4, next: '2026-10-24', len: '5,2 ngày',
    byNow: [
      ['2026-10-11T12:00:00+07:00', 'Còn 13 ngày'], ['2026-09-29T12:00:00+07:00', 'Ngày thứ 5 của kỳ'],
      ['2026-09-30T12:00:00+07:00', 'Còn 24 ngày'], ['2026-10-24T12:00:00+07:00', 'Dự kiến hôm nay'],
      ['2026-10-27T12:00:00+07:00', 'Trễ 3 ngày'], ['2026-11-24T12:00:00+07:00', 'Trễ 31 ngày'],
      ['2026-11-25T12:00:00+07:00', 'Đã 61 ngày từ kỳ gần nhất']
    ] },
  // last cycle still open: day ≤ 10 counts as ongoing ("Kết thúc hôm nay"), day 11 does not.
  S1b: { items: S1items.slice(0, 4).concat([cy('2026-09-25', null)]),
    byNow: [['2026-09-27T12:00:00+07:00', 'Ngày thứ 3 của kỳ', 'Kết thúc hôm nay'], ['2026-10-04T12:00:00+07:00', 'Ngày thứ 10 của kỳ', 'Kết thúc hôm nay'],
            ['2026-10-05T12:00:00+07:00', 'Còn 19 ngày', 'Bắt đầu hôm nay']] },
  // S1 + "Bắt đầu hôm nay" at cycleNow: gap 16 → (28+29+28+29+16)/5 = 26 → next 06/11/2026; then "Kết thúc hôm nay" → lengths +1 → 27/6 = 4,5
  S1c: { avg: '26 ngày', n: 5, next: '2026-11-06', status: 'Ngày thứ 1 của kỳ', lenAfterEnd: '4,5 ngày' },
  // gaps 28, 70 (unusual, excluded), 28, 29 → 85/3 = 28,3 → 28 → next 31/10
  S2: { items: [cy('2026-05-01', '2026-05-05'), cy('2026-05-29', '2026-06-02'), cy('2026-08-07', '2026-08-11'), cy('2026-09-04', '2026-09-08'), cy('2026-10-03', '2026-10-07')],
    avg: '28,3 ngày', n: 3, next: '2026-10-31', status: 'Còn 20 ngày', unusual: '70 ngày · không tính trung bình' },
  // 8 gaps: 35, 35, 28 ×6 → only the latest 6 count → 28 → next 29/10
  S3: { items: fiveDays(['2026-02-05', '2026-03-12', '2026-04-16', '2026-05-14', '2026-06-11', '2026-07-09', '2026-08-06', '2026-09-03', '2026-10-01']),
    avg: '28 ngày', n: 6, next: '2026-10-29', status: 'Còn 18 ngày' },
  // gaps 34, 28, 28, 70, 28, 28, 28 → filter first, THEN latest 6: (34+28×5)/6 = 29 → next 30/10.
  // (Taking the latest 6 first and filtering after would give 28 → 29/10.)
  S3b: { items: fiveDays(['2026-01-30', '2026-03-05', '2026-04-02', '2026-04-30', '2026-07-09', '2026-08-06', '2026-09-03', '2026-10-01']),
    avg: '29 ngày', n: 6, next: '2026-10-30', status: 'Còn 19 ngày' },
  // one cycle → default 28 → next 23/10
  S4: { items: [cy('2026-09-25', '2026-09-29')], next: '2026-10-23', status: 'Còn 12 ngày', note: 'Ước tính theo 28 ngày', avgText: 'Cần ít nhất 2 kỳ' },
  // across New Year, now = 2027-01-12T12:00+07: gap 29 → next 04/02/2027
  S6: { now: '2027-01-12T12:00:00+07:00', items: [cy('2026-12-08', '2026-12-12'), cy('2027-01-06', '2027-01-10')], avg: '29 ngày', n: 1, next: '2027-02-04', status: 'Còn 23 ngày' }
};
// v1.10: the log lives on its own tab (#tab-cycle, tabbar button [data-tab="cycle"]); #cycleSheet holds only the add/edit form.
// CYCLE_MAX is 90 since v1.10, so a 70-day gap now COUNTS toward the average (S2/S3b expectations written for 60 no longer hold).
const cycleSel = {
  tab: '.tabbar-btn[data-tab="cycle"]', view: '#tab-cycle', quickTab: '#cycleList [data-cy="quick"]', tabErr: '#cycleTabErr', chart: '#cycleList .cycle-chart',
  card: '#cycleCard', open: '#cycleOpen', quick: '#cycleQuick', addPast: '#cycleAddPast', cardErr: '#cycleCardErr',
  sheet: '#cycleSheet', list: '#cycleList', stats: '#cycleList .cycle-stat', rows: '#cycleList [data-cy-id]', add: '#cycleList [data-cy="add"]',
  form: '#cycleForm', start: '#cyStart', end: '#cyEnd', note: '#cyNote', startErr: '#cyStartErr', endErr: '#cyEndErr',
  save: '#cycleSave', del: '#cycleDelete', confirm: '#cycleConfirm', confirmYes: '#cycleConfirmYes', confirmNo: '#cycleConfirmNo',
  show: '#cycleShow', book: '#btnCycleBook'
};

// Replaces every store's content. blobs: { id: base64 } (ArrayBuffers can't
// cross page.evaluate). raw: true stores records as-is (for corrupt-data tests).
async function seed(page, data) {
  await page.evaluate(async d => {
    const db = await LoveCore.openDb();
    const tx = db.transaction(['kv', 'milestones', 'photos', 'blobs'], 'readwrite');
    ['kv', 'milestones', 'photos', 'blobs'].forEach(s => tx.objectStore(s).clear());
    if (d.profile) tx.objectStore('kv').put(d.profile);
    (d.milestones || []).forEach(m => tx.objectStore('milestones').put(m));
    for (const [id, b64] of Object.entries(d.blobs || {})) {
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      tx.objectStore('blobs').put({ id, gen: (d.profile && d.profile.activeGen) || 'g1', mime: 'image/jpeg', data: u8.buffer, thumb: null });
    }
    (d.extra || []).forEach(([store, rec]) => tx.objectStore(store).put(rec));
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, data);
}

// Adds n album photos (canvas-generated JPEGs numbered 1..n, takenAt one day
// apart from 2024-02-14 so "Ngày chụp" order = number). Call after seed().
async function seedPhotos(page, n) {
  await page.evaluate(async n => {
    const db = await LoveCore.openDb();
    const enc = (c, q) => new Promise(r => c.toBlob(b => b.arrayBuffer().then(r), 'image/jpeg', q));
    for (let i = 1; i <= n; i++) {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 900;
      const g = c.getContext('2d');
      g.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,62%)'; g.fillRect(0, 0, 1200, 900);
      g.fillStyle = '#fff'; g.font = 'bold 360px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i), 600, 470);
      const data = await enc(c, 0.82);
      const t = document.createElement('canvas'); t.width = 480; t.height = 360; t.getContext('2d').drawImage(c, 0, 0, 480, 360);
      const thumb = await enc(t, 0.75);
      const id = 'seed' + String(i).padStart(3, '0');
      const tx = db.transaction(['photos', 'blobs'], 'readwrite');
      tx.objectStore('blobs').put({ id, gen: 'g1', mime: 'image/jpeg', data, thumb });
      tx.objectStore('photos').put({ id, gen: 'g1', caption: '', takenAt: Date.UTC(2024, 1, 14 + i, 3), addedAt: 1e12 + i, order: i - 1,
        w: 1200, h: 900, bytes: data.byteLength, sha256: await LoveMedia.sha256(data) });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    }
    db.close();
  }, n);
}

// Records navigator.setAppBadge calls in window.__badges and pretends
// notifications were granted. Use with context.addInitScript before load.
function badgeStubScript() {
  window.__badges = [];
  navigator.setAppBadge = n => { window.__badges.push(n); return Promise.resolve(); };
  try { Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true }); } catch (e) {}
}

module.exports = { path, now, profile, milestones, dayCountTable, rollover, edges, milestoneRows, birthdays, goal, leap, sel, seed, seedPhotos, badgeStubScript,
  cy, cyclesRecord, cycleNow, cycles, cycleSel };
