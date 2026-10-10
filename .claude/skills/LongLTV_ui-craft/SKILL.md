---
name: LongLTV_ui-craft
description: Chuẩn mực craft giao diện cho site này — token màu đã đo tương phản, bẫy tint chồng tint, chữ số tài chính (kể cả phông thiếu trên iPhone), biểu đồ, cách hiển thị lãi/lỗ không cộng trùng, độ sâu/viền, chuyển động, bảng Nên/Không nên về form, căn lề, câu chữ, màu theo nghĩa, vùng chạm, skeleton, chồng lớp (§12), và cách ĐO chất lượng bằng Playwright thay vì nhìn bằng mắt. Dùng khi thiết kế/sửa giao diện, làm form nhập liệu, hộp xác nhận, menu/tab bar, trạng thái tải, chọn màu/phông/gradient, vẽ biểu đồ, hiển thị số liệu tài chính, thêm component mới, hoặc review UI trước khi giao.
---

# UI Craft

`ui-ux-pro-max` trả lời *"chọn phong cách/bảng màu nào"*. Tài liệu này trả lời câu khó hơn: **"vì sao cái này trông nghiệp dư, và sửa thế nào cho lên hạng"** — dựa trên số đo thật của repo này, không phải lý thuyết chung.

Nguyên tắc bao trùm: **đo, đừng nhìn**. Mắt người rất tệ trong việc phán đoán tương phản trên nền bán trong suốt. Mọi con số dưới đây đều lấy từ phép đo thật trên DOM đã render.

Làm màn hình/form/component mới thì đọc **§12 (Nên / Không nên)** trước, soát bằng §12.7 trước khi giao; §1–§10 là chi tiết đã đo của repo.

---

## 1. Token màu — giá trị đã kiểm chứng

Hai theme, chuyển theo cài đặt hệ thống, **không có nút đổi theme trong app**. Tối là "bản gốc", sáng chỉ override những gì cần lật.

