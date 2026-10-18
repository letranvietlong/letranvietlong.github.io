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
//                                cycleRemind:0|1|2|3|5 (default 2), cycleRemindQuiet:bool (default true), dayRemind:bool (default true, v1.17),
//                                showJournal:bool (default true, v1.18) } — per device, never in a backup
//   kv 'journal'             — v1.18, see "Nhật ký" below
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

// ---------- Ngày này năm xưa (v1.16) ----------
// Home card #otdCard (hidden when nothing matches), between the day count and "Sắp tới". LoveCore.onThisDay(src, nowMs) is pure.
// Rule: an item dated d, n = thisYear − year(d) > 0 years back, shows when LoveCore.addYearsClamp(d, n) === today (VN day).
// Photos count only with takenAt (read as a VN day); a done wish linked to a milestone of that same day is left out.
// Seed: ld.seed(page, { profile: ld.profile, milestones: ld.onThisDay.milestones, extra: [['kv', ld.wishesRecord(ld.onThisDay.wishes)]] });
//       await ld.seedPhotoList(page, ld.onThisDay.photos); reload. now = ld.onThisDay.now.
const ms = (id, title, date, emoji, createdAt) => ({ id, title, date, emoji, note: '', repeatYearly: false, createdAt });
const onThisDay = {
  now: '2026-10-14T09:00:00+07:00',
  milestones: milestones.concat([ms('m-otd1', 'Đi Hội An', '2025-10-14', '🏖️', 10), ms('m-otd2', 'Hẹn hò đầu tiên', '2024-10-14', '💗', 11),
    ms('m-no', 'Hôm qua năm ngoái', '2025-10-13', '💗', 12), ms('m-today', 'Hôm nay', '2026-10-14', '💗', 13)]),
  wishes: [wi('wO', 'Ăn bún chả', 'eat', null, '2025-10-14', 20)],
  // [id, takenAt, addedAt]: pB is 01:30 (+07) on 14/10 (still 13/10 in UTC), pC is 00:30 (+07) on 15/10 (still 14/10 in UTC), pD has no taken date
  photos: [['pA', Date.UTC(2025, 9, 14, 1), 1e12 + 1], ['pB', Date.UTC(2025, 9, 13, 18, 30), 1e12 + 2], ['pC', Date.UTC(2025, 9, 14, 17, 30), 1e12 + 3],
    ['pD', null, Date.UTC(2024, 9, 14, 3)], ['pE', Date.UTC(2024, 9, 14, 5), 1e12 + 5]],
  // groups in order: .otd-year text, [data-otd-ms] ids, [data-otd-wish] ids (sub line "Đã làm cùng nhau"), [data-otd-photo] ids
  groups: [
    ['1 năm trước · Thứ ba, 14/10/2025', ['m-otd1'], ['wO'], ['pB', 'pA']],
    ['2 năm trước · Thứ hai, 14/10/2024', ['m-otd2'], [], ['pE']]
  ],   // never m-no, m-today, pC, pD; code reading the day in UTC or device time loses pB and gains pC
  // with only ld.milestones: hidden at `now`; [now, the single .otd-year, the single row title]
  base: [['2026-10-05T09:00:00+07:00', '3 năm trước · Thứ năm, 05/10/2023', 'Ngày gặp nhau'], ['2026-03-08T09:00:00+07:00', '2 năm trước · Thứ sáu, 08/03/2024', 'Lần đầu tặng hoa']],
  // one milestone dated 2024-02-29: [now, .otd-year or null = card hidden]
  leap: [['2026-02-28T09:00:00+07:00', '2 năm trước · Thứ năm, 29/02/2024'], ['2026-03-01T09:00:00+07:00', null],
    ['2028-02-29T09:00:00+07:00', '4 năm trước · Thứ năm, 29/02/2024'], ['2028-02-28T09:00:00+07:00', null]],
  timezones: [['America/Los_Angeles', '2026-10-14T06:00:00+07:00'], ['Asia/Tokyo', '2026-10-14T23:30:00+07:00']],   // same two groups
  // setFixedTime(before) → load → setFixedTime(after) → wait 1.5s; a form opened meanwhile keeps its text
  rollover: { before: '2026-10-13T23:59:59+07:00', after: '2026-10-14T00:00:01+07:00', beforeGroups: [['1 năm trước · Thứ hai, 13/10/2025', ['m-no'], [], []]] },
  viewer: { tap: 'pA', count: '2 / 2', closeLabel: 'Đóng, quay lại Trang chủ' },   // #viewerDelete hidden; ‹ › stay inside that year's photos
  // layout at 430×873 with only ld.milestones (card hidden): #dayCount top 253,34 and #upcomingCard top 470,8 — unchanged from v1.15
  // thumbnails share the timeline pool: 3 live object URLs on Home, 0 after leaving the tab
  maxTiles: 4   // a 5th photo of the same year turns the 4th tile into "+N" (.tl-more)
};
const otdSel = {
  card: '#otdCard', body: '#otdBody', groups: '#otdCard .otd-group', year: '.otd-year',
  ms: id => '#otdBody [data-otd-ms="' + id + '"]', wish: id => '#otdBody [data-otd-wish="' + id + '"]',
  photo: id => '#otdBody [data-otd-photo="' + id + '"]'   // also carries data-otd-year
};
// ---------- Nhắc trong thông báo sáng (v1.17) ----------
// The service worker adds up to 3 lines to the ONE daily notification, after the main line and the "🌸 …" period line:
//   LoveCore.dayReminderLines(LoveCore.dayReminders(rawProfile, rawMilestones, rawWishItems, nowMs), 3)   — pure, never throws
//   LoveCore.pushBody(mainLine, periodLineOrEmpty, lines)                                                — joined by "\n", ≤ 300 code points
// Due: user milestones (next yearly occurrence when repeating), birthdays, "Ngày thứ K", the n-year anniversary at 7 / 1 / 0 days left;
// open wishes with a planDate at 1 / 0. "Ngày thứ K" and the anniversary are left out ON the day (the main line says "Hôm nay tròn …").
// Order: daysLeft, then birthday < anniversary/hundred < user milestone < wish, then title, then id. More than 3 → 2 + "… và N mục khác".
// Switch: kv meta dayRemind (boolean, default true; only `false` turns it off) — Cài đặt → Thông báo.
// Real service worker (clock can't be faked — seed around the REAL date): CDP ServiceWorker.deliverPushMessage with
// chromium.launch({ channel: 'chromium' }), then registration.getNotifications().
const dayRemind = {
  now: '2026-10-14T09:00:00+07:00',
  // [now, lines] with ld.profile, ld.milestones, ld.wishes.items — the same in every device timezone
  table: [
    ['2026-10-14T09:00:00+07:00', ['🎂 Ngày mai: Sinh nhật Minh Thư']], ['2026-10-14T23:30:00+07:00', ['🎂 Ngày mai: Sinh nhật Minh Thư']],
    ['2026-10-15T00:00:01+07:00', ['🎂 Hôm nay: Sinh nhật Minh Thư']], ['2026-10-08T08:00:00+07:00', ['🎂 Còn 7 ngày: Sinh nhật Minh Thư']],
    ['2026-10-12T08:00:00+07:00', ['🍜 Ngày mai: Ăn lẩu nấm']],                  // birthday 3 days away: no line; wish w2 is planned for 13/10
    ['2026-10-11T08:00:00+07:00', []],
    ['2026-11-02T08:00:00+07:00', ['💯 Còn 7 ngày: Ngày thứ 1.000']], ['2026-11-08T08:00:00+07:00', ['💯 Ngày mai: Ngày thứ 1.000']],
    ['2026-11-09T08:00:00+07:00', []],                                           // the main line is already "Hôm nay tròn 1.000 ngày …"
    ['2026-12-17T08:00:00+07:00', ['✈️ Còn 7 ngày: Du lịch Đà Lạt']], ['2026-10-31T08:00:00+07:00', ['✈️ Ngày mai: Ngắm hoàng hôn Hội An']]
  ],
  // added to ld.milestones / ld.wishes.items at `now`: 5 due items → 2 lines + the count
  milestones: [ms('m-r0', 'Ngày nhận nhà', '2026-10-14', '⭐', 20), Object.assign(ms('m-r7', 'Kỷ niệm ngày cầu hôn', '2025-10-21', '💍', 21), { repeatYearly: true }),
    ms('m-r3', 'Ba ngày nữa', '2026-10-17', '💗', 22)],
  wishes: [wi('wR1', 'Xem pháo hoa', 'watch', '2026-10-14', null, 30), wi('wR2', 'Ăn lẩu nấm lần hai', 'eat', '2026-10-15', null, 31),
    wi('wR3', 'Hai ngày nữa', 'go', '2026-10-16', null, 32), wi('wR4', 'Đã làm rồi', 'go', '2026-10-14', '2026-10-14', 33)],
  order: [['m-r0', 0], ['wR1', 0], ['auto-bday-thu', 1], ['wR2', 1], ['m-r7', 7]],   // [id, daysLeft] from dayReminders
  lines: ['⭐ Hôm nay: Ngày nhận nhà', '🎬 Hôm nay: Xem pháo hoa', '… và 3 mục khác'],
  title: '💕 Ngày thứ 974',
  body: 'Hôm nay là ngày thứ 974 Long & Thư yêu nhau\n⭐ Hôm nay: Ngày nhận nhà\n🎬 Hôm nay: Xem pháo hoa\n… và 3 mục khác',
  // with a period line (cycles shifted so the predicted start is 2 days away) "🌸 còn 2 ngày" stays line 2, the reminders follow
  titleMax: 40, bodyMax: 300,   // a longer title is cut on a grapheme boundary + "…"; lines that don't fit are dropped from the end
  // Cài đặt → Thông báo, with only ld.profile + ld.milestones + ld.wishes.items at `now`
  preview: 'Sáng nay sẽ nhắc: 🎂 Ngày mai: Sinh nhật Minh Thư',
  previewNone: 'Sáng nay không có gì để nhắc.',                                  // e.g. now = 2026-10-11T08:00+07; hidden while the switch is off
  // "Gửi thử trên máy này": the real lines of today; on a day with none, the nearest thing ahead as an example + this sentence in #pushTestNote
  testBody: 'Thông báo thử trên máy này — hôm nay là ngày thứ 974 Long & Thư yêu nhau\n🌸 còn 2 ngày\n🎂 Ngày mai: Sinh nhật Minh Thư',
  testExample: { now: '2026-10-11T08:00:00+07:00', line: '🍜 Còn 2 ngày: Ăn lẩu nấm', note: 'Dòng nhắc trong bản thử là ví dụ từ mốc gần nhất.' }
};
const dayRemindSel = { box: '#dayRemindBox', toggle: '#dayRemind', preview: '#dayRemindPreview', test: '#btnPushTest', testNote: '#pushTestNote' };

