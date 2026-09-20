# VietLongSocial

Social intelligence — theo dõi số liệu realtime trên YouTube, TikTok, Instagram cho KOL & nhà sáng tạo nội dung.

## Cấu trúc thật

- Đã tách css/js (1 block style + 1 block script).
- Không có service worker, không có `manifest.json`, không có backend riêng — nhưng **có gọi API thật**: YouTube oEmbed và TikTok oEmbed (lấy tên hiển thị từ username), đi qua CORS proxy công cộng (`api.allorigins.win`, `api.codetabs.com`) vì các endpoint này không set CORS header cho phép gọi thẳng từ trình duyệt. Có `AbortSignal.timeout` + try/catch bao quanh mỗi lệnh gọi, fallback về chính username nếu API lỗi/timeout.

## Cạm bẫy đặc thù

- **Phụ thuộc vào CORS proxy công cộng của bên thứ ba** — nếu `allorigins.win`/`codetabs.com` sập hoặc đổi chính sách, tính năng lấy tên hiển thị sẽ lặng lẽ fallback về username thô (không crash, nhờ try/catch), dễ bị hiểu nhầm là "API YouTube/TikTok đổi" trong khi thực ra là proxy trung gian hỏng.
- Không phải mọi số liệu trên trang đều real-time thật — chỉ tên hiển thị (display name) được lấy qua oEmbed; các số liệu thống kê khác cần đọc kỹ code trước khi khẳng định là live hay mô phỏng.
