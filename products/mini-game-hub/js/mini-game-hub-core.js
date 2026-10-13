// Logic thuần của GameHub: không DOM, không localStorage. Dùng chung cho trang
// (window.GameHubCore) và test bằng node (require).
(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.GameHubCore = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  var HOUR_MS = 3600000, DAY_MS = 86400000;
  var MAX_NUM = 9007199254740991;
  var MAX_BACKUP_CHARS = 1024 * 1024;
  var KEEP_DAYS = 60;
  var ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  var CATALOG = [
    { id: 'tictactoe', icon: '⭕', name: 'Cờ caro 3x3', desc: 'Đấu với máy đơn giản', cat: 'Trí tuệ', dur: '5p' },
    { id: 'snake', icon: '🐍', name: 'Rắn săn mồi', desc: 'Ăn táo và tránh va chạm', cat: 'Arcade', dur: '5p' },
    { id: 'memory', icon: '🧠', name: 'Lật thẻ nhớ', desc: 'Tìm các cặp biểu tượng', cat: 'Trí tuệ', dur: '5p' },
    { id: 'mole', icon: '🔨', name: 'Đập chuột', desc: 'Chạm thật nhanh trong 30 giây', cat: 'Phản xạ', dur: '1p' },
    { id: 'reaction', icon: '⚡', name: 'Phản xạ nhanh', desc: 'Chờ màu xanh rồi bấm', cat: 'Phản xạ', dur: '1p' },
    { id: 'rps', icon: '✊', name: 'Kéo búa bao', desc: 'Đấu may mắn với máy', cat: 'May mắn', dur: '1p' },
    { id: 'math', icon: '➕', name: 'Tính nhanh', desc: 'Trả lời phép tính trong 60 giây', cat: 'Trí tuệ', dur: '1p' },
    { id: 'target', icon: '🎯', name: 'Bắn mục tiêu', desc: 'Chạm mục tiêu di chuyển', cat: 'Phản xạ', dur: '1p' },
    { id: 'pong', icon: '🏓', name: 'Pong mini', desc: 'Giữ bóng không rơi', cat: 'Arcade', dur: '5p' },
    { id: 'g2048', icon: '🔢', name: '2048 mini', desc: 'Gộp số để đạt điểm cao', cat: 'Trí tuệ', dur: '15p' },
    { id: 'idleMine', icon: '⛏️', name: 'IDLE Đào mỏ', desc: 'Đào quặng, nâng cấp, cày cấp', cat: 'IDLE', dur: '∞' },
    { id: 'idleFarm', icon: '🌾', name: 'IDLE Nông trại', desc: 'Trồng lúa, bán hàng, mở rộng', cat: 'IDLE', dur: '∞' },
    { id: 'idleCafe', icon: '☕', name: 'IDLE Quán cà phê', desc: 'Pha cà phê, thuê nhân viên', cat: 'IDLE', dur: '∞' },
    { id: 'idleSpace', icon: '🚀', name: 'IDLE Không gian', desc: 'Thu năng lượng, nâng tàu', cat: 'IDLE', dur: '∞' },
    { id: 'idleDragon', icon: '🐉', name: 'IDLE Nuôi rồng', desc: 'Cho ăn, luyện cấp, tiến hoá', cat: 'IDLE', dur: '∞' },
    { id: 'guessNumber', icon: '🔮', name: 'Đoán số', desc: 'Tìm số bí mật từ 1 đến 100', cat: 'Trí tuệ', dur: '5p' },
    { id: 'wordScramble', icon: '🔤', name: 'Xếp chữ', desc: 'Sắp lại chữ cái thành từ đúng', cat: 'Trí tuệ', dur: '5p' },
    { id: 'colorMatch', icon: '🌈', name: 'Chọn màu đúng', desc: 'Chọn theo màu tô của chữ', cat: 'Phản xạ', dur: '1p' },
    { id: 'tapRace', icon: '👆', name: 'Tap Race', desc: 'Chạm thật nhiều trong 10 giây', cat: 'Phản xạ', dur: '1p' },
    { id: 'diceDuel', icon: '🎲', name: 'Đấu xúc xắc', desc: 'Đổ xúc xắc thắng máy', cat: 'May mắn', dur: '1p' },
    { id: 'coinFlip', icon: '🪙', name: 'Tung đồng xu', desc: 'Đoán liên tiếp sấp hay ngửa', cat: 'May mắn', dur: '1p' },
    { id: 'blackjack', icon: '🃏', name: '21 điểm mini', desc: 'Rút bài gần 21 nhất', cat: 'May mắn', dur: '5p' },
    { id: 'simon', icon: '💡', name: 'Nhớ chuỗi màu', desc: 'Lặp lại thứ tự đèn sáng', cat: 'Trí tuệ', dur: '5p' },
    { id: 'mines', icon: '💣', name: 'Dò mìn mini', desc: 'Tránh 10 quả mìn trong lưới 8x8', cat: 'Trí tuệ', dur: '5p' },
    { id: 'maze', icon: '🧭', name: 'Mê cung', desc: 'Tìm đường đi tới đích', cat: 'Arcade', dur: '5p' },
    { id: 'flappy', icon: '🐦', name: 'Flappy mini', desc: 'Bay qua khe giữa các cột', cat: 'Arcade', dur: '1p' },
    { id: 'runner', icon: '🏃', name: 'Runner', desc: 'Nhảy qua vật cản', cat: 'Arcade', dur: '1p' },
    { id: 'slider', icon: '🧩', name: 'Xếp hình 3x3', desc: 'Sắp số theo thứ tự', cat: 'Trí tuệ', dur: '15p' },
    { id: 'tower', icon: '🏗️', name: 'Xếp tháp', desc: 'Thả khối đúng nhịp', cat: 'Arcade', dur: '5p' },
    { id: 'breath', icon: '🧘', name: 'Thở thư giãn', desc: 'Hít thở chậm theo nhịp', cat: 'Thư giãn', dur: '5p' }
  ];
  var GAME_IDS = CATALOG.map(function(g){ return g.id; });
  var CATS = ['Arcade', 'Trí tuệ', 'Phản xạ', 'May mắn', 'IDLE', 'Thư giãn'];
  var DUR_LABEL = { '1p': '1 phút', '5p': '5 phút', '15p': '15 phút', '∞': 'Tuỳ thích' };

  var THEMES = [
    { id: 'default', name: 'Mặc định', level: 1 },
    { id: 'ocean', name: 'Ocean', level: 2 },
    { id: 'sunset', name: 'Sunset', level: 3 },
    { id: 'forest', name: 'Forest', level: 5 },
    { id: 'neon', name: 'Neon', level: 8 }
  ];
  var MISSIONS = [
    { id: 'open3', title: 'Mở 3 lượt game', reward: 40, goal: 3 },
    { id: 'play5', title: 'Chơi 5 phút', reward: 60, goal: 5 },
    { id: 'idleTap', title: 'Chơi một game IDLE', reward: 50, goal: 1 }
  ];
  // id giữ nguyên từ bản cũ (xp_500 nay là "Cấp 5") để huy hiệu đã có không mất.
  var ACHIEVEMENTS = [
    { id: 'first_game', icon: '🎮', name: 'Khởi động', desc: 'Mở game đầu tiên', goal: 1 },
    { id: 'five_games', icon: '🕹️', name: 'Người chơi mới', desc: 'Mở 5 lượt game', goal: 5 },
    { id: 'xp_500', icon: '⭐', name: 'Cấp 5', desc: 'Lên tới cấp 5', goal: 5 },
    { id: 'idle_5', icon: '⛏️', name: 'IDLE cấp 5', desc: 'Một game IDLE đạt cấp 5', goal: 5 },
    { id: 'high_50', icon: '🔥', name: 'Điểm 50+', desc: 'Một game đạt kỷ lục từ 50 điểm', goal: 50 }
  ];
  var XP_OPEN = 5, XP_PER_15S = 3, XP_ACHIEVEMENT = 35;
  var DEFAULT_LOW_IDS = ['reaction'];

  function own(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(x){ return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function isNum(n, min){ return typeof n === 'number' && isFinite(n) && n >= min && n <= MAX_NUM; }
  function isInt(n, min){ return isNum(n, min) && Math.floor(n) === n; }
  function findBy(list, id){
    for(var i = 0; i < list.length; i++) if(list[i].id === id) return list[i];
    return null;
  }
  function catalogOf(id){ return findBy(CATALOG, id); }

  // ---------- Ngày (giờ Việt Nam, UTC+7, không phụ thuộc múi giờ máy) ----------
  function vnToday(nowMs){
    return new Date((nowMs == null ? Date.now() : nowMs) + 7 * HOUR_MS).toISOString().slice(0, 10);
  }
  function isDay(s){
    if(typeof s !== 'string' || !DAY_RE.test(s)) return false;
    var t = Date.parse(s + 'T00:00:00Z');
    return isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
  }
  function dayAdd(day, n){
    return new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
  }

  // ---------- XP ----------
  function xpNeed(level){ return 100 + level * 55; }
  // state.xp là XP TRONG cấp hiện tại. Trả về chính state (đã sửa).
  function addXp(state, n){
    if(isNum(n, 0)) state.xp += Math.floor(n);
    while(state.xp >= xpNeed(state.level)){ state.xp -= xpNeed(state.level); state.level++; }
    return state;
  }

  // ---------- Trạng thái ----------
  function defaultState(){
    return { version: 3, xp: 0, level: 1, plays: 0, seconds: 0, theme: 'default', unlockedThemes: ['default'],
      sound: true, batterySaver: false, achievements: {}, best: {}, stats: {}, favorites: [], days: {},
      streakBest: 0, streakN: 0, streakDay: '', idle: {}, updatedAt: 0 };
  }
  function themeUnlocked(state, id){
    var t = findBy(THEMES, id);
    return !!t && (state.unlockedThemes.indexOf(id) !== -1 || state.level >= t.level);
  }
  function cleanSave(obj){
    if(!isObj(obj)) return null;
    var keys = Object.keys(obj), out = {};
    if(keys.length > 24) return null;
    for(var i = 0; i < keys.length; i++){
      if(!ID_RE.test(keys[i]) || !isNum(obj[keys[i]], 0)) return null;
      out[keys[i]] = obj[keys[i]];
    }
    return out;
  }
  function cleanClaimed(raw){
    var out = {};
    if(isObj(raw)) MISSIONS.forEach(function(m){ if(own(raw, m.id) && raw[m.id] === true) out[m.id] = true; });
    return out;
  }

  // Trả { state } (bản sao sạch) hoặc { error: 'lý do' }. Không sửa raw.
  function checkState(raw){
    if(!isObj(raw)) return { error: 'thiếu phần tiến trình' };
    if(raw.version !== 3) return { error: 'phiên bản dữ liệu ' + String(raw.version).slice(0, 12) + ' không được hỗ trợ' };
    var num = { xp: 0, level: 1, plays: 0, seconds: 0, streakBest: 0 }, k, i, keys;
    for(k in num) if(!isInt(raw[k], num[k])) return { error: 'trường "' + k + '" không hợp lệ' };
    if(raw.level > 1000000) return { error: 'trường "level" không hợp lệ' };
    if(typeof raw.sound !== 'boolean' || typeof raw.batterySaver !== 'boolean') return { error: 'cài đặt âm thanh/tiết kiệm pin không hợp lệ' };
    var s = defaultState();
    s.xp = raw.xp; s.level = raw.level; s.plays = raw.plays; s.seconds = raw.seconds; s.streakBest = raw.streakBest;
    s.sound = raw.sound; s.batterySaver = raw.batterySaver;
    addXp(s, 0);
    if(s.level > 1000000) return { error: 'trường "xp" không hợp lệ' };
    // streakN/streakDay có từ 2.0 (bản lưu sớm hơn không có): chuỗi ngày không còn phụ thuộc số ngày được giữ lại.
    if(raw.streakN !== undefined || raw.streakDay !== undefined){
      if(!isInt(raw.streakN, 0) || !(raw.streakDay === '' || isDay(raw.streakDay))) return { error: 'chuỗi ngày không hợp lệ' };
      s.streakN = raw.streakN; s.streakDay = raw.streakDay;
    }

    if(!Array.isArray(raw.unlockedThemes)) return { error: 'danh sách giao diện không hợp lệ' };
    for(i = 0; i < raw.unlockedThemes.length; i++){
      if(!findBy(THEMES, raw.unlockedThemes[i])) return { error: 'giao diện lạ trong danh sách đã mở' };
      if(s.unlockedThemes.indexOf(raw.unlockedThemes[i]) === -1) s.unlockedThemes.push(raw.unlockedThemes[i]);
    }
    if(typeof raw.theme !== 'string' || !themeUnlocked(s, raw.theme)) return { error: 'giao diện đang chọn không hợp lệ' };
    s.theme = raw.theme;

    var maps = ['achievements', 'best', 'stats', 'days', 'idle'];
    for(i = 0; i < maps.length; i++) if(!isObj(raw[maps[i]])) return { error: 'phần "' + maps[i] + '" không hợp lệ' };

    keys = Object.keys(raw.achievements);
    if(keys.length > 100) return { error: 'phần "achievements" quá lớn' };
    for(i = 0; i < keys.length; i++){
      if(!ID_RE.test(keys[i]) || !isNum(raw.achievements[keys[i]], 0)) return { error: 'huy hiệu "' + keys[i].slice(0, 20) + '" không hợp lệ' };
      s.achievements[keys[i]] = raw.achievements[keys[i]];
    }
    keys = Object.keys(raw.best);
    if(keys.length > 200) return { error: 'phần "best" quá lớn' };
    for(i = 0; i < keys.length; i++){
      var b = raw.best[keys[i]];
      if(!ID_RE.test(keys[i]) || !isObj(b) || !isNum(b.v, 0) || !isNum(b.at, 0)) return { error: 'kỷ lục "' + keys[i].slice(0, 20) + '" không hợp lệ' };
      s.best[keys[i]] = { v: b.v, at: b.at };
    }
    keys = Object.keys(raw.stats);
    if(keys.length > 200) return { error: 'phần "stats" quá lớn' };
    for(i = 0; i < keys.length; i++){
      var st = raw.stats[keys[i]];
      if(!ID_RE.test(keys[i]) || !isObj(st) || !isInt(st.plays, 0) || !isInt(st.seconds, 0) || !isNum(st.last, 0)) return { error: 'thống kê "' + keys[i].slice(0, 20) + '" không hợp lệ' };
      s.stats[keys[i]] = { plays: st.plays, seconds: st.seconds, last: st.last };
    }
    keys = Object.keys(raw.days);
    if(keys.length > 400) return { error: 'phần "days" quá lớn' };
    for(i = 0; i < keys.length; i++){
      var d = raw.days[keys[i]];
      if(!isDay(keys[i]) || !isObj(d) || !isInt(d.plays, 0) || !isInt(d.seconds, 0) || typeof d.idle !== 'boolean' || !isObj(d.claimed)) return { error: 'ngày "' + keys[i].slice(0, 12) + '" không hợp lệ' };
      s.days[keys[i]] = { plays: d.plays, seconds: d.seconds, idle: d.idle, claimed: cleanClaimed(d.claimed) };
    }
    keys = Object.keys(raw.idle);
    if(keys.length > 60) return { error: 'phần "idle" quá lớn' };
    for(i = 0; i < keys.length; i++){
      var sv = cleanSave(raw.idle[keys[i]]);
      if(!ID_RE.test(keys[i]) || !sv) return { error: 'tiến trình game "' + keys[i].slice(0, 20) + '" không hợp lệ' };
      s.idle[keys[i]] = sv;
    }
    if(!Array.isArray(raw.favorites) || raw.favorites.length > 200) return { error: 'danh sách yêu thích không hợp lệ' };
    for(i = 0; i < raw.favorites.length; i++){
      if(typeof raw.favorites[i] !== 'string' || !ID_RE.test(raw.favorites[i])) return { error: 'danh sách yêu thích không hợp lệ' };
      if(s.favorites.indexOf(raw.favorites[i]) === -1) s.favorites.push(raw.favorites[i]);
    }
    if(raw.updatedAt != null && !isNum(raw.updatedAt, 0)) return { error: 'trường "updatedAt" không hợp lệ' };
    s.updatedAt = raw.updatedAt || 0;
    return { state: s };
  }
  function validateState(raw){ return checkState(raw).state || null; }

  function hasProgress(state){
    return state.plays > 0 || state.xp > 0 || state.level > 1 || state.favorites.length > 0 ||
      Object.keys(state.best).length > 0 || Object.keys(state.idle).length > 0 || Object.keys(state.achievements).length > 0;
  }

  // ---------- Chuyển dữ liệu bản 1.x (gamehub_profile_v2 + các khoá rời) ----------
  function toCount(x){
    if(typeof x === 'string' && /^\d{1,15}$/.test(x)) x = Number(x);
    return isNum(x, 0) ? Math.floor(x) : null;
  }
  // local: { 'hs_snake': '7', 'bestReaction': '250', 'save_idleMine': '{…}' } — chuỗi thô như trong localStorage.
  // Chỉ đọc ba họ khoá đó; mọi khoá khác bị bỏ qua.
  function extractLegacy(profile, local){
    var out = { profile: isObj(profile) ? profile : null, hs: {}, bestReaction: null, idle: {} };
    if(!isObj(local)) return out;
    GAME_IDS.forEach(function(id){
      if(own(local, 'hs_' + id)) out.hs[id] = local['hs_' + id];
      if(id.indexOf('idle') === 0 && own(local, 'save_' + id)){
        var raw = local['save_' + id];
        if(typeof raw === 'string'){ try{ raw = JSON.parse(raw); }catch(e){ raw = null; } }
        if(isObj(raw)) out.idle[id] = raw;
      }
    });
    if(own(local, 'bestReaction')) out.bestReaction = local.bestReaction;
    return out;
  }
  function migrateV2(legacy, nowMs){
    var now = nowMs == null ? Date.now() : nowMs, today = vnToday(now), oldest = dayAdd(today, -(KEEP_DAYS - 1));
    var s = defaultState(), p = legacy && isObj(legacy.profile) ? legacy.profile : {};
    if(isNum(p.xp, 0)) s.xp = Math.floor(p.xp);
    if(isNum(p.level, 1) && p.level <= 1000000) s.level = Math.floor(p.level);
    if(isNum(p.plays, 0)) s.plays = Math.floor(p.plays);
    if(isNum(p.seconds, 0)) s.seconds = Math.floor(p.seconds);
    addXp(s, 0);
    if(Array.isArray(p.unlockedThemes)) p.unlockedThemes.forEach(function(id){
      if(findBy(THEMES, id) && s.unlockedThemes.indexOf(id) === -1) s.unlockedThemes.push(id);
    });
    if(typeof p.theme === 'string' && s.unlockedThemes.indexOf(p.theme) !== -1) s.theme = p.theme;
    if(own(p, 'sound')) s.sound = !!p.sound;
    if(own(p, 'batterySaver')) s.batterySaver = !!p.batterySaver;
    if(isObj(p.achievements)) ACHIEVEMENTS.forEach(function(a){
      if(own(p.achievements, a.id) && isNum(p.achievements[a.id], 0)) s.achievements[a.id] = p.achievements[a.id];
    });
    if(isObj(p.missions)) Object.keys(p.missions).forEach(function(d){
      var m = p.missions[d];
      if(!isDay(d) || d < oldest || d > today || !isObj(m)) return;
      s.days[d] = { plays: 0, seconds: 0, idle: m.idleTap === true, claimed: cleanClaimed(m.claimed) };
    });
    var hs = legacy && isObj(legacy.hs) ? legacy.hs : {}, idle = legacy && isObj(legacy.idle) ? legacy.idle : {};
    GAME_IDS.forEach(function(id){
      var v = own(hs, id) ? toCount(hs[id]) : null;
      if(v !== null && v > 0) s.best[id] = { v: v, at: now };
      var g = own(idle, id) ? idle[id] : null;
      if(id.indexOf('idle') === 0 && isObj(g)){
        s.idle[id] = {
          coins: isNum(g.coins, 0) ? g.coins : 0,
          lvl: isNum(g.lvl, 1) ? Math.floor(g.lvl) : 1,
          power: isNum(g.power, 1) ? Math.floor(g.power) : 1,
          auto: isNum(g.auto, 0) ? Math.floor(g.auto) : 0,
          last: isNum(g.last, 0) ? Math.min(g.last, now) : now
        };
      }
    });
    var br = legacy ? toCount(legacy.bestReaction) : null;
    if(br !== null && br > 0) s.best.reaction = { v: br, at: now };
    s.updatedAt = now;
    return s;
  }

  // ---------- Sao lưu ----------
  function decodeBase64Utf8(b64){
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  // Nhận file JSON mới hoặc mã base64 của bản 1.x. Trả { state, exportedAt, legacy } hoặc { error }.
  function parseBackup(text, nowMs){
    if(typeof text !== 'string' || !text.trim()) return { error: 'Chưa có nội dung để đọc.' };
    if(text.length > MAX_BACKUP_CHARS) return { error: 'Nội dung quá lớn (tối đa 1 MB) — đây không phải bản sao lưu của GameHub.' };
    var t = text.trim(), doc;
    if(t.charAt(0) === '{'){
      try{ doc = JSON.parse(t); }catch(e){ return { error: 'File không đọc được: JSON bị hỏng hoặc bị cắt mất một phần.' }; }
      if(!isObj(doc) || doc.app !== 'mini-game-hub' || doc.kind !== 'progress') return { error: 'Đây không phải file sao lưu của GameHub.' };
      if(doc.version !== 1) return { error: 'File sao lưu thuộc phiên bản khác (version ' + String(doc.version).slice(0, 12) + ') — hãy cập nhật app rồi thử lại.' };
      var r = checkState(doc.state);
      if(r.error) return { error: 'File sao lưu bị lỗi: ' + r.error + '.' };
      return { state: r.state, legacy: false,
        exportedAt: typeof doc.exportedAt === 'string' && isFinite(Date.parse(doc.exportedAt)) ? doc.exportedAt : null };
    }
    var b64 = t.replace(/\s+/g, '');
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'Không nhận ra nội dung này: không phải file sao lưu GameHub, cũng không phải mã save cũ.' };
    try{ doc = JSON.parse(decodeBase64Utf8(b64)); }catch(e){ return { error: 'Mã save không đọc được: có thể bị thiếu ký tự khi sao chép.' }; }
    if(!isObj(doc) || (!isObj(doc.profile) && !isObj(doc.local))) return { error: 'Mã save không chứa hồ sơ người chơi.' };
    return { state: migrateV2(extractLegacy(doc.profile, doc.local), nowMs), legacy: true, exportedAt: null };
  }
  function makeBackup(state, nowMs){
    return { app: 'mini-game-hub', kind: 'progress', version: 1,
      exportedAt: new Date(nowMs == null ? Date.now() : nowMs).toISOString(), state: state };
  }

  // ---------- Nhiệm vụ, chuỗi ngày, huy hiệu ----------
  function dayOf(state, day){
    return own(state.days, day) ? state.days[day] : { plays: 0, seconds: 0, idle: false, claimed: {} };
  }
  function ensureDay(state, day){
    if(!own(state.days, day)) state.days[day] = { plays: 0, seconds: 0, idle: false, claimed: {} };
    return state.days[day];
  }
  function pruneDays(state, today){
    var oldest = dayAdd(today, -(KEEP_DAYS - 1));
    // Ngày ở tương lai (file tự chế, đồng hồ máy từng chạy sai) cũng bỏ: nếu giữ, chúng sẽ được tính vào chuỗi khi tới.
    Object.keys(state.days).forEach(function(d){ if(d < oldest || d > today) delete state.days[d]; });
  }
  function missionsFor(state, today){
    var d = dayOf(state, today);
    return MISSIONS.map(function(m){
      var cur = m.id === 'open3' ? d.plays : m.id === 'play5' ? Math.floor(d.seconds / 60) : (d.idle ? 1 : 0);
      cur = Math.min(cur, m.goal);
      return { id: m.id, title: m.title, reward: m.reward, goal: m.goal, cur: cur, done: cur >= m.goal,
        claimed: d.claimed[m.id] === true,
        progress: cur + '/' + m.goal + (m.id === 'play5' ? ' phút' : '') };
    });
  }
  function claimMission(state, id, today){
    var list = missionsFor(state, today), m = findBy(list, id);
    if(!m || !m.done || m.claimed) return 0;
    ensureDay(state, today).claimed[id] = true;
    addXp(state, m.reward);
    return m.reward;
  }
  // Số ngày VN liên tiếp có chơi, tính tới hôm nay; hôm nay chưa chơi thì tính tới hôm qua.
  // Chỉ `days` được giữ 60 ngày, nên chuỗi dài hơn thế phải đếm bằng streakN/streakDay (cập nhật ở
  // recordOpen). Đếm theo `days` vẫn dùng cho bản lưu chưa có hai trường đó.
  function streakFromDays(state, today){
    var d = dayOf(state, today).plays > 0 ? today : dayAdd(today, -1), n = 0;
    while(dayOf(state, d).plays > 0 && n < 4000){ n++; d = dayAdd(d, -1); }
    return n;
  }
  function streak(state, today){
    var base = streakFromDays(state, today);
    if(state.streakN > 0 && (state.streakDay === today || state.streakDay === dayAdd(today, -1))) return Math.max(base, state.streakN);
    return base;
  }
  // lowIds: id các game có kỷ lục "càng thấp càng tốt" (không tính vào huy hiệu điểm cao).
  function achievementProgress(state, lowIds){
    var low = lowIds || DEFAULT_LOW_IDS, maxIdle = 0, maxHigh = 0;
    Object.keys(state.idle).forEach(function(id){ if(isNum(state.idle[id].lvl, 0)) maxIdle = Math.max(maxIdle, state.idle[id].lvl); });
    Object.keys(state.best).forEach(function(id){ if(low.indexOf(id) === -1) maxHigh = Math.max(maxHigh, state.best[id].v); });
    var cur = { first_game: state.plays, five_games: state.plays, xp_500: state.level, idle_5: maxIdle, high_50: maxHigh };
    return ACHIEVEMENTS.map(function(a){
      return { id: a.id, icon: a.icon, name: a.name, desc: a.desc, goal: a.goal, cur: Math.min(Math.floor(cur[a.id]), a.goal),
        reached: cur[a.id] >= a.goal, unlocked: own(state.achievements, a.id) };
    });
  }
  // Mở khoá những huy hiệu vừa đạt, mỗi cái +35 XP đúng một lần. Trả danh sách huy hiệu mới.
  function checkAchievements(state, nowMs, lowIds){
    var fresh = [], again = true;
    while(again){
      again = false;
      achievementProgress(state, lowIds).forEach(function(a){
        if(a.reached && !a.unlocked && !own(state.achievements, a.id)){
          state.achievements[a.id] = nowMs;
          addXp(state, XP_ACHIEVEMENT);
          fresh.push(a);
          again = true;
        }
      });
    }
    return fresh;
  }

  // ---------- Ghi nhận việc chơi ----------
  function ensureStat(state, id){
    if(!own(state.stats, id)) state.stats[id] = { plays: 0, seconds: 0, last: 0 };
    return state.stats[id];
  }
  function recordOpen(state, id, nowMs){
    var today = vnToday(nowMs), d = ensureDay(state, today), st = ensureStat(state, id), g = catalogOf(id);
    state.plays++; d.plays++; st.plays++; st.last = nowMs;
    if(g && g.cat === 'IDLE') d.idle = true;
    addXp(state, XP_OPEN);
    if(state.streakDay !== today){
      state.streakN = state.streakN > 0 && state.streakDay === dayAdd(today, -1) ? state.streakN + 1 : Math.max(1, streakFromDays(state, today));
      state.streakDay = today;
    }
    state.streakBest = Math.max(state.streakBest, streak(state, today));
    pruneDays(state, today);
    return XP_OPEN;
  }
  function recordSeconds(state, id, secs, nowMs){
    var today = vnToday(nowMs), xp = Math.floor(secs / 15) * XP_PER_15S, st = ensureStat(state, id);
    state.seconds += secs; ensureDay(state, today).seconds += secs; st.seconds += secs; st.last = nowMs;
    addXp(state, xp);
    return xp;
  }
  function isBetter(def, newV, oldV){
    if(!def || !def.score || !isNum(newV, 0) || newV <= 0) return false;
    if(oldV == null) return true;
    return def.score.better === 'low' ? newV < oldV : newV > oldV;
  }
  function recordBest(state, def, v, nowMs){
    var old = own(state.best, def.id) ? state.best[def.id].v : null;
    if(!isBetter(def, v, old)) return false;
    state.best[def.id] = { v: v, at: nowMs };
    return true;
  }

  // ---------- Xếp hình trượt ----------
  // arr: n*n ô, 0 là ô trống. Giải được khi: n lẻ → số nghịch thế chẵn;
  // n chẵn → (nghịch thế + hàng của ô trống đếm từ dưới lên, 1-based) lẻ.
  function isSolvable(arr, n){
    var inv = 0, i, j;
    for(i = 0; i < arr.length; i++) for(j = i + 1; j < arr.length; j++) if(arr[i] && arr[j] && arr[i] > arr[j]) inv++;
    if(n % 2 === 1) return inv % 2 === 0;
    return (inv + (n - Math.floor(arr.indexOf(0) / n))) % 2 === 1;
  }
  function isSolved(arr){
    for(var i = 0; i < arr.length - 1; i++) if(arr[i] !== i + 1) return false;
    return arr[arr.length - 1] === 0;
  }
  function shuffleSolvable(n, rnd){
    var random = rnd || Math.random, arr = [], i, j, t;
    do{
      arr = [];
      for(i = 0; i < n * n; i++) arr.push(i);
      for(i = arr.length - 1; i > 0; i--){ j = Math.floor(random() * (i + 1)); t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      if(!isSolvable(arr, n)){
        // Đổi chỗ hai ô có số (không phải ô trống) lật đúng một lần tính chẵn lẻ.
        var a = arr[0] === 0 ? 1 : 0, b = a + 1;
        if(arr[b] === 0) b++;
        t = arr[a]; arr[a] = arr[b]; arr[b] = t;
      }
    }while(isSolved(arr));
    return arr;
  }

  return {
    CATALOG: CATALOG, GAME_IDS: GAME_IDS, CATS: CATS, DUR_LABEL: DUR_LABEL, THEMES: THEMES, MISSIONS: MISSIONS,
    ACHIEVEMENTS: ACHIEVEMENTS, XP_OPEN: XP_OPEN, XP_PER_15S: XP_PER_15S, XP_ACHIEVEMENT: XP_ACHIEVEMENT,
    own: own, catalogOf: catalogOf, vnToday: vnToday, dayAdd: dayAdd, isDay: isDay,
    xpNeed: xpNeed, addXp: addXp, defaultState: defaultState, validateState: validateState, checkState: checkState,
    hasProgress: hasProgress, themeUnlocked: themeUnlocked, cleanSave: cleanSave,
    extractLegacy: extractLegacy, migrateV2: migrateV2, parseBackup: parseBackup, makeBackup: makeBackup,
    missionsFor: missionsFor, claimMission: claimMission, streak: streak,
    achievementProgress: achievementProgress, checkAchievements: checkAchievements,
    recordOpen: recordOpen, recordSeconds: recordSeconds, isBetter: isBetter, recordBest: recordBest,
    pruneDays: pruneDays, isSolvable: isSolvable, isSolved: isSolved, shuffleSolvable: shuffleSolvable
  };
});