// ---------- Nhật ký (v1.18) ----------
// kv 'journal' — { key:'journal', items:[{ date:'YYYY-MM-DD', mood:0..5 (0 = none), text:'' (≤ 200), updatedAt }], updatedAt } — one entry per
// day, stored and guarded exactly like 'wishes': updatedAt is the two-window stamp, an entry the validator rejects (or a second entry for
// the same date) stays verbatim in the record across every save, a record whose items is not an array locks the journal (pane says
// `broken`, Home card and "Thêm" hidden, no export, no import over it) without failing the app. No DB_VERSION bump, no new store.
// mood 0 AND empty text = invalid. Moods: 1 😢 Buồn · 2 😕 Hơi chán · 3 😐 Bình thường · 4 🙂 Vui · 5 🥰 Rất vui.
// Seed: ld.seed(page, { profile: ld.profile, milestones: ld.milestones, extra: [['kv', ld.journalRecord(ld.journal.items)]] }), now = ld.journal.now.
// The pane sits in the Kỷ niệm tab behind the THIRD segmented button "Nhật ký"; "Thêm" there opens today's sheet.
// The sheet's day is fixed when it opens: a rollover or visibilitychange never moves it or touches its text/mood.
// Home quick mood tap writes { date: today AS OF THE TAP, mood, text:'' } at once (toast "Đã ghi hôm nay ✓"); a double tap writes once
// (the spot just tapped swallows real taps for 400ms). Hidden with Cài đặt → Nhật ký → #journalShow (kv meta showJournal, default true).
const j = (date, mood, text, updatedAt) => ({ date, mood, text: text || '', updatedAt: updatedAt || 1 });
const journalRecord = items => ({ key: 'journal', items, updatedAt: 1 });
const journal = {
  now: '2026-10-14T09:00:00+07:00',
  items: [j('2026-10-14', 4, 'Đi ăn phở'), j('2026-10-13', 2, ''), j('2026-10-01', 5, 'Kỷ niệm'), j('2026-09-30', 0, 'Chỉ ghi chú'), j('2025-10-14', 3, 'Năm ngoái')],
  moods: { 1: ['😢', 'Buồn'], 2: ['😕', 'Hơi chán'], 3: ['😐', 'Bình thường'], 4: ['🙂', 'Vui'], 5: ['🥰', 'Rất vui'] },
  // calendar cells: a day with a mood shows its emoji (.j-emoji) INSTEAD of the number; text only = number + .j-dot; today = .is-today;
  // days after today carry aria-disabled="true" (.is-future); other months' days .is-out. List title is read with textContent (CSS upper-cases it).
  months: {
    '2026-10': { title: 'Tháng 10/2026', cells: 35, first: '2026-09-28', last: '2026-11-01',
      emoji: { '2026-10-14': '🙂', '2026-10-13': '😕', '2026-10-01': '🥰' }, dot: ['2026-09-30'], today: '2026-10-14',
      listTitle: 'Tháng 10/2026 · 3 ngày đã ghi', rows: ['2026-10-14', '2026-10-13', '2026-10-01'] },
    '2026-09': { title: 'Tháng 9/2026', cells: 35, first: '2026-08-31', last: '2026-10-04',
      emoji: { '2026-10-01': '🥰' }, dot: ['2026-09-30'], listTitle: 'Tháng 9/2026 · 1 ngày đã ghi', rows: ['2026-09-30'] }
  },
  // the next month button is disabled on the current month; the earliest month is 2000-01
  home: { emoji: '🙂', text: 'Đi ăn phở', mood: 'Vui' },
  // with ld.journal.items, "Ngày này năm xưa" gains: group '1 năm trước · Thứ ba, 14/10/2025', row [data-otd-j="2025-10-14"] 😐 "Năm ngoái"
  // (sub line "Nhật ký · Bình thường")
  otd: { year: '1 năm trước · Thứ ba, 14/10/2025', date: '2025-10-14', emoji: '😐', title: 'Năm ngoái', sub: 'Nhật ký · Bình thường' },
  sheetTitle: 'Nhật ký · Thứ tư, 14/10/2026',
  label: { today: 'Hôm nay thế nào?', past: 'Hôm đó thế nào?' },
  empty: 'Chưa ghi ngày nào. Mỗi ngày một dòng và một tâm trạng — xem lại theo lịch.',
  broken: 'Không đọc được nhật ký — dữ liệu vẫn còn nguyên.',
  stale: 'Nhật ký vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.',
  errors: { empty: 'Hãy chọn tâm trạng hoặc viết vài dòng', future: 'Chưa ghi được cho ngày ở tương lai', full: 'Đã đủ 4.000 ngày — xoá bớt rồi ghi tiếp.' },
  deleteConfirm: 'Xoá nhật ký ngày 14/10/2026?',
  max: 4000, textMax: 200,
  // backup: manifest key "journal" [{date, mood, text, updatedAt}] (absent when empty or unreadable; still format 1, older apps ignore it);
  // a file without it, or with [], leaves the device's journal alone in BOTH modes; merge keeps the device's entry for a date it has
  // ("bỏ qua"); 4.001 entries or one invalid entry (mood 9, 2026-02-31) refuse the whole file.
  kept: 'Nhật ký trên máy giữ nguyên (bản sao lưu này không có).',
  keptBroken: 'Nhật ký trên máy đang không đọc được nên được giữ nguyên.'
};
const journalSel = {
  seg: '#msSeg [data-ms-seg="journal"]', pane: '#journalPane', body: '#journalBody', err: '#journalErr',
  cal: '#journalBody .j-cal', calTitle: '#jCalTitle', days: '#journalBody [data-j-day].cal-day', day: d => '#journalBody .cal-day[data-j-day="' + d + '"]',
  nav: k => '#journalBody [data-jcal-nav="' + k + '"]',   // prev | next | today (today only while another month is on show)
  listTitle: '#journalBody .j-month', rows: '#journalList .j-item', row: d => '#journalList [data-j-day="' + d + '"]', emptyAdd: '#journalBody [data-j-add]',
  card: '#journalCard', quick: n => '#journalCardBody [data-j-quick="' + n + '"]', open: '#journalOpen', cardErr: '#journalCardErr',
  sheet: '#journalSheet', title: '#journalSheetTitle', moodLabel: '#jMoodLabel', mood: n => '#jMoods [data-j-mood="' + n + '"]',   // aria-pressed; tap again = none
  text: '#jText', count: '#jCount', textErr: '#jErr', formErr: '#journalFormErr', save: '#journalSave', del: '#journalDelete',
  confirm: '#journalConfirm', confirmText: '#journalConfirmText', confirmYes: '#journalConfirmYes', confirmNo: '#journalConfirmNo',
  show: '#journalShow', otdRow: d => '#otdBody [data-otd-j="' + d + '"]'
};

