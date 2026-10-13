# GameHub Offline

30 mini game chơi không cần mạng trên điện thoại: cấp độ/XP, nhiệm vụ mỗi ngày, chuỗi ngày chơi, huy hiệu, kỷ lục từng game, 5 bộ màu, sao lưu bằng file. Bản 2.0 (12/10/2026) viết lại toàn bộ vỏ app; game được viết theo một hợp đồng chung (mục 4) nên thêm/sửa game không phải đụng vào vỏ.

## 1. File

| File | Vai trò |
|---|---|
| `html/index.html` | Markup: 3 tab (Trang chủ / Trò chơi / Cài đặt), màn game, các sheet. Không có `onclick` inline. |
| `css/mini-game-hub.css` | Vỏ app + bộ class dùng chung cho game `.g-*` (mục 6). Chỉ có theme tối (cố ý); 5 bộ màu nhấn đổi qua `html[data-theme]`. |
| `js/mini-game-hub-core.js` | Logic thuần, không DOM, không localStorage. UMD: `window.GameHubCore` / `require()` trong node. |
| `js/mini-game-hub-games-action.js` | 15 game: snake, pong, flappy, runner, tower, maze, mole, reaction, target, colorMatch, tapRace, breath, rps, diceDuel, coinFlip. |
| `js/mini-game-hub-games-mind.js` | 15 game: tictactoe, memory, math, g2048, guessNumber, wordScramble, blackjack, simon, mines, slider, idleMine, idleFarm, idleCafe, idleSpace, idleDragon. Có sẵn bộ máy IDLE `makeIdle(cfg)`. |
| `js/mini-game-hub.js` | Vỏ: lưu trữ, tab, danh sách, host chạy game, cài đặt, sao lưu, đăng ký service worker. Nạp cuối cùng. |
| `sw-mini-game-hub.js` + `js/sw-core.js` | Service worker (vỏ một dòng + logic). `CACHE_NAME` `gamehub-cache-vN`; bump cùng lúc với `?v=` trong vỏ. `activate` chỉ xoá cache có tiền tố `gamehub-cache-`. |
| `manifest.json`, `img/mini-game-hub-icon*.{svg,png}` | PWA. PNG 180 có nền đặc kín góc (render từ SVG bằng Playwright, bỏ `rx` của nền). |
| `data/changelog.json` | Lịch sử cập nhật hiện trong Cài đặt. |

Thứ tự nạp `<script>`: core → games-action → games-mind → vỏ. File game chỉ làm `(window.GameHubGames = window.GameHubGames || []).push(def)`.

**Thêm file app nạp lúc chạy** → thêm vào `APP_CODE_PATHS` / `ICON_PATHS` / `DATA_PATHS` trong `js/sw-core.js` và bump `CACHE_NAME` + `?v=`.

**Danh mục và thẻ game**: danh mục 30 game (`CATALOG` trong core: id, tên, icon, mô tả, thể loại, thời lượng) là nguồn cho thẻ game và quyết định thứ tự thẻ. Cả 30 id hiện đều có `def`. Cơ chế an toàn: id nào thiếu `def` trong `window.GameHubGames` (ví dụ một file game không tải được) thì thẻ bị vô hiệu kèm nhãn "Chưa chơi được" thay vì lỗi; có `def` là thẻ tự dùng được — **không cần sửa vỏ**. Vỏ bỏ qua `def` có id ngoài danh mục, thiếu `mount`, hoặc trùng id (lấy cái đầu).

## 2. Dữ liệu — MỘT khoá `gamehub_v3`

```js
{ version:3, xp /* XP TRONG cấp hiện tại */, level, plays, seconds, theme, unlockedThemes[], sound, batterySaver,
  achievements:{id:ms}, best:{gameId:{v,at}}, stats:{gameId:{plays,seconds,last}},
  favorites:[gameId], days:{'YYYY-MM-DD' (giờ VN):{plays,seconds,idle,claimed:{open3|play5|idleTap:true}}},   // giữ 60 ngày gần nhất
  streakBest, idle:{gameId:{…số hữu hạn ≥ 0}}, updatedAt }
```

