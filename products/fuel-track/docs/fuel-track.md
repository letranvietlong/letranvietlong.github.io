# FuelTrack

Theo dõi giá bán lẻ xăng dầu PVOIL tại Đà Nẵng (nội thành = Vùng 1) theo từng ngày, kèm sổ ghi các lần đổ xăng của chính người dùng. Ba tab (tab bar dưới đáy, không lưu tab đang chọn): **Giá** — giá hôm nay + mức tăng/giảm so với kỳ trước, thẻ "Kỳ điều chỉnh tới", biểu đồ theo ngày (4 loại trên một biểu đồ, đường cong monotone không vượt quá giá thật, mặc định 7N), lịch sử các kỳ điều chỉnh; **Sổ xăng** — các lần đổ lưu trong `localStorage` của máy (không đồng bộ Gist), chi tiêu theo tháng, mức tiêu hao, giá đã trả so với niêm yết; **Cài đặt** — xe, sao lưu/khôi phục file, thông báo khi giá đổi, dòng chẩn đoán. Không có mua/bán, danh mục hay lời/lỗ. PWA cài được lên iPhone qua "Add to Home Screen".

File: `html/index.html` (markup), `css/fuel-track.css`, `js/fuel-track.js` (giá, biểu đồ, kỳ tới, tab, sheet, thông báo — một IIFE, cuối file gán `window.FuelTrackShared` cho file sau dùng), `js/fuel-track-log.js` (sổ xăng, IIFE riêng, nạp SAU `fuel-track.js`; nghe sự kiện `fueltrack:history` sau mỗi lần tải giá và `fueltrack:tab`), `py/notify_fuel_price.py` (thông báo đẩy, xem "Thông báo giá").

## Nguồn dữ liệu

- **pvoil.com.vn chặn mọi client không phải trình duyệt thật** (Cloudflare challenge 403 — kể cả curl_cffi và Chromium có giao diện). Không viết parser cho trang đó.
- Nguồn thực tế: `GET https://giaxanghomnay.com/api/pvdate/YYYY-MM-DD` (JSON, không auth). Trả mảng 4 phần tử: `[0]` Petrolimex ngày D (`zone1_price`/`zone2_price`), `[1]` PVOIL ngày D (`price`), `[2]`/`[3]` bản ghi liền trước. Ngày chưa có bản ghi → phần tử rỗng.
- Bản ghi ngày D được tạo lúc 00:00 giờ VN; ngày có điều chỉnh (thường thứ Năm, hiệu lực 15:00) thì bản ghi bị **ghi đè trong ngày** bằng giá mới → bản ghi ngày D = giá áp dụng cuối ngày D.
- **Từ 10/2026 feed "PVOIL" thực chất là bản sao Petrolimex Vùng 1**: mọi dòng có `is_reference: true`, `reference_price_source: "petrolimex_zone1"`, tên mặt hàng theo kiểu Petrolimex "Mức" (`Xăng E10 RON 95 Mức 3`, `Xăng E5 RON 92 Mức 2`, `Dầu DO 0,05S Mức 2`, `Dầu DO 0,001S Mức 5`), và **không còn dầu hỏa (KO)**. Script gắn `source: "petrolimex-v1"` cho mọi dòng `is_reference`; KO lấy từ `zone1_price` của dòng Petrolimex `Dầu hỏa 2-K` (đã đối chiếu: KO lịch sử 14/05/2026 = 27.710 = Petrolimex Dầu hỏa 2-K Vùng 1). Khi **mọi** mặt hàng đều là `petrolimex-v1`, trang hiện một ghi chú chung dưới danh sách giá thay vì lặp ở từng dòng.
- Khớp tên mặt hàng bằng **danh sách alias chính xác** (`PV_TITLES`, `PLX_FALLBACK` trong script, giữ cả tên cũ `…-II`/`…-III`/`Dầu KO` lẫn tên "Mức"), **không khớp mờ**: "Mức 3" và "Mức 5" là hai mặt hàng khác nhau chỉ lệch một ký tự. Tên lạ không có trong `PV_IGNORED` → in `::warning::` (hiện thành annotation trên GitHub Actions). **DO 0,001S bị loại** (trước đây giá Petrolimex lệch PVOIL).
- Mặt hàng thay đổi theo thời gian: tới ~06/2026 PVOIL có RON 95-III, sau đó mất (nằm trong `RETIRED`). Mặt hàng đã ngừng vẫn nằm trong lịch sử (hiện "Ngừng niêm yết") nhưng không được vẽ trên biểu đồ (biểu đồ vẽ mọi mặt hàng có trong mốc mới nhất, mỗi mặt hàng một đường).
- Rate limit ~60 request/phút, từng bị từ chối kết nối sau ~8 request cách nhau 1s → backfill nghỉ 2s giữa các request, retry backoff 5/10/20/40s.

