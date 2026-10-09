---
name: browser-testing
description: Cách kiểm chứng thay đổi trên trình duyệt thật trong repo này — bộ công cụ dùng chung .claude/tools (server tĩnh, harness Playwright có mock dữ liệu, seed localStorage, giả lập app Màn hình chính, báo cáo lỗi console/tràn ngang/vùng chạm), các công thức test số liệu đã dùng thật, và giới hạn của Chromium với lỗi chỉ-iPhone. Dùng khi cần chạy thử app, viết test Playwright, xác minh số liệu tính toán, chụp ảnh giao diện, hoặc trước khi tuyên bố "đã hoạt động".
---

# Kiểm chứng trên trình duyệt

**Chạy thật rồi mới kết luận.** Mọi lỗi nghiêm trọng của repo này (lỗi TDZ làm chết cả script, radar chart bị JS cũ ghi đè, keyframe bị xoá nhầm, số liệu lịch lệch tổng…) đều chỉ lộ ra khi chạy trình duyệt — đọc code và `node --check` đều không thấy.

## 1. Chuẩn bị (một lần mỗi máy, ~2 giây)

```bash
npm install --prefix .claude/tools --no-audit --no-fund   # Playwright 1.63.0, node_modules đã gitignore
```
Trình duyệt Chromium 1243 đã có sẵn trong `%LOCALAPPDATA%/ms-playwright`. **Đừng** chạy `npx playwright install` khi chưa cần (từng treo ~50 phút ở bước ghi chrome.exe). Chỉ khi báo thiếu trình duyệt mới cài: `npx --prefix .claude/tools playwright install chromium`.

## 2. Server

```bash
bash .claude/tools/serve.sh start        # cổng 8813, gốc = repo, chờ tới khi trả 200
bash .claude/tools/serve.sh stop         # giết MỌI tiến trình đang nghe cổng đó
```
Luôn `stop` khi xong — server sót lại từ phiên trước từng chiếm cổng và phục vụ file cũ (đã gặp 4 tiến trình cùng nghe 8813). Nếu nhiều phiên cùng test, dùng cổng khác (`start 8820`).

## 3. Harness — `.claude/tools/harness.js`

Viết script test vào **scratchpad** (không để rác trong repo), `require` harness bằng đường dẫn tuyệt đối:

```js
const h  = require('<repo>/.claude/tools/harness.js');
const gt = require('<repo>/.claude/tools/fixtures/goldtrack.js');   // kịch bản chuẩn + số kỳ vọng + selector
(async () => {
  const s = await h.open({
    port: 8830,                       // hoặc chạy script với PORT=8830 — phải khớp cổng của serve.sh
    now: gt.now,                      // CỐ ĐỊNH "hôm nay" — không có thì số kỳ vọng theo ngày sẽ sai khi chạy sang tháng khác
    device: 'narrow',                 // narrow 390×844 | iphone14promax 430×932 | iphone14promaxStandalone 430×873 | desktop 1440×900
    colorScheme: 'light',             // chạy lại với 'dark'
    path: '/products/gold-track/html/index.html',
    mocks: gt.mocks,                  // { 'data/gold-price.json': {...}, 'data/gold-price-history.json': {...} }
    localStorage: gt.localStorage     // seed 1 lần, reload vẫn giữ
  });
  console.log(await h.text(s.page, gt.sel.overviewTotal), '== +' + gt.expected.totalPL.toLocaleString('vi-VN') + ' đ');
  console.log(JSON.stringify(await h.report(s)));   // errors, failedRequests, tràn ngang, vùng chạm <44px (có nhãn + tổng số)
  await s.close();
})();
```

**`fixtures/goldtrack.js`** chứa: shape của 2 file giá và của giao dịch trong localStorage (đọc comment đầu file — khỏi phải lục `gold-track.js`), kịch bản chuẩn, bảng `expected` đã tính tay (tổng quan, từng ô lịch, dòng chi tiết, dòng tháng, dòng chưa chốt), và `sel` — các selector hay dùng (tổng lãi/lỗ, các nút chế độ, ô lịch `[data-cal-day=YYYY-MM-DD]`, tab, dòng giao dịch, dòng chẩn đoán). Kịch bản khác thì copy file này rồi sửa, giữ nguyên cách ghi `expected`.

- Service worker bị **chặn mặc định** để không dính bản cache cũ. Test offline thì `blockSW:false`, load online một lần, `s.context.setOffline(true)`, reload.
- Mock luôn cả file giá khi test số liệu — dữ liệu thật do bot ghi đổi liên tục, số kỳ vọng sẽ lệch.
- `h.report()` chỉ tính phần tử **đang hiện trên màn hình** (sheet/dialog đóng không bị tính), ghi nhãn dạng `#cha > "chữ trên nút" = 28px` kèm tổng số.
- Kích thước kiểm tối thiểu: 390px; thêm 1440px khi task đụng tới layout; thêm `colorScheme:'dark'` khi đụng tới màu.

## 4. Công thức test đã dùng thật