| Vai trò | Tối | Sáng | Tương phản trên card |
|---|---|---|---|
| `--text` | `#F8FAFC` | `#171B2B` | 16,6 / 16,8 |
| `--muted` | `#A9B4CC` | `#5B6478` | 8,3 / 5,8 |
| `--muted2` | `#8794B0` | `#646B78` | 5,7 / 5,3 (cũ `#7C88A6`/`#6B7280` chỉ 4,25–4,37 trên nền ô giá, ô lịch, tab bar) |
| `--gold2` (giá, link, tab active) | `#FBBF24` | `#A34608` | 9,0 / 5,5 |
| `--green` (lãi) | `#34D399` | `#047857` | 9,0 / 5,4 |
| `--red` (lỗ) | `#FB7185` | `#C81E1E` | 6,4 / 5,6 — trên nút nền `--red-soft` 4,6 (cũ `#DC2626` chỉ 3,89 ở nút "Xoá hết") |
| `--blue` (badge BÁN, sáng) | `#60A5FA` | `#1D4ED8` | sáng trên `--blue-soft` 5,5 (cũ `#2563EB` 4,25) |

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
- **`lining-nums` chỉ có tác dụng nếu phông THẬT SỰ có kiểu số thẳng hàng — và phông phải có trên iPhone.** iOS không có Cambria (phông của Windows/Office) → rơi về Georgia, mà Georgia bản iOS **chỉ có số old-style**, nên số tiền vẫn cao thấp dù CSS đúng. Trên Windows (có Cambria, Georgia mới có `lnum`) không bao giờ thấy lỗi này. Cách sửa đã chạy ở GoldTrack — một mặt phông chỉ cho chữ số, đặt đầu stack, chữ cái giữ nguyên:
  ```css
  @font-face{font-family:'App Digits';src:local('Cambria'),local('Times New Roman'),local('TimesNewRomanPSMT');font-weight:100 500;unicode-range:U+0030-0039}
  @font-face{font-family:'App Digits';src:local('Cambria Bold'),local('Cambria-Bold'),local('Times New Roman Bold'),local('TimesNewRomanPS-BoldMT');font-weight:600 900;unicode-range:U+0030-0039}
  --font:'App Digits',Cambria,Georgia,'Times New Roman',Times,serif;
  ```
  Tái hiện trên Windows: tắt `font-variant-numeric` rồi so Georgia với stack mới. Áp dụng cho **mọi** sản phẩm dùng stack serif bắt đầu bằng phông không có trên iOS.
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
- **Cảnh báo:** đừng đặt `transform` động lên phần tử con của `position:sticky` — WebKit render sai (xem skill `LongLTV_ios-pwa-pitfalls`).
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
- [ ] Số làm tròn về 0 không hiện "-0 đ" (chuẩn hoá -0) và không tô đỏ; `%` làm tròn đối xứng theo giá trị tuyệt đối (không để -0,005 → "0,00%" mà +0,005 → "+0,01%"); NaN/Infinity hiện "—", không hiện "0,00%". Dấu thập phân vi-VN là **phẩy** ở mọi chỗ (`toLocaleString('vi-VN')`, không `toFixed`).
- [ ] Cắt chuỗi theo **ký tự hiển thị** (Intl.Segmenter / Array.from), không `.slice()` UTF-16 — cắt đôi emoji ra "�" (lỗi thật ở ô emoji LoveDays, title thông báo).
- [ ] Toast có nút (Hoàn tác…): nút phải nhận cú chạm (`pointer-events:auto` dù wrapper là `none` — lỗi thật GoldTrack), ≥44px, test bằng cú chạm thật; toast không được che chính nội dung vừa lưu (vd chú thích trong viewer); phần tử `role=status` xoá chữ sau khi ẩn và chỉ ghi khi chữ đổi.
- [ ] Sheet/viewer/dialog: focus vào trong khi mở, Tab không lọt ra trang phía sau, trả focus khi đóng; Esc đóng lớp trên cùng **và** blur input bên trong (lỗi thật: Esc xong Enter vẫn lưu form đã huỷ); thanh lưu `position:sticky` cần `scroll-padding-bottom` để ô đang focus không bị che, và không có `transform` ở con (ios-pwa §6).
- [ ] Không đặt `aria-live` lên vùng bị render lại theo timer.
- [ ] Biểu đồ giá trị: không vẽ 0 giả cho ngày chưa có dữ liệu giá (trông như mất trắng) — bỏ điểm hoặc chỉ vẽ đường vốn.
- [ ] Một thông điệp chỉ xuất hiện **một lần** trên màn (không lặp ở thẻ trạng thái + ghi chú + lỗi).

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

## 9. Biểu đồ đường

- **Trục Y ôm sát dữ liệu, đừng kéo giãn để chứa một đường tham chiếu ở xa.** Đã gặp: kéo trục cho đường "giá vốn TB" (cách giá hiện tại ~2,6%) lọt khung → biến động thật -0,07% chỉ còn 1–2 pixel, người dùng tưởng biểu đồ "đi ngang". Quy tắc: chỉ đưa đường tham chiếu vào khung nếu nó gần dữ liệu (≤ 1,5 lần biên độ); xa hơn thì ghim ở mép khung và ghi giá trị + "cao hơn/thấp hơn khung" trong chú thích.
- **Sàn biên độ trục Y** (GoldTrack dùng 0,2% giá trị): dao động nhỏ vẫn nhìn thấy, nhưng chuỗi thật sự phẳng không bị phóng thành răng cưa.
- Ghi rõ biểu đồ vẽ **giá nào** ("Giá mua vào" ≠ "Giá bán ra") — người dùng sẽ so với giá họ đã trả và tưởng biểu đồ sai.
- Mặc định khung thời gian ngắn (7 ngày) và **không lưu lựa chọn khoảng thời gian qua các lần mở** — một lần bấm "Tất cả" cũ từng dính mãi, đè mất mặc định.

## 10. Hiển thị số liệu tài chính (lãi/lỗ, danh mục)

