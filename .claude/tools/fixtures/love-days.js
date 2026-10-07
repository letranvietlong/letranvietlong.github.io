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

// Milestones tab at `now`, in display order. Upcoming card = first row.
const milestoneRows = [
  'Ngày gặp nhau | 05/10/2026 | còn 3 ngày',
  'Sinh nhật Minh Thư | 15/10/2026 | còn 13 ngày',      // currently 25 tuổi, turning 26
  'Ngày thứ 1.000 | 09/11/2026 | còn 38 ngày',          // wrong convention → 10/11, 39
  'Du lịch Đà Lạt | 24/12/2026 | còn 83 ngày',
  'Kỷ niệm 3 năm | 14/02/2027 | còn 135 ngày',
  'Sinh nhật Viết Long | 20/05/2027 | còn 230 ngày',    // currently 28 tuổi
  'Lần đầu tặng hoa | 08/03/2024 | đã qua 938 ngày'
];
const birthdays = { long: { age: '28 tuổi', left: 'còn 230 ngày' }, thu: { age: '25 tuổi', left: 'còn 13 ngày' } };
// start 2024-02-29 → anniversary on 28/02 in non-leap years.
const leap = { startDate: '2024-02-29', row: 'Kỷ niệm 3 năm | 28/02/2027 | còn 149 ngày' };

const sel = {
  tab: name => '.tabbar-btn[data-tab="' + name + '"]',    // home | milestones | album | settings
  dayCount: '#dayCount', hours: '#hoursCount', clock: '#liveClock',
  upcoming: '#upcomingBody', birthdays: '#birthdays .bday-card',
  milestoneRows: '#milestoneList .ms-item',               // title .ms-title, date+tag .ms-sub, right .ms-left
  addMilestone: '#btnAddMilestone',
  setupView: '#setupView', setupStart: '#setupStart', setupError: '#setupError',
  banners: '#banners .banner',
  avatarLongImg: '#avatarLong img', avatarThuImg: '#avatarThu img', coverImg: '#coverImg',
  fileAvatarLong: '#fileAvatarLong', fileAvatarThu: '#fileAvatarThu', fileCover: '#fileCover',
  diag: '#diagLine', version: '#btnVersion',
  // Album: tiles carry data-id; .album-thumb opens the viewer (aria-label "Ảnh N, chụp dd/mm/yyyy").
  fileAlbum: '#fileAlbum', albumGrid: '#albumGrid', albumTiles: '#albumGrid .album-tile', albumSub: '#albumSub',
  albumProgress: '#albumProgress', albumError: '#albumError', sort: k => '[data-sort="' + k + '"]', // taken | added | custom
  arrange: '#btnArrange', viewer: '#viewer', viewerCount: '#viewerCount', viewerCaption: '#viewerCaption',
  viewerDelete: '#viewerDelete', viewerClose: '#viewerClose',
  // Backup: prepare → save (download in Chromium); import opens #importSheet, buttons [data-imp=run|mode-replace|prep|save|close].
  prepare: '#btnPrepare', saveBackup: '#btnSaveBackup', fileImport: '#fileImport', fileImportSetup: '#fileImportSetup',
  importContent: '#importContent', backupLast: '#backupLast'
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

module.exports = { path, now, profile, milestones, dayCountTable, rollover, edges, milestoneRows, birthdays, leap, sel, seed, seedPhotos, badgeStubScript };
