# LoveDays

App riêng tư đếm ngày yêu nhau của Viết Long và Minh Thư, dùng như app ở Màn hình chính trên iPhone 14 Pro Max (iOS 16.4+). Tiêu đề icon "Long & Thư". **Không công khai**: `robots.txt` chặn `/products/love-days/`, trang có `noindex,nofollow`, không có canonical, không nằm trong `sitemap.xml`, không có card trên trang chủ, README chỉ ghi trong sơ đồ cấu trúc.

Tình trạng: **Phase 1A + 1B + 2** (đếm ngày, kỷ niệm, hồ sơ + ảnh đại diện/ảnh bìa, badge khi mở, album ảnh, sao lưu/nhập ZIP, thông báo đẩy hằng ngày từ GitHub Actions). Thông báo chỉ chạy sau khi người dùng làm các bước cài đặt một lần (Cài đặt → nhóm "Thông báo" → "Cách cài đặt (làm một lần)").

## Cấu trúc đặc thù

- Toàn bộ dữ liệu nằm trong **IndexedDB trên máy** (không localStorage, không server, không Gist). App ở Màn hình chính có bộ nhớ riêng tách với Safari; xoá icon = mất dữ liệu → màn hình đầu và tab Cài đặt đều nói rõ điều này.
- Script nạp theo thứ tự: `love-days-core.js` → `love-days-media.js` → `love-days-backup.js` → `love-days-share.js` → `love-days.js`. `love-days-backup.js` (`self.LoveBackup`) chứa ZIP + xuất/nhập; giao diện sao lưu nằm trong `love-days.js`.
- `js/love-days-core.js` là **classic script dùng chung cho trang và service worker** (`sw-core.js` `importScripts` nó), lộ ra `self.LoveCore`. Không được dùng ES module, DOM hay `window` trong file này.
- Service worker: vỏ `sw-love-days.js` nằm thẳng trong `products/love-days/` (scope), logic ở `js/sw-core.js`, `CACHE_NAME` tiền tố `lovedays-cache-`, đăng ký bằng đường dẫn tuyệt đối. Bump `CACHE_NAME` thì bump luôn `?v=` ở vỏ **và** `?v=` của `love-days-core.js` trong `sw-core.js`. Cache được khoá theo **đường dẫn chuẩn, bỏ query** (link chia sẻ kiểu `index.html?fbclid=…` vẫn mở được khi offline), và URL thư mục `/products/love-days/html/` được coi là `html/index.html`.

## Bố cục phần đầu trang

- **Không có hàng tiêu đề/thương hiệu.** Trang chỉ có `<h1 class="sr-only">Long & Thư</h1>` cho trình đọc màn hình; Trang chủ mở đầu bằng hero, các tab khác bằng `.view-title` của chính nó. (Hàng "Long & Thư" + huy hiệu phiên bản cũ chiếm 58pt và lặp với dòng tên trong hero — bỏ từ v1.7.)
- **Hero** (cuộn theo trang, không sticky): ảnh bìa `.cover` cao 128px; hai `.avatar` 72px có `margin-top:-36px` nên **tâm avatar nằm đúng mép dưới ảnh bìa**; `.heart-beat` là chip tròn 36px nền `--card`, căn giữa theo trục avatar và đè 8px vào mỗi avatar (hai avatar cách nhau 20px). Dòng tên dùng `&` màu `--muted` (trái tim duy nhất là chip), tối đa 2 dòng: mỗi tên tự cắt "…" trên một dòng riêng khi quá dài, để tên thứ nhất dài không đẩy mất tên thứ hai.
- **Phiên bản** nằm ở Cài đặt → thẻ "Thông tin": nút cả hàng `#btnVersion` ("Lịch sử cập nhật" + `#versionText`) mở sheet `#versionSheet`.
- **Lớp phủ đóng thì `display:none`**: `#sheetBackdrop` và `#dpBackdrop` mang thuộc tính `hidden` khi không mở gì; chỉ bật/tắt qua `showBackdrop(el)` / `hideBackdrop(el)` trong `love-days.js` (ẩn sau 260ms bằng `setTimeout`, không dùng `transitionend` vì `prefers-reduced-motion` tắt transition) — đừng thêm/gỡ `.open` trực tiếp. Lý do: ảnh chụp iPhone 14 Pro Max (app Màn hình chính) cho thấy dải thanh trạng thái có màu xám-nâu ~`#9A8D92`, gần đúng `rgba(40,8,22,.45)` của backdrop phủ lên `#FFF5F7`; **giả thuyết** là iOS lấy màu dải trên cùng từ `background-color` của phần tử `position:fixed` chạm mép trên, kể cả khi `opacity:0`. Cùng lý do đó, lớp nền đầu tiên của `body` là `linear-gradient(to bottom, var(--bg), transparent 120px)` để mép trên trang đúng bằng `--bg`. **Chưa kiểm chứng trên máy thật** — nếu dải trên vẫn lệch màu thì giả thuyết sai, cần tìm tiếp. Quy tắc đi kèm: không để phần tử `position:fixed` nào có nền, `top ≤ 0`, mà vẫn `display` khác `none` khi không mở gì.

## Quy ước đếm ngày (giờ Việt Nam, không phụ thuộc múi giờ máy)

```
VN = 7h; DAY = 86400000
dayIdx('Y-M-D') = Date.UTC(Y, M-1, D) / DAY
todayIdx(now)   = floor((now + VN) / DAY)
N               = todayIdx(now) - dayIdx(start) + 1      // ngày bắt đầu = ngày 1
hours           = floor((now - (Date.UTC(start) - VN)) / 3600000)
```
- Không bao giờ `new Date('YYYY-MM-DD')`, `getDate()`, `getFullYear()`, `toLocaleDateString()` không có `timeZone` — các hàm này theo múi giờ máy, ra nước ngoài sẽ lệch 1 ngày (Bogota thấy 961, Tokyo thấy 963).
- "đã trôi qua X năm Y tháng Z ngày" = thời gian trôi qua từ 00:00 (+07) ngày bắt đầu (KHÔNG +1). Số tháng = k lớn nhất mà `addMonthsClamp(start, k) ≤ hôm nay`, luôn kẹp từ ngày gốc (31/01 → 28/02 → 31/03).
- Mốc tự động, mỗi loại chỉ hiện lần kế tiếp: "Ngày thứ K" (K bội số 100) = start + (K−1) ngày; kỷ niệm n năm (29/02 → 28/02 năm không nhuận); sinh nhật hai người (nếu có ngày sinh). Kỷ niệm riêng "Lặp lại hằng năm" → lần kế tiếp; một lần đã qua → "đã qua X ngày", xếp cuối danh sách.
- Kịch bản + số kỳ vọng chuẩn: `.claude/tools/fixtures/love-days.js`.

