// Điểm vào service worker của FuelTrack — CỐ Ý chỉ có 1 dòng thật.
//
// File này chỉ dùng riêng cho FuelTrack nên nằm hẳn trong products/fuel-track/
// — không lồng thêm vào html/, css/, js/ như các file khác. Lý do: scope của
// service worker mặc định là thư mục CHỨA CHÍNH file đăng ký nó (và mọi thứ
// bên dưới). Đặt file này ở products/fuel-track/js/ thì scope co lại thành
// /products/fuel-track/js/, không còn quản được html/, css/, data/, img/ của
// chính FuelTrack — mất offline ngay trên sản phẩm nó phục vụ. Đặt thẳng ở
// products/fuel-track/ (ngang hàng với html/, css/, js/, data/, img/) thì
// scope là /products/fuel-track/ — bao phủ đúng và đủ mọi thứ FuelTrack cần.
// (Ép scope rộng hơn thư mục chứa script ném SecurityError; cách nới duy nhất
// là header HTTP Service-Worker-Allowed, mà GitHub Pages không cho set.)
//
// Toàn bộ logic thật nằm ở products/fuel-track/js/sw-core.js
//
// ?v= phải bump cùng lúc với CACHE_NAME trong core, để script được
// importScripts chắc chắn được tải lại bất kể engine kiểm tra cập nhật ra sao.
importScripts('/products/fuel-track/js/sw-core.js?v=4');
