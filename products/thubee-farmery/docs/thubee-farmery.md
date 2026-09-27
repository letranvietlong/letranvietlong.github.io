# Thubee Farmery

Dashboard quản lý doanh thu nội bộ cho cửa hàng nông sản & mật ong — đơn hàng, sản phẩm, khách hàng, người bán hàng. **Chỉ thiết kế cho iPhone 14 Pro Max** (không hỗ trợ desktop) — bottom tab bar, modal kiểu bottom-sheet, safe-area cho Dynamic Island/home indicator.

## Cấu trúc thật

- Đã tách css/js. `js/thubee-farmery.ts` là **source thật** (TypeScript), `js/thubee-farmery.js` là bản compile — sửa `.ts` rồi compile lại, đừng sửa thẳng `.js` (sẽ bị ghi đè ở lần compile kế tiếp).
  ```
  npx -y -p typescript@5 tsc products/thubee-farmery/js/thubee-farmery.ts --target ES2017 --lib dom,es2017 --module none --alwaysStrict --newLine crlf --outDir products/thubee-farmery/js
  ```
  Phải dùng TypeScript 5 (`typescript@5`): bản mới nhất (7.x) không còn `--module none`. `--alwaysStrict --newLine crlf` để ra đúng từng byte như `.js` đang commit (có `"use strict"`).
- **Không có service worker, không có backend thật.** "Đăng nhập" là client-side password gate (so khớp SHA-256 hash trong `.ts`) — chỉ chặn người xem thông thường, không chống được người cố tình đọc source.
- `json/*.json` là dữ liệu **seed** (viết tay, commit có chủ đích) — nguồn gợi ý ban đầu cho combobox khách hàng/người bán/sản phẩm. Mọi thêm/sửa/xoá thật trên site lưu vào `localStorage` trình duyệt, **không đồng bộ nhiều thiết bị, không ghi ngược lại file json**.
- **Sao lưu / khôi phục**: thẻ "Sao lưu dữ liệu" cuối tab Tổng quan. "Sao lưu (.json)" tải `thubee-farmery-backup-YYYY-MM-DD.json` (ngày theo giờ máy) dạng `{"app":"thubee-farmery","version":1,"exportedAt":"<ISO>","products":[...],"customers":[...],"sellers":[...],"orders":[...]}`. "Khôi phục" chỉ nhận file có `app === "thubee-farmery"`, `version === 1`, và **từng phần tử** của 4 mảng khớp `DATASET_SCHEMA` trong `.ts` (đúng kiểu từng trường, id chỉ gồm `[\w-]` vì id được chèn vào `onclick="...('${id}')"`); sau đó chạy thử các phép tính của giao diện trên dữ liệu mới (`dryRunDataset`). Sai thì báo rõ vị trí (vd. `orders[3] thiếu hoặc sai trường "date"`) và không đổi gì. Hợp lệ thì hỏi xác nhận, **tự tải `thubee-farmery-truoc-khoi-phuc-YYYY-MM-DD.json` chứa dữ liệu hiện tại** rồi mới **thay toàn bộ** 4 mảng (không gộp). Ghi `localStorage` trước, lỗi giữa chừng (đầy bộ nhớ) thì trả lại giá trị cũ cho cả 4 key rồi mới báo lỗi; chỉ khi ghi xong hết mới gán state trong bộ nhớ. Đây là đường duy nhất để mang dữ liệu qua lần xoá/thêm lại icon Màn hình chính hoặc đổi máy — nếu đổi cấu trúc dữ liệu thì tăng `version`, sửa `DATASET_SCHEMA` và giữ khả năng đọc bản cũ (schema chặt hơn dữ liệu form tạo ra = người dùng không khôi phục được bản sao lưu của chính mình).
- `DATASET_SCHEMA` phải chấp nhận MỌI dạng dữ liệu các bản cũ từng ghi, không chỉ dạng hiện tại: đơn hàng của bản đầu tiên (commit 4a98e91) có trường `customer` (tên) và **không có** `customerId`/`sellerId` — vì vậy hai trường này được phép `undefined`. Thêm trường bắt buộc mới vào model thì schema phải cho phép thiếu nó, nếu không dữ liệu thật đang có sẽ bị coi là "hỏng" và bản sao lưu cũ không khôi phục được.
- Lúc khởi động, dữ liệu trong `localStorage` cũng được kiểm bằng `validateDataset`, còn `populate*`/`renderAll` được bọc try/catch: dữ liệu hỏng thì app vẫn mở (không kẹt màn hình loading), hiện alert gợi ý dùng "Khôi phục", và **không tự xoá** dữ liệu cũ.
- Status bar: `apple-mobile-web-app-status-bar-style` = `default` (không dùng `black-translucent` — ở chế độ app Màn hình chính nó làm viewport hụt 59pt, thanh tab dưới bị nổi lên). Đổi thẻ này người dùng phải xoá và thêm lại icon, nên nhắc họ sao lưu trước.
- Có `manifest.json` — cùng giới hạn iOS như GoldTrack (không tự sửa icon đã ghim nếu URL đổi).

## Cạm bẫy đặc thù

- **Đổi mật khẩu**: mở Console trên trang, gọi `ThubeeAuth.hashPassword("user_moi", "mat_khau_moi")`, copy hash in ra thay vào hằng `AUTH_PASSWORD_HASH` + `AUTH_USERNAME` trong `.ts`, compile lại.
- **Đừng nhầm `json/` (seed) với dữ liệu thật đang chạy** — dữ liệu thật nằm trong `localStorage` của trình duyệt người dùng, sửa file `json/` không ảnh hưởng gì tới người đang dùng app.
- Muốn đồng bộ nhiều máy/nhiều người dùng thật cần thêm backend (Firebase/Supabase...) — ngoài phạm vi site tĩnh hiện tại, đừng giả định có sẵn.
- **Người bán hàng**: có tab riêng quản lý nhân viên bán hàng (tên + SĐT), gắn vào từng đơn hàng, có bảng xếp hạng doanh thu theo người bán — đừng nhầm với "khách hàng".
