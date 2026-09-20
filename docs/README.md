# 👋 Lê Trần Viết Long — Portfolio & Side Projects

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen?logo=github)](https://letranvietlong.github.io)
[![Last Commit](https://img.shields.io/github/last-commit/letranvietlong/letranvietlong.github.io)](https://github.com/letranvietlong/letranvietlong.github.io/commits/main)
[![Stack](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-orange)](#️-tech-stack)

> Blog & Portfolio cá nhân của **Lê Trần Viết Long** — Software Engineer tại FPT Complex Đà Nẵng. Full-Stack, AI, side projects và một vài mini game cho vui.

🔗 **Live site:** [letranvietlong.github.io](https://letranvietlong.github.io)

---

## 📖 Giới thiệu

Repo này là source code cho trang cá nhân (`index.html`) cùng một loạt **side project độc lập**, gom trong [products/](../products/) — phần lớn là một file HTML tự chứa (inline CSS/JS), không cần build step, deploy thẳng bằng GitHub Pages. Sản phẩm quy mô lớn có thư mục riêng chứa CSS/JS tách biệt, thêm một tầng subfolder theo loại file (xem [products/worldcup-2026/](../products/worldcup-2026/) làm ví dụ), vẫn không cần build step. Quy tắc đặt tên/cấu trúc đầy đủ nằm ở skill `project-structure` ([.claude/skills/project-structure/SKILL.md](../.claude/skills/project-structure/SKILL.md)).

## 🧩 Products

| Trang | Mô tả | Link |
|---|---|---|
| **VietLongCrypto** | Theo dõi thị trường tiền điện tử — giá real-time, phân tích xu hướng, biểu đồ market cap. | [viet-long-crypto.html](../products/viet-long-crypto.html) |
| **MeetingTranslator** | Công cụ AI dịch thuật real-time cho cuộc họp đa ngôn ngữ. | [meeting-translator.html](../products/meeting-translator.html) |
| **KOL — Vũ Thị Minh Thư** | Profile chuyên nghiệp cho KOL/Influencer, thông tin hợp tác & truyền thông. | [kol-vu-thi-minh-thu.html](../products/kol-vu-thi-minh-thu.html) |
| **MarkdownPro** | Trình soạn thảo Markdown online — preview real-time, export PDF/HTML. | [markdown-pro.html](../products/markdown-pro.html) |
| **Crypto AI Market Pro** | Phân tích kỹ thuật & tín hiệu giao dịch crypto bằng AI. | [crypto-ai.html](../products/crypto-ai.html) |
| **Thanh Thu Fruit** | Trang giới thiệu cửa hàng hoa quả tươi sạch. | [thanh-thu-fruit.html](../products/thanh-thu-fruit.html) |
| **GoldTrack** | Theo dõi giá vàng 9999 và tính lời/lỗ danh mục vàng đã mua. | [gold-track/html/index.html](../products/gold-track/html/index.html) |
| **Thubee Farmery** 🔒 | Dashboard quản lý doanh thu nội bộ cho iPhone — đơn hàng, sản phẩm, khách hàng, người bán hàng. Yêu cầu đăng nhập. | [thubee-farmery/html/index.html](../products/thubee-farmery/html/index.html) |
| **VietLong Creator** | Tạo video âm nhạc chuẩn YouTube/TikTok miễn phí — 60+ template, beat sync, xuất MP4 2K. | [viet-long-creator.html](../products/viet-long-creator.html) |
| **VietLongSocial** | Social intelligence — theo dõi số liệu realtime YouTube, TikTok, Instagram. | [viet-long-social.html](../products/viet-long-social.html) |
| **Bingo by LongLTV** | Quay số Bingo 1–75 trực tuyến, có chế độ tự động cho sự kiện. | [bingo.html](../products/bingo.html) |
| **GameHub Offline** | 30 mini game chơi không cần internet, tối ưu cho điện thoại. | [mini-game-hub.html](../products/mini-game-hub.html) |
| **FIFA World Cup 2026** | Lịch thi đấu 104 trận, tỷ số trực tiếp, bảng xếp hạng, nhánh knockout. | [worldcup-2026/html/index.html](../products/worldcup-2026/html/index.html) |

> Toàn bộ danh sách trên cũng được liệt kê tại tab **Products** của [trang chủ](https://letranvietlong.github.io).

## 🎮 Mini Game Hub (trong trang chủ)

Tab **Games** ngay trên `index.html` có 20 mini game dựng sẵn (Cờ Vua, Cờ Tướng, 2048, Wordle, Ai Là Triệu Phú...) — chơi 1 mình hoặc đấu AI, không cần rời trang.

## ⚙️ Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript** — không framework, không build step.
- Mỗi trang là **một sản phẩm độc lập**, sống trong [products/](../products/) — phần lớn tự chứa style & logic inline; sản phẩm quy mô lớn có thư mục riêng chứa CSS/JS tách biệt theo tầng loại file (`html/`, `css/`, `js/`, `data/`/`json/`), tên file giữ theo slug kebab-case của sản phẩm, để dễ maintain.
- Deploy bằng **GitHub Pages**, không cần server hay CI/CD.

## 📁 Cấu trúc

```
.
├── index.html              # Trang chủ — Portfolio, Blog, Mini Game Hub, Contact
├── sw-gold-track.js         # Vỏ service worker 1 dòng — BẮT BUỘC ở root (xem ghi chú dưới)
├── CLAUDE.md                # Hướng dẫn cho Claude Code — BẮT BUỘC nằm ở root để được tự động nạp
├── products/                # Mọi trang sản phẩm — xem bảng Products phía trên
│   ├── crypto-ai.html
│   ├── kol-vu-thi-minh-thu.html
│   ├── meeting-translator.html
│   ├── mini-game-hub.html
│   ├── thanh-thu-fruit.html
│   ├── viet-long-creator.html
│   ├── viet-long-crypto.html
│   ├── viet-long-social.html
│   ├── bingo.html
│   ├── markdown-pro.html
│   ├── privacy.html          # Chính sách bảo mật (VietLong Creator)
│   ├── terms.html            # Điều khoản dịch vụ (VietLong Creator)
│   ├── gold-track/           # Theo dõi giá vàng — subfolder theo loại file
│   │   ├── html/index.html
│   │   ├── css/gold-track.css
│   │   ├── js/gold-track.js
│   │   ├── js/sw-core.js     # Logic service worker (nạp qua importScripts từ vỏ ở root)
│   │   ├── py/fetch_gold_price.py    # Lấy giá vàng từ Ngọc Thịnh Jewelry — chạy trong GitHub Actions
│   │   ├── py/fetch_gold_news.py     # Lấy + lọc tin tức từ RSS CafeF/VnExpress — chạy trong GitHub Actions
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
├── img/                      # Icon dùng chung, đặt tên theo tiền tố sản phẩm
│   ├── thubee-icon.svg       # Logo mascot (favicon SVG)
│   ├── thubee-icon-*.png     # Icon PNG (32/180) cho favicon, apple-touch-icon
│   ├── gold-track-icon.svg   # Logo GoldTrack (favicon SVG)
│   └── gold-track-icon-*.png # Icon PNG (32/180) cho favicon, apple-touch-icon
└── docs/
    └── README.md             # Tài liệu này
```

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

| File | LOC | Dung lượng | Base64 nhúng |
|---|---|---|---|
| viet-long-creator.html | 12,155 | 561 KB | 0 |
| viet-long-crypto.html | 11,712 | 1.09 MB | 2 |
| index.html | 4,343 | 374 KB | 7 |
| bingo.html | 2,083 | 59 KB | 0 |
| markdown-pro.html | 1,276 | 54 KB | 0 |
| thanh-thu-fruit.html | 1,166 | 42 KB | 0 |
| viet-long-social.html | 1,149 | 68 KB | 0 |
| crypto-ai.html | 1,025 | 86 KB | 0 |
| kol-vu-thi-minh-thu.html | 927 | **11.7 MB** | **39** |
| meeting-translator.html | 684 | 34 KB | 0 |
| mini-game-hub.html | 671 | 72 KB | 0 |
| worldcup-2026/html/index.html (+ css/js) | 280 + 331 + 1,372 | 42 + 33 + 84 KB | 3 |
| privacy.html | 99 | 5 KB | 0 |
| terms.html | 81 | 4 KB | 0 |

*(Đo bằng `wc -l` + dung lượng file thật trên đĩa, không tính file đã nén/minify.)*

### Đánh giá tách CSS/JS riêng

Ngưỡng tham chiếu: `worldcup-2026` được tách khi đạt ~1,987 LOC.

- **Nên tách ngay**: `viet-long-creator.html` (12,155 LOC) và `viet-long-crypto.html` (11,712 LOC) — gấp ~6 lần ngưỡng, lớn nhất trong repo, tách sẽ giúp maintain dễ hơn rõ rệt.
- **Nên tách**: `index.html` (4,343 LOC) — hơn gấp đôi ngưỡng, là trang chủ nên ưu tiên dễ đọc/sửa.
- **Có thể tách, không gấp**: `bingo.html` (2,083 LOC) — xấp xỉ ngưỡng cũ.
- **Chưa cần tách**: `markdown-pro.html`, `thanh-thu-fruit.html`, `viet-long-social.html`, `crypto-ai.html` (1,000–1,300 LOC) — dưới ngưỡng, dung lượng nhỏ. `meeting-translator.html`, `mini-game-hub.html`, `privacy.html`, `terms.html` càng nhỏ hơn, không cần động tới.
- **Vấn đề khác, không phải do CSS/JS**: `kol-vu-thi-minh-thu.html` chỉ 927 LOC nhưng nặng **11.7 MB** do nhúng 39 ảnh base64 trực tiếp trong HTML — tách CSS/JS không giải quyết được vấn đề này. Nếu muốn cải thiện tốc độ tải, cần xuất ảnh base64 ra file `.jpg`/`.png`/`.webp` riêng và load qua `<img src>` — đây là việc khác, quy mô lớn hơn, nên xử lý riêng nếu cần.

## 🧑‍💻 Chạy local

Không cần cài đặt gì — mở trực tiếp file `.html` bằng browser, hoặc dùng Live Server cho trải nghiệm gần giống production:

```bash
git clone https://github.com/letranvietlong/letranvietlong.github.io.git
cd letranvietlong.github.io
# mở index.html bằng VS Code + extension "Live Server" (đã cấu hình sẵn trong .vscode/settings.json)
```

## 📄 Pháp lý

- [Chính sách bảo mật](../products/privacy.html)
- [Điều khoản dịch vụ](../products/terms.html)

*(Áp dụng cho VietLong Creator — đăng ký với TikTok for Developers.)*

## 📬 Liên hệ

- 📧 Email: [letranvietlong@gmail.com](mailto:letranvietlong@gmail.com)
- 🐙 GitHub: [@letranvietlong](https://github.com/letranvietlong)
- 🌐 Website: [letranvietlong.github.io](https://letranvietlong.github.io)

---

© 2026 Lê Trần Viết Long · Software Engineer @ FPT Complex Đà Nẵng