## Dữ liệu (`data/`, do bot sinh — KHÔNG sửa tay)

- `fuel-price-history.json`: `{ items: {id: label}, changes: [{date, detectedAt, prices, sources?}] }` — **chỉ lưu điểm thay đổi** (entry mới khi bộ giá khác entry trước; mặt hàng biến mất cũng tính là thay đổi). `sources` chỉ liệt kê mặt hàng không phải giá PVOIL gốc (gồm cả dòng `is_reference`). So "cùng trạng thái" **chỉ dựa trên `prices`**: giá y hệt entry cuối mà chỉ `sources` khác → sửa `sources` của entry cuối tại chỗ, không mở kỳ mới (nếu không sẽ sinh một kỳ "không đổi" giả). UI tự forward-fill ra giá từng ngày.
- `fuel-price.json`: suy ra từ 2 entry cuối — giá hiện hành, `prevPrice`, `change`, `source` từng mặt hàng. Không có timestamp "lần chạy gần nhất" để bot không commit rác mỗi lần chạy.
- `changelog.json`: lịch sử cập nhật hiển thị trong app (cùng quy tắc với GoldTrack — xem CLAUDE.md).
- `push-state.json`: mốc giá đã thông báo lần cuối (do `notify_fuel_price.py` ghi, app không đọc). Chưa có cho tới lượt chạy đầu tiên sau khi cấu hình thông báo.

## Script & lịch chạy

- `py/fetch_fuel_price.py` (chạy thường): lấy ngày hôm nay theo giờ VN, không có thì hôm qua; lỗi mạng / không có dữ liệu → exit 1, không ghi file. Idempotent: chạy lại khi giá không đổi thì không đụng file nào.
- `--backfill-from YYYY-MM-DD`: quét từng ngày tới hôm nay. Nếu bị chặn giữa chừng, script ghi phần đã có và in ngày để chạy tiếp. Ngày cũ hơn entry cuối bị bỏ qua, nên chỉ backfill được "về phía trước"; backfill từ đúng ngày của entry cuối sẽ thay entry đó tại chỗ (cách sửa một kỳ bị ghi sai). **Không dựng lại lịch sử từ đầu** — xem cạm bẫy "đổi tên áp dụng ngược".
- `.github/workflows/update-fuel-price.yml`: cron `23 * * * *` (mỗi giờ, phút :23). Từng chỉ chạy 5 lượt/ngày quanh 15:00 VN nhưng GitHub hay bỏ lượt hẹn giờ khi quá tải, nên chạy dày; không sinh commit rác vì script chỉ ghi khi giá đổi. `git add` 2 file giá (+ `data/push-state.json` nếu có — xem "Thông báo giá"), vòng lặp fetch/rebase/push 5 lần để né race với các workflow khác.

## Cạm bẫy