## IndexedDB `love-days` (DB_VERSION 1)

| Store | keyPath | Nội dung |
|---|---|---|
| `kv` | `key` | `profile` {startDate, persons[2]{id,name,dob}, hasCover, activeGen, updatedAt}; `meta` {schemaVersion, lastBackupAt, albumSort, showCycle, cycleRemind, cycleRemindQuiet} (riêng từng máy, **không** nằm trong bản sao lưu; bảng dưới); `push` {deviceLabel, lastCopiedEndpointHash} (xem Thông báo đẩy); `cycles` {items:[{id, start, end: ngày hoặc null, note, createdAt}], updatedAt} (xem Chu kỳ) |
| `milestones` | `id` | {id, title, date, emoji, note, repeatYearly, createdAt} |
| `photos` | `id` | {id, gen, caption, takenAt: ms hoặc null, addedAt, order, w, h, bytes, sha256}; index `gen`/`takenAt`/`addedAt`/`order` |
| `blobs` | `id` | {id, gen, mime, data: **ArrayBuffer**, thumb}; id `avatar-long`, `avatar-thu`, `cover`, hoặc id ảnh |

`kv.meta` — `loadAll` chỉ chép từng khoá đã biết và kiểm kiểu; giá trị thiếu/sai dùng mặc định; `saveMeta()` ghi cả bản ghi:

| Khoá | Giá trị | Mặc định | Ai đọc |
|---|---|---|---|
| `lastBackupAt` | ms hoặc null | null | thẻ Sao lưu |
| `albumSort` | `taken` \| `added` \| `custom` | `taken` | Album |
| `showCycle` | boolean | true | thẻ Chu kỳ ở Trang chủ |
| `cycleRemind` | `0` (tắt) \| `1` \| `2` \| `3` \| `5` ngày | `2` | trang (Cài đặt → Chu kỳ, "Gửi thử") **và service worker** lúc nhận push |
| `cycleRemindQuiet` | boolean — nhắc kín, không ghi chữ "kỳ" | true | như trên |

- Lưu ArrayBuffer, không lưu Blob (lịch sử lỗi Blob-trong-IDB của WebKit).
- Đổi schema: tăng `DB_VERSION`, thêm `case` trong `upgrade(db, oldVersion)` (switch rơi xuyên, không `break`).
- **Không bao giờ treo**: `openDb()` timeout 5s / `onblocked` / trình duyệt từ chối → hiện màn "không đọc được" giống mục dưới (banner đỏ nêu lý do + nút "Tải lại app"), **không** hiện màn nhập ngày: lúc đó không phân biệt được lần đầu dùng với "có dữ liệu nhưng đang bị khoá", và nhập vào bộ nhớ tạm sẽ mất khi đóng app. "Chuẩn bị bản sao lưu" cũng từ chối khi không có IndexedDB, để không tạo ra một file sao lưu trống trông như thật. Mọi bản ghi đọc lên đều qua validator; bản ghi hỏng bị bỏ qua + banner "Bỏ qua N mục hỏng". `startDate` hỏng hoặc sau hôm nay → về màn hình nhập ngày, **không xoá gì**.
- **Đọc lỗi khác với "chưa có dữ liệu"**: nếu việc đọc `profile`/`milestones`/`photos`/`meta` bị lỗi (không phải trả về rỗng), app KHÔNG hiện màn hình nhập ngày (lưu ở đó sẽ ghi đè hồ sơ thật) mà chỉ hiện banner đỏ "Không đọc được dữ liệu đã lưu…" kèm nút "Tải lại app"; `saveProfile` và nhập bản sao lưu đều bị chặn. Chỉ ảnh đại diện/ảnh bìa được phép đọc lỗi mềm.
- `validateProfile` thay `activeGen` hỏng bằng `"g1"` chỉ để hiển thị, kèm `activeGenOk:false` và `rawActiveGen` (giá trị gốc). **Không bao giờ lọc/xoá theo giá trị mặc định đó.** Mọi lần ghi profile (lưu hồ sơ, ảnh bìa, nhập) và gen gắn cho ảnh mới đi qua `LoveCore.genForWrite(profile, photos)`: gen hợp lệ → giữ; gen hỏng → ghi lại nguyên giá trị gốc (lọc theo gen tiếp tục tắt, ảnh cũ vẫn hiện); chưa có profile → gen chung của các ảnh đang có, `"g1"` nếu chưa có ảnh, `null` nếu lẫn nhiều gen. Thay thế (nhập) xoá hết ảnh cũ nên dùng `"g1"`.
- Mỗi lần mở: `cleanupGenerations()` xoá (a) photos có `gen` khác `profile.activeGen` — chỉ khi `activeGenOk`, nếu không thì bỏ bước này; (b) **blob ảnh album không còn bản ghi photos nào** (rác của lần nhập dở dang). Blob `avatar-long`/`avatar-thu`/`cover` không bao giờ bị dọn ở đây.
- Ảnh: đại diện cắt vuông 512px JPEG 0.85, ảnh bìa cạnh dài 1600px JPEG 0.82. Giải mã bằng `createImageBitmap` (fallback `<img>.decode()`), **xử lý tuần tự** và giải phóng bitmap/canvas ngay (ảnh 48MP ≈ 195MB khi giải mã).

## Album

- Thêm ảnh (`accept="image/*" multiple`): đọc EXIF `DateTimeOriginal` từ **byte gốc** (256KB đầu file, trước khi vẽ canvas — canvas xoá EXIF); có `OffsetTimeOriginal` thì dùng múi giờ đó, không có thì coi là giờ VN; không có EXIF → `takenAt = null`. Không dùng `file.lastModified`.
- Một lần giải mã → ảnh cạnh dài 1600px JPEG 0.82 + thumbnail cạnh dài 480px JPEG 0.75 (vẽ từ canvas 1600 để nhả bitmap gốc sớm), `sha256` (crypto.subtle) của JPEG đã lưu. Xử lý tuần tự; mỗi ảnh ghi photos + blobs trong **một** transaction. Ảnh trùng sha256 với ảnh đã có → bỏ qua. Không giải mã được (HEIC…) → báo tên file, làm tiếp ảnh khác. `QuotaExceededError` → dừng, báo "đã lưu X/Y".
- Xoay ảnh: dựa vào trình duyệt tự xoay theo EXIF (`createImageBitmap(..., {imageOrientation:'from-image'})`). Ảnh 4000×3000 Orientation=6 lưu thành 1200×1600 (đã kiểm trên Chromium).
- Sắp xếp (lưu trong `kv.meta.albumSort`): **Ngày chụp** cũ → mới (không có EXIF thì theo ngày thêm); **Ngày thêm** mới → cũ; **Tuỳ chỉnh** theo `order`. Nút "Sắp xếp" chỉ hiện ở Tuỳ chỉnh: mỗi ô có ‹ › (đổi chỗ với ảnh trước/sau) và "Lên đầu", đều ≥44px; ghi lại `order` 0..n-1 cho các ảnh bị đổi trong một transaction.
- Lưới: thumbnail lấy từ `blobs.thumb` qua object URL, nạp lười bằng IntersectionObserver; rời tab Album thì revoke hết.
- Xem ảnh: lớp phủ `position:fixed; inset:0` ngay trên album (không đổi trang). Khoá cuộn bằng `body{position:fixed; top:-scrollY}` và trả lại đúng `scrollY` khi đóng (không dùng `overflow:hidden` trên html). Vuốt ngang ≥50px, nút ‹ ›, phím ←/→/Esc, nạp trước ảnh bên cạnh, chỉ giữ object URL của ảnh hiện tại ± 1, revoke hết khi đóng. Sửa chú thích tại chỗ (≤200 ký tự), xoá có xác nhận (xoá photos + blob cùng transaction).

