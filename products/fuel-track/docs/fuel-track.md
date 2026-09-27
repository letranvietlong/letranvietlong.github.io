# FuelTrack

Theo dõi giá bán lẻ xăng dầu PVOIL tại Đà Nẵng (nội thành = Vùng 1) theo từng ngày. **Chỉ xem giá** — không có mua/bán, danh mục hay lời/lỗ, không lưu gì trên máy người dùng. Trang cuộn một cột (không tabbar): giá hôm nay + mức tăng/giảm so với kỳ trước, biểu đồ theo ngày (4 loại trên một biểu đồ, đường cong monotone không vượt quá giá thật, mặc định 7N), lịch sử các kỳ điều chỉnh. PWA cài được lên iPhone qua "Add to Home Screen".

## Nguồn dữ liệu

- **pvoil.com.vn chặn mọi client không phải trình duyệt thật** (Cloudflare challenge 403 — kể cả curl_cffi và Chromium có giao diện). Không viết parser cho trang đó.
- Nguồn thực tế: `GET https://giaxanghomnay.com/api/pvdate/YYYY-MM-DD` (JSON, không auth). Trả mảng 4 phần tử: `[0]` Petrolimex ngày D (`zone1_price`/`zone2_price`), `[1]` PVOIL ngày D (`price`), `[2]`/`[3]` bản ghi liền trước. Ngày chưa có bản ghi → phần tử rỗng.
- Bản ghi ngày D được tạo lúc 00:00 giờ VN; ngày có điều chỉnh (thường thứ Năm, hiệu lực 15:00) thì bản ghi bị **ghi đè trong ngày** bằng giá mới → bản ghi ngày D = giá áp dụng cuối ngày D.
- Giá PVOIL trùng khít Petrolimex Vùng 1 ở mọi mặt hàng chung. Feed PVOIL **không có E10 RON 95-III** → lấy `zone1_price` của Petrolimex, gắn `source: "petrolimex-v1"` và UI ghi chú rõ. Nếu một ngày feed PVOIL tự có E10 thì dùng của PVOIL. **DO 0,001S-V bị loại** vì giá Petrolimex lệch PVOIL.
- Mặt hàng thay đổi theo thời gian: tới ~06/2026 PVOIL có RON 95-III, sau đó mất. Mặt hàng đã ngừng vẫn nằm trong lịch sử (hiện "Ngừng niêm yết") nhưng không được vẽ trên biểu đồ (biểu đồ vẽ mọi mặt hàng có trong mốc mới nhất, mỗi mặt hàng một đường).
- Rate limit ~60 request/phút, từng bị từ chối kết nối sau ~8 request cách nhau 1s → backfill nghỉ 2s giữa các request, retry backoff 5/10/20/40s.

## Dữ liệu (`data/`, do bot sinh — KHÔNG sửa tay)

- `fuel-price-history.json`: `{ items: {id: label}, changes: [{date, detectedAt, prices, sources?}] }` — **chỉ lưu điểm thay đổi** (entry mới khi bộ giá khác entry trước; mặt hàng biến mất cũng tính là thay đổi). `sources` chỉ liệt kê mặt hàng không lấy từ PVOIL. UI tự forward-fill ra giá từng ngày.
- `fuel-price.json`: suy ra từ 2 entry cuối — giá hiện hành, `prevPrice`, `change`, `source` từng mặt hàng. Không có timestamp "lần chạy gần nhất" để bot không commit rác mỗi lần chạy.
- `changelog.json`: lịch sử cập nhật hiển thị trong app (cùng quy tắc với GoldTrack — xem CLAUDE.md).

## Script & lịch chạy

- `py/fetch_fuel_price.py` (chạy thường): lấy ngày hôm nay theo giờ VN, không có thì hôm qua; lỗi mạng / không có dữ liệu → exit 1, không ghi file. Idempotent: chạy lại khi giá không đổi thì không đụng file nào.
- `--backfill-from YYYY-MM-DD`: quét từng ngày tới hôm nay. Nếu bị chặn giữa chừng, script ghi phần đã có và in ngày để chạy tiếp. Ngày cũ hơn entry cuối bị bỏ qua, nên chỉ backfill được "về phía trước" — muốn làm lại từ đầu thì xoá 2 file data rồi chạy lại.
- `.github/workflows/update-fuel-price.yml`: cron `23 * * * *` (mỗi giờ, phút :23). Từng chỉ chạy 5 lượt/ngày quanh 15:00 VN nhưng GitHub hay bỏ lượt hẹn giờ khi quá tải, nên chạy dày; không sinh commit rác vì script chỉ ghi khi giá đổi. Chỉ `git add` 2 file giá, vòng lặp fetch/rebase/push 5 lần để né race với các workflow khác.

## Cạm bẫy

- **Cache Storage dùng chung cả origin.** Service worker của GoldTrack và FuelTrack cùng thấy mọi cache; handler `activate` của mỗi bên **chỉ được xoá cache mang tiền tố của chính nó** (`fueltrack-cache-` / `goldtrack-cache-`). Xoá "mọi cache khác CACHE_NAME" sẽ xoá sạch offline của sản phẩm kia.
- Vỏ service worker `sw-fuel-track.js` nằm ngay trong `products/fuel-track/` (không lồng vào `js/`) vì lý do scope — giống GoldTrack. Đăng ký bằng đường dẫn tuyệt đối.
- **Thêm file mà app load lúc chạy** → thêm path vào `js/sw-core.js` (`APP_CODE_PATHS`/`ICON_PATHS`/`DATA_PATHS`), bump `CACHE_NAME` và `?v=` trong `sw-fuel-track.js`.
- Múi giờ: cả Python lẫn JS dùng offset cố định UTC+7 (VN không có DST), không cắt chuỗi ISO UTC.
- Màu: giá **tăng = đỏ ▲, giảm = xanh ▼** (người mua xăng coi tăng giá là xấu) — ngược với GoldTrack. Luôn kèm mũi tên, không chỉ phân biệt bằng màu.
- **Nguồn đôi khi trả bản ghi lỗi 1–2 ngày rồi quay lại** — bộ giá của kỳ cũ (thấy thật ngày 25/10/2025 và 26/12/2025) hoặc thiếu một dòng. `apply_observation` xử lý bằng quy tắc: một entry vừa xuất hiện ≤3 ngày sau entry trước, rồi ≤3 ngày sau đó giá quay về đúng trạng thái trước nó, thì entry đó là nhiễu và bị xoá (kỳ điều hành thật cách nhau ≥7 ngày). Phải xét **cả hai phía**: chỉ xét phía "quay về" sẽ xoá nhầm kỳ điều chỉnh thật khi bản ghi cũ tới 2 ngày sau thứ Năm. Trên trang live, nhiễu có thể hiện tối đa ~1 ngày trước khi tự lành.
