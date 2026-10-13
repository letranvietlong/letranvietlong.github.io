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
//   milestones keyPath id    — { id, title, date:'YYYY-MM-DD', emoji, note, repeatYearly:bool, createdAt, photoIds:[album photo id] (v1.13; missing = []) }
//   photos     keyPath id    — album metadata { id, gen, caption, takenAt:ms|null, addedAt:ms, order, w, h, bytes, sha256 }
//   blobs      keyPath id    — { id:'avatar-long'|'avatar-thu'|'cover'|<photoId>, gen, mime:'image/jpeg', data:ArrayBuffer, thumb:ArrayBuffer|null }
//   kv 'meta'                — { key:'meta', schemaVersion:1, lastBackupAt:ms|null, albumSort:'taken'|'added'|'custom', showCycle:bool,
//                                cycleRemind:0|1|2|3|5 (default 2), cycleRemindQuiet:bool (default true) } — per device, never in a backup
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

// Milestones tab at `now`: the "Sắp tới" group in display order (= each .ms-item's aria-label;
// visibly the row shows only the big number + "ngày"). Upcoming card = first row.
// Since v1.13 everything already past sits in "Dòng thời gian" below it — see `timeline`.
const milestoneRows = [
  'Ngày gặp nhau, 05/10/2026, còn 3 ngày',             // .ms-sub "05/10/2026 · lần thứ 3" (repeat yearly from 2023)
  'Sinh nhật Minh Thư, 15/10/2026, còn 13 ngày',       // .ms-sub "… · tròn 26 tuổi"
  'Ngày thứ 1.000, 09/11/2026, còn 38 ngày',           // wrong convention → 10/11, 39
  'Du lịch Đà Lạt, 24/12/2026, còn 83 ngày',
  'Kỷ niệm 3 năm, 14/02/2027, còn 135 ngày',
  'Sinh nhật Viết Long, 20/05/2027, còn 230 ngày'      // .ms-sub "… · tròn 29 tuổi"
];
// "Dòng thời gian" at the same `now` (sel.timelineRows, aria-labels): user milestones whose ORIGINAL date is on or
// before today, newest first, under one <h3 class="group-title tl-year"> per year; a yearly one is listed here at its
// original date AND in "Sắp tới" at its next one. The start day is a plain <div class="ms-item tl-start"> (no aria-label).
const timelineRows = [
  'Lần đầu tặng hoa, Thứ sáu, 08/03/2024, 938 ngày trước',   // year 2024, followed by the "Ngày bắt đầu · Thứ tư, 14/02/2024" row
  'Ngày gặp nhau, Thứ năm, 05/10/2023, 1.093 ngày trước'     // year 2023
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
  tab: name => '.tabbar-btn[data-tab="' + name + '"]',    // home | milestones | cycle | album | settings
  dayCount: '#dayCount', hours: '#hoursCount', clock: '#liveClock',
  upcoming: '#upcomingBody', birthdays: '#birthdays .bday-card',
  milestoneRows: '#milestoneList > .ms-group:first-of-type .ms-item',   // "Sắp tới": aria-label = milestoneRows; .ms-title, .ms-sub, .ms-left (.ms-num + .ms-unit); every row is a <button>: user rows open the edit form, .ms-item.auto rows open #shareSheet (v1.12)
  timelineRows: '#milestoneList .tl-year ~ .ms-group button.ms-item',   // aria-label = timelineRows; tapping opens the edit form
  timelineYears: '#milestoneList .tl-year', timelineStart: '#milestoneList .tl-start', timelineEmpty: '#milestoneList .empty-state',
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
      // "late" lasts until max(90, 2 × cycle length) days after the last start: day 90 is still late, day 91 is not
      ['2026-11-25T12:00:00+07:00', 'Trễ 32 ngày'], ['2026-12-24T12:00:00+07:00', 'Trễ 61 ngày'],
      ['2026-12-25T12:00:00+07:00', 'Đã 91 ngày từ kỳ gần nhất']
    ] },
  // last cycle still open: day ≤ 10 counts as ongoing ("Kết thúc hôm nay"), day 11 does not.
  S1b: { items: S1items.slice(0, 4).concat([cy('2026-09-25', null)]),
    byNow: [['2026-09-27T12:00:00+07:00', 'Ngày thứ 3 của kỳ', 'Kết thúc hôm nay'], ['2026-10-04T12:00:00+07:00', 'Ngày thứ 10 của kỳ', 'Kết thúc hôm nay'],
            ['2026-10-05T12:00:00+07:00', 'Còn 19 ngày', 'Bắt đầu hôm nay']] },
  // S1 + "Bắt đầu hôm nay" at cycleNow: gap 16 → (28+29+28+29+16)/5 = 26 → next 06/11/2026; then "Kết thúc hôm nay" → lengths +1 → 27/6 = 4,5
  S1c: { avg: '26 ngày', n: 5, next: '2026-11-06', status: 'Ngày thứ 1 của kỳ', lenAfterEnd: '4,5 ngày' },
  // gaps 28, 98 (over 90: excluded), 28, 29 → 85/3 = 28,3 → 28 → next 31/10
  S2: { items: [cy('2026-04-03', '2026-04-07'), cy('2026-05-01', '2026-05-05'), cy('2026-08-07', '2026-08-11'), cy('2026-09-04', '2026-09-08'), cy('2026-10-03', '2026-10-07')],
    avg: '28,3 ngày', n: 3, next: '2026-10-31', status: 'Còn 20 ngày', unusual: '98 ngày · không tính trung bình' },
  // 8 gaps: 35, 35, 28 ×6 → only the latest 6 count → 28 → next 29/10
  S3: { items: fiveDays(['2026-02-05', '2026-03-12', '2026-04-16', '2026-05-14', '2026-06-11', '2026-07-09', '2026-08-06', '2026-09-03', '2026-10-01']),
    avg: '28 ngày', n: 6, next: '2026-10-29', status: 'Còn 18 ngày' },
  // gaps 34, 28, 28, 98, 28, 28, 28 → filter first, THEN latest 6: (34+28×5)/6 = 29 → next 30/10.
  // (Taking the latest 6 first and filtering after would give 28 → 29/10.)
  S3b: { items: fiveDays(['2026-01-02', '2026-02-05', '2026-03-05', '2026-04-02', '2026-07-09', '2026-08-06', '2026-09-03', '2026-10-01']),
    avg: '29 ngày', n: 6, next: '2026-10-30', status: 'Còn 19 ngày' },
  // one cycle → default 28 → next 23/10
  S4: { items: [cy('2026-09-25', '2026-09-29')], next: '2026-10-23', status: 'Còn 12 ngày', note: 'Ước tính theo 28 ngày', avgText: 'Cần ít nhất 2 kỳ' },
  // across New Year, now = 2027-01-12T12:00+07: gap 29 → next 04/02/2027
  S6: { now: '2027-01-12T12:00:00+07:00', items: [cy('2026-12-08', '2026-12-12'), cy('2027-01-06', '2027-01-10')], avg: '29 ngày', n: 1, next: '2027-02-04', status: 'Còn 23 ngày' }
};
// v1.10: the log lives on its own tab (#tab-cycle, tabbar button [data-tab="cycle"]); #cycleSheet holds only the add/edit form.
// CYCLE_MAX is 90 since v1.10, so a 70-day gap COUNTS toward the average; S2/S3b use a 98-day gap as their excluded one.
const cycleSel = {
  tab: '.tabbar-btn[data-tab="cycle"]', view: '#tab-cycle', quickTab: '#cycleList [data-cy="quick"]', tabErr: '#cycleTabErr', chart: '#cycleList .cycle-chart',
  card: '#cycleCard', open: '#cycleOpen', quick: '#cycleQuick', addPast: '#cycleAddPast', cardErr: '#cycleCardErr',
  sheet: '#cycleSheet', list: '#cycleList', stats: '#cycleList .cycle-stat', rows: '#cycleList [data-cy-id]', add: '#cycleList [data-cy="add"]',
  form: '#cycleForm', start: '#cyStart', end: '#cyEnd', note: '#cyNote', startErr: '#cyStartErr', endErr: '#cyEndErr',
  save: '#cycleSave', del: '#cycleDelete', confirm: '#cycleConfirm', confirmYes: '#cycleConfirmYes', confirmNo: '#cycleConfirmNo',
  show: '#cycleShow', book: '#btnCycleBook',
  // v1.11 month calendar (inside #cycleList; absent when the stored cycles record is unreadable)
  cal: '#cycleCal', calTitle: '#cycleCal .cal-title', calDays: '#cycleCal [data-cal-day]', calDay: d => '#cycleCal [data-cal-day="' + d + '"]',
  calNav: k => '#cycleCal [data-cal-nav="' + k + '"]',      // prev | next | today (today exists only while another month is on show)
  calInfo: '#calInfo', calInfoText: '#calInfo .cal-info-text', calAddOn: '#calInfo [data-cy="add-on"]', calEndOn: '#calInfo [data-cy="end-on"]',
  // day classes: is-period (recorded) | is-pred | is-range | is-today | is-out (other month); the tapped day has aria-pressed="true"
  // v1.11 reminder settings (Cài đặt → Chu kỳ)
  remindSeg: '#cycleRemindSeg', remind: n => '[data-remind="' + n + '"]', remindQuiet: '#cycleRemindQuiet', remindPreview: '#cycleRemindPreview'
};

