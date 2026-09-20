---
name: project-structure
description: Nguyên tắc tổ chức thư mục và file cho site tĩnh nhiều sản phẩm này — cái gì được phép ở root, khi nào tách file, đặt tên ra sao, và cách di chuyển file mà không làm hỏng thứ khác. Dùng khi thêm sản phẩm/trang mới, thêm asset, tách file lớn, dọn cấu trúc, hoặc khi phân vân "file này nên để đâu".
---

# Cấu trúc project

Repo này là **nhiều sản phẩm độc lập trong một site tĩnh** trên GitHub Pages: không framework, không build step, không backend. Mọi quy ước dưới đây phục vụ một mục tiêu: **mở repo lên là đoán được file nằm đâu, và di chuyển được file mà không làm hỏng ngầm thứ gì.**

---

## 1. Luật vàng của thư mục gốc

> **Root chỉ chứa: trang sản phẩm, và những file mà NỀN TẢNG bắt buộc phải ở root.**

Không có ngoại lệ "cho tiện". Mỗi file ở root phải trả lời được câu: *"nếu chuyển vào thư mục con thì hỏng cái gì?"* — không trả lời được thì nó không thuộc về root.

Hai file duy nhất hiện được miễn trừ, và **lý do đã được kiểm chứng bằng thực nghiệm chứ không phải phỏng đoán**:

| File | Vì sao bắt buộc ở root |
|---|---|
| `sw-goldtrack.js` | Service worker chỉ điều khiển được trang **ngang hàng hoặc dưới** thư mục của nó. Đăng ký từ `/js/` → scope co lại `/js/`, mất offline cho `/GoldTrack.html`. Ép `scope:'/'` → `SecurityError: not under the max scope allowed ('/js/')`. Nới scope cần header `Service-Worker-Allowed`, GitHub Pages không set được. |
| `CLAUDE.md` | Claude Code tự nạp từ thư mục gốc của project. Chuyển đi = các quy ước trong đó mất hiệu lực, âm thầm. |

**Mẹo quan trọng:** khi nền tảng bắt buộc một file ở root, hãy để ở root **đúng phần tối thiểu bắt buộc**, đẩy phần còn lại vào đúng chỗ. `sw-goldtrack.js` làm đúng vậy: root giữ vỏ 17 dòng (gần hết là comment giải thích), 99 dòng logic nằm ở `js/sw-goldtrack-core.js` và được nạp qua `importScripts`. Đây cũng là cách Workbox/Next.js làm.

## 2. Bản đồ thư mục

```
/                 trang sản phẩm (*.html) + file nền tảng bắt buộc
├── css/          style tách riêng, tên trùng tên trang
├── js/           logic tách riêng, tên trùng tên trang
├── img/          ảnh, icon — tiền tố theo sản phẩm
├── json/         dữ liệu hạt giống, người viết tay
├── data/         dữ liệu do máy sinh (GitHub Actions ghi đè)
├── scripts/      script build/fetch chạy trong CI (Python)
└── docs/         tài liệu (.md)
```

**`json/` và `data/` khác nhau, đừng trộn:** `json/` là seed do người viết, sửa tay được, commit có chủ đích. `data/` do bot ghi đè liên tục — sửa tay ở đây sẽ bị mất ở lần chạy CI kế tiếp. Nhìn thư mục là biết được phép sửa tay hay không.

## 3. Khi nào tách file khỏi HTML

Site này chấp nhận **cả hai kiểu**, chọn theo quy mô — đừng tách chỉ vì "cho chuẩn":

| Quy mô trang | Cách làm |
|---|---|
| Nhỏ, một mục đích, ít thay đổi | Để inline trong `.html`. Một file, dễ copy, không cần nhớ 3 chỗ. |
| Lớn, sửa thường xuyên, nhiều tính năng | Tách `css/<tên>.css` + `js/<tên>.js` |

Ngưỡng thực tế: **khi file HTML vượt ~800–1000 dòng**, hoặc khi bạn bắt đầu phải cuộn rất lâu mới tới đoạn cần sửa, thì tách. GoldTrack tách khi chạm 2540 dòng → còn 322 dòng markup.

