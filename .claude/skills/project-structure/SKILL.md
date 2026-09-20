---
name: project-structure
description: Nguyên tắc đặt tên file/folder và tổ chức thư mục cho site tĩnh nhiều sản phẩm này — cái gì được phép ở root, quy tắc kebab-case, tầng subfolder theo loại file bên trong mỗi sản phẩm, và cách di chuyển file mà không làm hỏng thứ khác. Dùng khi thêm sản phẩm/trang mới, thêm asset, tách file lớn, dọn cấu trúc, đổi tên file, hoặc khi phân vân "file này nên để đâu, đặt tên thế nào".
---

# Cấu trúc project

Repo này là **nhiều sản phẩm độc lập trong một site tĩnh** trên GitHub Pages: không framework, không build step, không backend. Mọi quy ước dưới đây phục vụ một mục tiêu: **mở repo lên là đoán được file nằm đâu và tên gì, và di chuyển được file mà không làm hỏng ngầm thứ gì.**

---

## 1. Luật vàng của thư mục gốc

> **Root chỉ chứa: `index.html`, thư mục `products/`, các thư mục dùng chung (`img/`, `scripts/`, `docs/`), và những file mà NỀN TẢNG bắt buộc phải ở root.**

Không có ngoại lệ "cho tiện". Mỗi file ở root phải trả lời được câu: *"nếu chuyển vào thư mục con thì hỏng cái gì?"* — không trả lời được thì nó không thuộc về root.

Hai file duy nhất hiện được miễn trừ, và **lý do đã được kiểm chứng bằng thực nghiệm chứ không phải phỏng đoán**:

| File | Vì sao bắt buộc ở root |
|---|---|
| `sw-gold-track.js` | Service worker chỉ điều khiển được trang **ngang hàng hoặc dưới** thư mục của nó. Đăng ký từ `/products/gold-track/js/` → scope co lại, mất offline cho các trang khác nếu GoldTrack lại đổi cấu trúc. Ép `scope:'/'` từ một thư mục con → `SecurityError: not under the max scope allowed`. Nới scope cần header `Service-Worker-Allowed`, GitHub Pages không set được. |
| `CLAUDE.md` | Claude Code tự nạp từ thư mục gốc của project. Chuyển đi = các quy ước trong đó mất hiệu lực, âm thầm. |

**Mẹo quan trọng:** khi nền tảng bắt buộc một file ở root, hãy để ở root **đúng phần tối thiểu bắt buộc**, đẩy phần còn lại vào đúng chỗ. `sw-gold-track.js` làm đúng vậy: root giữ vỏ ~17 dòng (gần hết là comment giải thích), phần logic thật nằm ở `products/gold-track/js/sw-core.js` và được nạp qua `importScripts`. Đây cũng là cách Workbox/Next.js làm.

## 2. Quy tắc đặt tên (kebab-case, thống nhất toàn repo)

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Thư mục sản phẩm (trong `products/`) | kebab-case | `gold-track/`, `thubee-farmery/`, `worldcup-2026/` |
| File `.html` của sản phẩm một-file (không có folder riêng) | kebab-case | `crypto-ai.html`, `viet-long-creator.html` |
| File `.css` / `.js` / `.ts` phụ trợ | kebab-case, trùng slug của sản phẩm | `gold-track.css`, `thubee-farmery.js` |
| File `.json` | kebab-case nếu tên nhiều từ, giữ nguyên nếu một từ | `gold-price-history.json`, `orders.json` |
| File `.py` | `snake_case` — theo quy ước ngôn ngữ Python, **cố ý không ép kebab-case** | `fetch_gold_price.py` |
| Tên biến/hằng số nội bộ trong JS/Python | **không đổi** — đây là quy tắc đặt tên FILE, không phải quy tắc code | `GOLDTRACK_PATHS`, `CACHE_NAME` giữ nguyên |

Đừng nhầm quy tắc tên file với tên định danh trong code — hai việc khác nhau. Đổi tên biến nội bộ khi không có lý do kỹ thuật là refactor ngoài phạm vi, không phải "thống nhất tên file".

## 3. Bản đồ thư mục