## Chu kỳ

**Từ v1.10 Chu kỳ là một TAB riêng** (`#tab-cycle`, nút thứ ba trên tab bar, 5 tab): `#cycleList` nằm trong tab và do `renderCycleSheet()` dựng (tên hàm giữ từ thời còn là sheet) — dự đoán kỳ tới, dòng "Có thể rơi vào dd/mm – dd/mm/yyyy" (kỳ gần nhất + khoảng cách nhỏ nhất/lớn nhất trong các khoảng đang dùng để tính trung bình, chỉ hiện khi có ≥2 khoảng khác nhau), trung bình, nút "Bắt đầu/Kết thúc hôm nay" (`data-cy="quick"`, chung hàm `cycleQuickAct` với nút ở thẻ Trang chủ), "Thêm kỳ đã qua", biểu đồ cột khoảng cách 12 kỳ gần nhất (`cycleChartHtml`, nét đứt = trung bình, cột nhạt = không tính trung bình) và danh sách các kỳ. Sheet `#cycleSheet` chỉ còn form thêm/sửa; lưu/xoá xong thì đóng sheet và dựng lại tab. Thẻ ở Trang chủ chạm vào là sang tab. `.sheet-head` là `position:sticky` nên tiêu đề + nút đóng của mọi sheet luôn hiện khi cuộn.

Sổ ghi kỳ kinh: thẻ "Chu kỳ" cuối Trang chủ (ẩn được bằng công tắc ở Cài đặt → Chu kỳ, lưu `kv.meta.showCycle`, mặc định bật; "Mở tab Chu kỳ" ở đó vẫn vào được khi thẻ ẩn), tab Chu kỳ, và sheet `#cycleSheet` chứa form tĩnh `#cycleForm`.

### Lịch tháng (v1.11)

`#cycleCal` nằm trong `#cycleList`, sau các nút nhanh và trước biểu đồ (cả khi chưa ghi kỳ nào; **không vẽ** khi `cyclesBroken`). Trạng thái cấp module `cal = { ym, sel }`: `ym` là tháng đang xem (`null` = đi theo tháng của hôm nay), `sel` là ngày đang chạm — nằm ngoài hàm dựng nên sang ngày hoặc sau khi ghi, `renderCycleSheet()` vẫn giữ tháng đang xem. Đổi tháng chỉ dựng lại `#cycleCal` (`renderCal`); chạm một ngày chỉ đổi `aria-pressed` và `#calInfo`.

- Lưới: `LoveCore.monthGrid(y, m)` — tuần bắt đầu **Thứ hai**, luôn 35 hoặc 42 ô (`lead = (dayIdx(ngày 1) + 3) mod 7`; 01/10/2026 là Thứ năm → lead 3 → ô đầu 28/09). Ô ngoài tháng mờ nhưng vẫn mang dấu.
- Luật tô: `LoveCore.cycleDayMarks(st, hôm nay, isLong)` trả map ngày → `{period, open, predicted, range}`:
  - kỳ có ngày kết thúc: `start … end`;
  - kỳ cuối chưa kết thúc và còn "đang trong kỳ" (≤ 10 ngày): `start … hôm nay`;
  - kỳ chưa kết thúc đã quá 10 ngày (hoặc không phải kỳ cuối): chỉ ngày `start`;
  - `predicted` = `st.next`; `range` = `nextMin … nextMax`; cả hai bị bỏ khi `cycleView` là `long` (giao diện lúc đó không hiện dự đoán).
- Mỗi trạng thái khác nhau bằng **hình**, không chỉ màu: đã ghi = nền đặc `--accent` + chữ `--accent-ink` (tương phản đo được 5,87 sáng / 7,85 tối); dự đoán = viền đứt 2px + chấm tròn dưới số; có thể rơi vào = nền `--accent-soft` + gạch chấm dưới số; hôm nay = viền liền `--text` + chữ đậm; ngày đang chạm = vòng kép màu accent. Ngày thuộc kỳ đã ghi thì không vẽ thêm dấu dự đoán. Chú thích dưới lưới dùng lại đúng các ô mẫu đó.
- Đổi tháng: nút ‹ › (44px), chip "Hôm nay" (chỉ hiện khi đang xem tháng khác), vuốt ngang ≥ 50px trên lưới (`touch-action:pan-y`; **không** `setPointerCapture` — bắt con trỏ sẽ làm cú chạm thường không còn rơi vào ô ngày). Giới hạn: 2000-01 → tháng của `max(hôm nay, nextMax || next)` + 1.
- `#calInfo` (`role="status"`): dòng ngày đang chạm + một câu (`calDayInfo`): thuộc kỳ → "Kỳ 11/08 – 13/08/2026 · ngày thứ 2" (+ "· chưa ghi ngày kết thúc"); "Dự đoán kỳ tới"; "Có thể rơi vào 24/09 – 08/10/2026"; "Ngày thứ 10 kể từ kỳ 11/08"; "Chưa ghi kỳ nào trước ngày này"; tương lai → "Chưa tới ngày này". Tối đa một nút:
  - ngày ≤ hôm nay, không thuộc kỳ nào → "Ghi kỳ bắt đầu ngày này" (`data-cy="add-on"`) mở form thêm với ngày bắt đầu điền sẵn;
  - ngày nằm trong `start+1 … start+9` của một kỳ chưa kết thúc và ≤ hôm nay → "Ghi ngày kết thúc ngày này" (`data-cy="end-on"`) mở form sửa kỳ đó với ngày kết thúc điền sẵn (thay cho nút thêm: thêm kỳ ở đó chắc chắn dính `openOverlap`).
  Cả hai chỉ **mở form** — việc ghi vẫn qua nút Lưu và `cycleConflict` như mọi đường khác; lỗi hiện tại ô.
- Lịch nằm trong tab chứ không trong sheet, nên sang ngày chỉ dựng lại lịch phía sau; form đang mở giữ nguyên chữ.

