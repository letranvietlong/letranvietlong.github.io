---
name: project-structure
description: Nguyên tắc đặt tên file/folder và tổ chức thư mục cho site tĩnh nhiều sản phẩm này — cái gì được phép ở root, quy tắc kebab-case, tầng subfolder theo loại file bên trong mỗi sản phẩm, và cách di chuyển file mà không làm hỏng thứ khác. Dùng khi thêm sản phẩm/trang mới, thêm asset, tách file lớn, dọn cấu trúc, đổi tên file, hoặc khi phân vân "file này nên để đâu, đặt tên thế nào".
---

# Cấu trúc project

Repo này là **nhiều sản phẩm độc lập trong một site tĩnh** trên GitHub Pages: không framework, không build step, không backend. Mọi quy ước dưới đây phục vụ một mục tiêu: **mở repo lên là đoán được file nằm đâu và tên gì, và di chuyển được file mà không làm hỏng ngầm thứ gì.**

---

## 1. Luật vàng của thư mục gốc

> **Root chỉ chứa: `index.html`, thư mục `products/`, và những file mà NỀN TẢNG (GitHub/Claude Code/chuẩn web) bắt buộc phải ở root.**

Không có ngoại lệ "cho tiện". Mỗi file ở root phải trả lời được câu: *"nếu chuyển vào thư mục con thì hỏng cái gì?"* — không trả lời được thì nó không thuộc về root.

Hiện chỉ còn **bốn** file được miễn trừ:

| File | Vì sao bắt buộc ở root |
|---|---|
| `CLAUDE.md` | Claude Code tự nạp từ thư mục gốc của project. Chuyển đi = các quy ước trong đó mất hiệu lực, âm thầm. |
| `README.md` | GitHub chỉ hiển thị `README.md` ở **root** làm trang chủ repo trên github.com — một `README.md` trong subfolder (kể cả `docs/`) không được dùng cho việc này. Đặt trong `docs/` từng khiến trang chủ repo trên GitHub trống trơn. |
| `robots.txt` | Chuẩn Robots Exclusion Protocol quy định trình thu thập dữ liệu (Googlebot...) chỉ tìm file này tại đúng gốc domain (`/robots.txt`) — đặt trong subfolder thì không crawler nào đọc được. |
| `sitemap.xml` | Không bắt buộc kỹ thuật tuyệt đối (có thể khai báo đường dẫn khác trong `robots.txt`), nhưng đặt ở root là quy ước gần như phổ quát mà Google Search Console/Bing Webmaster Tools mặc định tìm tới trước — đặt nơi khác chỉ tạo thêm bước cấu hình không cần thiết. |

Tài liệu riêng của từng sản phẩm KHÔNG đặt ở root — mỗi `products/<ten>/` có `docs/*.md` riêng, mô tả đúng sản phẩm đó (xem mục 9 bên dưới).

`sw-gold-track.js` từng nằm ở root với lý do "phòng hờ tương lai" (scope toàn origin, an toàn dù GoldTrack đổi cấu trúc) — nhưng nó chưa bao giờ thực sự cần điều khiển gì ngoài GoldTrack, nên giữ ở root là scope rộng hơn mức cần thiết một cách không cần thiết, và vi phạm nguyên tắc "mọi thứ của một sản phẩm nằm trong folder của sản phẩm đó". Đã chuyển vào `products/gold-track/sw-gold-track.js` — xem mục **"Vỏ bắt buộc ở đúng cấp thư mục nào?"** ngay dưới đây.

**Mẹo quan trọng, áp dụng cho MỌI file mà nền tảng ép về một vị trí cụ thể (dù là root hay chỉ là một cấp thư mục trong một sản phẩm):** chỉ giữ ở đó **đúng phần tối thiểu bắt buộc**, đẩy phần còn lại (logic thật) vào đúng chỗ theo quy tắc chung. Đây cũng là cách Workbox/Next.js làm.