```
/                        index.html + file nền tảng bắt buộc ở root
├── products/            MỌI trang sản phẩm sống ở đây
│   ├── <ten-san-pham>.html         # sản phẩm một-file, không cần folder riêng
│   └── <ten-san-pham>/             # sản phẩm nhiều file — thêm 1 tầng theo LOẠI FILE
│       ├── html/<ten-san-pham>.html (hoặc index.html)
│       ├── css/<ten-san-pham>.css
│       ├── js/<ten-san-pham>.js    (+ .ts nếu có, nằm cùng chỗ với .js)
│       ├── manifest.json           # Web App Manifest, nếu có
│       ├── data/                   # dữ liệu do máy sinh (GitHub Actions ghi đè)
│       └── json/                   # dữ liệu hạt giống, người viết tay
├── img/                 ảnh, icon dùng chung — tiền tố theo sản phẩm
├── scripts/             script build/fetch chạy trong CI (Python) — CHỈ code chạy CI,
│                        không phải code browser-load, nên KHÔNG chuyển vào products/
└── docs/                tài liệu (.md)
```

**`json/` và `data/` khác nhau, đừng trộn:** `json/` là seed do người viết, sửa tay được, commit có chủ đích. `data/` do bot ghi đè liên tục — sửa tay ở đây sẽ bị mất ở lần chạy CI kế tiếp. Nhìn thư mục là biết được phép sửa tay hay không.

**Sản phẩm một-file ở lại flat, KHÔNG bị ép vào cấu trúc 3 tầng `products/<ten>/html/<ten>.html`.** Chỉ khi sản phẩm thật sự có ≥2 loại file riêng (css/js tách biệt) mới đáng để thêm tầng subfolder — thêm tầng cho một file HTML độc lập chỉ tạo thêm việc điều hướng không lợi ích gì.

**`scripts/*.py` (fetch_gold_price.py, fetch_gold_news.py) cố ý ở lại `scripts/` chung, không chuyển vào `products/gold-track/py/`.** Lý do: `scripts/` = code chỉ chạy trong CI (GitHub Actions), tách biệt hẳn khỏi code browser-load trong `products/`. Gộp chung làm tăng rủi ro ai đó vô tình thêm nhầm `.py` vào danh sách cache của service worker.

## 4. Khi nào tách file khỏi HTML

Site này chấp nhận **cả hai kiểu**, chọn theo quy mô — đừng tách chỉ vì "cho chuẩn":

| Quy mô trang | Cách làm |
|---|---|
| Nhỏ, một mục đích, ít thay đổi | Để inline trong `.html`, để flat trong `products/<ten>.html`. |
| Lớn, sửa thường xuyên, nhiều tính năng | Tách `products/<ten>/css/<ten>.css` + `products/<ten>/js/<ten>.js`, thêm tầng `html/` chứa trang chính. |

Ngưỡng thực tế: **khi file HTML vượt ~800–1000 dòng**, hoặc khi bạn bắt đầu phải cuộn rất lâu mới tới đoạn cần sửa, thì tách. GoldTrack tách khi chạm 2540 dòng → còn ~320 dòng markup.

## 5. Cách tách file lớn mà không sai một byte

**Tuyệt đối không gõ lại nội dung bằng tay.** Cắt theo số dòng bằng script:

```bash
grep -n "<style>\|</style>\|<script>\|</script>" trang.html   # tìm ranh giới trước
```
```python
lines = open('trang.html', encoding='utf-8').readlines()
open('css/trang.css','w',encoding='utf-8',newline='').writelines(lines[18:441])   # 19..441
open('js/trang.js','w',encoding='utf-8',newline='').writelines(lines[744:2537])   # 745..2537
out = lines[0:17] + ['<link rel="stylesheet" href="../css/trang.css">\n'] \
    + lines[442:743] + ['<script src="../js/trang.js"></script>\n'] + lines[2538:]
open('html/trang.html','w',encoding='utf-8',newline='').writelines(out)
```

Sau khi tách, kiểm tra **cả ba**, thiếu một là chưa xong:
1. `grep -c "<style>\|<script>" html/trang.html` → phải bằng 0 (không sót inline).
2. Mở trang thật, xác nhận CSS **có áp dụng** và JS **có chạy** (không chỉ HTTP 200 — file 200 nhưng sai đường dẫn tương đối vẫn 200).
3. Không có request nào ≥400.

## 6. Di chuyển/đổi tên file: danh sách nơi phải cập nhật theo

Đây là chỗ hay sót nhất. Mỗi lần đổi đường dẫn hoặc tên file, rà **đủ các nơi sau**:

- [ ] Thẻ `<link>` / `<script src>` trong HTML (chú ý: đường dẫn tương đối đổi theo số tầng thư mục, ví dụ thêm tầng `html/` thì asset dùng `../css/...` thay vì `css/...`)
- [ ] **Danh sách cache của service worker** (`APP_CODE_PATHS` / `ICON_PATHS` / `DATA_PATHS`) **và bump `CACHE_NAME`** — quên là app hỏng khi offline, hoặc kẹt bản cũ mãi. Bump luôn `?v=` trong `importScripts()` ở vỏ root cho khớp.
- [ ] `navigator.serviceWorker.register(...)` và mọi `fetch(...)` đường dẫn tuyệt đối trong JS
- [ ] Đường dẫn trong script Python (`scripts/*.py` ghi vào `data/`)
- [ ] `.github/workflows/*.yml` (đường dẫn `git add` và bất kỳ path nào đọc lại file JSON)
- [ ] `manifest.json` của sản phẩm đó (`start_url`, `icons[].src`)
- [ ] Mọi self-reference URL bên trong chính trang đó (`<link rel="canonical">`, `<meta property="og:url">`, JSON-LD `"url"`, `data:` URI manifest inline) — dễ sót nhất vì trang tự trỏ về chính nó
- [ ] Sơ đồ cấu trúc + bảng Products trong `docs/README.md`
- [ ] `CLAUDE.md` nếu file đó thuộc quy ước làm việc
- [ ] `.claude/agents/*.md` nếu agent nào tham chiếu đường dẫn cụ thể
- [ ] `.gitignore`

Dùng `git mv` thay vì `mv` để git theo dõi được là *đổi tên* chứ không phải *xoá + thêm mới* — lịch sử file được giữ nguyên.

Kiểm tra chéo tự động sau khi di chuyển:
```bash
# tai nguyen HTML load co nam trong cache service worker khong?
grep -o 'href="[^"]*"\|src="[^"]*"' products/gold-track/html/index.html | grep -o '\(css\|js\|img\)/[^"]*' | sort -u \
  | while read p; do grep -q "$p" products/gold-track/js/sw-core.js && echo "OK   $p" || echo "SOT  $p"; done

# quet toan repo tim ten file/duong dan cu con sot lai sau khi doi ten
grep -rn "ten-cu-khong-gach-ngang\|TenCu.html" --include="*.html" --include="*.js" --include="*.py" --include="*.yml" --include="*.md" .
```

## 7. Giới hạn thật của Web App Manifest trên iOS — đừng hứa quá

Thêm `manifest.json` (`<link rel="manifest">`) cải thiện trải nghiệm cài đặt trên Android/desktop, nhưng **không** khiến icon "Add to Home Screen" đã ghim sẵn trên iOS tự sửa lại nếu URL trang di chuyển sau này. iOS ghim theo **URL cụ thể lúc thêm**, không đọc lại `start_url` của manifest để tự chuyển hướng. Sau bất kỳ lần đổi URL nào ảnh hưởng một trang đã được ghim trên iOS, người dùng vẫn phải xoá icon cũ và Add to Home Screen lại.

## 8. Tài liệu phải khớp thực tế, nếu không thà không có

Sơ đồ cấu trúc trong README từng **thiếu hẳn GoldTrack** dù sản phẩm đó đã tồn tại từ lâu, và từng **lạc hậu sau mỗi lần đổi cấu trúc**. Tài liệu sai còn tệ hơn không có tài liệu, vì nó khiến người đọc tin nhầm.

Khi tài liệu nhắc tên hàm/hằng/khoá/đường dẫn, hãy **đối chiếu với code thật** trước khi commit:
```bash
for name in findLedgerViolation APP_CODE_PATHS CACHE_NAME; do
  grep -rq "$name" products/gold-track/js/ && echo "OK   $name" || echo "SAI  $name (khong ton tai)"
done
```

## 9. Quyết định nhanh: file mới nên để đâu, tên gì?

```
File này là gì?
├─ Trang sản phẩm một-file (.html)        → products/<ten-kebab-case>.html
├─ Trang sản phẩm nhiều file              → products/<ten-kebab-case>/html/...
├─ Nền tảng BẮT BUỘC ở root?              → root, nhưng chỉ giữ phần tối thiểu,
│                                            đẩy logic vào thư mục con của sản phẩm
├─ Style của một trang nhiều file          → products/<ten>/css/<ten>.css
├─ Logic của một trang nhiều file          → products/<ten>/js/<ten>.js (+ .ts cùng chỗ)
├─ Web App Manifest                        → products/<ten>/manifest.json
├─ Ảnh/icon                                → img/<tiền tố sản phẩm>-*
├─ Dữ liệu người viết tay                  → products/<ten>/json/
├─ Dữ liệu máy sinh (CI ghi đè)            → products/<ten>/data/
├─ Script chạy trong CI (Python)           → scripts/ (KHÔNG vào products/)
└─ Tài liệu (.md)                          → docs/
```