- Mọi lần ghi đi qua `update(fn)` trong vỏ: đọc lại localStorage → `validateState` → áp `fn` → ghi. Nhờ vậy hai tab cùng mở không ghi đè nhau; tab kia tự vẽ lại qua sự kiện `storage` (khi không có game đang mở).
- **Đọc hỏng ≠ chưa có dữ liệu.** JSON sai hoặc `validateState` rớt → cờ `corrupt`: KHÔNG ghi gì lên khoá, hiện banner "Không đọc được tiến trình" (Lưu bản lỗi ra file / Khôi phục từ file / Bắt đầu lại), game vẫn chơi được bằng trạng thái tạm không lưu, nút "Lưu file" bị khoá (không cho xuất bản tạm trông như bản thật).
- "Xoá hết tiến trình" = ghi `gamehub_v3` về mặc định (không `removeItem`, để bước chuyển dữ liệu 1.x không chạy lại). Hai bước, nút đỏ chỉ nhận chạm sau 400ms.
- `validateState` nghiêm: một trường sai là cả bản bị từ chối kèm lý do (dùng cho cả file sao lưu). Id game lạ nhưng đúng dạng được giữ lại.

### Chuyển dữ liệu 1.x (chạy MỘT lần khi chưa có `gamehub_v3` và có `gamehub_profile_v2`)

| Cũ | Mới | Quy tắc |
|---|---|---|
| `profile.xp, level, plays, seconds` | cùng tên | số ≥ 0 (level ≥ 1), làm tròn xuống; sai kiểu về mặc định; chạy lại vòng lên cấp |
| `theme`, `unlockedThemes` | cùng tên | chỉ id trong `THEMES`; luôn có `default`; `theme` phải thuộc `unlockedThemes` |
| `sound`, `batterySaver` | cùng tên | ép boolean |
| `achievements` | cùng tên | id đã biết, giá trị số; không phát lại 35 XP cho cái đã có |
| `missions[d]` | `days[d]={plays:0,seconds:0,idle:m.idleTap,claimed:m.claimed}` | chỉ `d` trong 60 ngày gần nhất |
| `hs_<id>` (id thuộc 30 game) | `best[id]={v,at:now}` | số nguyên > 0; `hs_react` bị bỏ qua |
| `bestReaction` | `best.reaction={v,at}` | ms > 0 (kỷ lục càng thấp càng tốt) |
| `save_idle*` | `idle[id]` | số hữu hạn ≥ 0, `lvl ≥ 1`, `power ≥ 1`, `last` không vượt quá hiện tại |
| `activeCat`, `activeDur` | bỏ | — |

**Không bao giờ xoá hay ghi các khoá cũ** — trang chủ của site (`js/index.js`) dùng chung `hs_snake`, `hs_flappy`, `hs_react`. App chỉ ghi đúng một khoá `gamehub_v3`.

### Sao lưu

- File `game-hub-YYYY-MM-DD.json` (ngày VN) = `{app:'mini-game-hub',kind:'progress',version:1,exportedAt,state}`.
- Khôi phục: `parseBackup` → sheet xem trước ("Cấp 3 · 12 lượt chơi · lưu ngày …") → nếu máy đang có tiến trình thì nút chính là "Lưu bản hiện tại rồi khôi phục" (`navigator.share` ngay trong cú chạm; chỉ ghi sau khi lưu xong) → ghi. Lỗi hiện tại chỗ kèm lý do.
- "Dán mã save cũ" (base64 của bản 1.x): chỉ đọc `profile` và các khoá `hs_*` / `save_idle*` / `bestReaction` trong `local`, đi qua `migrateV2`. Mọi khoá khác trong mã bị bỏ qua (bản 1.x ghi thẳng mọi khoá vào localStorage, ghi đè được cả `goldtrack_v1`).

## 3. Luật chơi

