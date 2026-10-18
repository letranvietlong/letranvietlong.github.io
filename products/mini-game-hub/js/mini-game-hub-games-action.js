// Game hành động của GameHub (15 id): snake, pong, flappy, runner, tower, maze, mole, reaction,
// target, colorMatch, tapRace, breath, rps, diceDuel, coinFlip.
// Mỗi game là một định nghĩa đẩy vào window.GameHubGames và CHỈ nói chuyện với vỏ qua `host`.
// Hợp đồng + những điều cấm: products/mini-game-hub/docs/mini-game-hub.md
(function(){
  'use strict';
  var games = window.GameHubGames = window.GameHubGames || [];

  function themeColor(node, name, fallback){
    var v = getComputedStyle(node).getPropertyValue(name).trim();
    return v || fallback;
  }
  var FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
  var BG = '#0B1220', INK = '#0B1020';

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text !== undefined) n.textContent = text;
    return n;
  }
  function button(cls, text){
    var b = el('button', cls, text);
    b.type = 'button';
    return b;
  }
  function setText(node, text){
    if(node.textContent !== text) node.textContent = text;
  }
  function rnd(n){ return Math.floor(Math.random() * n); }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  // Chỉ gọi host.setStats khi nội dung thật sự đổi.
  function statWriter(host){
    var last = '';
    return function(list){
      var sig = JSON.stringify(list);
      if(sig === last) return;
      last = sig;
      host.setStats(list);
    };
  }
  function makeCanvas(host, W, H, label){
    var dpr = Math.min(window.devicePixelRatio || 1, 2), cv = document.createElement('canvas');
    cv.className = 'g-canvas';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.style.flex = 'none';
    cv.tabIndex = 0;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', label);
    host.root.appendChild(cv);
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return { cv: cv, ctx: ctx };
  }
  function canvasHint(ctx, text, x, y, color){
    ctx.fillStyle = color;
    ctx.font = '700 20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }
  // pointerdown để cú chạm ăn ngay (không chờ click); click với detail 0 là bàn phím/trình đọc màn hình.
  function onPress(host, node, fn){
    host.on(node, 'pointerdown', function(e){ if(!e.button) fn(e); });
    host.on(node, 'click', function(e){ if(e.detail === 0) fn(e); });
  }
  function makePad(host, cb){
    var pad = el('div', 'g-pad');
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'Bàn phím hướng');
    [['up', '↑', 'Lên'], ['left', '←', 'Sang trái'], ['right', '→', 'Sang phải'], ['down', '↓', 'Xuống']].forEach(function(d){
      var b = button('', d[1]);
      b.setAttribute('data-dir', d[0]);
      b.setAttribute('aria-label', d[2]);
      pad.appendChild(b);
    });
    host.tap(pad, function(e, b){ cb(b.getAttribute('data-dir')); }, '[data-dir]');
    return pad;
  }
  // Đồng hồ đếm lùi theo giây; chỉ chạy sau khi gọi start() (cú chạm đầu tiên của người chơi).
  // opts.extra() → các ô chỉ số thêm sau ô "Còn"; opts.onTick(left) gọi mỗi giây.
  function countdown(host, secs, stat, onDone, opts){
    var left = secs, id = 0, o = opts || {};
    function show(){ stat([{ label: 'Còn', value: left + ' giây' }].concat(o.extra ? o.extra() : [])); }
    show();
    return {
      start: function(){
        if(id) return;
        id = host.setInterval(function(){
          left--;
          show();
          if(o.onTick) o.onTick(left);
          if(left <= 0){ host.clearInterval(id); onDone(); }
        }, 1000);
      },
      refresh: show,
      left: function(){ return left; },
      running: function(){ return !!id; }
    };
  }

  // ---------- Hình vẽ dùng chung cho các game canvas ----------
  // Vẽ sẵn MỘT lần lúc mount ra canvas phụ: gradient/đường cong chỉ tốn lúc này, mỗi khung chỉ còn drawImage.
  function sprite(w, h, paint){
    var d = Math.min(window.devicePixelRatio || 1, 2), c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * d)); c.height = Math.max(1, Math.ceil(h * d));
    var x = c.getContext('2d');
    x.scale(d, d);
    paint(x, w, h);
    return { img: c, w: w, h: h };
  }
  // Lớp nền trượt ngang lặp vô hạn: ảnh rộng đúng s.w, vẽ hai bản nối đuôi.
  function drawStrip(ctx, s, offset, y){
    var x = -(((offset % s.w) + s.w) % s.w);
    ctx.drawImage(s.img, x, y, s.w, s.h);
    ctx.drawImage(s.img, x + s.w, y, s.w, s.h);
  }
  // Dải đồi lặp liền mạch: chu kỳ mọi sóng sin chia hết bề rộng.
  function hillStrip(w, h, color, k1, k2, phase){
    return sprite(w, h, function(x){
      x.fillStyle = color;
      x.beginPath();
      x.moveTo(0, h);
      for(var i = 0; i <= w; i += 4){
        var t = i / w * Math.PI * 2;
        x.lineTo(i, h * 0.45 + Math.sin(t * k1 + phase) * h * 0.25 + Math.sin(t * k2) * h * 0.12);
      }
      x.lineTo(w, h);
      x.closePath();
      x.fill();
    });
  }
  function starStrip(w, h, n){
    return sprite(w, h, function(x){
      for(var i = 0; i < n; i++){
        x.fillStyle = 'rgba(248,250,252,' + (0.18 + Math.random() * 0.4).toFixed(2) + ')';
        var r = Math.random() < 0.2 ? 1.6 : 1;
        x.fillRect(Math.random() * w, Math.random() * h, r, r);
      }
    });
  }
  function hexRgb(c){
    var s = String(c).trim().replace('#', '');
    if(s.length === 3) s = s.replace(/./g, '$&$&');
    var n = /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : 0x888888;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mix(a, b, t){
    var x = hexRgb(a), y = hexRgb(b), out = '#';
    for(var i = 0; i < 3; i++) out += ('0' + Math.round(x[i] + (y[i] - x[i]) * t).toString(16)).slice(-2);
    return out;
  }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function roundRect(x, l, t, w, h, r){
    x.beginPath();
    x.moveTo(l + r, t);
    x.arcTo(l + w, t, l + w, t + h, r);
    x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r);
    x.arcTo(l, t, l + w, t, r);
    x.closePath();
  }

  // ---------- Flappy (canvas, game mẫu) ----------
  games.push({
    id: 'flappy', name: 'Flappy mini', icon: '🐦', desc: 'Bay qua khe giữa các cột', cat: 'Arcade', dur: '1p',
    help: 'Chạm vào màn hình để chim vỗ cánh bay lên, thả tay thì chim rơi. Lách qua khe giữa các cột; chạm cột hoặc rơi xuống đất là hết ván. Càng qua nhiều cột, cột chạy càng nhanh và khe càng hẹp.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size();
      var W = Math.max(240, Math.min(size.w, 460)), H = Math.max(280, Math.min(size.h, Math.round(W * 1.6)));
      var c = makeCanvas(host, W, H, 'Sân chơi Flappy: chạm hoặc bấm phím cách để bay lên'), cv = c.cv, ctx = c.ctx;
      var cPipe = themeColor(host.root, '--good', '#34D399'), cBird = themeColor(host.root, '--warn', '#FBBF24'),
        cText = themeColor(host.root, '--text', '#F8FAFC'), cLine = themeColor(host.root, '--panel3', '#24304F');
      var pipeHi = mix(cPipe, '#FFFFFF', 0.35), pipeLo = mix(cPipe, '#000000', 0.28), groundHi = mix(cLine, '#FFFFFF', 0.12);
      var GRAVITY = 1500, FLAP = -430, PIPE_W = 54, R = 13;
      var GAP0 = Math.max(130, Math.round(H * 0.27)), SPACING = Math.max(190, Math.round(W * 0.56)), GROUND = H - 18;
      // Khó dần theo điểm: cột nhanh lên 150 → 210 px/giây (đủ ở 40 điểm), khe hẹp dần tới tối thiểu 120px.
      function speedAt(n){ return 150 + Math.min(n, 40) * 1.5; }
      function gapAt(n){ return Math.max(120, GAP0 - Math.min(n, 30) * 1.5); }
      var still = host.reducedMotion ? 0 : 1;
      var stars = starStrip(W, GROUND * 0.6, Math.round(W / 9));
      var hills = hillStrip(W, Math.round(H * 0.22), mix(BG, cLine, 0.55), 2, 5, 0.7);
      var BS = 40;
      function birdFrame(up){
        return sprite(BS, BS, function(x){
          x.translate(BS / 2, BS / 2);
          x.fillStyle = cBird;
          x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.fill();
          x.fillStyle = mix(cBird, '#FFFFFF', 0.45);
          x.beginPath(); x.ellipse(1, 5, 8, 5, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#F97316';
          x.beginPath(); x.moveTo(10, -1); x.lineTo(19, 2); x.lineTo(10, 6); x.closePath(); x.fill();
          x.fillStyle = '#FFFFFF';
          x.beginPath(); x.arc(5, -4, 4.4, 0, Math.PI * 2); x.fill();
          x.fillStyle = INK;
          x.beginPath(); x.arc(6.4, -4, 2.1, 0, Math.PI * 2); x.fill();
          x.fillStyle = mix(cBird, '#000000', 0.22);
          x.beginPath(); x.ellipse(-5, up ? -4 : 3, 7.5, 4, up ? -0.5 : 0.35, 0, Math.PI * 2); x.fill();
        });
      }
      var wingUp = birdFrame(true), wingDown = birdFrame(false);
      var bird = { x: Math.round(W * 0.28), y: H * 0.45, py: H * 0.45, v: 0, rot: 0 };
      var pipes = [], score = 0, started = false, over = false, dying = false, finished = false;
      var clock = 0, scroll = 0, pScroll = 0, wingT = 0, pop = 0, deadT = 0, landedAt = -1;

      function flap(){
        if(over) return;
        started = true;
        bird.v = FLAP;
        wingT = 0.12;
        host.sfx('flap', { pitch: Math.random() * 2 - 1 });
        host.haptic('light');
      }
      function die(){
        over = dying = true;
        deadT = 0;
        if(bird.v < -150) bird.v = -150;
        host.hitstop(80);
        host.sfx('crash');
        host.haptic('heavy');
        host.fx.flash({ color: '#FFFFFF', alpha: 0.35, ms: 100 });
        host.fx.shake(260, 8);
        var p = host.fx.fromCanvas(cv, bird.x, bird.y);
        host.fx.burst(p.x, p.y, { n: 24, colors: [cBird, '#FFFFFF', '#F97316'], speed: 260, life: 600, size: 3.2 });
      }
      function finish(){
        if(finished) return;
        finished = true;
        host.end({ score: score, won: false, message: score > 0 ? 'Hết ván' : 'Chưa qua cột nào' });
      }
      function hitsRect(cx, cy, rr, x, y, w, h){
        var dx = cx - clamp(cx, x, x + w), dy = cy - clamp(cy, y, y + h);
        return dx * dx + dy * dy < rr * rr;
      }
      function update(s){
        clock += s;
        if(wingT > 0) wingT -= s;
        if(pop > 0) pop -= s;
        bird.py = bird.y;
        pScroll = scroll;
        if(!started){
          bird.y = H * 0.45 + Math.sin(clock * 4) * 6;
          scroll += 40 * s;
          return;
        }
        if(dying){
          // Chim rơi xoay xuống đất rồi mới hiện bảng kết quả (tối đa 0,7 giây sau cú va).
          deadT += s;
          bird.v = Math.min(bird.v + GRAVITY * s, 900);
          bird.y += bird.v * s;
          bird.rot += (Math.PI / 2 - bird.rot) * Math.min(1, s * 10);
          if(bird.y + R >= GROUND){ bird.y = GROUND - R; if(landedAt < 0) landedAt = deadT; }
          if((landedAt >= 0 && deadT - landedAt >= 0.25) || deadT >= 0.7) finish();
          return;
        }
        var sp = speedAt(score);
        scroll += sp * s;
        bird.v += GRAVITY * s;
        bird.y += bird.v * s;
        if(bird.y - R < 0){ bird.y = R; bird.v = 0; }
        bird.rot = clamp(-25 + (bird.v - FLAP) * 95 / 1030, -25, 70) * Math.PI / 180;
        var last = pipes[pipes.length - 1];
        if(!last || last.x < W - SPACING){
          var gap = gapAt(score), margin = 36 + gap / 2, x0 = last ? W : W + 40;
          pipes.push({ x: x0, px: x0, gapY: margin + Math.random() * (GROUND - 2 * margin), gap: gap, passed: false });
        }
        for(var i = 0; i < pipes.length; i++){
          var p = pipes[i];
          p.px = p.x;
          p.x -= sp * s;
          if(!p.passed && p.x + PIPE_W < bird.x - R){
            p.passed = true;
            score++;
            host.setScore(score);
            pop = 0.25;
            if(score % 10 === 0){
              host.sfx('combo', { level: score / 10 });
              host.fx.flash({ color: cBird, alpha: 0.12, ms: 140 });
            } else host.sfx('point');
          }
          // Va chạm hình tròn với thân cột (hụt 2px cho công bằng): góc chim không còn chết oan.
          if(hitsRect(bird.x, bird.y, R - 2, p.x, 0, PIPE_W, p.gapY - p.gap / 2) ||
             hitsRect(bird.x, bird.y, R - 2, p.x, p.gapY + p.gap / 2, PIPE_W, GROUND - (p.gapY + p.gap / 2))){ die(); return; }
        }
        if(pipes.length && pipes[0].x < -PIPE_W - 8) pipes.shift();
        if(bird.y + R > GROUND){ bird.y = GROUND - R; die(); }
      }
      function drawPipe(x, top, bottom){
        var hb = GROUND - bottom;
        ctx.fillStyle = cPipe;
        ctx.fillRect(x, 0, PIPE_W, top);
        ctx.fillRect(x, bottom, PIPE_W, hb);
        ctx.fillRect(x - 4, top - 14, PIPE_W + 8, 14);
        ctx.fillRect(x - 4, bottom, PIPE_W + 8, 14);
        ctx.fillStyle = pipeHi;
        ctx.fillRect(x + 7, 0, 7, top - 14);
        ctx.fillRect(x + 7, bottom + 14, 7, hb - 14);
        ctx.fillRect(x - 1, top - 12, 8, 10);
        ctx.fillRect(x - 1, bottom + 2, 8, 10);
        ctx.fillStyle = pipeLo;
        ctx.fillRect(x + PIPE_W - 11, 0, 11, top - 14);
        ctx.fillRect(x + PIPE_W - 11, bottom + 14, 11, hb - 14);
        ctx.fillRect(x - 4, top - 3, PIPE_W + 8, 3);
        ctx.fillRect(x - 4, bottom + 11, PIPE_W + 8, 3);
      }
      function render(a){
        var by = lerp(bird.py, bird.y, a), sc = lerp(pScroll, scroll, a);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        drawStrip(ctx, stars, sc * 0.15 * still, 0);
        drawStrip(ctx, hills, sc * 0.4 * still, GROUND - hills.h);
        for(var i = 0; i < pipes.length; i++){
          var p = pipes[i];
          drawPipe(lerp(p.px, p.x, a), p.gapY - p.gap / 2, p.gapY + p.gap / 2);
        }
        ctx.fillStyle = cLine;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = groundHi;
        ctx.fillRect(0, GROUND, W, 2);
        for(var gx = -(sc % 24); gx < W; gx += 24) ctx.fillRect(gx, GROUND + 7, 12, 3);
        var up = started ? wingT > 0 : Math.sin(clock * 14) > 0;
        ctx.save();
        ctx.translate(bird.x, by);
        ctx.rotate(bird.rot);
        ctx.drawImage((up && !dying ? wingUp : wingDown).img, -BS / 2, -BS / 2, BS, BS);
        ctx.restore();
        if(started){
          var k = pop > 0 && still ? 1 + 0.25 * (pop / 0.25) : 1;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.font = '800 ' + Math.round(44 * k) + 'px ' + FONT;
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.fillText(String(score), W / 2 + 2, 74);
          ctx.fillStyle = cText;
          ctx.fillText(String(score), W / 2, 72);
        } else canvasHint(ctx, 'Chạm để bay', W / 2, H * 0.3, cText);
      }

      host.on(cv, 'pointerdown', function(e){ e.preventDefault(); flap(); });
      host.on(cv, 'keydown', function(e){
        if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp'){ e.preventDefault(); flap(); }
      });
      host.setScore(0);
      host.loop(update, render);
      render(1);
      // Vỏ tự đứng vòng lặp khi tạm dừng và tự gỡ mọi thứ khi huỷ: game này không cần làm gì thêm.
      return { pause: function(){}, resume: function(){}, destroy: function(){} };
    }
  });

  // ---------- Rắn săn mồi ----------
  var SNAKE_DIRS = { up: { x: 0, y: -1, name: 'up' }, down: { x: 0, y: 1, name: 'down' }, left: { x: -1, y: 0, name: 'left' }, right: { x: 1, y: 0, name: 'right' } };
  games.push({
    id: 'snake', name: 'Rắn săn mồi', icon: '🐍', desc: 'Ăn táo và tránh va chạm', cat: 'Arcade', dur: '5p',
    help: 'Vuốt trên màn hình hoặc bấm mũi tên để đổi hướng. Ăn táo để dài ra và chạy nhanh dần; đâm vào tường hoặc vào thân là hết ván.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size(), N = 15;
      var cell = Math.floor(clamp(Math.min(size.w, size.h - 204), 150, 420) / N), side = cell * N;
      var c = makeCanvas(host, side, side, 'Sân rắn săn mồi: vuốt hoặc bấm mũi tên để đổi hướng'), cv = c.cv, ctx = c.ctx;
      host.root.appendChild(makePad(host, turn));
      var stat = statWriter(host);
      var cBody = themeColor(host.root, '--good', '#34D399'), cApple = themeColor(host.root, '--bad', '#FB7185'),
        cText = themeColor(host.root, '--text', '#F8FAFC'), cGrid = themeColor(host.root, '--panel', '#131B2E');
      var bodyLo = mix(cBody, '#000000', 0.3), bodyHi = mix(cBody, '#FFFFFF', 0.3), still = host.reducedMotion ? 0 : 1;
      var board = sprite(side, side, function(x){
        x.fillStyle = BG;
        x.fillRect(0, 0, side, side);
        x.fillStyle = cGrid;
        for(var y = 0; y < N; y++) for(var k = (y % 2); k < N; k += 2) x.fillRect(k * cell, y * cell, cell, cell);
      });
      var AS = cell * 1.2;
      var appleImg = sprite(AS, AS, function(x){
        var r = cell * 0.38;
        x.translate(AS / 2, AS / 2 + 1);
        x.fillStyle = cApple;
        x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,255,255,.45)';
        x.beginPath(); x.ellipse(-r * 0.35, -r * 0.35, r * 0.3, r * 0.2, -0.7, 0, Math.PI * 2); x.fill();
        x.fillStyle = cBody;
        x.beginPath(); x.ellipse(r * 0.35, -r * 1.02, r * 0.38, r * 0.18, -0.5, 0, Math.PI * 2); x.fill();
      });
      var snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }], dir = SNAKE_DIRS.right, queue = [];
      // Vẽ trễ logic đúng một nhịp và nội suy giữa hai nhịp: đầu trượt từ ô cũ sang ô mới, đuôi trượt từ tailFrom
      // về ô đuôi mới, các khúc giữa nằm đúng tâm ô. Va chạm vẫn tính theo ô như cũ.
      var tailFrom = snake[2], acc = 0, ticked = false;
      var apple = null, score = 0, started = false, over = false, finished = false, dying = 0, endMsg = '', clock = 0, puff = 0;

      function placeApple(){
        var free = [], x, y;
        for(y = 0; y < N; y++) for(x = 0; x < N; x++){
          if(!snake.some(function(p){ return p.x === x && p.y === y; })) free.push({ x: x, y: y });
        }
        apple = free.length ? free[rnd(free.length)] : null;
        return !!apple;
      }
      function turn(name){
        var d = SNAKE_DIRS[name];
        if(!d || over) return;
        var last = queue.length ? queue[queue.length - 1] : dir;
        if(d !== last && !(d.x === -last.x && d.y === -last.y) && queue.length < 2) queue.push(d);
        cv.setAttribute('data-dir', (queue.length ? queue[queue.length - 1] : dir).name);
        started = true;
      }
      function tickMs(){ return Math.max(85, 150 - Math.floor(score / 4) * 8); }
      function at(p){ return host.fx.fromCanvas(cv, (p.x + 0.5) * cell, (p.y + 0.5) * cell); }
      function die(head, wall){
        over = true;
        dying = 0.45;
        endMsg = wall ? 'Đâm vào tường' : 'Cắn vào thân';
        host.hitstop(90);
        host.sfx('crash');
        host.haptic('heavy');
        host.fx.shake(200, 6);
        var p = at({ x: clamp(head.x, 0, N - 1), y: clamp(head.y, 0, N - 1) });
        host.fx.burst(p.x, p.y, { n: 14, colors: [cApple, cBody, '#FFFFFF'], speed: 220, life: 520, size: 3 });
      }
      function tick(){
        if(queue.length) dir = queue.shift();
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        var eat = head.x === apple.x && head.y === apple.y;
        // Không ăn thì đuôi rời đi trong chính bước này, nên ô đuôi không tính là va chạm.
        var body = eat ? snake : snake.slice(0, -1);
        var wall = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N;
        if(wall || body.some(function(p){ return p.x === head.x && p.y === head.y; })){ die(head, wall); return; }
        tailFrom = snake[snake.length - 1];
        snake.unshift(head);
        ticked = true;
        if(eat){
          var slow = tickMs(), p = at(apple);
          score++;
          host.setScore(score);
          host.sfx('point', { pitch: Math.min(12, (snake.length - 4) * 0.5) });
          puff = 1;
          host.fx.burst(p.x, p.y, { n: 10, colors: [cApple, '#FFFFFF', cBody], speed: 170, life: 420, size: 2.6, gravity: 0 });
          stat([{ label: 'Dài', value: String(snake.length) }]);
          if(!placeApple()){
            over = finished = true;
            host.end({ score: score, won: true, message: 'Rắn đã kín sân!' });
            return;
          }
          if(tickMs() < slow) host.fx.text(p.x, p.y - 14, 'Nhanh hơn!', { color: cText, size: 17 });
        } else snake.pop();
      }
      function center(p){ return { x: (p.x + 0.5) * cell, y: (p.y + 0.5) * cell }; }
      function render(a){
        ctx.drawImage(board.img, 0, 0, side, side);
        if(apple){
          var k = still ? 0.975 + 0.075 * Math.sin(clock * 6) : 1, as = AS * k, ap = center(apple);
          ctx.drawImage(appleImg.img, ap.x - as / 2, ap.y - as / 2, as, as);
        }
        var h0 = center(snake[1]), h1 = center(snake[0]), t0 = center(tailFrom), t1 = center(snake[snake.length - 1]);
        var hx = lerp(h0.x, h1.x, a), hy = lerp(h0.y, h1.y, a);
        // Rắn chết nhấp nháy đỏ 3 lần trong 0,45 giây.
        var red = over && !finished && dying > 0 && Math.floor((0.45 - dying) / 0.075) % 2 === 0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        for(var i = 1; i < snake.length; i++){ var q = center(snake[i]); ctx.lineTo(q.x, q.y); }
        ctx.lineTo(lerp(t0.x, t1.x, a), lerp(t0.y, t1.y, a));
        ctx.strokeStyle = red ? mix(cApple, '#000000', 0.3) : bodyLo;
        ctx.lineWidth = cell * 0.78;
        ctx.stroke();
        ctx.strokeStyle = red ? cApple : cBody;
        ctx.lineWidth = cell * 0.56;
        ctx.stroke();
        var dx = snake[0].x - snake[1].x, dy = snake[0].y - snake[1].y, hr = cell * 0.44 * (1 + 0.22 * puff * still);
        ctx.fillStyle = red ? cApple : bodyHi;
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
        var ex = -dy * cell * 0.2, ey = dx * cell * 0.2, fx = dx * cell * 0.12, fy = dy * cell * 0.12, er = Math.max(2, cell * 0.13);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(hx + ex + fx, hy + ey + fy, er, 0, Math.PI * 2); ctx.arc(hx - ex + fx, hy - ey + fy, er, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(hx + ex + fx * 1.6, hy + ey + fy * 1.6, er * 0.55, 0, Math.PI * 2); ctx.arc(hx - ex + fx * 1.6, hy - ey + fy * 1.6, er * 0.55, 0, Math.PI * 2); ctx.fill();
        if(!started) canvasHint(ctx, 'Vuốt hoặc bấm mũi tên', side / 2, side * 0.3, cText);
      }
      function frame(dt){
        clock += dt / 1000;
        if(puff > 0) puff = Math.max(0, puff - dt / tickMs());
        if(over){
          if(dying > 0){
            dying -= dt / 1000;
            if(dying <= 0 && !finished){ finished = true; host.end({ score: score, message: endMsg }); return; }
          }
          render(1);
          return;
        }
        if(started){
          acc += dt;
          for(var n = 0; acc >= tickMs() && n < 3 && !over; n++){ acc -= tickMs(); tick(); }
          if(acc > tickMs()) acc = tickMs();
        }
        render(over || !ticked ? 1 : Math.min(1, acc / tickMs()));
      }

      host.swipe(host.root, turn, { live: true, threshold: 18 });
      cv.setAttribute('data-dir', dir.name);
      placeApple();
      host.setScore(0);
      stat([{ label: 'Dài', value: String(snake.length) }]);
      host.raf(frame);
      render(1);
      return {};
    }
  });

  // ---------- Pong ----------
  games.push({
    id: 'pong', name: 'Pong mini', icon: '🏓', desc: 'Giữ bóng không rơi', cat: 'Arcade', dur: '5p',
    help: 'Đặt ngón tay lên sân rồi kéo ngang để di chuyển thanh đỡ. Mỗi lần đỡ được bóng là 1 điểm và bóng bay nhanh hơn; đang kéo mà đỡ thì bóng bay xoáy theo hướng kéo. Để bóng rơi là hết ván.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size();
      var W = clamp(size.w, 240, 440), H = clamp(Math.round(W * 1.55), 300, Math.max(300, size.h));
      var c = makeCanvas(host, W, H, 'Sân Pong: kéo ngang để di chuyển thanh đỡ'), cv = c.cv, ctx = c.ctx;
      var stat = statWriter(host);
      var cPad = themeColor(host.root, '--brand', '#60A5FA'), cBall = themeColor(host.root, '--warn', '#FBBF24'),
        cText = themeColor(host.root, '--text', '#F8FAFC'), cLine = themeColor(host.root, '--panel3', '#24304F'),
        cBad = themeColor(host.root, '--bad', '#FB7185');
      // Thanh đỡ nằm cao hơn đáy sân để ngón tay kéo ở phía dưới không che mất nó.
      var R = 8, PAD_W = Math.max(72, Math.round(W * 0.25)), PAD_H = 12, PAD_Y = H - 72;
      var SPEED0 = Math.round(H * 0.5), SPEED_MAX = SPEED0 * 2.2, MAX_ANGLE = 70 * Math.PI / 180, TRAIL = 8;
      var padX = W / 2, prevPadX = W / 2, padVel = 0, ball = { x: W / 2, y: H * 0.3, px: W / 2, py: H * 0.3, vx: 0, vy: 0 }, speed = SPEED0;
      var score = 0, started = false, over = false, dying = false, finished = false, left = 0, deadT = 0;
      var trailX = new Float32Array(TRAIL), trailY = new Float32Array(TRAIL), trailN = 0, trailHead = 0;
      var squash = 0, squashY = true, dip = 0;
      var field = sprite(W, H, function(x){
        x.fillStyle = 'rgba(248,250,252,.05)';
        for(var gy = 22; gy < PAD_Y; gy += 28) for(var gx = 14; gx < W; gx += 28) x.fillRect(gx, gy, 2, 2);
        x.fillStyle = mix(BG, cLine, 0.7);
        x.fillRect(0, 0, 3, H);
        x.fillRect(W - 3, 0, 3, H);
        x.fillRect(0, 0, W, 3);
        x.fillStyle = cLine;
        x.fillRect(0, PAD_Y + PAD_H + 10, W, 2);
      });
      var padImg = sprite(PAD_W, PAD_H, function(x, w, h){
        x.fillStyle = cPad;
        roundRect(x, 0, 0, w, h, h / 2);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,.35)';
        roundRect(x, 4, 2, w - 8, 3, 1.5);
        x.fill();
      });
      var ballImg = sprite(R * 2 + 2, R * 2 + 2, function(x){
        x.translate(R + 1, R + 1);
        x.fillStyle = cBall;
        x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,255,255,.55)';
        x.beginPath(); x.arc(-2.5, -2.5, R * 0.35, 0, Math.PI * 2); x.fill();
      });

      function showSpeed(){
        stat([{ label: 'Tốc độ', value: (speed / SPEED0).toFixed(1).replace('.', ',') + '×' }]);
      }
      function movePad(clientX){ padX = clamp(clientX - left, PAD_W / 2, W - PAD_W / 2); }
      function launch(){
        var a = (0.25 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1);
        ball.vx = speed * Math.sin(a);
        ball.vy = speed * Math.cos(a);
        started = true;
        host.sfx('whoosh');
      }
      function wall(){
        squash = 0.08;
        squashY = false;
        host.sfx('bounce');
      }
      function finish(){
        if(finished) return;
        finished = true;
        host.end({ score: score, won: false, message: score > 0 ? 'Bóng rơi rồi' : 'Chưa đỡ được quả nào' });
      }
      function update(s){
        // Vận tốc thanh đỡ làm mượt trong khoảng 0,1 giây gần nhất (ngón tay báo vị trí ~60 lần/giây).
        padVel += ((padX - prevPadX) / s - padVel) * Math.min(1, s / 0.1);
        prevPadX = padX;
        if(squash > 0) squash -= s;
        if(dip > 0) dip -= s;
        ball.px = ball.x;
        ball.py = ball.y;
        if(!started) return;
        if(dying){
          deadT += s;
          if(deadT >= 0.35) finish();
          return;
        }
        var prevY = ball.y;
        ball.x += ball.vx * s;
        ball.y += ball.vy * s;
        if(ball.x < R){ ball.x = R; ball.vx = Math.abs(ball.vx); wall(); }
        if(ball.x > W - R){ ball.x = W - R; ball.vx = -Math.abs(ball.vx); wall(); }
        if(ball.y < R){ ball.y = R; ball.vy = Math.abs(ball.vy); squash = 0.08; squashY = true; host.sfx('bounce'); }
        if(ball.vy > 0 && prevY + R <= PAD_Y && ball.y + R >= PAD_Y && Math.abs(ball.x - padX) <= PAD_W / 2 + R){
          score++;
          speed = Math.min(SPEED_MAX, speed * 1.045);
          // Chạm càng xa tâm thanh đỡ, bóng bật càng xiên; thanh đang chạy thì truyền thêm xoáy theo hướng chạy.
          var a = clamp((ball.x - padX) / (PAD_W / 2), -1, 1) * 1.05;
          var ang = clamp(Math.atan2(speed * Math.sin(a) + padVel * 0.25, speed * Math.cos(a)), -MAX_ANGLE, MAX_ANGLE);
          ball.vx = speed * Math.sin(ang);
          ball.vy = -speed * Math.cos(ang);
          ball.y = PAD_Y - R;
          squash = 0.08;
          squashY = true;
          dip = 0.08;
          host.setScore(score);
          showSpeed();
          if(score % 5 === 0){
            host.sfx('combo', { level: score / 5 });
            var t = host.fx.fromCanvas(cv, W / 2, H * 0.42);
            host.fx.text(t.x, t.y, (speed / SPEED0).toFixed(1).replace('.', ',') + '×', { color: cBall, size: 30 });
          } else host.sfx('hit', { pitch: (speed / SPEED0 - 1) * 12 });
          host.haptic('light');
          var p = host.fx.fromCanvas(cv, ball.x, PAD_Y);
          host.fx.burst(p.x, p.y, { n: 8, colors: [cBall, cPad], speed: 200, life: 380, size: 2.6, gravity: 300, angle: -Math.PI / 2, spread: 2.2 });
        }
        if(ball.y - R > H){
          over = dying = true;
          deadT = 0;
          host.sfx('miss');
          host.haptic('heavy');
          host.fx.shake(220, 6);
          host.fx.flash({ color: cBad, alpha: 0.15, ms: 160 });
        }
      }
      function render(al){
        var bx = lerp(ball.px, ball.x, al), by = lerp(ball.py, ball.y, al);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(field.img, 0, 0, W, H);
        if(started && !dying){
          trailX[trailHead] = bx; trailY[trailHead] = by;
          trailHead = (trailHead + 1) % TRAIL;
          if(trailN < TRAIL) trailN++;
          ctx.fillStyle = cBall;
          for(var k = 1; k < trailN; k++){
            var j = (trailHead - trailN + k - 1 + TRAIL * 2) % TRAIL, f = k / trailN;
            ctx.globalAlpha = 0.04 + f * 0.26;
            ctx.beginPath();
            ctx.arc(trailX[j], trailY[j], R * (0.35 + f * 0.55), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(padImg.img, padX - PAD_W / 2, PAD_Y + (dip > 0 ? 3 * dip / 0.08 : 0), PAD_W, PAD_H);
        if(!dying){
          var q = squash > 0 ? 0.28 * squash / 0.08 : 0, sx = squashY ? 1 + q : 1 - q, sy = squashY ? 1 - q : 1 + q;
          ctx.save();
          ctx.translate(bx, by);
          ctx.scale(sx, sy);
          ctx.drawImage(ballImg.img, -R - 1, -R - 1, R * 2 + 2, R * 2 + 2);
          ctx.restore();
        }
        if(!started) canvasHint(ctx, 'Chạm để phát bóng', W / 2, H * 0.5, cText);
        else if(score === 0 && !dying) canvasHint(ctx, 'Kéo ngang để đỡ bóng', W / 2, H - 28, cLine);
      }

      host.on(cv, 'pointerdown', function(e){
        e.preventDefault();
        left = cv.getBoundingClientRect().left;
        try{ cv.setPointerCapture(e.pointerId); }catch(err){}
        movePad(e.clientX);
        if(!started && !over) launch();
      });
      host.on(cv, 'pointermove', function(e){
        if(e.pointerType === 'mouse' && !e.buttons && !started) return;
        left = left || cv.getBoundingClientRect().left;
        movePad(e.clientX);
      });
      host.on(cv, 'keydown', function(e){
        if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
          e.preventDefault();
          padX = clamp(padX + (e.key === 'ArrowLeft' ? -32 : 32), PAD_W / 2, W - PAD_W / 2);
        } else if((e.key === ' ' || e.key === 'Enter') && !started && !over){ e.preventDefault(); launch(); }
      });
      host.setScore(0);
      showSpeed();
      host.loop(update, render);
      render(1);
      return {};
    }
  });

  // ---------- Runner ----------
  games.push({
    id: 'runner', name: 'Runner', icon: '🏃', desc: 'Nhảy qua vật cản', cat: 'Arcade', dur: '1p',
    help: 'Chạm nút Nhảy (hoặc chạm vào sân) để nhảy qua vật cản: giữ lâu thì nhảy cao, chạm nhanh thì nhảy thấp. Càng chạy càng nhanh; đụng vật cản là hết ván.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size();
      // Nút Nhảy cao 132px + khoảng cách 12px: sân lấp phần còn lại thay vì để trống.
      var W = clamp(size.w, 240, 460), H = clamp(size.h - 144 - 12, 220, Math.round(W * 1.05));
      var c = makeCanvas(host, W, H, 'Đường chạy: chạm để nhảy qua vật cản, giữ lâu để nhảy cao'), cv = c.cv, ctx = c.ctx;
      var jumpBtn = button('g-big', 'Nhảy');
      host.root.appendChild(jumpBtn);
      var cMe = themeColor(host.root, '--brand', '#60A5FA'), cMe2 = themeColor(host.root, '--brand2', '#A78BFA'),
        cObs = themeColor(host.root, '--bad', '#FB7185'), cText = themeColor(host.root, '--text', '#F8FAFC'),
        cLine = themeColor(host.root, '--panel3', '#24304F'), cMuted = themeColor(host.root, '--muted', '#A9B4CC');
      var meDark = mix(cMe, '#000000', 0.35), obsHi = mix(cObs, '#FFFFFF', 0.3), obsLo = mix(cObs, '#000000', 0.3), groundHi = mix(cLine, '#FFFFFF', 0.12);
      var GROUND = H - 36, GRAVITY = 2400, JUMP = -760, ME_X = Math.round(W * 0.16), ME_W = 26, ME_H = 34;
      var still = host.reducedMotion ? 0 : 1;
      var stars = starStrip(W, Math.round(GROUND * 0.55), Math.round(W / 12));
      var far = hillStrip(W, Math.round(H * 0.3), mix(BG, cLine, 0.4), 2, 3, 1.3);
      var near = hillStrip(W, Math.round(H * 0.16), mix(BG, cLine, 0.75), 3, 7, 0.2);
      var y = GROUND, py = GROUND, vy = 0, speed = 230, obs = [], score = 0, started = false, over = false, dying = false, finished = false;
      var wantJump = 0, held = false, cutPending = false, airT = 0, dist = 0, pdist = 0, stretch = 0, squashT = 0, deadT = 0;

      function press(e){
        if(over) return;
        if(e && e.pointerId !== undefined && e.currentTarget && e.currentTarget.setPointerCapture){
          try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(err){}
        }
        held = true;
        started = true;
        // Bấm hơi sớm trước khi chạm đất vẫn được tính (nhớ 0,12 giây).
        wantJump = 0.12;
      }
      function release(){
        held = false;
        if(vy < 0) cutPending = true;
      }
      function land(){
        squashT = 0.1;
        host.sfx('land', { vol: 0.7 });
        var p = host.fx.fromCanvas(cv, ME_X + ME_W / 2, GROUND);
        host.fx.burst(p.x, p.y, { n: 6, color: cMuted, speed: 90, life: 380, size: 2.4, gravity: 120, angle: -Math.PI / 2, spread: 2.6 });
      }
      function die(o){
        over = dying = true;
        deadT = 0;
        host.hitstop(70);
        host.sfx('crash');
        host.haptic('heavy');
        host.fx.shake(240, 7);
        var p = host.fx.fromCanvas(cv, Math.max(o.x, ME_X + ME_W / 2), y - ME_H / 2);
        host.fx.burst(p.x, p.y, { n: 18, colors: [cObs, '#FFFFFF'], speed: 240, life: 520, size: 3 });
      }
      function finish(){
        if(finished) return;
        finished = true;
        host.end({ score: score, won: false, message: score > 0 ? 'Vấp vật cản' : 'Chưa qua vật cản nào' });
      }
      function update(s){
        if(stretch > 0) stretch -= s;
        if(squashT > 0) squashT -= s;
        py = y;
        pdist = dist;
        for(var k = 0; k < obs.length; k++) obs[k].px = obs[k].x;
        if(!started) return;
        if(dying){
          // Ngã nhào 0,4 giây rồi mới hiện bảng kết quả.
          deadT += s;
          if(y < GROUND){ vy += GRAVITY * s; y = Math.min(GROUND, y + vy * s); }
          if(deadT >= 0.45) finish();
          return;
        }
        speed = Math.min(520, speed + 9 * s);
        dist += speed * s;
        if(wantJump > 0){
          if(y >= GROUND){
            vy = JUMP;
            wantJump = 0;
            airT = 0;
            cutPending = !held;
            stretch = 0.12;
            host.sfx('jump');
            host.haptic('light');
          } else wantJump -= s;
        }
        airT += s;
        // Thả tay khi đang bay lên → hụt đà (nhảy thấp). Giữ tối thiểu 0,06 giây để cú chạm nhanh nhất vẫn qua được vật cản thấp.
        if(cutPending){
          if(vy >= 0) cutPending = false;
          else if(airT >= 0.06){ vy *= 0.45; cutPending = false; }
        }
        var air = y < GROUND;
        vy += GRAVITY * s;
        y += vy * s;
        if(y > GROUND){ y = GROUND; vy = 0; if(air) land(); }
        var last = obs[obs.length - 1];
        if(!last || last.x < W - last.gap){
          obs.push({ x: W + 20, px: W + 20, w: 18 + rnd(13), h: 28 + rnd(27), gap: speed * (0.9 + Math.random() * 0.75), passed: false });
        }
        for(var i = 0; i < obs.length; i++){
          var o = obs[i];
          o.x -= speed * s;
          if(!o.passed && o.x + o.w < ME_X){
            o.passed = true;
            score++;
            host.setScore(score);
            if(score % 10 === 0){
              host.sfx('combo', { level: score / 10 });
              var t = host.fx.fromCanvas(cv, ME_X + ME_W / 2, y - ME_H - 10);
              host.fx.text(t.x, t.y, score + '!', { color: cMe, size: 26 });
            } else host.sfx('point');
          }
          if(ME_X + ME_W - 4 > o.x && ME_X + 4 < o.x + o.w && y > GROUND - o.h + 4){ die(o); return; }
        }
        if(obs.length && obs[0].x < -40) obs.shift();
      }
      function drawRunner(footY, d){
        var sx = 1, sy = 1, airborne = footY < GROUND - 0.5;
        if(stretch > 0 && still){ sy = 1 + 0.15 * stretch / 0.12; sx = 1 - 0.1 * stretch / 0.12; }
        else if(squashT > 0 && still){ sy = 1 - 0.15 * squashT / 0.1; sx = 1 + 0.12 * squashT / 0.1; }
        var sw = airborne || !started ? 0 : Math.sin(d / 13) * 7;
        ctx.save();
        ctx.translate(ME_X + ME_W / 2, footY);
        if(dying) ctx.rotate(Math.min(1, deadT / 0.4) * 1.35);
        ctx.scale(sx, sy);
        ctx.lineCap = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = meDark;
        ctx.beginPath();
        if(airborne){
          ctx.moveTo(-3, -13); ctx.lineTo(-8, -6); ctx.lineTo(-3, -2);
          ctx.moveTo(4, -13); ctx.lineTo(9, -7);
        } else {
          ctx.moveTo(-3, -13); ctx.lineTo(-3 + sw, -2);
          ctx.moveTo(4, -13); ctx.lineTo(4 - sw, -2);
        }
        ctx.moveTo(0, -24); ctx.lineTo(-6 - sw * 0.6, -16);
        ctx.stroke();
        ctx.fillStyle = cMe;
        roundRect(ctx, -9, -28, 18, 17, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(2, -29, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cMe2;
        ctx.fillRect(-4, -34, 12, 3);
        ctx.fillStyle = INK;
        ctx.fillRect(5, -31, 3, 3);
        ctx.strokeStyle = cMe;
        ctx.beginPath();
        ctx.moveTo(2, -24); ctx.lineTo(9 + sw * 0.6, -18);
        ctx.stroke();
        ctx.restore();
      }
      function render(a){
        var yy = lerp(py, y, a), d = lerp(pdist, dist, a);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        drawStrip(ctx, stars, d * 0.05 * still, 0);
        drawStrip(ctx, far, d * 0.15 * still, GROUND - far.h);
        drawStrip(ctx, near, d * 0.4 * still, GROUND - near.h);
        ctx.fillStyle = cLine;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = groundHi;
        ctx.fillRect(0, GROUND, W, 2);
        ctx.fillStyle = BG;
        for(var gx = -(d % 46); gx < W; gx += 46) ctx.fillRect(gx, GROUND + 12, 22, 3);
        for(var i = 0; i < obs.length; i++){
          var o = obs[i], ox = lerp(o.px, o.x, a), top = GROUND - o.h;
          ctx.fillStyle = cObs;
          ctx.fillRect(ox, top, o.w, o.h);
          ctx.fillStyle = obsHi;
          ctx.fillRect(ox, top, o.w, 4);
          ctx.fillRect(ox + 3, top + 4, 3, o.h - 4);
          ctx.fillStyle = obsLo;
          ctx.fillRect(ox + o.w - 4, top + 4, 4, o.h - 4);
        }
        drawRunner(yy, d);
        if(!started) canvasHint(ctx, 'Chạm để chạy', W / 2, H * 0.36, cText);
      }

      host.tap(jumpBtn, press);
      host.on(cv, 'pointerdown', function(e){ e.preventDefault(); press(e); });
      [jumpBtn, cv].forEach(function(n){
        host.on(n, 'pointerup', release);
        host.on(n, 'pointercancel', release);
      });
      host.on(cv, 'keydown', function(e){
        if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp'){ e.preventDefault(); if(!e.repeat) press(); }
      });
      host.on(cv, 'keyup', function(e){
        if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') release();
      });
      host.setScore(0);
      host.loop(update, render);
      render(1);
      return {};
    }
  });

  // ---------- Xếp tháp ----------
  games.push({
    id: 'tower', name: 'Xếp tháp', icon: '🏗️', desc: 'Thả khối đúng nhịp', cat: 'Arcade', dur: '5p',
    help: 'Khối trên cùng chạy qua lại — chạm để thả nó xuống tháp. Phần thò ra ngoài bị cắt mất nên khối nhỏ dần; thả trượt hẳn ra ngoài là hết ván.',
    score: { label: 'Tầng', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size();
      var W = clamp(size.w, 240, 440), H = clamp(size.h - 64, 300, Math.round(W * 1.5));
      var c = makeCanvas(host, W, H, 'Tháp: chạm để thả khối'), cv = c.cv, ctx = c.ctx;
      var dropBtn = button('g-btn primary', 'Thả khối');
      host.root.appendChild(dropBtn);
      var cA = themeColor(host.root, '--brand', '#60A5FA'), cB = themeColor(host.root, '--brand2', '#A78BFA'),
        cMove = themeColor(host.root, '--warn', '#FBBF24'), cText = themeColor(host.root, '--text', '#F8FAFC'),
        cLine = themeColor(host.root, '--panel3', '#24304F');
      var BH = 24, FLOOR = 28, SNAP = 4;
      // Số khối nhìn thấy trước khi camera bắt đầu cuộn: tối đa 12, ít hơn nếu sân thấp.
      var VIS = clamp(Math.floor((H - FLOOR - 96) / BH) - 1, 4, 12);
      var baseW = Math.round(W * 0.5);
      var sky = sprite(W, H, function(x){
        var g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, mix(BG, cB, 0.12));
        g.addColorStop(1, BG);
        x.fillStyle = g;
        x.fillRect(0, 0, W, H);
      });
      // Màu tầng đổi dần trong họ màu của theme (brand ↔ brand2).
      function tier(i){ return mix(cA, cB, (1 - Math.cos(i * 0.45)) / 2); }
      var stack = [{ x: (W - baseW) / 2, w: baseW, c: tier(0) }], level = 0, cam = 0, over = false, finished = false, mv = null;
      var debris = [], fall = null, chain = 0, squashT = 0, ringT = 0;

      function camTarget(){ return Math.max(0, stack.length - VIS) * BH; }
      function yOf(i, shift){ return H - FLOOR - (i + 1) * BH + shift; }
      function spawn(){
        var top = stack[stack.length - 1], fromLeft = level % 2 === 0;
        mv = { x: fromLeft ? 0 : W - top.w, px: 0, w: top.w, dir: fromLeft ? 1 : -1, speed: Math.min(W * 1.1, W * 0.42 + level * W * 0.022), c: mix(tier(stack.length), '#FFFFFF', 0.35) };
        mv.px = mv.x;
        cv.setAttribute('data-state', JSON.stringify({ level: level, y: Math.round(yOf(stack.length, camTarget())), h: BH, canvasH: H,
          x: Math.round(mv.x), topX: Math.round(top.x), speed: Math.round(mv.speed), w: Math.round(mv.w * 10) / 10 }));
      }
      function drop(){
        if(over) return;
        var top = stack[stack.length - 1], yTop = yOf(stack.length, 0);
        var left = Math.max(top.x, mv.x), overlap = Math.min(top.x + top.w, mv.x + mv.w) - left;
        if(overlap < 4){
          over = true;
          var side = mv.x + mv.w / 2 < top.x + top.w / 2 ? -1 : 1;
          fall = { x: mv.x, y: yTop, w: mv.w, vx: side * 60, vy: 0, rot: 0, vr: side * 4, t: 0, c: mv.c };
          host.sfx('crash', { vol: 0.6 });
          host.haptic('heavy');
          host.fx.shake(200, 4);
          return;
        }
        var perfect = Math.abs(mv.x - top.x) <= SNAP, color = tier(stack.length);
        if(perfect){
          left = top.x;
          overlap = top.w;
          chain++;
        } else {
          chain = 0;
          var cutX = mv.x < left ? mv.x : left + overlap, cutW = mv.w - overlap, dir = mv.x < left ? -1 : 1;
          if(cutW > 0.5) debris.push({ x: cutX, y: yTop, w: cutW, vx: dir * 70, vy: -40, rot: 0, vr: dir * 3.2, t: 0, c: color });
        }
        stack.push({ x: left, w: overlap, c: color });
        level++;
        squashT = 0.09;
        host.setScore(level);
        var p = host.fx.fromCanvas(cv, left + overlap / 2, yOf(stack.length - 1, cam));
        if(perfect){
          ringT = 0.25;
          host.sfx('perfect', { level: chain - 1 });
          host.haptic('light');
          host.fx.text(p.x, p.y - 14, chain > 1 ? 'Hoàn hảo ×' + chain : 'Hoàn hảo!', { color: cMove, size: 22 });
          var e1 = host.fx.fromCanvas(cv, left, yOf(stack.length - 1, cam) + BH / 2), e2 = host.fx.fromCanvas(cv, left + overlap, yOf(stack.length - 1, cam) + BH / 2);
          host.fx.burst(e1.x, e1.y, { n: 3, color: cMove, shape: 'spark', angle: Math.PI, spread: 0.9, speed: 260, life: 420, gravity: 0 });
          host.fx.burst(e2.x, e2.y, { n: 3, color: cMove, shape: 'spark', angle: 0, spread: 0.9, speed: 260, life: 420, gravity: 0 });
        } else {
          host.sfx('slice');
          host.sfx('drop');
          host.fx.shake(90, 2);
        }
        spawn();
      }
      function finish(){
        if(finished) return;
        finished = true;
        host.end({ score: level, won: false, message: level > 0 ? 'Tháp cao ' + level + ' tầng' : 'Thả trượt mất rồi' });
      }
      function fly(b, s){
        b.vy += 1400 * s;
        b.x += b.vx * s;
        b.y += b.vy * s;
        b.rot += b.vr * s;
        b.t += s;
      }
      function update(s){
        if(squashT > 0) squashT -= s;
        if(ringT > 0) ringT -= s;
        for(var i = debris.length - 1; i >= 0; i--){
          fly(debris[i], s);
          if(debris[i].t >= 0.9) debris.splice(i, 1);
        }
        cam += (camTarget() - cam) * Math.min(1, s * 8);
        if(fall){
          // Khối trượt rơi khỏi tháp 0,6 giây rồi mới hiện bảng kết quả.
          fly(fall, s);
          if(fall.t >= 0.6) finish();
          return;
        }
        mv.px = mv.x;
        mv.x += mv.dir * mv.speed * s;
        if(mv.x < 0){ mv.x = 0; mv.dir = 1; }
        if(mv.x > W - mv.w){ mv.x = W - mv.w; mv.dir = -1; }
      }
      function block(x, y, w, h, color){
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.fillRect(x, y + h - 3, w, 3);
      }
      function piece(b){
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - b.t / 0.9);
        ctx.translate(b.x + b.w / 2, b.y + cam + BH / 2);
        ctx.rotate(b.rot);
        block(-b.w / 2, -BH / 2, b.w, BH - 2, b.c);
        ctx.restore();
      }
      function render(a){
        ctx.drawImage(sky.img, 0, 0, W, H);
        ctx.fillStyle = cLine;
        ctx.fillRect(0, H - FLOOR + cam, W, FLOOR);
        var top = stack.length - 1;
        for(var i = Math.max(0, Math.floor(cam / BH) - 2); i < stack.length; i++){
          var yy = yOf(i, cam), hh = BH - 2;
          if(yy > H) continue;
          if(i === top && squashT > 0 && level > 0){ var q = 0.15 * squashT / 0.09; yy += hh * q; hh -= hh * q; }
          block(stack[i].x, yy, stack[i].w, hh, stack[i].c);
        }
        if(ringT > 0 && level > 0){
          var g = 1 - ringT / 0.25, ry = yOf(top, cam);
          ctx.strokeStyle = cMove;
          ctx.globalAlpha = 1 - g;
          ctx.lineWidth = 2;
          ctx.strokeRect(stack[top].x - 6 * g, ry - 6 * g, stack[top].w + 12 * g, BH - 2 + 12 * g);
          ctx.globalAlpha = 1;
        }
        for(var k = 0; k < debris.length; k++) piece(debris[k]);
        if(fall) piece(fall);
        else block(lerp(mv.px, mv.x, a), yOf(stack.length, cam), mv.w, BH - 2, mv.c);
        if(level === 0 && !over) canvasHint(ctx, 'Chạm để thả khối', W / 2, 56, cText);
      }

      host.tap(dropBtn, drop);
      host.on(cv, 'pointerdown', function(e){ e.preventDefault(); drop(); });
      host.on(cv, 'keydown', function(e){
        if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); drop(); }
      });
      host.setScore(0);
      spawn();
      host.loop(update, render);
      render(1);
      return {};
    }
  });

  // ---------- Mê cung ----------
  var MAZE_DIRS = {
    up: { bit: 1, opp: 4, dx: 0, dy: -1, side: 10 }, right: { bit: 2, opp: 8, dx: 1, dy: 0, side: 5 },
    down: { bit: 4, opp: 1, dx: 0, dy: 1, side: 10 }, left: { bit: 8, opp: 2, dx: -1, dy: 0, side: 5 }
  };
  // Đào đường theo chiều sâu (recursive backtracker): mọi ô nối với nhau bằng đúng một đường,
  // nên luôn có lối từ ô đầu tới ô cuối. Mỗi ô là bitmask các hướng đi được.
  function makeMaze(N){
    var cells = [], seen = [], path = [0], names = ['up', 'right', 'down', 'left'], i;
    for(i = 0; i < N * N; i++){ cells.push(0); seen.push(false); }
    seen[0] = true;
    while(path.length){
      var cur = path[path.length - 1], cx = cur % N, cy = (cur - cx) / N, options = [];
      for(i = 0; i < 4; i++){
        var d = MAZE_DIRS[names[i]], nx = cx + d.dx, ny = cy + d.dy;
        if(nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx]) options.push(d);
      }
      if(!options.length){ path.pop(); continue; }
      var go = options[rnd(options.length)], next = (cy + go.dy) * N + cx + go.dx;
      cells[cur] |= go.bit;
      cells[next] |= go.opp;
      seen[next] = true;
      path.push(next);
    }
    return cells;
  }
  games.push({
    id: 'maze', name: 'Mê cung', icon: '🧭', desc: 'Tìm đường đi tới đích', cat: 'Arcade', dur: '5p',
    help: 'Vuốt hoặc bấm mũi tên để đi; mỗi lần đi bạn trượt thẳng tới ngã rẽ hoặc tới tường. Tới lá cờ càng ít bước càng tốt.',
    score: { label: 'Số bước', unit: 'bước', better: 'low' },
    mount: function(host){
      var size = host.size(), N = 8;
      var cell = Math.floor(clamp(Math.min(size.w, size.h - 204), 160, 420) / N), side = cell * N;
      var c = makeCanvas(host, side, side, 'Mê cung: vuốt hoặc bấm mũi tên để đi tới lá cờ'), ctx = c.ctx;
      host.root.appendChild(makePad(host, go));
      var cWall = themeColor(host.root, '--muted', '#94A3B8'), cMe = themeColor(host.root, '--warn', '#FBBF24'),
        cTrail = themeColor(host.root, '--brand', '#60A5FA');
      var cells = makeMaze(N), pos = 0, goal = N * N - 1, steps = 0, done = false, trail = {};
      trail[0] = true;

      function go(name){
        var d = MAZE_DIRS[name];
        if(!d || done) return;
        if(!(cells[pos] & d.bit)){ host.sfx('bad'); return; }
        do {
          pos += d.dx + d.dy * N;
          trail[pos] = true;
          steps++;
        } while(pos !== goal && (cells[pos] & d.bit) && !(cells[pos] & d.side));
        host.sfx('tap');
        host.setScore(steps);
        draw();
        if(pos === goal){
          done = true;
          host.end({ score: steps, won: true, message: 'Tới đích!' });
        }
      }
      function draw(){
        var x, y, i;
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, side, side);
        ctx.fillStyle = cTrail;
        ctx.globalAlpha = 0.2;
        for(i = 0; i < N * N; i++) if(trail[i]) ctx.fillRect((i % N) * cell, Math.floor(i / N) * cell, cell, cell);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = cWall;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for(y = 0; y < N; y++) for(x = 0; x < N; x++){
          var b = cells[y * N + x];
          if(!(b & 1)){ ctx.moveTo(x * cell, y * cell); ctx.lineTo((x + 1) * cell, y * cell); }
          if(!(b & 8)){ ctx.moveTo(x * cell, y * cell); ctx.lineTo(x * cell, (y + 1) * cell); }
        }
        ctx.moveTo(side, 0); ctx.lineTo(side, side); ctx.lineTo(0, side);
        ctx.stroke();
        ctx.font = Math.round(cell * 0.56) + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = cWall;
        ctx.fillText('🏁', (goal % N) * cell + cell / 2, Math.floor(goal / N) * cell + cell / 2 + 1);
        ctx.fillStyle = cMe;
        ctx.beginPath();
        ctx.arc((pos % N) * cell + cell / 2, Math.floor(pos / N) * cell + cell / 2, cell * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }

      host.swipe(host.root, go);
      host.setScore(0);
      draw();
      return {};
    }
  });

  // ---------- Đập chuột ----------
  games.push({
    id: 'mole', name: 'Đập chuột', icon: '🔨', desc: 'Chạm thật nhanh trong 30 giây', cat: 'Phản xạ', dur: '1p',
    help: 'Chạm vào ô có chuột trước khi nó chui sang ô khác; chạm hụt không bị trừ điểm. Đồng hồ 30 giây bắt đầu chạy từ cú chạm đầu tiên.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    mount: function(host){
      var grid = el('div', 'g-grid'), holes = [], mice = [], at = -1, score = 0, misses = 0, started = false, over = false, hideTimer = 0, elapsed = 0;
      var still = !host.reducedMotion, width = clamp(host.size().h - 92, 180, 420) + 'px';
      grid.style.setProperty('--cols', '3');
      grid.style.maxWidth = width;
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', '9 lỗ chuột');
      for(var i = 0; i < 9; i++){
        var hole = button('g-tile'), mouse = el('span', '', '🐭');
        hole.setAttribute('data-i', String(i));
        hole.style.overflow = 'hidden';
        mouse.setAttribute('aria-hidden', 'true');
        mouse.style.cssText = 'display:block;line-height:1;pointer-events:none;transform:translateY(110%);opacity:0';
        hole.appendChild(mouse);
        holes.push(hole);
        mice.push(mouse);
        grid.appendChild(hole);
      }
      // Thanh thời gian mảnh dưới lưới: chỉ đổi transform.
      var bar = el('div'), fill = el('div');
      bar.setAttribute('aria-hidden', 'true');
      bar.style.cssText = 'flex:none;width:100%;height:6px;margin:0 auto;border-radius:3px;overflow:hidden;background-color:var(--panel2);max-width:' + width;
      fill.style.cssText = 'width:100%;height:100%;background-color:var(--brand);transform-origin:0 50%';
      bar.appendChild(fill);
      var note = el('p', 'g-note', 'Chạm chú chuột để bắt đầu 30 giây.');
      note.setAttribute('role', 'status');
      host.root.appendChild(grid);
      host.root.appendChild(bar);
      host.root.appendChild(note);
      var clock = countdown(host, 30, statWriter(host), function(){
        over = true;
        host.clearTimeout(hideTimer);
        host.end({ score: score, message: 'Hết giờ!' });
      }, {
        extra: function(){ return [{ label: 'Trượt', value: String(misses) }]; },
        onTick: function(left){
          elapsed = (30 - left) * 1000;
          if(left > 0 && left <= 5){ host.sfx('tick'); fill.style.backgroundColor = 'var(--bad)'; }
        }
      });

      function anim(node, frames, ms, easing){ if(still && node.animate) node.animate(frames, { duration: ms, easing: easing || 'ease-out' }); }
      function paint(k, on){
        var m = mice[k];
        holes[k].classList.toggle('is-on', on);
        holes[k].setAttribute('aria-label', 'Lỗ ' + (k + 1) + (on ? ': có chuột' : ': trống'));
        m.style.transform = on ? 'translateY(0)' : 'translateY(110%)';
        m.style.opacity = on ? '1' : '0';
        anim(m, on ? [{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }]
          : [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(70%)', opacity: 0 }], on ? 120 : 90, on ? 'cubic-bezier(.2,.9,.3,1.3)' : 'ease-in');
      }
      function pop(){
        var next = at < 0 ? rnd(9) : rnd(8);
        if(at >= 0 && next >= at) next++;
        if(at >= 0) paint(at, false);
        at = next;
        paint(at, true);
        host.clearTimeout(hideTimer);
        if(started){
          host.sfx('pop', { vol: 0.5 });
          hideTimer = host.setTimeout(pop, Math.max(520, 950 - score * 12));
        }
      }
      function hit(e, tile){
        if(over) return;
        var p = host.fx.at(tile);
        if(Number(tile.getAttribute('data-i')) !== at){
          // Chạm hụt: có tiếng và ô rung, không trừ điểm; chỉ đếm khi đồng hồ đã chạy.
          host.sfx('miss');
          if(started){ misses++; clock.refresh(); }
          anim(tile, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], 120);
          return;
        }
        if(!started){
          started = true;
          clock.start();
          setText(note, 'Nhanh tay lên!');
        }
        score++;
        host.setScore(score);
        host.sfx('whack', { pitch: Math.random() * 2 - 1 });
        host.haptic('light');
        host.fx.burst(p.x, p.y, { n: 12, colors: ['#FBBF24', '#FFFFFF', '#A78BFA'], speed: 210, life: 420, size: 2.8 });
        host.fx.text(p.x, p.y - 22, '+1', { color: '#FBBF24' });
        anim(tile, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.08,.86)' }, { transform: 'scale(1,1)' }], 90);
        pop();
      }

      for(var k = 0; k < 9; k++) paint(k, false);
      host.tap(grid, hit, '.g-tile');
      host.raf(function(dt){
        if(!started || over) return;
        elapsed = Math.min(30000, elapsed + dt);
        fill.style.transform = 'scaleX(' + (1 - elapsed / 30000).toFixed(4) + ')';
      });
      host.setScore(0);
      pop();
      return {};
    }
  });

  // ---------- Phản xạ nhanh ----------
  games.push({
    id: 'reaction', name: 'Phản xạ nhanh', icon: '⚡', desc: 'Chờ màu xanh rồi bấm', cat: 'Phản xạ', dur: '1p',
    help: 'Chạm nút để bắt đầu, chờ tới khi nút chuyển sang xanh lá và hiện "CHẠM NGAY!" rồi chạm thật nhanh. Chạm sớm thì không tính, bạn được thử lại.',
    score: { label: 'Phản xạ', unit: 'ms', better: 'low' },
    mount: function(host){
      var btn = button('g-big g-fill', 'Chạm để bắt đầu');
      var note = el('p', 'g-note', 'Mỗi ván đo một lần. Số càng nhỏ càng nhanh.');
      note.setAttribute('role', 'status');
      host.root.appendChild(btn);
      host.root.appendChild(note);
      var phase = 'idle', timer = 0, goAt = 0, shownAt = 0, stopFrame = null;

      function paint(color, text){
        btn.style.backgroundImage = color ? 'none' : '';
        btn.style.backgroundColor = color;
        setText(btn, text);
      }
      function stopWatch(){ if(stopFrame){ stopFrame(); stopFrame = null; } }
      function arm(){
        phase = 'wait';
        paint('var(--warn)', 'Chờ màu xanh…');
        setText(note, 'Đừng chạm khi nút còn màu vàng.');
        timer = host.setTimeout(function(){
          phase = 'go';
          paint('var(--good)', 'CHẠM NGAY!');
          goAt = performance.now();
          shownAt = 0;
          // Màu xanh chỉ thật sự lên màn ở khung hình kế tiếp: mốc bắt đầu đo là callback raf đầu tiên
          // sau khi đổi màu, không phải lúc đổi style (sớm hơn tới một khung).
          stopFrame = host.raf(function(){
            if(!shownAt) shownAt = performance.now();
            stopWatch();
          });
        }, 1200 + Math.random() * 2300);
      }
      function early(){
        host.clearTimeout(timer);
        stopWatch();
        phase = 'early';
        host.sfx('bad');
        paint('var(--bad)', 'Sớm quá! Chạm để thử lại');
        setText(note, 'Bạn chạm trước khi nút chuyển xanh — lần này không tính.');
      }
      function press(e){
        if(phase === 'idle' || phase === 'early'){
          host.sfx('tap');
          arm();
        } else if(phase === 'wait'){
          early();
        } else if(phase === 'go'){
          // Mốc chạm = lúc ngón tay chạm (e.timeStamp, cùng gốc với performance.now), không phải lúc code chạy tới đây.
          var now = performance.now(), ts = e && typeof e.timeStamp === 'number' ? e.timeStamp : 0;
          var t = ts > 0 && ts <= now + 1 && ts >= goAt - 50 ? ts : now;
          // Chạm trước khung hình có màu xanh (sự kiện xếp hàng ngay lúc đổi màu) là đoán trước, không phải phản xạ.
          if(!shownAt || t < shownAt){ early(); return; }
          var ms = Math.max(1, Math.round(t - shownAt));
          phase = 'done';
          stopWatch();
          paint('', ms + ' ms');
          host.end({ score: ms, message: ms < 250 ? 'Nhanh như chớp!' : ms < 400 ? 'Khá nhanh!' : 'Đo xong' });
        }
      }
      onPress(host, btn, press);
      return {
        // Bị tạm dừng giữa lúc đang đo thì con số sẽ gồm cả thời gian dừng: huỷ lượt đo đó.
        pause: function(){
          if(phase !== 'wait' && phase !== 'go') return;
          host.clearTimeout(timer);
          stopWatch();
          phase = 'idle';
          paint('', 'Chạm để đo lại');
          setText(note, 'Lượt đo vừa rồi bị gián đoạn nên không tính.');
        }
      };
    }
  });

  // ---------- Bắn mục tiêu ----------
  games.push({
    id: 'target', name: 'Bắn mục tiêu', icon: '🎯', desc: 'Chạm mục tiêu di chuyển', cat: 'Phản xạ', dur: '1p',
    help: 'Chạm trúng bia để ghi điểm; càng nhiều điểm bia đổi chỗ càng nhanh. Chạm hụt không bị trừ điểm nhưng làm giảm độ chính xác. Đồng hồ 30 giây bắt đầu chạy từ lần trúng đầu tiên.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    mount: function(host){
      var SIZE = 68, still = !host.reducedMotion;
      var area = el('div', 'g-fill');
      area.style.position = 'relative';
      area.style.overflow = 'hidden';
      area.style.border = '1px dashed var(--line2)';
      area.style.borderRadius = 'var(--radius-sm)';
      area.style.backgroundColor = BG;
      var bia = button('g-tile is-on', '🎯');
      bia.setAttribute('aria-label', 'Bia');
      bia.style.position = 'absolute';
      bia.style.width = SIZE + 'px';
      bia.style.height = SIZE + 'px';
      bia.style.borderRadius = '50%';
      bia.style.fontSize = '32px';
      // Vòng sáng khi trúng và dấu × khi hụt: mỗi thứ một phần tử dùng lại, không tạo mới mỗi cú chạm.
      var ring = el('div'), cross = el('div', '', '×');
      ring.style.cssText = 'position:absolute;left:0;top:0;width:68px;height:68px;margin:-34px 0 0 -34px;border-radius:50%;border:3px solid #FBBF24;pointer-events:none;opacity:0';
      cross.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;display:grid;place-items:center;font-size:32px;font-weight:800;line-height:1;color:var(--muted);pointer-events:none;opacity:0';
      ring.setAttribute('aria-hidden', 'true');
      cross.setAttribute('aria-hidden', 'true');
      area.appendChild(bia);
      area.appendChild(ring);
      area.appendChild(cross);
      var note = el('p', 'g-note', 'Chạm trúng bia để bắt đầu 30 giây.');
      note.setAttribute('role', 'status');
      host.root.appendChild(area);
      host.root.appendChild(note);
      var score = 0, misses = 0, started = false, over = false, moveTimer = 0;
      var clock = countdown(host, 30, statWriter(host), function(){
        over = true;
        host.clearTimeout(moveTimer);
        host.end({ score: score, message: 'Hết giờ!' });
      }, { extra: function(){ return [{ label: 'Chính xác', value: started ? Math.round(score / (score + misses) * 100) + '%' : '—' }]; } });

      // Khó dần theo điểm: bia đứng 1000ms lúc đầu, mỗi điểm bớt 12ms, tối thiểu 550ms.
      function standMs(){ return Math.max(550, 1000 - score * 12); }
      function move(){
        bia.style.left = rnd(Math.max(1, area.clientWidth - SIZE)) + 'px';
        bia.style.top = rnd(Math.max(1, area.clientHeight - SIZE)) + 'px';
        if(still && bia.animate) bia.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 120, easing: 'cubic-bezier(.2,.9,.3,1.25)' });
        host.clearTimeout(moveTimer);
        if(started) moveTimer = host.setTimeout(move, standMs());
      }
      function mark(node, x, y, frames, ms){
        node.style.left = x + 'px';
        node.style.top = y + 'px';
        if(node.animate) node.animate(still ? frames : [frames[0], frames[frames.length - 1]], { duration: still ? ms : 250, easing: 'ease-out' });
      }
      host.tap(area, function(e){
        if(over) return;
        var r = area.getBoundingClientRect(), root = host.root.getBoundingClientRect();
        // Tâm bia theo vị trí bố cục (offsetLeft/Top), không theo khung đang phóng to dần: chạm đúng chỗ bia vừa
        // hiện trong 120ms đầu vẫn là trúng. click từ bàn phím (detail 0) không có toạ độ chạm: lấy tâm bia.
        var bx = r.left + area.clientLeft + bia.offsetLeft + SIZE / 2, by = r.top + area.clientTop + bia.offsetTop + SIZE / 2;
        var real = e.type === 'pointerdown', px = real ? e.clientX : bx, py = real ? e.clientY : by;
        var dist = Math.hypot(px - bx, py - by);
        if(!(e.target === bia || bia.contains(e.target) || dist <= SIZE / 2)){
          host.sfx('miss');
          if(started){ misses++; clock.refresh(); }
          mark(cross, px - r.left, py - r.top, [{ opacity: 0.9, transform: 'scale(.6)' }, { opacity: 0.6, transform: 'scale(1)', offset: 0.4 }, { opacity: 0, transform: 'scale(1)' }], 450);
          return;
        }
        if(!started){
          started = true;
          clock.start();
          setText(note, 'Bia đổi chỗ nhanh dần — nhanh tay lên!');
        }
        score++;
        host.setScore(score);
        clock.refresh();
        // Hồng tâm (trong 25% bán kính) chỉ là lời khen, không cộng thêm điểm.
        var bull = real && dist <= SIZE / 2 * 0.25;
        host.sfx('hit', { pitch: Math.min(6, score * 0.15) });
        if(bull) host.sfx('perfect');
        host.haptic('light');
        host.fx.burst(px - root.left, py - root.top, { n: 14, colors: ['#FBBF24', '#FB7185', '#FFFFFF'], speed: 230, life: 450, size: 2.8 });
        host.fx.text(px - root.left, py - root.top - 26, bull ? 'Hồng tâm!' : '+1', { color: bull ? '#FBBF24' : '#F8FAFC', size: bull ? 22 : 20 });
        mark(ring, px - r.left, py - r.top, [{ opacity: 0.95, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.6)' }], 360);
        move();
      });
      host.setScore(0);
      move();
      return {};
    }
  });

  // ---------- Chọn màu đúng ----------
  var MATCH_COLORS = [{ name: 'Đỏ', hex: '#FB7185' }, { name: 'Xanh dương', hex: '#60A5FA' }, { name: 'Vàng', hex: '#FBBF24' }, { name: 'Xanh lá', hex: '#34D399' }];
  games.push({
    id: 'colorMatch', name: 'Chọn màu đúng', icon: '🌈', desc: 'Chọn theo màu tô của chữ', cat: 'Phản xạ', dur: '1p',
    help: 'Chữ ghi tên một màu nhưng được tô bằng màu khác. Hãy chọn theo MÀU TÔ của chữ, đừng chọn theo nghĩa của chữ. Đúng +1, sai −1; đồng hồ 30 giây chạy từ lần chọn đầu tiên.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    mount: function(host){
      var ask = el('p', 'g-note', 'Chữ dưới đây đang được tô màu gì?');
      var word = el('div', 'g-big');
      var note = el('p', 'g-note', 'Chọn theo màu tô, không theo nghĩa của chữ.');
      note.setAttribute('role', 'status');
      var rows = [el('div', 'g-row'), el('div', 'g-row')], buttons = [];
      MATCH_COLORS.forEach(function(col, i){
        var b = button('g-btn'), dot = el('span');
        dot.style.cssText = 'flex:none;width:16px;height:16px;border-radius:50%;background-color:' + col.hex;
        dot.setAttribute('aria-hidden', 'true');
        b.appendChild(dot);
        b.appendChild(el('span', '', col.name));
        b.setAttribute('data-i', String(i));
        b.style.minHeight = '64px';
        buttons.push(b);
        rows[i < 2 ? 0 : 1].appendChild(b);
      });
      [ask, word, note, rows[0], rows[1]].forEach(function(n){ host.root.appendChild(n); });
      var ink = -1, score = 0, locked = false;
      var clock = countdown(host, 30, statWriter(host), function(){
        locked = true;
        buttons.forEach(function(b){ b.disabled = true; });
        host.end({ score: score, message: 'Hết giờ!' });
      });

      function next(){
        var prev = ink;
        do { ink = rnd(4); } while(ink === prev);
        var text = (ink + 1 + rnd(3)) % 4;
        word.textContent = MATCH_COLORS[text].name;
        word.style.color = MATCH_COLORS[ink].hex;
      }
      function pick(i){
        if(locked) return;
        clock.start();
        if(i === ink){
          score++;
          host.sfx('good');
          setText(note, 'Đúng! +1');
        } else {
          score = Math.max(0, score - 1);
          host.sfx('bad');
          setText(note, 'Sai: chữ vừa rồi tô màu ' + MATCH_COLORS[ink].name.toLowerCase() + '.');
        }
        host.setScore(score);
        next();
      }
      rows.forEach(function(row){
        host.tap(row, function(e, b){ pick(Number(b.getAttribute('data-i'))); }, '[data-i]');
      });
      host.setScore(0);
      next();
      return {};
    }
  });

  // ---------- Tap Race ----------
  games.push({
    id: 'tapRace', name: 'Tap Race', icon: '👆', desc: 'Chạm thật nhiều trong 10 giây', cat: 'Phản xạ', dur: '1p',
    help: 'Chạm nút lớn càng nhiều lần càng tốt. Đồng hồ 10 giây bắt đầu chạy từ cú chạm đầu tiên.',
    score: { label: 'Số lần', unit: 'lần', better: 'high' },
    mount: function(host){
      var btn = button('g-big g-fill', 'Chạm để bắt đầu');
      var note = el('p', 'g-note', 'Bạn có 10 giây. Dùng nhiều ngón tay cũng được.');
      host.root.appendChild(btn);
      host.root.appendChild(note);
      var taps = 0, over = false;
      var clock = countdown(host, 10, statWriter(host), function(){
        over = true;
        btn.disabled = true;
        host.end({ score: taps, message: 'Hết giờ!' });
      });
      onPress(host, btn, function(){
        if(over) return;
        clock.start();
        taps++;
        if(taps === 1) btn.style.fontSize = '72px';
        btn.textContent = String(taps);
        host.setScore(taps);
        host.sfx('tap');
      });
      host.setScore(0);
      return {};
    }
  });

  // ---------- Thở thư giãn ----------
  var BREATH = [{ name: 'Hít vào', ms: 4000, from: 0.55, to: 1 }, { name: 'Giữ hơi', ms: 4000, from: 1, to: 1 }, { name: 'Thở ra', ms: 6000, from: 1, to: 0.55 }];
  games.push({
    id: 'breath', name: 'Thở thư giãn', icon: '🧘', desc: 'Hít thở chậm theo nhịp', cat: 'Thư giãn', dur: '5p',
    help: 'Thở theo vòng tròn: hít vào 4 giây khi vòng nở ra, giữ hơi 4 giây, thở ra 6 giây khi vòng thu lại. Không tính điểm — đóng game khi bạn thấy đủ.',
    score: null,
    mount: function(host){
      var size = host.size(), D = Math.round(clamp(Math.min(size.w, size.h - 70) * 0.82, 160, 340));
      var wrap = el('div', 'g-fill');
      wrap.style.cssText = 'display:grid;place-items:center';
      var circle = el('div');
      circle.style.cssText = 'grid-area:1/1;width:' + D + 'px;height:' + D + 'px;border-radius:50%;' +
        'background-color:var(--brand);background-image:linear-gradient(135deg,var(--brand),var(--brand2));will-change:transform';
      circle.setAttribute('aria-hidden', 'true');
      var label = el('div');
      label.style.cssText = 'grid-area:1/1;position:relative;display:grid;gap:2px;text-align:center;color:var(--on-brand);font-weight:800';
      label.setAttribute('role', 'status');
      var phaseText = el('div', '', BREATH[0].name), secText = el('div', '', '4');
      phaseText.style.fontSize = '22px';
      secText.style.fontSize = '34px';
      label.appendChild(phaseText);
      label.appendChild(secText);
      wrap.appendChild(circle);
      wrap.appendChild(label);
      var note = el('p', 'g-note', 'Hít bằng mũi, thở ra chậm bằng miệng.');
      host.root.appendChild(wrap);
      host.root.appendChild(note);
      var stat = statWriter(host), CYCLE = 14000, t = 0, total = 0, cycles = 0;

      function advance(ms){
        t += ms;
        total += ms;
        while(t >= CYCLE){ t -= CYCLE; cycles++; }
        var i = 0, start = 0;
        while(i < BREATH.length - 1 && t >= start + BREATH[i].ms){ start += BREATH[i].ms; i++; }
        var p = BREATH[i], k = (t - start) / p.ms, ease = 0.5 - Math.cos(Math.PI * k) / 2;
        circle.style.transform = 'scale(' + (p.from + (p.to - p.from) * ease).toFixed(3) + ')';
        setText(phaseText, p.name);
        setText(secText, String(Math.max(1, Math.ceil((p.ms - (t - start)) / 1000))));
        var secs = Math.floor(total / 1000);
        stat([{ label: 'Chu kỳ', value: String(cycles) }, { label: 'Đã thở', value: Math.floor(secs / 60) + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60) }]);
      }
      // Tiết kiệm pin: không chạy vòng lặp theo khung hình, chỉ 4 nhịp mỗi giây và để CSS nội suy.
      if(host.saver){
        circle.style.transition = 'transform .25s linear';
        host.setInterval(function(){ advance(250); }, 250);
      } else host.raf(advance);
      advance(0);
      return {};
    }
  });

  // ---------- Kéo búa bao ----------
  // Thứ tự: mỗi món thắng món đứng ngay sau nó (búa > kéo > bao > búa).
  var RPS = [{ icon: '✊', name: 'Búa' }, { icon: '✌️', name: 'Kéo' }, { icon: '✋', name: 'Bao' }];
  function duelSide(title){
    var box = el('div');
    box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';
    var cap = el('div', '', title);
    cap.style.cssText = 'font-size:15px;font-weight:700;color:var(--muted)';
    box.appendChild(cap);
    return box;
  }
  games.push({
    id: 'rps', name: 'Kéo búa bao', icon: '✊', desc: 'Đấu may mắn với máy', cat: 'May mắn', dur: '1p',
    help: 'Chọn Búa, Kéo hoặc Bao: búa thắng kéo, kéo thắng bao, bao thắng búa. Thắng +1, thua −1 (không xuống dưới 0), hoà giữ nguyên; một ván 10 lượt.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    mount: function(host){
      var ROUNDS = 10;
      var duel = el('div', 'g-row'), me = duelSide('Bạn'), ai = duelSide('Máy');
      var mePick = el('div', 'g-big', '❔'), aiPick = el('div', 'g-big', '❔');
      me.appendChild(mePick); ai.appendChild(aiPick);
      duel.appendChild(me); duel.appendChild(ai);
      var note = el('p', 'g-note', 'Chọn một món để ra.');
      note.setAttribute('role', 'status');
      var row = el('div', 'g-row');
      RPS.forEach(function(r, i){
        var b = button('g-btn'), icon = el('span', '', r.icon);
        b.style.flexDirection = 'column';
        b.style.gap = '2px';
        b.style.minHeight = '96px';
        icon.style.cssText = 'font-size:36px;line-height:1.15';
        icon.setAttribute('aria-hidden', 'true');
        b.appendChild(icon);
        b.appendChild(el('span', '', r.name));
        b.setAttribute('data-i', String(i));
        row.appendChild(b);
      });
      [duel, note, row].forEach(function(n){ host.root.appendChild(n); });
      var stat = statWriter(host), score = 0, round = 0, win = 0, draw = 0, lose = 0, locked = false;

      function show(){
        stat([{ label: 'Lượt', value: round + '/' + ROUNDS }, { label: 'Thắng–Thua', value: win + '–' + lose }]);
      }
      host.on(row, 'click', function(e){
        var b = e.target.closest('[data-i]');
        if(!b || locked) return;
        var mine = Number(b.getAttribute('data-i')), theirs = rnd(3), text;
        round++;
        mePick.textContent = RPS[mine].icon;
        aiPick.textContent = RPS[theirs].icon;
        if(mine === theirs){ draw++; text = 'Hoà — cả hai cùng ra ' + RPS[mine].name.toLowerCase() + '.'; host.sfx('tap'); }
        else if((mine + 1) % 3 === theirs){ win++; score++; text = 'Bạn thắng: ' + RPS[mine].name.toLowerCase() + ' thắng ' + RPS[theirs].name.toLowerCase() + '. +1'; host.sfx('good'); }
        else { lose++; score = Math.max(0, score - 1); text = 'Máy thắng: ' + RPS[theirs].name.toLowerCase() + ' thắng ' + RPS[mine].name.toLowerCase() + '. −1'; host.sfx('bad'); }
        setText(note, text);
        host.setScore(score);
        show();
        if(round >= ROUNDS){
          locked = true;
          host.setTimeout(function(){
            host.end({ score: score, message: win > lose ? 'Bạn thắng ' + win + '–' + lose : win < lose ? 'Máy thắng ' + lose + '–' + win : 'Hoà ' + win + '–' + lose });
          }, 900);
        }
      });
      host.setScore(0);
      show();
      return {};
    }
  });

  // ---------- Đấu xúc xắc ----------
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function makeDie(px){
    var die = el('div'), pips = [], blank = el('span', '', '?');
    die.style.cssText = 'position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:8%;padding:14%;box-sizing:border-box;' +
      'width:' + px + 'px;height:' + px + 'px;border-radius:18%;background-color:var(--text)';
    die.setAttribute('role', 'img');
    for(var i = 0; i < 9; i++){
      var pip = el('span');
      pip.style.cssText = 'border-radius:50%;background-color:' + INK + ';visibility:hidden';
      pips.push(pip);
      die.appendChild(pip);
    }
    blank.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:' + INK + ';font-size:40px;font-weight:800';
    die.appendChild(blank);
    return {
      node: die,
      set: function(n){
        pips.forEach(function(p, k){ p.style.visibility = n && PIPS[n].indexOf(k) !== -1 ? 'visible' : 'hidden'; });
        blank.style.visibility = n ? 'hidden' : 'visible';
        die.setAttribute('aria-label', n ? 'Xúc xắc ra ' + n : 'Xúc xắc chưa gieo');
      }
    };
  }
  games.push({
    id: 'diceDuel', name: 'Đấu xúc xắc', icon: '🎲', desc: 'Đổ xúc xắc thắng máy', cat: 'May mắn', dur: '1p',
    help: 'Bấm "Gieo xúc xắc": bạn và máy mỗi bên gieo một viên, ai ra số lớn hơn thì thắng lượt đó. Một ván 10 lượt, điểm là số lượt bạn thắng.',
    score: { label: 'Lượt thắng', unit: '', better: 'high' },
    mount: function(host){
      var ROUNDS = 10;
      var duel = el('div', 'g-row'), me = duelSide('Bạn'), ai = duelSide('Máy');
      var myDie = makeDie(88), aiDie = makeDie(88);
      myDie.set(0); aiDie.set(0);
      me.appendChild(myDie.node); ai.appendChild(aiDie.node);
      duel.appendChild(me); duel.appendChild(ai);
      var note = el('p', 'g-note', 'Gieo 10 lượt, ai thắng nhiều lượt hơn thì thắng ván.');
      note.setAttribute('role', 'status');
      var rollBtn = button('g-big', 'Gieo xúc xắc');
      [duel, note, rollBtn].forEach(function(n){ host.root.appendChild(n); });
      var stat = statWriter(host), round = 0, win = 0, lose = 0, tie = 0, busy = false, done = false;

      function show(){
        stat([{ label: 'Lượt', value: round + '/' + ROUNDS }, { label: 'Máy thắng', value: String(lose) }, { label: 'Hoà', value: String(tie) }]);
      }
      function settle(){
        var a = 1 + rnd(6), b = 1 + rnd(6);
        myDie.set(a); aiDie.set(b);
        round++;
        if(a > b){ win++; host.setScore(win); host.sfx('good'); setText(note, 'Bạn ' + a + ' – Máy ' + b + ': bạn thắng lượt này.'); }
        else if(a < b){ lose++; host.sfx('bad'); setText(note, 'Bạn ' + a + ' – Máy ' + b + ': máy thắng lượt này.'); }
        else { tie++; host.sfx('tap'); setText(note, 'Cả hai cùng ra ' + a + ': hoà.'); }
        show();
        busy = false;
        if(round >= ROUNDS){
          done = true;
          rollBtn.disabled = true;
          host.setTimeout(function(){
            host.end({ score: win, won: win > lose ? true : win < lose ? false : undefined,
              message: win > lose ? 'Bạn thắng ' + win + '–' + lose : win < lose ? 'Máy thắng ' + lose + '–' + win : 'Hoà ' + win + '–' + lose });
          }, 900);
        }
      }
      host.on(rollBtn, 'click', function(){
        if(busy || done) return;
        busy = true;
        host.sfx('tap');
        // Tiết kiệm pin: bỏ đoạn xúc xắc lăn, ra kết quả ngay.
        var spins = host.saver ? 0 : 5;
        if(!spins){ settle(); return; }
        var id = host.setInterval(function(){
          if(spins-- > 0){ myDie.set(1 + rnd(6)); aiDie.set(1 + rnd(6)); return; }
          host.clearInterval(id);
          settle();
        }, 70);
      });
      host.setScore(0);
      show();
      return {};
    }
  });

  // ---------- Tung đồng xu ----------
  var COIN = ['Sấp', 'Ngửa'];
  games.push({
    id: 'coinFlip', name: 'Tung đồng xu', icon: '🪙', desc: 'Đoán liên tiếp sấp hay ngửa', cat: 'May mắn', dur: '1p',
    help: 'Đoán đồng xu ra Sấp hay Ngửa trước khi tung. Đoán đúng thì chuỗi dài thêm 1 và được đoán tiếp; đoán sai là hết ván.',
    score: { label: 'Chuỗi đúng', unit: 'lần', better: 'high' },
    mount: function(host){
      var coin = el('div', '', '?');
      coin.style.cssText = 'flex:none;display:grid;place-items:center;width:150px;height:150px;margin:0 auto;border-radius:50%;' +
        'border:6px solid rgba(11,16,32,.25);background-color:var(--warn);color:' + INK + ';font-size:30px;font-weight:800';
      coin.setAttribute('role', 'status');
      var note = el('p', 'g-note', 'Bạn đoán đồng xu sẽ ra mặt nào?');
      var row = el('div', 'g-row');
      COIN.forEach(function(name, i){
        var b = button('g-btn primary', 'Đoán ' + name);
        b.style.minHeight = '72px';
        b.setAttribute('data-i', String(i));
        row.appendChild(b);
      });
      [coin, note, row].forEach(function(n){ host.root.appendChild(n); });
      var streak = 0, busy = false, over = false;

      function settle(guess){
        var side = rnd(2);
        coin.textContent = COIN[side];
        busy = false;
        if(side === guess){
          streak++;
          host.setScore(streak);
          host.sfx('good');
          setText(note, 'Ra ' + COIN[side] + ' — đúng rồi! Đoán tiếp nào.');
          return;
        }
        over = true;
        host.sfx('bad');
        setText(note, 'Ra ' + COIN[side] + ' — bạn đoán ' + COIN[guess] + '.');
        host.setTimeout(function(){
          host.end({ score: streak, message: streak > 0 ? 'Chuỗi dừng ở ' + streak : 'Đoán sai ngay lần đầu' });
        }, 800);
      }
      host.on(row, 'click', function(e){
        var b = e.target.closest('[data-i]');
        if(!b || busy || over) return;
        var guess = Number(b.getAttribute('data-i'));
        busy = true;
        host.sfx('tap');
        setText(note, 'Bạn đoán ' + COIN[guess] + '…');
        var spins = host.saver ? 0 : 5;
        if(!spins){ settle(guess); return; }
        var id = host.setInterval(function(){
          if(spins-- > 0){ coin.textContent = COIN[spins % 2]; return; }
          host.clearInterval(id);
          settle(guess);
        }, 80);
      });
      host.setScore(0);
      return {};
    }
  });
})();
