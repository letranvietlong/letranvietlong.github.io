// Game trí tuệ + IDLE của GameHub (15 id): tictactoe, memory, math, g2048, guessNumber, wordScramble,
// blackjack, simon, mines, slider, idleMine, idleFarm, idleCafe, idleSpace, idleDragon.
// Mỗi game là một định nghĩa đẩy vào window.GameHubGames và CHỈ nói chuyện với vỏ qua `host`.
// Hợp đồng + những điều cấm: products/mini-game-hub/docs/mini-game-hub.md
(function(){
  'use strict';
  var games = window.GameHubGames = window.GameHubGames || [];

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text !== undefined) n.textContent = text;
    return n;
  }
  // Chỉ ghi khi chữ đổi: không dựng lại DOM theo timer.
  function setText(node, text){
    if(node.textContent !== text) node.textContent = text;
  }
  function button(cls, text){
    var b = el('button', cls, text);
    b.type = 'button';
    return b;
  }
  function randInt(n, rnd){ return Math.floor((rnd || Math.random)() * n); }
  function shuffle(arr, rnd){
    for(var i = arr.length - 1; i > 0; i--){
      var j = randInt(i + 1, rnd), t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  // Bề rộng lưới ô vuông (cols × rows) sao cho vừa cả chiều ngang lẫn phần chiều cao còn lại sau `reserve` px.
  function fit(host, cols, rows, reserve){
    var s = host.size();
    return Math.max(cols * 44 + (cols - 1) * 8, Math.floor(Math.min(420, s.w, (s.h - reserve) * cols / rows)));
  }
  function shake(node){
    if(typeof node.animate !== 'function' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    node.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }], { duration: 220 });
  }
  // Game better:'low' đếm thẳng vào ô điểm: vỏ chỉ ghi kỷ lục loại này khi end() với won !== false,
  // không ghi số đang đếm dở lúc đóng giữa ván.
  function countStats(host, n, rest){
    host.setScore(n);
    host.setStats(rest);
  }

  // ---------- Cờ caro 3x3 (lưới DOM, game mẫu) ----------
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  games.push({
    id: 'tictactoe', name: 'Cờ caro 3x3', icon: '⭕', desc: 'Đấu với máy đơn giản', cat: 'Trí tuệ', dur: '5p',
    help: 'Bạn là X và đi trước, máy là O. Ai xếp được 3 ô thẳng hàng (ngang, dọc hoặc chéo) trước thì thắng.',
    score: null,
    mount: function(host){
      var board = ['', '', '', '', '', '', '', '', ''], busy = false, done = false, cells = [];
      var grid = el('div', 'g-grid');
      grid.style.setProperty('--cols', '3');
      grid.style.maxWidth = Math.max(180, Math.min(420, host.size().h - 110)) + 'px';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'Bàn cờ 3 nhân 3');
      for(var i = 0; i < 9; i++){
        var c = el('button', 'g-tile');
        c.type = 'button';
        c.setAttribute('data-i', String(i));
        cells.push(c);
        grid.appendChild(c);
      }
      var note = el('p', 'g-note', 'Lượt của bạn — chọn một ô.');
      note.setAttribute('role', 'status');
      host.root.appendChild(grid);
      host.root.appendChild(note);
      host.setStats([{ label: 'Bạn', value: 'X' }, { label: 'Máy', value: 'O' }]);

      function paint(){
        cells.forEach(function(cell, k){
          setText(cell, board[k]);
          cell.setAttribute('aria-label', 'Ô ' + (k + 1) + ': ' + (board[k] || 'trống'));
        });
      }
      function winner(){
        for(var k = 0; k < LINES.length; k++){
          var l = LINES[k];
          if(board[l[0]] && board[l[0]] === board[l[1]] && board[l[1]] === board[l[2]]) return { who: board[l[0]], line: l };
        }
        return null;
      }
      function empties(){
        var out = [];
        board.forEach(function(v, k){ if(!v) out.push(k); });
        return out;
      }
      // Máy "đơn giản": thắng nếu thắng được ngay, chặn nếu sắp thua, còn lại đi ngẫu nhiên.
      function aiMove(){
        var free = empties(), marks = ['O', 'X'], m, k;
        for(m = 0; m < 2; m++) for(k = 0; k < free.length; k++){
          board[free[k]] = marks[m];
          var hit = winner();
          board[free[k]] = '';
          if(hit) return free[k];
        }
        return free[Math.floor(Math.random() * free.length)];
      }
      function finish(){
        var w = winner();
        if(!w && empties().length) return false;
        done = true;
        if(w) w.line.forEach(function(k){ cells[k].classList.add(w.who === 'X' ? 'is-good' : 'is-bad'); });
        setText(note, w ? (w.who === 'X' ? 'Bạn thắng!' : 'Máy thắng.') : 'Hoà!');
        host.setTimeout(function(){
          if(w) host.end({ won: w.who === 'X', message: w.who === 'X' ? 'Bạn thắng!' : 'Máy thắng' });
          else host.end({ message: 'Hoà!' });
        }, 700);
        return true;
      }
      host.on(grid, 'click', function(e){
        var cell = e.target.closest('.g-tile');
        if(!cell || busy || done) return;
        var k = Number(cell.getAttribute('data-i'));
        if(board[k]) return;
        board[k] = 'X';
        host.sfx('tap');
        paint();
        if(finish()) return;
        busy = true;
        setText(note, 'Máy đang nghĩ…');
        host.setTimeout(function(){
          board[aiMove()] = 'O';
          busy = false;
          paint();
          if(!finish()) setText(note, 'Lượt của bạn.');
        }, 350);
      });
      paint();
      return { pause: function(){}, resume: function(){}, destroy: function(){} };
    }
  });

  // ---------- Lật thẻ nhớ ----------
  var MEMORY_ICONS = ['🍎', '🍌', '🍇', '🍉', '⭐', '🚗', '🐱', '🎲'];
  games.push({
    id: 'memory', name: 'Lật thẻ nhớ', icon: '🧠', desc: 'Tìm các cặp biểu tượng', cat: 'Trí tuệ', dur: '5p',
    help: 'Mỗi lượt chạm lật hai thẻ. Hai thẻ giống nhau thì được giữ ngửa, khác nhau thì úp lại. Tìm đủ 8 cặp với càng ít lượt càng tốt.',
    score: { label: 'Lượt', unit: 'lượt', better: 'low' },
    mount: function(host){
      var deck = shuffle(MEMORY_ICONS.concat(MEMORY_ICONS)), open = [], matched = [], found = 0, moves = 0, lock = false, cells = [];
      var grid = el('div', 'g-grid');
      grid.style.setProperty('--cols', '4');
      grid.style.maxWidth = fit(host, 4, 4, 80) + 'px';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', '16 thẻ úp');
      deck.forEach(function(_, i){
        var c = button('g-tile', '?');
        c.setAttribute('data-i', String(i));
        c.setAttribute('aria-label', 'Thẻ ' + (i + 1) + ': đang úp');
        cells.push(c);
        grid.appendChild(c);
      });
      var note = el('p', 'g-note', 'Chạm hai thẻ để lật.');
      note.setAttribute('role', 'status');
      host.root.appendChild(grid);
      host.root.appendChild(note);

      function stats(){
        countStats(host, moves, [{ label: 'Cặp', value: found + '/8' }]);
      }
      function face(k, up){
        setText(cells[k], up ? deck[k] : '?');
        cells[k].classList.toggle('is-on', up && !matched[k]);
        cells[k].classList.toggle('is-good', !!matched[k]);
        cells[k].setAttribute('aria-label', 'Thẻ ' + (k + 1) + ': ' + (up ? deck[k] : 'đang úp'));
      }
      host.tap(grid, function(e, cell){
        if(lock) return;
        var k = Number(cell.getAttribute('data-i'));
        if(matched[k] || open.indexOf(k) !== -1) return;
        open.push(k);
        face(k, true);
        host.sfx('tap');
        if(open.length < 2) return;
        var a = open[0], b = open[1];
        moves++;
        if(deck[a] === deck[b]){
          matched[a] = matched[b] = true;
          found++;
          open = [];
          face(a, true); face(b, true);
          host.sfx('good');
          setText(note, found === 8 ? 'Đủ 8 cặp!' : 'Đúng một cặp!');
          if(found === 8){
            lock = true;
            host.setTimeout(function(){ host.end({ won: true, score: moves, message: 'Tìm đủ 8 cặp!' }); }, 600);
          }
        } else {
          lock = true;
          setText(note, 'Chưa khớp — nhớ vị trí nhé.');
          host.setTimeout(function(){
            face(a, false); face(b, false);
            open = [];
            lock = false;
          }, 700);
        }
        stats();
      }, '.g-tile');
      stats();
      return {};
    }
  });

  // ---------- Tính nhanh ----------
  // Trả { text, answer, options[4] }: đáp án không âm, bốn lựa chọn khác nhau.
  function mathQuestion(rnd){
    var op = ['+', '−', '×'][randInt(3, rnd)], a, b, t, ans, pool;
    if(op === '×'){ a = 2 + randInt(11, rnd); b = 2 + randInt(8, rnd); ans = a * b; }
    else {
      a = 1 + randInt(20, rnd); b = 1 + randInt(20, rnd);
      if(op === '−' && a < b){ t = a; a = b; b = t; }
      ans = op === '+' ? a + b : a - b;
    }
    pool = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10];
    if(op === '×') pool.push(ans + a, ans - a, ans + b, ans - b);
    else pool.push(op === '+' ? Math.abs(a - b) : a + b);
    pool = pool.filter(function(v, i){ return v >= 0 && v !== ans && pool.indexOf(v) === i; });
    return { text: a + ' ' + op + ' ' + b, answer: ans, options: shuffle([ans].concat(shuffle(pool, rnd).slice(0, 3)), rnd) };
  }
  games.push({
    id: 'math', name: 'Tính nhanh', icon: '➕', desc: 'Trả lời phép tính trong 60 giây', cat: 'Trí tuệ', dur: '1p',
    help: 'Chọn đáp án đúng trong bốn ô. Mỗi câu đúng được 1 điểm, câu sai không bị trừ nhưng mất thời gian. Bạn có 60 giây.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    countdown: 3,
    logic: { question: mathQuestion },
    mount: function(host){
      var score = 0, left = 60, q = null, lock = false, opts = [];
      var ask = el('div', 'g-big');
      ask.setAttribute('role', 'status');
      var grid = el('div', 'g-grid');
      grid.style.setProperty('--cols', '2');
      grid.style.maxWidth = Math.min(340, fit(host, 2, 2, 150)) + 'px';
      for(var i = 0; i < 4; i++){
        var b = button('g-tile');
        b.setAttribute('data-i', String(i));
        opts.push(b);
        grid.appendChild(b);
      }
      var note = el('p', 'g-note', 'Chọn đáp án đúng.');
      [ask, grid, note].forEach(function(n){ host.root.appendChild(n); });

      function stats(){ host.setStats([{ label: 'Còn', value: left + ' giây' }]); }
      function next(){
        q = mathQuestion();
        lock = false;
        setText(ask, q.text + ' = ?');
        opts.forEach(function(o, k){
          setText(o, String(q.options[k]));
          o.classList.remove('is-good', 'is-bad');
        });
      }
      host.tap(grid, function(e, cell){
        if(lock) return;
        var pick = q.options[Number(cell.getAttribute('data-i'))], right = opts[q.options.indexOf(q.answer)];
        lock = true;
        right.classList.add('is-good');
        if(pick === q.answer){
          score++;
          host.setScore(score);
          host.sfx('good');
          setText(note, 'Đúng! ' + q.text + ' = ' + q.answer);
          host.setTimeout(next, 220);
        } else {
          cell.classList.add('is-bad');
          shake(cell);
          host.sfx('bad');
          setText(note, 'Sai rồi: ' + q.text + ' = ' + q.answer);
          host.setTimeout(next, 900);
        }
      }, '.g-tile');
      host.setInterval(function(){
        left--;
        stats();
        if(left <= 0) host.end({ score: score, message: 'Hết giờ!' });
      }, 1000);
      host.setScore(0);
      stats();
      next();
      return {};
    }
  });

  // ---------- 2048 ----------
  // grid: 16 số (0 = trống). Trả { grid, gained, moved } — không sửa grid gốc.
  function slide2048(grid, dir){
    var out = grid.slice(), gained = 0, moved = false, across = dir === 'left' || dir === 'right', back = dir === 'right' || dir === 'down';
    for(var i = 0; i < 4; i++){
      var idx = [], line = [], merged = [], j;
      for(j = 0; j < 4; j++) idx.push(across ? i * 4 + j : j * 4 + i);
      if(back) idx.reverse();
      for(j = 0; j < 4; j++) if(grid[idx[j]]) line.push(grid[idx[j]]);
      for(j = 0; j < line.length; j++){
        if(line[j] === line[j + 1]){ merged.push(line[j] * 2); gained += line[j] * 2; j++; }
        else merged.push(line[j]);
      }
      for(j = 0; j < 4; j++){
        out[idx[j]] = merged[j] || 0;
        if(out[idx[j]] !== grid[idx[j]]) moved = true;
      }
    }
    return { grid: out, gained: gained, moved: moved };
  }
  // Như slide2048 (grid/gained/moved phải trùng từng số — test node so 40.000 lượt) nhưng kể thêm từng ô đi đâu
  // để vẽ hoạt cảnh: moves = [{from, to, value, merged}] cho MỌI ô khác 0, kể cả ô đứng yên (from === to).
  // Hai ô gộp cùng có merged:true và cùng `to`.
  function moves2048(grid, dir){
    var out = grid.slice(), gained = 0, moved = false, moves = [], across = dir === 'left' || dir === 'right', back = dir === 'right' || dir === 'down';
    for(var i = 0; i < 4; i++){
      var idx = [], line = [], vals = [], j;
      for(j = 0; j < 4; j++) idx.push(across ? i * 4 + j : j * 4 + i);
      if(back) idx.reverse();
      for(j = 0; j < 4; j++) if(grid[idx[j]]) line.push({ v: grid[idx[j]], from: idx[j] });
      for(j = 0; j < line.length; j++){
        var to = idx[vals.length];
        if(j + 1 < line.length && line[j].v === line[j + 1].v){
          moves.push({ from: line[j].from, to: to, value: line[j].v, merged: true }, { from: line[j + 1].from, to: to, value: line[j + 1].v, merged: true });
          vals.push(line[j].v * 2);
          gained += line[j].v * 2;
          j++;
        } else {
          moves.push({ from: line[j].from, to: to, value: line[j].v, merged: false });
          vals.push(line[j].v);
        }
      }
      for(j = 0; j < 4; j++){
        out[idx[j]] = vals[j] || 0;
        if(out[idx[j]] !== grid[idx[j]]) moved = true;
      }
    }
    return { grid: out, gained: gained, moved: moved, moves: moves };
  }
  function canMove2048(grid){
    for(var k = 0; k < 16; k++){
      if(!grid[k]) return true;
      if(k % 4 < 3 && grid[k] === grid[k + 1]) return true;
      if(k < 12 && grid[k] === grid[k + 4]) return true;
    }
    return false;
  }
  // Màu nền theo bậc 2, 4, 8 … 2048; ô lớn hơn 2048 dùng dãy tím/xanh riêng.
  var TILE_BG = ['#2B3A5E', '#3B4F80', '#B4621F', '#C4521C', '#CF4526', '#C93030', '#E0B93A', '#E3C02B', '#E8C71C', '#EFCB0D', '#F5D000'];
  var TILE_BG_BIG = ['#A78BFA', '#C084FC', '#34D399', '#22D3EE'];
  games.push({
    id: 'g2048', name: '2048 mini', icon: '🔢', desc: 'Gộp số để đạt điểm cao', cat: 'Trí tuệ', dur: '15p',
    help: 'Vuốt (hoặc bấm mũi tên) để dồn tất cả ô về một phía. Hai ô cùng số chạm nhau sẽ gộp thành số gấp đôi. Hết chỗ và không gộp được nữa là hết ván.',
    score: { label: 'Điểm', unit: '', better: 'high' },
    logic: { slide: slide2048, moves: moves2048, canMove: canMove2048 },
    mount: function(host){
      var grid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], tiles = [], dead = [], anims = [], score = 0, top = 0, over = false, hit2048 = false;
      var still = !host.reducedMotion, SLIDE = 110, EASE = 'cubic-bezier(.2,.8,.2,1)';
      var board = el('div', 'g-grid');
      board.style.setProperty('--cols', '4');
      board.style.maxWidth = fit(host, 4, 4, 290) + 'px';
      board.style.position = 'relative';
      board.setAttribute('role', 'img');
      for(var i = 0; i < 16; i++){
        board.appendChild(el('div', 'g-tile is-dim'));
        tiles.push(null);
      }
      // Ô số nằm trên một lớp tuyệt đối đè lên 16 ô nền; vị trí là transform tính bằng % kích thước chính ô + khe 8px,
      // nên không cần đo bàn cờ và trượt chỉ tốn transform.
      var layer = el('div');
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none';
      board.appendChild(layer);
      var note = el('p', 'g-note', 'Vuốt trên màn hình hoặc bấm mũi tên.');
      note.setAttribute('role', 'status');
      var pad = el('div', 'g-pad');
      [['up', '↑', 'Lên'], ['left', '←', 'Sang trái'], ['right', '→', 'Sang phải'], ['down', '↓', 'Xuống']].forEach(function(d){
        var b = button('', d[1]);
        b.setAttribute('data-dir', d[0]);
        b.setAttribute('aria-label', d[2]);
        pad.appendChild(b);
      });
      [board, note, pad].forEach(function(n){ host.root.appendChild(n); });

      function pos(k){
        var c = k % 4, r = (k - c) / 4;
        return 'translate(calc(' + c * 100 + '% + ' + c * 8 + 'px),calc(' + r * 100 + '% + ' + r * 8 + 'px))';
      }
      function colorOf(v){
        var lv = Math.round(Math.log(v) / Math.LN2);
        return lv <= 11 ? TILE_BG[lv - 1] : TILE_BG_BIG[(lv - 12) % TILE_BG_BIG.length];
      }
      function make(v, k){
        var t = el('div', 'g-tile', String(v));
        t.style.cssText = 'position:absolute;left:0;top:0;width:calc((100% - 24px) / 4);height:calc((100% - 24px) / 4);min-width:0;min-height:0;border-color:transparent';
        t.style.transform = pos(k);
        t.style.backgroundColor = colorOf(v);
        t.style.color = v <= 64 ? '#F8FAFC' : '#0B1020';
        t.style.fontSize = v >= 10000 ? '20px' : v >= 1000 ? '24px' : '';
        layer.appendChild(t);
        return t;
      }
      // Mọi hoạt cảnh không giữ trạng thái (không fill forwards): style inline luôn là trạng thái cuối, nên huỷ
      // giữa chừng = nhảy ngay về đúng chỗ. Nước kế tiếp tới khi còn trượt thì chốt ngay rồi xử lý, không khoá vuốt.
      function play(t, frames, opts){ if(still && t.animate) anims.push(t.animate(frames, opts)); }
      function settle(){
        anims.forEach(function(a){ a.cancel(); });
        anims = [];
        dead.forEach(function(t){ t.remove(); });
        dead = [];
      }
      function spawn(){
        var free = [];
        grid.forEach(function(v, k){ if(!v) free.push(k); });
        if(!free.length) return -1;
        var k = free[randInt(free.length)];
        grid[k] = Math.random() < 0.9 ? 2 : 4;
        return k;
      }
      function appear(k, delay){
        var t = tiles[k] = make(grid[k], k);
        play(t, [{ opacity: 0, transform: pos(k) + ' scale(0)' }, { opacity: 1, transform: pos(k) + ' scale(1)' }], { duration: 110, delay: delay, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.2,1.2)' });
      }
      function paint(){
        var max = 0, rows = [];
        grid.forEach(function(v){ max = Math.max(max, v); });
        for(var r = 0; r < 4; r++) rows.push(grid.slice(r * 4, r * 4 + 4).map(function(v){ return v || 'trống'; }).join(' '));
        board.setAttribute('aria-label', 'Bàn 4 nhân 4: ' + rows.join('; '));
        if(max !== top){
          top = max;
          host.setStats([{ label: 'Ô lớn nhất', value: String(top) }]);
        }
      }
      function move(dir){
        if(over) return;
        var r = moves2048(grid, dir);
        if(!r.moved) return;
        settle();
        var next = [], best = 0, bestAt = -1, k;
        for(k = 0; k < 16; k++) next.push(null);
        r.moves.forEach(function(m){
          var t = tiles[m.from];
          if(m.merged){
            // Hai ô gộp cùng trượt vào đích rồi biến mất; ô mới mang số gấp đôi nảy lên ngay sau đó.
            t.style.transform = pos(m.to);
            t.style.opacity = '0';
            play(t, [{ transform: pos(m.from), opacity: 1 }, { transform: pos(m.to), opacity: 1 }], { duration: SLIDE, easing: EASE });
            dead.push(t);
            if(!next[m.to]){
              var v = m.value * 2, nt = next[m.to] = make(v, m.to), at = pos(m.to);
              play(nt, [{ opacity: 0, transform: at + ' scale(1)' }, { opacity: 1, transform: at + ' scale(1)', offset: 0.01 }, { opacity: 1, transform: at + ' scale(1.15)', offset: 0.5 }, { opacity: 1, transform: at + ' scale(1)' }],
                { duration: 120, delay: SLIDE, fill: 'backwards', easing: 'ease-out' });
              if(v > best){ best = v; bestAt = m.to; }
            }
          } else {
            next[m.to] = t;
            if(m.from !== m.to){
              t.style.transform = pos(m.to);
              play(t, [{ transform: pos(m.from) }, { transform: pos(m.to) }], { duration: SLIDE, easing: EASE });
            }
          }
        });
        if(!still) settle();
        tiles = next;
        grid = r.grid;
        var born = spawn();
        if(born >= 0) appear(born, SLIDE);
        host.sfx('whoosh');
        if(r.gained){
          score += r.gained;
          host.setScore(score);
          host.sfx('merge', { value: best });
          var p = host.fx.at(board.children[bestAt]);
          host.fx.text(p.x, p.y - 8, '+' + r.gained, { color: '#FBBF24', size: 20 });
          if(best >= 128) host.fx.burst(p.x, p.y, { n: 10, colors: [colorOf(best), '#FFFFFF'], speed: 180, life: 420, size: 2.6 });
        }
        paint();
        if(!hit2048 && top >= 2048){
          hit2048 = true;
          host.sfx('record');
          host.haptic('success');
          var c = host.fx.at(board);
          host.fx.burst(c.x, c.y, { n: 36, shape: 'confetti', speed: 420, life: 1300, size: 5, gravity: 520, angle: -Math.PI / 2, spread: 1.6 });
          setText(note, 'Bạn đã đạt 2048! Cứ chơi tiếp để phá kỷ lục.');
        }
        if(!canMove2048(grid)){
          over = true;
          setText(note, 'Hết nước đi.');
          host.setTimeout(function(){ host.end({ score: score, won: hit2048 ? true : undefined, message: hit2048 ? 'Đạt 2048!' : 'Hết nước đi' }); }, 700);
        }
      }
      host.swipe(host.root, move, { live: true, threshold: 18 });
      host.tap(pad, function(e, b){ move(b.getAttribute('data-dir')); }, '[data-dir]');
      var first = spawn(), second = spawn();
      appear(first, 0);
      appear(second, 0);
      host.setScore(0);
      paint();
      return {};
    }
  });

  // ---------- Đoán số ----------
  games.push({
    id: 'guessNumber', name: 'Đoán số', icon: '🔮', desc: 'Tìm số bí mật từ 1 đến 100', cat: 'Trí tuệ', dur: '5p',
    help: 'Máy nghĩ một số từ 1 đến 100. Gõ số rồi bấm "Đoán"; máy sẽ cho biết số bí mật lớn hơn hay nhỏ hơn. Đoán trúng với càng ít lượt càng tốt.',
    score: { label: 'Lượt', unit: 'lượt', better: 'low' },
    mount: function(host){
      var secret = 1 + randInt(100), tries = 0, entry = '', lo = 1, hi = 100, done = false;
      var screen = el('div', 'g-big', '—');
      screen.setAttribute('aria-label', 'Số đang gõ');
      var note = el('p', 'g-note', 'Mình đã nghĩ một số từ 1 đến 100. Gõ số rồi bấm Đoán.');
      note.setAttribute('role', 'status');
      var pad = el('div', 'g-grid');
      pad.style.setProperty('--cols', '3');
      pad.style.maxWidth = '330px';
      var keyH = Math.max(48, Math.min(64, Math.floor((host.size().h - 170) / 4) - 8)) + 'px', guessBtn = null;
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Xoá', '0', 'Đoán'].forEach(function(k){
        var b = button('g-btn' + (k === 'Đoán' ? ' primary' : ''), k);
        b.setAttribute('data-key', k);
        b.style.minHeight = keyH;
        if(k.length === 1) b.style.fontSize = '22px';
        if(k === 'Xoá') b.setAttribute('aria-label', 'Xoá chữ số vừa gõ');
        if(k === 'Đoán') guessBtn = b;
        pad.appendChild(b);
      });
      [screen, note, pad].forEach(function(n){ host.root.appendChild(n); });

      function paint(){
        setText(screen, entry || '—');
        guessBtn.disabled = !entry;
      }
      function stats(){
        countStats(host, tries, [{ label: 'Khoảng', value: lo + '–' + hi }]);
      }
      function guess(){
        var n = Number(entry);
        entry = '';
        if(n < 1 || n > 100){
          setText(note, 'Chỉ đoán số từ 1 đến 100 — lượt này không tính.');
          shake(screen);
          host.sfx('bad');
          return;
        }
        tries++;
        if(n === secret){
          done = true;
          entry = String(n);
          setText(note, 'Đúng rồi!');
          stats();
          host.end({ won: true, score: tries, message: 'Đúng rồi! Số bí mật là ' + n });
          return;
        }
        if(n < secret){ lo = Math.max(lo, n + 1); setText(note, 'Số bí mật LỚN hơn ' + n + '.'); }
        else { hi = Math.min(hi, n - 1); setText(note, 'Số bí mật NHỎ hơn ' + n + '.'); }
        host.sfx('tap');
        stats();
      }
      host.on(pad, 'click', function(e){
        var b = e.target.closest('[data-key]');
        if(!b || b.disabled || done) return;
        var k = b.getAttribute('data-key');
        if(k === 'Đoán') guess();
        else if(k === 'Xoá') entry = entry.slice(0, -1);
        else if(entry.length < 3){ entry = entry === '0' ? k : entry + k; host.sfx('tap'); }
        paint();
      });
      stats();
      paint();
      return {};
    }
  });

  // ---------- Xếp chữ (tiếng Việt có dấu, mỗi từ một tiếng) ----------
  var WORDS = [
    ['TRƯỜNG', 'nơi học sinh đến học'], ['THUYỀN', 'đi lại trên sông nước'], ['HƯƠNG', 'mùi thơm'], ['NGHIÊNG', 'lệch, không thẳng đứng'],
    ['BIỂN', 'nước mặn mênh mông'], ['TRĂNG', 'sáng trên trời đêm'], ['CHANH', 'quả rất chua'], ['KHOAI', 'củ luộc hoặc nướng ăn rất bùi'],
    ['BƯỞI', 'quả to, nhiều múi'], ['CHUỐI', 'quả dài, chín thì vàng'], ['NƯỚC', 'thứ ta uống mỗi ngày'], ['RỪNG', 'nơi có rất nhiều cây'],
    ['ĐƯỜNG', 'vị ngọt, cũng là lối đi'], ['NGƯỜI', 'bạn và tôi đều là…'], ['THÁNG', 'khoảng 30 ngày'], ['TUYẾT', 'trắng, lạnh, rơi mùa đông'],
    ['SƯƠNG', 'hơi nước đọng buổi sớm'], ['GIƯỜNG', 'chỗ nằm ngủ'], ['CHIỀU', 'buổi sau giờ trưa'], ['BÁNH', 'món ăn làm từ bột'],
    ['BƯỚM', 'côn trùng có đôi cánh đẹp'], ['CHIM', 'con vật biết bay, biết hót'], ['TRÂU', 'con vật kéo cày'], ['NGỰA', 'con vật phi nước đại'],
    ['KIẾN', 'con vật tí hon, chăm chỉ'], ['SÁCH', 'thứ để đọc'], ['QUẠT', 'đồ dùng làm mát'], ['GƯƠNG', 'thứ để soi mặt'],
    ['KHOÁ', 'thứ giữ cửa không mở được'], ['XOÀI', 'quả ngọt mùa hè'], ['NHÃN', 'quả nhỏ, cùi trắng trong'], ['THƯƠNG', 'yêu mến, quý trọng'],
    ['MƯỜI', 'số đứng sau chín'], ['XANH', 'màu của lá cây'], ['VÀNG', 'màu của lúa chín'], ['TRẮNG', 'màu của mây'],
    ['THUỐC', 'uống khi bị ốm'], ['ĐIỆN', 'thứ làm đèn sáng'], ['MUỐI', 'gia vị mặn'], ['LƯỢC', 'đồ dùng chải tóc'],
    ['TRANH', 'bức vẽ treo tường'], ['TRỐNG', 'nhạc cụ gõ, kêu tùng tùng']
  ].map(function(w){ return { word: w[0].normalize('NFC'), hint: w[1] }; });
  var WORD_MAX = 7;
  // Xáo mảng chữ cái, không bao giờ trả về đúng thứ tự gốc.
  function scrambleWord(word, rnd){
    var src = Array.from(word), out;
    do{ out = shuffle(src.slice(), rnd); }while(out.join('') === word);
    return out;
  }
  games.push({
    id: 'wordScramble', name: 'Xếp chữ', icon: '🔤', desc: 'Sắp lại chữ cái thành từ đúng', cat: 'Trí tuệ', dur: '5p',
    help: 'Chạm các chữ ở hàng dưới để xếp thành từ đúng theo gợi ý; chạm chữ đã xếp để trả lại. Xếp được nhiều từ nhất trong 60 giây (tối đa 10 từ).',
    score: { label: 'Từ đúng', unit: '', better: 'high' },
    countdown: 3,
    logic: { words: WORDS, scramble: scrambleWord },
    mount: function(host){
      var queue = [], cur = null, letters = [], placed = [], used = [], score = 0, left = 60, lock = false, slots = [], pool = [];
      var hint = el('p', 'g-note');
      var slotGrid = el('div', 'g-grid'), poolGrid = el('div', 'g-grid');
      slotGrid.setAttribute('role', 'group');
      slotGrid.setAttribute('aria-label', 'Từ đang xếp');
      poolGrid.setAttribute('role', 'group');
      poolGrid.setAttribute('aria-label', 'Chữ cái còn lại');
      for(var i = 0; i < WORD_MAX; i++){
        var s = button('g-tile is-dim'), p = button('g-tile');
        s.setAttribute('data-i', String(i)); p.setAttribute('data-i', String(i));
        slots.push(s); pool.push(p);
        slotGrid.appendChild(s); poolGrid.appendChild(p);
      }
      var msg = el('p', 'g-note');
      msg.setAttribute('role', 'status');
      var clearBtn = button('g-btn', 'Gỡ hết chữ'), skipBtn = button('g-btn', 'Từ khác');
      var row = el('div', 'g-row');
      row.appendChild(clearBtn); row.appendChild(skipBtn);
      [hint, slotGrid, poolGrid, msg, row].forEach(function(n){ host.root.appendChild(n); });

      function stats(){ host.setStats([{ label: 'Còn', value: left + ' giây' }]); }
      function paint(state){
        var n = letters.length;
        slots.forEach(function(sl, k){
          var ch = k < n && placed[k] !== null ? letters[placed[k]] : '';
          sl.hidden = k >= n;
          setText(sl, ch);
          sl.classList.toggle('is-dim', !ch);
          sl.classList.toggle('is-on', !!ch && !state);
          sl.classList.toggle('is-good', !!ch && state === 'good');
          sl.classList.toggle('is-bad', !!ch && state === 'bad');
          sl.setAttribute('aria-label', ch ? 'Ô ' + (k + 1) + ': ' + ch + ' — chạm để trả lại' : 'Ô ' + (k + 1) + ': trống');
        });
        pool.forEach(function(pl, k){
          pl.hidden = k >= n;
          setText(pl, k < n && !used[k] ? letters[k] : '');
          pl.classList.toggle('is-dim', !!used[k]);
          pl.disabled = k >= n || !!used[k];
        });
      }
      function nextWord(){
        if(!queue.length) queue = shuffle(WORDS.filter(function(w){ return w !== cur; }));
        cur = queue.pop();
        letters = scrambleWord(cur.word);
        placed = letters.map(function(){ return null; });
        used = [];
        lock = false;
        var cols = String(letters.length), w = Math.min(host.size().w, letters.length * 66) + 'px';
        [slotGrid, poolGrid].forEach(function(g){ g.style.setProperty('--cols', cols); g.style.maxWidth = w; });
        setText(hint, 'Gợi ý: ' + cur.hint + '.');
        paint();
      }
      function check(){
        if(placed.indexOf(null) !== -1) return;
        var made = placed.map(function(k){ return letters[k]; }).join('');
        if(made !== cur.word){
          paint('bad');
          shake(slotGrid);
          host.sfx('bad');
          setText(msg, 'Chưa đúng — chạm chữ ở hàng trên để trả lại rồi xếp lại.');
          return;
        }
        score++;
        lock = true;
        host.setScore(score);
        host.sfx('good');
        paint('good');
        setText(msg, 'Chính xác: ' + cur.word + '!');
        host.setTimeout(function(){
          if(score >= 10) host.end({ score: score, won: true, message: 'Xếp đủ 10 từ!' });
          else nextWord();
        }, 650);
      }
      host.on(poolGrid, 'click', function(e){
        var b = e.target.closest('.g-tile');
        if(!b || lock) return;
        var k = Number(b.getAttribute('data-i')), free = placed.indexOf(null);
        if(used[k] || free === -1 || k >= letters.length) return;
        placed[free] = k;
        used[k] = true;
        host.sfx('tap');
        setText(msg, '');
        paint();
        check();
      });
      host.on(slotGrid, 'click', function(e){
        var b = e.target.closest('.g-tile');
        if(!b || lock) return;
        var k = Number(b.getAttribute('data-i'));
        if(k >= letters.length || placed[k] === null) return;
        used[placed[k]] = false;
        placed[k] = null;
        host.sfx('tap');
        setText(msg, '');
        paint();
      });
      host.on(clearBtn, 'click', function(){
        if(lock) return;
        placed = letters.map(function(){ return null; });
        used = [];
        setText(msg, '');
        paint();
      });
      host.on(skipBtn, 'click', function(){
        if(lock) return;
        setText(msg, 'Từ vừa rồi là ' + cur.word + '.');
        nextWord();
      });
      host.setInterval(function(){
        left--;
        stats();
        if(left <= 0) host.end({ score: score, message: 'Hết giờ!' });
      }, 1000);
      host.setScore(0);
      stats();
      nextWord();
      return {};
    }
  });

  // ---------- 21 điểm ----------
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
  // cards: [{ r: 1..13 }]. J/Q/K = 10; A = 11, tự hạ xuống 1 khi tổng vượt 21.
  function handValue(cards){
    var sum = 0, aces = 0;
    cards.forEach(function(c){
      sum += c.r === 1 ? 11 : Math.min(10, c.r);
      if(c.r === 1) aces++;
    });
    while(sum > 21 && aces){ sum -= 10; aces--; }
    return sum;
  }
  var BJ_HANDS = 5;
  games.push({
    id: 'blackjack', name: '21 điểm mini', icon: '🃏', desc: 'Rút bài gần 21 nhất', cat: 'May mắn', dur: '5p',
    help: 'Rút bài sao cho tổng điểm gần 21 nhất mà không vượt quá. J, Q, K tính 10; A tính 11 hoặc 1. Bấm "Dừng" để máy rút — máy rút tới khi được ít nhất 17. Chơi 5 ván, tính số ván thắng.',
    score: { label: 'Ván thắng', unit: '', better: 'high' },
    logic: { handValue: handValue },
    mount: function(host){
      var deck = [], player = [], dealer = [], wins = 0, losses = 0, ties = 0, played = 0, live = false;
      var dealerLabel = el('p', 'g-note'), playerLabel = el('p', 'g-note');
      [dealerLabel, playerLabel].forEach(function(l){ l.style.minHeight = '0'; l.style.textAlign = 'left'; });
      var dealerRow = el('div', 'g-grid'), playerRow = el('div', 'g-grid');
      [dealerRow, playerRow].forEach(function(r){ r.style.setProperty('--cols', '6'); });
      var note = el('p', 'g-note');
      note.setAttribute('role', 'status');
      var hitBtn = button('g-btn primary', 'Rút bài'), standBtn = button('g-btn', 'Dừng'), nextBtn = button('g-btn', 'Ván mới');
      var row = el('div', 'g-row');
      row.appendChild(hitBtn); row.appendChild(standBtn);
      [dealerLabel, dealerRow, playerLabel, playerRow, note, row, nextBtn].forEach(function(n){ host.root.appendChild(n); });

      function stats(){
        host.setStats([{ label: 'Ván', value: Math.min(BJ_HANDS, played + (live ? 1 : 0)) + '/' + BJ_HANDS }, { label: 'Thua · Hoà', value: losses + ' · ' + ties }]);
      }
      function cardText(c){ return RANKS[c.r - 1] + SUITS[c.s]; }
      function addCard(rowEl, c, hidden){
        var t = el('div', 'g-tile' + (hidden ? ' is-dim' : ''), hidden ? '?' : cardText(c));
        t.style.fontSize = '20px';
        rowEl.appendChild(t);
        return t;
      }
      function labels(reveal){
        setText(playerLabel, 'Bạn: ' + handValue(player) + ' điểm');
        setText(dealerLabel, reveal ? 'Máy: ' + handValue(dealer) + ' điểm' : 'Máy: ' + handValue([dealer[0]]) + ' điểm + một lá úp');
      }
      function deal(){
        deck = [];
        for(var s = 0; s < 4; s++) for(var r = 1; r <= 13; r++) deck.push({ r: r, s: s });
        shuffle(deck);
        player = [deck.pop(), deck.pop()];
        dealer = [deck.pop(), deck.pop()];
        dealerRow.textContent = ''; playerRow.textContent = '';
        addCard(dealerRow, dealer[0], false);
        addCard(dealerRow, dealer[1], true);
        player.forEach(function(c){ addCard(playerRow, c, false); });
        live = true;
        hitBtn.disabled = false; standBtn.disabled = false; nextBtn.disabled = true;
        setText(nextBtn, 'Ván mới');
        setText(note, 'Rút thêm hay dừng?');
        labels(false);
        stats();
      }
      function settle(){
        var p = handValue(player), d = handValue(dealer), text;
        live = false;
        played++;
        hitBtn.disabled = true; standBtn.disabled = true; nextBtn.disabled = false;
        var hole = dealerRow.children[1];
        setText(hole, cardText(dealer[1]));
        hole.classList.remove('is-dim');
        labels(true);
        if(p > 21){ losses++; text = 'Bạn quá 21 — thua ván này.'; host.sfx('bad'); }
        else if(d > 21){ wins++; text = 'Máy quá 21 — bạn thắng ván này!'; host.sfx('good'); }
        else if(p > d){ wins++; text = 'Bạn ' + p + ', máy ' + d + ' — bạn thắng ván này!'; host.sfx('good'); }
        else if(p < d){ losses++; text = 'Bạn ' + p + ', máy ' + d + ' — thua ván này.'; host.sfx('bad'); }
        else { ties++; text = 'Hoà ' + p + ' đều.'; host.sfx('tap'); }
        setText(note, text);
        setText(nextBtn, played >= BJ_HANDS ? 'Xem kết quả' : 'Ván mới');
        host.setScore(wins);
        stats();
      }
      host.on(hitBtn, 'click', function(){
        if(!live || handValue(player) > 21) return;
        var c = deck.pop();
        player.push(c);
        addCard(playerRow, c, false);
        host.sfx('tap');
        labels(false);
        if(handValue(player) > 21) settle();
      });
      host.on(standBtn, 'click', function(){
        if(!live) return;
        while(handValue(dealer) < 17){
          var c = deck.pop();
          dealer.push(c);
          addCard(dealerRow, c, false);
        }
        settle();
      });
      host.on(nextBtn, 'click', function(){
        if(live) return;
        if(played >= BJ_HANDS) host.end({ score: wins, message: 'Thắng ' + wins + '/' + BJ_HANDS + ' ván' });
        else deal();
      });
      host.setScore(0);
      deal();
      return {};
    }
  });

  // ---------- Nhớ chuỗi màu ----------
  // Màu cố định, không theo theme: ở theme Forest --brand và --good trùng nhau, hai đèn sẽ cùng màu.
  var LAMPS = [{ sym: '▲', color: '#F87171', name: 'tam giác đỏ' }, { sym: '●', color: '#60A5FA', name: 'tròn xanh dương' },
    { sym: '■', color: '#FBBF24', name: 'vuông vàng' }, { sym: '◆', color: '#34D399', name: 'thoi xanh lá' }];
  var SIMON_ON = 420, SIMON_GAP = 180;
  games.push({
    id: 'simon', name: 'Nhớ chuỗi màu', icon: '💡', desc: 'Lặp lại thứ tự đèn sáng', cat: 'Trí tuệ', dur: '5p',
    help: 'Máy nháy lần lượt từng đèn. Khi máy nháy xong, chạm lại các đèn đúng thứ tự đó. Mỗi vòng chuỗi dài thêm một đèn; chạm sai là hết ván.',
    score: { label: 'Vòng', unit: '', better: 'high' },
    mount: function(host){
      var seq = [randInt(4)], pos = 0, rounds = 0, showing = true, over = false, cells = [], offTimers = [0, 0, 0, 0];
      var grid = el('div', 'g-grid');
      grid.style.setProperty('--cols', '2');
      grid.style.maxWidth = Math.min(360, fit(host, 2, 2, 90)) + 'px';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'Bốn đèn');
      LAMPS.forEach(function(l, i){
        var c = button('g-tile', l.sym + ' ' + (i + 1));
        c.setAttribute('data-i', String(i));
        c.setAttribute('aria-label', 'Đèn ' + (i + 1) + ': ' + l.name);
        c.style.color = l.color;
        cells.push(c);
        grid.appendChild(c);
      });
      var note = el('p', 'g-note');
      note.setAttribute('role', 'status');
      host.root.appendChild(grid);
      host.root.appendChild(note);

      function light(k, on){
        cells[k].classList.toggle('is-on', on);
        cells[k].style.backgroundColor = on ? LAMPS[k].color : '';
        cells[k].style.color = on ? 'var(--on-brand)' : LAMPS[k].color;
      }
      function stats(){ host.setStats([{ label: 'Chuỗi', value: seq.length + ' đèn' }]); }
      function playSeq(){
        var i = 0;
        showing = true;
        grid.setAttribute('aria-busy', 'true');
        setText(note, 'Nhìn kỹ thứ tự đèn sáng…');
        stats();
        function step(){
          if(i >= seq.length){
            showing = false;
            pos = 0;
            grid.setAttribute('aria-busy', 'false');
            setText(note, 'Đến lượt bạn: chạm lại đúng thứ tự.');
            return;
          }
          var k = seq[i++];
          light(k, true);
          host.sfx('simon' + k);
          host.setTimeout(function(){
            light(k, false);
            host.setTimeout(step, SIMON_GAP);
          }, SIMON_ON);
        }
        host.setTimeout(step, 500);
      }
      // Mỗi đèn một nốt riêng như Simon thật (simon0..simon3), cả lúc máy nháy lẫn lúc bạn chạm.
      host.tap(grid, function(e, cell){
        if(showing || over) return;
        var k = Number(cell.getAttribute('data-i'));
        if(k !== seq[pos]){
          over = true;
          cell.classList.add('is-bad');
          cell.style.color = '';
          shake(cell);
          host.sfx('bad');
          setText(note, 'Sai rồi — phải là đèn ' + (seq[pos] + 1) + ' (' + LAMPS[seq[pos]].sym + ').');
          host.setTimeout(function(){ host.end({ score: rounds, message: rounds ? 'Nhớ được ' + rounds + ' vòng' : 'Sai ngay vòng đầu' }); }, 900);
          return;
        }
        light(k, true);
        host.sfx('simon' + k);
        host.clearTimeout(offTimers[k]);
        offTimers[k] = host.setTimeout(function(){ light(k, false); }, 160);
        pos++;
        if(pos < seq.length) return;
        rounds++;
        showing = true;
        host.setScore(rounds);
        host.sfx('good');
        setText(note, 'Đúng! Thêm một đèn nữa…');
        seq.push(randInt(4));
        host.setTimeout(playSeq, 400);
      }, '.g-tile');
      host.setScore(0);
      playSeq();
      return {};
    }
  });

  // ---------- Dò mìn ----------
  // Luôn dùng ô "Đồng hồ" riêng (không setScore lúc đang chơi): vỏ ghi số của setScore làm kỷ lục cả khi thua.
  function around(size, k){
    var x = k % size, y = Math.floor(k / size), out = [];
    for(var dy = -1; dy <= 1; dy++) for(var dx = -1; dx <= 1; dx++){
      var nx = x + dx, ny = y + dy;
      if((dx || dy) && nx >= 0 && nx < size && ny >= 0 && ny < size) out.push(ny * size + nx);
    }
    return out;
  }
  // Rải mìn SAU cú mở đầu tiên: ô `safe` và các ô kề nó không bao giờ có mìn.
  function layMines(size, count, safe, rnd){
    var banned = {}, free = [], mines = [], i;
    banned[safe] = true;
    around(size, safe).forEach(function(k){ banned[k] = true; });
    for(i = 0; i < size * size; i++){
      mines.push(false);
      if(!banned[i]) free.push(i);
    }
    shuffle(free, rnd);
    for(i = 0; i < count && i < free.length; i++) mines[free[i]] = true;
    return mines;
  }
  var MINE_SIZE = 8, MINE_COUNT = 10, HOLD_MS = 400;
  games.push({
    id: 'mines', name: 'Dò mìn mini', icon: '💣', desc: 'Tránh 10 quả mìn trong lưới 8x8', cat: 'Trí tuệ', dur: '5p',
    help: 'Chạm để mở ô. Số trong ô cho biết có bao nhiêu mìn ở 8 ô xung quanh. Chạm giữ, hoặc chọn "Cắm cờ", để đánh dấu ô nghi có mìn. Mở hết ô an toàn là thắng.',
    score: { label: 'Thời gian', unit: 's', better: 'low' },
    logic: { layMines: layMines, around: around, size: MINE_SIZE, count: MINE_COUNT },
    mount: function(host){
      var N = MINE_SIZE, mines = null, opened = [], flagged = [], openCount = 0, flags = 0, secs = 0, over = false, flagMode = false,
        cells = [], holdTimer = 0, skipClick = -1, clock = 0;
      var grid = el('div', 'g-grid');
      grid.style.setProperty('--cols', String(N));
      // Khe 2px thay cho 8px mặc định: 8 cột × 44px mới lọt vừa bề ngang 366px của iPhone 390.
      grid.style.gap = '2px';
      // Không ép tối thiểu 366px: ở máy rộng 375 lưới sẽ tràn mép phải; ô 42px ở đó vẫn hơn là tràn.
      grid.style.maxWidth = Math.floor(Math.min(420, host.size().w, host.size().h - 190)) + 'px';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'Bãi mìn 8 nhân 8');
      for(var i = 0; i < N * N; i++){
        var c = button('g-tile');
        c.setAttribute('data-i', String(i));
        c.style.borderRadius = '8px';
        // Máy rộng 375: 8 ô × 44px không vừa 351px, cho ô co xuống ~42px thay vì để lưới tràn mép phải.
        c.style.minWidth = '0'; c.style.minHeight = '0';
        c.style.fontSize = '20px';
        c.style.backgroundColor = 'var(--panel3)';
        cells.push(c);
        grid.appendChild(c);
      }
      var note = el('p', 'g-note', 'Chạm để mở ô. Chạm giữ, hoặc chọn "Cắm cờ", để đánh dấu ô nghi có mìn.');
      note.setAttribute('role', 'status');
      var openBtn = button('g-btn', 'Mở ô'), flagBtn = button('g-btn', '🚩 Cắm cờ');
      var row = el('div', 'g-row');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Chạm vào ô sẽ');
      row.appendChild(openBtn); row.appendChild(flagBtn);
      [grid, note, row].forEach(function(n){ host.root.appendChild(n); });

      function where(k){ return 'Hàng ' + (Math.floor(k / N) + 1) + ' cột ' + (k % N + 1) + ': '; }
      function stats(){
        host.setStats([{ label: 'Mìn còn', value: String(Math.max(0, MINE_COUNT - flags)) }]);
      }
      function setMode(flag){
        flagMode = flag;
        openBtn.classList.toggle('primary', !flag);
        flagBtn.classList.toggle('primary', flag);
        openBtn.setAttribute('aria-pressed', String(!flag));
        flagBtn.setAttribute('aria-pressed', String(flag));
      }
      function countAround(k){
        return around(N, k).filter(function(n){ return mines[n]; }).length;
      }
      function toggleFlag(k){
        if(over || opened[k]) return;
        flagged[k] = !flagged[k];
        flags += flagged[k] ? 1 : -1;
        setText(cells[k], flagged[k] ? '🚩' : '');
        cells[k].setAttribute('aria-label', where(k) + (flagged[k] ? 'đã cắm cờ' : 'chưa mở'));
        host.sfx('tap');
        stats();
      }
      function lose(k){
        over = true;
        host.clearInterval(clock);
        mines.forEach(function(m, n){
          if(m){ setText(cells[n], '💣'); cells[n].setAttribute('aria-label', where(n) + 'mìn'); }
          else if(flagged[n]){ setText(cells[n], '✗'); cells[n].setAttribute('aria-label', where(n) + 'cắm cờ nhầm'); }
        });
        cells[k].classList.add('is-bad');
        cells[k].style.backgroundColor = '';
        setText(note, 'Trúng mìn mất rồi!');
        host.sfx('bad');
        host.setTimeout(function(){ host.end({ won: false, message: 'Trúng mìn!' }); }, 1000);
      }
      function openCell(k){
        if(over || opened[k] || flagged[k]) return;
        if(!mines){
          mines = layMines(N, MINE_COUNT, k);
          clock = host.setInterval(function(){ secs++; host.setScore(secs); }, 1000);
        }
        if(mines[k]){ lose(k); return; }
        var stack = [k];
        while(stack.length){
          var cur = stack.pop();
          if(opened[cur] || flagged[cur]) continue;
          var n = countAround(cur);
          opened[cur] = true;
          openCount++;
          cells[cur].classList.add('is-dim');
          cells[cur].style.backgroundColor = '';
          cells[cur].style.color = n === 1 ? 'var(--brand)' : n === 2 ? 'var(--good)' : 'var(--warn)';
          setText(cells[cur], n ? String(n) : '');
          cells[cur].setAttribute('aria-label', where(cur) + (n ? n + ' mìn xung quanh' : 'trống'));
          if(!n) around(N, cur).forEach(function(x){ if(!opened[x]) stack.push(x); });
        }
        host.sfx('tap');
        if(openCount === N * N - MINE_COUNT){
          over = true;
          host.clearInterval(clock);
          setText(note, 'Đã mở hết ô an toàn!');
          host.end({ won: true, score: Math.max(1, secs), message: 'Gỡ hết mìn!' });
        }
      }
      function cancelHold(){
        host.clearTimeout(holdTimer);
        holdTimer = 0;
      }
      host.on(grid, 'pointerdown', function(e){
        var cell = e.target.closest('.g-tile');
        cancelHold();
        skipClick = -1;
        if(!cell || over) return;
        var k = Number(cell.getAttribute('data-i'));
        holdTimer = host.setTimeout(function(){
          holdTimer = 0;
          if(over || opened[k]) return;
          toggleFlag(k);
          // Cú click sinh ra khi nhấc tay sau chạm giữ không được mở/cắm lại chính ô này.
          skipClick = k;
        }, HOLD_MS);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(t){ host.on(grid, t, cancelHold); });
      host.on(grid, 'contextmenu', function(e){ e.preventDefault(); });
      host.on(grid, 'click', function(e){
        var cell = e.target.closest('.g-tile');
        if(!cell || over) return;
        var k = Number(cell.getAttribute('data-i')), skip = skipClick === k;
        skipClick = -1;
        if(skip) return;
        if(flagMode) toggleFlag(k); else openCell(k);
      });
      host.on(openBtn, 'click', function(){ setMode(false); });
      host.on(flagBtn, 'click', function(){ setMode(true); });
      for(var j = 0; j < N * N; j++) cells[j].setAttribute('aria-label', where(j) + 'chưa mở');
      setMode(false);
      stats();
      return {};
    }
  });

  // ---------- Xếp hình 3x3 ----------
  games.push({
    id: 'slider', name: 'Xếp hình 3x3', icon: '🧩', desc: 'Sắp số theo thứ tự', cat: 'Trí tuệ', dur: '15p',
    help: 'Chạm một ô nằm cạnh ô trống để đẩy nó vào chỗ trống. Sắp các số từ 1 đến 8 theo thứ tự từ trái sang phải, từ trên xuống dưới, ô trống ở góc dưới bên phải.',
    score: { label: 'Bước', unit: 'bước', better: 'low' },
    mount: function(host){
      var core = window.GameHubCore, arr = core.shuffleSolvable(3), moves = 0, done = false, cells = [];
      var grid = el('div', 'g-grid');
      grid.style.setProperty('--cols', '3');
      grid.style.maxWidth = fit(host, 3, 3, 90) + 'px';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'Bàn xếp hình 3 nhân 3');
      for(var i = 0; i < 9; i++){
        var c = button('g-tile');
        c.setAttribute('data-i', String(i));
        cells.push(c);
        grid.appendChild(c);
      }
      var note = el('p', 'g-note', 'Chạm ô nằm cạnh ô trống để đẩy.');
      note.setAttribute('role', 'status');
      host.root.appendChild(grid);
      host.root.appendChild(note);

      function paint(){
        cells.forEach(function(cell, k){
          setText(cell, arr[k] ? String(arr[k]) : '');
          cell.classList.toggle('is-dim', !arr[k]);
          cell.setAttribute('aria-label', 'Ô ' + (k + 1) + ': ' + (arr[k] || 'trống'));
        });
      }
      function stats(){ countStats(host, moves, []); }
      host.on(grid, 'click', function(e){
        var cell = e.target.closest('.g-tile');
        if(!cell || done) return;
        var k = Number(cell.getAttribute('data-i')), z = arr.indexOf(0);
        var near = (Math.abs(k - z) === 1 && Math.floor(k / 3) === Math.floor(z / 3)) || Math.abs(k - z) === 3;
        if(!near) return;
        arr[z] = arr[k];
        arr[k] = 0;
        moves++;
        host.sfx('tap');
        paint();
        stats();
        if(core.isSolved(arr)){
          done = true;
          cells.forEach(function(x, n){ if(arr[n]) x.classList.add('is-good'); });
          setText(note, 'Xong!');
          host.setTimeout(function(){ host.end({ won: true, score: moves, message: 'Xếp xong!' }); }, 500);
        }
      });
      paint();
      stats();
      return {};
    }
  });

  // ---------- Bộ máy IDLE dùng chung ----------
  // Thêm một game IDLE = một lời gọi makeIdle với cấu hình; luật chơi giống hệt nhau:
  // chạm +power; "lên cấp" tốn lvl×50 (cấp +1, mỗi chạm +1); nâng công cụ tốn 30×1,35^(power−1);
  // thuê người tốn 80×1,45^auto (+1/giây); vắng mặt tối đa 2 giờ vẫn được cộng theo auto.
  var MAX_COINS = 9e15, MAX_AWAY_S = 7200;
  var UNITS = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  // 950 → "950", 1350 → "1,35K", 3400000 → "3,4M". Cắt bớt chứ không làm tròn lên: số hiện ra không bao giờ nhiều hơn số đang có.
  function short(n){
    n = Math.floor(n);
    for(var i = 0; i < UNITS.length; i++) if(n >= UNITS[i][0]){
      var v = n / UNITS[i][0], d = v >= 100 ? 1 : 2, p = Math.pow(10, d);
      return (Math.floor(v * p + 1e-9) / p).toLocaleString('vi-VN', { maximumFractionDigits: d }) + UNITS[i][1];
    }
    return String(n);
  }
  function num(v, min, fallback){ return typeof v === 'number' && isFinite(v) && v >= min ? v : fallback; }
  function twoLine(btn, title){
    var a = el('span', '', title), b = el('small');
    var wrap = el('span');
    wrap.appendChild(a); wrap.appendChild(b);
    btn.appendChild(wrap);
    return { title: a, sub: b };
  }
  // cfg: { id, name, icon, desc, res: 'Quặng', tap: 'Khai thác', tool: 'Máy khoan', pet: 'Thợ mỏ', hire: 'Thuê' (tuỳ chọn) }
  function makeIdle(cfg){
    var resLow = cfg.res.toLowerCase(), hire = (cfg.hire || 'Thuê') + ' ' + cfg.pet.toLowerCase();
    return {
      id: cfg.id, name: cfg.name, icon: cfg.icon, desc: cfg.desc, cat: 'IDLE', dur: '∞',
      help: 'Chạm nút lớn để gom ' + resLow + '. Dùng ' + resLow + ' để lên cấp, nâng ' + cfg.tool.toLowerCase() + ' (mỗi chạm được nhiều hơn) và ' + hire.toLowerCase() + ' (tự gom mỗi giây, kể cả khi bạn đóng app tối đa 2 giờ).',
      score: null,
      mount: function(host){
        var raw = host.load() || {}, now = Date.now();
        var s = { coins: num(raw.coins, 0, 0), lvl: Math.floor(num(raw.lvl, 1, 1)), power: Math.floor(num(raw.power, 1, 1)),
          auto: Math.floor(num(raw.auto, 0, 0)), last: num(raw.last, 0, now) };
        var dirty = false;

        var emoji = el('div', 'g-big', cfg.icon);
        emoji.setAttribute('aria-hidden', 'true');
        var note = el('p', 'g-note', 'Chạm để gom ' + resLow + ', rồi nâng cấp để kiếm nhanh hơn.');
        var tapBtn = el('button', 'g-big');
        tapBtn.type = 'button';
        var levelBtn = el('button', 'g-btn'), toolBtn = el('button', 'g-btn'), petBtn = el('button', 'g-btn'), resetBtn = el('button', 'g-btn danger', 'Làm lại từ đầu');
        [levelBtn, toolBtn, petBtn, resetBtn].forEach(function(b){ b.type = 'button'; });
        var tLevel = twoLine(levelBtn, ''), tTool = twoLine(toolBtn, cfg.tool), tPet = twoLine(petBtn, hire);
        var row = el('div', 'g-row');
        row.appendChild(toolBtn); row.appendChild(petBtn);
        [emoji, note, tapBtn, levelBtn, row, resetBtn].forEach(function(n){ host.root.appendChild(n); });

        function costs(){
          return { level: s.lvl * 50, tool: Math.floor(30 * Math.pow(1.35, s.power - 1)), pet: Math.floor(80 * Math.pow(1.45, s.auto)) };
        }
        function refresh(){
          var c = costs();
          setText(tapBtn, cfg.tap + ' +' + short(s.power));
          setText(tLevel.title, 'Lên cấp ' + (s.lvl + 1));
          setText(tLevel.sub, 'Cần ' + short(c.level) + ' ' + resLow + ' · mỗi chạm +1');
          setText(tTool.sub, 'Giá ' + short(c.tool) + ' · mỗi chạm +1');
          setText(tPet.sub, 'Giá ' + short(c.pet) + ' · +1 mỗi giây');
          levelBtn.disabled = s.coins < c.level;
          toolBtn.disabled = s.coins < c.tool;
          petBtn.disabled = s.coins < c.pet;
          host.setStats([{ label: cfg.res, value: short(s.coins) }, { label: 'Cấp', value: String(s.lvl) },
            { label: 'Mỗi chạm', value: '+' + short(s.power) }, { label: 'Tự động', value: short(s.auto) + '/giây' }]);
        }
        function persist(){
          s.last = Date.now();
          dirty = false;
          host.save({ coins: s.coins, lvl: s.lvl, power: s.power, auto: s.auto, last: s.last });
        }
        function earn(n){ s.coins = Math.min(MAX_COINS, s.coins + n); }
        // Thu nhập lúc vắng mặt, tính từ lần lưu cuối (đóng app, hoặc app bị đưa xuống nền).
        function collectAway(){
          var away = Math.max(0, Math.min(MAX_AWAY_S, Math.floor((Date.now() - s.last) / 1000))), gift = away * s.auto;
          if(gift > 0){
            earn(gift);
            setText(note, 'Lúc bạn vắng mặt, ' + cfg.pet.toLowerCase() + ' đã gom được ' + short(gift) + ' ' + resLow + '.');
          }
          if(away > 0) persist();
        }
        function buy(cost, apply){
          if(s.coins < cost) return;
          s.coins -= cost;
          apply();
          host.sfx('good');
          persist();
          refresh();
        }

        // "+N" bay lên từ chỗ chạm (bàn phím: giữa nút), emoji nảy theo mỗi cú chạm.
        host.tap(tapBtn, function(e){
          earn(s.power);
          dirty = true;
          host.sfx('tap');
          refresh();
          var p = host.fx.at(tapBtn);
          if(e.type === 'pointerdown'){
            var r = host.root.getBoundingClientRect();
            p = { x: e.clientX - r.left, y: e.clientY - r.top };
          }
          host.fx.text(p.x, p.y - 18, '+' + short(s.power), { color: '#FBBF24', size: 22 });
          host.fx.pulse(emoji, { scale: 1.1, ms: 140 });
        });
        host.on(levelBtn, 'click', function(){ buy(costs().level, function(){ s.lvl++; s.power++; }); });
        host.on(toolBtn, 'click', function(){ buy(costs().tool, function(){ s.power++; }); });
        host.on(petBtn, 'click', function(){ buy(costs().pet, function(){ s.auto++; }); });
        host.on(resetBtn, 'click', function(){
          host.confirm({ title: 'Làm lại ' + cfg.name + ' từ đầu?', body: 'Toàn bộ ' + resLow + ', cấp và nâng cấp của game này về 0. Không lấy lại được.',
            okLabel: 'Làm lại từ đầu', danger: true }).then(function(ok){
            if(!ok) return;
            s = { coins: 0, lvl: 1, power: 1, auto: 0, last: Date.now() };
            persist();
            setText(note, 'Đã làm lại từ đầu.');
            refresh();
          });
        });
        host.setInterval(function(){
          if(s.auto > 0){ earn(s.auto); dirty = true; refresh(); }
          if(dirty) persist();
        }, 1000);

        if(typeof raw.last === 'number') collectAway();
        refresh();
        return {
          pause: function(){ persist(); },
          resume: function(){ collectAway(); refresh(); },
          destroy: function(){ if(dirty) persist(); }
        };
      }
    };
  }

  games.push(makeIdle({ id: 'idleMine', name: 'IDLE Đào mỏ', icon: '⛏️', desc: 'Đào quặng, nâng cấp, cày cấp', res: 'Quặng', tap: 'Khai thác', tool: 'Máy khoan', pet: 'Thợ mỏ' }));
  games.push(makeIdle({ id: 'idleFarm', name: 'IDLE Nông trại', icon: '🌾', desc: 'Trồng lúa, bán hàng, mở rộng', res: 'Lúa', tap: 'Thu hoạch', tool: 'Máy gặt', pet: 'Nông dân' }));
  games.push(makeIdle({ id: 'idleCafe', name: 'IDLE Quán cà phê', icon: '☕', desc: 'Pha cà phê, thuê nhân viên', res: 'Cà phê', tap: 'Pha cà phê', tool: 'Máy pha', pet: 'Nhân viên' }));
  games.push(makeIdle({ id: 'idleSpace', name: 'IDLE Không gian', icon: '🚀', desc: 'Thu năng lượng, nâng tàu', res: 'Năng lượng', tap: 'Thu năng lượng', tool: 'Pin plasma', pet: 'Robot', hire: 'Lắp' }));
  games.push(makeIdle({ id: 'idleDragon', name: 'IDLE Nuôi rồng', icon: '🐉', desc: 'Cho ăn, luyện cấp, tiến hoá', res: 'Thức ăn', tap: 'Gom thức ăn', tool: 'Lò ấp', pet: 'Rồng con', hire: 'Nuôi' }));
})();