### Nhắc trước kỳ (v1.11)

Không có lượt gửi riêng và **không đổi gì ở server**: câu nhắc là dòng thứ hai của chính thông báo mỗi sáng, do service worker tự tính trên máy lúc nhận push.

- Cài đặt → Chu kỳ: "Nhắc trước kỳ" Tắt / 1 / 2 / 3 / 5 ngày (`kv.meta.cycleRemind`, mặc định 2) và công tắc "Nhắc kín" (`cycleRemindQuiet`, mặc định bật). Dòng xem trước ghi đúng chuỗi sẽ hiện.
- `LoveCore.cycleReminder(items thô, now, days)` → `null` hoặc `{daysLeft, next}`: tự lọc qua `validateCycle` + bỏ id trùng, `null` khi `days` ngoài {1,2,3,5}, không có kỳ, đang trong kỳ, đã trễ (`daysLeft < 0`) hoặc còn xa hơn `days`. Không bao giờ ném lỗi. Trong khoảng nhắc thì **ngày nào cũng nhắc** (đặt 2 ngày → nhắc lúc còn 2, còn 1 và đúng ngày).
- `LoveCore.reminderLine(r, quiet)`: kín `🌸 còn 2 ngày` / `🌸 hôm nay`; đầy đủ `🌸 Kỳ tới dự kiến còn 2 ngày` / `🌸 Kỳ tới dự kiến hôm nay`.
- Nút "Gửi thử trên máy này" nối thêm dòng nhắc theo lựa chọn hiện tại (khi không Tắt) — cách duy nhất xem nó trên máy thật mà không chờ đúng ngày.
- **Giới hạn** (phải nói với người dùng khi được hỏi): chỉ nhắc vào giờ thông báo sáng (06:17–11:17, một lần/ngày); chỉ trên máy **có sổ chu kỳ** và **đã bật thông báo** — sổ không đồng bộ nên máy kia không nhắc trừ khi đã nhập bản sao lưu; cài đặt nhắc cũng riêng từng máy; hôm nào workflow không gửi được thì hôm đó không nhắc; máy chưa có ngày bắt đầu trong IndexedDB (thông báo dựng từ payload) thì không nhắc. **Chưa kiểm chứng trên iPhone thật** việc thân thông báo hiện xuống dòng và ký tự 🌸 ở màn hình khoá.

- **Lưu**: cả sổ là MỘT bản ghi `kv` khoá `cycles` (không nâng `DB_VERSION`). Vì mỗi lần ghi là ghi cả mảng: mục không qua `validateCycle` được giữ nguyên văn trong `state.cyclesBad` và nối lại vào `items` ở mọi lần ghi (kể cả khi nhập bản sao lưu); bản ghi tồn tại mà `items` không phải mảng → `state.cyclesBroken`: thẻ và sổ báo "Không đọc được dữ liệu chu kỳ — dữ liệu vẫn còn nguyên", mọi đường ghi bị khoá, bản sao lưu bỏ hẳn khoá `cycles`, nhập cũng không đè. Mục có `id` trùng với một mục đứng trước trong mảng cũng bị coi là mục hỏng (sửa "kỳ đó" sẽ xoá mất kỳ sinh đôi). **Mục hỏng (`cyclesBad`) không đi theo bản sao lưu** — chỉ nằm lại trong bản ghi trên máy. Mọi lần ghi đi qua `saveCycles()` (ghi xong mới gán `state.cycles`); cờ `cyc.saving` chặn bấm đúp, và `cycleWrite` gọi nó bên trong một `then()` để lỗi ném đồng bộ (`db.transaction` trên kết nối đang đóng) cũng nhả nút.
- **Hai cửa sổ**: `updatedAt` của bản ghi là dấu (`state.cyclesStamp`, đặt mỗi lần nạp/ghi; hai lần ghi trong cùng mili-giây vẫn ra dấu khác nhau). `saveCycles` đọc lại bản ghi **trong chính transaction ghi**; dấu khác với lúc nạp → không ghi gì, nạp sổ mới từ DB vào `state`, dựng lại thẻ/danh sách và báo "Sổ vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại." (form đang mở giữ nguyên chữ; bấm Lưu lần nữa là được). Bước nhập bản sao lưu cũng ghi một dấu mới.
- Sau mỗi lần ghi thành công, mọi cú chạm trong thẻ và trong sổ bị bỏ qua 400ms (`cyc.quiet`): bố cục vừa dịch dưới ngón tay, cú chạm thứ hai của một lần chạm đúp không được rơi vào nút/hàng vừa trượt tới.
- **Tính toán** nằm trong `love-days-core.js` (thuần, không DOM), mọi ngày theo giờ VN:

