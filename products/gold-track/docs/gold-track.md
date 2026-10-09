# GoldTrack

Theo dõi giá vàng và tính lời/lỗ danh mục vàng đã mua, qua 2 tiệm — Ngọc Thịnh Jewelry (chỉ Vàng 9999 nhẫn tròn) và Huy Thanh Jewelry (chỉ Vàng Huy Thanh 24k) — mỗi giao dịch phải gắn đúng tiệm + loại vàng vì giá khác nhau giữa các tiệm. Dữ liệu vẫn có cấu trúc shop→types (không phải shop→giá phẳng) dù mỗi tiệm hiện chỉ có 1 loại, để không phải đổi shape lần nữa nếu sau này thêm loại vàng khác. PWA cài được lên iPhone qua "Add to Home Screen".

## Cấu trúc thật (khác biệt so với mặt bằng chung)

- Đã tách css/js từ lâu — không có `<style>`/`<script>` inline trong `html/index.html`.
- **Có service worker thật** (duy nhất trong repo tính đến nay): `sw-gold-track.js` nằm ngay trong `products/gold-track/` (không lồng vào `js/`) — xem skill `project-structure` mục "Vỏ service worker bắt buộc ở đúng cấp thư mục nào?" để hiểu vì sao vị trí này bắt buộc. Logic thật ở `js/sw-core.js`, vỏ chỉ `importScripts` vào đó.
- Có `manifest.json` (Web App Manifest) — không tự khiến icon đã ghim trên iOS "tự sửa" nếu URL đổi (iOS ghim theo URL cụ thể, không đọc `start_url`).
- Dữ liệu (`data/*.json`) do 1 script Python trong `py/` tự cập nhật qua GitHub Actions (cron), KHÔNG sửa tay các file này.
- Đồng bộ nhiều thiết bị qua GitHub Gist (không có backend thật).

## Cạm bẫy đặc thù của GoldTrack (không phải cạm bẫy chung của repo)

- **Sổ sách mua/bán phải replay theo thứ tự thời gian** (`computePortfolio`). Đừng validate bằng tổng số dư bỏ qua ngày — từng gây bug lãi ảo khi bán lùi ngày (`findLedgerViolation` là hàm chống bug này, mọi thay đổi liên quan số lượng/ngày phải đi qua nó).
- **Vàng khác tiệm/loại không được gộp chung sổ sách**: mọi giao dịch mang `shop`+`goldType`; `computePortfolio`/`holdingsAsOf`/`findLedgerViolation` phải luôn được gọi trên danh sách đã lọc đúng 1 cặp (shop, goldType) — trộn lẫn sẽ cho phép bán "khống" loại vàng A dựa trên tồn kho loại B, hoặc bịa ra giá vốn trung bình vô nghĩa giữa các độ tuổi vàng khác nhau. `computePortfolioAll()` là nơi duy nhất được gộp số liệu giữa các nhóm — và chỉ gộp số tiền (VNĐ), không bao giờ gộp số "chỉ"/giá vốn TB giữa các loại vàng khác nhau.
- **Mỗi người sở hữu là một sổ riêng** (từ v1.59): giao dịch có `owner` ("Viết Long" | "Minh Thư", cố định theo yêu cầu người dùng, không có nút thêm người). Khoá nhóm là (owner, shop, goldType) — `groupKey`, `holdingsAsOf`, kiểm tra trong form submit đều lọc theo owner. Giao dịch thiếu `owner` được đọc qua `txOwner()` là "Viết Long" — chuẩn hoá lúc ĐỌC, không ghi ngược vào dữ liệu (ghi ngược lúc tải sẽ đánh dấu Gist dirty trên mọi máy cùng lúc). Danh sách người được suy ra từ dữ liệu + hằng `OWNERS`; bộ lọc người (`goldtrack_owner_filter_v1`) và người dùng gần nhất (`goldtrack_last_owner_v1`) chỉ lưu localStorage của máy — **không bao giờ lưu gì ngoài mảng `transactions` vào Gist** (`pullFromGist` thay toàn bộ, bản app cũ chỉ giữ field lạ bên trong từng giao dịch). "Tất cả" = cộng số tiền/số chỉ/giá vốn của từng sổ; giá vốn TB gộp = tổng vốn / tổng chỉ, không replay một sổ trộn nhiều người (sẽ ra giá vốn sai). **Sửa giao dịch sang nhóm khác phải kiểm tra cả sổ CŨ** (bỏ một lệnh mua ra có thể làm lệnh bán sau đó thiếu vàng). Tổng quan hiện cảnh báo nếu dữ liệu đồng bộ/nhập vào có lệnh bán vượt số đang giữ của một người.
- **Lãi/lỗ phải tính trên lượng đã clamp** (`sellAmt`), không phải lượng thô (`tx.amount`) — dùng lượng thô sẽ bịa ra lợi nhuận trên vàng chưa từng bán.
- **Đồng bộ Gist có thể mất dữ liệu nếu không cẩn thận**: cờ `goldtrack_gist_dirty_v1` phải được tôn trọng lúc khởi động — có thay đổi chưa đồng bộ thì phải đẩy lên (push), không được kéo về (pull) đè mất.
  - **Kết nối Gist đã có dữ liệu → "Giữ máy này"** phải `markGistDirty()` rồi push ngay (v1.63). Trước đó chỉ lưu cấu hình → lần mở sau thấy không dirty → pull bản Gist đè mất dữ liệu máy này. Esc/bấm nền = `dismissResult: null` = huỷ kết nối, không ghi đè bên nào.
  - **Race lúc khởi động**: `localRev` tăng ở mọi `saveState()`. `pullFromGist` ghi nhớ rev lúc bắt đầu GET; nếu người dùng sửa trong lúc GET đang chạy thì bỏ bản kéo về, giữ local + dirty, push lại. `markSynced(rev)` chỉ xoá cờ dirty khi không có sửa đổi mới hơn lần push đó — dùng `pushAndMarkSynced()`, đừng gọi `.then(markSynced)` trần (nó nhận JSON trả về, không phải rev). Đánh đổi còn lại: bản local được đẩy đè Gist, nên thay đổi máy khác vừa đẩy lên đúng trong lúc GET đang bay sẽ mất khỏi Gist (vẫn là "ghi sau thắng"; muốn hết hẳn phải gộp theo id).