**Quy tắc đặt tên: file phụ trợ mang đúng tên trang nó phục vụ.** `ThubeeFarmery.html` → `css/ThubeeFarmery.css` + `js/ThubeeFarmery.js`. Không đặt tên chung chung (`main.js`, `style.css`, `utils.js`) — repo nhiều sản phẩm mà đặt vậy là hết đường lần ra chủ sở hữu.

## 4. Cách tách file lớn mà không sai một byte

**Tuyệt đối không gõ lại nội dung bằng tay.** Cắt theo số dòng bằng script:

```bash
grep -n "<style>\|</style>\|<script>\|</script>" trang.html   # tìm ranh giới trước
```
```python
lines = open('trang.html', encoding='utf-8').readlines()
open('css/trang.css','w',encoding='utf-8',newline='').writelines(lines[18:441])   # 19..441
open('js/trang.js','w',encoding='utf-8',newline='').writelines(lines[744:2537])   # 745..2537
out = lines[0:17] + ['<link rel="stylesheet" href="css/trang.css">\n'] \
    + lines[442:743] + ['<script src="js/trang.js"></script>\n'] + lines[2538:]
open('trang.html','w',encoding='utf-8',newline='').writelines(out)
```

Sau khi tách, kiểm tra **cả ba**, thiếu một là chưa xong:
1. `grep -c "<style>\|<script>" trang.html` → phải bằng 0 (không sót inline).
2. Mở trang thật, xác nhận CSS **có áp dụng** và JS **có chạy** (không chỉ HTTP 200 — file 200 nhưng sai đường dẫn tương đối vẫn 200).
3. Không có request nào ≥400.

## 5. Di chuyển file: danh sách nơi phải cập nhật theo

Đây là chỗ hay sót nhất. Mỗi lần đổi đường dẫn, rà **đủ 6 nơi**:

- [ ] Thẻ `<link>` / `<script src>` trong HTML
- [ ] **Danh sách cache của service worker** (`APP_CODE_PATHS` / `ICON_PATHS` / `DATA_PATHS`) **và bump `CACHE_NAME`** — quên là app hỏng khi offline, hoặc kẹt bản cũ mãi
- [ ] Đường dẫn trong script Python (`scripts/*.py` ghi vào `data/`)
- [ ] Sơ đồ cấu trúc trong `docs/README.md`
- [ ] `CLAUDE.md` nếu file đó thuộc quy ước làm việc
- [ ] `.gitignore`

Dùng `git mv` thay vì `mv` để git theo dõi được là *đổi tên* chứ không phải *xoá + thêm mới* — lịch sử file được giữ nguyên.

Kiểm tra chéo tự động sau khi di chuyển:
```bash
# tai nguyen HTML load co nam trong cache service worker khong?
grep -o 'href="[^"]*"\|src="[^"]*"' GoldTrack.html | grep -o '\(css\|js\|img\)/[^"]*' | sort -u \
  | while read p; do grep -q "/$p" js/sw-goldtrack-core.js && echo "OK   $p" || echo "SOT  $p"; done
```

## 6. Tài liệu phải khớp thực tế, nếu không thà không có

Sơ đồ cấu trúc trong README từng **thiếu hẳn GoldTrack** dù sản phẩm đó đã tồn tại từ lâu. Tài liệu sai còn tệ hơn không có tài liệu, vì nó khiến người đọc tin nhầm.

Khi tài liệu nhắc tên hàm/hằng/khoá, hãy **đối chiếu với code thật** trước khi commit:
```bash
for name in findLedgerViolation APP_CODE_PATHS CACHE_NAME; do
  grep -rq "$name" js/ && echo "OK   $name" || echo "SAI  $name (khong ton tai)"
done
```

## 7. Quyết định nhanh: file mới nên để đâu?

```
File này là gì?
├─ Trang sản phẩm (.html)                → root
├─ Nền tảng BẮT BUỘC ở root?             → root, nhưng chỉ giữ phần tối thiểu,
│                                           đẩy logic vào thư mục con
├─ Style của một trang                    → css/<tên trang>.css
├─ Logic của một trang                    → js/<tên trang>.js
├─ Ảnh/icon                               → img/<tiền tố sản phẩm>-*
├─ Dữ liệu người viết tay                 → json/
├─ Dữ liệu máy sinh (CI ghi đè)           → data/
├─ Script chạy trong CI                   → scripts/
└─ Tài liệu (.md)                         → docs/
```
