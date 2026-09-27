---
description: Chạy full pipeline Planning → Coding → Testing → Reviewing cho một yêu cầu
---

Thực hiện yêu cầu sau bằng pipeline tuần tự, **mỗi bước nhận kết quả của bước trước**:

**Yêu cầu:** $ARGUMENTS

---

### Bước 0 — Phân loại và chuẩn bị (người điều phối tự làm)
- **Tầm thường** (đổi text/màu/thứ tự, typo): nói thẳng là bỏ qua pipeline, sửa trực tiếp, chạy nhanh một lần kiểm chứng bằng `.claude/tools` (skill `browser-testing`), rồi kết thúc.
- `git status --short`: ghi nhận file đã thay đổi từ trước — có thể của **một phiên khác** đang làm song song (xem `CLAUDE.md`). Không đụng tới chúng.
- **Lỗi chỉ trên iPhone thật**: trước hết lấy số đo thật (dòng chẩn đoán / đo trên ảnh người dùng gửi — skill `ios-pwa-pitfalls`), rồi mới lập kế hoạch sửa. Đoán mò đã từng làm hỏng thêm (GoldTrack v1.53).
- Yêu cầu mơ hồ ("nâng cấp", "thêm thông tin hữu ích") → hỏi người dùng chọn hướng cụ thể trước khi chạy agent.

### Bước 1 — Planning
Gọi `planner` (foreground) với yêu cầu đầy đủ + bối cảnh.
Được **bỏ qua** khi chính người điều phối vừa khảo sát code và đã có kế hoạch cụ thể (file:dòng, định nghĩa công thức, kịch bản số kỳ vọng) — nói rõ là đang bỏ qua và vì sao.
→ Chốt các mục "Cần quyết định": tự quyết nếu có đáp án kỹ thuật rõ, hỏi người dùng nếu là đánh đổi về sản phẩm. Tóm tắt kế hoạch 2-3 dòng cho người dùng.

### Bước 2 — Coding
Gọi `coder` (foreground). Prompt phải **tự chứa**: nội dung kế hoạch (dán vào, không viết "làm theo kế hoạch"), các quyết định đã chốt, kịch bản kiểm chứng kèm số kỳ vọng, danh sách "không được đụng", và có cần ghi commit message hay không (mặc định: không — người điều phối lo).
→ **Tự đọc `git diff`** xác nhận đúng thứ đã định; đọc mục "chỗ làm khác kế hoạch" của coder.

### Bước 3 — Testing
Gọi `tester` (foreground). Truyền: thay đổi vừa làm, **điều cần chứng minh**, kịch bản dữ liệu + bảng số kỳ vọng. Nhắc dùng `.claude/tools` (skill `browser-testing`).
→ Nếu coder đã tự chạy Playwright với số khớp tính tay, người điều phối có thể tự chạy lại script đó + một ca biên thay cho tester — nói rõ đã làm vậy.
→ FAIL: quay lại bước 2 với thông tin lỗi cụ thể. Tối đa 2 vòng, sau đó báo người dùng.

### Bước 4 — Reviewing
Gọi `reviewer` (foreground). Nếu người điều phối đã tự sửa thêm sau khi coder xong, **nêu rõ chỗ đó** để reviewer soi độc lập.
→ 🔴: sửa ngay rồi kiểm lại. 🟡 nhỏ và rõ ràng: sửa luôn. 🟡 cần đánh đổi: báo người dùng.

### Bước 5 — Kết thúc
- Thay đổi người dùng thấy được → đã bump `products/<tên>/data/changelog.json` chưa.
- Commit: ghi `.claude/hooks/.next-commit-message.txt`; **nếu có file của phiên khác** trong `git status` hoặc file message đã có nội dung lạ → tự `git add <file của mình>` + `git commit`, không ghi đè message của phiên kia.
- Báo người dùng gọn: đã làm gì, test ra sao (số thật), còn gì chưa kiểm chứng được (đặc biệt phần chỉ-iPhone) và việc người dùng cần làm.

---

## Lưu ý khi điều phối
- Mỗi agent khởi động từ con số 0 — prompt phải tự chứa file, dòng, số liệu, tiêu chí.
- Chạy foreground vì các bước phụ thuộc nhau.
- Không tin báo cáo suông: "đã sửa" → xem `git diff`; "test pass" → xem số liệu.