// ---------- Lịch tháng + nhắc trước kỳ (v1.11) ----------
// Weeks start on Monday; a month is always 35 or 42 cells. Days are listed as 'MM-DD'.
// v1.15: every .cal-day is ≥ 44×44 at 375px wide (45,28 × 44; was 42,42).
// A: gaps 44, 58, 48, 46, 46 → 48,4 → 48 → next Thứ hai 28/09/2026 ("Trễ 15 ngày" at calNow); range = last + 44 … last + 58.
const threeDays = starts => starts.map(s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 2); return cy(s, d.toISOString().slice(0, 10)); });
const mmdd = (mm, a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(mm + '-' + String(i).padStart(2, '0')); return o; };
const calNow = '2026-10-13T09:00:00+07:00'; // Thứ ba
const calAitems = threeDays(['2025-12-12', '2026-01-25', '2026-03-24', '2026-05-11', '2026-06-26', '2026-08-11']);
const calendar = {
  A: { items: calAitems, avg: '48,4 ngày', next: 'Thứ hai, 28/09/2026', status: 'Trễ 15 ngày', range: '24/09 – 08/10/2026',
    months: {
      '2026-10': { title: 'Tháng 10/2026', cells: 35, first: '2026-09-28', last: '2026-11-01', period: [], pred: ['09-28'], range: mmdd('09', 28, 30).concat(mmdd('10', 1, 8)), today: ['10-13'] },
      '2026-09': { title: 'Tháng 9/2026', cells: 35, first: '2026-08-31', last: '2026-10-04', period: [], pred: ['09-28'], range: mmdd('09', 24, 30).concat(mmdd('10', 1, 4)), today: [] },
      '2026-08': { title: 'Tháng 8/2026', cells: 42, first: '2026-07-27', last: '2026-09-06', period: ['08-11', '08-12', '08-13'], pred: [], range: [], today: [] }
    },
    // [day, #calInfo .cal-info-text, button under it or null]
    taps: [
      ['2026-08-12', 'Kỳ 11/08 – 13/08/2026 · ngày thứ 2', null],
      ['2026-08-20', 'Ngày thứ 10 kể từ kỳ 11/08', 'Ghi kỳ bắt đầu ngày này'],   // → form opens with #cyStart = 2026-08-20
      ['2026-09-28', 'Dự đoán kỳ tới', 'Ghi kỳ bắt đầu ngày này'],
      ['2026-09-25', 'Có thể rơi vào 24/09 – 08/10/2026', 'Ghi kỳ bắt đầu ngày này'],
      ['2026-10-20', 'Chưa tới ngày này', null]
    ],
    maxMonth: 'Tháng 11/2026' },   // month of max(today, range end) + 1
  // A + a cycle started 08/10 with no end: gaps +58 → latest 6 = 44,58,48,46,46,58 = 300 → 50 → next 27/11, range 21/11 – 05/12
  B: { items: calAitems.concat([cy('2026-10-08', null)]), status: 'Ngày thứ 6 của kỳ', avg: '50 ngày', next: 'Thứ sáu, 27/11/2026', range: '21/11 – 05/12/2026',
    period: mmdd('10', 8, 13),                       // up to today, never 14/10
    taps: [['2026-10-10', 'Kỳ 08/10/2026 · ngày thứ 3 · chưa ghi ngày kết thúc', 'Ghi ngày kết thúc ngày này']],
    // past the 10 "ongoing" days only the start day is filled; the end can still be logged from start+1 … start+9
    // (tapping the button opens the form with #cyStart 2026-10-08, #cyEnd 2026-10-10)
    late: { now: '2026-10-18T09:00:00+07:00', period: ['10-08'], taps: [['2026-10-10', 'Ngày thứ 3 kể từ kỳ 08/10', 'Ghi ngày kết thúc ngày này']] },
    maxMonth: 'Tháng 1/2027' },
  // Device timezone must not move "today": [timezoneId, now] → today cell 2026-10-13
  timezones: [['America/Los_Angeles', '2026-10-13T06:00:00+07:00'], ['Asia/Tokyo', '2026-10-13T23:30:00+07:00']]
};
// LoveCore.cycleReminder(items, Date.parse(now), days) and LoveCore.reminderLine(r, quiet).
// Gap 28 → next 20/11/2026. With days = 2: every day from 2 days before up to the day itself, never once late or during a period.
// Rows: [now, daysLeft or null, quiet line, full line].
// Real service worker (its clock can't be faked — seed around the REAL date): last cycle starts today + 2 − 28 with an end,
// the one before 28 days earlier, kv meta cycleRemind 2 → the single notification's body ends with a second line "🌸 còn 2 ngày";
// cycleRemind 0, or cycles.items not an array → the plain "💕 Ngày thứ N" notification, still exactly one.
const reminder = {
  items: [cy('2026-09-25', '2026-09-29'), cy('2026-10-23', '2026-10-27')],
  days2: [
    ['2026-11-17T08:00:00+07:00', null], ['2026-11-18T08:00:00+07:00', 2, '🌸 còn 2 ngày', '🌸 Kỳ tới dự kiến còn 2 ngày'],
    ['2026-11-19T08:00:00+07:00', 1, '🌸 còn 1 ngày', '🌸 Kỳ tới dự kiến còn 1 ngày'], ['2026-11-20T08:00:00+07:00', 0, '🌸 hôm nay', '🌸 Kỳ tới dự kiến hôm nay'],
    ['2026-11-21T08:00:00+07:00', null], ['2026-10-25T08:00:00+07:00', null]
  ],
  days5: ['2026-11-15T08:00:00+07:00', 5],
  nullItems: ['abc', null, [{}]]   // each → null without throwing; so does days = 0 with valid items
};