- **XP**: `xpNeed(level) = 100 + level×55` (L1→2 155, L2→3 210, L3→4 265, L4→5 320). +5 mỗi lần mở game ("Chơi lại" trong cùng lần mở không tính là mở mới); +3 mỗi 15 giây chơi — chỉ đếm khi màn game mở, trang `visible`, không tạm dừng, ván chưa kết thúc (đếm theo nhịp 1 giây, phần lẻ dưới 15 giây được giữ sang game sau trong cùng phiên); nhiệm vụ 40/60/50; huy hiệu 35, phát đủ một lần khi mở khoá.
- **Nhiệm vụ theo ngày VN**: mở 3 lượt (40), chơi 5 phút (60), chơi một game IDLE (50). Nút "Nhận" chỉ bật khi xong; mỗi nhiệm vụ nhận một lần/ngày.
- **Chuỗi ngày**: số ngày VN liên tiếp có `plays > 0` tính tới hôm nay; hôm nay chưa chơi thì vẫn tính tới hôm qua; hở một ngày thì về 0. `streakBest` giữ kỷ lục.
- **Huy hiệu** (id giữ từ bản cũ): `first_game`, `five_games`, `xp_500` (nay tên "Cấp 5", điều kiện level ≥ 5), `idle_5`, `high_50` (không tính game có kỷ lục "càng thấp càng tốt"). Chỉ được kiểm khi có hành động chơi (mở game, cộng giờ, lưu điểm, lưu IDLE, nhận nhiệm vụ) — mở app không tự cộng XP; huy hiệu đã đủ điều kiện mà chưa phát hiện "Chơi để nhận".
- **Giao diện mở theo cấp, không trừ XP**: Ocean L2, Sunset L3, Forest L5, Neon L8; bộ đã mở từ bản cũ giữ nguyên.
- **Kỷ lục**: `isBetter(def, mới, cũ)` theo `score.better`; điểm ≤ 0 không thành kỷ lục.
  - `better:'high'`: `host.end()` ghi điểm cuối ván; đóng/↻ giữa ván ghi **điểm cao nhất đã `setScore` trong ván** (rps có thể tụt điểm).
  - `better:'low'`: chỉ ghi khi game gọi `host.end()` với `won !== false`. Đóng/↻ giữa ván không ghi gì (số đang đếm dở sẽ thành kỷ lục không bao giờ phá được); `end({won:false})` không ghi và bảng kết quả không hiện điểm (mines trúng mìn).
  - Ô "Kỷ lục" trong lúc chơi chỉ hiện kỷ lục đã lưu; ô điểm hiện "—" cho tới lần `setScore` đầu tiên.
- **Ngày giờ**: mọi "hôm nay", tên file đều theo giờ VN (`vnToday`), không phụ thuộc múi giờ máy.

## 4. HỢP ĐỒNG GAME

```js
{ id, name, icon /* emoji */, desc, cat /* 'Arcade'|'Trí tuệ'|'Phản xạ'|'May mắn'|'IDLE'|'Thư giãn' */, dur /* '1p'|'5p'|'15p'|'∞' */,
  help: '1–3 câu cách chơi',
  score: { label:'Điểm', unit:'', better:'high'|'low' } | null,     // null = không có kỷ lục
  logic: { … },                                  // tuỳ chọn: hàm thuần của game để test bằng node; vỏ bỏ qua
  mount(host) /* dựng MỘT ván mới trong host.root */ → { pause(), resume(), destroy() } }

host = { root,                                   // <div> rỗng do vỏ cấp, đã có kích thước
  size(),                                        // {w,h} vùng chơi hiện tại (px CSS)
  setStats([{label,value}]), setScore(n),        // vỏ vẽ hàng chỉ số; chỉ gọi khi số đổi
  end({score, won, message}),                    // vỏ hiện bảng kết quả: điểm, "Kỷ lục mới", XP nhận, [Chơi lại] [Game khác]
  setInterval, setTimeout, clearInterval, clearTimeout, raf,   // vỏ tự huỷ khi destroy, tự đứng khi pause (raf nhận dt đã kẹp)
  on(el,type,fn,opts), swipe(el,cb /* 'up'|'down'|'left'|'right', ngưỡng 24px */),   // vỏ tự gỡ khi destroy
  sfx('tap'|'good'|'bad'|'win'),                 // im lặng khi tắt âm thanh
  load(), save(obj),                             // trạng thái riêng của game (idle) → state.idle[id]
  best(),                                        // kỷ lục hiện tại của game này (số) hoặc null
  saver,                                         // true = tiết kiệm pin (vỏ giới hạn raf ~30fps)
  confirm({title,body,okLabel,danger}) → Promise<boolean> }
```