### Vỏ service worker bắt buộc ở đúng cấp thư mục nào?

Service worker chỉ điều khiển được trang **ngang hàng hoặc dưới** thư mục chứa chính file đăng ký nó (scope mặc định = thư mục chứa script + mọi thứ bên dưới). Ép scope rộng hơn thư mục đó ném `SecurityError: not under the max scope allowed`; nới scope cần header HTTP `Service-Worker-Allowed`, GitHub Pages không set được — nên **vỏ phải nằm ở đúng cấp thư mục bao phủ đủ mọi thứ nó cần quản, không hơn không kém**, và không thể sửa sai bằng cấu hình sau đó.

Ví dụ GoldTrack (`products/gold-track/sw-gold-track.js`, nằm ngang hàng với `html/`, `css/`, `js/`, `data/`, `img/`, KHÔNG lồng vào `js/`):
- Nếu đặt trong `products/gold-track/js/` → scope co lại `/products/gold-track/js/`, không còn quản được `html/`, `data/`, `img/` của chính GoldTrack → mất offline ngay trên sản phẩm nó phục vụ.
- Đặt thẳng trong `products/gold-track/` → scope là `/products/gold-track/` → đúng và đủ, vì service worker này chưa bao giờ cần điều khiển gì ngoài GoldTrack.

Quy tắc chung khi một sản phẩm cần service worker: đặt vỏ ở **cấp thư mục cha thấp nhất bao phủ đủ mọi file sản phẩm đó cần cache** (thường là ngay tại `products/<ten>/`), không lồng vào bất kỳ subfolder loại-file nào (`html/`, `css/`, `js/`...) vì subfolder luôn hẹp hơn mức cần. Logic thật vẫn nằm ở `js/sw-core.js` như mọi file JS khác, vỏ chỉ `importScripts` vào đó.

**Di chuyển vỏ service worker đã có registration thật (site đang live) cần dọn dẹp registration cũ:** trình duyệt của người dùng cũ vẫn giữ registration ở scope trước đó cho tới khi có gì đó unregister nó — không tự hết hạn. Thêm code gọi `navigator.serviceWorker.getRegistrations()` và unregister registration có scope cũ trước khi đăng ký registration mới, để người dùng cũ không bị kẹt 2 service worker chồng nhau vô thời hạn.

## 2. Quy tắc đặt tên (kebab-case, thống nhất toàn repo)

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Thư mục sản phẩm (trong `products/`) | kebab-case | `gold-track/`, `thubee-farmery/`, `worldcup-2026/`, `thanh-thu-fruit/` |
| File `.html` chính của một sản phẩm | `index.html` bên trong `html/` của sản phẩm đó — kể cả sản phẩm chỉ có 1 file | `products/mini-game-hub/html/index.html` |
| File `.css` / `.js` / `.ts` phụ trợ | kebab-case, trùng slug của sản phẩm | `gold-track.css`, `thubee-farmery.js` |
| File `.json` | kebab-case nếu tên nhiều từ, giữ nguyên nếu một từ | `gold-price-history.json`, `orders.json` |
| File `.py` | `snake_case` cho tên file — theo quy ước ngôn ngữ Python, **cố ý không ép kebab-case**; nhưng vẫn nằm trong tầng subfolder `py/` của đúng sản phẩm sở hữu nó, như mọi loại file khác | `products/gold-track/py/fetch_gold_price.py` |
| Tên biến/hằng số nội bộ trong JS/Python | **không đổi** — đây là quy tắc đặt tên FILE, không phải quy tắc code | `GOLDTRACK_PATHS`, `CACHE_NAME` giữ nguyên |

Đừng nhầm quy tắc tên file với tên định danh trong code — hai việc khác nhau. Đổi tên biến nội bộ khi không có lý do kỹ thuật là refactor ngoài phạm vi, không phải "thống nhất tên file".

## 3. Bản đồ thư mục