// ---------- Ảnh chia sẻ (v1.12) ----------
// The picture can't be read back (no OCR): compare the strings in LoveShare.plan(opts, LoveShare.measurer(font)).texts
// (font = getComputedStyle(document.body).fontFamily + ',"Helvetica Neue",Arial,sans-serif'; without a measurer the plan uses a
// width estimate). To see the plan the page itself made, wrap it before opening the sheet:
//   const o = LoveShare.plan; LoveShare.plan = (a, m) => (window.__plan = o(a, m));
// Every text has { role, text, x, y, size, weight, align, baseline, maxWidth, color, width }; roles: number | label | names |
// since (days) and emoji | title (1–2 entries) | date | dayNo | names (milestone), plus "initial" per missing avatar.
// The file goes to navigator.share({files}) inside the tap — stub it with addInitScript before load:
//   navigator.canShare = () => true; navigator.share = d => { window.__shared = d.files[0]; return Promise.resolve(); };
// Without navigator.share the file is downloaded (page.waitForEvent('download')) and the toast says "Đã tải ảnh về máy ✓".
// Nothing is written to IndexedDB; closing the sheet revokes the preview's object URL.
const shareNow = '2026-10-13T09:00:00+07:00';
const share = {
  now: shareNow,
  sizes: { post: [1080, 1350], story: [1080, 1920] },
  // texts without the "initial" entries, in order
  days: { texts: ['973', 'ngày bên nhau', 'Viết Long & Minh Thư', 'Từ 14/02/2024'], alt: 'Ảnh chia sẻ: 973 ngày bên nhau', file: 'long-thu-973-ngay.jpg' },
  milestoneFile: 'long-thu-ky-niem.jpg',
  // user milestones use the STORED date (not the next yearly occurrence); "Ngày thứ X bên nhau" is left out when X < 1
  // and for the auto "Ngày thứ K" row (its title already says it)
  milestones: {
    'm-dalat': ['✈️', 'Du lịch Đà Lạt', 'Thứ năm, 24/12/2026', 'Ngày thứ 1.045 bên nhau', 'Viết Long & Minh Thư'],
    'm-gap': ['💗', 'Ngày gặp nhau', 'Thứ năm, 05/10/2023', 'Viết Long & Minh Thư'],
    'auto-100': ['💯', 'Ngày thứ 1.000', 'Thứ hai, 09/11/2026', 'Viết Long & Minh Thư'],
    'auto-anniversary': ['💞', 'Kỷ niệm 3 năm', 'Chủ nhật, 14/02/2027', 'Ngày thứ 1.097 bên nhau', 'Viết Long & Minh Thư']
  },
  defaultTemplate: { withCover: 'cover', withoutCover: 'plain' },
  // setFixedTime(before) → open the sheet → setFixedTime(after) → wait 1.5s: alt and file name follow the new day
  rollover: { before: '2026-10-13T23:59:59+07:00', after: '2026-10-14T00:00:01+07:00', alt: ['Ảnh chia sẻ: 973 ngày bên nhau', 'Ảnh chia sẻ: 974 ngày bên nhau'], file: 'long-thu-974-ngay.jpg' },
  timezones: [['America/Los_Angeles', '2026-10-13T06:00:00+07:00', '973']]
};
const shareSel = {
  open: '#btnShare', sheet: '#shareSheet', box: '#shareBox', preview: '#sharePreview', save: '#btnShareSave', error: '#shareError',
  template: t => '[data-share-tpl="' + t + '"]',        // cover | card | plain
  size: z => '[data-share-size="' + z + '"]',           // post | story; #shareBox[data-size] follows
  autoRow: id => '#milestoneList button.ms-item.auto[data-ms-id="' + id + '"]',   // auto-100 | auto-anniversary | auto-bday-long | auto-bday-thu
  fromMilestoneForm: '#msShare',                         // only while editing a saved milestone; refuses with #msError when the form has unsaved edits
  ready: '#btnShareSave:not([disabled])'                 // disabled until the picture is built (and again after every change)
};

