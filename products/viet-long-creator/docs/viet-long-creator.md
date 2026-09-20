# VietLong Creator

Công cụ tạo video âm nhạc chuẩn YouTube/TikTok miễn phí, chạy hoàn toàn trên trình duyệt — 60+ template, beat sync tự động, xuất MP4 2K/1080p/720p, gợi ý AI cho mẫu/tiêu đề/hashtag.

## Cấu trúc thật

- File JS lớn nhất repo (~10,000 dòng) — được gộp từ **2 block `<script>` rời rạc** trong HTML gốc (một block chính + một block "VLC PATCH" vá lỗi sau) khi tách ra `js/viet-long-creator.js`. Thứ tự nội dung trong file JS vẫn giữ đúng thứ tự gốc — khai báo ở phần patch (phía sau file) chạy sau phần chính nhưng trước khi bất kỳ tương tác người dùng nào xảy ra, nên không có vấn đề về thứ tự.
- `<script type="application/ld+json">` (structured data) vẫn cố ý để inline trong `html/index.html`, không nằm trong file js đã tách.
- **Có 2 trang phụ CỦA sản phẩm này** (không phải sản phẩm độc lập): `html/privacy.html`, `html/terms.html` — trang pháp lý, mỗi trang có file CSS riêng nhỏ (`css/privacy.css`, `css/terms.css`). **`privacy.html` đã đăng ký với TikTok for Developers** — đổi URL của trang này là việc rủi ro cao, cần cân nhắc kỹ trước khi làm (đã từng đổi 2 lần trong lịch sử repo do restructure toàn site, mỗi lần đều phải nhớ cập nhật URL đã đăng ký ngoài).
- Có `<link rel="canonical">`, `og:url`, JSON-LD `"url"` tự tham chiếu chính trang — dễ sót nhất mỗi khi đổi cấu trúc file, vì trang tự trỏ về chính nó bằng URL tuyệt đối, grep theo pattern URL cũ để rà soát.
- Không có service worker, không có backend — mọi xử lý video chạy client-side.

## Cạm bẫy đặc thù

- Đừng tưởng file quá lớn thì phải chia nhỏ thêm — 1 file `js/viet-long-creator.js` duy nhất là đúng theo quy tắc hiện tại (mỗi sản phẩm 1 file css + 1 file js, gộp mọi block rời rạc theo thứ tự gốc), không tách thành nhiều file nhỏ theo module.
- `privacy.html`/`terms.html` đều có 2 chỗ tự tham chiếu URL của chính `viet-long-creator` (mô tả + footer) — khi đổi URL sản phẩm này phải sửa cả 2 file, không chỉ `html/index.html`.