// ---------- Tổng kết năm (v1.19) ----------
// Row #btnRecap at the top of "Dòng thời gian" (tab Kỷ niệm) opens #recapSheet. LoveCore.recapYears(startDate, nowMs) and
// LoveCore.yearRecap(src, year, nowMs) are pure (same result in every TZ). Read-only: nothing is written to IndexedDB.
// Seed: ld.seed(page, { profile: ld.profile, milestones: ld.milestones.concat(ld.recap.milestones),
//         extra: [['kv', ld.wishesRecord(ld.wishes.items.concat(ld.recap.wishes))], ['kv', ld.journalRecord(ld.recap.journal)]] });
//       await ld.seedPhotos(page, 6); await ld.seedPhotoList(page, ld.recap.photos); reload. now = ld.recap.now.
// Share picture: LoveShare.plan texts (without "initial") for mode "recap"; a stat of 0 is left out of the picture but shows in the sheet.
const recap = {
  now: '2026-10-14T09:00:00+07:00',
  milestones: [ms('m-a', 'Kỷ niệm A', '2026-01-10', '💗', 30), Object.assign(ms('m-b', 'Kỷ niệm B', '2026-06-01', '💗', 31), { photoIds: ['py3'] }),
    ms('m-c', 'Kỷ niệm C', '2025-12-31', '💗', 32), ms('m-d', 'Kỷ niệm D', '2026-10-14', '💗', 33)],
  wishes: [wi('wd1', 'Việc 1', 'go', null, '2026-01-01', 40), wi('wd2', 'Việc 2', 'go', null, '2025-12-31', 41)],
  // py1 = 23:59:59 (+07) 31/12/2025; py2 = 00:00 (+07) 01/01/2026 (still 2025 in UTC); py4 has no taken date (addedAt counts)
  photos: [['py1', Date.UTC(2025, 11, 31, 16, 59, 59), 1e12 + 101], ['py2', Date.UTC(2025, 11, 31, 17, 0, 0), 1e12 + 102],
    ['py3', Date.UTC(2026, 5, 1, 3), 1e12 + 103], ['py4', null, Date.UTC(2026, 9, 13, 2)]],
  journal: ['2026-10-14', '2026-10-13', '2026-10-01', '2026-09-30', '2026-01-01', '2025-12-31', '2025-10-14'].map((d, i) => j(d, 3, '', i + 1)),
  years: [2026, 2025, 2024],   // ‹ disabled on 2024, › disabled on 2026; m-gap (2023) counts in no year
  // [year, days, daysInYear, asOf, milestones, wishesDone, photos, journalDays, topPhotoIds]; 322 + 365 + 287 = 974
  table: [
    [2026, 974, 287, '2026-10-14', 3, 2, 3, 5, ['py3', 'py2', 'py4']],    // m-a, m-b, m-d (Đà Lạt 24/12 not yet); w6 20/09 + wd1
    [2025, 687, 365, '2025-12-31', 1, 1, 1, 2, ['py1']],
    [2024, 322, 322, '2024-12-31', 1, 0, 6, 0, ['seed001', 'seed002', 'seed004', 'seed005']]
  ],
  texts2026: ['Tổng kết năm', '2026', '974', 'ngày bên nhau', 'tính đến 14/10/2026', '3 kỷ niệm', '2 việc đã làm cùng nhau', '3 ảnh', '5 ngày ghi nhật ký', 'Viết Long & Minh Thư'],
  texts2024: ['Tổng kết năm', '2024', '322', 'ngày bên nhau', 'tính đến 31/12/2024', '1 kỷ niệm', '6 ảnh', 'Viết Long & Minh Thư'],
  sub2026: '287 ngày trong năm 2026 · tính đến 14/10/2026',
  file: 'long-thu-tong-ket-2026.jpg', alt: 'Ảnh chia sẻ: tổng kết năm 2026',
  // profile starting 2022-05-01, nothing recorded: year 2022 → 245, #recapEmpty says this, #recapShare hidden
  empty: { startDate: '2022-05-01', year: 2022, days: 245, text: 'Năm 2022 chưa ghi kỷ niệm, ảnh hay nhật ký nào.' },
  // device in America/Los_Angeles at 2027-01-01T00:30+07 (still 31/12 there): years [2027, 2026, 2025, 2024];
  // 2027 → days 1053, daysInYear 1; 2026 → days 1052, daysInYear 365, milestones 4 (Đà Lạt has passed)
  newYear: { now: '2027-01-01T00:30:00+07:00', timezoneId: 'America/Los_Angeles', years: [2027, 2026, 2025, 2024], y2027: [1053, 1], y2026: [1052, 365, 4] },
  // sheet open on 2026: 14/10 23:59:59 → 15/10 00:00:01 → 974 → 975, 287 → 288, year and sheet stay
  rollover: { before: '2026-10-14T23:59:59+07:00', after: '2026-10-15T00:00:01+07:00', days: ['974', '975'], inYear: [287, 288] }
};
const recapSel = {
  open: '#btnRecap', sheet: '#recapSheet', prev: '#recapPrev', next: '#recapNext', year: '#recapYear', days: '#recapDays', sub: '#recapSub',
  stats: '#recapStats .recap-stat',   // dt = label, dd = number: kỷ niệm | việc đã làm cùng nhau | ảnh | ngày ghi nhật ký
  photos: '#recapPhotos img[data-tl]', body: '#recapBody', empty: '#recapEmpty', note: '#recapNote', share: '#recapShare',
  shareTplField: '#shareTplField'      // hidden while #shareSheet is in recap mode
};