```
khoảng cách[i] = dayIdx(start[i]) − dayIdx(start[i−1])        // sắp theo start
hợp lệ khi 15 ≤ khoảng cách ≤ 90 (CYCLE_MIN/CYCLE_MAX; từ v1.10 nới từ 60 lên 90 vì chu kỳ thật của người dùng dài 44–58 ngày); ngoài khoảng đó thì không tính vào trung bình
lấy các khoảng hợp lệ TRƯỚC, rồi 6 cái gần nhất (CYCLE_AVG_N): n, sum
chu kỳ trung bình (hiển thị) = sum / n, một chữ số thập phân
cycleLen = n ? floor((2·sum + n) / (2·n)) : 28                // làm tròn nửa lên; 28 = CYCLE_DEFAULT khi chưa có khoảng hợp lệ
kỳ tới = start kỳ cuối + cycleLen;  còn = dayIdx(kỳ tới) − hôm nay
số ngày mỗi kỳ = trung bình (end − start + 1) của 6 kỳ gần nhất có end
đang trong kỳ: hôm nay ≤ end kỳ cuối; hoặc kỳ cuối chưa có end và hôm nay − start + 1 ≤ 10 (CYCLE_OPEN_MAX)
```
- **Câu trạng thái**: đang trong kỳ → "Ngày thứ N của kỳ"; còn > 0 → "Còn N ngày"; = 0 → "Dự kiến hôm nay"; < 0 và cách kỳ cuối ≤ max(90, 2 × chu kỳ làm tròn) → "Trễ N ngày" (v1.10: trước đây cắt cứng ở 60 ngày nên người có chu kỳ ~48 ngày bị ẩn mất dự đoán); > 60 → "Đã N ngày từ kỳ gần nhất" (khi đó cả thẻ lẫn dòng đầu của sổ đổi thành "Kỳ gần nhất" + ngày kỳ gần nhất + "N ngày trước", không hiện ngày dự kiến đã qua). Khoảng cách ngoài 15–60 ngày ghi "N ngày · không tính trung bình" (không dùng chữ "bất thường"). Trên thẻ câu này nằm trong `aria-label` của `#cycleOpen` (phần nhìn thấy là số lớn + đơn vị, hoặc huy hiệu "Trễ N ngày"); trong sổ nó là huy hiệu cạnh "Kỳ tới dự kiến".
- **Ràng buộc** (`cycleConflict`, dùng chung cho form, nút nhanh, gộp và đọc bản sao lưu): không ngày tương lai ("Chưa ghi được ngày ở tương lai"), end ≥ start, một kỳ ≤ 31 ngày, không hai kỳ cùng ngày bắt đầu, không chồng nhau, tối đa 600 kỳ. **Kỳ chưa có ngày kết thúc chiếm `start … start + 9`** (10 ngày, `CYCLE_OPEN_MAX` — đúng khoảng mà `cycleStats` coi là "đang trong kỳ"), xét ở cả hai chiều: mã `openOverlap`. Kỳ khác chưa kết thúc → lỗi ở ô bắt đầu (và trên thẻ khi bấm "Bắt đầu hôm nay"): "Kỳ 25/09/2026 chưa ghi ngày kết thúc — hãy ghi ngày kết thúc cho kỳ đó trước."; chính kỳ đang nhập chưa kết thúc mà sát kỳ sau (`self: true`) → lỗi ở ô kết thúc: "Kỳ này cách kỳ … chưa tới 10 ngày — hãy ghi ngày kết thúc.". Lỗi hiện ngay dưới ô sai; khi end < start, câu lỗi nằm ở ô người dùng vừa đổi (đổi ngày bắt đầu → "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc"). Sửa mà không đổi ngày (chỉ ghi chú) thì không kiểm lại, để bản ghi vốn đã lệch vẫn sửa được.
- Nút nhanh trên thẻ: "Bắt đầu hôm nay" ghi ngay một kỳ mới; "Kết thúc hôm nay" khi kỳ cuối chưa có end và đang trong kỳ; ẩn khi hôm nay ≤ end kỳ cuối. "Hôm nay" lấy tại lúc bấm.
- Xoá kỳ: hàng xác nhận ngay trong sheet (nút đỏ đặc "Xoá" + "Giữ lại"), không dùng `window.confirm`.
- Đồng hồ qua ngày mới: thẻ và nửa danh sách của sổ tự dựng lại; **form đang mở không bao giờ bị đụng** (kể cả `visibilitychange`).
- **Không đồng bộ giữa hai máy.** Muốn chuyển sổ sang máy kia: xuất bản sao lưu rồi nhập ở chế độ Gộp.

## Ảnh chia sẻ (v1.12)

Một tấm JPEG 1080×1350 (bài đăng 4:5) hoặc 1080×1920 (story 9:16) vẽ bằng canvas từ thứ đang có sẵn trong bộ nhớ trang (`state.blobs`, `state.computed`). **Không ghi gì vào IndexedDB, không gọi `dataChanged()`**; ảnh tạo ra không được lưu lại ở đâu trong app.

- Điểm vào: nút icon `#btnShare` ở góc trái trên thẻ đếm ngày (chế độ `days`); mỗi hàng mốc tự sinh ở tab Kỷ niệm là `<button class="ms-item auto">` (chế độ `milestone`); nút `#msShare` "Tạo ảnh chia sẻ" trong form sửa một kỷ niệm đã lưu — dùng **bản ghi đã lưu**, nếu form đang có chỗ chưa lưu thì báo "Hãy lưu kỷ niệm trước rồi tạo ảnh." và không đóng form.
- `js/love-days-share.js` (`self.LoveShare`, không trạng thái):
  - `plan(opts, measure)` — thuần, quyết định **mọi** chuỗi và toạ độ: `{ w, h, template, size, mode, bg, shades, hearts, chips, images: [{ id, box, shape, has, fill, ring }], texts: [{ role, text, x, y, size, weight, align, baseline, maxWidth, color, width }] }`. `measure(text, size, weight)` đo bề ngang; trang luôn truyền `LoveShare.measurer(fontFamily)` (đo bằng canvas), bỏ trống thì dùng ước lượng không cần DOM. Test so chữ qua `texts` vì không đọc ngược được chữ từ ảnh.
  - `render(plan, sources, fontFamily)` → `Promise<Blob>` JPEG 0.9, chỉ vẽ đúng `plan`. `sources = { cover, avatarLong, avatarThu }` là ArrayBuffer của chính trang (canvas không bị tainted). Giải mã **từng ảnh một** bằng `LoveMedia.decode`, vẽ xong nhả bitmap ngay; xong thì `canvas.width = 0`. Ảnh giải mã lỗi → vẽ nền gradient thay thế, không hỏng cả tấm.
- Ba mẫu: **Ảnh bìa** (ảnh bìa phủ kín + dải tối phía dưới cho chữ trắng; chưa có ảnh bìa → gradient hồng), **Thiệp** (nền hồng nhạt, ảnh bìa 4:3 bo góc, avatar đè mép dưới ảnh, số màu `#C2185B`), **Tối giản** (gradient `#E8507F → #C2185B`). Mặc định lần mở đầu: có ảnh bìa → Ảnh bìa, chưa có → Tối giản; lựa chọn mẫu/khổ giữ trong phiên (không lưu). Chưa có avatar → vòng tròn chữ cái đầu như ở Trang chủ. Trái tim vẽ bằng `Path2D` (không phụ thuộc phông emoji); emoji của kỷ niệm nằm trên một đĩa trắng (💯 đỏ chìm trên nền hồng).
- Chữ: `days` → số, "ngày bên nhau", "A & B", "Từ dd/mm/yyyy". `milestone` → emoji, tiêu đề (tối đa 2 dòng, co chữ rồi cắt "…"), "Thứ …, dd/mm/yyyy", "Ngày thứ X bên nhau" với `X = dayIdx(ngày) − dayIdx(bắt đầu) + 1` (bỏ khi X < 1, và bỏ ở mốc "Ngày thứ K" vì tiêu đề đã nói), tên. Kỷ niệm người dùng dùng **ngày đã lưu**, không phải lần lặp kế tiếp. Dòng tên co cỡ chữ tới 70% rồi cắt bớt tên dài hơn bằng `clipGraphemes`.
- **User activation**: `renderShare()` dựng blob + `File` xong mới bật nút "Lưu / Chia sẻ ảnh"; cú chạm gọi thẳng `shareFile()` (dùng chung với sao lưu) → `navigator.share({files})`, không `await` gì trước đó; không có share thì tải xuống. Đổi mẫu/khổ → nút khoá lại tới khi vẽ xong; `share.seq` loại kết quả của lượt vẽ cũ.
- Đóng sheet (`closeSheets`) → `resetShare()`: revoke URL xem trước, bỏ blob. `File` đã đưa cho bảng chia sẻ là đối tượng riêng, không bị ảnh hưởng. Sang ngày khi sheet đang mở → vẽ lại (số ngày, `alt`, tên file đổi theo). Đang thêm ảnh / sao lưu / nhập (`busy`) → không vẽ, báo "Đang xử lý việc khác — đợi xong rồi thử lại."
- Tên file ASCII: `long-thu-<N>-ngay.jpg`, `long-thu-ky-niem.jpg`.
- **Giới hạn**: phông trên canvas là phông hệ thống của máy (iPhone: `ui-rounded`; nếu canvas không nhận từ khoá này sẽ rơi về San Francisco thường); emoji do máy vẽ nên mỗi máy một kiểu; ảnh bìa lưu tối đa 1600px nên ở khổ story bị phóng ~1,6 lần và cắt hai bên; chữ ở mẫu Ảnh bìa luôn nằm nửa dưới — ảnh bìa có mặt người ở nửa dưới sẽ bị chữ đè. **Chưa kiểm chứng trên iPhone thật**: bảng chia sẻ có mục "Lưu hình ảnh" cho file JPEG này không, `ui-rounded` trên canvas, emoji cỡ lớn.