**Số liệu tài chính — dựng kịch bản tính tay TRƯỚC, so từng con số.** Kịch bản chuẩn trong `fixtures/goldtrack.js` (mua 2 chỉ @13,1tr 20/09, bán 1 chỉ @13,3tr 23/09, giá hôm nay 13,15tr khác điểm lịch sử cuối 13,1tr):
- lịch theo ngày: 20 −200k · 22 +400k · 23 +100k (đã chốt +200k) · 24 −100k · 27 +50k → tổng tháng +250k = "Tổng lãi/lỗ" ở Tổng quan
- theo tháng: "Tháng 9/2026 +200.000 đ" (chỉ lãi đã chốt) + dòng "Chưa chốt (theo giá hôm nay) +50.000 đ"
- tổng ở Lịch sử **phải bằng** Tổng quan.
Đã kiểm với app v1.58: 0 lệch.
Báo cáo cả số thực nhận và số kỳ vọng — "khớp" không kèm số là không chấp nhận.

**Kịch bản kỳ vọng tự tính có thể sai.** Tester từng phát hiện đề bài cộng sai (40,6tr thay vì 39,6tr) — khi lệch, tự tính lại độc lập trước khi kết luận app sai.

**Hai giá phải phân biệt được:** khi kiểm logic "chỉ dùng giá hôm nay cho hôm nay", mock giá hiện tại **khác** điểm lịch sử cuối cùng — nếu hai giá bằng nhau thì test không chứng minh được gì.

**Chứng minh fix phân biệt được code cũ/mới:** dựng dữ liệu mà code cũ cho kết quả khác code mới (lấy code cũ bằng `git show HEAD:<file>` để đối chiếu). Test chỉ "không lỗi" thì chưa chứng minh fix có tác dụng.

**Gọi hàm nội bộ trong IIFE:** không truy cập được từ `window`. Dùng `page.route` chặn file JS và chèn `window.__fn = fn;` trước `})();` cuối file để lấy kết quả chính xác, thay vì đọc toạ độ SVG.

**Chụp ảnh và XEM ảnh** (Read file png) với mọi thay đổi giao diện; kiểm đúng tên file mới, đừng đọc nhầm ảnh cũ.

**Đếm chữ hiển thị** (mục tiêu "bớt chữ"): đếm `innerText` của header + view đang hiện + sheet đang mở, **ẩn `.sr-only` trước khi đếm** (chữ cho trình đọc màn hình không phải chữ hiển thị). Nội dung trong `<details>` đóng có `innerText` rỗng — đọc bằng `textContent` khi cần kiểm nội dung.

**Bug hunt (tester khám phá, không xem báo cáo coder):** đã tìm ra lỗi mất dữ liệu mà coder tự test bỏ sót. Kịch bản luôn thử: `visibilitychange` khi form đang mở (`page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))})` rồi đổi lại `visible`), request chậm bằng `page.route` + delay (race đồng bộ), hoàn tác bằng **cú chạm thật** (`page.mouse.click` vào toạ độ nút, không gọi hàm), Esc rồi Enter, múi giờ `America/Los_Angeles`/`Asia/Tokyo` lúc ngày máy ≠ ngày VN, ranh giới 14:59/15:00 và 06:59/07:00/21:59/22:00 giờ VN, dữ liệu 200–300+ bản ghi, tên 40 ký tự + emoji, offline với `?fbclid=x` và URL thư mục. Xem skill `user-data-safety` §7.

**Thông báo đẩy / service worker:** Playwright headless-shell mặc định luôn báo quyền thông báo `denied` → dùng `chromium.launch({channel:'chromium'})` (headless mới) cho test `showNotification`, và CDP `ServiceWorker.deliverPushMessage` để giao push. Push server giả + giải mã `http_ece`, venv pywebpush: skill `web-push` §7.

## 5. Giới hạn: lỗi chỉ xuất hiện trên iPhone

Chromium **không** tái hiện: `env(safe-area-inset-*)` thật, viewport hụt của app Màn hình chính với `black-translucent`, việc WebKit cắt phần tử vẽ ngoài viewport, bàn phím ảo, **phông chữ iOS** (Windows có Cambria/Georgia mới nên chữ số luôn trông đúng).

Làm được:
- `h.simulateStandalone(page)` — chạy nhánh code standalone (ghi đè `navigator.standalone`, `screen.height`).
- Tắt `font-variant-numeric` rồi so Georgia với stack phông mới để thấy số old-style.
- Kiểm CSS/meta đúng thiết kế, không lỗi, không vỡ layout ở 430×873.

Kết luận phải ghi **"chưa kiểm chứng trên máy thật"** và nêu số người dùng cần chụp (GoldTrack: dòng chẩn đoán cuối tab Cài đặt). Một lần "sửa" dựa trên giả lập đã làm hỏng thanh menu thật (GoldTrack v1.53) — giả lập chỉ chứng minh code chạy, không chứng minh iOS hiển thị đúng.

## 6. Windows

- `print` tiếng Việt trong Python crash (cp1252) — ghi file UTF-8 rồi Read, hoặc chạy với `PYTHONUTF8=1` (giống runner Ubuntu của GitHub Actions — nên đặt khi mô phỏng workflow).
- Nhiều agent chạy song song: mỗi agent một cổng riêng (`serve.sh start <port>` / `stop <port>`); **không bao giờ** `serve.sh stop` không kèm cổng — nó giết server của agent khác.
- Heredoc bash nuốt backslash: tránh regex/đường dẫn có `\` trong script sinh bằng heredoc; dùng `/` hoặc viết file bằng Write.
- `/tmp` của Git Bash khác `/tmp` mà Python/Node thấy — dùng scratchpad với đường dẫn Windows đầy đủ.
