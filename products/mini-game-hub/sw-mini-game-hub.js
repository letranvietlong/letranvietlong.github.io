// Điểm vào service worker của GameHub — CỐ Ý chỉ có 1 dòng thật.
//
// Vỏ nằm ngay trong products/mini-game-hub/ (ngang hàng html/, css/, js/,
// data/, img/), không lồng vào js/: scope mặc định của service worker là thư
// mục CHỨA file đăng ký nó. Đặt trong js/ thì scope co lại còn
// /products/mini-game-hub/js/ và app mất offline. (Nới scope cần header
// Service-Worker-Allowed, GitHub Pages không đặt được.)
//
// Logic thật: products/mini-game-hub/js/sw-core.js
//
// ?v= phải bump cùng lúc với CACHE_NAME trong core.
importScripts('/products/mini-game-hub/js/sw-core.js?v=2');