// ---------- Thuốc (v1.20) ----------
// kv 'med' — { key:'med', courses:[{ id, name (≤40), perDay 1..10, startDate, totalPills 1..2000, visitDate|null, endDate|null (null = in use),
//              note (≤200), createdAt }], log:[{ date, taken:bool, note (≤200), at: ms|null }], updatedAt } — ONE record, guarded exactly like
// 'journal': updatedAt is the two-window stamp, an item the validator rejects (or a repeated course id / log day) stays verbatim across
// every save, a record whose courses or log is not an array locks Thuốc (pane says `broken`, Home row hidden, no export, no import over it).
// The log carries no course id: a day belongs to the course whose date range covers it. Not taken + no note = invalid (unticking such a
// day removes the entry). One course in use at a time; adding one that starts later ends the open one the day before, in the same write.
// The Sức khoẻ tab keeps the id #tab-cycle / [data-tab="cycle"]; #healthSeg picks "Thuốc" (default when a course covers today) or "Chu kỳ".
// Seed: ld.seed(page, { profile: ld.profile, extra: [['kv', ld.medRecord(ld.med.F.courses, ld.med.F.log)]] }); reload; now = ld.med.now.
// Pure maths (same in every TZ): LoveCore.medStats(course, log, nowMs), LoveCore.medMonth(courses, log, y, m, nowMs).
// The reminder push is the separate workflow "LoveDays reminder push" (08:07 / 09:07 VN, secret LOVE_REMINDER_PUSH_SUBSCRIPTIONS),
// payload { kind:'med', date }; its text is LoveCore.medPushContent(rawMed, rawMeta, date, nowMs) — also what "Gửi thử nhắc uống thuốc" shows.
const md = (id, name, startDate, totalPills, visitDate, endDate) => ({ id, name, perDay: 1, startDate, totalPills, visitDate: visitDate || null, endDate: endDate || null, note: '', createdAt: 1 });
const me = (date, at) => ({ date, taken: true, note: '', at: at === undefined ? Date.parse(date + 'T07:55:00+07:00') : at });
const mn = (date, note) => ({ date, taken: false, note, at: null });
const medRecord = (courses, log) => ({ key: 'med', courses, log, updatedAt: 1 });
const medDays = (a, b) => { const o = []; for (let t = Date.parse(a + 'T00:00:00Z'); t <= Date.parse(b + 'T00:00:00Z'); t += 864e5) o.push(new Date(t).toISOString().slice(0, 10)); return o; };
const medF = [md('rx-f1', 'Thuốc A', '2026-10-08', 100, '2027-01-20')];
const medFlog = [me('2026-10-08'), me('2026-10-09'), me('2026-10-11'), mn('2026-10-12', 'Quên vì đi công tác'), me('2026-10-13'), me('2026-10-14')];
const med = {
  now: '2026-10-15T09:00:00+07:00',   // Thứ năm; nothing logged for 10/10, 12/10 has only a note
  F: { courses: medF, log: medFlog,
    // 5 taken days → 100 − 5 = 95 (93 = counting calendar days 08–14, 92 = also counting today); first day still to take = today
    remaining: '95 viên', lastDay: 'Chủ nhật, 17/01/2027', visit: 'Thứ tư, 20/01/2027', visitLeft: 97,
    shortfall: 2, shortfallTag: 'Hết thuốc trước ngày tái khám 2 ngày',      // (20/01 − 1) − 17/01; also the Home sub line
    missed: 2, streak: '2 ngày liền', month: '5/7 ngày · 71%', monthLine: 'Tháng 10/2026 · uống 5/7 ngày',   // wrong: 5/8 · 63%
    // October 2026 grid (35 cells, 28/09 → 01/11): classes is-taken | is-missed | is-due (+ is-today) | is-future | is-off
    cells: { off: medDays('2026-09-28', '2026-10-07'), taken: ['2026-10-08', '2026-10-09', '2026-10-11', '2026-10-13', '2026-10-14'],
      missed: ['2026-10-10', '2026-10-12'], due: ['2026-10-15'], future: medDays('2026-10-16', '2026-11-01') },
    noteLabel: 'Thứ hai, 12/10/2026, chưa ghi uống, có ghi chú',              // aria-label of the 12/10 cell (corner dot = note)
    // tap 12/10 → #medDayInfo; "Ghi đã uống ngày này" keeps the note → remaining 94, toast "Đã ghi uống ngày 12/10 ✓"
    tap12: ['Thứ hai, 12/10/2026', 'Chưa ghi uống', 'Quên vì đi công tác', ['Ghi đã uống ngày này', 'Sửa ghi chú']],
    tap20: ['Thứ ba, 20/10/2026', 'Chưa tới ngày này', []],
    // › reaches 01/2027 (month of the last pill), never 02/2027; ‹ to 09/2026 → "Tháng 9/2026 · chưa có ngày nào trong đợt"
    maxMonth: 'Tháng 1/2027', sepLine: 'Tháng 9/2026 · chưa có ngày nào trong đợt',
    // real tap on #medTake at 09:00 → { date:'2026-10-15', taken:true, at: 09:00 } → 94 viên, lastDay unchanged, streak 3, 6/8 · 75%
    afterTake: { remaining: '94 viên', lastDay: 'Chủ nhật, 17/01/2027', streak: '3 ngày liền', month: '6/8 ngày · 75%', toast: 'Đã ghi uống thuốc hôm nay ✓',
      done: '✓ Đã uống hôm nay lúc 09:00', home: ['✓ Đã uống hôm nay · 09:00', 'Hết thuốc trước ngày tái khám 2 ngày'] },
    home: ['Hôm nay chưa uống thuốc', 'Hết thuốc trước ngày tái khám 2 ngày', 'Đã uống'],   // #medCard title, sub line, button
    morning13: ['💊 Hôm qua chưa ghi uống thuốc'],                // medMorningLines at 2026-10-13T07:00+07 (13/10 already ticked)
    morning0113: ['🩺 Còn 7 ngày: tái khám', '💊 8:00 nhớ uống thuốc'],                     // at 2027-01-13T07:00+07, log unchanged
    push: { title: '💊 Đến giờ uống thuốc', body: 'Hôm nay chưa ghi uống thuốc. Chạm để mở lịch thuốc.',
      bodyNamed: 'Hôm nay chưa ghi uống Thuốc A (1 viên). Chạm để mở lịch thuốc.' } },   // medPushContent(…, '2026-10-15', now); medQuiet:false
  // F with totalPills 10: 5 left, 5 days (≤ 7 = low), last pill Thứ hai, 19/10/2026; Home sub "Sắp hết thuốc: còn 5 viên"
  L: { courses: [md('rx-f1', 'Thuốc A', '2026-10-08', 10, '2027-01-20')], log: medFlog, remaining: '5 viên', lastDay: 'Thứ hai, 19/10/2026', home: 'Sắp hết thuốc: còn 5 viên' },
  // Form: new course from 15/10/2026, 60 pills, 1 a day → #mdPreview; with F in use → #mdCloseNote, and one write ends F on 14/10
  form: { preview: 'Đủ thuốc 60 ngày, tới hết Chủ nhật, 13/12/2026.', closeNote: 'Đợt “Thuốc A” đang dùng sẽ kết thúc ngày 14/10/2026.',
    openBefore: 'Đợt “Thuốc A” bắt đầu 08/10/2026 vẫn đang dùng — ngày bắt đầu phải sau ngày đó.',   // start 08/10 while F is open
    errors: { name: 'Hãy ghi tên thuốc', pills: 'Số viên là số nguyên từ 1 đến 2.000', visit: 'Ngày tái khám phải sau ngày bắt đầu' } },
  // Import "Gộp": device A has rx-a "Thuốc A" 08/10 (100) log {08, 09}; file B has rx-b "thuốc a " 08/10, log {09, 11}
  // → one course (rx-a), log {08, 09, 11}, remaining 97; preview "1 ngày ghi thuốc"; result "Bỏ qua 1 ngày ghi thuốc đã có trên máy."
  merge: { a: { courses: [md('rx-a', 'Thuốc A', '2026-10-08', 100)], log: [me('2026-10-08'), me('2026-10-09')] },
    b: { courses: [md('rx-b', 'thuốc a ', '2026-10-08', 100)], log: [me('2026-10-09'), me('2026-10-11')] }, days: ['2026-10-08', '2026-10-09', '2026-10-11'] },
  broken: { record: { key: 'med', courses: 'x', log: [], updatedAt: 1 }, text: 'Không đọc được dữ liệu thuốc — dữ liệu vẫn còn nguyên.' },
  stale: 'Lịch thuốc vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.',
  timezones: [['America/Los_Angeles', '2026-10-15T09:00:00+07:00'], ['Asia/Tokyo', '2026-10-15T23:30:00+07:00']]   // both write date 2026-10-15
};
const medSel = {
  seg: '#healthSeg', segBtn: k => '#healthSeg [data-health-seg="' + k + '"]',   // med | cycle (aria-pressed)
  pane: '#medPane', body: '#medBody', err: '#medErr', take: '#medTake', undo: '#medUndo', done: '#medBody .med-done', stats: '#medBody .med-stat',
  visit: '#medBody .med-visit', cal: '#medCal', calTitle: '#medCalTitle', day: d => '#medCal [data-md-day="' + d + '"]',
  nav: k => '#medCal [data-mcal-nav="' + k + '"]', month: '#medCal .med-month', info: '#medDayInfo', toggle: '#medDayInfo [data-md="toggle"]',
  note: '#medDayInfo [data-md="note"]', dayErr: '#medDayErr', courses: '#medCourses [data-md-course]', add: '#medBody [data-md="add"]',
  card: '#medCard', homeTake: '#medHomeTake', homeOpen: '#medHomeOpen', cardErr: '#medCardErr',
  sheet: '#medSheet', form: '#medForm', name: '#mdName', start: '#mdStart', pills: '#mdPills', perDay: '#mdPerDay [data-step]', perDayVal: '#mdPerDayVal',
  visitDate: '#mdVisit', end: '#mdEnd', endField: '#mdEndField', preview: '#mdPreview', closeNote: '#mdCloseNote', formErr: '#medFormErr', save: '#medSave',
  del: '#medDelete', confirm: '#medConfirm', confirmText: '#medConfirmText', confirmYes: '#medConfirmYes', confirmNo: '#medConfirmNo',
  noteSheet: '#medNoteSheet', noteTitle: '#medNoteTitle', noteText: '#mdnText', noteSave: '#mdnSave',
  show: '#medShow', morning: '#medMorning', quiet: '#medQuiet', test: '#btnMedTest', testNote: '#medTestNote', open: '#btnMedOpen'
};

