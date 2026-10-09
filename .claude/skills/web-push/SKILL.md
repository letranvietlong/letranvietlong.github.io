---
name: web-push
description: Kiến trúc Web Push (thông báo đẩy + số trên icon) cho các app iPhone trong repo — một cặp khoá VAPID dùng chung, subscription riêng từng app/máy, gửi từ GitHub Actions không cần server, thư viện chung .github/scripts/web_push.py, handler push trong service worker, giao diện bật thông báo, và cách test bằng push server giả + CDP. Dùng khi thêm/sửa thông báo cho GoldTrack/FuelTrack/LoveDays hoặc app mới, khi workflow push đỏ, khi thông báo không tới, hoặc khi đụng tới secret PUSH_/LOVE_/GOLD_/FUEL_.
---

# Web Push trong repo này

Không có backend. Mọi thông báo được gửi **từ GitHub Actions** bằng `pywebpush`, tới subscription mà người dùng tự copy từ app rồi dán vào GitHub secret. Repo là **public** và Stop hook chạy `git add -A` — mọi quy tắc dưới đây xoay quanh việc không để lộ khoá/endpoint và không để push làm hỏng bot giá.

## 1. Thành phần và nơi ở

| Thành phần | Ở đâu |
|---|---|
| Thư viện gửi dùng chung | `.github/scripts/web_push.py` (`load_vapid`, `load_devices`, `vapid_sub`, `send_all`, `clean_label`, `ConfigError`) |
| Notifier theo sản phẩm | `products/gold-track/py/notify_gold_price.py`, `products/fuel-track/py/notify_fuel_price.py`, `products/love-days/py/send_push.py` (LoveDays vẫn dùng bản riêng, chưa chuyển sang thư viện chung) |
| Workflow | giá vàng/xăng: bước push nằm **trong** `update-gold-price.yml` / `update-fuel-price.yml` trước bước commit; LoveDays: `love-days-push.yml` (cron sáng) |
| State chống gửi trùng | `products/<p>/data/push-state.json` — bot ghi, commit CÙNG commit với giá; app không đọc, không nằm trong cache SW; không tạo tay |
| Handler | cuối `products/<p>/js/sw-core.js`: `push` + `notificationclick` |
| Giao diện bật | tab Cài đặt của từng app; hằng `VAPID_PUBLIC_KEY` ở đầu file JS chính |

## 2. Khoá và secret

- **Một cặp khoá VAPID cho mọi app.** Private key chỉ ở secret `PUSH_VAPID_PRIVATE_KEY` (workflow đọc `secrets.PUSH_VAPID_PRIVATE_KEY || secrets.LOVE_VAPID_PRIVATE_KEY` để tương thích ngược). Hằng `VAPID_PUBLIC_KEY` trong **mọi** app phải giống hệt nhau — lệch thì push service trả **403** (thư viện in cảnh báo riêng cho 403).
- Tạo khoá: người dùng tự chạy `npx --yes web-push generate-vapid-keys --json` **ngoài repo**. Claude không tạo khoá thật (private key sẽ nằm trong log phiên). Khoá test chỉ tạo trong scratchpad.
- Subscription gắn với **registration của service worker (scope)** → mỗi app trên mỗi máy có mã riêng: `GOLD_PUSH_SUBSCRIPTIONS`, `FUEL_PUSH_SUBSCRIPTIONS`, `LOVE_PUSH_SUBSCRIPTIONS`, mỗi secret là mảng JSON `[mã máy 1, mã máy 2]`.

## 3. Quy tắc workflow (đã có lỗi thật)

- **"Đã cấu hình" chỉ dựa vào secret subscriptions của chính app đó**, không dựa vào khoá. Khoá dùng chung tồn tại sẵn cho app khác → nếu check khoá thì app chưa có subscription sẽ chạy và exit 2 sáu lần/ngày (lỗi thật ở `love-days-push.yml`). Chưa cấu hình → chỉ `echo`, không `::notice::` (48 annotation/ngày với bot vàng).
- Mọi bước push trong workflow giá: `continue-on-error: true` + `timeout-minutes: 3`. **Bot giá phải commit giá dù push lỗi / thiếu secret / pip lỗi.**
- `git add products/<p>/data/push-state.json` phải có guard `[ -f … ] &&` — add file không tồn tại = `fatal: pathspec` = hỏng commit giá.
- Bước tạo commit message bằng `python -c` phải chịu được dữ liệu thiếu (vd thiếu `ngoc-thinh`) — không được làm hỏng commit.
- Inputs `workflow_dispatch` (`notify_force`, `notify_dry_run`) và secrets chỉ đi qua `env:`, không nội suy vào `run:`.

## 4. Quy tắc notifier

