---
name: ui-craft
description: Chuẩn mực craft giao diện cho site này — token màu đã đo tương phản, bẫy tint chồng tint, chữ số tài chính, độ sâu/viền, chuyển động, và cách ĐO chất lượng bằng Playwright thay vì nhìn bằng mắt. Dùng khi thiết kế/sửa giao diện, chọn màu, thêm component mới, hoặc review UI trước khi giao.
---

# UI Craft

`ui-ux-pro-max` trả lời *"chọn phong cách/bảng màu nào"*. Tài liệu này trả lời câu khó hơn: **"vì sao cái này trông nghiệp dư, và sửa thế nào cho lên hạng"** — dựa trên số đo thật của repo này, không phải lý thuyết chung.

Nguyên tắc bao trùm: **đo, đừng nhìn**. Mắt người rất tệ trong việc phán đoán tương phản trên nền bán trong suốt. Mọi con số dưới đây đều lấy từ phép đo thật trên DOM đã render.

---

## 1. Token màu — giá trị đã kiểm chứng

Hai theme, chuyển theo cài đặt hệ thống, **không có nút đổi theme trong app**. Tối là "bản gốc", sáng chỉ override những gì cần lật.

| Vai trò | Tối | Sáng | Tương phản trên card |
|---|---|---|---|
| `--text` | `#F8FAFC` | `#171B2B` | 16,6 / 16,8 |
| `--muted` | `#A9B4CC` | `#5B6478` | 8,3 / 5,8 |
| `--muted2` | `#7C88A6` | `#6B7280` | 4,9 / 4,8 |
| `--gold2` (giá, link, tab active) | `#FBBF24` | `#A34608` | 9,0 / 5,5 |
| `--green` (lãi) | `#34D399` | `#047857` | 9,0 / 5,4 |
| `--red` (lỗ) | `#FB7185` | `#DC2626` | 6,4 / 4,7 |

**Bài học đã trả giá:** ở theme sáng, `--gold2` từng là `#D97706` (3,14:1) và `--green` từng là `#059669` (3,71:1) — tức **giá vàng và số lãi/lỗ, hai thông tin quan trọng nhất của app, đều dưới chuẩn**. Chữ 11–16px không đủ lớn để hưởng ngưỡng "chữ lớn" 3:1 (ngưỡng đó cần ≥24px thường hoặc ≥18,66px đậm).

> Màu accent đẹp trên nền tối gần như **luôn** fail trên nền sáng. Đừng bê nguyên bảng màu qua, phải đo lại từng màu.

## 2. Bẫy lớn nhất: tint chồng tint

Đây là lỗi tinh vi nhất và đã xuất hiện **hai lần** trong repo này.

Một chip/badge đặt **bên trong** một banner vốn đã có nền tint → hai lớp tint cộng dồn, nền bị đẩy về phía màu tint, và tương phản chữ tụt xuống. Càng tăng alpha cho "nổi" thì càng sai.

**Quy tắc: chip phải đi NGƯỢC hướng container.**

| | Banner (nền) | Chip đúng | Chip sai |
|---|---|---|---|
| Theme sáng | tint nhạt trên card trắng | **pill trắng** `rgba(255,255,255,.85)` | tint đậm hơn → 4,16:1 ✗ |
| Theme tối | tint sáng trên card tối | **nền tối đặc** `rgba(11,18,32,.55)` | tint đậm hơn → 3,70:1 ✗ |

Sau khi sửa: sáng 5,34 / 4,68 — tối 8,54 / 6,28. Cả hai đều PASS.

Hệ quả thiết kế: **đừng hardcode rgba của một theme rồi dùng chung cho cả hai**. Nền chip phải là token riêng theo theme (`--chip-up-bg` / `--chip-down-bg`), vì hướng điều chỉnh của hai theme là ngược nhau.

## 3. Chữ số tài chính

- **Bắt buộc:** `font-variant-numeric: lining-nums tabular-nums` trên `body`.
  Font serif (Cambria, Georgia, Times) mặc định dùng **old-style figures** — chữ số cao thấp so le như chữ thường (3/5/7/9 thụt xuống dưới baseline). Đọc văn xuôi thì đẹp, nhưng số tiền `13.760.000` trông như hỏng. `tabular-nums` thêm lợi ích: các chữ số cùng bề rộng nên cột số thẳng hàng và **không nhảy** khi giá cập nhật.
- Đơn vị (`đ/chỉ`, `%`) luôn nhỏ hơn và nhạt hơn con số — con số là thông tin, đơn vị là ngữ cảnh.
- Số tiền không bao giờ để font khác với phần còn lại chỉ vì "cho đẹp" — đặt `font-family:var(--font)` rõ ràng ở các class số để tránh bị input/button reset nuốt mất.

## 4. Độ sâu, viền, và cái bẫy hiệu ứng trang trí

- **Viền + shadow đi cùng nhau.** Shadow tạo độ cao; viền giữ mép rõ khi shadow chìm vào nền.
- Theme sáng cần viền **đậm hơn** nhiều so với cảm giác ban đầu: `rgba(15,23,42,.09)` gần như vô hình, phải lên `.18` mới đọc được mép card.
- Theme sáng dùng shadow nhẹ và rộng (`0 14px 36px rgba(15,23,42,.10)`); theme tối chịu được shadow sâu (`0 20px 60px rgba(0,0,0,.4)`).

**Bẫy đã gặp:** hiệu ứng glow trang trí ở góc card (`filter:blur()` + opacity) lan tới tận mép và **rửa trôi viền**, khiến viền trông như đứt quãng ngẫu nhiên quanh card. Cách sửa: đẩy glow ra xa mép, giảm cường độ, **và** tăng độ đậm viền — sửa một trong hai là chưa đủ.

