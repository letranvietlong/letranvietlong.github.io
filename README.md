# 👋 Lê Trần Viết Long — Portfolio & Side Projects

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen?logo=github)](https://letranvietlong.github.io)
[![Last Commit](https://img.shields.io/github/last-commit/letranvietlong/letranvietlong.github.io)](https://github.com/letranvietlong/letranvietlong.github.io/commits/main)
[![Stack](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-orange)](#️-tech-stack)

> Blog & Portfolio cá nhân của **Lê Trần Viết Long** — Software Engineer tại FPT Complex Đà Nẵng. Full-Stack, AI, side projects và một vài mini game cho vui.

🔗 **Live site:** [letranvietlong.github.io](https://letranvietlong.github.io)

---

## 📖 Giới thiệu

Repo này là source code cho trang cá nhân (`index.html`) cùng một loạt **side project độc lập** — phần lớn là một file HTML tự chứa (inline CSS/JS), không cần build step, deploy thẳng bằng GitHub Pages. Các trang quy mô lớn được tách CSS/JS riêng vào `css/`/`js/` (xem [worldcup2026.html](worldcup2026.html) làm ví dụ), vẫn không cần build step.

## 🧩 Products

| Trang | Mô tả | Link |
|---|---|---|
| **VietLongCrypto** | Theo dõi thị trường tiền điện tử — giá real-time, phân tích xu hướng, biểu đồ market cap. | [VietLongCrypto.html](VietLongCrypto.html) |
| **MeetingTranslator** | Công cụ AI dịch thuật real-time cho cuộc họp đa ngôn ngữ. | [MeetingTranslator.html](MeetingTranslator.html) |
| **KOL — Vũ Thị Minh Thư** | Profile chuyên nghiệp cho KOL/Influencer, thông tin hợp tác & truyền thông. | [KOL-VuThiMinhThu.html](KOL-VuThiMinhThu.html) |
| **MarkdownPro** | Trình soạn thảo Markdown online — preview real-time, export PDF/HTML. | [markdownpro.html](markdownpro.html) |
| **Crypto AI Market Pro** | Phân tích kỹ thuật & tín hiệu giao dịch crypto bằng AI. | [CryptoAI.html](CryptoAI.html) |
| **Thanh Thu Fruit** | Trang giới thiệu cửa hàng hoa quả tươi sạch. | [ThanhThuFruit.html](ThanhThuFruit.html) |
| **VietLong Creator** | Tạo video âm nhạc chuẩn YouTube/TikTok miễn phí — 60+ template, beat sync, xuất MP4 2K. | [VietLongCreator.html](VietLongCreator.html) |
| **VietLongSocial** | Social intelligence — theo dõi số liệu realtime YouTube, TikTok, Instagram. | [VietLongSocial.html](VietLongSocial.html) |
| **Bingo by LongLTV** | Quay số Bingo 1–75 trực tuyến, có chế độ tự động cho sự kiện. | [bingo.html](bingo.html) |
| **GameHub Offline** | 30 mini game chơi không cần internet, tối ưu cho điện thoại. | [MiniGameHub.html](MiniGameHub.html) |
| **FIFA World Cup 2026** | Lịch thi đấu 104 trận, tỷ số trực tiếp, bảng xếp hạng, nhánh knockout. | [worldcup2026.html](worldcup2026.html) |

> Toàn bộ danh sách trên cũng được liệt kê tại tab **Products** của [trang chủ](https://letranvietlong.github.io).

## 🎮 Mini Game Hub (trong trang chủ)

Tab **Games** ngay trên `index.html` có 20 mini game dựng sẵn (Cờ Vua, Cờ Tướng, 2048, Wordle, Ai Là Triệu Phú...) — chơi 1 mình hoặc đấu AI, không cần rời trang.

## ⚙️ Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript** — không framework, không build step.
- Mỗi trang là **một sản phẩm độc lập** — phần lớn tự chứa style & logic inline; trang quy mô lớn tách CSS/JS riêng vào `css/`/`js/` (tên file giữ nguyên theo tên trang) để dễ maintain.
- Deploy bằng **GitHub Pages**, không cần server hay CI/CD.

## 📁 Cấu trúc

```
.
├── index.html              # Trang chủ — Portfolio, Blog, Mini Game Hub, Contact
├── CryptoAI.html            # Product
├── KOL-VuThiMinhThu.html    # Product
├── MeetingTranslator.html   # Product
├── MiniGameHub.html         # Product
├── ThanhThuFruit.html       # Product
├── VietLongCreator.html     # Product
├── VietLongCrypto.html      # Product
├── VietLongSocial.html      # Product
├── bingo.html                # Product
├── markdownpro.html          # Product
├── worldcup2026.html         # Product (HTML — CSS/JS tách riêng, xem css/ và js/ dưới)
├── privacy.html              # Chính sách bảo mật (VietLong Creator)
├── terms.html                 # Điều khoản dịch vụ (VietLong Creator)
├── css/
│   └── worldcup2026.css      # Style cho worldcup2026.html
├── js/
│   └── worldcup2026.js       # Logic cho worldcup2026.html
└── README.md
```

## 🧑‍💻 Chạy local

Không cần cài đặt gì — mở trực tiếp file `.html` bằng browser, hoặc dùng Live Server cho trải nghiệm gần giống production:

```bash
git clone https://github.com/letranvietlong/letranvietlong.github.io.git
cd letranvietlong.github.io
# mở index.html bằng VS Code + extension "Live Server" (đã cấu hình sẵn trong .vscode/settings.json)
```

## 📄 Pháp lý

- [Chính sách bảo mật](privacy.html)
- [Điều khoản dịch vụ](terms.html)

*(Áp dụng cho VietLong Creator — đăng ký với TikTok for Developers.)*

## 📬 Liên hệ

- 📧 Email: [letranvietlong@gmail.com](mailto:letranvietlong@gmail.com)
- 🐙 GitHub: [@letranvietlong](https://github.com/letranvietlong)
- 🌐 Website: [letranvietlong.github.io](https://letranvietlong.github.io)

---

© 2026 Lê Trần Viết Long · Software Engineer @ FPT Complex Đà Nẵng