- **Cache Storage dùng chung cả origin.** Service worker của GoldTrack và FuelTrack cùng thấy mọi cache; handler `activate` của mỗi bên **chỉ được xoá cache mang tiền tố của chính nó** (`fueltrack-cache-` / `goldtrack-cache-`). Xoá "mọi cache khác CACHE_NAME" sẽ xoá sạch offline của sản phẩm kia.
- Vỏ service worker `sw-fuel-track.js` nằm ngay trong `products/fuel-track/` (không lồng vào `js/`) vì lý do scope — giống GoldTrack. Đăng ký bằng đường dẫn tuyệt đối.
- **Thêm file mà app load lúc chạy** → thêm path vào `js/sw-core.js` (`APP_CODE_PATHS`/`ICON_PATHS`/`DATA_PATHS`), bump `CACHE_NAME` và `?v=` trong `sw-fuel-track.js`.
- Múi giờ: cả Python lẫn JS dùng offset cố định UTC+7 (VN không có DST), không cắt chuỗi ISO UTC.
- Màu: giá **tăng = đỏ ▲, giảm = xanh ▼** (người mua xăng coi tăng giá là xấu) — ngược với GoldTrack. Luôn kèm mũi tên, không chỉ phân biệt bằng màu.
- **Nguồn đôi khi trả bản ghi lỗi 1–2 ngày rồi quay lại** — bộ giá của kỳ cũ (thấy thật ngày 25/10/2025 và 26/12/2025) hoặc thiếu một dòng. `apply_observation` xử lý bằng quy tắc: một entry vừa xuất hiện ≤3 ngày sau entry trước, rồi ≤3 ngày sau đó giá quay về đúng trạng thái trước nó, thì entry đó là nhiễu và bị xoá (kỳ điều hành thật cách nhau ≥7 ngày). Phải xét **cả hai phía**: chỉ xét phía "quay về" sẽ xoá nhầm kỳ điều chỉnh thật khi bản ghi cũ tới 2 ngày sau thứ Năm. Trên trang live, nhiễu có thể hiện tối đa ~1 ngày trước khi tự lành.
- **Nguồn đổi tên/đổi cấu trúc áp dụng ngược cho mọi ngày cũ.** Khi giaxanghomnay.com chuyển sang tên "Mức" và dựng lại feed PVOIL thành bản sao Petrolimex, API của *mọi* ngày trong quá khứ cũng trả dữ liệu mới (không còn RON 95-III, không còn KO trong feed PVOIL). Xoá file rồi backfill lại sẽ mất kỳ RON 95-III và các kỳ thật đã ghi — chỉ sửa tiến về phía trước. Lần đổi tên này (bot chạy 01/10/2026) từng ghi một kỳ thiếu E10 và giá E5/DO cũ; đã sửa bằng `--backfill-from 2026-10-01`.
- **Mặt hàng biến mất khỏi response → giữ giá cũ (carry forward)**, in `::warning::carry forward <id>`: mọi mặt hàng từng có trong lịch sử mà không nằm trong `RETIRED` sẽ lấy giá + nguồn của lần ghi gần nhất, để một lần đổi tên không làm mặt hàng biến khỏi trang. Hệ quả: nếu một mặt hàng ngừng bán thật, phải thêm id vào `RETIRED` thì nó mới thôi được mang theo (và mới hiện "Ngừng niêm yết").
- **App Màn hình chính có bộ nhớ riêng, tách với Safari** (ios-pwa-pitfalls §14): sổ xăng ghi trong Safari không hiện trong app mở từ icon. Trạng thái rỗng của Sổ xăng nói rõ điều này; chuyển dữ liệu bằng Cài đặt → Sao lưu (file). Xoá icon = xoá luôn sổ xăng.
- **Ngày điều chỉnh có hai giá niêm yết** (giá mới áp dụng từ 15:00). Mọi chỗ cần "giá ngày D" phải xử lý cả hai, không lấy bừa một giá.

## Kỳ điều chỉnh tới (tab Giá)

