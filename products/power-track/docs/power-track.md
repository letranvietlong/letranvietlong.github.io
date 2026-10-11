# PowerTrack

App iPhone (mở từ icon Màn hình chính) để ghi tiền điện hằng tháng và xem giá điện sinh hoạt. Bốn tab (tab bar đáy, không lưu tab đang chọn): **Tổng quan** — tiền điện kỳ mới nhất, kWh, đ/kWh, kWh/ngày, so tháng trước, biểu đồ cột 12 tháng (Tiền / kWh), cùng kỳ năm trước, tổng năm; **Hoá đơn** — danh sách theo năm, form thêm/sửa trong sheet; **Giá điện** — bảng giá bậc thang đang áp dụng (chưa VAT và đã VAT), máy tính "Tính thử tiền điện", lịch sử điều chỉnh; **Cài đặt** — nơi dùng điện, sao lưu/khôi phục file, lịch sử cập nhật, dòng chẩn đoán.

**App không kết nối EVN.** EVN yêu cầu đăng nhập và không cho ứng dụng ngoài truy cập hoá đơn, nên mọi số liệu là người dùng nhập tay hoặc dán thông báo tiền điện. Cách nhập mặc định (từ 1.1) là **"Số tiền"**: chỉ cần tháng và số tiền đã trả — biên lai ví điện tử chỉ có hai thứ đó — app tính ngược ra số kWh. Mã khách hàng lưu ở "Nơi dùng điện" chỉ là ghi chú của người dùng. Không có bot, không `py/`, không workflow, không Web Push.

## File

- `js/power-track-core.js` — mọi phép tính và kiểm tra dữ liệu, **không đụng DOM**, gán `window.PowerTrackCore` (và `module.exports` để chạy bằng node: `require('…/js/power-track-core.js')`). Nạp trước `power-track.js`.
- `js/power-track.js` — giao diện, một IIFE.
- `json/electricity-tariff.json` — biểu giá, **viết tay** (thư mục `json/`, không phải `data/`).
- `data/changelog.json` — lịch sử cập nhật hiện trong app (Cài đặt → "Lịch sử cập nhật · vX").
- Service worker: vỏ `sw-power-track.js` ngay trong `products/power-track/`, logic ở `js/sw-core.js` (`CACHE_NAME` `powertrack-cache-vN`, `activate` chỉ xoá khoá bắt đầu `powertrack-cache-`; khớp theo đường dẫn đã chuẩn hoá — thư mục `html/` → `index.html`, bỏ query; chỉ cache response `ok`). Đăng ký bằng đường dẫn tuyệt đối ở cuối `power-track.js`.
- Kịch bản test chuẩn + số kỳ vọng tính tay + selector: `.claude/tools/fixtures/power-track.js`.

## Biểu giá — `json/electricity-tariff.json`

```
{ version: 1, checkedAt: 'YYYY-MM-DD', unit: 'đ/kWh', notice?: 'một câu ghi chú hiện dưới Lịch sử điều chỉnh',
  tariffs: [ { effectiveFrom, decision, tiers: [ { upTo: 50, price }, …, { upTo: null, price } ] } ],
  vat:     [ { effectiveFrom, pct, provisional? } ] }
```