## Sao lưu (ZIP STORE)

File `love-days-backup-YYYY-MM-DD.zip` (ngày VN), không nén (method 0), không zip64 (tối đa 4 GB), tối đa **10.000 ảnh, 2.000 kỷ niệm và 600 kỳ** — cùng một giới hạn cho xuất và nhập, để app không bao giờ tạo ra file mà chính nó từ chối đọc (10.000 ảnh 1600px đã chạm trần 4 GB). Vượt giới hạn → báo lỗi ngay khi bấm "Chuẩn bị bản sao lưu". Tên mục ASCII:

```
photos/<id>.jpg ...        ảnh album (JPEG 1600px, không kèm thumbnail — tạo lại khi nhập)
avatars/long.jpg, avatars/thu.jpg, cover.jpg   chỉ những ảnh đang có
love-days.json             {app:'love-days', format:1, exportedAt (ISO),
                            profile:{startDate, persons[2]{id,name,dob}, hasCover},
                            milestones:[...], photos:[{id, caption, takenAt, addedAt, order, w, h, bytes, sha256, file}],
                            images:{'avatar-long':'avatars/long.jpg', ...},
                            cycles:[{id, start, end, note, createdAt}]}   (từ v1.8; vẫn format 1 — app cũ bỏ qua khoá lạ nên đọc được file mới)
```

- **Lưu hai bước**: "Chuẩn bị bản sao lưu" dựng file → "Lưu file (xx MB)" gọi `navigator.share({files})` **ngay trong cú chạm** khi `canShare` (iPhone: "Lưu vào Tệp"), nếu không thì `a.download` + revoke sau 10s. Safari mất "user activation" sau await dài → share ném `NotAllowedError`, nên không gộp hai bước. Mọi thay đổi dữ liệu làm file đã chuẩn bị hết hiệu lực. Lưu xong ghi `kv.meta.lastBackupAt`; thẻ Sao lưu hiện "Lần cuối: hôm nay, 21:30" / "Lần cuối: 31 ngày trước (01/09/2026)" (đếm theo ngày lịch VN), tô màu cảnh báo khi chưa sao lưu lần nào hoặc đã ≥ 30 ngày.
- **Đọc**: chỉ nhận đúng định dạng do app tạo — EOCD nằm ở đúng 22 byte cuối (không comment), 1 đĩa, method 0, không mã hoá/data descriptor, csize = usize, tên mục chỉ gồm chữ/số/`_`/`-`/`.`/`/` và không có `..`, offset nằm trong file. Từng mục được đọc bằng `file.slice().arrayBuffer()`, kiểm CRC32 + đầu JPEG `FF D8 FF`, sha256 khớp manifest.
- **Kiểm tra trước khi ghi**: app/format, ngày thật (không chỉ regex) và không sau hôm nay, độ dài chuỗi, id `^[\w-]+$`, không trùng id, mọi ảnh được tham chiếu phải có trong ZIP; chạy thử `LoveCore.computeAll()` trên dữ liệu mới. File bị từ chối → thông báo tiếng Việt, dữ liệu không đổi. Lỗi CRC của một ảnh chỉ lộ ra lúc đọc ảnh đó (sau khi bấm Nhập) — vẫn huỷ sạch.

### Nhập: Gộp (mặc định) / Thay thế

- **Gộp**: ảnh trùng sha256 với ảnh đang có → giữ ảnh đang có, bỏ ảnh trong file; kỷ niệm trùng id → giữ bản đang có; hồ sơ giữ nguyên trừ khi máy chưa có hồ sơ hợp lệ; ảnh đại diện/ảnh bìa chỉ lấy từ file khi máy chưa có. Ảnh mới xếp sau ảnh hiện có trong thứ tự Tuỳ chỉnh.
- **Chu kỳ** (`planCycles` trong `love-days-backup.js`, ghi trong chính transaction cuối):
  - **Xuất không bao giờ bị sổ chu kỳ chặn**: mọi kỳ đã qua `validateCycle` đều được ghi ra, kể cả khi trong sổ có hai kỳ trùng/chồng nhau (chỉ còn giới hạn 600 kỳ, bằng giới hạn lúc nhập). Sổ rỗng hoặc không đọc được → **không ghi khoá `cycles`**.
  - **Đọc** (`readCycles`): danh sách sai định dạng (không phải mảng, quá 600, có mục không qua `validateCycle` như end < start hay ngày không có thật) → từ chối cả file. Kỳ chỉ **xung đột theo cặp** với kỳ đứng trước trong file (trùng id, trùng ngày bắt đầu, chồng nhau, `openOverlap`) → bỏ riêng kỳ đó và đếm; xem trước ghi "Bỏ qua N kỳ trùng trong file", kết quả ghi "Bỏ qua N kỳ trùng.". Ngày tương lai KHÔNG bị kiểm lúc đọc file (kỳ ghi lúc đồng hồ máy chạy nhanh không được làm cả bản sao lưu ảnh thành vô dụng) — khi Gộp các kỳ đó bị bỏ qua.
  - File không có khoá `cycles` **hoặc có `cycles: []`** → coi là "file không mang chu kỳ": sổ trên máy **giữ nguyên ở cả hai chế độ**, màn hình ghi "Chu kỳ đã ghi trên máy giữ nguyên (bản sao lưu này không có)". Thay thế vì thế không bao giờ xoá trắng sổ.
  - Gộp → `LoveCore.mergeCycles` thêm từng kỳ của file nếu `cycleConflict` cho qua (trùng id thì cấp id mới); màn xem trước và bước nhập thật gọi cùng hàm đó nên hai con số luôn bằng nhau. Thay thế → dùng danh sách của file.
  - Sổ trên máy đang không đọc được → chu kỳ trong file không được nhập ở cả hai chế độ, và màn xem trước nói rõ điều đó (không ghi "đã có trên máy").
