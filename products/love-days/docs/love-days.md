# LoveDays

App riêng tư đếm ngày yêu nhau của Viết Long và Minh Thư, dùng như app ở Màn hình chính trên iPhone 14 Pro Max (iOS 16.4+). Tiêu đề icon "Long & Thư". **Không công khai**: `robots.txt` chặn `/products/love-days/`, trang có `noindex,nofollow`, không có canonical, không nằm trong `sitemap.xml`, không có card trên trang chủ, README chỉ ghi trong sơ đồ cấu trúc.

Tình trạng: **Phase 1A + 1B + 2** (đếm ngày, kỷ niệm, hồ sơ + ảnh đại diện/ảnh bìa, badge khi mở, album ảnh, sao lưu/nhập ZIP, thông báo đẩy hằng ngày từ GitHub Actions). Thông báo chỉ chạy sau khi người dùng làm các bước cài đặt một lần (Cài đặt → nhóm "Thông báo" → "Cách cài đặt (làm một lần)").

## Cấu trúc đặc thù

- Toàn bộ dữ liệu nằm trong **IndexedDB trên máy** (không localStorage, không server, không Gist). App ở Màn hình chính có bộ nhớ riêng tách với Safari; xoá icon = mất dữ liệu → màn hình đầu và tab Cài đặt đều nói rõ điều này.
- Script nạp theo thứ tự: `love-days-core.js` → `love-days-media.js` → `love-days-backup.js` → `love-days.js`. `love-days-backup.js` (`self.LoveBackup`) chứa ZIP + xuất/nhập; giao diện sao lưu nằm trong `love-days.js`.
- `js/love-days-core.js` là **classic script dùng chung cho trang và service worker** (`sw-core.js` `importScripts` nó), lộ ra `self.LoveCore`. Không được dùng ES module, DOM hay `window` trong file này.
- Service worker: vỏ `sw-love-days.js` nằm thẳng trong `products/love-days/` (scope), logic ở `js/sw-core.js`, `CACHE_NAME` tiền tố `lovedays-cache-`, đăng ký bằng đường dẫn tuyệt đối. Bump `CACHE_NAME` thì bump luôn `?v=` ở vỏ **và** `?v=` của `love-days-core.js` trong `sw-core.js`.

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
| `kv` | `key` | `profile` {startDate, persons[2]{id,name,dob}, hasCover, activeGen, updatedAt}; `meta` {schemaVersion, lastBackupAt, albumSort}; `push` {deviceLabel, lastCopiedEndpointHash} (xem Thông báo đẩy) |
| `milestones` | `id` | {id, title, date, emoji, note, repeatYearly, createdAt} |
| `photos` | `id` | {id, gen, caption, takenAt: ms hoặc null, addedAt, order, w, h, bytes, sha256}; index `gen`/`takenAt`/`addedAt`/`order` |
| `blobs` | `id` | {id, gen, mime, data: **ArrayBuffer**, thumb}; id `avatar-long`, `avatar-thu`, `cover`, hoặc id ảnh |

- Lưu ArrayBuffer, không lưu Blob (lịch sử lỗi Blob-trong-IDB của WebKit).
- Đổi schema: tăng `DB_VERSION`, thêm `case` trong `upgrade(db, oldVersion)` (switch rơi xuyên, không `break`).
- **Không bao giờ treo**: `openDb()` timeout 5s / `onblocked` → banner đỏ + chạy tạm trong bộ nhớ. Mọi bản ghi đọc lên đều qua validator; bản ghi hỏng bị bỏ qua + banner "Bỏ qua N mục hỏng". `startDate` hỏng hoặc sau hôm nay → về màn hình nhập ngày, **không xoá gì**.
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

## Sao lưu (ZIP STORE)

File `love-days-backup-YYYY-MM-DD.zip` (ngày VN), không nén (method 0), không zip64 (tối đa 4 GB), tối đa **10.000 ảnh và 2.000 kỷ niệm** — cùng một giới hạn cho xuất và nhập, để app không bao giờ tạo ra file mà chính nó từ chối đọc (10.000 ảnh 1600px đã chạm trần 4 GB). Vượt giới hạn → báo lỗi ngay khi bấm "Chuẩn bị bản sao lưu". Tên mục ASCII:

```
photos/<id>.jpg ...        ảnh album (JPEG 1600px, không kèm thumbnail — tạo lại khi nhập)
avatars/long.jpg, avatars/thu.jpg, cover.jpg   chỉ những ảnh đang có
love-days.json             {app:'love-days', format:1, exportedAt (ISO),
                            profile:{startDate, persons[2]{id,name,dob}, hasCover},
                            milestones:[...], photos:[{id, caption, takenAt, addedAt, order, w, h, bytes, sha256, file}],
                            images:{'avatar-long':'avatars/long.jpg', ...}}
```