- Quy tắc hiện hành: điều chỉnh **thứ Năm hằng tuần, hiệu lực 15:00** (Nghị định 80/2023; thông báo Bộ Công Thương 13/08, 20/08/2026). Dự thảo nghị định 27/07/2026 có thể cho doanh nghiệp tự định giá — mới là dự thảo, nên nhãn luôn là **"dự kiến"** + dòng nhỏ "Có thể dời dịp lễ". **Không** duy trì danh sách ngày lễ bằng tay.
- Quan sát từ lịch sử (70 mốc): bình thường cách nhau 7 ngày, thứ Năm (09/2025–02/2026, 07/05–08/10/2026). Dời vì lễ: 31/12/2025 (thứ Tư), 20/02/2026 (thứ Sáu, Tết), 29/04/2026 (thứ Tư); không rõ lý do: 07/11/2025, 28/11/2025 (thứ Sáu). Bất thường 05/03–23/04/2026 (3–5 lần/tuần). Không phải điều chỉnh: 05/06/2026 00:00 (bỏ RON95-III), 01/07/2026 00:20. `detectedAt` từ 05/2026 rơi vào 14:40–16:10 VN (mốc trước đó là backfill 07:50/08:00, bỏ qua).
- Thuật toán (`nextAdjustment` trong `fuel-track.js`, giờ VN = `Date.now() + 7h` đọc bằng getter UTC, không phụ thuộc múi giờ máy): `days = (4 − thứ + 7) % 7`. Nếu hôm nay là thứ Năm: mốc cuối = hôm nay → +7 ngày; trước 15:00 (08:00Z) → hôm nay; đã qua 15:00 mà bot chưa ghi (cron :23 mỗi giờ) → "Đang chờ giá kỳ dd/mm". Đếm ngược: ≥ 1 ngày "còn X ngày Y giờ", < 1 ngày "còn Y giờ Z phút"; vẽ lại mỗi 60 giây và khi app hiện lại.
- Mỗi mặt hàng đang niêm yết: **4 lần đổi giá gần nhất** của chính nó (bỏ qua mốc mà chỉ mặt hàng khác đổi), "30N" = giá hôm nay − giá có hiệu lực ngày (hôm nay − 30) kèm %, nhãn "Tăng/Giảm N kỳ liền" chỉ khi mọi chênh lệch cùng dấu.
- **Không dự báo chiều tăng/giảm** (không dùng các chữ "dự báo tăng/giảm"): giá VN theo Platts MOPS (trả phí) + quỹ bình ổn + thuế; Brent (FRED) không đủ — ví dụ kỳ 08/10/2026 xăng +1.070/+1.140 nhưng DO −590.

## Sổ xăng (tab Sổ xăng)

- `localStorage` key `fueltrack_log_v1` = `{version:1, vehicles:[{id, name}], fills:[{id, date 'YYYY-MM-DD', vehicleId, fuelId, fuelLabel, liters (3 số lẻ), amount (đ, nguyên), price (đ/L, nguyên), priceSource 'list'|'user', odo int|null, full bool, note ≤200, createdAt, updatedAt}]}` (~250 B/lần đổ). `fuelLabel` là tên lúc ghi (nguồn hay đổi tên). Xe mặc định `v1` "Xe của tôi"; chọn xe chỉ hiện khi ≥ 2 xe; xe chỉ xoá được khi chưa có lần đổ nào.
- Dữ liệu đọc lên không hợp lệ → **không ghi đè**: banner lỗi, khoá nút thêm; Khôi phục từ file vẫn dùng được và lưu nguyên văn bản lỗi ra file trước.
- Mọi lần ghi: `persist()` ghi → đọc lại so sánh → lỗi thì trả lại giá trị cũ. Sự kiện `storage` (tab khác sửa) → nạp lại, đóng form.
- Form "2 trong 3": lít + giá → tiền = round(lít × giá); tiền + giá → lít = round3(tiền / giá); lít + tiền (chưa có giá) → giá = round(tiền / lít), `priceSource 'user'`. Giá tự điền từ niêm yết theo ngày + loại (forward-fill như biểu đồ); **giá người dùng gõ không bao giờ bị ghi đè**. Ngày điều chỉnh: hôm nay → chọn theo giờ VN (< 15:00 giá cũ, ≥ 15:00 giá mới); ngày đã qua → để trống + 2 nút "Trước 15h …" / "Từ 15h …". Ô lít nhận "," hoặc "."; ô tiền bỏ "." và khoảng trắng; dùng `type=text` + `inputmode`. Ô ngày là `<input type=date>` gốc (Chrome desktop hiện kiểu tháng/ngày — chấp nhận, iPhone hiện đúng kiểu VN). Loại nhiên liệu liệt kê mặt hàng có giá ngày đó (trước 06/2026 có RON 95-III).
- Thứ tự mỗi xe: (ngày, km nếu cả hai có, thứ tự nhập). **Số km kiểm theo thứ tự ngày**, không so với lần mới nhất: khi lưu, km phải nằm giữa lần có km liền trước và liền sau theo ngày ("Số km phải ≥ 12.300 (lần đổ 20/09)"); `findOdoViolation` chạy lại trên cả bộ trước khi ghi và khi khôi phục.
- **Tiêu hao — đầy tới đầy**: mở đoạn ở lần đổ đầy có km, đóng ở lần đổ đầy có km kế tiếp (rồi mở đoạn mới tại đó). Lít/tiền của đoạn = mọi lần đổ **sau** điểm mở, **gồm** lần đóng (và các lần đổ dở ở giữa). Lần đổ đầy không ghi km → bỏ đoạn đang mở. Tổng: L/100km = Σlít / Σkm × 100, đ/km = Σtiền / Σkm (**không** lấy trung bình các tỉ lệ). Ví dụ chuẩn trong `.claude/tools/fixtures/fuel-track.js`: 1,89 L/100km · 480 đ/km (tính sai kiểu cộng cả lít lần mở = 2,78; trung bình tỉ lệ = 2,00; tổng tiền ÷ km = 680).
- Theo tháng: theo tháng của chuỗi ngày (giờ VN). Giá trả so với niêm yết: TB trả = Σtiền / Σlít; TB niêm yết = Σ(lít × giá niêm yết ngày đó) / Σlít (ngày điều chỉnh: lấy giá niêm yết gần giá đã trả hơn); chênh lệch tiền = Σtiền − Σ(lít × niêm yết).
- **Sao lưu**: file `fuel-track-so-xang-YYYY-MM-DD.json` (ngày VN) = `{app:'fuel-track', kind:'fuel-log', version:1, exportedAt, vehicles, fills}`; "Lưu file" gọi `navigator.share({files})` **ngay trong cú chạm** (iPhone: "Lưu vào Tệp"), không có thì `a.download`. Ghi `fueltrack_log_last_backup_v1` (ISO); "Sao lưu lần cuối" tính theo ngày VN, ≥ 30 ngày hoặc chưa từng sao lưu (khi có dữ liệu) → màu cảnh báo.
- **Khôi phục**: chỉ nhận đúng định dạng trên (app/kind, version 1 — mới hơn thì báo cập nhật app), id `^[\w-]+$`, ngày có thật, 0 < lít ≤ 1000, tiền nguyên 0…1e9, 0 < giá ≤ 1e6, km null hoặc nguyên ≥ 0, `full` bool, ghi chú ≤ 200, xe tồn tại, km không giảm theo ngày; chạy thử `computeStats` trước khi ghi. File lỗi → thông báo riêng từng lỗi, dữ liệu không đổi. Sổ hiện tại không rỗng → nút duy nhất "Lưu bản hiện tại rồi khôi phục": share bản hiện tại trong cú chạm, **chỉ ghi đè sau khi share thành công**; huỷ share → không khôi phục.