**Cấm trong file game**: `window.x =`, `onclick=""`, listener trên `document`/`window`, `localStorage`, `setInterval/setTimeout/requestAnimationFrame` trần, `confirm/alert/prompt`, `<input>`, thay `innerHTML` cả khung theo timer (hãy cập nhật text node). Chơi lại = vỏ gọi `destroy()` rồi `mount()` mới. Vỏ tự bắt mọi exception trong `mount` và trong mọi callback đi qua `host` rồi hiện "Game gặp lỗi — Chơi lại / Game khác" thay vì chết app.

### Chi tiết đúng như vỏ đã cài (đọc kỹ trước khi viết game)

| Thành phần | Hành vi |
|---|---|
| `def` | `mount` bắt buộc. `name/icon/desc/dur/help` thiếu thì lấy từ `CATALOG`; **thể loại luôn lấy từ `CATALOG`** (để bộ lọc và nhiệm vụ IDLE ổn định). `help` rỗng thì ẩn nút `?`. |
| `mount(host)` | Trả `{pause, resume, destroy}`; cả ba đều không bắt buộc (không trả gì cũng được). |
| `host.root` | `div` flex cột, căn giữa dọc, `gap 12px`, cao bằng vùng chơi. Thêm phần tử của game vào đây. Vỏ tự xoá sạch khi huỷ ván. Vùng chơi có `touch-action:none` (vuốt không cuộn trang). |
| `host.size()` | Kích thước tại lúc gọi; vỏ không báo khi xoay máy — một ván dùng kích thước lúc `mount`. |
| `setStats(list)` | Thay toàn bộ mục riêng của game. Hàng chỉ số có **tối đa 4 ô** và không cuộn (các ô chia đều bề ngang, chữ quá dài bị cắt bằng "…"): nếu `def.score` khác null, vỏ tự thêm hai ô đầu "Điểm" (theo `score.label`) và "Kỷ lục" — đừng lặp lại — nên game **có `score` chỉ còn tối đa 2 mục riêng**; game `score: null` được 4. Mục thừa bị bỏ. Ở 375px mỗi ô còn khoảng 64px chữ: nhãn và giá trị nên ngắn (≤ 8 ký tự). Gọi mỗi khi số đổi; vỏ chỉ sửa text node. |
| `setScore(n)` | Điểm hiện tại (số hữu hạn). Vỏ hiện ở ô Điểm; cách dùng để lưu kỷ lục xem mục 3 "Kỷ lục". Game `better:'low'` cứ gọi thẳng khi đếm (số lượt, số bước, đồng hồ). |
| `end({score, won, message})` | Kết thúc ván: lưu kỷ lục (mục 3), **đóng băng mọi timer/raf/sự kiện của ván**, mở bảng kết quả. `score` bỏ trống thì dùng số của `setScore`. `message` làm tiêu đề; không có thì `won:true` → "Bạn thắng!", `won:false` → "Thua mất rồi", còn lại "Hết ván". Gọi lần hai bị bỏ qua. |
| `setTimeout / setInterval` | Trả id (số); `clearTimeout`/`clearInterval` dùng chung. Khi tạm dừng, thời gian còn lại được giữ và chạy tiếp khi chơi lại. Interval tối thiểu 16ms. |
| `raf(fn)` | Đăng ký **vòng lặp**: `fn(dt)` được gọi mỗi khung hình cho tới khi huỷ ván; `dt` là mili giây từ khung trước, kẹp 0–50 (khung đầu và khung sau tạm dừng = 16). Trả về hàm dừng vòng lặp. Tiết kiệm pin: ~30 khung/giây (dt ≈ 33). Viết chuyển động theo `dt`, không theo "mỗi khung". |
| `on(el, type, fn, opts)` | Chỉ nhận phần tử của game; truyền `document`/`window`/`body` sẽ ném lỗi. Sự kiện bị bỏ qua khi đang tạm dừng. Trả về hàm gỡ. |
| `swipe(el, cb)` | Dùng pointer events; `cb(dir)`. Trên máy tính, phím mũi tên cũng gọi `cb` với hướng tương ứng. |
| `sfx(name)` | Tên lạ bị bỏ qua. Chỉ kêu sau cú chạm đầu tiên của người dùng. |
| `load()` | Bản sao của `state.idle[id]` hoặc `null`. |
| `save(obj)` | `obj` phải là object phẳng, tối đa 24 khoá, mọi giá trị là **số hữu hạn ≥ 0**; sai thì ném lỗi. Mỗi lần gọi là một lần ghi localStorage — đừng gọi mỗi khung hình (IDLE: mỗi giây + khi mua + khi `pause`/`destroy`). |
| `saver` | Getter, đọc lúc cần. |
| `confirm(opts)` | Mở sheet xác nhận của vỏ; trong lúc sheet mở game bị tạm dừng (`pause()` → `resume()`). Ván bị huỷ trong lúc hỏi thì trả `false`. Lỗi ném trong `.then()`/`.catch()` nối vào promise này cũng rơi vào lớp "Game gặp lỗi" (đừng dùng `await` — lỗi sau `await` không đi qua `.then` đã bọc). |
| Tạm dừng | Khi app xuống nền (`visibilitychange` hidden), khi mở "Cách chơi", khi `host.confirm` đang mở: vỏ gọi `pause()` rồi đóng băng timer/raf; chơi tiếp thì rã băng rồi gọi `resume()`. Game dùng `host.*` thì thường để `pause/resume` rỗng. |
| Huỷ ván | Đóng game, "Chơi lại", hoặc lỗi: vỏ gọi `destroy()` (host còn dùng được trong lúc này, ví dụ `save`), rồi gỡ timer/raf/listener và xoá `host.root`. Sau đó mọi lời gọi `host.*` là vô hiệu. |