// ---------- Giảm cân (v1.21): kv 'weight' ----------
// { key:'weight', profile: null | { heightCm, goalKg, goalDate:'YYYY-MM-DD'|null, ratePerWeek: 0.25|0.5|0.75|1, startDate:'YYYY-MM-DD'|null,
//                                   activity: 'low'|'mid'|'high'|null (v1.23; anything else reads as null, the profile stays valid) },
//   log: [{ date:'YYYY-MM-DD', kg (≤ 1 decimal, 20–300), note (≤ 100), at: ms|null }], updatedAt }
// kv 'meta' adds showWeight (Home card, default true) and weightMorning (morning push line, default true).
// ALL NUMBERS BELOW ARE MADE UP (public repo): never put a real height or weight here.
// Pure maths (same in every TZ): LoveCore.weightStats(raw, nowMs), weightChart(raw, '30'|'90'|'all', nowMs), mergeWeight, weightMorningLines.
const wt = (date, kg, note) => ({ date, kg, note: note || '', at: Date.parse(date + 'T07:05:00+07:00') });
const weightRecord = (profile, log) => ({ key: 'weight', profile, log, updatedAt: 1 });
const weightP = { heightCm: 172, goalKg: 70, goalDate: null, ratePerWeek: 0.5, startDate: null };
// 07/10, 11/10, 14/10 not weighed; 12/10 has a note.
const weightW = [wt('2026-10-04', 82.0), wt('2026-10-05', 82.2), wt('2026-10-06', 81.6), wt('2026-10-08', 82.0), wt('2026-10-09', 81.2), wt('2026-10-10', 81.5),
  wt('2026-10-12', 80.8, 'Sau bữa tiệc'), wt('2026-10-13', 81.3), wt('2026-10-15', 80.9), wt('2026-10-16', 80.6), wt('2026-10-17', 80.8)];