```
/                        index.html + file nền tảng bắt buộc ở root
├── CLAUDE.md, README.md, robots.txt, sitemap.xml   # 4 ngoại lệ root — xem mục 1
├── css/index.css        # CSS của index.html — index.html KHÔNG nằm trong products/
├── js/index.js          # nhưng vẫn buộc phải tách css/js như mọi trang lớn khác,
│                        # nên có css/ và js/ CỦA RIÊNG nó ngay tại root, không lồng vào products/
├── img/og-image.jpg     # ảnh dùng cho og:image/twitter:image khi chia sẻ trang chủ
└── products/            MỌI trang sản phẩm sống ở đây — MỖI sản phẩm có folder riêng,
    │                    kể cả sản phẩm chỉ có 1 file HTML, không có ngoại lệ flat
    └── <ten-san-pham>/
        ├── html/index.html         # trang chính; sản phẩm 1-file chỉ có mỗi file này
        ├── html/<trang-phu>.html   # trang phụ CỦA sản phẩm này (vd. privacy/terms), nếu có
        ├── css/<ten-san-pham>.css  # chỉ có nếu CSS đã tách khỏi HTML
        ├── js/<ten-san-pham>.js    # chỉ có nếu JS đã tách khỏi HTML (+ .ts nếu có, cùng chỗ)
        ├── py/<ten_script>.py      # script Python CHỈ dùng riêng cho sản phẩm này
        ├── img/<ten-san-pham>-icon*  # icon/ảnh CHỈ dùng riêng cho sản phẩm này, nếu có file thật
        ├── manifest.json           # Web App Manifest, nếu có
        ├── docs/*.md               # Tài liệu mô tả RIÊNG sản phẩm này — planner/agent khác đọc trước khi sửa
        ├── data/                   # dữ liệu do máy sinh (GitHub Actions ghi đè)
        └── json/                   # dữ liệu hạt giống, người viết tay
```

Không còn `docs/` dùng chung ở root — tài liệu tổng quan toàn repo nằm trong `README.md` ở root; tài liệu riêng từng sản phẩm nằm trong `products/<ten>/docs/` của chính nó.

**`img/` nằm TRONG từng sản phẩm, không có `img/` dùng chung ở root.** Icon/favicon của một sản phẩm là file riêng của nó — di chuyển hay xoá sản phẩm không kéo theo dọn dẹp một thư mục dùng chung ở nơi khác. Nhiều sản phẩm nhúng icon trực tiếp bằng data URI trong HTML nên không cần `img/` — chỉ tạo `img/` khi sản phẩm thực sự có file ảnh riêng (ví dụ PNG nhiều kích thước cho `apple-touch-icon`). Chỉ tạo `img/` dùng chung ở root nếu sau này xuất hiện ảnh thật sự cross-product — hiện repo chưa có trường hợp này.

**`json/` và `data/` khác nhau, đừng trộn:** `json/` là seed do người viết, sửa tay được, commit có chủ đích. `data/` do bot ghi đè liên tục — sửa tay ở đây sẽ bị mất ở lần chạy CI kế tiếp. Nhìn thư mục là biết được phép sửa tay hay không.

**Mọi sản phẩm đều có folder riêng, kể cả chỉ 1 file HTML không tách css/js.** Từng có ngoại lệ "sản phẩm 1-file ở lại flat trong `products/<ten>.html`" — đã bỏ theo yêu cầu đồng nhất tuyệt đối của người dùng, vì để 2 kiểu cấu trúc song song (có folder / không có folder) gây khó đoán hơn là tốn thêm 1 tầng thư mục cho sản phẩm nhỏ.