- Giá sinh hoạt 6 bậc (0–50 / 51–100 / 101–200 / 201–300 / 301–400 / từ 401), **chưa VAT**. VAT là lịch riêng vì đổi độc lập với giá (10% → 8% từ 01/07/2023). Mục VAT có `provisional: true` (10% từ 01/01/2027) là mức theo quy định hiện hành khi hết đợt giảm thuế — giao diện ghi "(theo quy định hiện hành)".
- Bốn phiên bản đang có: QĐ 1062/QĐ-BCT (04/05/2023), 2941/QĐ-BCT (09/11/2023), 2699/QĐ-BCT (11/10/2024), 1279/QĐ-BCT (10/05/2025). Nguồn: các quyết định giá bán lẻ điện của Bộ Công Thương do EVN công bố; số trong file do chủ repo cung cấp ngày 11/10/2026. **Bậc 3, 4, 5 của QĐ 2941 (2.167 / 2.729 / 3.050) lấy từ nguồn thứ cấp, chưa đối chiếu với văn bản gốc** — đối chiếu lại khi có văn bản; ghi chú này chỉ nằm ở đây, giao diện không hiện cảnh báo (bốn quyết định hiện như nhau).
- Kỳ có ngày chọn giá trước 04/05/2023 → "Chưa có biểu giá cho kỳ này"; vẫn lưu được số tiền người dùng nhập.
- Biểu giá 5 bậc (QĐ 14/2025/QĐ-TTg) **chưa áp dụng**: câu ghi chú là trường `notice` của JSON (giao diện nối thêm "App vẫn tính theo N bậc ở bảng trên", N đếm từ dữ liệu), không nằm trong tính toán. HTML/JS không ghi cứng con số bậc nào. Khi áp dụng thật thì chỉ cần thêm một phần tử `tariffs` có 5 `tiers` — code không giả định 6 bậc (`tierLines` chạy theo mảng, bậc cuối `upTo: null`).
- `validTariffDoc` kiểm file trước khi dùng; file sai cấu trúc được coi như tải lỗi (một câu + nút "Thử lại"). Mọi `fetchJson` bị huỷ sau 15 giây.

### Khi có quyết định giá mới

1. Thêm một phần tử vào `tariffs` (`effectiveFrom`, `decision`, đủ các bậc, bậc cuối `upTo: null`). Không sửa/xoá phần tử cũ — hoá đơn cũ tính theo giá cũ.
2. VAT đổi → thêm phần tử vào `vat` (bỏ `provisional` ở mục 2027 khi đã có văn bản chính thức). Sửa hoặc bỏ `notice` nếu ghi chú biểu 5 bậc không còn đúng.
3. Sửa `checkedAt` thành ngày đối chiếu.
4. Thêm entry vào `data/changelog.json` + bump `version` (người dùng thấy bảng giá đổi).
5. Bump `CACHE_NAME` trong `js/sw-core.js` **và** `?v=` trong `sw-power-track.js`.
6. Chạy lại `node` với fixture: các số kỳ vọng trong `.claude/tools/fixtures/power-track.js` dùng **bản sao đóng băng** của biểu giá 11/10/2026 nên không đổi; thêm một ca cho giá mới.

## Công thức (`PowerTrackCore`)

