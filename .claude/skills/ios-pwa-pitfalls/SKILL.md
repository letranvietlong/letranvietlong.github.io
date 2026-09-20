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
Mở rộng scope cần HTTP header `Service-Worker-Allowed`, mà **GitHub Pages không cho tuỳ chỉnh header**. → File service worker phải nằm ở **cấp thư mục cha thấp nhất bao phủ đủ mọi trang/asset nó cần quản** — KHÔNG mặc định là root. Ví dụ GoldTrack chỉ cần quản chính nó nên vỏ nằm trong `products/gold-track/`, không phải repo root (xem skill `project-structure`). Chỉ đặt ở root khi thật sự cần quản nhiều sản phẩm cùng lúc.

**Di chuyển vỏ đã có registration thật trên site đang live**: trình duyệt người dùng cũ vẫn giữ registration ở scope cũ tới khi bị unregister — không tự hết hạn. Gọi `navigator.serviceWorker.getRegistrations()` và unregister registration có scope cũ trước khi đăng ký registration mới, nếu không người dùng cũ sẽ kẹt 2 service worker chồng nhau vô thời hạn.

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

## 9. Nav/menu cố định phải cộng thêm `env(safe-area-inset-top)`, không chỉ đáy

Mọi ví dụ về safe-area hay nhắc tới đáy màn hình (home indicator), nhưng phần **trên** cũng cần khi chạy standalone (thêm vào Home Screen) trên máy có notch/Dynamic Island — thanh nav cố định ở `top:0` sẽ bị che một phần bởi vùng đó nếu không cộng thêm inset.

```css
nav{
  height:calc(66px + env(safe-area-inset-top,0px));
  padding-top:env(safe-area-inset-top,0px);
  box-sizing:border-box;
}
```

**Mọi phần tử khác định vị theo chiều cao cố định của nav** (progress bar, dropdown menu, mobile-menu...) phải dùng cùng công thức `calc(<chiều cao nav gốc> + env(safe-area-inset-top,0px))`, không hardcode lại con số `66px` — nếu không chúng sẽ trồi lên nằm dưới nav (bị che khuất) đúng bằng độ cao của inset. Đã gặp thật: sửa nav xong quên sửa `#readingProgress` và `.mobile-menu` cũng đang hardcode `top:66px`.

`viewport-fit=cover` phải có trong thẻ `<meta name="viewport">` thì `env(safe-area-inset-*)` mới trả về giá trị thật (≠0) — thiếu nó, mọi `env()` đều bằng 0 và code vẫn chạy "bình thường" trên trình duyệt thường, chỉ lộ ra khi cài như PWA standalone trên máy có notch.

## 10. Ẩn phần tử fixed bằng `translateY(Npx)` cố định dễ sai khi nội dung đổi cao

Banner/toast ẩn bằng cách đẩy nó ra ngoài viewport theo pixel cụ thể (`transform:translateY(100px)`) chỉ đúng NẾU biết chính xác chiều cao phần tử. Nội dung dài hơn dự tính (dịch ngôn ngữ khác, thêm dòng) → phần tử cao hơn → phần dư vẫn lộ trong viewport dù đã "ẩn". Đã gặp thật: banner cao 125px, đặt `bottom:20px`, ẩn bằng `translateY(100px)` → vẫn hở 45px ở mép dưới màn hình trên MỌI trang.

Dùng phần trăm theo chính chiều cao phần tử thay vì pixel cố định — luôn đủ dù nội dung đổi cao:
```css
#banner{ transform:translateY(150%); }      /* ẩn, luôn đủ xa bất kể chiều cao thật */
#banner.show{ transform:translateY(0); }
```

## 11. `onclick="tenHam()"` gọi hàm chưa từng được định nghĩa — im lặng trên desktop, chỉ lộ khi bấm thật

Nút chỉ hiện ở một breakpoint/điều kiện cụ thể (ví dụ hamburger menu chỉ `display:flex` dưới `768px`) rất dễ có `onclick` trỏ tới hàm **chưa bao giờ viết** hoặc **đã xoá khi refactor** mà không ai phát hiện, vì:
- Không có lỗi lúc tải trang (`onclick` chỉ resolve khi thật sự click).
- Test tự động hay gọi thẳng hàm/route nội bộ (`showPage('games')`) thay vì bấm nút thật → bỏ qua toàn bộ đường đi qua `onclick`.
- Trên desktop, phần tử bị `display:none` nên không ai bấm thử.

Cách bắt lỗi này chỉ có một: **bấm thật bằng Playwright** (`page.click(selector)`) ở đúng viewport khiến phần tử đó hiển thị, rồi đọc `pageerror`/console — không audit code bằng mắt là đủ, vì "thấy có hàm tên `toggleMenu` trong code" không có nghĩa là hàm đó thực sự được định nghĩa (có thể chỉ là chuỗi trong `onclick=""`, không phải `function toggleMenu(){}` thật). Đã gặp thật: `onclick="toggleMenu()"` và `onclick="...;mobileNav(this);..."` tồn tại trong HTML nhiều thời gian mà không ai bấm thử trên viewport hẹp, hai hàm chưa từng được viết — menu di động hỏng hoàn toàn trên mọi điện thoại.

## 12. Vùng chạm (touch target) tối thiểu 44×44px — đo thật, đừng đoán từ CSS

`width`/`height` khai báo trong CSS không phải lúc nào cũng bằng kích thước chạm thật (padding/border/box-sizing có thể làm lệch). Đo bằng `getBoundingClientRect()` trên phần tử thật, không suy từ đọc CSS. Ngưỡng tối thiểu: **44×44px** (Apple HIG và WCAG 2.5.5 đều dùng mốc này) cho mọi nút/link có thể bấm trên di động — nút đóng modal, toggle ngôn ngữ, hamburger, nút trong banner/toast đều dễ bị bỏ sót vì trông "đủ lớn" bằng mắt nhưng đo ra dưới ngưỡng.

**Bẫy cụ thể đã gặp: khai báo `width:44px;height:44px` vẫn bị đo ra nhỏ hơn** khi phần tử là con của một container `display:flex` không đủ chỗ — flexbox tự co nó lại (`flex-shrink` mặc định là `1`) để cả hàng vừa khít, bất kể `width` đã khai báo. Đo ra 36.5px thay vì 44px dù CSS ghi rõ `width:44px`, và **không** gây tràn ngang trang (nên `scrollWidth === clientWidth` vẫn PASS, dễ đánh lừa rằng "không có gì sai"). Bắt buộc thêm `flex-shrink:0` (và tốt nhất cả `min-width`) cho bất kỳ phần tử kích thước cố định nào sống trong flex container có khả năng chật chỗ (nav, banner, toolbar).

## 13. Kiểm thử: những gì Chromium headless KHÔNG mô phỏng được

Playwright/Chromium **không** tái hiện: `env(safe-area-inset-*)` thật, bàn phím ảo iOS, quirk `100dvh` của WebKit, lag compositing khi `-webkit-overflow-scrolling:touch`.

→ Vẫn test được: giá trị computed style, thứ tự DOM, có tràn ngang không, service worker + offline, logic JS. Nhưng với lỗi chỉ xuất hiện trên máy thật, hãy **nói rõ là chưa kiểm chứng được** thay vì khẳng định đã sửa xong.
