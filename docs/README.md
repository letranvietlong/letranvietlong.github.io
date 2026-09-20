# 👋 Lê Trần Viết Long — Portfolio & Side Projects

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen?logo=github)](https://letranvietlong.github.io)
[![Last Commit](https://img.shields.io/github/last-commit/letranvietlong/letranvietlong.github.io)](https://github.com/letranvietlong/letranvietlong.github.io/commits/main)
[![Stack](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-orange)](#️-tech-stack)

> Blog & Portfolio cá nhân của **Lê Trần Viết Long** — Software Engineer tại FPT Complex Đà Nẵng. Full-Stack, AI, side projects và một vài mini game cho vui.

🔗 **Live site:** [letranvietlong.github.io](https://letranvietlong.github.io)

---

## 📖 Giới thiệu

Repo này là source code cho trang cá nhân (`index.html`) cùng một loạt **side project độc lập**, gom trong [products/](../products/) — phần lớn là một file HTML tự chứa (inline CSS/JS), không cần build step, deploy thẳng bằng GitHub Pages. Sản phẩm quy mô lớn có thư mục riêng chứa CSS/JS tách biệt (xem [products/worldcup2026/](../products/worldcup2026/) làm ví dụ), vẫn không cần build step.

## 🧩 Products

| Trang | Mô tả | Link |
|---|---|---|
| **VietLongCrypto** | Theo dõi thị trường tiền điện tử — giá real-time, phân tích xu hướng, biểu đồ market cap. | [VietLongCrypto.html](../products/VietLongCrypto.html) |
| **MeetingTranslator** | Công cụ AI dịch thuật real-time cho cuộc họp đa ngôn ngữ. | [MeetingTranslator.html](../products/MeetingTranslator.html) |
| **KOL — Vũ Thị Minh Thư** | Profile chuyên nghiệp cho KOL/Influencer, thông tin hợp tác & truyền thông. | [KOL-VuThiMinhThu.html](../products/KOL-VuThiMinhThu.html) |
| **MarkdownPro** | Trình soạn thảo Markdown online — preview real-time, export PDF/HTML. | [markdownpro.html](../products/markdownpro.html) |
| **Crypto AI Market Pro** | Phân tích kỹ thuật & tín hiệu giao dịch crypto bằng AI. | [CryptoAI.html](../products/CryptoAI.html) |
| **Thanh Thu Fruit** | Trang giới thiệu cửa hàng hoa quả tươi sạch. | [ThanhThuFruit.html](../products/ThanhThuFruit.html) |
| **Thubee Farmery** 🔒 | Dashboard quản lý doanh thu nội bộ cho iPhone — đơn hàng, sản phẩm, khách hàng, người bán hàng. Yêu cầu đăng nhập. | [ThubeeFarmery.html](../products/thubee-farmery/ThubeeFarmery.html) |
| **VietLong Creator** | Tạo video âm nhạc chuẩn YouTube/TikTok miễn phí — 60+ template, beat sync, xuất MP4 2K. | [VietLongCreator.html](../products/VietLongCreator.html) |
| **VietLongSocial** | Social intelligence — theo dõi số liệu realtime YouTube, TikTok, Instagram. | [VietLongSocial.html](../products/VietLongSocial.html) |
| **Bingo by LongLTV** | Quay số Bingo 1–75 trực tuyến, có chế độ tự động cho sự kiện. | [bingo.html](../products/bingo.html) |
| **GameHub Offline** | 30 mini game chơi không cần internet, tối ưu cho điện thoại. | [MiniGameHub.html](../products/MiniGameHub.html) |
| **FIFA World Cup 2026** | Lịch thi đấu 104 trận, tỷ số trực tiếp, bảng xếp hạng, nhánh knockout. | [worldcup2026.html](../products/worldcup2026/worldcup2026.html) |

> Toàn bộ danh sách trên cũng được liệt kê tại tab **Products** của [trang chủ](https://letranvietlong.github.io).

## 🎮 Mini Game Hub (trong trang chủ)

Tab **Games** ngay trên `index.html` có 20 mini game dựng sẵn (Cờ Vua, Cờ Tướng, 2048, Wordle, Ai Là Triệu Phú...) — chơi 1 mình hoặc đấu AI, không cần rời trang.

## ⚙️ Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript** — không framework, không build step.
- Mỗi trang là **một sản phẩm độc lập**, sống trong [products/](../products/) — phần lớn tự chứa style & logic inline; sản phẩm quy mô lớn có thư mục riêng chứa CSS/JS tách biệt (tên file giữ nguyên theo tên trang) để dễ maintain.
- Deploy bằng **GitHub Pages**, không cần server hay CI/CD.

## 📁 Cấu trúc

```
.
├── index.html              # Trang chủ — Portfolio, Blog, Mini Game Hub, Contact
├── sw-goldtrack.js          # Vỏ service worker 1 dòng — BẮT BUỘC ở root (xem ghi chú dưới)
├── CLAUDE.md                # Hướng dẫn cho Claude Code — BẮT BUỘC nằm ở root để được tự động nạp
├── products/                # Mọi trang sản phẩm — xem bảng Products phía trên
│   ├── CryptoAI.html
│   ├── KOL-VuThiMinhThu.html
│   ├── MeetingTranslator.html
│   ├── MiniGameHub.html
│   ├── ThanhThuFruit.html
│   ├── VietLongCreator.html
│   ├── VietLongCrypto.html
│   ├── VietLongSocial.html
│   ├── bingo.html
│   ├── markdownpro.html
│   ├── privacy.html          # Chính sách bảo mật (VietLong Creator)
│   ├── terms.html            # Điều khoản dịch vụ (VietLong Creator)
│   ├── goldtrack/            # Theo dõi giá vàng — CSS/JS/service-worker-logic riêng
│   │   ├── GoldTrack.html
│   │   ├── goldtrack.css
│   │   ├── goldtrack.js
│   │   └── sw-goldtrack-core.js  # Logic service worker (nạp qua importScripts từ vỏ ở root)
│   ├── thubee-farmery/       # Đăng nhập nội bộ — HTML/CSS/JS/TS riêng
│   │   ├── ThubeeFarmery.html
│   │   ├── ThubeeFarmery.css
│   │   ├── ThubeeFarmery.ts  # Source TypeScript
│   │   └── ThubeeFarmery.js  # Bản compile từ .ts (file thực sự được load)
│   └── worldcup2026/         # CSS/JS riêng
│       ├── worldcup2026.html
│       ├── worldcup2026.css
│       └── worldcup2026.js
├── img/                      # Icon dùng chung, đặt tên theo tiền tố sản phẩm
│   ├── thubee-icon.svg       # Logo mascot (favicon SVG)
│   ├── thubee-icon-*.png     # Icon PNG (32/180) cho favicon, apple-touch-icon
│   ├── goldtrack-icon.svg    # Logo GoldTrack (favicon SVG)
│   └── goldtrack-icon-*.png  # Icon PNG (32/180) cho favicon, apple-touch-icon
├── json/
│   ├── products.json         # Catalog sản phẩm gốc (seed + nguồn combobox)
│   ├── customers.json        # Danh sách khách hàng gốc (seed + nguồn combobox)
│   ├── sellers.json          # Danh sách người bán hàng gốc (seed + nguồn combobox)
│   └── orders.json           # Đơn hàng gốc (mặc định rỗng — dữ liệu thật tích lũy qua localStorage)
├── data/                     # Dữ liệu GoldTrack, cập nhật tự động bởi GitHub Actions
│   ├── gold-price.json       # Giá vàng mới nhất
│   ├── gold-price-history.json # Lịch sử giá (vẽ biểu đồ xu hướng)
│   ├── gold-news.json        # Tin tức đã lọc theo từ khoá liên quan vàng
│   └── changelog.json        # Lịch sử cập nhật hiện trong app (nút version ở header)
├── scripts/                  # Script Python chạy trong GitHub Actions
│   ├── fetch_gold_price.py   # Lấy giá vàng từ Ngọc Thịnh Jewelry
│   └── fetch_gold_news.py    # Lấy + lọc tin tức từ RSS CafeF/VnExpress
└── docs/
    └── README.md             # Tài liệu này
```

> **Vì sao `sw-goldtrack.js` và `CLAUDE.md` không nằm trong `products/`?**
> - Service worker chỉ điều khiển được các trang **ngang hàng hoặc nằm dưới thư mục chứa nó**. Đặt trong `products/goldtrack/` thì scope co lại thành `/products/goldtrack/` — vẫn còn điều khiển được `GoldTrack.html` (nằm trong chính thư mục đó), nhưng mất khả năng mở rộng ra ngoài nếu sau này cần. Giữ vỏ ở root để scope luôn là toàn origin, an toàn cho mọi khả năng mở rộng sau này. Muốn thu hẹp/mở rộng khác đi phải set HTTP header `Service-Worker-Allowed`, mà GitHub Pages không cho tuỳ chỉnh header. Vì vậy root chỉ giữ **vỏ 1 dòng**, còn logic nằm ở `products/goldtrack/sw-goldtrack-core.js` — đúng nguyên tắc: chỉ những gì nền tảng BẮT BUỘC mới được ở root.
> - `CLAUDE.md` được Claude Code tự động nạp từ **thư mục gốc** của project. Chuyển đi nơi khác thì quy ước commit message và quy ước cập nhật changelog trong đó sẽ không còn hiệu lực.
> - GoldTrack tự fetch dữ liệu của nó (`/data/*.json`) và tự đăng ký service worker (`/sw-goldtrack.js`) bằng **đường dẫn tuyệt đối**, không phải tương đối — bắt buộc vì `GoldTrack.html` giờ nằm sâu 2 cấp trong `products/goldtrack/`, trong khi `data/` và vỏ service worker vẫn ở root.

### 🔐 Thubee Farmery — lưu ý vận hành

`ThubeeFarmery.html` là dashboard nội bộ **chỉ thiết kế cho iPhone 14 Pro Max** (không hỗ trợ desktop) — bottom tab bar, modal kiểu bottom-sheet, safe-area cho Dynamic Island/home indicator. Có màn hình đăng nhập chặn người ngoài. Vì site không có backend, đây là **client-side password gate** (so khớp SHA-256 hash trong `products/thubee-farmery/ThubeeFarmery.ts`), không phải bảo mật thật — đủ để chặn người xem thông thường, không chống được người cố tình đọc source.

- Đổi mật khẩu: mở Console trên `ThubeeFarmery.html`, gọi `ThubeeAuth.hashPassword("user_moi", "mat_khau_moi")`, copy hash in ra và thay vào hằng `AUTH_PASSWORD_HASH` + `AUTH_USERNAME` trong `products/thubee-farmery/ThubeeFarmery.ts`, sau đó compile lại ra `.js` cùng thư mục (`tsc products/thubee-farmery/ThubeeFarmery.ts --target ES2017 --lib dom,es2017 --module none --outDir products/thubee-farmery`).
- **Dữ liệu**: `json/*.json` là dữ liệu khởi tạo (seed) + nguồn gợi ý cho combobox (khách hàng/người bán/sản phẩm khi tạo đơn). Mọi thêm/sửa/xoá trên website lưu vào `localStorage` của trình duyệt — không mất khi tải lại trang, nhưng **không đồng bộ giữa nhiều thiết bị** và **không ghi ngược lại file json** (site tĩnh trên GitHub Pages, browser không thể tự viết vào file trên repo). Muốn đồng bộ nhiều máy/nhiều người dùng thật cần thêm backend (Firebase/Supabase...), ngoài phạm vi site tĩnh hiện tại.
- **Add to Home Screen**: dùng tính năng có sẵn của Safari trên iOS (Share → Add to Home Screen) — `apple-touch-icon` + meta `apple-mobile-web-app-*` trong `<head>` đã đủ để hiện đúng icon/tên khi ghim vào màn hình chính, không cần web app manifest.
- **Người bán hàng**: tab riêng để quản lý nhân viên bán hàng (tên + SĐT), gắn vào từng đơn hàng, có bảng xếp hạng doanh thu theo người bán.

## 📊 Quy mô file (LOC & dung lượng)

| File | LOC | Dung lượng | Base64 nhúng |
|---|---|---|---|
| VietLongCreator.html | 12,155 | 561 KB | 0 |
| VietLongCrypto.html | 11,712 | 1.09 MB | 2 |
| index.html | 4,343 | 374 KB | 7 |
| bingo.html | 2,083 | 59 KB | 0 |
| markdownpro.html | 1,276 | 54 KB | 0 |
| ThanhThuFruit.html | 1,166 | 42 KB | 0 |
| VietLongSocial.html | 1,149 | 68 KB | 0 |
| CryptoAI.html | 1,025 | 86 KB | 0 |
| KOL-VuThiMinhThu.html | 927 | **11.7 MB** | **39** |
| MeetingTranslator.html | 684 | 34 KB | 0 |
| MiniGameHub.html | 671 | 72 KB | 0 |
| worldcup2026.html (+ css/js) | 280 + 331 + 1,372 | 42 + 33 + 84 KB | 3 |
| privacy.html | 99 | 5 KB | 0 |
| terms.html | 81 | 4 KB | 0 |

*(Đo bằng `wc -l` + dung lượng file thật trên đĩa, không tính file đã nén/minify.)*

### Đánh giá tách CSS/JS riêng

Ngưỡng tham chiếu: `worldcup2026.html` được tách khi đạt ~1,987 LOC.

- **Nên tách ngay**: `VietLongCreator.html` (12,155 LOC) và `VietLongCrypto.html` (11,712 LOC) — gấp ~6 lần ngưỡng, lớn nhất trong repo, tách sẽ giúp maintain dễ hơn rõ rệt.
- **Nên tách**: `index.html` (4,343 LOC) — hơn gấp đôi ngưỡng, là trang chủ nên ưu tiên dễ đọc/sửa.
- **Có thể tách, không gấp**: `bingo.html` (2,083 LOC) — xấp xỉ ngưỡng cũ.
- **Chưa cần tách**: `markdownpro.html`, `ThanhThuFruit.html`, `VietLongSocial.html`, `CryptoAI.html` (1,000–1,300 LOC) — dưới ngưỡng, dung lượng nhỏ. `MeetingTranslator.html`, `MiniGameHub.html`, `privacy.html`, `terms.html` càng nhỏ hơn, không cần động tới.
- **Vấn đề khác, không phải do CSS/JS**: `KOL-VuThiMinhThu.html` chỉ 927 LOC nhưng nặng **11.7 MB** do nhúng 39 ảnh base64 trực tiếp trong HTML — tách CSS/JS không giải quyết được vấn đề này. Nếu muốn cải thiện tốc độ tải, cần xuất ảnh base64 ra file `.jpg`/`.png`/`.webp` riêng và load qua `<img src>` — đây là việc khác, quy mô lớn hơn, nên xử lý riêng nếu cần.

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