- `calcBill({kwh, period, fromDate, toDate}, tariffDoc)` → `{segments:[{from,to,days,kwh,decision,vatPct,lines:[{tier,kwh,price,amount}],subtotal,vat,total}], subtotal, vat, total, estimated, noTariff}`.
- **Ngày chọn biểu giá = `toDate`**, không có thì ngày cuối tháng `period`. Kỳ thường: định mức bậc **không** nhân theo số ngày.
- **Ngày phải khớp kỳ** (`usableDates`/`dateFitsPeriod`): `toDate` phải nằm trong tháng của kỳ hoặc tháng liền trước/liền sau (`fromDate`: lùi tối đa 4 tháng). Ngày lệch hơn bị **bỏ qua khi tính** (tính theo kỳ, kWh/ngày theo số ngày của tháng) — ví dụ kỳ 07/2026 mang ngày 01/2024 → 200 kWh = 474.876 theo QĐ 1279, không phải 432.324 theo QĐ 2941. Form từ chối lưu ngày lệch ("Ngày ghi chỉ số không khớp kỳ tháng M/YYYY"); file khôi phục và dữ liệu cũ thì **không** bị từ chối, chỉ bị bỏ qua ngày.
- **Kỳ bắt đầu trước biểu giá đầu tiên** (từ ngày < 04/05/2023 ≤ đến ngày): không chia đoạn được vì thiếu giá cũ → tính cả hoá đơn theo biểu của `toDate`, `estimated = true` (100 kWh, 11/04–10/05/2023 → 193.270). Chỉ khi chính `toDate` cũng không có biểu giá mới là `noTariff`.
- Máy tính ở tab Giá điện gọi `calcBill` với `toDate = hôm nay (giờ VN)` — cùng ngày với bảng giá và nhãn VAT phía trên nó.
- **Kỳ vắt qua ngày đổi giá hoặc đổi VAT**: chỉ khi có đủ từ ngày + đến ngày và có mốc `effectiveFrom` nằm trong kỳ (mốc > `fromDate` và ≤ `toDate`). Số ngày tính cả hai đầu; kWh mỗi đoạn (trừ đoạn cuối) = `round(kwh × ngày đoạn / tổng ngày)`, đoạn cuối = phần còn lại; định mức **từng bậc** của đoạn = `round(định mức bậc × ngày đoạn / tổng ngày)` (bậc 50 kWh với 19/30 ngày → 32, không tính dồn theo `upTo`). `estimated = true` → giao diện ghi "ước tính": **quy tắc làm tròn của EVN chưa xác minh**.
- VAT từng đoạn = `Math.round(subtotal × pct / 100)`.
- Ví dụ chuẩn (đều có trong fixture): 612 kWh giá QĐ 1279 → 1.808.020 + 144.642 = 1.952.662; 300 kWh kỳ 21/04–20/05/2025 → đoạn cũ 190 kWh (32/32/63/63) 446.421 + đoạn mới 110 kWh (18/18/37/37) 271.598 → 718.019 + VAT 57.442 = 775.461.
- **Tính ngược** `kwhFromAmount({amount, period, fromDate, toDate}, tariffDoc)` → `{kwh, calcTotal, diff, exact, noTariff}`: số kWh nguyên (0…100000) có `calcBill(...).total` gần `amount` nhất. Tổng tăng theo từng kWh nên tìm nhị phân trên **chính `calcBill`** rồi so với giá trị liền dưới (hoà → kWh nhỏ hơn) — mọi quy tắc chiều xuôi (biểu giá theo kỳ, VAT, kỳ vắt mốc khi có ngày) tự động giống hệt. `diff = amount − calcTotal`, `exact = |diff| ≤ 2 đ`. Kỳ không có biểu giá → `noTariff`, `kwh: null`. Ví dụ (kỳ 09/2026): 1.388.405 → 461 kWh khớp (1.074.500 + 61 × 3.460 = 1.285.560; VAT 102.845); 990.000 → 353 kWh (990.414, lệch −414; 352 kWh = 986.796); 1.000 → 0 kWh. Đã kiểm: mọi kWh 0…2000 ở 4 kỳ đại diện đi xuôi rồi đi ngược đều ra đúng kWh ban đầu.
- So với hoá đơn (`compareBill`): `diff = amount − total`; `|diff| ≤ max(1.000, 0,5% × total)` → "Khớp biểu giá", lớn hơn → "Lệch ±X đ so với biểu giá" (màu cảnh báo, không đỏ) kèm `<details>` lý do thường gặp trong form.
- đ/kWh = số tiền đang hiện ÷ kWh (kWh = 0 → "—"). kWh/ngày (`perDay`): theo từ/đến ngày; không có thì theo số ngày của tháng và thêm "≈".
- So tháng trước = đúng `period − 1`, cùng kỳ = `period − 12` (`addMonths`); thiếu bản ghi thì ẩn dòng, không lấy tháng gần nhất thay thế. Tăng = đỏ ▲, giảm = xanh ▼ (trả nhiều hơn là xấu), bằng → "không đổi". % làm tròn trên giá trị tuyệt đối, dấu phẩy vi-VN, dấu trừ U+2212.
- `parseIntStrict` (ô gõ tay): chỉ nhận `12612`, `12.612`, `12,612`; `-1`, `1e3`, `1,5,5`, `1.5` → lỗi tại ô, không tự "sửa" thành số khác.

### Dán thông báo (`parsePaste`)

Trả `{period, fromDate, toDate, oldIndex, newIndex, kwh, amount}`, trường không chắc thì `null`. Bỏ dấu + chữ thường trước khi so; số có `.`/`,` ngăn nghìn. Trình tự (thứ tự là có chủ đích):