### Cách viết một game

Ví dụ chạy được (đã thử bằng cách chèn vào trang với id `tapRace`): đếm số lần chạm trong 5 giây.

```js
(window.GameHubGames = window.GameHubGames || []).push({
  id: 'tapRace', name: 'Tap Race', icon: '👆', desc: 'Chạm thật nhiều trong 10 giây', cat: 'Phản xạ', dur: '1p',
  help: 'Chạm nút lớn càng nhiều càng tốt trước khi hết giờ.',
  score: { label: 'Số lần', unit: 'lần', better: 'high' },
  mount: function(host){
    var taps = 0, left = 5, started = false;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'g-big g-fill';
    btn.textContent = 'Chạm để bắt đầu';
    var note = document.createElement('p');
    note.className = 'g-note';
    note.textContent = 'Bạn có 5 giây.';
    host.root.appendChild(btn);
    host.root.appendChild(note);
    host.setStats([{ label: 'Còn', value: left + ' giây' }]);
    host.on(btn, 'click', function(){
      if(!started){
        started = true;
        btn.textContent = 'CHẠM!';
        host.setInterval(function(){
          left--;
          host.setStats([{ label: 'Còn', value: left + ' giây' }]);
          if(left <= 0) host.end({ score: taps, message: 'Hết giờ!' });
        }, 1000);
      }
      taps++;
      host.setScore(taps);
      host.sfx('tap');
    });
    return {};   // không cần pause/resume/destroy: mọi thứ đi qua host
  }
});
```

Thêm một game IDLE chỉ là khai cấu hình trong `mini-game-hub-games-mind.js` (cùng luật với Đào mỏ):

