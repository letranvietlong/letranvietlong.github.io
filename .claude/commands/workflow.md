---
description: Chạy full pipeline Planning → Coding → Testing → Reviewing cho một yêu cầu
---

Thực hiện yêu cầu sau bằng pipeline 4 bước tuần tự, **chạy lần lượt, mỗi bước nhận kết quả của bước trước**:

**Yêu cầu:** $ARGUMENTS

---

### Bước 1 — Planning
Gọi agent `planner` (chạy foreground, vì bước sau phụ thuộc kết quả).
Truyền cho nó: yêu cầu đầy đủ ở trên + bối cảnh liên quan.
Nhận về: kế hoạch có file/dòng cụ thể, rủi ro, cách kiểm chứng.

→ Tóm tắt kế hoạch cho người dùng bằng 2-3 dòng trước khi sang bước 2.

### Bước 2 — Coding
Gọi agent `coder` (foreground).
Truyền cho nó: **kế hoạch cụ thể** từ bước 1 (không phải câu "làm theo kế hoạch" — phải copy nội dung kế hoạch vào prompt, vì agent mới không thấy được kết quả agent trước).
Nhận về: danh sách file đã sửa + những gì chưa được kiểm chứng.

→ Tự đọc lại diff (`git diff`) để xác nhận nó sửa đúng thứ đã định, trước khi sang bước 3.

### Bước 3 — Testing
Gọi agent `tester` (foreground).
Truyền cho nó: thay đổi vừa làm + **điều cần chứng minh** (tiêu chí kiểm chứng từ bước 1).
Nhận về: PASS/FAIL kèm số liệu thật.

→ Nếu FAIL: quay lại bước 2 với thông tin lỗi, sửa rồi test lại. Lặp tối đa 2 vòng, sau đó báo người dùng nếu vẫn chưa xong.

### Bước 4 — Reviewing
Gọi agent `reviewer` (foreground).
Nhận về: danh sách phát hiện xếp theo mức nghiêm trọng.

→ Mục 🔴 thì sửa ngay rồi test lại. Mục 🟡 thì báo người dùng quyết định.

---

## Lưu ý khi điều phối

- **Mỗi agent khởi động từ con số 0**, không thấy hội thoại này và không thấy kết quả của agent trước. Prompt gửi cho chúng phải tự chứa đầy đủ thông tin (file, dòng, số liệu, tiêu chí).
- **Chạy foreground** (`run_in_background: false`) vì các bước phụ thuộc nhau tuần tự.
- **Không tin lời báo cáo suông**: agent nói "đã sửa" thì phải tự kiểm bằng `git diff`; agent nói "đã test pass" thì nhìn vào số liệu nó đưa ra.
- **Task quá đơn giản** (đổi text, đổi màu, sửa typo): nói thẳng với người dùng là không cần pipeline, làm trực tiếp cho nhanh — chạy 4 agent cho việc 1 dòng là lãng phí.
- Kết thúc: báo cáo gọn cho người dùng — đã làm gì, test ra sao, review còn gì tồn đọng.
