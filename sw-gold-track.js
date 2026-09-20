// Điểm vào service worker của GoldTrack — CỐ Ý chỉ có 1 dòng thật.
//
// File này bắt buộc nằm ở thư mục gốc: service worker chỉ điều khiển được
// các trang ngang hàng hoặc nằm dưới thư mục chứa nó. Đặt trong
// products/gold-track/js/ thì scope co lại và không còn quản được các trang
// khác trong site nếu GoldTrack lại đổi cấu trúc — mất toàn bộ offline.
// (Đã kiểm chứng: ép scope '/' từ một thư mục con ném SecurityError
// "not under the max scope allowed". Cách nới scope duy nhất là
// HTTP header Service-Worker-Allowed, mà GitHub Pages không cho set.)
//
// Nên root chỉ giữ đúng phần BẮT BUỘC phải ở root — cái vỏ. Toàn bộ logic
// nằm cùng chỗ với mọi file JS khác: products/gold-track/js/sw-core.js
//
// ?v= phải bump cùng lúc với CACHE_NAME trong core. Trình duyệt hiện đại có
// kiểm tra cập nhật cho cả script được importScripts, nhưng hành vi này
// từng khác nhau giữa các engine — query string làm việc cập nhật trở nên
// chắc chắn thay vì phải tin vào engine.
importScripts('/products/gold-track/js/sw-core.js?v=6');