// ---------- Ảnh gắn vào kỷ niệm + dòng thời gian (v1.13) ----------
// Seed: ld.seed(page, { profile: ld.profile, milestones: ld.timeline.milestones }); await ld.seedPhotos(page, 6); reload.
// seedPhotos ids are seed001…seed006, takenAt 15/02/2024 … 20/02/2024. Links live on the milestone record (photoIds);
// a link to a photo that no longer exists ("khong-co") is skipped when read and dropped the next time that milestone is saved.
// Photos show by takenAt (else addedAt) ascending, never in stored order. Thumbnails are <img data-tl="<photoId>">.
// Photo ids CHANGE on import (fresh id each; a sha256 duplicate keeps the device's copy) — compare links by sha256, not id.
const timelineNow = '2026-10-13T09:00:00+07:00';
const timeline = {
  now: timelineNow,
  milestones: milestones.map(m => Object.assign({}, m,
    m.id === 'm-hoa' ? { photoIds: ['seed003', 'seed001', 'khong-co'] } : m.id === 'm-gap' ? { photoIds: ['seed003'] } : {})),
  upcoming: ['Sinh nhật Minh Thư, 15/10/2026, còn 2 ngày', 'Ngày thứ 1.000, 09/11/2026, còn 27 ngày', 'Du lịch Đà Lạt, 24/12/2026, còn 72 ngày',
    'Kỷ niệm 3 năm, 14/02/2027, còn 124 ngày', 'Sinh nhật Viết Long, 20/05/2027, còn 219 ngày', 'Ngày gặp nhau, 05/10/2027, còn 357 ngày'],
  years: ['2024', '2023'],
  // [aria-label, photo ids in display order]; "Du lịch Đà Lạt" (future) is not in the timeline
  rows: [
    ['Lần đầu tặng hoa, Thứ sáu, 08/03/2024, 949 ngày trước', ['seed001', 'seed003']],
    ['Ngày gặp nhau, Thứ năm, 05/10/2023, 1.104 ngày trước', ['seed003']]
  ],
  start: '💕 Ngày bắt đầu Thứ tư, 14/02/2024',                  // innerText of sel.timelineStart, last row of year 2024
  photoLabel: 'Ảnh 2 trên 2 của Lần đầu tặng hoa',              // at most 4 tiles (72×72); the 4th carries .tl-more "+N" when there are more
  viewer: { count: '2 / 2', closeLabel: 'Đóng, quay lại kỷ niệm' },   // opened from a tile: #viewerDelete hidden, ‹ › / swipe stay inside that milestone's photos
  empty: 'Chưa có kỷ niệm nào đã qua. Thêm một ngày đáng nhớ và gắn ảnh từ Album.',
  // form: pick seed005 → Xong → Lưu kỷ niệm → IndexedDB photoIds of m-hoa (as a set); nothing is written before "Lưu kỷ niệm"
  afterPick: ['seed001', 'seed003', 'seed005'],
  // deleting seed003 in the Album: ONE readwrite transaction over photos+blobs+milestones; afterwards m-hoa [seed001], m-gap []
  max: 60, limitText: 'Tối đa 60 ảnh cho một kỷ niệm', pickEmpty: 'Album chưa có ảnh — thêm ảnh ở tab Album trước.',
  deleteConfirm: 'Xoá kỷ niệm “Lần đầu tặng hoa”? Ảnh trong Album vẫn còn.',   // red row inside the sheet; window.confirm is never called
  // v1.15: no window.confirm/alert anywhere (page.on('dialog') must never fire). Album viewer on seed003 → sel.viewerDelete opens the row:
  photoDeleteConfirm: 'Xoá ảnh này khỏi Album? Không lấy lại được. Ảnh cũng rời khỏi 2 kỷ niệm.',   // second sentence only when linked
  photoDeleteError: 'Không xoá được ảnh. Hãy thử lại.',                                               // #viewerErr
  // "Thay thế" import: [data-imp=run] turns into #impConfirm ([data-imp=run-yes] "Thay thế" / [data-imp=run-no] "Giữ lại");
  // with timeline.milestones + wishes.items + calendar.A.items + seedPhotos(6):
  replaceConfirm: 'Xoá 6 ảnh, 3 kỷ niệm, 6 việc, 6 kỳ và hồ sơ hiện tại, thay bằng bản sao lưu?',
  replaceNotSaved: 'Bạn chưa lưu bản sao lưu dữ liệu hiện tại — thay xong sẽ không lấy lại được.',
  // Cài đặt → Ảnh: [data-remove=cover|avatar-long|avatar-thu] opens #photoConfirm (#photoConfirmYes "Gỡ" / #photoConfirmNo "Giữ lại")
  removeConfirm: { cover: 'Gỡ ảnh bìa?', 'avatar-long': 'Gỡ ảnh đại diện của Viết Long?' },
  importBusy: 'Đang nhập bản sao lưu — đợi xong rồi thử lại.',
  timezones: [['America/Los_Angeles', '2026-10-13T06:00:00+07:00'], ['Asia/Tokyo', '2026-10-13T23:30:00+07:00']]   // still "949 ngày trước"
};
const timelineSel = {
  photos: id => '#milestoneList .tl-photo[data-tl-ms="' + id + '"]',     // buttons; data-tl-open = photo id
  photo: (id, photoId) => '#milestoneList .tl-photo[data-tl-ms="' + id + '"][data-tl-open="' + photoId + '"]',
  more: '.tl-more', note: '.tl-note',
  formPhotos: '#msPhotos > li', pickOpen: '#msPickOpen',                 // button text "Chọn ảnh từ Album · 3 ảnh"
  pick: '#msPick', pickGrid: '#msPickGrid', pickTile: id => '#msPickGrid [data-pick="' + id + '"]',   // aria-pressed; aria-disabled once 60 are chosen
  pickDone: '#msPickDone', pickBack: '#msPickBack', pickLimit: '#msPickLimit', pickEmpty: '#msPickEmpty',   // "Xong · 3 ảnh"; back / Esc drops the uncommitted choice
  save: '#milestoneForm button[type=submit]', del: '#msDelete', confirm: '#msConfirm', confirmText: '#msConfirmText', confirmYes: '#msConfirmYes', confirmNo: '#msConfirmNo',
  viewerConfirm: '#viewerConfirm', viewerConfirmText: '#viewerConfirmText', viewerConfirmYes: '#viewerConfirmYes', viewerConfirmNo: '#viewerConfirmNo', viewerErr: '#viewerErr',
  impConfirm: '#impConfirm', photoConfirm: '#photoConfirm', photoConfirmText: '#photoConfirmText'
};

