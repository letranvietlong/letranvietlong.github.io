# 👋 Lê Trần Viết Long — Portfolio & Side Projects

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen?logo=github)](https://letranvietlong.github.io)
[![Last Commit](https://img.shields.io/github/last-commit/letranvietlong/letranvietlong.github.io)](https://github.com/letranvietlong/letranvietlong.github.io/commits/main)
[![Stack](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-orange)](#️-tech-stack)

> Blog & Portfolio cá nhân của **Lê Trần Viết Long** — Software Engineer tại FPT Complex Đà Nẵng. Full-Stack, AI, side projects và một vài mini game cho vui.

🔗 **Live site:** [letranvietlong.github.io](https://letranvietlong.github.io)

---

## 📖 Giới thiệu

Repo này là source code cho trang cá nhân (`index.html`) cùng một loạt **side project độc lập**, gom trong [products/](../products/) — mỗi sản phẩm có folder riêng mang tên kebab-case, kể cả sản phẩm chỉ có một file HTML tự chứa (inline CSS/JS). Sản phẩm quy mô lớn có thêm subfolder theo loại file bên trong (xem [products/worldcup-2026/](../products/worldcup-2026/) làm ví dụ). Không có build step ở bất kỳ đâu, deploy thẳng bằng GitHub Pages. Quy tắc đặt tên/cấu trúc đầy đủ nằm ở skill `project-structure` ([.claude/skills/project-structure/SKILL.md](../.claude/skills/project-structure/SKILL.md)).

## 🧩 Products

| Trang | Mô tả | Link |
|---|---|---|
| **VietLongCrypto** | Theo dõi thị trường tiền điện tử — giá real-time, phân tích xu hướng, biểu đồ market cap. | [viet-long-crypto/html/index.html](../products/viet-long-crypto/html/index.html) |
| **KOL — Vũ Thị Minh Thư** | Profile chuyên nghiệp cho KOL/Influencer, thông tin hợp tác & truyền thông. | [kol-vu-thi-minh-thu/html/index.html](../products/kol-vu-thi-minh-thu/html/index.html) |
| **Thanh Thu Fruit** | Trang giới thiệu cửa hàng hoa quả tươi sạch. | [thanh-thu-fruit/html/index.html](../products/thanh-thu-fruit/html/index.html) |
| **GoldTrack** | Theo dõi giá vàng 9999 và tính lời/lỗ danh mục vàng đã mua. | [gold-track/html/index.html](../products/gold-track/html/index.html) |
| **Thubee Farmery** 🔒 | Dashboard quản lý doanh thu nội bộ cho iPhone — đơn hàng, sản phẩm, khách hàng, người bán hàng. Yêu cầu đăng nhập. | [thubee-farmery/html/index.html](../products/thubee-farmery/html/index.html) |
| **VietLong Creator** | Tạo video âm nhạc chuẩn YouTube/TikTok miễn phí — 60+ template, beat sync, xuất MP4 2K. | [viet-long-creator/html/index.html](../products/viet-long-creator/html/index.html) |
| **VietLongSocial** | Social intelligence — theo dõi số liệu realtime YouTube, TikTok, Instagram. | [viet-long-social/html/index.html](../products/viet-long-social/html/index.html) |
| **GameHub Offline** | 30 mini game chơi không cần internet, tối ưu cho điện thoại. | [mini-game-hub/html/index.html](../products/mini-game-hub/html/index.html) |
| **FIFA World Cup 2026** | Lịch thi đấu 104 trận, tỷ số trực tiếp, bảng xếp hạng, nhánh knockout. | [worldcup-2026/html/index.html](../products/worldcup-2026/html/index.html) |

> Toàn bộ danh sách trên cũng được liệt kê tại tab **Products** của [trang chủ](https://letranvietlong.github.io).

## 🎮 Mini Game Hub (trong trang chủ)

Tab **Games** ngay trên `index.html` có 20 mini game dựng sẵn (Cờ Vua, Cờ Tướng, 2048, Wordle, Ai Là Triệu Phú...) — chơi 1 mình hoặc đấu AI, không cần rời trang.

## ⚙️ Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript** — không framework, không build step.
- Mỗi trang là **một sản phẩm độc lập**, sống trong [products/](../products/) trong folder riêng của nó — sản phẩm nhỏ chỉ có `html/index.html` (style & logic inline), sản phẩm lớn có thêm `css/`, `js/`, `data/`/`json/` tách biệt theo tầng loại file, tên file giữ theo slug kebab-case của sản phẩm, để dễ maintain.
- Deploy bằng **GitHub Pages**, không cần server hay CI/CD.

## 📁 Cấu trúc

```
.
├── index.html              # Trang chủ — Portfolio, Blog, Mini Game Hub, Contact
├── sw-gold-track.js         # Vỏ service worker 1 dòng — BẮT BUỘC ở root (xem ghi chú dưới)
├── CLAUDE.md                # Hướng dẫn cho Claude Code — BẮT BUỘC nằm ở root để được tự động nạp
├── products/                # Mọi trang sản phẩm — xem bảng Products phía trên. Mỗi sản
│   │                        # phẩm có folder riêng, kể cả sản phẩm chỉ 1 file HTML (để
│   │                        # đồng nhất cấu trúc — không có ngoại lệ flat nữa).
│   ├── kol-vu-thi-minh-thu/
│   │   ├── html/index.html
│   │   ├── css/kol-vu-thi-minh-thu.css
│   │   └── js/kol-vu-thi-minh-thu.js
│   ├── mini-game-hub/
│   │   ├── html/index.html
│   │   ├── css/mini-game-hub.css
│   │   └── js/mini-game-hub.js
│   ├── thanh-thu-fruit/
│   │   ├── html/index.html
│   │   ├── css/thanh-thu-fruit.css
│   │   └── js/thanh-thu-fruit.js
│   ├── viet-long-crypto/
│   │   ├── html/index.html
│   │   ├── css/viet-long-crypto.css
│   │   └── js/viet-long-crypto.js
│   ├── viet-long-social/
│   │   ├── html/index.html
│   │   ├── css/viet-long-social.css
│   │   └── js/viet-long-social.js
│   ├── viet-long-creator/          # VietLong Creator — kèm 2 trang pháp lý CỦA sản phẩm này
│   │   ├── html/
│   │   │   ├── index.html
│   │   │   ├── privacy.html      # Chính sách bảo mật (đăng ký với TikTok for Developers)
│   │   │   └── terms.html        # Điều khoản dịch vụ
│   │   ├── css/
│   │   │   ├── viet-long-creator.css
│   │   │   ├── privacy.css
│   │   │   └── terms.css
│   │   └── js/viet-long-creator.js
│   ├── gold-track/           # Theo dõi giá vàng — subfolder theo loại file
│   │   ├── html/index.html
│   │   ├── css/gold-track.css
│   │   ├── js/gold-track.js
│   │   ├── js/sw-core.js     # Logic service worker (nạp qua importScripts từ vỏ ở root)
│   │   ├── py/fetch_gold_price.py    # Lấy giá vàng từ Ngọc Thịnh Jewelry — chạy trong GitHub Actions
│   │   ├── py/fetch_gold_news.py     # Lấy + lọc tin tức từ RSS CafeF/VnExpress — chạy trong GitHub Actions
│   │   ├── img/gold-track-icon.svg    # Favicon SVG
│   │   ├── img/gold-track-icon-*.png  # Favicon PNG (32/180), apple-touch-icon
│   │   ├── manifest.json     # Web App Manifest
│   │   └── data/             # Dữ liệu GoldTrack, cập nhật tự động bởi GitHub Actions
│   │       ├── gold-price.json       # Giá vàng mới nhất
│   │       ├── gold-price-history.json # Lịch sử giá (vẽ biểu đồ xu hướng)
│   │       ├── gold-news.json        # Tin tức đã lọc theo từ khoá liên quan vàng
│   │       └── changelog.json        # Lịch sử cập nhật hiện trong app (nút version ở header)
│   ├── thubee-farmery/       # Đăng nhập nội bộ — subfolder theo loại file
│   │   ├── html/index.html
│   │   ├── css/thubee-farmery.css
│   │   ├── js/thubee-farmery.ts  # Source TypeScript
│   │   ├── js/thubee-farmery.js  # Bản compile từ .ts (file thực sự được load)
│   │   ├── img/thubee-icon.svg       # Favicon SVG (logo mascot)
│   │   ├── img/thubee-icon-*.png     # Favicon PNG (32/180), apple-touch-icon
│   │   ├── manifest.json     # Web App Manifest
│   │   └── json/             # Dữ liệu seed, viết tay
│   │       ├── products.json     # Catalog sản phẩm gốc (seed + nguồn combobox)
│   │       ├── customers.json    # Danh sách khách hàng gốc (seed + nguồn combobox)
│   │       ├── sellers.json      # Danh sách người bán hàng gốc (seed + nguồn combobox)
│   │       └── orders.json       # Đơn hàng gốc (mặc định rỗng — dữ liệu thật tích lũy qua localStorage)
│   └── worldcup-2026/        # Subfolder theo loại file
│       ├── html/index.html
│       ├── css/worldcup-2026.css
│       └── js/worldcup-2026.js
└── docs/
    └── README.md             # Tài liệu này
```

**Không còn `img/` dùng chung ở root.** Icon của mỗi sản phẩm nằm trong `img/` của chính sản phẩm đó — ví dụ `products/gold-track/img/gold-track-icon*`, `products/thubee-farmery/img/thubee-icon*`. Các sản phẩm khác nhúng icon trực tiếp bằng data URI trong HTML nên không cần thư mục `img/` riêng. Chỉ tạo `img/` dùng chung ở root nếu sau này có ảnh thật sự cross-product (hiện chưa có trường hợp này).

> **Vì sao `sw-gold-track.js` và `CLAUDE.md` không nằm trong `products/`?**
> - Service worker chỉ điều khiển được các trang **ngang hàng hoặc nằm dưới thư mục chứa nó**. Đặt trong `products/gold-track/` thì scope co lại thành `/products/gold-track/` — vẫn còn điều khiển được `html/index.html` (nằm trong chính thư mục đó), nhưng mất khả năng mở rộng ra ngoài nếu sau này cần. Giữ vỏ ở root để scope luôn là toàn origin, an toàn cho mọi khả năng mở rộng sau này. Muốn thu hẹp/mở rộng khác đi phải set HTTP header `Service-Worker-Allowed`, mà GitHub Pages không cho tuỳ chỉnh header. Vì vậy root chỉ giữ **vỏ 1 dòng**, còn logic nằm ở `products/gold-track/js/sw-core.js` — đúng nguyên tắc: chỉ những gì nền tảng BẮT BUỘC mới được ở root.
> - `CLAUDE.md` được Claude Code tự động nạp từ **thư mục gốc** của project. Chuyển đi nơi khác thì quy ước commit message và quy ước cập nhật changelog trong đó sẽ không còn hiệu lực.
> - GoldTrack tự fetch dữ liệu của nó (`/products/gold-track/data/*.json`) và tự đăng ký service worker (`/sw-gold-track.js`) bằng **đường dẫn tuyệt đối**, không phải tương đối — với dữ liệu thì chỉ là thói quen tốt (giờ đã cùng thư mục), nhưng với service worker thì bắt buộc thật: vỏ vẫn ở root còn `html/index.html` nằm sâu 3 cấp, một đường dẫn tương đối sẽ resolve theo vị trí trang, không phải theo root.

### 🔐 Thubee Farmery — lưu ý vận hành

`products/thubee-farmery/html/index.html` là dashboard nội bộ **chỉ thiết kế cho iPhone 14 Pro Max** (không hỗ trợ desktop) — bottom tab bar, modal kiểu bottom-sheet, safe-area cho Dynamic Island/home indicator. Có màn hình đăng nhập chặn người ngoài. Vì site không có backend, đây là **client-side password gate** (so khớp SHA-256 hash trong `products/thubee-farmery/js/thubee-farmery.ts`), không phải bảo mật thật — đủ để chặn người xem thông thường, không chống được người cố tình đọc source.

- Đổi mật khẩu: mở Console trên trang, gọi `ThubeeAuth.hashPassword("user_moi", "mat_khau_moi")`, copy hash in ra và thay vào hằng `AUTH_PASSWORD_HASH` + `AUTH_USERNAME` trong `products/thubee-farmery/js/thubee-farmery.ts`, sau đó compile lại ra `.js` cùng thư mục (`tsc products/thubee-farmery/js/thubee-farmery.ts --target ES2017 --lib dom,es2017 --module none --outDir products/thubee-farmery/js`).
- **Dữ liệu**: `json/*.json` (trong `products/thubee-farmery/`) là dữ liệu khởi tạo (seed) + nguồn gợi ý cho combobox (khách hàng/người bán/sản phẩm khi tạo đơn). Mọi thêm/sửa/xoá trên website lưu vào `localStorage` của trình duyệt — không mất khi tải lại trang, nhưng **không đồng bộ giữa nhiều thiết bị** và **không ghi ngược lại file json** (site tĩnh trên GitHub Pages, browser không thể tự viết vào file trên repo). Muốn đồng bộ nhiều máy/nhiều người dùng thật cần thêm backend (Firebase/Supabase...), ngoài phạm vi site tĩnh hiện tại.
- **Add to Home Screen**: dùng tính năng có sẵn của Safari trên iOS (Share → Add to Home Screen) — `apple-touch-icon` + meta `apple-mobile-web-app-*` trong `<head>` đã đủ để hiện đúng icon/tên khi ghim vào màn hình chính; nay đã có thêm `manifest.json` cho các lợi ích cài đặt khác, nhưng lưu ý iOS ghim theo URL cụ thể, không tự đọc lại `start_url` nếu URL trang đổi sau này.
- **Người bán hàng**: tab riêng để quản lý nhân viên bán hàng (tên + SĐT), gắn vào từng đơn hàng, có bảng xếp hạng doanh thu theo người bán.

## 📊 Quy mô file (LOC & dung lượng)

| Sản phẩm (html + css + js) | LOC | Base64 nhúng |
|---|---|---|
| viet-long-creator (html/index.html + css + js) | 510 + 1,628 + 10,012 | 0 |
| viet-long-crypto (html/index.html + css + js) | 2,376 + 2,443 + 6,889 | 2 |
| index.html (chưa tách, trang chủ) | 4,343 | 7 |
| worldcup-2026 (html/index.html + css + js) | 280 + 331 + 1,372 | 3 |
| thanh-thu-fruit (html/index.html + css + js) | 281 + 823 + 60 | 0 |
| viet-long-social (html/index.html + css + js) | 173 + 312 + 662 | 0 |
| kol-vu-thi-minh-thu (html/index.html + css + js) | 572 + 244 + 109 | **39 (11.7 MB)** |
| mini-game-hub (html/index.html + css + js) | 117 + 89 + 463 | 0 |
| viet-long-creator/html/privacy.html + css/privacy.css | 84 + 14 | 0 |
| viet-long-creator/html/terms.html + css/terms.css | 67 + 13 | 0 |

*(Đo bằng `wc -l`, không tính file đã nén/minify. Mọi sản phẩm html-only đã tách css/js nếu có nội dung `<style>`/`<script>` đáng kể — chỉ giữ inline các đoạn nhỏ mang tính bootstrap/metadata: JSON-LD structured data, script chống FOUC cho theme.)*

### Đánh giá tách CSS/JS riêng

Toàn bộ sản phẩm html-only trong repo đã tách css/js (nếu có) — không còn ngoại lệ dựa theo ngưỡng LOC, vì quy tắc hiện tại là tách bất cứ khi nào có `<style>`/`<script>` đáng kể, bất kể kích thước trang lớn hay nhỏ.

- **`viet-long-creator` và `viet-long-crypto`** là 2 file lớn nhất repo (JS gộp lần lượt 10,012 và 6,889 dòng) — đã tách xong, mỗi bên có đúng 1 file `css/` và 1 file `js/` (các block `<style>`/`<script>` rời rạc trong HTML gốc được gộp lại theo đúng thứ tự ban đầu).
- **`index.html`** (4,343 LOC, trang chủ) — chưa tách, ngoài phạm vi yêu cầu lần này (không phải file trong `products/`).
- **`kol-vu-thi-minh-thu`** vẫn nặng do 39 ảnh base64 trực tiếp trong HTML — tách CSS/JS không giải quyết được vấn đề dung lượng này. Muốn cải thiện tốc độ tải cần xuất ảnh base64 ra file `.jpg`/`.png`/`.webp` riêng, là việc khác quy mô lớn hơn.

## 🧑‍💻 Chạy local

Không cần cài đặt gì — mở trực tiếp file `.html` bằng browser, hoặc dùng Live Server cho trải nghiệm gần giống production:

```bash
git clone https://github.com/letranvietlong/letranvietlong.github.io.git
cd letranvietlong.github.io
# mở index.html bằng VS Code + extension "Live Server" (đã cấu hình sẵn trong .vscode/settings.json)
```

## 📄 Pháp lý

- [Chính sách bảo mật](../products/viet-long-creator/html/privacy.html)
- [Điều khoản dịch vụ](../products/viet-long-creator/html/terms.html)

*(Áp dụng cho VietLong Creator — đăng ký với TikTok for Developers. Hai trang này nằm trong folder `viet-long-creator/` vì là trang pháp lý của riêng sản phẩm đó, không phải sản phẩm độc lập.)*

## 📬 Liên hệ

- 📧 Email: [letranvietlong@gmail.com](mailto:letranvietlong@gmail.com)
- 🐙 GitHub: [@letranvietlong](https://github.com/letranvietlong)
- 🌐 Website: [letranvietlong.github.io](https://letranvietlong.github.io)

---

© 2026 Lê Trần Viết Long · Software Engineer @ FPT Complex Đà Nẵng
