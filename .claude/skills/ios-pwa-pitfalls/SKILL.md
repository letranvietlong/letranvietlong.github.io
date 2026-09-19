---
name: ios-pwa-pitfalls
description: Cạm bẫy khi làm web app chạy như app trên iPhone (Add to Home Screen / standalone PWA) — safe area, chiều cao viewport, bàn phím ảo, service worker scope, bug render của WebKit. Dùng khi sửa lỗi giao diện chỉ xuất hiện trên iPhone thật, lỗi thanh menu/header bị lệch, lỗi offline, hoặc khi thấy "sửa mãi không hết".
---

# Cạm bẫy iOS / PWA

Tài liệu này ghi lại các nguyên nhân **đã được xác minh bằng thực nghiệm** trong repo này, sau nhiều vòng sửa sai. Đọc trước khi đoán nguyên nhân mới.

## 1. Khoảng trống ở đáy màn hình thường KHÔNG phải bug

Trên iPhone dùng Face ID, iOS luôn chừa vùng an toàn cho **thanh cử chỉ Home** (~34pt). Mọi app đều có, kể cả app native của Apple. Không CSS nào bỏ được.

**Trước khi sửa, hãy phân biệt:**
- Khoảng trống **dưới** thanh menu (lộ nền trang giữa menu và cạnh máy) → có thể là bug thật.
- Khoảng trống **trên** thanh menu (giữa nội dung cuối và menu) → thường chỉ là nội dung ngắn, bình thường.

Cách hỏi người dùng cho dứt điểm: *"khoảng trống nằm trên hay dưới thanh menu?"* và *"luôn luôn xảy ra hay chỉ sau thao tác nào đó?"*. Câu trả lời "luôn luôn" loại bỏ toàn bộ nhóm nguyên nhân chập chờn (cache cũ, kẹt viewport), tiết kiệm được nhiều vòng sửa mò.

Thứ **có thể** thu gọn: padding/icon/min-height của chính thanh menu (giữ vùng chạm ≥ 44px). Thứ **không** thu gọn được: `env(safe-area-inset-bottom)`.

## 2. `position: fixed` không phụ thuộc chiều cao CSS của body

Phần tử `position:fixed; bottom:0` bám theo **viewport thật của trình duyệt**, không phải theo `body{height:...}`. Nên sửa `100dvh`/`--app-height` thường **không** ảnh hưởng vị trí thanh menu cố định — trừ khi có tổ tiên mang `transform`/`filter`/`will-change` (khi đó containing block đổi, fixed sẽ bám theo phần tử đó).

Kiểm tra nhanh trước khi sửa: `document.querySelector('.tabbar').getBoundingClientRect().bottom === window.innerHeight`?

## 3. `100dvh` có thể kẹt sau khi đóng bàn phím ảo

Sau khi input mất focus và bàn phím thu lại, `100dvh` trên iOS đôi khi giữ nguyên kích thước lúc bàn phím còn mở. `visualViewport` thì bắn sự kiện `resize` đáng tin cho đúng chuyển đổi đó.

```js
function syncAppHeight(){
  if(!window.visualViewport) return;
  document.documentElement.style.setProperty('--app-height', window.visualViewport.height + 'px');
}
syncAppHeight();
window.visualViewport && window.visualViewport.addEventListener('resize', syncAppHeight);
// Khoá/mở màn hình hoặc chuyển app KHÔNG chắc bắn visualViewport.resize:
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible') syncAppHeight();
});
```

CSS đi kèm — để `var()` thắng sau cùng, có fallback cho frame đầu:
```css
body{ height:100dvh; height:var(--app-height, 100dvh); }
```

## 4. Service worker: scope bị khoá theo thư mục

Service worker **chỉ điều khiển được trang ngang hàng hoặc nằm dưới thư mục chứa nó**.

Đã kiểm chứng bằng thực nghiệm — đăng ký `/js/sw.js` với `{scope:'/'}` ném:
```
SecurityError: The path of the provided scope ('/') is not under the max scope allowed ('/js/').
```
Mở rộng scope cần HTTP header `Service-Worker-Allowed`, mà **GitHub Pages không cho tuỳ chỉnh header**. → File service worker phải nằm ở root.

## 5. Service worker cache-first làm kẹt bản cũ

File HTML/CSS/JS đang sửa thường xuyên mà để **cache-first** thì mỗi lần mở app đều phục vụ bản cũ trong cache, che hết mọi bản sửa sau đó — triệu chứng: *"đã deploy rồi mà web vẫn là bản cũ"*.

- Code hay đổi (HTML/CSS/JS) → **network-first**, cache chỉ làm dự phòng khi offline.
- Asset bất biến (icon) → cache-first.
- Thêm file mới app load lúc chạy → **phải** thêm vào danh sách cache **và bump `CACHE_NAME`**, nếu không client cũ giữ nguyên danh sách cũ.
- Cache HTML mà quên CSS/JS → offline lên trang trắng/không style.

## 6. `position:sticky` + `transform` ở phần tử con = lỗi render WebKit

Cho `transform` (kể cả `transform: scale()` để thu nhỏ khi cuộn) vào **con** của một phần tử `position:sticky` khiến Safari iOS render phần tử sticky **tách rời, trôi lơ lửng giữa nội dung** khi đang cuộn.

Cách né: đổi sang `position:fixed` + chừa khoảng trống bằng `padding-top` cho vùng cuộn, hoặc bỏ hẳn hiệu ứng transform.

## 7. Đổi layout khi cuộn làm "đánh nhau" với ngón tay

Phần tử **nằm trong luồng cuộn** mà tự thu nhỏ theo `scroll` (đổi `height`/`padding`/`font-size`) sẽ làm `scrollHeight` giảm ngay giữa lúc người dùng đang cuộn → vị trí cuộn bị kéo ngược, cảm giác giật.

Dấu hiệu nhận biết: đặt `scrollTop = 100` nhưng đọc lại chỉ được ~79.

Cách né: dùng `transform`/`opacity` (chỉ ảnh hưởng lúc vẽ, không đổi layout box) — **nhưng xem mục 6**, đừng dùng bên trong `position:sticky`.

## 8. Icon "Add to Home Screen" giữ cấu hình cũ

iOS ghi lại một phần cấu hình hiển thị (`viewport-fit=cover`, `apple-mobile-web-app-*`) **tại thời điểm tạo icon**. Sửa meta tag sau đó không tự cập nhật cho icon cũ. Nếu nghi ngờ: xoá icon, mở lại bằng Safari, Add to Home Screen lại.

## 9. Kiểm thử: những gì Chromium headless KHÔNG mô phỏng được

Playwright/Chromium **không** tái hiện: `env(safe-area-inset-*)` thật, bàn phím ảo iOS, quirk `100dvh` của WebKit, lag compositing khi `-webkit-overflow-scrolling:touch`.

→ Vẫn test được: giá trị computed style, thứ tự DOM, có tràn ngang không, service worker + offline, logic JS. Nhưng với lỗi chỉ xuất hiện trên máy thật, hãy **nói rõ là chưa kiểm chứng được** thay vì khẳng định đã sửa xong.
