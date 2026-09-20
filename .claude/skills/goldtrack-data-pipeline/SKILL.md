---
name: goldtrack-data-pipeline
description: Cách GoldTrack tự lấy giá vàng và tin tức qua GitHub Actions — nguồn dữ liệu, quy tắc đơn vị chỉ/lượng, lọc tin, xử lý múi giờ, và race condition khi bot commit. Dùng khi sửa products/gold-track/py/fetch_*.py, sửa workflow, thêm nguồn dữ liệu, hoặc khi giá/tin không cập nhật.
---

# Pipeline dữ liệu GoldTrack

Site tĩnh không có backend. Dữ liệu được **GitHub Actions chạy định kỳ, scrape rồi commit thẳng vào repo**; trình duyệt chỉ đọc file JSON tĩnh cùng origin.

```
GitHub Actions (cron)
  ├── products/gold-track/py/fetch_gold_price.py → products/gold-track/data/gold-price.json, gold-price-history.json
  └── products/gold-track/py/fetch_gold_news.py  → products/gold-track/data/gold-news.json
                                     ↓ commit + push
                  products/gold-track/js/gold-track.js fetch('/products/gold-track/data/*.json')
```

Cả hai script tự tính đường dẫn dữ liệu tương đối theo chính vị trí của mình (`PRODUCT_ROOT = dirname(dirname(__file__))` trỏ về `products/gold-track/`), không hardcode `"products", "gold-track"` trong path — vì đã nằm sẵn trong đúng thư mục sản phẩm.

## Giá vàng

**Nguồn:** Ngọc Thịnh Jewelry (`ngocthinh-jewelry.vn/pages/bang-gia-vang`) — HTML render sẵn, không có API, phải parse bằng regex.

**Đơn vị — chỗ dễ sai nhất:** người Việt dùng **chỉ** và **lượng** (1 lượng = 10 chỉ). Giá trên trang nguồn ghi rõ **VNĐ/CHỈ**. Toàn bộ app thống nhất dùng **chỉ**.

> Từng có bug: giả định số thô là VNĐ/lượng rồi chia 10 → sai 10 lần. Cách kiểm chứng: đối chiếu với nguồn khác cho cùng loại vàng, nếu hai bên lệch nhau đúng 10 lần thì đang hiểu sai đơn vị.

**Chỉ ghi lịch sử khi thật sự đổi giá** (hoặc sang ngày mới theo giờ VN) — tránh làm phình `gold-price-history.json` bằng hàng trăm bản ghi trùng.

**Múi giờ:** dùng offset cố định, **không** dùng `zoneinfo` (môi trường có thể thiếu `tzdata`):
```python
VN_TZ = timezone(timedelta(hours=7))   # VN không có DST nên offset cố định là đủ
```
Cắt chuỗi ISO của UTC để lấy ngày sẽ **sai**: mọi thời điểm trước 07:00 giờ VN sẽ bị tính sang ngày hôm trước.

## Tin tức

**Nguồn:** RSS của CafeF + VnExpress (không nguồn nào có feed riêng về vàng) → lấy feed rộng rồi **lọc theo từ khoá**.

Lọc từ khoá kiểu "chứa chuỗi con" dính rất nhiều **dương tính giả** — đã gặp thật:

| Tiêu đề | Dính vì | Thực tế |
|---|---|---|
| "...siêu đô thị 10 tỷ USD, Vingroup đề xuất xây dựng" | `usd` | Bất động sản |
| "Big Tech — tài sản chiến lược nghìn tỷ USD" | `usd` | Không liên quan |
| "SCIC bán vốn doanh nghiệp nắm 'đất vàng' Đồng Khởi" | `vàng` | Thành ngữ bất động sản |

Quy tắc đã dùng: `tỷ|triệu|nghìn tỷ` + `usd` đứng liền nhau luôn là **con số tiền tệ**, không phải tin tỷ giá; `đất vàng` là thành ngữ, không phải kim loại. Tin tỷ giá thật viết là *"tỷ giá USD"*, *"đồng USD"*, *"giá USD"*.

**Dấu `...` cuối tiêu đề là của CafeF, không phải do mình cắt.** Đã xác minh: `<title>`, `og:title`, `<h1>` của chính bài báo đều mang dấu đó → không có bản đầy đủ hơn để lấy. Chỉ nên **bỏ dấu `...` thừa**, giữ nguyên phần nội dung còn lại (đừng cắt bớt danh sách cửa hàng — người dùng muốn xem đầy đủ).

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