- **Không hiển thị con số có thể cộng trùng.** Với giá vốn bình quân, lãi/lỗ "chưa chốt" tính riêng cho từng lệnh mua sẽ trùng với lãi đã chốt ở lệnh bán sau đó → dòng mua chỉ nên so giá theo đơn vị (giá mua vs giá hôm nay, %), lãi/lỗ tiền thì tính ở cấp nhóm đã trừ phần bán.
- **Báo cáo theo kỳ chỉ chứa lãi đã chốt.** Lãi chưa chốt tích luỹ qua nhiều tháng không thuộc về tháng hiện tại — tách thành một dòng riêng. Nếu làm lãi/lỗ theo ngày: `ngày D = Δ lãi chưa chốt + lãi chốt trong ngày D`, và tổng các ngày phải khớp đúng tổng lãi/lỗ ở màn tổng quan (hôm nay dùng cùng giá trực tiếp với màn tổng quan).
- **Một card chỉ một loại số.** Đừng đặt "vốn đang giữ" cạnh "tổng số lượng đã từng mua" trong cùng card.
- Nhãn giá phải nói rõ ai mua ai bán: "Giá tiệm mua vào" (số tiền bạn nhận khi bán) khác "giá mua" (số tiền bạn đã trả).
- Tự điền giá cho người dùng chỉ khi chắc chắn đúng (vd giá hôm nay cho giao dịch hôm nay); giao dịch lùi ngày thì để trống, không bao giờ ghi đè giá người dùng đã gõ.

## 11. Thứ tự ưu tiên khi cân nhắc đánh đổi

1. **Đọc được** — tương phản, cỡ chữ, vùng chạm. Không bao giờ hy sinh cho thẩm mỹ.
2. **Đúng** — số liệu hiển thị chính xác, trạng thái phản ánh đúng dữ liệu.
3. **Mượt** — không giật, không nhảy layout.
4. **Đẹp** — sau cùng, và thường tự đến khi ba mục trên đã chuẩn.

## 12. Nên / Không nên — bố cục, form, điều khiển, câu chữ

