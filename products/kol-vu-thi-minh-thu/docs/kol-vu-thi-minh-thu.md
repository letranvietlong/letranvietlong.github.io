# KOL — Vũ Thị Minh Thư

Profile chuyên nghiệp cho KOL/Influencer — thông tin hợp tác, kênh truyền thông, gallery, dòng thời gian sự nghiệp.

## Cấu trúc thật

- Đã tách css/js (1 block style + 1 block script, không có nhiều block rời rạc như viet-long-crypto).
- **File nặng bất thường (~11.7 MB) do nhúng 39 ảnh base64 trực tiếp trong `html/index.html`** — đây là vấn đề dung lượng tải trang, KHÔNG liên quan gì tới việc tách css/js (tách css/js không giải quyết được vấn đề này). Nếu cần cải thiện tốc độ tải, phải xuất ảnh base64 ra file `.jpg`/`.png`/`.webp` riêng và load qua `<img src>` — là việc khác, quy mô lớn hơn, chưa làm.
- Không có service worker, không có `manifest.json`, không có backend.

## Cạm bẫy đặc thù

- File HTML rất lớn về **dung lượng byte** dù không quá nhiều **dòng** — công cụ đọc file theo dòng (Read tool) có thể vượt giới hạn token khi đọc cả file; dùng Python đọc theo số dòng cụ thể (`readlines()[a:b]`) thay vì đọc nguyên file khi cần khảo sát vùng nào đó.
- Đừng tưởng nhầm 39 ảnh base64 là bug cần sửa khi làm việc khác (ví dụ tách css/js) — đây là đặc điểm đã biết, ghi nhận nhưng chưa xử lý, ngoài phạm vi trừ khi được giao rõ.