## Thông báo giá

```
update-fuel-price.yml (cron :23 mỗi giờ)
  fetch_fuel_price.py → (Check push config) → (Install pywebpush) → notify_fuel_price.py → commit giá + data/push-state.json
     notify_fuel_price.py ── .github/scripts/web_push.py (VAPID, aes128gcm, TTL 24h, Urgency normal) ──▶ web.push.apple.com ──▶ iPhone
SW (js/sw-core.js) "push": payload {"v":1,"title","body","tag":"fuel-price","ts"} → LUÔN showNotification (iOS thu hồi đăng ký nếu push không hiện gì);
   payload hỏng → "FuelTrack" / "Giá xăng dầu vừa điều chỉnh — mở app để xem". "notificationclick": focus cửa sổ FuelTrack, không có thì mở html/index.html.
```

- So với **giá đã báo lần cuối** (`data/push-state.json` = `{notified:{date, prices}, notifiedAt, delivered, failed}`), không so với commit trước. Chưa có state → lưu kỳ hiện tại làm mốc, không gửi. Giá bằng mốc → thôi. Mốc mới nhất trùng bộ giá một kỳ cũ và mới ≤ 3 ngày → nghi bản ghi lỗi của nguồn (xem cạm bẫy "Nguồn đôi khi trả bản ghi lỗi"), `::notice::` rồi chờ. 22:00–07:00 VN → để lượt sau (gộp). Gửi xong (≥ 1 máy) mới ghi state; cùng kỳ đổi lần nữa → tiêu đề thêm " (cập nhật)".
- Tiêu đề "Giá xăng dầu điều chỉnh DD/MM"; nội dung các mặt hàng đổi so với mốc trước, theo thứ tự ITEMS: `E10 28.250 (+1.070) · E5 27.700 (+1.140) · DO 29.120 (−590) · Dầu hỏa 30.630 (+860)` (dấu trừ U+2212; mặt hàng mới → "(mới)").
- Exit: 0 = đã gửi ≥ 1 / không có gì để gửi / hoãn / `--dry-run`; 1 = mọi máy lỗi (không ghi state); 2 = cấu hình sai. Workflow: mọi bước push `continue-on-error` + `timeout-minutes: 3` → **giá vẫn được commit dù push lỗi hay thiếu secret**; secret `FUEL_PUSH_SUBSCRIPTIONS` trống → bỏ qua hẳn (chỉ `echo`). Bước commit `git add` push-state.json chỉ khi file tồn tại (git add file không có là lỗi fatal); chỉ state đổi → message "FuelTrack push state: YYYY-MM-DD". `workflow_dispatch` có `notify_force`, `notify_dry_run`.
- Log công khai: không in endpoint, khoá hay nguyên văn exception — chỉ tên máy, host, mã HTTP. 410/404 → "hết hạn đăng ký"; 403 → "khoá VAPID trong app khác khoá trong secret?".
- Chạy tay: `python products/fuel-track/py/notify_fuel_price.py [--now 2026-10-08T09:23:00Z] [--force] [--dry-run] [--state …] [--history-file …]`.
- `push-state.json` do bot tạo ở lượt đầu đã cấu hình; app không đọc, không nằm trong cache SW.

