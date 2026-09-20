# GameHub Offline

30 mini game chơi không cần internet — XP/level, nhiệm vụ (missions), highscore, chế độ tiết kiệm pin, xuất/nhập tiến trình.

## Cấu trúc thật

- Đã tách css/js (1 block style + 1 block script).
- Không có service worker (dù tên là "Offline") — "offline" ở đây nghĩa là game tự chứa (không cần mạng để chơi), không phải PWA cài đặt được kiểu GoldTrack/ThubeeFarmery.
- **State người chơi lưu trong `localStorage`** (key profile: xp, level, số lần chơi, theme, âm thanh, trạng thái tiết kiệm pin, missions, achievements) — mất khi xoá dữ liệu trình duyệt, không đồng bộ thiết bị.
- **Có tích hợp Battery API** (`navigator.getBattery`) để tự động gợi ý/bật chế độ tiết kiệm pin (`body.battery-saver` class tắt bớt hiệu ứng animate/box-shadow).
- Layout có 2 tab chính (`home`/`games`) chuyển bằng `switchTab()` — danh sách game (`.game-card`) nằm trong tab `games`, KHÔNG hiển thị mặc định ở tab `home`. Khi test bằng browser tự động, phải chuyển tab trước khi tìm phần tử game.

## Cạm bẫy đặc thù

- Khi test/tương tác với game: nhớ click tab "Trò chơi" trước — tìm `.game-card` ở tab `home` mặc định sẽ không thấy gì (không phải bug, do đang ở sai tab).
- Đổi cấu trúc `localStorage` profile (thêm/bớt field) cần cân nhắc migrate dữ liệu người chơi cũ, tương tự nguyên tắc `isValidTx` không lọc field lạ ở GoldTrack — đừng phá vỡ profile đã lưu của người chơi hiện tại.
