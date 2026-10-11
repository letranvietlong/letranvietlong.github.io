// Điểm vào service worker của PowerTrack — CỐ Ý chỉ có 1 dòng thật.
//
// Vỏ nằm ngay trong products/power-track/ (ngang hàng html/, css/, js/, json/,
// data/, img/), không lồng vào js/: scope mặc định của service worker là thư
// mục CHỨA file đăng ký nó. Đặt trong js/ thì scope co lại còn
// /products/power-track/js/ và app mất offline. (Nới scope cần header
// Service-Worker-Allowed, GitHub Pages không đặt được.)
//
// Logic thật: products/power-track/js/sw-core.js
//
// ?v= phải bump cùng lúc với CACHE_NAME trong core.
importScripts('/products/power-track/js/sw-core.js?v=1');