const weight = {
  now: '2026-10-17T09:00:00+07:00',   // Thứ bảy, today already weighed (80,8 at 07:05)
  P: weightP, W: weightW,
  // BMI by the WHO Asia-Pacific cut-offs (18,5 / 23 / 25): 80,8 / 1,72² = 27,31 → "Béo phì" (international cut-offs would say "Thừa cân")
  expected: {
    bmi: '27,3', bmiClass: 'Béo phì', bmiMaxKg: '67,8',                       // 67,8 kg still shows BMI 22,9 (floor(22,9·h²) = 67,7 is one step short)
    avg7: '80,9', latest: '80,8 kg', latestSub: 'hôm nay · 07:05',           // avg over the 7 CALENDAR days 11–17/10 (5 weigh-ins), not the last 7 weigh-ins (81,0)
    label: 'Đã cân hôm nay: 80,8 kg · nhập lại để sửa', save: 'Sửa',
    pct: '9% chặng đường · còn 10,9 kg',
    lost: '1,1 kg', lostSub: ['7 ngày: 0,9 kg', '30 ngày: —'],                  // 82,0 − 80,88; avg7(10/10) 81,75 − 80,88
    rate: '0,8 kg/tuần', rateRaw: 0.7656,                                   // least squares over 04–17/10 (11 weigh-ins), −7·slope
    planToday: '81,1 kg', vsPlan: 'Nhanh hơn 0,2 kg',                       // 82 − 13·0,5/7 = 81,07
    eta: 'Thứ hai, 25/01/2027', etaSub: ['theo tốc độ thực tế', 'lộ trình: 21/03/2027'],   // ceil(10,88 / (0,7656/7)) = 100 days; plan 168 days
    mark: '🎉 Đã giảm 1 kg · mốc tiếp: 2 kg (còn 0,9 kg)',
    goalRow: 'Mục tiêu 70,0 kg · 0,5 kg/tuần · cao 172 cm',
    preview: 'Từ 82,0 kg (04/10/2026) xuống 70,0 kg: giảm 12,0 kg, 0,5 kg/tuần → tới Chủ nhật, 21/03/2027. BMI ở 70,0 kg là 23,7 — vẫn thừa cân theo ngưỡng châu Á; mức bình thường với 172 cm là đến 67,8 kg.',
    list: 11, listFirst: ['Thứ bảy, 17/10/2026', '80,8 kg', '▲ 0,2'], list16: '▼ 0,3', list15: '▼ 0,4', list12: ['Sau bữa tiệc', '▼ 0,7'],
    home: ['⚖️ 80,8 kg · BMI 27,3', 'Đã giảm 1,1 kg · còn 10,9 kg'],
    homeNoProfile: 'TB 7 ngày 80,9 kg',
    // tap 15/10 on the chart
    info15: 'Thứ năm, 15/10/2026 · 80,9 kg · TB 7 ngày 81,1 kg · lộ trình 81,2 kg',
    // "Sửa" with 80,7 → entry 17/10 kg 80.7, note kept; avg7 still 80,9; BMI 27,3; toast below
    edit807: { avg7: '80,9', bmi: '27,3', toast: 'Đã sửa cân hôm nay ✓' }
  },
  // weightChart(W, '30', now): x 04/10 → 17/10 (296/13 per day); goal 70 is 10,6 below the data (> 1,5 × 2,0) → pinned, axis NOT stretched
  chart30: { xMin: '2026-10-04', xMax: '2026-10-17', yMin: 80, yMax: 83, step: 0.5, points: 11,
    pts: { '2026-10-04': [36, 65.33], '2026-10-05': [58.77, 54.27], '2026-10-16': [309.23, 142.8], '2026-10-17': [332, 131.73] },
    avgStart: [81.54, 69.02], avgEnd: [332, 127.31], planPath: 'M36,65.33L332,116.71', goal: { v: 70, y: 176, pinned: 'below' },
    xTicks: ['04/10', '10/10', '17/10'], hit16: [297.85, 320.62] },
  // 'all' (v1.22): x runs past today by max(14, 25% of the 13 data days) = 14 days, the plan to 21/03/2027 is cut at the right edge;
  // same 1,5 × range rule for the Y axis as 30/90 → goal 70 pinned below, plan (82,0 → 80,1 by 31/10) inside the frame
  chartAll: { xMin: '2026-10-04', xMax: '2026-10-31', yMin: 79.5, yMax: 82.5, goal: { v: 70, y: 176, pinned: 'below' } },
  // 14 daily weigh-ins 04→17/10, 82,0 − 0,2·i → 1,4 kg/tuần → .wt-warn
  fast: Array.from({ length: 14 }, (_, i) => wt(new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10), Math.round((82 - 0.2 * i) * 10) / 10)),
  fastText: 'Hai tuần qua giảm khoảng 1,4 kg mỗi tuần — nhanh hơn mức thường được khuyên (0,5–1 kg/tuần). Nhớ ăn đủ bữa, đủ đạm và uống đủ nước nhé.',
  // W without 06, 09, 12, 13, 15, 16 → 5 weigh-ins in 14 days → no rate / ETA / warning
  few: weightW.filter(e => !['2026-10-06', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16'].includes(e.date)),
  fewText: 'Cần ít nhất 6 lần cân trong 2 tuần để ước tốc độ',
  // At 2026-10-18T00:00:05+07: avg7 80,9, rate 0,7848 → 0,8, ETA Chủ nhật, 24/01/2027, plan 81,0
  rollover: { now: '2026-10-17T23:59:50+07:00', after: '2026-10-18T00:00:05+07:00', eta: 'Chủ nhật, 24/01/2027', planToday: '81,0 kg', vsPlan: 'Nhanh hơn 0,1 kg' },
  timezones: [['America/Los_Angeles', '2026-10-17T09:00:00+07:00'], ['Asia/Tokyo', '2026-10-17T23:30:00+07:00']],   // both write date 2026-10-17
  // Import "Gộp": device = W; file from device B. → 13 weigh-ins, 17/10 stays 80,8, goal stays 172/70; avg7 81,0, 7 ngày 0,8, đã giảm 1,0, ETA Chủ nhật, 24/01/2027
  mergeB: { profile: { heightCm: 175, goalKg: 72, goalDate: null, ratePerWeek: 0.5, startDate: null },
    log: [wt('2026-10-07', 81.9), wt('2026-10-11', 81.4), wt('2026-10-17', 80.5)] },
  broken: { record: { key: 'weight', profile: null, log: 'x', updatedAt: 1 }, text: 'Không đọc được dữ liệu cân nặng — dữ liệu vẫn còn nguyên.' },
  stale: 'Cân nặng vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại.',
  errors: { empty: 'Hãy nhập số cân', format: 'Ghi số cân dạng 80,5 — tối đa một chữ số sau dấu phẩy', range: 'Số cân từ 20 đến 300 kg',
    height: 'Chiều cao từ 100 đến 250 cm', goalAbove: 'Cân mục tiêu phải thấp hơn cân bắt đầu (82,0 kg)',
    dup15: 'Ngày 15/10/2026 đã có số cân 80,9 kg — chạm vào ngày đó trong danh sách để sửa', goalDatePast: 'Ngày mục tiêu phải sau hôm nay' },
  morningLine: '⚖️ Nhớ cân hôm nay',
  // v1.23 "Đánh giá" + "Gợi ý cho Viết Long" (LoveCore.weightAdvice(raw, dob, nowMs, pre)). now 18/10 (NOT weighed yet → latest 17/10),
  // profile P, log W, Viết Long's made-up dob 1998-05-20 → 28 tuổi. Same numbers in every TZ.
  advice: {
    now: '2026-10-18T09:00:00+07:00',
    assess: { main: 'BMI 27,3 Béo phì', pos: 70.6, goalPos: 48.1, normal: '54,6–67,8 kg', toOver: 'giảm 7,0 kg', overMax: 'về 73,8 kg',
      toNormal: 'giảm 13,0 kg', normalMax: 'về 67,8 kg', goalBmi: '23,7 Thừa cân', basis: 'Theo lần cân 17/10 · ngưỡng BMI châu Á (WHO).',
      note: 'Theo chuẩn châu Á, 172 cm cân 80,8 kg đang ở nhóm béo phì. Mỗi kg giảm được đều có lợi cho sức khoẻ — về 73,8 kg là sang nhóm thừa cân.',
      aria: 'Thang BMI châu Á: 27,3, nhóm Béo phì. Bình thường từ 18,5 đến 22,9.' },
    // BMR 10·80,8 + 6,25·172 − 5·28 + 5 = 1748; deficit 0,5 kg/tuần = 550 kcal/ngày; floor 1.500
    bmr: '1.750 kcal',
    levels: { low: { tdee: '2.100 kcal', sub: 'Ít vận động × 1,2', range: '1.500–1.650 kcal', target: 'quanh 1.550 kcal · để giảm 0,5 kg/tuần' },
              mid: { tdee: '2.400 kcal', sub: 'Vừa phải × 1,375', range: '1.750–1.950 kcal', target: 'quanh 1.850 kcal · để giảm 0,5 kg/tuần' },
              high: { tdee: '2.700 kcal', sub: 'Nhiều × 1,55', range: '2.050–2.250 kcal', target: 'quanh 2.150 kcal · để giảm 0,5 kg/tuần' } },
    protein: '84–112 g/ngày', water: '2,8 lít/ngày',
    tip1: 'Đang giảm đều 0,8 kg/tuần — đúng nhịp an toàn. Cứ giữ thói quen hiện tại.',   // trend 05–18/10, rate 0,7848
    habits: { walk: 'Thêm 15 phút đi bộ sau bữa tối — 5 tối là thêm 75 phút vận động mỗi tuần.', drink: 'Đổi nước ngọt, trà sữa sang trà không đường hoặc nước lọc.',
      rice: 'Ăn rau trước, cơm sau; bớt nửa bát cơm buổi tối.', protein: 'Mỗi bữa có một phần đạm cỡ lòng bàn tay: thịt nạc, cá, trứng hoặc đậu phụ.' },
    basis: 'Tính theo 80,8 kg · 172 cm · 28 tuổi · nam (công thức Mifflin-St Jeor).',
    disclaimer: 'Số liệu chỉ để tham khảo, không thay lời khuyên của bác sĩ. Nếu đang điều trị bệnh, hãy hỏi bác sĩ trước khi ăn kiêng.',
    floorWarn: 'Không nên ăn dưới 1.500 kcal mỗi ngày. Muốn giảm nhanh hơn thì vận động thêm thay vì ăn ít đi.',   // ratePerWeek 0,75 / 1
    noDob: 'Thêm ngày sinh của Viết Long ở Cài đặt → Hồ sơ để tính mức ăn mỗi ngày.', noProfile: 'Nhập chiều cao để xem đánh giá cân nặng.'
  }
};
const weightSel = {
  seg: k => '#healthSeg [data-health-seg="' + k + '"]', pane: '#weightPane', err: '#weightErr', form: '#wtTodayForm', kg: '#wtKg', kgLabel: '#wtKgLabel',
  save: '#wtSave', kgErr: '#wtKgErr', now: '#wtNow', nowStats: '#wtNow .med-stat', body: '#wtBody', progress: '#wtBody .wt-progress', pct: '#wtBody .wt-pct',
  stats: '#wtBody .wt-stats .med-stat', mark: '#wtBody .wt-mark', warn: '#wtBody .wt-warn', range: '#wtRange', rangeBtn: k => '#wtRange [data-wt-range="' + k + '"]',
  chart: '#wtChart', svg: '#wtChart svg', pt: '#wtChart .wt-pt', avg: '#wtChart .wt-avg', plan: '#wtChart .wt-plan', goal: '#wtChart .wt-goal', goalLbl: '#wtChart .wt-goal-lbl',
  // hit: one rect per weigh-in only while the frame holds ≤ 400 of them; above that (v1.22) the chart draws weekly dots and ONE
  // rect.wt-hit.wt-hit-all over the plot — tap at an x and the nearest weigh-in is picked. Lists of hidden tabs/parts are built when shown.
  hit: d => '#wtChart rect.wt-hit[data-wt-day="' + d + '"]', sel: '#wtChart .wt-sel', legend: '#wtLegend', info: '#wtChartInfo',
  goalOpen: '#wtGoalOpen', add: '#wtBody [data-wt="add"]', more: '#wtBody [data-wt="more"]', list: '#wtList', item: d => '#wtList [data-wt-day="' + d + '"]',
  card: '#weightCard', homeForm: '#wtHomeForm', homeKg: '#wtHomeKg', homeSave: '#wtHomeSave', homeErr: '#wtHomeErr', homeSub: '#wtHomeSub',
  homeOpen: '#wtHomeOpen', homeOpenTitle: '#wtHomeOpenTitle', homeOpenSub: '#wtHomeOpenSub',
  goalSheet: '#wtGoalSheet', goalForm: '#wtGoalForm', height: '#wgHeight', heightErr: '#wgHeightErr', goalKg: '#wgGoal', goalErr: '#wgGoalErr',
  start: '#wgStart', startErr: '#wgStartErr', mode: k => '#wgMode [data-wg-mode="' + k + '"]', rate: k => '#wgRate [data-wg-rate="' + k + '"]',
  goalDate: '#wgDate', goalDateErr: '#wgDateErr', preview: '#wgPreview', goalFormErr: '#wgFormErr', goalSave: '#wgSave',
  entrySheet: '#wtEntrySheet', entryTitle: '#wtEntryTitle', entryDate: '#weDate', entryDateErr: '#weDateErr', entryKg: '#weKg', entryKgErr: '#weKgErr',
  entryNote: '#weNote', entryFormErr: '#weFormErr', entrySave: '#weSave', entryDelete: '#weDelete', confirm: '#weConfirm', confirmText: '#weConfirmText',
  confirmYes: '#weConfirmYes', confirmNo: '#weConfirmNo',
  setTitle: '#wtSetTitle', setCard: '#wtSetCard', show: '#wtShow', morning: '#wtMorning', open: '#btnWtOpen',
  // v1.23: both cards are built only when LoveCore.weightAdvice exists (a 1.22 core left in the cache shows neither)
  assess: '#wtAssess', assessMain: '#wtAssess .wt-assess-main', scale: '#wtAssess .wt-scale', scaleNow: '#wtAssess .wt-scale-now',
  assessStats: '#wtAssess .med-stat', assessNote: '#wtAssess .wt-assess-note', advice: '#wtAdvice', act: k => '#wtAct [data-wt="act-' + k + '"]',
  energyNum: '#wtAdvice .wt-energy-num', adviceStats: '#wtAdvice .med-stat', tips: '#wtAdvice .wt-tips li', adviceWarn: '#wtAdvice .wt-warn',
  basis: '#wtAdvice .card-hint:not(.wt-disclaimer)', disclaimer: '#wtAdvice .wt-disclaimer'
};

// Adds album photos with chosen ids and dates: list of [id, takenAt (ms or null), addedAt (ms)]. Call after seed().
async function seedPhotoList(page, list) {
  await page.evaluate(async list => {
    const db = await LoveCore.openDb();
    const enc = (c, q) => new Promise(r => c.toBlob(b => b.arrayBuffer().then(r), 'image/jpeg', q));
    let i = 0;
    for (const [id, takenAt, addedAt] of list) {
      i++;
      const c = document.createElement('canvas'); c.width = 800; c.height = 600;
      const g = c.getContext('2d');
      g.fillStyle = 'hsl(' + (i * 67 % 360) + ',65%,60%)'; g.fillRect(0, 0, 800, 600);
      g.fillStyle = '#fff'; g.font = 'bold 220px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(id, 400, 310);
      const data = await enc(c, 0.8);
      const t = document.createElement('canvas'); t.width = 480; t.height = 360; t.getContext('2d').drawImage(c, 0, 0, 480, 360);
      const thumb = await enc(t, 0.75);
      const tx = db.transaction(['photos', 'blobs'], 'readwrite');
      tx.objectStore('blobs').put({ id, gen: 'g1', mime: 'image/jpeg', data, thumb });
      tx.objectStore('photos').put({ id, gen: 'g1', caption: '', takenAt, addedAt, order: i - 1, w: 800, h: 600, bytes: data.byteLength, sha256: await LoveMedia.sha256(data) });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    }
    db.close();
  }, list);
}

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
  wi, wishesRecord, wishes, wishSel, onThisDay, otdSel, seedPhotoList, dayRemind, dayRemindSel, j, journalRecord, journal, journalSel, recap, recapSel,
  md, me, mn, medRecord, med, medSel, wt, weightRecord, weight, weightSel };
