// Điểm vào service worker của GoldTrack — CỐ Ý chỉ có 1 dòng thật.
//
// File này bắt buộc nằm ở thư mục gốc: service worker chỉ điều khiển được
// các trang ngang hàng hoặc nằm dưới thư mục chứa nó. Đặt trong js/ thì
// scope co lại thành /js/ và không còn quản được /GoldTrack.html — mất
// toàn bộ offline. (Đã kiểm chứng: ép scope '/' từ /js/ ném SecurityError
// "not under the max scope allowed ('/js/')". Cách nới scope duy nhất là
// HTTP header Service-Worker-Allowed, mà GitHub Pages không cho set.)
//
// Nên root chỉ giữ đúng phần BẮT BUỘC phải ở root — cái vỏ. Toàn bộ logic
// nằm cùng chỗ với mọi file JS khác: js/sw-goldtrack-core.js
//
// ?v= phải bump cùng lúc với CACHE_NAME trong core. Trình duyệt hiện đại có
// kiểm tra cập nhật cho cả script được importScripts, nhưng hành vi này
// từng khác nhau giữa các engine — query string làm việc cập nhật trở nên
// chắc chắn thay vì phải tin vào engine.
importScripts('/products/goldtrack/sw-goldtrack-core.js?v=5');
