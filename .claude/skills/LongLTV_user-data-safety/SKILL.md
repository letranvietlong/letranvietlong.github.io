---
name: LongLTV_user-data-safety
description: Quy tắc giữ an toàn dữ liệu người dùng lưu trên máy (localStorage/IndexedDB) trong các app iPhone của repo — đồng bộ Gist không ghi đè sửa đổi cục bộ, làm mới nền không được ghi đè form đang mở, xoá/sửa sổ sách phải kiểm tra ràng buộc, sao lưu/khôi phục an toàn, dữ liệu hỏng không bao giờ bị ghi đè, ngày giờ luôn theo giờ VN. Dùng khi sửa bất cứ đường nào ghi/đọc/đồng bộ/nhập/xuất dữ liệu người dùng (GoldTrack, FuelTrack Sổ xăng, LoveDays, ThubeeFarmery) hoặc khi thêm form nhập liệu.
---

# An toàn dữ liệu người dùng

Mỗi mục dưới đây là một lỗi **đã xảy ra thật** (hoặc tester đã tái hiện) trong repo. Dữ liệu người dùng chỉ nằm trên máy (app Màn hình chính có bộ nhớ riêng, xoá icon là mất — `LongLTV_ios-pwa-pitfalls` §14), nên mất là mất hẳn.

## 1. Đồng bộ (GoldTrack ↔ GitHub Gist, "ghi sau thắng")

- **"Giữ dữ liệu máy này" phải đẩy lên ngay** (hoặc đánh dấu dirty) trước khi bất cứ thứ gì có thể kéo về. Lỗi thật: chọn "Giữ máy này" chỉ lưu cấu hình → lần mở sau app kéo bản Gist đè mất dữ liệu máy.
- **Không áp bản kéo về nếu có sửa đổi cục bộ sau khi request bắt đầu.** Dùng bộ đếm/thời điểm thay đổi cục bộ; nếu đổi trong lúc GET đang bay → bỏ bản kéo về, giữ dirty, đẩy lên. Lỗi thật: thêm giao dịch lúc GET chậm 2,5s → bản cũ đè lên, cờ dirty bị xoá → lần sửa sau đẩy bản cũ → giao dịch mất cả hai nơi.
- **Đánh đổi còn lại (ghi sau thắng):** khi bỏ bản kéo về vì có sửa cục bộ, bản local được đẩy đè Gist — thay đổi mà máy khác vừa đẩy lên trong đúng khoảng thời gian GET đang bay sẽ mất khỏi Gist. Cửa sổ rủi ro chỉ bằng thời gian một request; muốn hết hẳn phải gộp theo id (chưa làm). Đừng mô tả cơ chế hiện tại là "không bao giờ mất".
- Field cấp tài liệu đặt ngoài mảng dữ liệu chính sẽ bị máy chạy bản cũ xoá khi nó đẩy lên → không lưu cấu hình/người/khoá push trong Gist; dữ liệu mới thêm vào bản ghi (vd `owner`) phải được đọc với mặc định an toàn (`txOwner()`), không ghi lại hàng loạt lúc load (tránh push dồn dập từ mọi máy).

## 2. Làm mới nền không được đụng vào form đang mở

- iOS bắn `visibilitychange` mỗi lần quay lại app (người dùng chuyển sang Ảnh/Tin nhắn để xem hoá đơn rồi quay về). Mọi handler tải lại dữ liệu khi đó **không được ghi đè giá trị người dùng đã chọn/nhập, hay giá trị lấy từ bản ghi đang sửa**. Chỉ được điền vào ô **trống chưa từng được đặt**, và không bao giờ tự tính lại tiền/lít. Lỗi thật FuelTrack: quay lại app → giá đổi 26.560→27.700, tiền 53.120→55.400 âm thầm; sửa ghi chú một lần đổ → tiền 100.000→99.998.
- Sửa một bản ghi: số tiền đã trả/số lượng là **sự thật**; đổi ngày/loại chỉ được *gợi ý* giá mới, không tự viết lại tiền. Khi người dùng nhập cả hai ô (lít và tiền) thì giữ cả hai, suy ra ô thứ ba.
- Tương tự với timer định kỳ (`setInterval`) render lại: không render lại form/ô đang có focus.

## 3. Sổ sách có ràng buộc (bán ≤ đang giữ)