- **Thay thế**: xoá toàn bộ ảnh, kỷ niệm, hồ sơ, ảnh đại diện/bìa rồi dùng nội dung file. Sheet có "Bước 1 · Sao lưu dữ liệu hiện tại trước" (Chuẩn bị → Lưu file, hai cú chạm vì lý do user activation ở trên) và hộp xác nhận nhắc nếu chưa lưu.
- **An toàn khi bị ngắt giữa chừng** (IndexedDB tự commit qua mỗi await nên không thể dùng một transaction dài): mỗi ảnh nhập vào được ghi trước thành **blob với id MỚI và chưa có bản ghi photos** — vô hình với app, không đè lên bất cứ thứ gì đang có. Sau khi mọi ảnh đã đọc + kiểm xong, **một transaction cuối** kiểm các blob đó còn đủ, rồi ghi toàn bộ bản ghi photos, kỷ niệm, profile, ảnh đại diện/bìa (nhỏ, giữ trong bộ nhớ vì id cố định không "dàn dựng" được) — Thay thế thì `clear()` photos/milestones trong chính transaction đó. Lỗi trước bước cuối → xoá các blob đã dàn dựng; app bị tắt/tải lại giữa chừng → `cleanupGenerations()` lần mở sau xoá blob mồ côi. Ảnh đang có không bao giờ bị ghi lại hay đổi `gen`, nên không thể mất hay nhân đôi. Gộp ghi `activeGen` theo `genForWrite` (giữ nguyên gen của ảnh đang có, kể cả khi nó hỏng); Thay thế ghi `"g1"`.
- Nếu một cửa sổ LoveDays khác mở trong lúc nhập (nó chạy dọn dẹp và xoá blob đang dàn dựng), transaction cuối phát hiện thiếu blob và huỷ: "Có cửa sổ LoveDays khác vừa mở…".

## Badge số ngày trên icon

Khi mở app, khi app hiện lại (`visibilitychange`) và lúc 00:00 giờ VN: `navigator.setAppBadge(N)` — **chỉ khi** `Notification.permission === 'granted'` (iOS chỉ hiện badge khi đã cho phép thông báo; quyền được xin ở mục Thông báo trong Cài đặt). Mọi lỗi bị nuốt.

## Thông báo đẩy hằng ngày

### Luồng

```
GitHub Actions (cron "17 23,0-4 * * *" = 06:17–11:17 VN, 6 lượt)
  └─ py/send_push.py ── Web Push (VAPID, aes128gcm, TTL 12h) ──▶ web.push.apple.com ──▶ iPhone
        │  payload {"startDate","n","date"} (startDate/n chỉ có khi đặt LOVE_START_DATE)
        └─ ghi data/push-state.json {lastSentDate, sentAt, delivered, failed} → commit
SW (js/sw-core.js) nhận "push":
  readPushData(): MỘT LoveCore.openDb() + một transaction kv đọc profile, cycles, meta; đóng DB ở cả hai nhánh; SW không ghi gì
  startDate của máy → N tính LÚC NHẬN
  → không có thì payload.startDate → payload.n (số nguyên 1..100000) → câu chung "Mở app để xem…"
  → ngày tròn trăm / kỷ niệm năm: thân thông báo đổi thành "Hôm nay tròn …🎉"
  → reminderSuffix() (try/catch riêng, chỉ khi startDate đọc được từ DB của máy):
      cycleReminder(cycles.items, now, meta.cycleRemind — thiếu/sai thì 2, 0 thì thôi) có kết quả → thân += "\n🌸 còn 2 ngày"
      mọi lỗi/dữ liệu hỏng ở bước này → bỏ dòng nhắc, thông báo hằng ngày y như cũ
  → LUÔN đúng MỘT showNotification("💕 Ngày thứ N", tag love-days-daily) + setAppBadge(N)
"notificationclick": focus cửa sổ LoveDays đang mở, không có thì openWindow(html/index.html)
```

- **Một lần mỗi ngày VN**: `send_push.py` lấy ngày VN = (UTC + 7h).date(); `push-state.json` đã có `lastSentDate` = hôm nay → in "Đã gửi hôm nay, bỏ qua", exit 0. Chạy 6 lượt vì GitHub hay bỏ lượt hẹn giờ khi quá tải — lượt nào lọt cũng gửi được, các lượt sau bỏ qua.
- Trạng thái **chỉ ghi khi gửi thành công ≥ 1 máy**, và ghi SAU khi gửi. Tất cả đều lỗi → exit 1, không ghi, lượt sau thử lại.
- Exit code: 0 = đã gửi ≥ 1 / đã gửi hôm nay / `--dry-run`; 1 = mọi máy đều lỗi; 2 = cấu hình sai (thiếu secret, JSON sai, khoá sai, ngày sai).
- 404/410 → `::warning::Thiết bị "<tên>" hết hạn đăng ký` (gỡ khỏi secret, đăng ký lại); lỗi khác → `lỗi tạm`. Một máy lỗi không chặn máy khác.
- **Log công khai** (repo public): script không bao giờ in endpoint, khoá hay nguyên văn exception (lỗi của `requests` có chứa URL) — chỉ tên máy, host, mã HTTP.
- `pywebpush` ghi `aud` vào dict claims được truyền vào → mỗi máy dùng một dict mới, nếu không máy thứ hai bị ký với `aud` của push service máy đầu (403).
- Workflow: bước đầu chỉ xét `LOVE_PUSH_SUBSCRIPTIONS` — trống thì in một dòng thường (không `::notice::`) và dừng xanh, để khỏi báo lỗi 6 lần/ngày trước khi cài đặt. Không xét khoá VAPID vì `PUSH_VAPID_PRIVATE_KEY` dùng chung với GoldTrack/FuelTrack nên có thể có sẵn từ trước khi LoveDays được cài. Đã có subscriptions mà thiếu/hỏng khoá → script exit 2 (đỏ). `workflow_dispatch` có `force` (gửi lại dù hôm nay đã gửi) và `dry_run` (không gửi, không ghi). `pywebpush==2.5.0` (đã kiểm với khoá dạng raw base64url của `web-push generate-vapid-keys`).
- `data/push-state.json` do bot ghi, app **không** đọc, không nằm trong danh sách cache SW.
- Chạy tay: `python products/love-days/py/send_push.py [--now 2026-10-01T23:30:00Z] [--force] [--dry-run] [--state path]`.

### Secrets (repo → Settings → Secrets and variables → Actions)

