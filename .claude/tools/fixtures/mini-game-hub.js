// Standard GameHub Offline (mini-game-hub) test scenario with hand-computed expectations (v2.0).
// Pair with harness.open({ path: gh.path, now: gh.now.main, localStorage: gh.seedV2 }).
//
// Data shapes:
//   localStorage gamehub_v3 — the ONLY key the app writes:
//     { version:3, xp (XP inside the current level), level, plays, seconds, theme, unlockedThemes[], sound, batterySaver,
//       achievements:{id:ms}, best:{gameId:{v,at}}, stats:{gameId:{plays,seconds,last}}, favorites:[gameId],
//       days:{'YYYY-MM-DD' (VN date):{plays,seconds,idle,claimed:{open3|play5|idleTap:true}}} (last 60 days),
//       streakBest, idle:{gameId:{flat object of finite numbers ≥ 0}}, updatedAt }
//   Legacy 1.x keys (read once by the migration, never written or removed): gamehub_profile_v2, hs_<gameId>,
//     bestReaction, save_idle*, activeCat, activeDur. The site's root index.js shares hs_snake / hs_flappy / hs_react.
//   Backup file: { app:'mini-game-hub', kind:'progress', version:1, exportedAt, state }, name game-hub-YYYY-MM-DD.json (VN date).
//   Legacy save code: base64(JSON { profile, local:{ hs_*, save_idle*, bestReaction, … } }) — pasted in Cài đặt → Dán mã save cũ.
// Pure logic lives in window.GameHubCore (node: require('<repo>/products/mini-game-hub/js/mini-game-hub-core.js')).
// XP: xpNeed(level) = 100 + level*55 (L1→2 155, L2→3 210, L3→4 265, L4→5 320); +5 per game open, +3 per 15 s played,
// missions 40/60/50, achievements 35 each.
//
// The play clock counts 1-second interval ticks (not Date.now), so `now` (page.clock.setFixedTime) does not stop it;
// use page.clock.install() + page.clock.runFor(ms) to move game time deterministically.

const path = '/products/mini-game-hub/html/index.html';

const now = {
  main: '2026-10-11T03:00:00Z',        // 10:00 VN on 11/10
  nextDay: '2026-10-11T18:30:00Z',     // 01:30 VN on 12/10 — also run with timezoneId America/Los_Angeles / Asia/Tokyo
  beforeMidnight: '2026-10-11T16:59:00Z',
  afterMidnight: '2026-10-11T17:00:30Z',
  twoDaysLater: '2026-10-13T17:00:30Z'
};
const vnDay = { main: '2026-10-11', nextDay: '2026-10-12' };

const IDLE_LAST = Date.parse('2026-10-11T02:59:50Z');   // 10 s before now.main → +10 quặng offline at auto 1/s
const legacyProfile = {
  xp: 90, level: 3, plays: 12, seconds: 600, theme: 'ocean', unlockedThemes: ['default', 'ocean'], sound: false, batterySaver: false,
  missions: { '2026-10-11': { open3: false, play5: false, idleTap: true, claimed: { open3: true } } },
  achievements: { first_game: 1791733915757 }
};
// 1.x profile as it sits in localStorage.
const seedV2 = {
  gamehub_profile_v2: JSON.stringify(legacyProfile),
  hs_snake: '7', hs_pong: '13', bestReaction: '250',
  save_idleMine: JSON.stringify({ coins: 10, lvl: 6, power: 2, auto: 1, last: IDLE_LAST }),
  activeCat: 'Arcade'
};
// gamehub_v3 right after the one-time migration (compare with strip()).
const migrated = {
  version: 3, xp: 90, level: 3, plays: 12, seconds: 600, theme: 'ocean', unlockedThemes: ['default', 'ocean'], sound: false, batterySaver: false,
  achievements: { first_game: 1791733915757 },
  best: { snake: { v: 7 }, pong: { v: 13 }, reaction: { v: 250 } },
  stats: {}, favorites: [],
  days: { '2026-10-11': { plays: 0, seconds: 0, idle: true, claimed: { open3: true } } },
  streakBest: 0, streakN: 0, streakDay: '',
  idle: { idleMine: { coins: 10, lvl: 6, power: 2, auto: 1, last: IDLE_LAST } }
};
const fresh = {
  version: 3, xp: 0, level: 1, plays: 0, seconds: 0, theme: 'default', unlockedThemes: ['default'], sound: true, batterySaver: false,
  achievements: {}, best: {}, stats: {}, favorites: [], days: {}, streakBest: 0, streakN: 0, streakDay: '', idle: {}
};
// A valid v3 profile with two played days (10/10 and 11/10) and every achievement already earned (no toasts while testing).
function v3(extra){
  return JSON.stringify(Object.assign({}, fresh, {
    xp: 20, level: 5, plays: 9, seconds: 300,
    achievements: { first_game: 1, five_games: 1, xp_500: 1, idle_5: 1, high_50: 1 },
    days: { '2026-10-10': { plays: 2, seconds: 60, idle: false, claimed: {} }, '2026-10-11': { plays: 1, seconds: 30, idle: false, claimed: {} } },
    stats: { flappy: { plays: 5, seconds: 200, last: 1791680000000 }, tictactoe: { plays: 3, seconds: 80, last: 1791670000000 }, idleMine: { plays: 1, seconds: 20, last: 1791660000000 } },
    updatedAt: 1791680000000
  }, extra || {}));
}

