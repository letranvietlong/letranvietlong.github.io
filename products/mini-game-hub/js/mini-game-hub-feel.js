// Lớp "cảm giác chơi" dùng chung của GameHub: âm thanh tổng hợp bằng Web Audio (không có file âm thanh),
// rung, hạt và chữ bay trên một canvas phủ, rung màn hình, nháy màn. Không đọc/ghi localStorage và không
// biết gì về game: vỏ (mini-game-hub.js) cấu hình rồi gọi; game chỉ dùng tới qua `host`.
// Nạp sau core, trước hai file game. Mọi hàm public nuốt lỗi — hiệu ứng hỏng không được làm hỏng ván chơi.
(function(){
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  var VOL = { low: .35, mid: .6, high: 1 };
  var cfg = { sound: true, vol: 'mid', music: false, haptics: true, shake: true, saver: false };
  var FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function now(){ return performance.now(); }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function pageHidden(){ return document.visibilityState === 'hidden'; }
  function own(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }

  // ---------- Âm thanh ----------
  // Một AudioContext cho cả đời trang. Chỉ tạo/resume trong unlock(), mà vỏ chỉ gọi unlock() ở
  // touchend/pointerup/click/keydown: theo HTML spec pointerdown/touchstart không phải "kích hoạt người
  // dùng", context mở ở đó trên iPhone có thể kẹt 'suspended'. sfx() không bao giờ tự tạo context.
  var ctx = null, sfxBus = null, musicBus = null, comp = null, noiseBuf = null, voices = 0, lastPlay = {}, resumingUntil = 0;
  var MAX_VOICES = 12, PRIORITY = { crash: 1, record: 1, win: 1, lose: 1 };
  // Safari 17+: 'ambient' = tôn trọng công tắc im lặng và không dừng nhạc của app khác.
  try{ if(navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){}

  function build(){
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .12;
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = VOL[cfg.vol] || VOL.mid;
    sfxBus.connect(comp);
    musicBus = ctx.createGain();
    musicBus.gain.value = .35;
    musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for(var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock(){
    if(!cfg.sound || !AC || pageHidden()) return;
    try{
      if(ctx && ctx.state === 'closed') ctx = null;
      if(!ctx){ ctx = new AC(); build(); }
      if(ctx.state !== 'running'){
        // resume() xong là bất đồng bộ; tiếng phát ngay trong cùng cú chạm được xếp lịch và kêu khi context chạy.
        resumingUntil = now() + 500;
        var p = ctx.resume();
        if(p && p.catch) p.catch(function(){});
        var b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.onended = function(){ try{ s.disconnect(); }catch(e){} };
        s.start(0);
      }
    }catch(e){}
  }
  function suspend(){
    resumingUntil = 0;
    try{
      if(ctx && ctx.state === 'running'){
        var p = ctx.suspend();
        if(p && p.catch) p.catch(function(){});
      }
    }catch(e){}
  }
  function canPlay(){
    // 'interrupted' (iOS: cuộc gọi, Siri) coi như chưa chạy — cú chạm kế tiếp mở lại.
    return !!ctx && (ctx.state === 'running' || (ctx.state !== 'closed' && now() < resumingUntil));
  }

  function track(v, node){ v.nodes.push(node); return node; }
  function closeVoice(v){
    if(v.closed) return;
    v.closed = true;
    voices--;
    v.nodes.forEach(function(n){ try{ n.disconnect(); }catch(e){} });
    v.nodes = [];
  }
  function srcEnded(v){ if(--v.pending <= 0) closeVoice(v); }
  function play(v, src, t, dur, offset){
    v.pending++;
    src.onended = function(){ srcEnded(v); };
    src.start(t, offset || 0);
    src.stop(t + dur + .05);
  }
  // Bao hình: lên tuyến tính trong vài ms rồi tắt dần theo hàm mũ (setTargetAtTime), không ramp mũ về 0.
  function env(v, peak, t, dur, attack, tau){
    var g = track(v, ctx.createGain()), a = attack || .004;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak * v.gain, t + a);
    g.gain.setTargetAtTime(0, t + a, tau || Math.max(.006, (dur - a) / 4));
    return g;
  }
  function filter(v, f, t, dur){
    var fl = track(v, ctx.createBiquadFilter());
    fl.type = f.type;
    fl.frequency.setValueAtTime(f.f, t);
    if(f.f2) fl.frequency.exponentialRampToValueAtTime(f.f2, t + dur);
    if(f.q) fl.Q.value = f.q;
    return fl;
  }
  // o: { type, f, f2 (quét tới), steps [[giây, Hz]], t, dur, peak, attack, tau, filter }
  function tone(v, o){
    var osc = track(v, ctx.createOscillator()), g = env(v, o.peak, o.t, o.dur, o.attack, o.tau), last = osc;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f * v.pitch, o.t);
    if(o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2 * v.pitch, o.t + o.dur);
    if(o.steps) o.steps.forEach(function(s){ osc.frequency.setValueAtTime(s[1] * v.pitch, o.t + s[0]); });
    if(o.filter){ last = filter(v, o.filter, o.t, o.dur); osc.connect(last); }
    last.connect(g);
    g.connect(v.out);
    play(v, osc, o.t, o.dur);
  }
  // o: { t, dur, peak, filter }
  function noise(v, o){
    var src = track(v, ctx.createBufferSource()), g = env(v, o.peak, o.t, o.dur, o.attack, o.tau), last = src;
    src.buffer = noiseBuf;
    if(o.filter){ last = filter(v, o.filter, o.t, o.dur); src.connect(last); }
    last.connect(g);
    g.connect(v.out);
    play(v, src, o.t, o.dur, Math.random() * .5);
  }
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  function seq(v, t, type, notes, peak, flt){
    notes.forEach(function(n){ tone(v, { type: type, f: n[0], t: t, dur: n[1], peak: peak, filter: flt }); t += n[1]; });
  }
  var RECIPES = {
    tap: function(v, t){ tone(v, { type: 'triangle', f: 620, f2: 480, t: t, dur: .045, peak: .22 }); },
    click: function(v, t){ tone(v, { f: 1250, t: t, dur: .025, peak: .12, attack: .002 }); },
    good: function(v, t){ seq(v, t, 'triangle', [[660, .055], [990, .055]], .2); },
    point: function(v, t){ tone(v, { type: 'square', f: 988, steps: [[.05, 1319]], t: t, dur: .13, peak: .14, filter: { type: 'lowpass', f: 4000 } }); },
    combo: function(v, t, o){
      var f = 660 * Math.pow(2, Math.min(Math.max(0, o.level | 0), 12) * 2 / 12);
      tone(v, { type: 'triangle', f: f, t: t, dur: .09, peak: .18 });
      tone(v, { f: f * 2, t: t, dur: .09, peak: .06 });
    },
    perfect: function(v, t, o){
      var k = Math.pow(2, PENTA[Math.min(Math.max(0, o.level | 0), PENTA.length - 1)] / 12);
      tone(v, { f: 1568 * k, t: t, dur: .26, peak: .14, tau: .08 });
      tone(v, { f: 2093 * k, t: t, dur: .26, peak: .1, tau: .08 });
    },
    bad: function(v, t){ tone(v, { type: 'sawtooth', f: 220, f2: 110, t: t, dur: .18, peak: .18, filter: { type: 'lowpass', f: 1200 } }); },
    miss: function(v, t){ noise(v, { t: t, dur: .07, peak: .12, filter: { type: 'bandpass', f: 400, q: 1 } }); },
    hit: function(v, t){
      tone(v, { type: 'triangle', f: 320, f2: 180, t: t, dur: .05, peak: .22 });
      noise(v, { t: t, dur: .012, peak: .1, attack: .001, filter: { type: 'highpass', f: 2000 } });
    },
    bounce: function(v, t){ tone(v, { f: 540, f2: 430, t: t, dur: .04, peak: .12 }); },
    jump: function(v, t){ tone(v, { type: 'square', f: 300, f2: 720, t: t, dur: .12, peak: .12, filter: { type: 'lowpass', f: 3000 } }); },
    flap: function(v, t){
      noise(v, { t: t, dur: .07, peak: .12, filter: { type: 'bandpass', f: 1100, q: .8 } });
      tone(v, { f: 380, f2: 560, t: t, dur: .06, peak: .08 });
    },
    land: function(v, t){
      tone(v, { f: 140, f2: 70, t: t, dur: .09, peak: .2 });
      noise(v, { t: t, dur: .04, peak: .1, filter: { type: 'lowpass', f: 600 } });
    },
    drop: function(v, t){
      tone(v, { f: 190, f2: 90, t: t, dur: .1, peak: .25 });
      noise(v, { t: t, dur: .03, peak: .08, filter: { type: 'lowpass', f: 1500 } });
    },
    slice: function(v, t){ noise(v, { t: t, dur: .06, peak: .1, filter: { type: 'highpass', f: 3000 } }); },
    whoosh: function(v, t){ noise(v, { t: t, dur: .12, peak: .08, attack: .02, filter: { type: 'bandpass', f: 400, f2: 1600, q: 1.2 } }); },
    merge: function(v, t, o){
      var val = Number(o.value) > 0 ? Number(o.value) : 4, f = Math.min(1760, 220 * Math.sqrt(val));
      tone(v, { f: f, t: t, dur: .11, peak: .16 });
      tone(v, { type: 'triangle', f: f * 2, t: t, dur: .11, peak: .06 });
    },
    pop: function(v, t){ tone(v, { f: 300, f2: 900, t: t, dur: .06, peak: .06 }); },
    whack: function(v, t){
      noise(v, { t: t, dur: .07, peak: .14, filter: { type: 'lowpass', f: 900 } });
      tone(v, { f: 170, f2: 60, t: t, dur: .1, peak: .25 });
    },
    flip: function(v, t){
      noise(v, { t: t, dur: .03, peak: .08, filter: { type: 'bandpass', f: 2500, q: 1 } });
      tone(v, { type: 'triangle', f: 900, t: t, dur: .02, peak: .06 });
    },
    roll: function(v, t){
      for(var i = 0; i < 5; i++) noise(v, { t: t + i * .06, dur: .025, peak: .1, attack: .002, filter: { type: 'bandpass', f: 1800, q: 1.5 } });
    },
    crash: function(v, t){
      noise(v, { t: t, dur: .42, peak: .3, attack: .002, filter: { type: 'lowpass', f: 3000, f2: 200 } });
      tone(v, { f: 120, f2: 40, t: t, dur: .3, peak: .3 });
    },
    tick: function(v, t){ tone(v, { f: 880, t: t, dur: .08, peak: .14 }); },
    go: function(v, t){
      tone(v, { f: 1320, t: t, dur: .22, peak: .12 });
      tone(v, { f: 1760, t: t, dur: .22, peak: .08 });
    },
    win: function(v, t){ seq(v, t, 'triangle', [[523, .09], [659, .09], [784, .09], [1047, .26]], .18); },
    lose: function(v, t){ seq(v, t, 'sawtooth', [[392, .14], [330, .14], [262, .3]], .12, { type: 'lowpass', f: 1500 }); },
    end: function(v, t){
      tone(v, { f: 523, t: t, dur: .3, peak: .14 });
      tone(v, { f: 659, t: t, dur: .3, peak: .1 });
    },
    newbest: function(v, t){ seq(v, t, 'sine', [[1047, .1], [1568, .1]], .16); },
    record: function(v, t){
      RECIPES.win(v, t);
      for(var i = 0; i < 6; i++) tone(v, { f: i % 2 ? 2637 : 2093, t: t + .1 + i * .1 + Math.random() * .04, dur: .09, peak: .05 });
    },
    simon0: function(v, t){ tone(v, { type: 'triangle', f: 330, t: t, dur: .38, peak: .2 }); },
    simon1: function(v, t){ tone(v, { type: 'triangle', f: 277, t: t, dur: .38, peak: .2 }); },
    simon2: function(v, t){ tone(v, { type: 'triangle', f: 220, t: t, dur: .38, peak: .2 }); },
    simon3: function(v, t){ tone(v, { type: 'triangle', f: 165, t: t, dur: .38, peak: .2 }); }
  };

  // opts: { pitch: nửa cung -12..12, vol: 0..1, level: số nguyên ≥ 0 (combo/perfect), value: số ô (merge) }
  function sfx(name, opts){
    var v = null;
    try{
      if(!cfg.sound || typeof name !== 'string' || !own(RECIPES, name) || pageHidden() || !canPlay()) return false;
      var t = now();
      // Cùng một tiếng lặp trong 25ms là dư (Tap Race ~14 chạm/giây vẫn đủ tiếng).
      if(lastPlay[name] && t - lastPlay[name] < 25) return false;
      if(voices >= MAX_VOICES && !PRIORITY[name]) return false;
      lastPlay[name] = t;
      var o = opts && typeof opts === 'object' ? opts : {};
      v = { nodes: [], pending: 0, closed: false, out: sfxBus,
        gain: typeof o.vol === 'number' && isFinite(o.vol) ? clamp(o.vol, 0, 1) : 1,
        pitch: Math.pow(2, clamp(Number(o.pitch) || 0, -12, 12) / 12) };
      voices++;
      RECIPES[name](v, ctx.currentTime + .005, o);
      if(!v.pending) closeVoice(v);
      return true;
    }catch(e){
      if(v) closeVoice(v);
      return false;
    }
  }

  // ---------- Rung ----------
  // Android/Chromium: navigator.vibrate. iPhone không có vibrate; THỬ NGHIỆM: bấm một <input type=checkbox switch>
  // ẩn (Safari 17.4+) làm máy phát đúng một kiểu rung "công tắc". Apple có thể chặn bất kỳ lúc nào.
  var hapMode = 'none';
  try{
    if(typeof navigator.vibrate === 'function') hapMode = 'vibrate';
    else if(window.HTMLInputElement && 'switch' in HTMLInputElement.prototype) hapMode = 'switch';
  }catch(e){}
  var VIB = { light: 8, medium: 16, heavy: 30, success: [12, 40, 12], error: [30, 40, 30, 40, 30] };
  var hapLabel = null, lastHap = 0;
  function switchClick(){
    if(!hapLabel){
      // Nằm thẳng trong body: #app bị inert khi chơi, còn #gameScreen bị ẩn khi bấm "Thử rung" ở Cài đặt.
      hapLabel = document.createElement('label');
      hapLabel.setAttribute('aria-hidden', 'true');
      hapLabel.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      var inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.setAttribute('switch', '');
      inp.tabIndex = -1;
      inp.style.fontSize = '16px';
      hapLabel.appendChild(inp);
      document.body.appendChild(hapLabel);
    }
    hapLabel.click();
  }
  function haptic(kind, force){
    try{
      if(!own(VIB, kind) || hapMode === 'none' || pageHidden() || (!force && !cfg.haptics)) return false;
      if(hapMode === 'vibrate'){
        // Gọi trước cú chạm đầu tiên thì Chromium chặn và ghi cảnh báo ra console.
        if(navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
        return !!navigator.vibrate(VIB[kind]);
      }
      var t = now();
      if(t - lastHap < 60) return false;
      lastHap = t;
      switchClick();
      if(kind === 'success' || kind === 'error') setTimeout(function(){ if(!pageHidden()) switchClick(); }, 90);
      return true;
    }catch(e){ return false; }
  }

  // ---------- Hạt, chữ bay (canvas #fxLayer, toạ độ viewport, px CSS) ----------
  var POOL = 220, MAX_BURST = 40, TEXT_MAX = 12;
  var parts = [], texts = [], alive = 0, cursor = 0, cv = null, cx = null, dpr = 1, raf = 0, lastTs = 0, sized = false;
  for(var pi = 0; pi < POOL; pi++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 3, color: '#fff', shape: 0, rot: 0, vr: 0 });
  var DEFAULT_COLORS = ['#FBBF24', '#60A5FA', '#34D399', '#FB7185', '#A78BFA'];
  var SHAPES = { dot: 0, spark: 1, confetti: 2 };
  function canvasReady(){
    if(cx) return true;
    cv = document.getElementById('fxLayer');
    if(!cv || !cv.getContext) return false;
    cx = cv.getContext('2d');
    window.addEventListener('resize', function(){ sized = false; });
    return !!cx;
  }
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    sized = true;
  }
  function wake(){
    // Lớp phủ cố định chỉ hiện khi có hạt (ios-pwa §17).
    if(cv.hidden){ cv.hidden = false; sized = false; }
    if(!sized) resize();
    if(!raf){ lastTs = 0; raf = window.requestAnimationFrame(tick); }
  }
  function sleep(){
    if(raf){ window.cancelAnimationFrame(raf); raf = 0; }
    if(cx){ cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); }
    if(cv) cv.hidden = true;
  }
  function tick(ts){
    raf = 0;
    try{
      var dt = lastTs ? Math.min(50, ts - lastTs) / 1000 : 1 / 60, i, p, a;
      lastTs = ts;
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, cv.width, cv.height);
      for(i = 0; i < POOL; i++){
        p = parts[i];
        if(!p.on) continue;
        p.life -= dt;
        if(p.life <= 0){ p.on = false; alive--; continue; }
        if(p.shape === 2){ p.vx *= 1 - 1.6 * dt; p.vy = Math.min(p.vy + p.g * dt, 260); }
        else p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        a = p.shape === 2 ? Math.min(1, p.life / (p.max * .3)) : p.life / p.max;
        cx.globalAlpha = a;
        cx.fillStyle = p.color;
        if(p.shape === 2){
          var c = Math.cos(p.rot), s = Math.sin(p.rot);
          cx.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, p.x * dpr, p.y * dpr);
          var hh = p.size * Math.abs(Math.cos(p.rot * 1.7)) + 1;
          cx.fillRect(-p.size, -hh / 2, p.size * 2, hh);
        } else if(p.shape === 1){
          cx.setTransform(dpr, 0, 0, dpr, 0, 0);
          cx.strokeStyle = p.color;
          cx.lineWidth = Math.max(1, p.size * .7);
          cx.beginPath();
          cx.moveTo(p.x, p.y);
          cx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03);
          cx.stroke();
        } else {
          cx.setTransform(dpr, 0, 0, dpr, 0, 0);
          cx.beginPath();
          cx.arc(p.x, p.y, p.size * (.5 + .5 * a), 0, 6.2832);
          cx.fill();
        }
      }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for(i = texts.length - 1; i >= 0; i--){
        var tx = texts[i];
        tx.t += dt;
        if(tx.t >= tx.life){ texts.splice(i, 1); continue; }
        var k = tx.t / tx.life, e = 1 - (1 - k) * (1 - k);
        cx.globalAlpha = k < .6 ? 1 : 1 - (k - .6) / .4;
        cx.font = tx.weight + ' ' + tx.size + 'px ' + FONT;
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.lineWidth = 4;
        cx.strokeStyle = 'rgba(7,11,22,.7)';
        cx.strokeText(tx.str, tx.x, tx.y - 36 * e);
        cx.fillStyle = tx.color;
        cx.fillText(tx.str, tx.x, tx.y - 36 * e);
      }
      cx.globalAlpha = 1;
    }catch(err){ alive = 0; texts = []; parts.forEach(function(q){ q.on = false; }); }
    if(alive > 0 || texts.length) raf = window.requestAnimationFrame(tick);
    else sleep();
  }
  function reducedMotion(){ return !!(mq && mq.matches) || cfg.shake === false; }
  // opts: { n:14, colors:[…] | color, speed:220, life:520 (ms), size:3, gravity:500, angle:0, spread:2π, shape:'dot'|'spark'|'confetti' }
  function burst(x, y, opts){
    try{
      if(!canvasReady() || pageHidden() || !isFinite(x) || !isFinite(y)) return 0;
      var o = opts && typeof opts === 'object' ? opts : {};
      var n = Math.min(MAX_BURST, Math.max(0, Math.round(Number(o.n) || 14)));
      n = Math.round(n * (cfg.saver ? .5 : 1) * (reducedMotion() ? .3 : 1));
      if(n <= 0) return 0;
      var colors = Array.isArray(o.colors) && o.colors.length ? o.colors : o.color ? [o.color] : o.shape === 'confetti' ? DEFAULT_COLORS : ['#FBBF24'];
      var speed = Number(o.speed) || 220, life = (Number(o.life) || 520) / 1000, size = Number(o.size) || 3;
      var grav = typeof o.gravity === 'number' ? o.gravity : 500, angle = Number(o.angle) || 0;
      var spread = typeof o.spread === 'number' ? o.spread : Math.PI * 2, shape = own(SHAPES, o.shape) ? SHAPES[o.shape] : 0;
      var made = 0;
      for(var tries = 0; made < n && tries < POOL; tries++){
        var p = parts[cursor];
        cursor = (cursor + 1) % POOL;
        if(p.on) continue;
        var dir = angle + (Math.random() - .5) * spread, sp = speed * (.45 + Math.random() * .75);
        p.on = true; p.x = x; p.y = y; p.vx = Math.cos(dir) * sp; p.vy = Math.sin(dir) * sp; p.g = grav;
        p.max = p.life = life * (.7 + Math.random() * .5);
        p.size = size * (.7 + Math.random() * .6);
        p.color = colors[made % colors.length];
        p.shape = shape; p.rot = Math.random() * 6.28; p.vr = (Math.random() - .5) * 14;
        made++; alive++;
      }
      if(made) wake();
      return made;
    }catch(e){ return 0; }
  }
  // opts: { color:'#F8FAFC', size:20, weight:800 } — bay lên 36px trong 650ms rồi mờ.
  function text(x, y, str, opts){
    try{
      if(!canvasReady() || pageHidden() || !isFinite(x) || !isFinite(y)) return;
      var o = opts && typeof opts === 'object' ? opts : {};
      if(texts.length >= TEXT_MAX) texts.shift();
      texts.push({ x: x, y: y, str: String(str).slice(0, 40), color: o.color || '#F8FAFC', size: clamp(Number(o.size) || 20, 10, 64), weight: o.weight || 800, t: 0, life: .65 });
      wake();
    }catch(e){}
  }

  // ---------- Nháy màn, rung màn, nảy (WAAPI, chỉ opacity/transform) ----------
  var flashAnim = null, flashEl = null, shakeAnim = null;
  function flash(el, opts){
    try{
      if(!el || reducedMotion() || pageHidden()) return;
      var o = opts && typeof opts === 'object' ? opts : {};
      if(flashAnim) flashAnim.cancel();
      flashEl = el;
      el.style.backgroundColor = o.color || '#fff';
      el.hidden = false;
      if(!el.animate){ setTimeout(function(){ el.hidden = true; }, o.ms || 110); return; }
      var a = flashAnim = el.animate([{ opacity: typeof o.alpha === 'number' ? clamp(o.alpha, 0, 1) : .22 }, { opacity: 0 }], { duration: Number(o.ms) || 110, easing: 'ease-out', fill: 'forwards' });
      a.onfinish = function(){ if(flashAnim === a){ flashAnim = null; el.hidden = true; a.cancel(); } };
    }catch(e){}
  }
  function shake(el, ms, px){
    try{
      if(!el || !el.animate || reducedMotion() || pageHidden()) return;
      var d = clamp(Number(ms) || 180, 40, 600), amp = clamp(Number(px) || 6, 1, 16), frames = [], steps = 8;
      for(var i = 0; i < steps; i++){
        var k = amp * (1 - i / steps);
        frames.push({ transform: 'translate3d(' + ((Math.random() * 2 - 1) * k).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * k).toFixed(1) + 'px,0)' });
      }
      frames.push({ transform: 'translate3d(0,0,0)' });
      if(shakeAnim) shakeAnim.cancel();
      var a = shakeAnim = el.animate(frames, { duration: d, easing: 'linear' });
      a.onfinish = function(){ if(shakeAnim === a) shakeAnim = null; };
    }catch(e){}
  }
  function pulse(el, opts){
    try{
      if(!el || !el.animate || reducedMotion()) return;
      var o = opts && typeof opts === 'object' ? opts : {}, s = clamp(Number(o.scale) || 1.12, 1, 1.5);
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + s + ')' }, { transform: 'scale(1)' }], { duration: Number(o.ms) || 160, easing: 'ease-out' });
    }catch(e){}
  }
  function clear(){
    try{
      parts.forEach(function(p){ p.on = false; });
      alive = 0; texts = [];
      if(cv) sleep();
      if(shakeAnim){ shakeAnim.cancel(); shakeAnim = null; }
      if(flashAnim){ flashAnim.cancel(); flashAnim = null; }
      if(flashEl) flashEl.hidden = true;
    }catch(e){}
  }

  function configure(opts){
    try{
      var o = opts && typeof opts === 'object' ? opts : {};
      ['sound', 'music', 'haptics', 'shake', 'saver'].forEach(function(k){ if(typeof o[k] === 'boolean') cfg[k] = o[k]; });
      if(own(VOL, o.vol)) cfg.vol = o.vol;
      if(ctx && sfxBus) sfxBus.gain.setValueAtTime(VOL[cfg.vol], ctx.currentTime);
      if(!cfg.sound) suspend();
    }catch(e){}
  }
  function stats(){
    var st = 'none', rate = 0, session = 'none';
    try{
      if(ctx){ st = ctx.state; rate = ctx.sampleRate; }
      if(navigator.audioSession && navigator.audioSession.type) session = String(navigator.audioSession.type);
    }catch(e){}
    return { ctx: st, rate: rate, voices: voices, particles: alive, texts: texts.length, haptic: hapMode, session: session };
  }

  window.GameHubFeel = {
    SOUNDS: Object.keys(RECIPES),
    configure: configure, unlock: unlock, suspend: suspend, sfx: sfx, haptic: haptic,
    burst: burst, text: text, flash: flash, shake: shake, pulse: pulse, clear: clear,
    music: function(){},   // nhạc nền: đợt sau
    reducedMotion: reducedMotion,
    systemReducedMotion: function(){ return !!(mq && mq.matches); },
    stats: stats
  };
})();