**Trang phụ thuộc về một sản phẩm (không phải sản phẩm độc lập) nằm trong `html/` của CHÍNH sản phẩm đó, không nằm ngang hàng ở `products/`.** Ví dụ: `privacy.html`/`terms.html` là trang pháp lý của VietLong Creator (không phải sản phẩm riêng) → nằm ở `products/viet-long-creator/html/privacy.html`, `.../terms.html`, không phải `products/privacy.html`. Trước khi tạo folder riêng cho một file `.html` mới, tự hỏi: *"file này có phải một sản phẩm độc lập, hay là trang phụ trợ của một sản phẩm đã có?"*

**Script Python chạy trong CI (GitHub Actions) nằm trong `py/` của đúng sản phẩm nó phục vụ** — ví dụ `products/gold-track/py/fetch_gold_price.py` — **cùng nguyên tắc file-type-subfolder như html/css/js/data**, không có ngoại lệ cho `.py`. Script tự tính đường dẫn dữ liệu tương đối theo vị trí của chính nó (`dirname(dirname(__file__))` trỏ về thư mục sản phẩm), không hardcode tên sản phẩm trong path — nhờ vậy path luôn đúng dù sản phẩm đổi tên sau này. Không có `scripts/` dùng chung ở root: nếu sau này có script CI thật sự cross-product (dùng chung cho ≥2 sản phẩm, không thuộc riêng ai), lúc đó mới đáng tạo một thư mục dùng chung — hiện tại chưa có trường hợp này.

## 4. Khi nào tách file khỏi HTML

**Quy tắc hiện tại: tách bất cứ khi nào có `<style>`/`<script>` đáng kể, không chờ ngưỡng LOC.** Từng có ngoại lệ "trang nhỏ thì để inline" dựa theo ngưỡng ~800–1000 dòng — đã bỏ theo yêu cầu của người dùng, vì "sản phẩm chỉ có html thì tách css/js nếu có" áp dụng cho MỌI sản phẩm html-only, kể cả những trang chỉ vài trăm dòng (ví dụ `mini-game-hub`, `viet-long-social`, hay các trang pháp lý `privacy.html`/`terms.html` chỉ ~15 dòng CSS).

Chỉ giữ inline những đoạn **nhỏ, mang tính bootstrap/metadata**, không phải "logic" theo nghĩa cần tách:
- JSON-LD structured data (`<script type="application/ld+json">`) — vài dòng, thuộc về `<head>`, không phải logic ứng dụng.
- Script chống FOUC (Flash of Unstyled Content) cần chạy đồng bộ *trước* khi CSS áp dụng, ví dụ set `data-theme` từ `localStorage` ngay đầu `<head>` — tách ra file ngoài sẽ làm mất tác dụng "chạy trước" của nó.

Mọi `<style>`/`<script>` còn lại — dù to hay nhỏ — đều tách ra `css/<ten>.css` / `js/<ten>.js`. Nếu một trang có **nhiều block `<style>`/`<script>` rời rạc** (xen giữa là markup HTML), gộp tất cả nội dung theo đúng thứ tự gốc vào **một** file css và **một** file js — không tạo nhiều file css/js nhỏ lẻ cho cùng một trang. GoldTrack là ví dụ tách khi file đã lớn (2540 dòng → còn ~320 dòng markup); `viet-long-creator` và `viet-long-crypto` là ví dụ tách file cực lớn với nhiều block rời rạc (xem mục 5 bên dưới).

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

**Trang có nhiều block `<style>`/`<script>` rời rạc** (ví dụ `viet-long-crypto`: 2 block style + 2 block script xen giữa hàng nghìn dòng markup) — cắt từng block riêng theo đúng số dòng của nó, rồi `writelines` nối các đoạn theo đúng thứ tự gốc vào cùng một file css/js (nối bằng `+`, có thể thêm `['\n']` giữa các đoạn cho dễ đọc). Đặt `<link>`/`<script src>` tại vị trí của block **đầu tiên**; các block sau chỉ cần **xoá hẳn** (không thay bằng thẻ khác) vì nội dung đã gộp và load một lần ở trên. Việc định nghĩa hàm/biến sớm hơn vị trí gốc của nó không sao — code là khai báo đồng bộ ở top-level, không phụ thuộc thời điểm markup xung quanh render.