1. **Xoá số không phải số đo**: mã sau nhãn (`ma kh`, `khach hang`, `so hoa don`, `so cong to`…), mọi "từ" lẫn chữ + số dài ≥ 8 ký tự (mã PE…), số điện thoại/tổng đài, ngày sau `han …`/`truoc …` (hạn thanh toán).
2. Khoảng ngày `dd/mm/yyyy (den|-) dd/mm/yyyy` → từ/đến ngày (nhiều khoảng khác nhau → bỏ trống).
3. Kỳ: `ky [hoa don|thanh toan] [thang] mm/yyyy`, `thang mm/yyyy`, `Tmm/yyyy`. Không suy kỳ từ đến ngày.
4. Xoá mọi ngày và `mm/yyyy` còn lại rồi mới tìm chỉ số (`cs|chi so` + `cu|dau ky` / `moi|cuoi ky`) và kWh: nhãn `tieu thu|san luong|dien nang…`; không có nhãn thì chỉ nhận khi "N kWh" xuất hiện **đúng một lần** (các dòng "Bậc 1: 50 kWh. Bậc 2: 50 kWh" → bỏ trống).
5. Tiền (`moneyAfter`: số đầu tiên trong cùng câu, sau nhãn, có `đ|dong|vnd` **liền sau**, không nhận "đ/kWh"): tìm nhóm "tổng phải trả" (`tong cong|tong tien|tong (phai) thanh toan/tra|so tien phai thanh toan|thanh tien`) trước, xoá chúng khỏi văn bản, rồi tới khoản nợ (`no cu|con no…`), rồi "tiền kỳ này" (`tien dien|so tien`). **Có nợ cũ → lấy tiền kỳ này** (tổng đã gộp nợ); không có nợ → lấy tổng (trường hợp tiền điện chưa thuế + thuế + tổng cộng); chỉ có một loại → lấy loại đó; hai giá trị khác nhau trong cùng nhóm → bỏ trống. Số tiền không nhãn chỉ nhận khi văn bản có `dien|evn|kwh`, và không nhận số đứng sau `so|nha|ngo|hem|duong…` ("tại số 12 Đ. Lê Lợi").

Khoảng ngày đứng sau chữ `thanh toan` ("thời gian thanh toán từ … đến …") bị xoá ở bước 1 cùng với hạn thanh toán — không phải kỳ ghi chỉ số.

Form điền xong thì **chuyển về chế độ có ô** ("Chỉ số"; "Số kWh" nếu chỉ số không khớp số kWh; "Số tiền" nếu chỉ tìm được kỳ và số tiền — biên lai ví) để người dùng soát; ở chế độ "Dán thông báo" nút "Lưu hoá đơn" bị ẩn, chỉ còn "Điền từ thông báo". Nguyên văn thông báo bị xoá khỏi ô ngay sau khi điền, không lưu ở đâu. Không dùng lookbehind trong regex (Safari cũ ném lỗi cú pháp làm chết cả file).

## Dữ liệu người dùng

`localStorage` `powertrack_v1`:

```
{ version: 1,
  places: [ { id, name ≤30, customerCode ≤20 } ],          // 1–3 nơi, mặc định p1 "Nhà"
  bills:  [ { id, placeId, period 'YYYY-MM', fromDate|null, toDate|null, oldIndex|null, newIndex|null,
              kwh int 0…100000 (null CHỈ khi source 'amount' ở kỳ chưa có biểu giá), amount int|null 0…1e9 (đã VAT, theo hoá đơn),
              source 'amount'|'kwh'|'index'|'paste', note ≤200, createdAt, updatedAt,
              kwhInferred?: true } ] }   // ≤ 2000; kwhInferred chỉ được ghi khi true
```

Thêm `powertrack_last_backup_v1` (ISO, lần "Lưu file" cuối).