| Secret | Bắt buộc | Nội dung |
|---|---|---|
| `PUSH_VAPID_PRIVATE_KEY` (hoặc `LOVE_VAPID_PRIVATE_KEY` cũ) | có | chuỗi `privateKey` (base64url, 43 ký tự). Một cặp khoá dùng chung cho LoveDays, GoldTrack, FuelTrack — workflow đọc `PUSH_VAPID_PRIVATE_KEY`, không có thì dùng `LOVE_VAPID_PRIVATE_KEY` |
| `LOVE_PUSH_SUBSCRIPTIONS` | có | mảng JSON các mã do nút "Sao chép" trong app tạo: `[{"label":"iPhone Long","endpoint":"https://web.push.apple.com/…","expirationTime":null,"keys":{"p256dh":"…","auth":"…"}}, {…máy Thư…}]` |
| `LOVE_START_DATE` | không | `YYYY-MM-DD` — chỉ để dự phòng trong payload khi máy chưa có dữ liệu; máy luôn ưu tiên ngày của chính nó |
| `LOVE_VAPID_SUB` | không | claim `sub` của VAPID, mặc định `https://letranvietlong.github.io` (Apple bắt buộc `mailto:` hoặc `https:`) |

### Cài đặt một lần (người dùng tự làm)

1. Trên máy tính của mình, ở thư mục **ngoài repo** (ví dụ Desktop), chạy `npx --yes web-push generate-vapid-keys --json` → được `{"publicKey":"B…","privateKey":"…"}`. **Không** lưu kết quả vào file nào trong repo — Stop hook chạy `git add -A` và push lên repo công khai.
2. Dán `privateKey` vào secret `PUSH_VAPID_PRIVATE_KEY` (dùng chung cho cả 3 app; `LOVE_VAPID_PRIVATE_KEY` cũ vẫn được nhận làm dự phòng).
3. Dán `publicKey` vào hằng `VAPID_PUBLIC_KEY` ở đầu `js/love-days.js` (khoá công khai, commit được), bump version + changelog. Khi hằng này trống, mục Thông báo hiện "Chưa cấu hình khoá thông báo", ô tên máy và nút "Bật thông báo" bị ẩn (chỉ còn "Gửi thử trên máy này").
4. Trên **mỗi** iPhone (iOS 16.4+): Safari → Chia sẻ → Thêm vào MH chính → mở app từ icon → Cài đặt → Thông báo → đặt tên máy → Bật thông báo → Cho phép → Sao chép.
5. Gộp mã của hai máy thành một mảng `[mã máy anh, mã máy em]` và dán vào secret `LOVE_PUSH_SUBSCRIPTIONS`. (Tuỳ chọn: `LOVE_START_DATE`, `LOVE_VAPID_SUB`.)
6. Actions → "LoveDays daily push" → Run workflow với `dry_run` để kiểm tra cấu hình (log liệt kê tên máy), rồi chạy với `force` để nhận thông báo thật ngay.

Nút "Gửi thử trên máy này" gọi `showNotification` + `setAppBadge` ngay trên máy (không qua workflow, không cần khoá VAPID) — dùng để kiểm tra quyền thông báo và số trên icon.

### Khi mã đăng ký đổi / hết hạn

- App lưu dấu (hash) của endpoint lúc bấm "Sao chép" trong `kv.push` {deviceLabel, lastCopiedEndpointHash}. Mỗi lần mở app so với `pushManager.getSubscription()`; khác hoặc mất → banner "Mã đăng ký thông báo của máy này đã đổi — cần cập nhật secret. Xem Cài đặt → Thông báo." Làm lại bước 4–5 cho máy đó, thay mã cũ trong secret. Khi máy **không còn** mã đăng ký (ví dụ cố ý tắt thông báo), banner có nút "Tôi đã tắt thông báo" — bấm thì xoá hash đã lưu và banner không hiện lại.
- Log workflow báo `hết hạn đăng ký (410)` → máy đó đã gỡ app / tắt thông báo / iOS thu hồi: gỡ mục đó khỏi secret, đăng ký lại.
- **Đổi cặp khoá VAPID** làm mọi mã đăng ký cũ vô hiệu: app tự huỷ đăng ký cũ khi bấm "Bật thông báo" (khoá khác → `subscribe()` sẽ ném InvalidStateError), banner hiện ra, cả hai máy phải sao chép lại mã.
- iOS thu hồi đăng ký nếu service worker nhận push mà không hiện thông báo → mọi nhánh trong handler `push` đều kết thúc bằng `showNotification`, kể cả khi đọc IndexedDB lỗi.

## Cạm bẫy

- Cache Storage dùng chung cả origin: `activate` chỉ xoá cache tiền tố `lovedays-cache-`.
- Không dùng `<input type=date>` (Chrome desktop hiện lịch xám, định dạng tháng/ngày kiểu Mỹ). Mỗi ô ngày = `<input type=hidden id=…>` (giữ hợp đồng `.value` `'YYYY-MM-DD'` hoặc `''`) + nút `.date-field[data-date-for]` mở bánh xe chọn ngày `#datePicker` trong `love-days.js`. **Mọi chỗ gán giá trị bằng code phải qua `setDateValue(id, v)`**, gán thẳng `.value` thì nút hiển thị bị cũ. Giới hạn từng ô ở `DATE_FIELDS` (ngày bắt đầu 1950 → hôm nay VN; ngày sinh 1900 → hôm nay VN, mặc định mở ở 01/01/2000; kỷ niệm 1900 → hôm nay + 20 năm; giá trị đã lưu nằm ngoài giới hạn thì giới hạn được nới ra lúc mở bộ chọn, để bấm "Xong" không âm thầm dời ngày cũ — việc kiểm tra hợp lệ vẫn ở bước lưu). Ngày ngoài giới hạn / không tồn tại (31/02) bị làm mờ và bánh xe tự quay về ngày hợp lệ gần nhất; chọn xong ("Xong") mới ghi giá trị và phát `input` + `change`. Ngày tương lai vẫn bị chặn thêm bằng JS khi lưu (`checkStartDate`).
- Không thể kiểm chứng trên Chromium: safe-area thật, badge thật trên icon, giới hạn bộ nhớ/eviction của Safari, bảng chia sẻ `navigator.share({files})` / "Lưu vào Tệp", Web Push thật qua APNs (Chromium headless không đăng ký push được — chỉ kiểm handler bằng CDP `ServiceWorker.deliverPushMessage`), ảnh HEIC thật từ thư viện iPhone (Safari giải mã được HEIC, Chromium thì không), bộ nhớ khi giải mã ảnh 48MP, vuốt bằng ngón tay thật trong viewer. Dòng chẩn đoán (Cài đặt → Thông tin → mở "Thông tin kỹ thuật") in standalone, quyền thông báo, `setAppBadge`, đã đăng ký push chưa, màn hình/viewport, safe-area, đáy tab bar, dung lượng và trạng thái bộ nhớ bền vững.