Bộ quy tắc người dùng chốt (10/2026, từ 21 ảnh mẫu Do/Don't). Mỗi dòng là một quyết định mặc định: làm theo cột **Nên**, trừ khi có lý do ghi được ra. Cột cuối là cách kiểm, để reviewer/tester không phải phán bằng cảm giác.

### 12.1 Form

| # | Nên | Không nên | Kiểm |
|---|---|---|---|
| F1 | **Nhãn nằm TRÊN ô nhập**, mọi nhãn/ô/nút chung **một mép trái**; ô và nút chính rộng hết form | Nhãn bên trái ô (mắt phải đi zíc-zắc, nhãn dài bị xuống dòng, ô bị bóp hẹp trên điện thoại) | `label.getBoundingClientRect().bottom <= input.top`; mọi `left` bằng nhau |
| F2 | Ô nhập có **placeholder là ví dụ đúng định dạng** (`13.260.000`, `dd/mm/yyyy`), nhãn vẫn luôn hiện | Dùng placeholder thay nhãn (gõ vào là mất ngữ cảnh) | — |
| F3 | **2–3 lựa chọn → bày hết ra** (segmented control / radio / chip). Ví dụ: Mua/Bán, chủ sở hữu Viết Long/Minh Thư | `<select>` cho 2–3 giá trị (thêm 2 cú chạm, giấu mất lựa chọn) | grep `<select`, đếm `<option>` ≤ 3 |
| F4 | **Danh sách dài (>~10) → gõ để lọc + cuộn** | `<select>` dài chỉ cuộn | — |
| F5 | **Điều khiển sinh ra cho ngón tay**: bánh xe ngày/giờ kiểu iOS (LoveDays đã có), công tắc bật/tắt, stepper, sheet trượt lên | Ba `<select>` Giờ/Phút/AM cạnh nhau, ô ngày tí hon kèm icon lịch, checkbox 16px | vùng chạm ≥44px (§8) |
| F6 | **Form dài (>~6 ô hoặc quá một màn) → chia bước, có thanh tiến độ** (bước đã xong / đang ở / còn lại), bước không bắt buộc có **Bỏ qua** cạnh **Tiếp** | Một cột ô nhập dài cuộn mãi không biết còn bao nhiêu | — |
| F7 | **Lỗi hiện ngay tại ô sai + nói rõ vì sao + cách sửa**: viền đỏ ở ô, dòng chữ dưới ô; nhiều điều kiện thì liệt kê từng điều kiện đạt/chưa đạt | Một dòng "Có lỗi" chung chung ở đầu form; chỉ đổi màu viền mà không có chữ | ô lỗi có `aria-invalid` + `aria-describedby` trỏ tới câu lỗi |
| F8 | Màn giới thiệu/hướng dẫn lần đầu **luôn có Bỏ qua** | Bắt bấm "Tiếp" qua hết mới vào được app | — |

Không mâu thuẫn với `LongLTV_user-data-safety`: chia bước thì dữ liệu các bước trước phải còn nguyên khi lùi lại, và làm mới nền không được đụng form đang mở.

### 12.2 Chữ và căn lề

| # | Nên | Không nên |
|---|---|---|
| T1 | **Đoạn ≥4 dòng → căn trái.** Căn giữa chỉ cho tiêu đề, con số lớn, câu ≤3 dòng (empty state, hộp xác nhận) | Căn giữa đoạn dài — mép trái răng cưa, mắt mất điểm bắt đầu dòng. Kiểm ở **390px**: câu 2 dòng trên desktop thành 5 dòng trên điện thoại |
| T2 | **Phông đơn giản, dễ đọc** cho mọi chữ giao diện: phông hệ thống hoặc stack đang dùng (§3). Phông trang trí chỉ cho logo / một tiêu đề lớn | Phông kiểu cách (script, display nét mảnh, bo méo) cho nhãn, nút, số liệu, đoạn văn. Phông mới còn phải có trên iOS và đủ dấu tiếng Việt |
| T3 | **Câu chữ như người nói**, nút là động từ nói đúng việc sắp xảy ra: "Lưu giao dịch", "Chụp lại", "Trông ổn rồi", "Xoá 3 giao dịch" | Giọng máy: "Xác nhận và tiếp tục", "Thao tác thành công", "OK/Huỷ" cho hành động có hậu quả |
| T4 | **Gọn nhưng đủ nghĩa**: bỏ câu giải thích thừa, GIỮ nhãn, đơn vị, trạng thái — "Kỳ #3", "42%", "đ/chỉ", "cập nhật 14:05" | "Siêu tối giản": con số trần không đơn vị, `#3` không biết là gì, thanh tiến độ không có %, icon không chú thích |

T4 giải quyết chỗ dễ hiểu lầm: người dùng từng yêu cầu LoveDays "hạn chế bớt chữ" — nghĩa là cắt **văn xuôi**, không cắt **nhãn**. Phép thử: che phần chữ định bỏ, một người chưa dùng app còn hiểu con số/nút đó là gì không? Không → giữ.

### 12.3 Màu

| # | Nên | Không nên |
|---|---|---|
| C1 | **Giảm bão hoà trên nền tối**: accent dịu, sáng hơn (kiểu `#60A5FA`, `#FBBF24` ở §1) | Màu bão hoà 100% trên nền tối (`#0000FF`, `#FF0000`) — chói, rung mắt, chữ trắng đặt lên khó đọc. Đo lại tương phản sau khi đổi (§8) |
| C2 | **Màu theo nghĩa**: đỏ = xoá / nguy hiểm / lỗ; xanh lá = lãi / thành công; màu thương hiệu = hành động chính an toàn. Nút "Xoá" trong hộp xác nhận là **đỏ**, nút "Huỷ" trung tính | Nút xoá mang màu thương hiệu giống nút "Lưu" — tay quen bấm nút chính sẽ xoá nhầm |
| C3 | **Phân loại trạng thái bằng huy hiệu màu + chữ** (MUA/BÁN, tăng/giảm/không đổi, đã chốt/chưa chốt), nền huy hiệu theo §2 | Trạng thái là dòng chữ xám lẫn vào phụ đề. Ngược lại cũng sai: **chỉ** màu mà không có chữ/mũi tên (§7) |
| C4 | **Gradient mượt**: hai màu cùng họ, lệch sắc độ ≤ ~40°, hoặc cùng màu khác độ sáng (`--gold2`→đậm hơn, hồng `#E8507F`→`#C2185B` của LoveDays) | Gradient nhảy hai màu đối nhau (đỏ→xanh dương) — vùng giữa ra màu bùn. Chữ đặt trên gradient phải đo tương phản ở **cả hai đầu** |

Màu tăng/giảm của giá vẫn theo token `--green`/`--red` (§1); C2 không cho phép dùng đỏ để "làm nổi" thứ không nguy hiểm.

### 12.4 Điều hướng và vùng chạm

| # | Nên | Không nên |
|---|---|---|
| N1 | **Icon đi kèm nhãn** ở menu, tab bar, danh sách cài đặt | Chỉ chữ (khó quét mắt) hoặc chỉ icon (phải đoán). Nút icon-only chỉ chấp nhận cho ký hiệu phổ quát (✕, ‹, ⋯) và phải có `aria-label` |
| N2 | **Vùng chạm là cả ô**, không phải riêng hình icon: mục tab bar chia đều bề ngang, cao ≥44px; dòng danh sách chạm được trên toàn dòng | `<a>` chỉ bọc quanh icon 24px; padding đặt ở thẻ cha thay vì thẻ nhận chạm |

Kiểm N2: `getBoundingClientRect()` của **phần tử nhận sự kiện** (không phải icon con) — rộng ≈ bề ngang thanh ÷ số mục, cao ≥44.

### 12.5 Tải, hình ảnh, chiều sâu

| # | Nên | Không nên |
|---|---|---|
| L1 | **Khung xương (skeleton) đúng hình bố cục sắp hiện** khi tải nội dung màn hình (FuelTrack đã dùng): khối xám cùng kích thước card/dòng thật để không nhảy layout | Màn trắng với một vòng xoay ở giữa. Vòng xoay chỉ dùng **trong nút** đang xử lý hoặc thao tác <1 giây |
| L2 | Skeleton tôn trọng `prefers-reduced-motion`, không để mãi: lỗi/offline phải chuyển sang trạng thái lỗi có nút thử lại (§7) | Skeleton chạy vô hạn khi fetch đã hỏng |
| I1 | **Hình minh hoạ đúng nội dung** đang nói, cùng tông màu sản phẩm | Ảnh kho chung chung cho "đẹp"; ảnh nặng làm chậm lần tải đầu |
| D1 | **Chồng lớp có chủ đích để tạo chiều sâu**: avatar đè mép ảnh bìa (LoveDays), chip nổi trên ảnh, sheet đè lên trang | Mọi khối xếp rời thành hàng phẳng. Ngược lại: chồng lớp che chữ/vùng chạm, hoặc phần đè bị `overflow:hidden` của cha cắt mất |

### 12.6 Khi hai quy tắc kéo ngược nhau

- **§11 thắng §12**: đọc được và đúng số trước, rồi mới tới mẫu trình bày. Chồng lớp, gradient, huy hiệu màu đều phải qua phép đo tương phản §8.
- **Điều khiển cảm ứng (F5) vs. gõ nhanh**: số tiền, số lượng vẫn là ô gõ với `inputmode="decimal"` — bánh xe chỉ hợp với tập giá trị nhỏ có thứ tự (ngày, giờ).
- **Chia bước (F6) vs. sửa nhanh**: form thêm mới dài thì chia bước; form **sửa** một bản ghi có sẵn giữ một màn để nhảy thẳng tới ô cần sửa.
- **Skeleton (L1) vs. dữ liệu đã có trong cache**: có bản cũ thì hiện bản cũ kèm "đang cập nhật…", không thay bằng skeleton.

### 12.7 Soát nhanh trước khi giao một màn hình

- [ ] Nhãn trên ô, một mép trái (F1); 2–3 lựa chọn bày ra, không `<select>` (F3)
- [ ] Lỗi nằm tại ô, nói rõ vì sao (F7); form dài có bước + tiến độ (F6); onboarding có Bỏ qua (F8)
- [ ] Không đoạn căn giữa nào ≥4 dòng ở 390px (T1); nút là động từ đời thường (T3); số nào cũng có nhãn + đơn vị (T4)
- [ ] Nút xoá màu đỏ, khác hẳn nút chính (C2); trạng thái có huy hiệu màu **và** chữ (C3); không màu bão hoà tối đa trên nền tối (C1); gradient cùng họ màu (C4)
- [ ] Mục menu có icon + nhãn (N1); vùng chạm là cả ô ≥44px (N2)
- [ ] Đang tải = skeleton đúng hình, có đường ra khi lỗi (L1–L2)