- **Bản ghi nhập bằng "Số tiền"** (1.1): `source: 'amount'`, `amount` = số người dùng gõ, `kwh` = số suy ra, `kwhInferred: true`, chỉ số `null`. Vẫn `version: 1` — bản 1.0 không biết `source: 'amount'` nên **file sao lưu của 1.1 có bản ghi kiểu này không khôi phục được trên bản 1.0** (chiều ngược lại thì được; bản ghi cũ không có khoá `kwhInferred` và `cleanDataset` không thêm vào, nên dữ liệu 1.0 giữ nguyên từng byte).
  - Hiển thị: kWh, đ/kWh, kWh/ngày có "≈" + chú thích "kWh suy ra từ số tiền"; huy hiệu tiền vẫn "Theo hoá đơn"; **không** hiện "Khớp/Lệch biểu giá" (kWh suy từ chính số tiền nên so lại là tự khớp); tổng năm ghi "gồm N tháng kWh suy ra"; biểu đồ kWh tô nhạt các cột suy ra.
  - Kỳ chưa có biểu giá: lưu `kwh: null` (không phải 0 — 0 sẽ làm sai biểu đồ và tổng kWh) → "— kWh", không vào tổng/biểu đồ kWh, tiền vẫn tính; tổng năm ghi "N tháng chưa có số kWh".
  - Sửa: mở ở chế độ "Số tiền"; số tiền, kỳ, ngày không đổi thì giữ nguyên `kwh` đã lưu (không tính lại theo biểu giá hiện tại) → Lưu không sửa = bản ghi không đổi. Chuyển sang "Số kWh" thì ô kWh nhận số suy ra (`form.kwhAuto`); lưu mà chưa gõ lại ô đó → vẫn là bản ghi `amount` + `kwhInferred`; tự gõ kWh hoặc chỉ số → `source` theo cách nhập mới, bỏ `kwhInferred`.
  - Biểu giá chưa tải được thì không lưu được ở chế độ "Số tiền" (lỗi tại ô, gợi ý chọn "Số kWh").
- Mỗi (placeId, period) chỉ **một** hoá đơn — lưu trùng báo lỗi tại ô Kỳ. Cùng kỳ ở nơi khác thì được.
- `amount = null` = chưa có hoá đơn → hiện số tính theo biểu giá kèm huy hiệu **"Ước tính"**; có `amount` → **"Theo hoá đơn"**. Hai loại không bao giờ trộn mà không ghi rõ: tổng năm ghi "gồm N tháng ước tính", cột biểu đồ ước tính tô nhạt + chú thích, dòng so sánh ghi "(số ước tính)". Kỳ không có biểu giá và không có tiền → "Chưa có tiền", không tính vào tổng (ghi "chưa tính N tháng…").
- Không ràng buộc chéo giữa các tháng (công tơ có thể bị thay). Chỉ số mới của tháng trước chỉ được **gợi ý** vào ô "Chỉ số cũ" khi thêm mới và ô đang trống (hoặc đang giữ gợi ý chưa bị sửa) — `suggestOld`.
- **Form không bao giờ bị làm mới ngầm đụng tới**: `visibilitychange` và tải lại biểu giá chỉ vẽ lại thẻ/danh sách (`renderAll`) và dòng tiền tính được trong form (`updateCalc` — không phải ô nhập). Ô "Tiền trên hoá đơn" không bao giờ được app tự điền, trừ khi người dùng bấm "Điền từ thông báo".
- Nạp (`load`): dữ liệu không parse được hoặc sai schema → **không ghi đè**: banner ở đầu mọi tab, khoá "Thêm hoá đơn"/sửa nơi, nút "Lưu bản lỗi ra file" (nguyên văn) và "Khôi phục từ file". Ghi (`persist`): ghi → đọc lại so sánh → lỗi thì trả giá trị cũ.
- **Hai cửa sổ cùng mở app** (Safari + một tab khác; app Màn hình chính thì chỉ có một): `loadedRaw` giữ đúng chuỗi mà `data` được đọc ra. `persist` đọc lại localStorage trước khi ghi; khác `loadedRaw` → **không ghi**, `reloadData()` (nạp lại + vẽ lại, form đang mở giữ nguyên chữ) và trả câu "Dữ liệu vừa được cập nhật ở cửa sổ khác — đã tải lại, hãy thử lại." — bấm Lưu lần nữa thì ghi lên bản mới. Trước đây tab cũ ghi cả mảng trong RAM đè mất hoá đơn tab kia vừa thêm. `visibilitychange`: không có form/hộp xác nhận đang mở thì nạp lại nếu chuỗi đã đổi. Sự kiện `storage`: khoá sao lưu chỉ vẽ lại dòng "Sao lưu lần cuối"; khoá dữ liệu → nạp lại phía sau, **không đóng form**, toast "Dữ liệu vừa được cập nhật ở cửa sổ khác". Lúc Lưu, `staleEdit` kiểm bản ghi đang sửa: đã bị xoá hoặc `updatedAt` khác → từ chối một lần kèm câu nói rõ, lần Lưu thứ hai mới ghi.
- **Chỉ số và kWh**: bản ghi có chỉ số mà `newIndex − oldIndex ≠ kwh` (công tơ có hệ số nhân, file khôi phục) mở ở chế độ "Số kWh" với đúng kWh đã lưu — không tính lại từ chỉ số. Lưu từ "Số kWh" mà kWh vẫn bằng kWh cũ hoặc bằng hiệu hai chỉ số cũ → giữ nguyên `oldIndex`/`newIndex`/`source`; chỉ khi người dùng đổi kWh sang số khác thì chỉ số mới thành `null`.
- Chốt lưu trùng: handler `submit` thoát nếu sheet không còn class `open` (lưu thành công gỡ `open` đồng bộ). Lưu xong **không trả focus về nút "Thêm hoá đơn"** (`closeSheet(id, true)`) để Enter thứ hai không mở form mới.
- Xoá hoá đơn: hộp xác nhận (nằm trên form) → toast có nút "Hoàn tác" 7 giây. Hoàn tác bị từ chối nếu kỳ đó đã có hoá đơn khác.
- Nơi dùng điện: chỉ xoá được nơi chưa có hoá đơn, và luôn còn ít nhất một nơi.