- Kiểm tra ràng buộc ở **mọi** đường thay đổi: thêm, sửa (cả nhóm cũ khi đổi người/tiệm/loại), **xoá** (xoá lệnh mua mà lệnh bán sau phụ thuộc → chặn với lời giải thích; lỗi thật GoldTrack), nhập file.
- Chỉ chặn khi thay đổi **tạo ra hoặc làm nặng thêm** vi phạm (so trước/sau). Dữ liệu cũ đã lệch sẵn thì vẫn phải sửa được các dòng khác (lỗi thật: sửa ghi chú cũng bị chặn).
- Thứ tự sắp xếp dùng cho kiểm tra phải là **thứ tự toàn phần, bắc cầu** (ngày → số km/null nhất quán → createdAt → id). Lỗi thật FuelTrack: so sánh không bắc cầu làm cùng dữ liệu, khác thứ tự mảng, lúc hợp lệ lúc bị coi là hỏng.
- Nút "Hoàn tác" sau xoá phải thật sự bấm được (lỗi thật: `pointer-events:none` từ wrapper toast → mọi lần xoá thành vĩnh viễn) — test bằng cú chạm thật, không gọi hàm.

## 4. Sao lưu / khôi phục

- Mẫu đã dùng: `parseBackup` (app/kind/version, schema từng bản ghi, ngày có thật và không ở tương lai, id `^[\w-]+$`, giới hạn độ dài/kích thước) → `dryRun` (chạy các phép tính hiển thị trên dữ liệu ứng viên) → ghi có rollback → dọn dẹp. Mẫu tham chiếu: ThubeeFarmery (`thubee-farmery.ts`), LoveDays (`love-days-backup.js`, staging + một transaction cuối), FuelTrack (`fuel-track-log.js`).
- Tra cứu id bằng `Map`/`Object.create(null)`/`hasOwnProperty`, không dùng object thường (`"toString"`, `"constructor"` lọt qua).
- Giới hạn khi **xuất** phải bằng giới hạn khi **nhập** (lỗi thật: xuất được file không nhập lại được).
- Khôi phục đè lên dữ liệu hiện có (kể cả chỉ có xe/hồ sơ tuỳ chỉnh, không chỉ bản ghi chính) → bước "lưu bản hiện tại trước" bằng `navigator.share({files})` **ngay trong cú chạm**; chỉ ghi đè sau khi share thành công.
- Sau khôi phục trên máy mới: gọi `navigator.storage.persist()` (lỗi thật LoveDays chỉ gọi khi setup/thêm ảnh).
- Tên file theo ngày VN.

## 5. Dữ liệu hỏng / không mở được bộ nhớ

- Đọc lỗi ≠ chưa có dữ liệu. Đọc lỗi → banner + "Tải lại app", **không** hiện màn hình setup (người dùng nhập lại sẽ ghi đè hồ sơ thật). Không mở được IndexedDB → cũng không hiện setup; chế độ bộ nhớ tạm không được cho xuất "bản sao lưu" rỗng trông như thật.
- Bản ghi hỏng: bỏ qua + đếm + báo; không xoá, không ghi đè. Log hỏng (FuelTrack): khoá nút thêm, cho khôi phục, lưu nguyên văn bản hỏng ra file trước khi khôi phục.
- Dọn dẹp theo "thế hệ" chỉ khi giá trị thế hệ được đọc hợp lệ từ bộ nhớ, không dùng giá trị mặc định thay thế.

## 6. Ngày giờ

- Mọi "hôm nay", nhóm theo tháng, ngày mặc định trong form, tên file, so sánh "tương lai" đều theo **giờ VN (UTC+7)**: `Date.now()+7h` rồi đọc bằng `getUTC*`, hoặc phép tính ngày nguyên trên UTC. Không dùng `getDate/getMonth/getFullYear/toLocaleDateString` không truyền timeZone, `new Date('YYYY-MM-DD')`, `valueAsDate`, và không cộng `86400000` vào Date giờ máy (sai qua DST). Test bằng `timezoneId` America/Los_Angeles và Asia/Tokyo tại thời điểm ngày máy ≠ ngày VN.
- Ngày có điều chỉnh giá (FuelTrack): giá mới áp dụng từ 15:00 → có 2 giá trong ngày; nếu bản ghi điều chỉnh có `detectedAt` lúc nửa đêm thì cả ngày là giá mới.

## 7. Cách test bắt buộc cho đường dữ liệu

Mỗi sửa đổi đường dữ liệu cần một test **thất bại với code cũ và đạt với code mới** (in số trước/sau). Kịch bản tối thiểu: thao tác trong lúc request chậm (route delay), `visibilitychange` khi form mở, hoàn tác bằng cú chạm thật, khôi phục file lỗi từng loại (dữ liệu không đổi), múi giờ khác VN, reload giữa chừng.