**⚠️ Cạm bẫy đã gặp thật khi gộp 2 `<script>` thành 1 file: lỗi TDZ (Temporal Dead Zone) của `let`/`const`.** Nếu script gốc thứ nhất có một lệnh gọi hàm ngay ở top-level (ví dụ `showPage('home');` cuối script #1), và hàm đó đọc một biến `let`/`const` được khai báo ở script gốc thứ hai (ví dụ `let gameState = {}`) qua `typeof gameState !== 'undefined'` — code này **an toàn khi còn là 2 thẻ `<script>` riêng** (script #1 chạy xong trước khi script #2 được parse, nên `gameState` với JS engine lúc đó coi như "chưa từng khai báo", `typeof` trả về `'undefined'` an toàn), nhưng **ném `ReferenceError: Cannot access 'gameState' before initialization` ngay khi gộp thành 1 file** — vì lúc này toàn bộ `let`/`const` trong file được hoist vào Temporal Dead Zone ngay khi script bắt đầu chạy, và `typeof` KHÔNG an toàn với biến đang trong TDZ (chỉ an toàn với biến chưa từng khai báo ở bất kỳ đâu trong scope).

Hậu quả nghiêm trọng hơn triệu chứng ban đầu: lỗi này ném ra ở top-level sẽ **dừng toàn bộ phần code phía sau nó trong cùng file thực thi** — mọi `const`/`let` top-level khác chưa kịp gán giá trị (ví dụ `const ALL=[...]` chứa toàn bộ dữ liệu blog) sẽ mãi mãi ở trạng thái chưa khởi tạo, mọi `document.addEventListener(...)` top-level chưa kịp đăng ký sẽ không bao giờ được gắn — gây ra một chuỗi lỗi tưởng như không liên quan (modal rỗng, nút bấm không phản hồi, số liệu animate kẹt ở 0) mà gốc rễ chỉ là MỘT lệnh gọi hàm quá sớm.

**Cách phát hiện:** không thể thấy bằng đọc code hay `node --check` (cú pháp vẫn hợp lệ) — chỉ lộ ra khi **chạy thật trong trình duyệt** và xem console. Nếu nghi ngờ, so sánh chạy thử bản gốc (nhiều script tag) song song với bản đã gộp.

**Cách sửa:** dời lệnh gọi hàm top-level đó xuống **cuối file**, sau khi mọi `let`/`const` nó phụ thuộc (trực tiếp hoặc gián tiếp qua hàm khác) đã được khai báo và gán giá trị — không sửa hàm, không sửa cách khai báo biến, chỉ đổi vị trí lệnh gọi.

Sau khi tách, kiểm tra **cả ba**, thiếu một là chưa xong:
1. `grep -n "<style\|<script" html/trang.html` → chỉ còn thẻ CDN bên ngoài (nếu có) và `<script src=".../trang.js">`/`<link rel="stylesheet">` mới thêm — không còn `<style>`/`<script>` chứa nội dung thật.
2. `node --check js/trang.js` → xác nhận cú pháp JS hợp lệ trước khi mở trình duyệt.
3. Mở trang thật, xác nhận CSS **có áp dụng** và JS **có chạy** (không chỉ HTTP 200 — file 200 nhưng sai đường dẫn tương đối vẫn 200).
4. Không có request nào ≥400.

## 6. Di chuyển/đổi tên file: danh sách nơi phải cập nhật theo

Đây là chỗ hay sót nhất. Mỗi lần đổi đường dẫn hoặc tên file, rà **đủ các nơi sau**:

- [ ] Thẻ `<link>` / `<script src>` trong HTML (chú ý: đường dẫn tương đối đổi theo số tầng thư mục, ví dụ thêm tầng `html/` thì asset dùng `../css/...` thay vì `css/...`)
- [ ] **Danh sách cache của service worker** (`APP_CODE_PATHS` / `ICON_PATHS` / `DATA_PATHS`) **và bump `CACHE_NAME`** — quên là app hỏng khi offline, hoặc kẹt bản cũ mãi. Bump luôn `?v=` trong `importScripts()` ở vỏ root cho khớp.
- [ ] `navigator.serviceWorker.register(...)` và mọi `fetch(...)` đường dẫn tuyệt đối trong JS
- [ ] Đường dẫn trong script Python (`products/<ten>/py/*.py` ghi vào `data/`)
- [ ] `.github/workflows/*.yml` (đường dẫn `git add` và bất kỳ path nào đọc lại file JSON)
- [ ] `manifest.json` của sản phẩm đó (`start_url`, `icons[].src`)
- [ ] Mọi self-reference URL bên trong chính trang đó (`<link rel="canonical">`, `<meta property="og:url">`, JSON-LD `"url"`, `data:` URI manifest inline) — dễ sót nhất vì trang tự trỏ về chính nó
- [ ] Sơ đồ cấu trúc + bảng Products trong `README.md` (root); nếu đổi tên/di chuyển sản phẩm thì cả `products/<ten>/docs/*.md` của sản phẩm đó
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

## 9. `docs/` riêng của từng sản phẩm — để agent đọc trước khi sửa

Mỗi `products/<ten>/` có `docs/` riêng chứa `.md` mô tả ĐÚNG sản phẩm đó — không phải bản sao README tổng quan, không phải tài liệu kỹ thuật chung. Mục đích: `planner` (và các agent khác) đọc file này TRƯỚC khi khảo sát code, để không phải suy đoán lại từ đầu cấu trúc/cạm bẫy đặc thù của từng sản phẩm mỗi lần.

**Một file `products/<ten>/docs/<ten>.md` nên có:**
- Sản phẩm này làm gì, cho ai dùng (1-2 câu).
- Cấu trúc file thật của sản phẩm (không lặp lại bản đồ chung ở mục 3 — chỉ nêu điểm khác biệt/đặc thù: có tách css/js chưa, có service worker không, có dùng localStorage/Gist/backend giả nào không).
- Cạm bẫy đã biết, đặc thù riêng sản phẩm này (không phải cạm bẫy chung của repo — cái đó đã có trong skill này và `planner.md`).
- Quy trình vận hành nếu có (ví dụ: cách đổi mật khẩu ThubeeFarmery, cách GoldTrack tự cập nhật giá qua GitHub Actions).

**Không viết:** danh sách file (đã có ở mục 3), quy tắc đặt tên chung (đã có ở mục 2), nội dung trùng với `README.md` gốc.

## 10. Quyết định nhanh: file mới nên để đâu, tên gì?

```
File này là gì?
├─ Trang chính của một sản phẩm            → products/<ten-kebab-case>/html/index.html
├─ Trang phụ CỦA một sản phẩm đã có         → products/<ten-cua-san-pham-do>/html/<ten-trang>.html
├─ Nền tảng BẮT BUỘC ở root?              → root, nhưng chỉ giữ phần tối thiểu,
│                                            đẩy logic vào thư mục con của sản phẩm
├─ Style của một trang nhiều file          → products/<ten>/css/<ten>.css
├─ Logic của một trang nhiều file          → products/<ten>/js/<ten>.js (+ .ts cùng chỗ)
├─ Web App Manifest                        → products/<ten>/manifest.json
├─ Ảnh/icon riêng của một sản phẩm          → products/<ten>/img/
├─ Dữ liệu người viết tay                  → products/<ten>/json/
├─ Dữ liệu máy sinh (CI ghi đè)            → products/<ten>/data/
├─ Script chạy trong CI (Python)           → products/<ten>/py/
├─ Tài liệu RIÊNG một sản phẩm             → products/<ten>/docs/
└─ Tài liệu tổng quan toàn repo            → README.md (root)
```