const expected = {
  xpNeed: { 1: 155, 2: 210, 3: 265, 4: 320 },
  home: { level: 'Cấp 3', xp: '90 / 265 XP' },            // seedV2
  firstOpen: { xp: 40, plays: 1 },                        // fresh profile: 5 (open) + 35 (first_game)
  missionsNewDay: ['0/3', '0/5 phút', '0/1'],              // seedV2 at now.nextDay
  streak: { a: 2, b: 2, c: 3, d: 0, e: 1 },               // scenario #8, see docs
  readyGames: 30,                                         // every catalog id has a def; cards follow catalog order
  catalogSize: 30
};

const sel = {
  tab: t => '.tabbar-btn[data-tab="' + t + '"]',           // home | games | settings
  level: '#levelText', xp: '#xpText', streak: '#streakText',
  recentCards: '#recentRow .recent-card', newNote: '#newNote',
  missionCard: '#missionCard', missionRows: '#missionList .mission', missionProgress: '#missionList .mission-sub', claim: id => '[data-claim="' + id + '"]',
  achRows: '#achList .ach', stats: '#statGrid .stat',
  search: '#searchInput', chip: f => '.chip[data-filter="' + f + '"]',   // all | fav | Arcade | Trí tuệ | …
  cards: '#gameGrid .game-card', card: id => '#gameGrid [data-open="' + id + '"]', fav: id => '#gameGrid [data-fav="' + id + '"]', empty: '#gameGrid .empty',
  gameScreen: '#gameScreen', gameTitle: '#gameTitle', gameClose: '#gameClose', gameHelp: '#gameHelp', gameRestart: '#gameRestart',
  gameStats: '#gameStats .gstat', gameRoot: '#gameRoot', pauseLayer: '#pauseLayer', resume: '#btnResume', errorLayer: '#errorLayer',
  resultSheet: '#resultSheet', resultTitle: '#resultTitle', resultScore: '#resultScore', resultBadge: '#resultBadge', resultXp: '#resultXp', again: '#btnAgain', other: '#btnOther',
  confirmSheet: '#confirmSheet', confirmOk: '#confirmOk', confirmCancel: '#confirmCancel',
  restoreSheet: '#restoreSheet', restoreInfo: '#restoreInfo', restoreNow: '#btnRestoreNow', restoreSaveFirst: '#btnRestoreSaveFirst', restoreError: '#restoreError',
  backup: '#btnBackup', restore: '#btnRestore', restoreFile: '#restoreFile', dataError: '#dataError', reset: '#btnReset',
  legacyBox: '#legacyBox', legacyText: '#legacyText', legacyRead: '#btnLegacy', legacyError: '#legacyError',
  banner: '#corruptBanner', brokenSave: '#btnBrokenSave', brokenRestore: '#btnBrokenRestore', brokenReset: '#btnBrokenReset',
  sound: '#swSound', saver: '#swSaver', theme: id => '[data-theme-id="' + id + '"]', changelog: '#btnChangelog', version: '#versionText', diag: '#diagLine',
  toast: '#toast'
};

// gamehub_v3 as an object (null when missing or unparsable).
async function state(page){
  return page.evaluate(() => { try{ return JSON.parse(localStorage.getItem('gamehub_v3')); }catch(e){ return null; } });
}
// Drop the timestamps that depend on when the test ran.
function strip(st){
  if(!st) return st;
  const out = JSON.parse(JSON.stringify(st));
  delete out.updatedAt;
  Object.keys(out.best || {}).forEach(id => { delete out.best[id].at; });
  return out;
}
async function goTab(page, tab){
  await page.click(sel.tab(tab));
}
// Opens a game from the Trò chơi tab with a real click and waits for its screen.
async function openGame(page, id){
  if(await page.isHidden('#viewGames')) await goTab(page, 'games');
  await page.click(sel.card(id));
  await page.waitForSelector(sel.gameScreen + ':not([hidden])');
}
async function closeGame(page){
  await page.click(sel.gameClose);
  await page.waitForSelector(sel.gameScreen, { state: 'hidden' });
}
// Simulates the app going to the background / coming back.
async function setVisibility(page, v){
  await page.evaluate(v => {
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    Object.defineProperty(document, 'hidden', { value: v === 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);
}

module.exports = { path, now, vnDay, IDLE_LAST, legacyProfile, seedV2, migrated, fresh, v3, expected, sel, state, strip, goTab, openGame, closeGame, setVisibility };
