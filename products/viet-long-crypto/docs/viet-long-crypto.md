# VietLongCrypto

Nền tảng theo dõi thị trường tiền điện tử — giá real-time, phân tích xu hướng, biểu đồ market cap, chuyển đổi ngoại hối.

## Cấu trúc thật

- File CSS/JS lớn thứ nhì repo — `css/viet-long-crypto.css` và `js/viet-long-crypto.js` mỗi file được gộp từ **2 block rời rạc** trong HTML gốc (block style/script chính cho toàn app + một block riêng cho tính năng "changelog modal" nằm tách biệt hàng nghìn dòng phía sau). Cả 2 block mỗi loại đã gộp theo đúng thứ tự gốc vào 1 file duy nhất.
- **2 script CDN ngoài vẫn để inline trong `<head>`, KHÔNG đưa vào `js/viet-long-crypto.js`**: `lightweight-charts` (unpkg) và `tv.js` (TradingView) — đây là thư viện bên thứ ba tải qua URL tuyệt đối, khác với logic riêng của app.
- Không có service worker, không có `manifest.json`.
- Gọi trực tiếp API `min-api.cryptocompare.com` từ trình duyệt — **lỗi CORS khi test qua `localhost` là bình thường, có từ trước, không phải bug do restructure gây ra** (đã xác minh: API trả 401 kể cả gọi trực tiếp bằng `curl`, không liên quan tới việc tách file).

## Cạm bẫy đặc thù

- Tính năng "changelog modal" (nút hiện version ở góc trên) có HTML nằm ở giữa/cuối trang nhưng CSS/JS của nó đã được gộp và load NGAY TỪ ĐẦU cùng file chính — điều này AN TOÀN vì hàm/CSS chỉ cần được định nghĩa trước khi người dùng click, không phụ thuộc thứ tự markup xung quanh. Đừng "sửa lại cho giống thứ tự HTML gốc" tưởng là dọn dẹp — không cần thiết và có thể gây lỗi nếu làm sai.
- Nếu sửa gì liên quan đến modal changelog, tìm bằng `onclick="showChangelogModal()"` trong `html/index.html`, hàm thật nằm trong `js/viet-long-crypto.js` (phần cuối file, sau phần logic chính).
- Đừng nhầm lỗi CORS của `cryptocompare` (đã biết, đã xác minh có từ trước) với lỗi do sửa code — luôn kiểm tra bằng `curl` trực tiếp tới API trước khi kết luận là bug mới.