### Sao lưu / khôi phục

- File `power-track-YYYY-MM-DD.json` (ngày VN) = `{app:'power-track', kind:'power-log', version:1, exportedAt, places, bills}`; `navigator.share({files})` ngay trong cú chạm, không có thì `a.download`.
- `parseBackup`: app/kind/version → `validateDataset` từng bản ghi (id `^[\w-]+$`, tra bằng `Object.create(null)`; kỳ hợp lệ; ngày có thật; placeId tồn tại; không trùng kỳ; giới hạn = giới hạn lúc nhập) → kỳ không sau tháng hiện tại và ngày không sau hôm nay (giờ VN; chỉ kiểm khi khôi phục, không kiểm khi mở app, để lệch đồng hồ không biến dữ liệu thành "lỗi") → chạy thử `calcBill` + `perDay` mọi bản ghi → `persist`.
- Đang có dữ liệu (có hoá đơn, **hoặc** nơi khác mặc định) → nút duy nhất "Lưu bản hiện tại rồi khôi phục": chỉ ghi đè sau khi lưu xong; huỷ bảng chia sẻ → không khôi phục. Dữ liệu đang lỗi → bản được lưu là nguyên văn bản lỗi.
- Sau khôi phục và sau lần thêm hoá đơn đầu: `navigator.storage.persist()`.

## Giờ Việt Nam

Mọi "hôm nay", kỳ mặc định, `max` của ô ngày/tháng, tên file, kiểm "tương lai" dùng `vnToday`/`vnMonth` (`Date.now() + 7h`, đọc bằng getter UTC). Ô `<input type="month">`/`type="date"` chỉ đọc `.value`, không `valueAsDate`. Kỳ mặc định của form thêm mới = tháng hiện tại giờ VN.

## Giao diện

