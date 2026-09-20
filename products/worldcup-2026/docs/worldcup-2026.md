# FIFA World Cup 2026 Fan Site

Lịch thi đấu đầy đủ 104 trận, tỷ số trực tiếp, bảng xếp hạng 12 bảng, nhánh knockout, đánh giá đội tuyển, tin tức.

## Cấu trúc thật

- Đã tách css/js. `html/index.html` giữ inline 2 nhóm nhỏ: script chống FOUC (set `data-theme` từ `localStorage` trước khi CSS áp dụng — phải chạy đồng bộ trước paint, tách ra ngoài sẽ mất tác dụng) và 4 block `<script type="application/ld+json">` (structured data SEO).
- **Không có service worker.** Manifest được sinh **động bằng JavaScript** (`setupPWA()` trong `js/worldcup-2026.js`), gắn vào `<head>` qua `data:application/manifest+json` — không phải file `manifest.json` tĩnh như GoldTrack/ThubeeFarmery.
- `<link rel="canonical">`/`og:url`/JSON-LD của trang này trỏ tới domain **ngoài** `worldcup2026.fan` — đây là domain khác, không phải GitHub Pages, KHÔNG được đổi theo khi restructure path nội bộ của repo này.

## Cạm bẫy đặc thù

- Đây là ví dụ tham chiếu cho ngưỡng "khi nào tách css/js" trong skill `project-structure` (từng tách khi đạt ~1,987 LOC) — nhưng quy tắc hiện tại không còn dựa ngưỡng LOC nữa, mọi sản phẩm html-only đều tách nếu có nội dung đáng kể.
- `setupPWA()`'s `start_url` là đường dẫn **tương đối** (`./index.html`) — nếu di chuyển `html/index.html` sang vị trí khác, phải sửa giá trị này (đã từng bị bỏ sót một lần khi restructure `worldcup2026/worldcup2026.html` → `worldcup-2026/html/index.html`).
- Đổi tên biến/hằng nội bộ JS không nằm trong phạm vi "đổi tên file" — tránh refactor lạc đề khi chỉ được giao sửa path.
