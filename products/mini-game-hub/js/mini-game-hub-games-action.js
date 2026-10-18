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
    onPress(host, pad, function(e){
      var b = e.target.closest('[data-dir]');
      if(b) cb(b.getAttribute('data-dir'));
    });
    return pad;
  }
  // Đồng hồ đếm lùi theo giây; chỉ chạy sau khi gọi start() (cú chạm đầu tiên của người chơi).
  function countdown(host, secs, stat, onDone){
    var left = secs, id = 0;
    function show(){ stat([{ label: 'Còn', value: left + ' giây' }]); }
    show();
    return {
      start: function(){
        if(id) return;
        id = host.setInterval(function(){
          left--;
          show();
          if(left <= 0){ host.clearInterval(id); onDone(); }
        }, 1000);
      }
    };
  }

  // ---------- Flappy (canvas, game mẫu) ----------
  games.push({
    id: 'flappy', name: 'Flappy mini', icon: '🐦', desc: 'Bay qua khe giữa các cột', cat: 'Arcade', dur: '1p',
    help: 'Chạm vào màn hình để chim vỗ cánh bay lên, thả tay thì chim rơi. Lách qua khe giữa các cột; chạm cột hoặc rơi xuống đất là hết ván.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size();
      var W = Math.max(240, Math.min(size.w, 460)), H = Math.max(280, Math.min(size.h, Math.round(W * 1.6)));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cv = document.createElement('canvas');
      cv.className = 'g-canvas';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.tabIndex = 0;
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'Sân chơi Flappy: chạm hoặc bấm phím cách để bay lên');
      host.root.appendChild(cv);
      var ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);

      var cPipe = themeColor(host.root, '--good', '#34D399'), cBird = themeColor(host.root, '--warn', '#FBBF24'),
        cText = themeColor(host.root, '--text', '#F8FAFC'), cLine = themeColor(host.root, '--panel3', '#24304F');
      var GRAVITY = 1500, FLAP = -430, SPEED = 150, PIPE_W = 54;
      var GAP = Math.max(130, Math.round(H * 0.27)), SPACING = Math.max(190, Math.round(W * 0.56)), GROUND = H - 18;
      var bird = { x: Math.round(W * 0.28), y: H * 0.45, v: 0, r: 13 };
      var pipes = [], score = 0, started = false, over = false, clock = 0;

      function flap(){
        if(over) return;
        started = true;
        bird.v = FLAP;
        host.sfx('tap');
      }
      function die(){
        over = true;
        host.sfx('bad');
        draw();
        host.end({ score: score, message: score > 0 ? 'Hết ván' : 'Chưa qua cột nào' });
      }
      function step(s){
        clock += s;
        if(!started){ bird.y = H * 0.45 + Math.sin(clock * 4) * 6; return; }
        bird.v += GRAVITY * s;
        bird.y += bird.v * s;
        if(bird.y - bird.r < 0){ bird.y = bird.r; bird.v = 0; }
        var last = pipes[pipes.length - 1];
        if(!last || last.x < W - SPACING){
          var margin = 36 + GAP / 2;
          pipes.push({ x: last ? W : W + 40, gapY: margin + Math.random() * (GROUND - 2 * margin), passed: false });
        }
        for(var i = 0; i < pipes.length; i++){
          var p = pipes[i];
          p.x -= SPEED * s;
          if(!p.passed && p.x + PIPE_W < bird.x - bird.r){
            p.passed = true;
            score++;
            host.setScore(score);
            host.sfx('good');
          }
          if(bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W &&
             (bird.y - bird.r < p.gapY - GAP / 2 || bird.y + bird.r > p.gapY + GAP / 2)){ die(); return; }
        }
        if(pipes.length && pipes[0].x < -PIPE_W) pipes.shift();
        if(bird.y + bird.r > GROUND){ bird.y = GROUND - bird.r; die(); }
      }
      function draw(){
        ctx.fillStyle = '#0B1220';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = cPipe;
        pipes.forEach(function(p){
          ctx.fillRect(p.x, 0, PIPE_W, p.gapY - GAP / 2);
          ctx.fillRect(p.x, p.gapY + GAP / 2, PIPE_W, GROUND - (p.gapY + GAP / 2));
          ctx.fillRect(p.x - 4, p.gapY - GAP / 2 - 14, PIPE_W + 8, 14);
          ctx.fillRect(p.x - 4, p.gapY + GAP / 2, PIPE_W + 8, 14);
        });
        ctx.fillStyle = cLine;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = cBird;
        ctx.beginPath();
        ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0B1020';
        ctx.beginPath();
        ctx.arc(bird.x + 5, bird.y - 4, 2.6, 0, Math.PI * 2);
        ctx.fill();
        if(!started){
          ctx.fillStyle = cText;
          ctx.font = '700 20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Chạm để bay', W / 2, H * 0.3);
        }
      }

      host.on(cv, 'pointerdown', function(e){ e.preventDefault(); flap(); });
      host.on(cv, 'keydown', function(e){
        if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp'){ e.preventDefault(); flap(); }
      });
      host.setScore(0);
      host.raf(function(dt){
        if(over) return;
        step(dt / 1000);
        if(!over) draw();
      });
      draw();
      // Vỏ tự đứng raf khi tạm dừng và tự gỡ mọi thứ khi huỷ: game này không cần làm gì thêm.
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
      var snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }], dir = SNAKE_DIRS.right, queue = [];
      var apple = null, score = 0, started = false, over = false, loop = 0;

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
        if(!started){ started = true; draw(); }
      }
      function tickMs(){ return Math.max(85, 150 - Math.floor(score / 4) * 8); }
      function restartLoop(){
        host.clearInterval(loop);
        loop = host.setInterval(tick, tickMs());
      }
      function tick(){
        if(!started || over) return;
        if(queue.length) dir = queue.shift();
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        var eat = head.x === apple.x && head.y === apple.y;
        // Không ăn thì đuôi rời đi trong chính bước này, nên ô đuôi không tính là va chạm.
        var body = eat ? snake : snake.slice(0, -1);
        var wall = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N;
        if(wall || body.some(function(p){ return p.x === head.x && p.y === head.y; })){
          over = true;
          host.sfx('bad');
          host.end({ score: score, message: wall ? 'Đâm vào tường' : 'Cắn vào thân' });
          return;
        }
        snake.unshift(head);
        if(eat){
          score++;
          host.setScore(score);
          host.sfx('good');
          stat([{ label: 'Dài', value: String(snake.length) }]);
          if(!placeApple()){
            over = true;
            draw();
            host.end({ score: score, won: true, message: 'Rắn đã kín sân!' });
            return;
          }
          if(score % 4 === 0) restartLoop();
        } else snake.pop();
        draw();
      }
      function draw(){
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, side, side);
        ctx.fillStyle = cGrid;
        for(var y = 0; y < N; y++) for(var x = (y % 2); x < N; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);
        if(apple){
          ctx.fillStyle = cApple;
          ctx.beginPath();
          ctx.arc(apple.x * cell + cell / 2, apple.y * cell + cell / 2, cell * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = cBody;
        for(var i = snake.length - 1; i >= 0; i--){
          var p = snake[i], inset = i === 0 ? 1 : 2;
          ctx.globalAlpha = i === 0 ? 1 : 0.8;
          ctx.fillRect(p.x * cell + inset, p.y * cell + inset, cell - inset * 2, cell - inset * 2);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(snake[0].x * cell + cell / 2 + dir.x * cell * 0.2, snake[0].y * cell + cell / 2 + dir.y * cell * 0.2, Math.max(2, cell * 0.12), 0, Math.PI * 2);
        ctx.fill();
        if(!started) canvasHint(ctx, 'Vuốt hoặc bấm mũi tên', side / 2, side * 0.3, cText);
      }

      host.swipe(host.root, turn);
      cv.setAttribute('data-dir', dir.name);
      placeApple();
      host.setScore(0);
      stat([{ label: 'Dài', value: String(snake.length) }]);
      restartLoop();
      draw();
      return {};
    }
  });

  // ---------- Pong ----------
  games.push({
    id: 'pong', name: 'Pong mini', icon: '🏓', desc: 'Giữ bóng không rơi', cat: 'Arcade', dur: '5p',
    help: 'Đặt ngón tay lên sân rồi kéo ngang để di chuyển thanh đỡ. Mỗi lần đỡ được bóng là 1 điểm và bóng bay nhanh hơn; để bóng rơi là hết ván.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size();
      var W = clamp(size.w, 240, 440), H = clamp(Math.round(W * 1.55), 300, Math.max(300, size.h));
      var c = makeCanvas(host, W, H, 'Sân Pong: kéo ngang để di chuyển thanh đỡ'), cv = c.cv, ctx = c.ctx;
      var stat = statWriter(host);
      var cPad = themeColor(host.root, '--brand', '#60A5FA'), cBall = themeColor(host.root, '--warn', '#FBBF24'),
        cText = themeColor(host.root, '--text', '#F8FAFC'), cLine = themeColor(host.root, '--panel3', '#24304F');
      // Thanh đỡ nằm cao hơn đáy sân để ngón tay kéo ở phía dưới không che mất nó.
      var R = 8, PAD_W = Math.max(72, Math.round(W * 0.25)), PAD_H = 12, PAD_Y = H - 72;
      var SPEED0 = Math.round(H * 0.5), SPEED_MAX = SPEED0 * 2.2;
      var padX = W / 2, ball = { x: W / 2, y: H * 0.3, vx: 0, vy: 0 }, speed = SPEED0;
      var score = 0, started = false, over = false, left = 0;

      function showSpeed(){
        stat([{ label: 'Tốc độ', value: (speed / SPEED0).toFixed(1).replace('.', ',') + '×' }]);
      }
      function movePad(clientX){ padX = clamp(clientX - left, PAD_W / 2, W - PAD_W / 2); }
      function launch(){
        var a = (0.25 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1);
        ball.vx = speed * Math.sin(a);
        ball.vy = speed * Math.cos(a);
        started = true;
        host.sfx('tap');
      }
      function step(s){
        if(!started) return;
        var prevY = ball.y;
        ball.x += ball.vx * s;
        ball.y += ball.vy * s;
        if(ball.x < R){ ball.x = R; ball.vx = Math.abs(ball.vx); }
        if(ball.x > W - R){ ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
        if(ball.y < R){ ball.y = R; ball.vy = Math.abs(ball.vy); }
        if(ball.vy > 0 && prevY + R <= PAD_Y && ball.y + R >= PAD_Y && Math.abs(ball.x - padX) <= PAD_W / 2 + R){
          score++;
          speed = Math.min(SPEED_MAX, speed * 1.045);
          // Chạm càng xa tâm thanh đỡ, bóng bật càng xiên.
          var a = clamp((ball.x - padX) / (PAD_W / 2), -1, 1) * 1.05;
          ball.vx = speed * Math.sin(a);
          ball.vy = -speed * Math.cos(a);
          ball.y = PAD_Y - R;
          host.setScore(score);
          host.sfx('good');
          showSpeed();
        }
        if(ball.y - R > H){
          over = true;
          host.sfx('bad');
          host.end({ score: score, message: score > 0 ? 'Bóng rơi rồi' : 'Chưa đỡ được quả nào' });
        }
      }
      function draw(){
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = cLine;
        ctx.fillRect(0, PAD_Y + PAD_H + 10, W, 2);
        ctx.fillStyle = cPad;
        ctx.fillRect(padX - PAD_W / 2, PAD_Y, PAD_W, PAD_H);
        ctx.fillStyle = cBall;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2);
        ctx.fill();
        if(!started) canvasHint(ctx, 'Chạm để phát bóng', W / 2, H * 0.5, cText);
        else if(score === 0) canvasHint(ctx, 'Kéo ngang để đỡ bóng', W / 2, H - 28, cLine);
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
      host.raf(function(dt){
        if(over) return;
        step(dt / 1000);
        if(!over) draw();
      });
      draw();
      return {};
    }
  });

  // ---------- Runner ----------
  games.push({
    id: 'runner', name: 'Runner', icon: '🏃', desc: 'Nhảy qua vật cản', cat: 'Arcade', dur: '1p',
    help: 'Chạm nút Nhảy (hoặc chạm vào sân) để nhảy qua vật cản. Càng chạy càng nhanh; đụng vật cản là hết ván.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    realtime: true,
    mount: function(host){
      var size = host.size();
      var W = clamp(size.w, 240, 460), H = clamp(Math.round(W * 0.72), 220, Math.max(220, size.h - 144));
      var c = makeCanvas(host, W, H, 'Đường chạy: chạm để nhảy qua vật cản'), cv = c.cv, ctx = c.ctx;
      var jumpBtn = button('g-big', 'Nhảy');
      host.root.appendChild(jumpBtn);
      var cMe = themeColor(host.root, '--brand', '#60A5FA'), cObs = themeColor(host.root, '--bad', '#FB7185'),
        cText = themeColor(host.root, '--text', '#F8FAFC'), cLine = themeColor(host.root, '--panel3', '#24304F');
      var GROUND = H - 36, GRAVITY = 2400, JUMP = -760, ME_X = Math.round(W * 0.16), ME_W = 26, ME_H = 34;
      var y = GROUND, vy = 0, speed = 230, obs = [], score = 0, started = false, over = false, wantJump = 0, dist = 0;

      function jump(){
        if(over) return;
        started = true;
        // Bấm hơi sớm trước khi chạm đất vẫn được tính (nhớ 0,12 giây).
        wantJump = 0.12;
      }
      function step(s){
        if(!started) return;
        speed = Math.min(520, speed + 6 * s);
        dist += speed * s;
        if(wantJump > 0){
          if(y >= GROUND){ vy = JUMP; wantJump = 0; host.sfx('tap'); }
          else wantJump -= s;
        }
        vy += GRAVITY * s;
        y += vy * s;
        if(y > GROUND){ y = GROUND; vy = 0; }
        var last = obs[obs.length - 1];
        if(!last || last.x < W - last.gap){
          obs.push({ x: W + 20, w: 18 + rnd(13), h: 28 + rnd(27), gap: speed * (0.9 + Math.random() * 0.75), passed: false });
        }
        for(var i = 0; i < obs.length; i++){
          var o = obs[i];
          o.x -= speed * s;
          if(!o.passed && o.x + o.w < ME_X){
            o.passed = true;
            score++;
            host.setScore(score);
            host.sfx('good');
          }
          if(ME_X + ME_W - 4 > o.x && ME_X + 4 < o.x + o.w && y > GROUND - o.h + 4){
            over = true;
            host.sfx('bad');
            draw();
            host.end({ score: score, message: score > 0 ? 'Vấp vật cản' : 'Chưa qua vật cản nào' });
            return;
          }
        }
        if(obs.length && obs[0].x < -40) obs.shift();
      }
      function draw(){
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = cLine;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = BG;
        for(var gx = -(dist % 46); gx < W; gx += 46) ctx.fillRect(gx, GROUND + 12, 22, 3);
        ctx.fillStyle = cObs;
        obs.forEach(function(o){ ctx.fillRect(o.x, GROUND - o.h, o.w, o.h); });
        ctx.fillStyle = cMe;
        ctx.fillRect(ME_X, y - ME_H, ME_W, ME_H);
        ctx.fillStyle = INK;
        ctx.fillRect(ME_X + ME_W - 9, y - ME_H + 8, 5, 5);
        if(!started) canvasHint(ctx, 'Chạm để chạy', W / 2, H * 0.36, cText);
      }

      onPress(host, jumpBtn, jump);
      host.on(cv, 'pointerdown', function(e){ e.preventDefault(); jump(); });
      host.on(cv, 'keydown', function(e){
        if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp'){ e.preventDefault(); jump(); }
      });
      host.setScore(0);
      host.raf(function(dt){
        if(over) return;
        step(dt / 1000);
        if(!over) draw();
      });
      draw();
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
      var stack = [{ x: (W - baseW) / 2, w: baseW }], level = 0, cam = 0, over = false, mv = null;

      function camTarget(){ return Math.max(0, stack.length - VIS) * BH; }
      function yOf(i, shift){ return H - FLOOR - (i + 1) * BH + shift; }
      function spawn(){
        var top = stack[stack.length - 1], fromLeft = level % 2 === 0;
        mv = { x: fromLeft ? 0 : W - top.w, w: top.w, dir: fromLeft ? 1 : -1, speed: Math.min(W * 1.1, W * 0.42 + level * W * 0.022) };
        cv.setAttribute('data-state', JSON.stringify({ level: level, y: Math.round(yOf(stack.length, camTarget())), h: BH, canvasH: H,
          x: Math.round(mv.x), topX: Math.round(top.x), speed: Math.round(mv.speed) }));
      }
      function drop(){
        if(over) return;
        var top = stack[stack.length - 1];
        var left = Math.max(top.x, mv.x), overlap = Math.min(top.x + top.w, mv.x + mv.w) - left;
        if(overlap < 4){
          over = true;
          host.sfx('bad');
          host.end({ score: level, message: level > 0 ? 'Tháp cao ' + level + ' tầng' : 'Thả trượt mất rồi' });
          return;
        }
        var perfect = Math.abs(mv.x - top.x) <= SNAP;
        if(perfect){ left = top.x; overlap = top.w; }
        stack.push({ x: left, w: overlap });
        level++;
        host.setScore(level);
        host.sfx(perfect ? 'good' : 'tap');
        spawn();
      }
      function step(s){
        mv.x += mv.dir * mv.speed * s;
        if(mv.x < 0){ mv.x = 0; mv.dir = 1; }
        if(mv.x > W - mv.w){ mv.x = W - mv.w; mv.dir = -1; }
        cam += (camTarget() - cam) * Math.min(1, s * 8);
      }
      function draw(){
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = cLine;
        ctx.fillRect(0, H - FLOOR + cam, W, FLOOR);
        for(var i = 0; i < stack.length; i++){
          var yy = yOf(i, cam);
          if(yy > H) continue;
          ctx.fillStyle = i % 2 ? cB : cA;
          ctx.fillRect(stack[i].x, yy, stack[i].w, BH - 2);
        }
        ctx.fillStyle = cMove;
        ctx.fillRect(mv.x, yOf(stack.length, cam), mv.w, BH - 2);
        if(level === 0) canvasHint(ctx, 'Chạm để thả khối', W / 2, 56, cText);
      }

      onPress(host, dropBtn, drop);
      host.on(cv, 'pointerdown', function(e){ e.preventDefault(); drop(); });
      host.on(cv, 'keydown', function(e){
        if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); drop(); }
      });
      host.setScore(0);
      spawn();
      host.raf(function(dt){
        if(over) return;
        step(dt / 1000);
        draw();
      });
      draw();
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
    help: 'Chạm vào ô có chuột trước khi nó chui sang ô khác. Đồng hồ 30 giây bắt đầu chạy từ cú chạm đầu tiên.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    mount: function(host){
      var grid = el('div', 'g-grid'), holes = [], at = -1, score = 0, started = false, over = false, hideTimer = 0;
      grid.style.setProperty('--cols', '3');
      grid.style.maxWidth = clamp(host.size().h - 70, 180, 420) + 'px';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', '9 lỗ chuột');
      for(var i = 0; i < 9; i++){
        var hole = button('g-tile');
        hole.setAttribute('data-i', String(i));
        holes.push(hole);
        grid.appendChild(hole);
      }
      var note = el('p', 'g-note', 'Chạm chú chuột để bắt đầu 30 giây.');
      note.setAttribute('role', 'status');
      host.root.appendChild(grid);
      host.root.appendChild(note);
      var clock = countdown(host, 30, statWriter(host), function(){
        over = true;
        host.clearTimeout(hideTimer);
        host.end({ score: score, message: 'Hết giờ!' });
      });

      function paint(k, on){
        holes[k].textContent = on ? '🐭' : '';
        holes[k].classList.toggle('is-on', on);
        holes[k].setAttribute('aria-label', 'Lỗ ' + (k + 1) + (on ? ': có chuột' : ': trống'));
      }
      function pop(){
        var next = at < 0 ? rnd(9) : rnd(8);
        if(at >= 0 && next >= at) next++;
        if(at >= 0) paint(at, false);
        at = next;
        paint(at, true);
        host.clearTimeout(hideTimer);
        if(started) hideTimer = host.setTimeout(pop, Math.max(520, 950 - score * 12));
      }
      function hit(e){
        var tile = e.target.closest('.g-tile');
        if(!tile || over) return;
        if(Number(tile.getAttribute('data-i')) !== at) return;
        if(!started){
          started = true;
          clock.start();
          setText(note, 'Nhanh tay lên!');
        }
        score++;
        host.setScore(score);
        host.sfx('good');
        pop();
      }

      for(var k = 0; k < 9; k++) paint(k, false);
      onPress(host, grid, hit);
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
      var phase = 'idle', timer = 0, shownAt = 0;

      function paint(color, text){
        btn.style.backgroundImage = color ? 'none' : '';
        btn.style.backgroundColor = color;
        setText(btn, text);
      }
      function arm(){
        phase = 'wait';
        paint('var(--warn)', 'Chờ màu xanh…');
        setText(note, 'Đừng chạm khi nút còn màu vàng.');
        timer = host.setTimeout(function(){
          phase = 'go';
          shownAt = performance.now();
          paint('var(--good)', 'CHẠM NGAY!');
        }, 1200 + Math.random() * 2300);
      }
      function press(){
        if(phase === 'idle' || phase === 'early'){
          host.sfx('tap');
          arm();
        } else if(phase === 'wait'){
          host.clearTimeout(timer);
          phase = 'early';
          host.sfx('bad');
          paint('var(--bad)', 'Sớm quá! Chạm để thử lại');
          setText(note, 'Bạn chạm trước khi nút chuyển xanh — lần này không tính.');
        } else if(phase === 'go'){
          var ms = Math.max(1, Math.round(performance.now() - shownAt));
          phase = 'done';
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
    help: 'Chạm trúng bia để ghi điểm; bia tự đổi chỗ mỗi giây. Đồng hồ 30 giây bắt đầu chạy từ lần trúng đầu tiên.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    mount: function(host){
      var SIZE = 68;
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
      area.appendChild(bia);
      var note = el('p', 'g-note', 'Chạm trúng bia để bắt đầu 30 giây.');
      note.setAttribute('role', 'status');
      host.root.appendChild(area);
      host.root.appendChild(note);
      var score = 0, started = false, over = false, moveTimer = 0;
      var clock = countdown(host, 30, statWriter(host), function(){
        over = true;
        host.clearTimeout(moveTimer);
        host.end({ score: score, message: 'Hết giờ!' });
      });

      function move(){
        bia.style.left = rnd(Math.max(1, area.clientWidth - SIZE)) + 'px';
        bia.style.top = rnd(Math.max(1, area.clientHeight - SIZE)) + 'px';
        host.clearTimeout(moveTimer);
        if(started) moveTimer = host.setTimeout(move, 1000);
      }
      onPress(host, bia, function(){
        if(over) return;
        if(!started){
          started = true;
          clock.start();
          setText(note, 'Bia đổi chỗ mỗi giây — nhanh tay lên!');
        }
        score++;
        host.setScore(score);
        host.sfx('good');
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
        host.on(row, 'click', function(e){
          var b = e.target.closest('[data-i]');
          if(b) pick(Number(b.getAttribute('data-i')));
        });
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