- **Lưu hai bước**: "Chuẩn bị bản sao lưu" dựng file → "Lưu file (xx MB)" gọi `navigator.share({files})` **ngay trong cú chạm** khi `canShare` (iPhone: "Lưu vào Tệp"), nếu không thì `a.download` + revoke sau 10s. Safari mất "user activation" sau await dài → share ném `NotAllowedError`, nên không gộp hai bước. Mọi thay đổi dữ liệu làm file đã chuẩn bị hết hiệu lực. Lưu xong ghi `kv.meta.lastBackupAt`; thẻ Sao lưu hiện "Lần cuối: hôm nay, 21:30" / "Lần cuối: 31 ngày trước (01/09/2026)" (đếm theo ngày lịch VN), tô màu cảnh báo khi chưa sao lưu lần nào hoặc đã ≥ 30 ngày.
- **Đọc**: chỉ nhận đúng định dạng do app tạo — EOCD nằm ở đúng 22 byte cuối (không comment), 1 đĩa, method 0, không mã hoá/data descriptor, csize = usize, tên mục chỉ gồm chữ/số/`_`/`-`/`.`/`/` và không có `..`, offset nằm trong file. Từng mục được đọc bằng `file.slice().arrayBuffer()`, kiểm CRC32 + đầu JPEG `FF D8 FF`, sha256 khớp manifest.
- **Kiểm tra trước khi ghi**: app/format, ngày thật (không chỉ regex) và không sau hôm nay, độ dài chuỗi, id `^[\w-]+$`, không trùng id, mọi ảnh được tham chiếu phải có trong ZIP; chạy thử `LoveCore.computeAll()` trên dữ liệu mới. File bị từ chối → thông báo tiếng Việt, dữ liệu không đổi. Lỗi CRC của một ảnh chỉ lộ ra lúc đọc ảnh đó (sau khi bấm Nhập) — vẫn huỷ sạch.

### Nhập: Gộp (mặc định) / Thay thế

- **Gộp**: ảnh trùng sha256 với ảnh đang có → giữ ảnh đang có, bỏ ảnh trong file; kỷ niệm trùng id → giữ bản đang có; hồ sơ giữ nguyên trừ khi máy chưa có hồ sơ hợp lệ; ảnh đại diện/ảnh bìa chỉ lấy từ file khi máy chưa có. Ảnh mới xếp sau ảnh hiện có trong thứ tự Tuỳ chỉnh.
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
  startDate trong IndexedDB của máy (LoveCore.openDb(), đóng DB ngay) → N tính LÚC NHẬN
  → không có thì payload.startDate → payload.n → câu chung "Mở app để xem…"
  → LUÔN showNotification("💕 Ngày thứ N", tag love-days-daily) + setAppBadge(N)
  → ngày tròn trăm / kỷ niệm năm: thân thông báo đổi thành "Hôm nay tròn …🎉"
"notificationclick": focus cửa sổ LoveDays đang mở, không có thì openWindow(html/index.html)
```

- **Một lần mỗi ngày VN**: `send_push.py` lấy ngày VN = (UTC + 7h).date(); `push-state.json` đã có `lastSentDate` = hôm nay → in "Đã gửi hôm nay, bỏ qua", exit 0. Chạy 6 lượt vì GitHub hay bỏ lượt hẹn giờ khi quá tải — lượt nào lọt cũng gửi được, các lượt sau bỏ qua.
- Trạng thái **chỉ ghi khi gửi thành công ≥ 1 máy**, và ghi SAU khi gửi. Tất cả đều lỗi → exit 1, không ghi, lượt sau thử lại.
- Exit code: 0 = đã gửi ≥ 1 / đã gửi hôm nay / `--dry-run`; 1 = mọi máy đều lỗi; 2 = cấu hình sai (thiếu secret, JSON sai, khoá sai, ngày sai).
- 404/410 → `::warning::Thiết bị "<tên>" hết hạn đăng ký` (gỡ khỏi secret, đăng ký lại); lỗi khác → `lỗi tạm`. Một máy lỗi không chặn máy khác.
- **Log công khai** (repo public): script không bao giờ in endpoint, khoá hay nguyên văn exception (lỗi của `requests` có chứa URL) — chỉ tên máy, host, mã HTTP.
- `pywebpush` ghi `aud` vào dict claims được truyền vào → mỗi máy dùng một dict mới, nếu không máy thứ hai bị ký với `aud` của push service máy đầu (403).
- Workflow: bước đầu kiểm tra nếu **cả hai** secret chính đều trống thì `::notice::` và dừng xanh (để khỏi báo lỗi 6 lần/ngày trước khi cài đặt). Thiếu một trong hai → script exit 2 (đỏ). `workflow_dispatch` có `force` (gửi lại dù hôm nay đã gửi) và `dry_run` (không gửi, không ghi). `pywebpush==2.5.0` (đã kiểm với khoá dạng raw base64url của `web-push generate-vapid-keys`).
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