## 5. Chuyển động

- Micro-interaction: **150–250ms**. Dưới 100ms là giật, trên 350ms là lề mề.
- Chỉ animate `transform` và `opacity`. Animate `width/height/padding/font-size` → reflow, giật, và **nếu phần tử nằm trong vùng cuộn thì nó đánh nhau với ngón tay người dùng** (đã gặp: đặt `scrollTop=100` chỉ nhận được 79).
- Vào nhanh ra chậm: `cubic-bezier(.32,.72,0,1)` cho sheet trượt lên — cảm giác iOS.
- **Cảnh báo:** đừng đặt `transform` động lên phần tử con của `position:sticky` — WebKit render sai (xem skill `ios-pwa-pitfalls`).
- Tôn trọng `prefers-reduced-motion`.

## 6. Công thức component kiểu iOS (đã chạy thật trong repo)

**Bottom sheet** — `position:fixed;bottom:0`, `border-radius:22px 22px 0 0`, `transform:translateY(calc(100% + 100px))` khi đóng, `max-height:88svh; overflow-y:auto`, padding đáy `calc(22px + var(--safe-bottom))`, có thanh kéo để vuốt đóng.

**Segmented control** — indicator là một pill **tách riêng** trượt bằng `transform:translateX()`, đo theo `offsetLeft/offsetWidth` của nút đang active. Phải định vị lại khi tab hiện ra (phần tử trong `display:none` có `offsetWidth = 0`).

**Tab bar** — `position:fixed;bottom:0`, padding đáy `calc(3px + var(--safe-bottom))`, vùng chạm **≥44px** (sàn của Apple, đừng xuống dưới). `transform:translateZ(0)` để tách lớp compositing.

**Card** — `--radius:22px` cho card lớn, `--radius-sm:14px` cho phần tử con. Giữ **hai bậc** bán kính thôi; ba bậc trở lên là nhìn lộn xộn.

**Empty state** — icon nhạt + một câu nói rõ **phải làm gì tiếp**, không phải "Không có dữ liệu". Phân biệt "chưa có gì" với "bộ lọc không khớp" — hai tình huống khác nhau, câu chữ phải khác nhau.

## 7. Dấu hiệu "chưa xong" thường bị bỏ quên

- [ ] Trạng thái rỗng, đang tải, và lỗi — đủ cả ba, không chỉ trạng thái đẹp.
- [ ] Nền bán trong suốt đã được kiểm tra trên **cả hai** theme.
- [ ] Chuỗi dài (tên cửa hàng, tiêu đề tin) có xuống dòng gọn không, hay đẩy vỡ layout.
- [ ] Số 0, số âm, số rất lớn hiển thị ra sao.
- [ ] Nút icon-only có `aria-label`.
- [ ] Tab đang chọn có `aria-current="page"`.
- [ ] Không có phần tử nào chỉ phân biệt bằng màu (thêm icon/mũi tên cho tăng/giảm).

## 8. Đo chất lượng bằng Playwright

Đoạn này quan trọng: nó tính tương phản **trên nền thật sau khi composite mọi lớp cha bán trong suốt** — điều mà DevTools thường báo sai.

```js
const report = await page.evaluate(() => {
  const parse = c => c.match(/[\d.]+/g).map(Number);
  function bgChain(el){
    const layers = [];
    for (let n = el; n; n = n.parentElement){
      const bg = parse(getComputedStyle(n).backgroundColor);
      const a = bg.length === 4 ? bg[3] : 1;
      if (a > 0) layers.push({ rgb: bg.slice(0,3), a });
      if (a === 1) break;
    }
    return layers.reverse().reduce((acc, l) =>
      l.rgb.map((c,i) => c*l.a + acc[i]*(1-l.a)), [255,255,255]);
  }
  const lum = c => { const f = c.map(v => { v/=255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2]; };

  return [...document.querySelectorAll('*')].filter(el =>
    el.children.length === 0 && el.textContent.trim()
  ).map(el => {
    const cs = getComputedStyle(el);
    const fg = parse(cs.color).slice(0,3), bg = bgChain(el);
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = (px >= 24 || (bold && px >= 18.66)) ? 3 : 4.5;   // ngưỡng WCAG
    return { text: el.textContent.trim().slice(0,28), px, bold,
             ratio: +ratio.toFixed(2), need, pass: ratio >= need };
  }).filter(r => !r.pass);
});
console.log('Chua dat WCAG AA:', report);
```

Chạy cho **cả hai theme** (`colorScheme: 'light'` và `'dark'`) và cho cả trạng thái lãi lẫn lỗ — nhiều phần tử chỉ render ở một trạng thái.

Các phép đo khác nên chạy kèm:
```js
// tràn ngang
document.documentElement.scrollWidth > document.documentElement.clientWidth
// vùng chạm quá nhỏ
[...document.querySelectorAll('button,a,[role=button]')]
  .filter(el => { const r = el.getBoundingClientRect();
                  return r.height && r.height < 44; })
  .map(el => el.textContent.trim().slice(0,20) + ' = ' + Math.round(el.getBoundingClientRect().height) + 'px')
```

## 9. Thứ tự ưu tiên khi cân nhắc đánh đổi

1. **Đọc được** — tương phản, cỡ chữ, vùng chạm. Không bao giờ hy sinh cho thẩm mỹ.
2. **Đúng** — số liệu hiển thị chính xác, trạng thái phản ánh đúng dữ liệu.
3. **Mượt** — không giật, không nhảy layout.
4. **Đẹp** — sau cùng, và thường tự đến khi ba mục trên đã chuẩn.