- Nhận diện: tím điện (`--accent` `#A78BFA` tối / `#6D28D9` sáng), nền `#0D0F1E` / `#F5F4FB`; nút chính gradient cùng họ tím (`--btn-from` → `--btn-to`, `background-color` = đầu `--btn-to` để script đo tương phản đọc được). Phông và mặt chữ số "App Digits" như GoldTrack/FuelTrack.
- Header một hàng mỏng, cuộn theo trang; góc phải chỉ có nút chọn nơi khi ≥ 2 nơi; **không có huy hiệu phiên bản** (nằm ở Cài đặt).
- **Mọi backdrop và sheet mang `hidden` khi đóng** (`showLayer`/`hideLayer`: bỏ `hidden` → reflow → `.open`; đóng thì gỡ `.open` rồi 260 ms sau đặt `hidden`). Không mở gì thì không có phần tử `position:fixed` có nền chạm mép trên (dòng chẩn đoán in con số này).
- Thang z-index là token trong `:root`: `--z-tabbar` 35 < `--z-backdrop` 40 < `--z-sheet` 50 < `--z-confirm-backdrop` 54 < `--z-confirm` 55 < `--z-toast` 60.
- "Cách nhập" là segmented 4 nút nhãn ngắn (Số tiền / Số kWh / Chỉ số / Dán), mỗi nút 79 × 44 px ở 375px. Ô tiền (`#fAmount`) dùng chung cho mọi chế độ — chỉ đổi nhãn ("Số tiền đã trả" bắt buộc ↔ "Tiền trên hoá đơn" không bắt buộc) nên chuyển chế độ không mất chữ đã gõ.
- Sheet: tay kéo + hàng tiêu đề/✕ đứng yên, chỉ `.sheet-body` cuộn (flex column, không dùng `position:sticky`). Form hoá đơn có **chiều cao cố định** 88% viewport và mỗi dòng lỗi tại ô **giữ sẵn một dòng trống** (`.field-error[hidden]` vẫn chiếm chỗ, `visibility:hidden`): lỗi hiện lúc rời ô không làm xê dịch ✕, nút chế độ hay nút Lưu — trước đây sheet cao thêm 24px và cú chạm đầu trượt khỏi nút. Câu lỗi hiện lúc rời ô phải vừa một dòng ở 390px.
- Mở thì focus nút ✕ (hộp xác nhận: "Huỷ"), Tab quay vòng trong lớp trên cùng, Esc đóng lớp trên cùng và blur ô đang gõ, đóng thì trả focus về nút đã mở. Nền mờ bỏ qua cú chạm trong 400 ms đầu sau khi mở (chạm đúp "Xoá hoá đơn" không làm hộp xác nhận tự đóng) — dùng timer, không so `Date.now()`.
- Biểu đồ: cột SVG tự vẽ, trục Y từ 0, tháng không có hoá đơn không vẽ cột; vùng chạm của mỗi tháng là cả ô dọc (12 ô sát nhau, cao hết biểu đồ) → dòng chữ giá trị bên dưới; khung biểu đồ focus được, ←/→ đổi tháng; lựa chọn Tiền/kWh không lưu.
- Skeleton tab Giá điện cao bằng nội dung thật (bảng 234 so với 232, dòng meta là khối riêng 36, lịch sử 330) — đổi bố cục thì đo lại. Đang tải biểu giá thì hoá đơn chưa có tiền ghi "Đang tải biểu giá…" thay cho "Chưa có tiền".

## Chưa kiểm chứng trên iPhone thật

Bộ chọn tháng gốc của iOS cho `<input type="month">` (kể cả việc có tôn trọng `max` không), bảng chia sẻ "Lưu vào Tệp", bàn phím trong sheet, safe-area thật của tab bar, dải thanh trạng thái, chữ số (phông iOS). Dòng chẩn đoán: Cài đặt → Thông tin → Thông tin kỹ thuật.

## Việc để sau

- Nhắc ghi chỉ số hằng tháng (cần Web Push + workflow riêng, xem skill `LongLTV_web-push`).
- Giá khác sinh hoạt (kinh doanh, thuê trọ) và hệ số nhiều hộ dùng chung một công tơ.
- Đối chiếu bậc 3–5 của QĐ 2941 với văn bản gốc.
- Gộp theo id khi hai cửa sổ cùng sửa (hiện là từ chối + tải lại).
- Xác minh cách EVN làm tròn khi kỳ vắt qua ngày đổi giá, rồi bỏ nhãn "ước tính" nếu khớp.
- Đọc ảnh/PDF hoá đơn; gộp dữ liệu khi khôi phục (hiện chỉ thay toàn bộ).
