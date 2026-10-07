// Điểm vào service worker của LoveDays — CỐ Ý chỉ có 1 dòng thật.
//
// Nằm thẳng trong products/love-days/ (ngang hàng html/, css/, js/, data/,
// img/), không lồng vào js/: scope mặc định của service worker là thư mục
// chứa chính file này. Lồng vào js/ thì scope co lại /products/love-days/js/,
// không còn quản được html/, data/, img/ — mất offline. Ép scope rộng hơn ném
// SecurityError; header Service-Worker-Allowed thì GitHub Pages không set được.
//
// Logic thật nằm ở products/love-days/js/sw-core.js.
// ?v= phải bump cùng lúc với CACHE_NAME trong core.
importScripts('/products/love-days/js/sw-core.js?v=3');