- **Xoá/sửa giao dịch đi qua `findLedgerViolation(sau, trước)`** (v1.63): có tham số thứ hai thì chỉ chặn khi một lệnh bán bị thiếu vàng MỚI hoặc thiếu NHIỀU HƠN trước (replay có clamp như `computePortfolio`). Xoá lệnh mua mà lệnh bán sau cần → chặn hẳn, không hỏi lại. Sổ đã lệch sẵn (dữ liệu nhập/đồng bộ) vẫn sửa ghi chú, giá, lệnh không liên quan được.
- **Ngày luôn theo giờ Việt Nam** (`vnDayKey`, `todayISO`, `addDays` — UTC+7 bằng số học ngày UTC), không dùng getter giờ máy: máy để múi giờ khác từng coi giao dịch hôm nay (giờ VN) là "tương lai", và cộng 86400000 ms vào Date local lặp/mất ngày khi qua DST.
- **Lịch "Ngày" và Tổng quan cùng một quy tắc thiếu giá**: loại vàng không có giá trực tiếp hôm nay thì lãi chưa chốt tính 0 ở Tổng quan → lịch cũng bỏ phần chưa chốt của nhóm đó ở MỌI ngày (chỉ giữ lãi đã chốt), để Tổng tháng = Tổng lãi/lỗ. Biểu đồ "Giá trị danh mục" bắt đầu từ ngày mọi loại đang giữ đều có giá (trước đó không có giá trị thật — vẽ 0 trông như mất trắng); loại chưa từng có giá (tiệm "Khác") tính bằng vốn như "Giá trị hiện tại".
- **SW khớp theo path sạch**: `sw-core.js` đổi `/html/` → `/html/index.html` và lưu/tra cache theo pathname (bỏ query) — link chia sẻ có `?fbclid=…` hay URL thư mục từng không mở được khi offline.
- **Thêm file mới mà app load lúc chạy** (css/js/icon/data) → phải thêm path vào đúng mảng (`APP_CODE_PATHS`/`ICON_PATHS`/`DATA_PATHS`) trong `js/sw-core.js` **và** bump `CACHE_NAME` **và** bump `?v=` trong `sw-gold-track.js` cho khớp — thiếu 1 trong 3 bước này là app hỏng khi offline hoặc kẹt bản cũ.
- **Đơn vị giá**: nguồn (Ngọc Thịnh Jewelry) ghi giá theo VNĐ/**chỉ**, không phải lượng (1 lượng = 10 chỉ) — toàn app thống nhất dùng chỉ. Từng có bug hiểu nhầm đơn vị sai 10 lần.
- **Hai loại giá, đừng lẫn**: `buy` trong `gold-price.json` = giá **tiệm mua vào** (số tiền người dùng nhận khi bán) — dùng để định giá tài sản, tính lãi/lỗ chưa chốt, vẽ biểu đồ và tự điền giá bán. `sell` = giá tiệm bán ra (người dùng trả khi mua). Vừa mua xong đã "lỗ" đúng phần chênh lệch mua–bán (~2,6% ở Huy Thanh) — đúng, không phải bug.
- **Catalog tiệm/loại vàng khai báo 2 nơi phải khớp tuyệt đối**: `SHOP_TYPES` trong `js/gold-track.js` và `NGOCTHINH_TYPES`/`HUYTHANH_TYPES` trong `py/fetch_gold_price.py` (id loại vàng là khoá nối giữa giao dịch và file giá).
- **Hiển thị lãi/lỗ** (quy tắc chung ở skill `ui-craft` §10): dòng MUA trong Lịch sử chỉ so giá theo chỉ (%), không tính tiền lãi/lỗ; báo cáo theo tháng/năm chỉ chứa lãi đã chốt, lãi chưa chốt là dòng riêng; lịch "Ngày" = Δ lãi chưa chốt + lãi chốt trong ngày, ô hôm nay dùng giá trực tiếp để tổng các ngày = "Tổng lãi/lỗ" ở Tổng quan. Mọi con số phải lấy từ `computePortfolioAll()`/`perTx`, không tự tính lại.
- **iPhone**: meta status bar là `default` (không phải `black-translucent` — xem skill `ios-pwa-pitfalls` §1b); chữ số dùng mặt phông riêng `GT Digits` vì iOS không có Cambria. Dòng chẩn đoán (kích thước màn hình/viewport, safe-area, vị trí đáy menu, quyền thông báo, trạng thái push) nằm trong mục gập "Thông tin kỹ thuật" cuối tab Cài đặt (`#displayDiag`, cùng dòng "GoldTrack vX · Made by LongLTV") — nhờ người dùng mở mục đó rồi chụp khi có lỗi chỉ xuất hiện trên máy thật. Test đọc bằng `textContent` (mục gập đóng thì `innerText` rỗng).
- **Khoảng thời gian biểu đồ cố ý KHÔNG lưu** qua các lần mở (luôn về 7 ngày) — đừng thêm lại localStorage cho nó.
- **`gold-track.js` tự dọn service worker cũ**: trước khi đăng ký SW mới, code unregister mọi registration có scope đúng bằng gốc origin (`location.origin + '/'`) — đây là dọn dẹp cho người dùng cũ từ thời SW còn đăng ký ở root repo (trước khi chuyển vào `products/gold-track/`). Đừng xoá đoạn này tưởng là code thừa.

## Quy trình vận hành

- **Đổi version + changelog**: mọi thay đổi người dùng thấy được (feature, fix, redesign — không phải refactor nội bộ) → bump field `"version"` + prepend entry vào `data/changelog.json` (tiếng Việt, mô tả cho người dùng). Chi tiết đầy đủ nằm trong `CLAUDE.md` ở root.
- **Lấy dữ liệu**: `py/fetch_gold_price.py` (giá) rồi `py/notify_gold_price.py` (thông báo đẩy — xem "Thông báo giá"), chạy qua `.github/workflows/update-gold-price.yml`. Chi tiết cạm bẫy khi sửa script này (đơn vị, race condition khi commit, lịch cron không đáng tin) nằm trong skill `goldtrack-data-pipeline`.

## Thông báo giá

```
update-gold-price.yml (cron 7,37 mỗi giờ)
  fetch_gold_price.py → (Check push config) → (Install pywebpush) → notify_gold_price.py → commit giá + data/push-state.json
     notify_gold_price.py ── .github/scripts/web_push.py (VAPID, aes128gcm, TTL 6h, Urgency normal) ──▶ web.push.apple.com ──▶ iPhone
SW (js/sw-core.js) "push": payload {"v":1,"title","body","tag":"gold-price","ts"} → LUÔN showNotification (iOS thu hồi đăng ký nếu push không hiện gì);
   payload hỏng → "GoldTrack" / "Giá vàng vừa thay đổi — mở app để xem". "notificationclick": focus cửa sổ GoldTrack, không có thì mở html/index.html.
```

- Theo dõi đúng 2 loại: Ngọc Thịnh 9999 (`ngoc-thinh/9999-nhan-tron`) và Huy Thanh 24k (`huy-thanh/24k-huy-thanh`), ngưỡng 0 đ, không giới hạn số lần/ngày.
- **Bot giá commit MỌI lượt chạy** (`fetchedAt` luôn đổi) → "có commit" không có nghĩa "giá đổi". Notifier so `data/gold-price.json` với **giá đã báo lần cuối** (`data/push-state.json` = `{notified:{"<shop>/<type>":{buy,sell}}, notifiedAt, delivered, failed}`). Chưa có state → lưu giá hiện tại làm mốc, không gửi. Loại mới xuất hiện → thêm vào mốc, không gửi. Không đổi → thôi. 22:00–07:00 VN → để lượt sau, **không ghi state** (các lần đổi trong đêm gộp thành một thông báo buổi sáng, Δ tính từ mốc cũ). Gửi xong (≥ 1 máy) mới ghi state.
- Tiêu đề: mọi Δ khác 0 đều tăng → "Giá vàng tăng", đều giảm → "Giá vàng giảm", lẫn lộn → "Giá vàng thay đổi" (`--force` khi không đổi → "Giá vàng hiện tại"). Nội dung một dòng mỗi loại đổi: `Ngọc Thịnh 9999: mua 13.200.000 (+70.000) · bán 13.320.000 (+60.000)`; phía không đổi không kèm Δ; dấu trừ U+2212.
- Exit: 0 = đã gửi ≥ 1 / không có gì để gửi / hoãn / `--dry-run`; 1 = mọi máy lỗi (không ghi state); 2 = cấu hình sai. Workflow: mọi bước push `continue-on-error` + `timeout-minutes: 3` → **giá vẫn được commit dù push lỗi hay thiếu secret**; secret `GOLD_PUSH_SUBSCRIPTIONS` trống → bỏ qua hẳn (chỉ `echo`). Bước commit chỉ `git add` push-state.json khi file tồn tại (git add file không có là lỗi fatal); chỉ state đổi → message "GoldTrack push state: YYYY-MM-DD". `workflow_dispatch` có `notify_force`, `notify_dry_run`.
- Log công khai: không in endpoint, khoá hay nguyên văn exception — chỉ tên máy, host, mã HTTP (do `web_push.py` dùng chung với FuelTrack).
- Chạy tay: `python products/gold-track/py/notify_gold_price.py [--now 2026-10-08T07:16:00Z] [--force] [--dry-run] [--state …] [--price-file …]`.
- `push-state.json` do bot tạo ở lượt đầu đã cấu hình; app không đọc, không nằm trong `DATA_PATHS` của SW.

### Secrets & cài đặt một lần

| Secret | Nội dung |
|---|---|
| `PUSH_VAPID_PRIVATE_KEY` | `privateKey` của cặp khoá VAPID **dùng chung** GoldTrack / FuelTrack / LoveDays (workflow tự dùng `LOVE_VAPID_PRIVATE_KEY` nếu secret này trống) |
| `GOLD_PUSH_SUBSCRIPTIONS` | mảng JSON các mã do nút "Sao chép" trong GoldTrack tạo. Mã gắn với service worker của từng app → **mỗi app trên mỗi máy có mã riêng**, không dùng lại mã của FuelTrack/LoveDays |
| `PUSH_VAPID_SUB` (tuỳ chọn) | claim `sub`, mặc định `https://letranvietlong.github.io` |

1. Nếu chưa có cặp khoá: ở thư mục **ngoài repo**, `npx --yes web-push generate-vapid-keys --json` → `privateKey` vào secret `PUSH_VAPID_PRIVATE_KEY`. Không ghi khoá vào file nào trong repo (repo công khai, Stop hook `git add -A`).
2. `publicKey` vào hằng `VAPID_PUBLIC_KEY` ở đầu `js/gold-track.js` — **phải giống hệt** hằng cùng tên trong FuelTrack và LoveDays. Trống → thẻ "Thông báo giá" hiện "Chưa cấu hình khoá thông báo", ẩn ô tên máy và nút Bật.
3. Mỗi iPhone (iOS 16.4+): mở GoldTrack từ icon Màn hình chính → Cài đặt → Thông báo giá → đặt tên máy → Bật thông báo → Cho phép → Sao chép.
4. Gộp mã các máy thành `[mã 1, mã 2]` → secret `GOLD_PUSH_SUBSCRIPTIONS`.
5. Actions → "Update gold price" → Run workflow với `notify_dry_run` (log liệt kê tên máy và nội dung sẽ gửi; lượt đầu chỉ báo sẽ lưu mốc), rồi `notify_force` để nhận thử thật.

- Thiết lập riêng của máy trong `localStorage` `goldtrack_push_v1` `{deviceLabel, lastCopiedEndpointHash}` — **không** đồng bộ Gist, không nằm trong file xuất, "Xoá hết" không đụng tới. Mở app thấy endpoint khác/mất so với lúc "Sao chép" → dòng cảnh báo trong thẻ + toast một lần (mất hẳn mã → thêm nút "Tôi đã tắt thông báo"). "Gửi thử trên máy này" gọi `showNotification` ngay trên máy với giá đang tải (tiêu đề "Giá vàng (thử)", không qua workflow); bị tắt thì dòng nhỏ dưới nút nói lý do.
- Không kiểm chứng được trên Chromium: Web Push thật qua APNs, quyền thông báo trên iPhone.
