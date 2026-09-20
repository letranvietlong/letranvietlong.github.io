# GoldTrack

Theo dõi giá vàng 9999 (nhẫn tròn) và tính lời/lỗ danh mục vàng đã mua. PWA cài được lên iPhone qua "Add to Home Screen".

## Cấu trúc thật (khác biệt so với mặt bằng chung)

- Đã tách css/js từ lâu — không có `<style>`/`<script>` inline trong `html/index.html`.
- **Có service worker thật** (duy nhất trong repo tính đến nay): `sw-gold-track.js` nằm ngay trong `products/gold-track/` (không lồng vào `js/`) — xem skill `project-structure` mục "Vỏ service worker bắt buộc ở đúng cấp thư mục nào?" để hiểu vì sao vị trí này bắt buộc. Logic thật ở `js/sw-core.js`, vỏ chỉ `importScripts` vào đó.
- Có `manifest.json` (Web App Manifest) — không tự khiến icon đã ghim trên iOS "tự sửa" nếu URL đổi (iOS ghim theo URL cụ thể, không đọc `start_url`).
- Dữ liệu (`data/*.json`) do 2 script Python trong `py/` tự cập nhật qua GitHub Actions (cron), KHÔNG sửa tay các file này.
- Đồng bộ nhiều thiết bị qua GitHub Gist (không có backend thật).

## Cạm bẫy đặc thù của GoldTrack (không phải cạm bẫy chung của repo)

- **Sổ sách mua/bán phải replay theo thứ tự thời gian** (`computePortfolio`). Đừng validate bằng tổng số dư bỏ qua ngày — từng gây bug lãi ảo khi bán lùi ngày (`findLedgerViolation` là hàm chống bug này, mọi thay đổi liên quan số lượng/ngày phải đi qua nó).
- **Lãi/lỗ phải tính trên lượng đã clamp** (`sellAmt`), không phải lượng thô (`tx.amount`) — dùng lượng thô sẽ bịa ra lợi nhuận trên vàng chưa từng bán.
- **Đồng bộ Gist có thể mất dữ liệu nếu không cẩn thận**: cờ `goldtrack_gist_dirty_v1` phải được tôn trọng lúc khởi động — có thay đổi chưa đồng bộ thì phải đẩy lên (push), không được kéo về (pull) đè mất.
- **Thêm file mới mà app load lúc chạy** (css/js/icon/data) → phải thêm path vào đúng mảng (`APP_CODE_PATHS`/`ICON_PATHS`/`DATA_PATHS`) trong `js/sw-core.js` **và** bump `CACHE_NAME` **và** bump `?v=` trong `sw-gold-track.js` cho khớp — thiếu 1 trong 3 bước này là app hỏng khi offline hoặc kẹt bản cũ.
- **Đơn vị giá**: nguồn (Ngọc Thịnh Jewelry) ghi giá theo VNĐ/**chỉ**, không phải lượng (1 lượng = 10 chỉ) — toàn app thống nhất dùng chỉ. Từng có bug hiểu nhầm đơn vị sai 10 lần.
- **`gold-track.js` tự dọn service worker cũ**: trước khi đăng ký SW mới, code unregister mọi registration có scope đúng bằng gốc origin (`location.origin + '/'`) — đây là dọn dẹp cho người dùng cũ từ thời SW còn đăng ký ở root repo (trước khi chuyển vào `products/gold-track/`). Đừng xoá đoạn này tưởng là code thừa.

## Quy trình vận hành

- **Đổi version + changelog**: mọi thay đổi người dùng thấy được (feature, fix, redesign — không phải refactor nội bộ) → bump field `"version"` + prepend entry vào `data/changelog.json` (tiếng Việt, mô tả cho người dùng). Chi tiết đầy đủ nằm trong `CLAUDE.md` ở root.
- **Lấy dữ liệu**: `py/fetch_gold_price.py` (giá) và `py/fetch_gold_news.py` (tin tức, lọc theo từ khoá) chạy qua `.github/workflows/*.yml`. Chi tiết cạm bẫy khi sửa script này (đơn vị, race condition khi commit, lịch cron không đáng tin) nằm trong skill `goldtrack-data-pipeline`.
