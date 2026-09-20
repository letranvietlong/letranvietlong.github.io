# Thubee Farmery

Dashboard quản lý doanh thu nội bộ cho cửa hàng nông sản & mật ong — đơn hàng, sản phẩm, khách hàng, người bán hàng. **Chỉ thiết kế cho iPhone 14 Pro Max** (không hỗ trợ desktop) — bottom tab bar, modal kiểu bottom-sheet, safe-area cho Dynamic Island/home indicator.

## Cấu trúc thật

- Đã tách css/js. `js/thubee-farmery.ts` là **source thật** (TypeScript), `js/thubee-farmery.js` là bản compile — sửa `.ts` rồi compile lại, đừng sửa thẳng `.js` (sẽ bị ghi đè ở lần compile kế tiếp).
  ```
  tsc products/thubee-farmery/js/thubee-farmery.ts --target ES2017 --lib dom,es2017 --module none --outDir products/thubee-farmery/js
  ```
- **Không có service worker, không có backend thật.** "Đăng nhập" là client-side password gate (so khớp SHA-256 hash trong `.ts`) — chỉ chặn người xem thông thường, không chống được người cố tình đọc source.
- `json/*.json` là dữ liệu **seed** (viết tay, commit có chủ đích) — nguồn gợi ý ban đầu cho combobox khách hàng/người bán/sản phẩm. Mọi thêm/sửa/xoá thật trên site lưu vào `localStorage` trình duyệt, **không đồng bộ nhiều thiết bị, không ghi ngược lại file json**.
- Có `manifest.json` — cùng giới hạn iOS như GoldTrack (không tự sửa icon đã ghim nếu URL đổi).

## Cạm bẫy đặc thù

- **Đổi mật khẩu**: mở Console trên trang, gọi `ThubeeAuth.hashPassword("user_moi", "mat_khau_moi")`, copy hash in ra thay vào hằng `AUTH_PASSWORD_HASH` + `AUTH_USERNAME` trong `.ts`, compile lại.
- **Đừng nhầm `json/` (seed) với dữ liệu thật đang chạy** — dữ liệu thật nằm trong `localStorage` của trình duyệt người dùng, sửa file `json/` không ảnh hưởng gì tới người đang dùng app.
- Muốn đồng bộ nhiều máy/nhiều người dùng thật cần thêm backend (Firebase/Supabase...) — ngoài phạm vi site tĩnh hiện tại, đừng giả định có sẵn.
- **Người bán hàng**: có tab riêng quản lý nhân viên bán hàng (tên + SĐT), gắn vào từng đơn hàng, có bảng xếp hạng doanh thu theo người bán — đừng nhầm với "khách hàng".