```js
games.push(makeIdle({ id: 'idleFarm', name: 'IDLE Nông trại', icon: '🌾', desc: 'Trồng lúa, bán hàng, mở rộng', res: 'Lúa', tap: 'Thu hoạch', tool: 'Máy gặt', pet: 'Nông dân' }));
```

`makeIdle(cfg)`: `id, name, icon, desc, res` (tên tài nguyên), `tap` (chữ trên nút lớn), `tool`, `pet`, và tuỳ chọn `hire` — động từ đứng trước `pet` trên nút thuê (mặc định "Thuê"; idleSpace dùng "Lắp" robot, idleDragon dùng "Nuôi" rồng con).

Trạng thái IDLE lưu trong `state.idle[id] = {coins,lvl,power,auto,last}`; thu nhập lúc vắng mặt = `min(7200, giây kể từ last) × auto` — **trần 2 giờ**, có ghi trong `help` của mọi game IDLE.

Ba game mẫu để tham khảo: `flappy` (canvas + `raf` + `end`), `tictactoe` (lưới DOM + `setTimeout`), `idleMine` (`load/save`, `confirm`, `pause/resume`).

## 5. Vỏ — những điểm dễ làm hỏng

- **Không chặn zoom bằng `preventDefault` trên `touchend`** (bản 1.x nuốt mọi cú chạm cách nhau < 320ms). Dùng `touch-action:manipulation` trên `html`.
- **Màn game không khoá nền bằng `position:fixed`** (làm mất vị trí cuộn): `html.game-open{overflow:hidden}` + lưu/trả `scrollY`; `#app` và tab bar bị `inert` khi game mở.
- **Sheet, backdrop, toast, màn game đều `hidden` khi đóng** (lớp fixed phủ kín màn có thể nhuộm dải thanh trạng thái iOS — `LongLTV_ios-pwa-pitfalls` §17). Mở/đóng qua `openSheet`/`closeSheet`; Esc đóng lớp trên cùng rồi mới tới màn game; Tab bị giữ trong lớp trên cùng.
- **Sheet đóng trong 100ms và thôi chặn chạm ngay lúc bắt đầu đóng**: backdrop có `pointer-events:none` khi không có `.open`; nút trong sheet đang trượt xuống bị bỏ qua. Trước đây backdrop còn chặn 260ms nên sau "Chơi lại" cú chạm đầu vào game bị mất. Mở vẫn 240ms.
- **Nút của vỏ trong màn game dùng `onTap`** (đóng, ?, ↻, Chơi tiếp, nút bảng kết quả/lỗi/hướng dẫn): chạy ngay ở `touchend` rồi `preventDefault` để không có `click` thứ hai; chuột/bàn phím vẫn qua `click`. Lý do: sau một cú vuốt nhanh trong vùng chơi, Chromium coi cú chạm kế tiếp là "dừng quán tính" và không phát `click` (đo: 0/10 → 10/10). Nút do game tự dựng (`host.on(el,'click')`) không có lớp bảo vệ này. Sheet xoá dữ liệu vẫn dùng `click` + chờ 400ms.
- **Chữ trên nền thương hiệu luôn dùng `--on-brand` (#0B1020)**; chữ trắng trên gradient chỉ đạt 1,8–2,8. Theme Sunset dùng họ cam vì họ hồng-đỏ trùng màu nút xoá. Thêm theme mới phải đo lại tương phản ở cả hai đầu gradient.
- Toast nằm trên đỉnh màn hình (ở đáy nó che nút của sheet và nút điều khiển game).
- Không có `alert/confirm/prompt`, không `onclick` inline; game ném lỗi không được làm chết app.
- Không có nút đổi sáng/tối: chỉ theme tối (`color-scheme:dark`, `theme-color` = `--bg` = `#070B16`).
- Thanh cuộn ẩn bằng khối chuẩn ngay sau `html{}`; đừng "giấu" bằng `overflow:hidden`.

## 6. Class CSS dùng chung cho game

| Class | Dùng cho |
|---|---|
| `.g-grid` | Lưới ô vuông đều nhau, rộng tối đa 420px, tự căn giữa. Số cột: `style="--cols:4"` (mặc định 3). |
| `.g-tile` | Một ô của lưới (`button` hoặc `div`): vuông, tối thiểu 44px, chữ to đậm. Trạng thái: `.is-on` (nền thương hiệu), `.is-good` (xanh), `.is-bad` (đỏ), `.is-dim` (chìm). |
| `.g-btn` | Nút thường cao ≥ 52px. Biến thể `.primary` (nền thương hiệu, chữ `--on-brand`), `.danger` (chữ đỏ, cho việc xoá/làm lại). Bên trong có thể đặt `<span>Tiêu đề<small>dòng phụ</small></span>`. `disabled` có sẵn kiểu. |
| `.g-row` | Hàng nút chia đều bề ngang, cách nhau 10px, tự xuống dòng. |
| `.g-pad` | Bàn phím hướng 3×3 (ô 60px): đặt 4 `button` có `data-dir="up|left|right|down"`. |
| `.g-note` | Dòng chữ hướng dẫn/trạng thái, màu nhạt, căn giữa, giữ chỗ 2 dòng để bố cục không nhảy. |
| `.g-canvas` | `canvas`: khối, bo góc, nền tối, `touch-action:none`. Tự đặt `width/height` theo `host.size()` × `devicePixelRatio`. |
| `.g-big` | Chữ/emoji lớn căn giữa (44px). Trên `button`: nút hành động chính cỡ lớn (cao ≥ 132px, nền thương hiệu). |
| `.g-fill` | Phần tử chiếm hết chiều cao còn lại của `host.root`. |

Màu lấy từ biến CSS của theme (`--brand`, `--brand2`, `--on-brand`, `--good`, `--bad`, `--warn`, `--text`, `--muted`, `--panel`, `--panel2`, `--panel3`, `--line2`); canvas đọc bằng `getComputedStyle(host.root).getPropertyValue('--good')`. Hai bậc bo góc: `--radius` 22px, `--radius-sm` 14px.

## 7. Kiểm thử

- Fixture: `.claude/tools/fixtures/mini-game-hub.js` (seed 1.x, kết quả chuyển dữ liệu kỳ vọng, selector, `openGame/closeGame/setVisibility`).
- Core chạy được bằng node: `require('products/mini-game-hub/js/mini-game-hub-core.js')`.
- Đồng hồ chơi đếm theo nhịp interval nên `page.clock.setFixedTime` không dừng nó; muốn tua thời gian: `page.clock.install()` rồi `runFor(ms)`.
- Tab mặc định là Trang chủ; thẻ game nằm ở tab Trò chơi (`#gameGrid [data-open="<id>"]`).
- Cú chạm thật: bật `Emulation.setTouchEmulationEnabled` qua CDP rồi `Input.dispatchTouchEvent` (harness mặc định không có `hasTouch`).
- Vuốt giả lập bằng `touchMove` dồn dập (không nghỉ giữa các bước) để lại trạng thái quán tính trong Chromium: cú chạm kế tiếp có `touchend` nhưng không có `click`, kể cả chờ 1 giây. Muốn thử nút của game sau cú vuốt thì nghỉ 40ms mỗi bước.

## 8. Chưa kiểm chứng trên iPhone thật

Chromium không tái hiện được: nút của vỏ phản hồi ở `touchend` (trên iPhone có còn bị nuốt chạm sau cú vuốt không, và nút do game tự dựng có bị không), chạm nhanh liên tiếp sau khi bỏ chặn zoom (có bị double-tap zoom không), `navigator.share` với file sao lưu, âm thanh Web Audio sau cú chạm đầu, màu dải thanh trạng thái, safe-area ở đáy tab bar/màn game, vạch cuộn hệ thống. Khi cần, chụp dòng "Thông tin chẩn đoán" cuối tab Cài đặt (standalone, màn hình/viewport, safe-area, đáy tab bar, lớp phủ chạm mép trên, offline, số game, trạng thái lưu, hôm nay giờ VN).
