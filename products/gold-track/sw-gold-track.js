// Điểm vào service worker của GoldTrack — CỐ Ý chỉ có 1 dòng thật.
//
// File này chỉ dùng riêng cho GoldTrack nên nằm hẳn trong products/gold-track/
// — không lồng thêm vào html/, css/, js/ như các file khác. Lý do: scope của
// service worker mặc định là thư mục CHỨA CHÍNH file đăng ký nó (và mọi thứ
// bên dưới). Đặt file này ở products/gold-track/js/ thì scope co lại thành
// /products/gold-track/js/, không còn quản được html/, css/, data/, img/ của
// chính GoldTrack — mất offline ngay trên sản phẩm nó phục vụ. Đặt thẳng ở
// products/gold-track/ (ngang hàng với html/, css/, js/, data/, img/) thì
// scope là /products/gold-track/ — bao phủ đúng và đủ mọi thứ GoldTrack cần,
// không hơn không kém.
// (Đã kiểm chứng: ép scope rộng hơn thư mục chứa script ném SecurityError
// "not under the max scope allowed". Cách nới scope duy nhất là header HTTP
// Service-Worker-Allowed, mà GitHub Pages không cho set — nên KHÔNG thể vừa
// đặt file trong js/ vừa xin scope rộng hơn.)
//
// Trước đây file này từng đặt ở root với lý do "phòng hờ tương lai" — nhưng
// service worker này chưa bao giờ cần điều khiển gì ngoài GoldTrack (đã tự
// giới hạn qua GOLDTRACK_PATHS), nên giữ ở root là scope rộng hơn mức cần
// thiết một cách không cần thiết. Đưa hẳn vào trong products/gold-track/ để
// đúng nguyên tắc "mọi thứ của một sản phẩm nằm trong folder của sản phẩm đó".
//
// Toàn bộ logic thật nằm cùng chỗ với mọi file JS khác: products/gold-track/js/sw-core.js
//
// ?v= phải bump cùng lúc với CACHE_NAME trong core. Trình duyệt hiện đại có
// kiểm tra cập nhật cho cả script được importScripts, nhưng hành vi này
// từng khác nhau giữa các engine — query string làm việc cập nhật trở nên
// chắc chắn thay vì phải tin vào engine.
importScripts('/products/gold-track/js/sw-core.js?v=7');