### Secrets & cài đặt một lần

| Secret | Nội dung |
|---|---|
| `PUSH_VAPID_PRIVATE_KEY` | `privateKey` của cặp khoá VAPID **dùng chung** GoldTrack / FuelTrack / LoveDays (workflow tự dùng `LOVE_VAPID_PRIVATE_KEY` nếu secret này trống) |
| `FUEL_PUSH_SUBSCRIPTIONS` | mảng JSON các mã do nút "Sao chép" trong FuelTrack tạo. Mã đăng ký gắn với service worker của từng app, nên **mỗi app trên mỗi máy có mã riêng** — không dùng lại mã của LoveDays/GoldTrack |
| `PUSH_VAPID_SUB` (tuỳ chọn) | claim `sub`, mặc định `https://letranvietlong.github.io` |

1. Nếu chưa có cặp khoá: ở thư mục **ngoài repo**, `npx --yes web-push generate-vapid-keys --json` → `privateKey` vào secret `PUSH_VAPID_PRIVATE_KEY`. Không ghi khoá vào file nào trong repo (repo công khai, Stop hook `git add -A`).
2. `publicKey` vào hằng `VAPID_PUBLIC_KEY` ở đầu `js/fuel-track.js` — **phải giống hệt** hằng cùng tên trong GoldTrack và LoveDays. Trống → mục Thông báo hiện "Chưa cấu hình khoá thông báo", ẩn ô tên máy và nút Bật.
3. Mỗi iPhone (iOS 16.4+): Safari → Thêm vào MH chính → mở FuelTrack từ icon → Cài đặt → Thông báo → đặt tên máy → Bật thông báo → Cho phép → Sao chép.
4. Gộp mã các máy thành `[mã 1, mã 2]` → secret `FUEL_PUSH_SUBSCRIPTIONS`.
5. Actions → "Update fuel price" → Run workflow với `notify_dry_run` (log liệt kê tên máy và nội dung sẽ gửi), rồi `notify_force` để nhận thử thật.

- Mã đổi: app lưu hash endpoint lúc "Sao chép" trong `localStorage` `fueltrack_push_v1` `{deviceLabel, lastCopiedEndpointHash}`; mở app thấy khác/mất → dòng cảnh báo trong thẻ Thông báo (mất hẳn mã → thêm nút "Tôi đã tắt thông báo"). "Gửi thử trên máy này" gọi `showNotification` ngay trên máy với giá đang tải (tiêu đề "Giá xăng dầu (thử)", không qua workflow); bị tắt thì dòng nhỏ dưới nút nói lý do.
- Không kiểm chứng được trên Chromium: Web Push thật qua APNs, bảng chia sẻ "Lưu vào Tệp", bàn phím trong sheet, safe-area thật của tab bar (xem dòng chẩn đoán ở Cài đặt → Thông tin → Thông tin kỹ thuật).
