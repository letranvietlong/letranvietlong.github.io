---
name: goldtrack-data-pipeline
description: Cách GoldTrack tự lấy giá vàng qua GitHub Actions — nguồn dữ liệu (Ngọc Thịnh + Huy Thanh), quy tắc đơn vị chỉ/lượng, xử lý múi giờ, và race condition khi bot commit. Dùng khi sửa products/gold-track/py/fetch_gold_price.py, sửa workflow, thêm nguồn dữ liệu, hoặc khi giá không cập nhật.
---

# Pipeline dữ liệu GoldTrack

Site tĩnh không có backend. Dữ liệu được **GitHub Actions chạy định kỳ, scrape rồi commit thẳng vào repo**; trình duyệt chỉ đọc file JSON tĩnh cùng origin.

```
GitHub Actions (cron)
  └── products/gold-track/py/fetch_gold_price.py → products/gold-track/data/gold-price.json, gold-price-history.json
                                     ↓ commit + push
                  products/gold-track/js/gold-track.js fetch('/products/gold-track/data/*.json')
```

Script tự tính đường dẫn dữ liệu tương đối theo chính vị trí của mình (`PRODUCT_ROOT = dirname(dirname(__file__))` trỏ về `products/gold-track/`), không hardcode `"products", "gold-track"` trong path — vì đã nằm sẵn trong đúng thư mục sản phẩm.

## Giá vàng

**2 tiệm, mỗi tiệm chỉ theo dõi đúng 1 loại vàng** (chủ đích thu hẹp, không phải giới hạn kỹ thuật — `NGOCTHINH_TYPES`/`HUYTHANH_TYPES` trong `fetch_gold_price.py` mỗi cái chỉ có 1 entry, dù shape JSON vẫn là shop→types để dễ mở rộng lại sau này):

- **Ngọc Thịnh Jewelry** (`ngocthinh-jewelry.vn/pages/bang-gia-vang`, chỉ "Vàng 9999 (nhẫn tròn)") — HTML render sẵn, không có API, parse bằng regex trên các `<div class="stylecus headerindex1/2/3">`.
- **Huy Thanh Jewelry** (`huythanhjewelry.vn/gia-vang-hom-nay`, chỉ "Vàng Huy Thanh 24k") — site Next.js; giá KHÔNG nằm ở bảng HTML hiển thị mà nhúng sẵn dạng JSON escaped trong 1 script chunk RSC (`self.__next_f.push(...)`) — regex bắt trực tiếp `\"giaban\\":(\d+),\\"giamua\\":(\d+),\\"loaivang\\":\\"([^"\\]+)\\"` từ chunk đó, không dựng lại rồi `json.loads()` cả blob (dễ vỡ nếu cấu trúc RSC đổi thứ tự field). `giaban:0` là dòng tham chiếu thị trường, không phải giá giao dịch thật — phải loại.

**Đơn vị — chỗ dễ sai nhất:** người Việt dùng **chỉ** và **lượng** (1 lượng = 10 chỉ). Giá trên trang nguồn ghi rõ **VNĐ/CHỈ**. Toàn bộ app thống nhất dùng **chỉ**.

> Từng có bug: giả định số thô là VNĐ/lượng rồi chia 10 → sai 10 lần. Cách kiểm chứng: đối chiếu với nguồn khác cho cùng loại vàng, nếu hai bên lệch nhau đúng 10 lần thì đang hiểu sai đơn vị.

**Chỉ ghi lịch sử khi thật sự đổi giá** (hoặc sang ngày mới theo giờ VN) — tránh làm phình `gold-price-history.json` bằng hàng trăm bản ghi trùng.

**Múi giờ:** dùng offset cố định, **không** dùng `zoneinfo` (môi trường có thể thiếu `tzdata`):
```python
VN_TZ = timezone(timedelta(hours=7))   # VN không có DST nên offset cố định là đủ
```
Cắt chuỗi ISO của UTC để lấy ngày sẽ **sai**: mọi thời điểm trước 07:00 giờ VN sẽ bị tính sang ngày hôm trước.

## GitHub Actions: lịch chạy KHÔNG đáng tin

Cron đặt 30 phút/lần nhưng thực tế quan sát được các lần chạy **cách nhau 3–6 tiếng**. GitHub hạ ưu tiên scheduled workflow của repo ít hoạt động — đây là hành vi đã biết của nền tảng, **không phải bug trong code**.

- Tránh đặt cron đúng phút `:00`/`:30` (khung giờ bị xếp hàng nặng nhất) — dùng kiểu `7,37 * * * *`.
- Muốn kiểm tra thật sự chạy lúc nào, **đừng đoán** — hỏi API:
  ```bash
  curl -s "https://api.github.com/repos/<owner>/<repo>/actions/workflows/<file>.yml/runs?per_page=20" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>JSON.parse(d).workflow_runs.forEach(r=>console.log(r.created_at,r.event,r.conclusion)))"
  ```
  Trường `event` cho biết `schedule` (tự chạy) hay `workflow_dispatch` (bấm tay).

## Race condition khi commit — đã từng làm mất commit

Bot Actions và hook auto-commit ở máy local **cùng push vào `main`**. `git push` trần sẽ thất bại im lặng, để commit local mắc kẹt không ai biết.

Cả hai phía phải dùng fetch + rebase + retry:
```bash
for i in 1 2 3 4 5; do
  git fetch origin main && git rebase origin/main && git push origin main && break
  git rebase --abort 2>/dev/null
  sleep 3
done
```

## Khi sửa script Python trên Windows

`print()` tiếng Việt ra console sẽ crash (`UnicodeEncodeError`, cp1252). Ghi ra file UTF-8 rồi đọc lại:
```python
with open('out.txt', 'w', encoding='utf-8') as f:
    f.write(text)
```

## Sau khi đổi cấu trúc dữ liệu

Thêm file JSON mới mà app đọc lúc chạy → **phải** thêm path vào `DATA_PATHS` trong `products/gold-track/js/sw-core.js` và bump `CACHE_NAME` (bump luôn `?v=` trong `importScripts()` ở vỏ `products/gold-track/sw-gold-track.js`), nếu không app hỏng khi offline.