- **So với giá ĐÃ BÁO lần trước**, không so với điểm lịch sử trước: bot vàng commit mọi lượt (fetchedAt) nên "có commit" ≠ "giá đổi"; so với giá đã báo thì gộp được các lần đổi trong giờ yên lặng và không báo khi giá dao động rồi quay về.
- Giờ yên lặng 22:00–07:00 giờ VN (UTC+7 cố định): hoãn, **không ghi state**, lượt sáng gửi gộp.
- Chỉ ghi state khi gửi thành công ≥1 máy; gửi trước rồi mới ghi (tệ nhất gửi trùng 1 lần, còn hơn mất 1 lần).
- Không gửi khi không có giá nào thực sự đổi (chỉ thêm/bớt mặt hàng → cập nhật state im lặng). Lỗi thật: FuelTrack báo "điều chỉnh" khi chỉ RON95-III bị bỏ.
- State hỏng/rỗng: cảnh báo và lấy mốc an toàn sao cho thay đổi hiện tại vẫn được báo — không im lặng nuốt.
- Exit code: 0 (đã gửi/bỏ qua hợp lệ), 1 (mọi máy lỗi — không ghi state), 2 (cấu hình sai). `--dry-run` không được cần pywebpush và không bao giờ ghi state (parse khoá chỉ ngay trước khi gửi).
- Log: chỉ tên máy, host, mã HTTP, tên loại exception. **Không bao giờ** in endpoint, p256dh, auth, private key, `str(e)` (secret chỉ được che khi khớp nguyên chuỗi). Tên máy qua `clean_label` (bỏ `\r\n:%` để không chèn lệnh workflow).
- `pywebpush` ghi `aud` vào chính dict claims → **mỗi máy một dict claims mới** (dùng chung thì máy thứ hai khác host bị 403).
- Payload: `{"v":1,"title","body","tag","ts"}` JSON gọn; TTL vàng 6h, xăng 24h, LoveDays 12h.

## 5. Service worker

- Handler `push` **luôn** kết thúc bằng `showNotification` (kể cả payload hỏng/rỗng → câu mặc định): iOS thu hồi subscription nếu nhận push mà không hiện thông báo.
- Cắt title/body theo **ký tự** (Array.from / grapheme), không `.slice` UTF-16 (cắt đôi emoji → "�").
- LoveDays tính số ngày từ IndexedDB của máy (nguồn chuẩn), payload chỉ là dự phòng; kiểm tra số hợp lý (không hiện "Ngày thứ 1e+21"). Vàng/xăng không đặt badge.
- `notificationclick`: focus cửa sổ cùng prefix sản phẩm, không có thì `openWindow` trang chính.
- Thêm handler = sửa `sw-core.js` → bump `CACHE_NAME` + `?v=` (xem CLAUDE.md).

## 6. Giao diện bật thông báo

- Chỉ bật được khi mở app **từ icon Màn hình chính** (iOS 16.4+) và `Notification.requestPermission()` phải gọi trong cú chạm. Safari tab → câu hướng dẫn, nút tắt kèm lý do.
- `VAPID_PUBLIC_KEY === ''` → "Chưa cấu hình khoá thông báo", ẩn ô tên máy + nút Bật.
- Hiện JSON subscription + "Sao chép"; lưu hash endpoint (localStorage/IDB riêng — **không** đưa vào Gist, export, "Xoá hết"); mở app thấy hash khác → cảnh báo "mã đã đổi" + nút "Tôi đã tắt thông báo".
- Phần tử `role=status` (trạng thái) chỉ ghi khi chữ đổi, nếu không VoiceOver đọc lại mỗi lần vào Cài đặt.
- Changelog không được hứa "đã có thông báo" khi khoá chưa cài — ghi "chuẩn bị… dùng được sau khi cài khoá".

## 7. Test (không cần iPhone cho phần logic)

- Push server giả: HTTP `127.0.0.1:<port>` trả mã theo path (`/ok` 201, `/gone` 410, `/err` 500, `/deny` 403). Subscription test tự sinh (EC P-256 + auth 16 byte bằng `cryptography`); server giải mã body bằng `http_ece` để so **từng ký tự** title/body. Grep log: không có endpoint/p256dh/auth.
- venv test: `python -m venv <scratchpad>/venv && <venv>/Scripts/pip install pywebpush==2.5.0` (kèm cryptography, http_ece). Đặt `PYTHONUTF8=1` để giống runner Ubuntu.
- Workflow: chạy nguyên văn các bước bash trên một repo tạm + bare origin; thử mọi tổ hợp secret (trống / chỉ khoá / chỉ subs / đủ) và mọi lỗi (pip lỗi, notify exit 1/2) — commit giá vẫn phải xảy ra.
- SW: Playwright `channel:'chromium'` (headless mới; headless-shell cũ luôn báo quyền `denied`) + CDP `ServiceWorker.deliverPushMessage`; đọc `registration.getNotifications()`.
- UI: `addInitScript` giả `Notification` + `PushManager` + `serviceWorker.ready/getRegistration`; chèn khoá public test bằng `page.route` thay `VAPID_PUBLIC_KEY = ''`.
- **Chưa kiểm chứng trên máy thật** cho tới khi người dùng chạy workflow với `notify_force` và gửi ảnh thông báo + dòng chẩn đoán.