// ---------- Muốn làm (v1.14) ----------
// kv 'wishes' — { key:'wishes', items:[{ id, title, cat:'go'|'eat'|'watch'|'other'|'', note, planDate:'YYYY-MM-DD'|null,
//                 doneDate:'YYYY-MM-DD'|null, milestoneId:id|null, createdAt }], updatedAt } — stored and guarded exactly like 'cycles':
// updatedAt is the two-window stamp, items the validator rejects (or a repeated id) stay verbatim in the record across every save,
// and a record whose items is not an array locks the list (no add, no export, no import over it) without failing the app.
// Seed: ld.seed(page, { profile: ld.profile, extra: [['kv', ld.wishesRecord(ld.wishes.items)]] }), now = ld.wishes.now.
// The list sits in the Kỷ niệm tab behind the segmented control (default "Kỷ niệm"; not remembered between launches).
// After a successful write #wishSheet ignores taps for 400ms — wait ≥500ms before the next click there.
// v1.15 round buttons: a real tap on ANOTHER row while a write is running is queued and written next (two rows tapped 0–120ms
// apart both end up done); the same row again is dropped; after a write only the spot just tapped (±32px) swallows real taps
// for 400ms. Keyboard and el.click() are never held back. A failed write (the two-window message included) empties the queue.
const wi = (id, title, cat, planDate, doneDate, createdAt) => ({ id, title, cat, note: '', planDate: planDate || null, doneDate: doneDate || null, milestoneId: null, createdAt });
const wishesRecord = items => ({ key: 'wishes', items, updatedAt: 1 });
const wishNow = '2026-10-13T09:00:00+07:00'; // Thứ ba
const wishes = {
  now: wishNow,
  items: [
    wi('w1', 'Ngắm hoàng hôn Hội An', 'go', '2026-11-01', null, 1), wi('w2', 'Ăn lẩu nấm', 'eat', '2026-10-13', null, 2),
    wi('w3', 'Xem phim mới', 'watch', null, null, 3), wi('w4', 'Đón giao thừa', 'other', '2027-01-01', null, 4),
    wi('w5', 'Cắm trại', 'go', '2026-10-10', null, 5), wi('w6', 'Đi Đà Lạt', 'go', null, '2026-09-20', 6)
  ],
  emoji: { go: '✈️', eat: '🍜', watch: '🎬', other: '✨', '': '✨' },
  // group title → rows as [id, .ms-sub text ('' = no sub line), right side text]
  groups: [
    ['Sắp tới', [['w2', 'Thứ ba, 13/10/2026', 'Hôm nay'], ['w1', 'Chủ nhật, 01/11/2026', '19 ngày nữa'], ['w4', 'Thứ sáu, 01/01/2027', '80 ngày nữa']]],
    ['Đã qua ngày dự định', [['w5', 'Dự định 10/10/2026 đã qua 3 ngày', '']]],    // v1.15: its own group, most recently passed first
    ['Chưa hẹn ngày', [['w3', '', '']]],                                         // newest createdAt first; v1.14 showed [w5, w3] here
    ['Đã làm', [['w6', 'Đã làm 20/09/2026', 'Đã làm']]]
  ],
  // Home "Sắp tới" card: row 1 stays the nearest milestone, row 2 = nearest dated wish; tapping row 2 opens the tab on "Muốn làm"
  home: { row1: 'Sinh nhật Minh Thư', row1Left: '2 ngày nữa', row2: 'Ăn lẩu nấm', row2Date: 'Thứ ba, 13/10/2026', row2Left: 'Hôm nay' },
  timezones: [['America/Los_Angeles', '2026-10-13T06:00:00+07:00'], ['Asia/Tokyo', '2026-10-13T23:30:00+07:00']],   // w2 "Hôm nay", w1 19
  // v1.15 at 2026-10-14T09:00+07 (group titles are upper-cased by CSS: read textContent, not innerText)
  v115: { now: '2026-10-14T09:00:00+07:00',
    groups: [
      ['Sắp tới', [['w1', 'Chủ nhật, 01/11/2026', '18 ngày nữa'], ['w4', 'Thứ sáu, 01/01/2027', '79 ngày nữa']]],
      ['Đã qua ngày dự định', [['w2', 'Dự định 13/10/2026 đã qua 1 ngày', ''], ['w5', 'Dự định 10/10/2026 đã qua 4 ngày', '']]],
      ['Chưa hẹn ngày', [['w3', '', '']]],
      ['Đã làm', [['w6', 'Đã làm 20/09/2026', 'Đã làm']]]
    ],
    home: [['Sinh nhật Minh Thư', '1 ngày nữa'], ['Ngắm hoàng hôn Hội An', '18 ngày nữa']],
    timezones: [['America/Los_Angeles', '2026-10-14T06:00:00+07:00'], ['Asia/Tokyo', '2026-10-14T23:30:00+07:00']],
    // 14/10 23:59:59 → 15/10 00:00:01: w1 "17 ngày nữa", w2 "Dự định 13/10/2026 đã qua 2 ngày"
    // quick taps (page.mouse.click at the round buttons' centres): w3 then w2 → both doneDate 2026-10-14 (v1.14: only w3);
    // twice on w3 → only w3, ONE write (kv wishes.updatedAt = Date.parse(now), not +1)
    quick: { doneDate: '2026-10-14' } },
  // setFixedTime(before) → load → setFixedTime(after) → wait 1.2s: w1 18; w2 drops to "Đã qua ngày dự định"; Home row 2 = w1
  rollover: { before: '2026-10-13T23:59:59+07:00', after: '2026-10-14T00:00:01+07:00', w1: '18 ngày nữa', w2: 'Dự định 13/10/2026 đã qua 1 ngày', homeRow2: 'Ngắm hoàng hôn Hội An' },
  toggle: { doneDate: '2026-10-13', toastOn: 'Đã làm ✓', toastOff: 'Đã bỏ đánh dấu' },   // real tap on the round button of w3; a double tap writes once
  toMilestone: { id: 'w6', title: 'Đi Đà Lạt', date: '2026-09-20', emoji: '✈️', linked: 'Đã có trong Kỷ niệm ✓' },   // nothing is created until "Lưu kỷ niệm"
  empty: 'Chưa có việc nào. Ghi lại nơi muốn đi, món muốn ăn, phim muốn xem cùng nhau.',
  broken: 'Không đọc được danh sách — dữ liệu vẫn còn nguyên.',
  stale: 'Danh sách vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.',
  errors: { title: 'Hãy ghi việc muốn làm', doneFuture: 'Ngày đã làm không được sau hôm nay', full: 'Đã đủ 500 việc — xoá bớt việc đã làm rồi thêm tiếp.' },
  max: 500,
  // backup: manifest key "wishes" (absent when the list is empty or unreadable); a file without it, or with [], leaves the
  // device's list alone in BOTH import modes; merge keeps the device's copy of a repeated id; 501 items or an invalid item refuse the file
  kept: 'Việc muốn làm trên máy giữ nguyên (bản sao lưu này không có).'
};
const wishSel = {
  seg: '#msSeg', segBtn: k => '#msSeg [data-ms-seg="' + k + '"]',     // ms | wishes (aria-pressed)
  pane: '#wishPane', list: '#wishList', listErr: '#wishErr', add: '#btnAddMilestone', emptyAdd: '#wishList [data-wish-add]',
  groupTitles: '#wishList .group-title', rows: '#wishList .wish-row',
  row: id => '#wishList [data-wish-id="' + id + '"]',                 // the whole-row button: tap = edit; .ms-title, .ms-sub, .ms-left / .status-tag
  check: id => '#wishList [data-wish-check="' + id + '"]',            // sibling round button, aria-pressed = done
  sheet: '#wishSheet', form: '#wishForm', title: '#wTitle', titleErr: '#wTitleErr', cat: k => '#wCats [data-wish-cat="' + k + '"]',
  plan: '#wPlan', planBtn: '#wPlanBtn', done: '#wDone', doneBtn: '#wDoneBtn', doneField: '#wDoneField', doneErr: '#wDoneErr', note: '#wNote',
  formErr: '#wishFormErr', save: '#wishSave', toMilestone: '#wishToMs', linked: '#wishLinked',
  del: '#wishDelete', confirm: '#wishConfirm', confirmText: '#wishConfirmText', confirmYes: '#wishConfirmYes', confirmNo: '#wishConfirmNo',
  homeRows: '#upcomingBody .up-row', homeWish: '#upcomingBody .up-row[data-seg="wishes"]'
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

module.exports = { path, now, profile, milestones, dayCountTable, rollover, edges, milestoneRows, timelineRows, timeline, timelineSel, birthdays, goal, leap, sel, seed, seedPhotos, badgeStubScript,
  cy, cyclesRecord, cycleNow, cycles, cycleSel, calNow, calendar, reminder, share, shareSel,
  wi, wishesRecord, wishes, wishSel };
