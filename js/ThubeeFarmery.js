"use strict";
/**
 * Thubee Farmery — Quản lý Doanh thu
 * Thiết kế riêng cho iPhone 14 Pro Max — không hỗ trợ desktop.
 * Đăng nhập là client-side password gate (không có backend) — chỉ ngăn người xem thường, không chống người cố tình đọc source.
 * Đổi mật khẩu: mở Console, gọi `ThubeeAuth.hashPassword("user","pass")` rồi thay AUTH_PASSWORD_HASH + AUTH_USERNAME.
 * Dữ liệu: json/*.json là dữ liệu khởi tạo (seed) + nguồn combobox; mọi thêm/sửa/xoá lưu vào localStorage của trình duyệt
 * (không đồng bộ nhiều thiết bị, không ghi ngược lại file json — đây là giới hạn của site tĩnh không backend).
 */
// ===================== Constants =====================
const STORAGE_PRODUCTS = 'thubee_farmery_products';
const STORAGE_CUSTOMERS = 'thubee_farmery_customers';
const STORAGE_SELLERS = 'thubee_farmery_sellers';
const STORAGE_ORDERS = 'thubee_farmery_orders';
const STORAGE_SESSION = 'thubee_farmery_session';
const JSON_PATHS = {
    products: 'json/products.json',
    customers: 'json/customers.json',
    sellers: 'json/sellers.json',
    orders: 'json/orders.json',
};
const STATUS_LABEL = {
    completed: 'Hoàn thành',
    pending: 'Đang xử lý',
    cancelled: 'Đã hủy',
};
const PAYMENT_LABEL = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    cod: 'COD',
};
const CATEGORY_COLOR = {
    'Mật ong': '#c5963a',
    'Trái cây sấy': '#df7a35',
    'Rau củ organic': '#6f9c3c',
    'Trà thảo mộc': '#8a5a3a',
    'Nông sản tươi': '#2b4424',
};
// Dùng khi fetch json/products.json thất bại (ví dụ mở file trực tiếp bằng file://), để app vẫn dùng được.
const FALLBACK_PRODUCTS = [
    { id: 'p01', name: 'Mật ong rừng nguyên chất 500ml', category: 'Mật ong', unit: 'chai', price: 180000, cost: 110000, stock: 64 },
    { id: 'p02', name: 'Mật ong hoa nhãn 500ml', category: 'Mật ong', unit: 'chai', price: 165000, cost: 100000, stock: 52 },
    { id: 'p03', name: 'Mật ong bạc hà 250ml', category: 'Mật ong', unit: 'chai', price: 95000, cost: 58000, stock: 40 },
    { id: 'p04', name: 'Xoài sấy dẻo 250g', category: 'Trái cây sấy', unit: 'túi', price: 65000, cost: 38000, stock: 80 },
    { id: 'p05', name: 'Mít sấy giòn 200g', category: 'Trái cây sấy', unit: 'túi', price: 58000, cost: 32000, stock: 70 },
    { id: 'p06', name: 'Chuối sấy dẻo 250g', category: 'Trái cây sấy', unit: 'túi', price: 52000, cost: 29000, stock: 90 },
    { id: 'p07', name: 'Rau cải organic 500g', category: 'Rau củ organic', unit: 'túi', price: 28000, cost: 16000, stock: 120 },
    { id: 'p08', name: 'Cà chua organic 1kg', category: 'Rau củ organic', unit: 'kg', price: 35000, cost: 20000, stock: 100 },
    { id: 'p09', name: 'Khoai lang mật organic 1kg', category: 'Rau củ organic', unit: 'kg', price: 32000, cost: 18000, stock: 95 },
    { id: 'p10', name: 'Trà hoa cúc 50g', category: 'Trà thảo mộc', unit: 'hộp', price: 45000, cost: 24000, stock: 60 },
    { id: 'p11', name: 'Trà gừng mật ong 50g', category: 'Trà thảo mộc', unit: 'hộp', price: 48000, cost: 26000, stock: 55 },
    { id: 'p12', name: 'Trà atiso túi lọc', category: 'Trà thảo mộc', unit: 'hộp', price: 42000, cost: 22000, stock: 65 },
    { id: 'p13', name: 'Trứng gà ta organic (chục)', category: 'Nông sản tươi', unit: 'chục', price: 55000, cost: 38000, stock: 48 },
    { id: 'p14', name: 'Gạo lứt hữu cơ 2kg', category: 'Nông sản tươi', unit: 'túi', price: 78000, cost: 50000, stock: 70 },
];
// ===================== Auth =====================
const AUTH_SALT = 'thubee-farmery-salt';
const AUTH_USERNAME = 'thubee';
const AUTH_PASSWORD_HASH = '6fb489af542e48860553e3c71d99bdf8edc4c0e72a7fb45d7e9b6b7fd0e51829';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;
let failedAttempts = 0;
let lockedUntil = 0;
async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const ThubeeAuth = {
    async hashPassword(username, password) {
        const hash = await sha256Hex(`${AUTH_SALT}:${username}:${password}`);
        console.log('AUTH_PASSWORD_HASH =', hash);
        return hash;
    },
};
window.ThubeeAuth = ThubeeAuth;
function hasValidSession() {
    const raw = sessionStorage.getItem(STORAGE_SESSION);
    if (!raw)
        return false;
    try {
        const session = JSON.parse(raw);
        return session.user === AUTH_USERNAME && typeof session.ts === 'number';
    }
    catch (_a) {
        return false;
    }
}
function setLoginError(message) {
    const el = document.getElementById('loginError');
    if (!el)
        return;
    el.textContent = message;
    el.classList.toggle('show', Boolean(message));
}
async function handleLoginSubmit(e) {
    e.preventDefault();
    const now = Date.now();
    if (now < lockedUntil) {
        const secs = Math.ceil((lockedUntil - now) / 1000);
        setLoginError(`Đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${secs}s.`);
        return;
    }
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const submitBtn = document.getElementById('loginSubmitBtn');
    if (!usernameInput || !passwordInput)
        return;
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
        setLoginError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
        return;
    }
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang kiểm tra…';
    }
    const hash = await sha256Hex(`${AUTH_SALT}:${username}:${password}`);
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng nhập';
    }
    if (username === AUTH_USERNAME && hash === AUTH_PASSWORD_HASH) {
        failedAttempts = 0;
        sessionStorage.setItem(STORAGE_SESSION, JSON.stringify({ user: username, ts: Date.now() }));
        setLoginError('');
        passwordInput.value = '';
        showApp();
    }
    else {
        failedAttempts += 1;
        if (failedAttempts >= MAX_ATTEMPTS) {
            lockedUntil = Date.now() + LOCKOUT_MS;
            setLoginError(`Sai tài khoản hoặc mật khẩu. Tạm khoá đăng nhập ${LOCKOUT_MS / 1000}s.`);
        }
        else {
            setLoginError(`Sai tài khoản hoặc mật khẩu. (${failedAttempts}/${MAX_ATTEMPTS} lần)`);
        }
        passwordInput.value = '';
    }
}
function handleLogout() {
    sessionStorage.removeItem(STORAGE_SESSION);
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    if (usernameInput)
        usernameInput.value = '';
    if (passwordInput)
        passwordInput.value = '';
    setLoginError('');
    showLogin();
}
function showApp() {
    var _a, _b, _c;
    (_a = document.getElementById('loadingScreen')) === null || _a === void 0 ? void 0 : _a.remove();
    (_b = document.getElementById('authScreen')) === null || _b === void 0 ? void 0 : _b.classList.remove('visible');
    (_c = document.getElementById('appShell')) === null || _c === void 0 ? void 0 : _c.classList.add('visible');
    renderAll();
}
function showLogin() {
    var _a, _b, _c;
    (_a = document.getElementById('loadingScreen')) === null || _a === void 0 ? void 0 : _a.remove();
    (_b = document.getElementById('appShell')) === null || _b === void 0 ? void 0 : _b.classList.remove('visible');
    (_c = document.getElementById('authScreen')) === null || _c === void 0 ? void 0 : _c.classList.add('visible');
}
// ===================== Data loading =====================
let products = [];
let customers = [];
let sellers = [];
let orders = [];
async function loadEntity(storageKey, jsonPath, fallback) {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
        try {
            return JSON.parse(stored);
        }
        catch (_a) {
            // fall through to re-seed
        }
    }
    try {
        const res = await fetch(jsonPath);
        if (!res.ok)
            throw new Error(`fetch ${jsonPath} failed`);
        const data = (await res.json());
        localStorage.setItem(storageKey, JSON.stringify(data));
        return data;
    }
    catch (_b) {
        localStorage.setItem(storageKey, JSON.stringify(fallback));
        return fallback;
    }
}
async function loadState() {
    [products, customers, sellers, orders] = await Promise.all([
        loadEntity(STORAGE_PRODUCTS, JSON_PATHS.products, FALLBACK_PRODUCTS),
        loadEntity(STORAGE_CUSTOMERS, JSON_PATHS.customers, []),
        loadEntity(STORAGE_SELLERS, JSON_PATHS.sellers, []),
        loadEntity(STORAGE_ORDERS, JSON_PATHS.orders, []),
    ]);
}
function persistProducts() {
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
}
function persistCustomers() {
    localStorage.setItem(STORAGE_CUSTOMERS, JSON.stringify(customers));
}
function persistSellers() {
    localStorage.setItem(STORAGE_SELLERS, JSON.stringify(sellers));
}
function persistOrders() {
    localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
}
// ===================== Formatting =====================
function formatCurrency(n) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}
function formatNumber(n) {
    return new Intl.NumberFormat('vi-VN').format(n);
}
function formatDateVN(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
function formatDateShort(iso) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
}
function toISODate(d) {
    return d.toISOString().slice(0, 10);
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// ===================== Lookup helpers =====================
function getProduct(id) {
    return products.find((p) => p.id === id);
}
function getCustomer(id) {
    return customers.find((c) => c.id === id);
}
function getSeller(id) {
    return sellers.find((s) => s.id === id);
}
function resolveCustomerId(name) {
    const trimmed = name.trim();
    const existing = customers.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing)
        return existing.id;
    const created = { id: `c${Date.now()}`, name: trimmed, phone: '' };
    customers.push(created);
    persistCustomers();
    return created.id;
}
function toRow(order) {
    const product = getProduct(order.productId);
    if (!product)
        return null;
    const customer = getCustomer(order.customerId);
    const seller = order.sellerId ? getSeller(order.sellerId) : undefined;
    const unitPrice = product.price;
    const total = unitPrice * order.quantity;
    const cost = product.cost * order.quantity;
    return Object.assign(Object.assign({}, order), { productName: product.name, category: product.category, unitPrice,
        total,
        cost, profit: total - cost, customerName: customer ? customer.name : '(Khách lẻ)', sellerName: seller ? seller.name : '' });
}
// ===================== Date range =====================
function rangeForPreset(preset, customFrom, customTo) {
    const today = new Date();
    const to = toISODate(today);
    if (preset === 'custom' && customFrom && customTo) {
        return { from: customFrom, to: customTo };
    }
    if (preset === 'all') {
        return { from: '2000-01-01', to };
    }
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 180;
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    return { from: toISODate(from), to };
}
function previousRange(range) {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const spanMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - spanMs);
    return { from: toISODate(prevFrom), to: toISODate(prevTo) };
}
function inRange(dateIso, range) {
    return dateIso >= range.from && dateIso <= range.to;
}
function getRows(range) {
    const rows = [];
    for (const order of orders) {
        if (!inRange(order.date, range))
            continue;
        const row = toRow(order);
        if (row)
            rows.push(row);
    }
    return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}
// ===================== State =====================
let currentRange = { from: '', to: '' };
let currentPreset = '30d';
let orderSearchText = '';
let orderStatusFilter = '';
let orderCategoryFilter = '';
let orderSellerFilter = '';
let editingOrderId = null;
// ===================== KPIs =====================
function computeKPIs(rows) {
    const valid = rows.filter((r) => r.status !== 'cancelled');
    const revenue = valid.reduce((sum, r) => sum + r.total, 0);
    const profit = valid.reduce((sum, r) => sum + r.profit, 0);
    const orderCount = valid.length;
    const aov = orderCount > 0 ? revenue / orderCount : 0;
    return { revenue, orderCount, profit, aov };
}
function deltaPercent(current, previous) {
    if (previous === 0)
        return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}
function setText(id, value) {
    const el = document.getElementById(id);
    if (el)
        el.textContent = value;
}
function renderDelta(elId, delta) {
    const el = document.getElementById(elId);
    if (!el)
        return;
    const up = delta >= 0;
    el.className = `kpi-delta ${up ? 'up' : 'down'}`;
    el.innerHTML = `<span>${up ? '▲' : '▼'}</span> ${Math.abs(delta).toFixed(1)}% so với kỳ trước`;
}
function renderKPIs(rows) {
    const current = computeKPIs(rows);
    const prevRange = previousRange(currentRange);
    const previous = computeKPIs(getRows(prevRange));
    setText('kpiRevenue', formatCurrency(current.revenue));
    setText('kpiOrders', formatNumber(current.orderCount));
    setText('kpiProfit', formatCurrency(current.profit));
    setText('kpiAov', formatCurrency(Math.round(current.aov)));
    renderDelta('kpiRevenueDelta', deltaPercent(current.revenue, previous.revenue));
    renderDelta('kpiOrdersDelta', deltaPercent(current.orderCount, previous.orderCount));
    renderDelta('kpiProfitDelta', deltaPercent(current.profit, previous.profit));
    renderDelta('kpiAovDelta', deltaPercent(current.aov, previous.aov));
}
function setupHiDPICanvas(canvas) {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
}
function buildRevenueTrend(rows, range) {
    var _a, _b, _c;
    const valid = rows.filter((r) => r.status !== 'cancelled');
    const from = new Date(range.from);
    const to = new Date(range.to);
    const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const byDay = new Map();
    for (const row of valid) {
        byDay.set(row.date, ((_a = byDay.get(row.date)) !== null && _a !== void 0 ? _a : 0) + row.total);
    }
    if (totalDays <= 60) {
        const points = [];
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(from);
            d.setDate(from.getDate() + i);
            const iso = toISODate(d);
            points.push({ label: formatDateShort(iso), value: (_b = byDay.get(iso)) !== null && _b !== void 0 ? _b : 0 });
        }
        return points;
    }
    const points = [];
    let cursor = new Date(from);
    while (cursor <= to) {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(cursor);
            d.setDate(cursor.getDate() + i);
            if (d > to)
                break;
            sum += (_c = byDay.get(toISODate(d))) !== null && _c !== void 0 ? _c : 0;
        }
        points.push({ label: formatDateShort(toISODate(cursor)), value: sum });
        cursor.setDate(cursor.getDate() + 7);
    }
    return points;
}
function formatCompactNumber(n) {
    if (n >= 1000000)
        return `${(n / 1000000).toFixed(1)}tr`;
    if (n >= 1000)
        return `${Math.round(n / 1000)}k`;
    return String(Math.round(n));
}
function setupChartTooltip(canvas, coords, points) {
    const tooltip = document.getElementById('chartTooltip');
    if (!tooltip)
        return;
    const handleMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        let nearest = 0;
        let minDist = Infinity;
        coords.forEach((c, i) => {
            const dist = Math.abs(c.x - mouseX);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        });
        const point = points[nearest];
        const coord = coords[nearest];
        if (!point)
            return;
        tooltip.style.display = 'block';
        tooltip.style.left = `${rect.left + coord.x}px`;
        tooltip.style.top = `${rect.top + coord.y - 10}px`;
        tooltip.innerHTML = `<strong>${point.label}</strong><br>${formatCurrency(point.value)}`;
    };
    const handleLeave = () => {
        tooltip.style.display = 'none';
    };
    canvas.ontouchstart = (e) => handleMove(e.touches[0]);
    canvas.ontouchmove = (e) => {
        e.preventDefault();
        handleMove(e.touches[0]);
    };
    canvas.ontouchend = handleLeave;
    canvas.onmousemove = handleMove;
    canvas.onmouseleave = handleLeave;
}
function drawLineChart(canvas, points) {
    const ctx = setupHiDPICanvas(canvas);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    if (w < 40 || h < 40)
        return;
    const padL = 48;
    const padR = 12;
    const padT = 16;
    const padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const realMax = Math.max(0, ...points.map((p) => p.value));
    const maxVal = realMax > 0 ? realMax : 100000;
    const niceMax = Math.ceil(maxVal / Math.pow(10, Math.floor(Math.log10(maxVal)))) * Math.pow(10, Math.floor(Math.log10(maxVal)));
    ctx.font = "11px 'Be Vietnam Pro', sans-serif";
    ctx.fillStyle = '#8a9a8a';
    ctx.strokeStyle = 'rgba(45,80,22,0.08)';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = padT + (plotH * i) / gridLines;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        const val = niceMax - (niceMax * i) / gridLines;
        ctx.textAlign = 'right';
        ctx.fillText(formatCompactNumber(val), padL - 8, y + 4);
    }
    if (points.length === 0)
        return;
    const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({
        x: padL + stepX * i,
        y: padT + plotH - (p.value / niceMax) * plotH,
    }));
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    gradient.addColorStop(0, 'rgba(197,150,58,0.32)');
    gradient.addColorStop(1, 'rgba(197,150,58,0.02)');
    ctx.beginPath();
    ctx.moveTo(coords[0].x, padT + plotH);
    coords.forEach((c) => ctx.lineTo(c.x, c.y));
    ctx.lineTo(coords[coords.length - 1].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.strokeStyle = '#c5963a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = '#8a9a8a';
    ctx.textAlign = 'center';
    const labelEvery = Math.max(1, Math.ceil(points.length / 5));
    points.forEach((p, i) => {
        if (i % labelEvery === 0 || i === points.length - 1) {
            ctx.fillText(p.label, coords[i].x, h - 8);
        }
    });
    setupChartTooltip(canvas, coords, points);
}
function renderRevenueChart(rows) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas)
        return;
    drawLineChart(canvas, buildRevenueTrend(rows, currentRange));
}
// ===================== Canvas chart: category donut =====================
function renderCategoryDonut(rows) {
    var _a;
    const canvas = document.getElementById('categoryDonut');
    const legendEl = document.getElementById('categoryLegend');
    if (!canvas || !legendEl)
        return;
    const valid = rows.filter((r) => r.status !== 'cancelled');
    const totals = new Map();
    for (const row of valid) {
        totals.set(row.category, ((_a = totals.get(row.category)) !== null && _a !== void 0 ? _a : 0) + row.total);
    }
    const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    const segments = Array.from(totals.entries())
        .map(([category, value]) => { var _a; return ({ category, value, color: (_a = CATEGORY_COLOR[category]) !== null && _a !== void 0 ? _a : '#999' }); })
        .sort((a, b) => b.value - a.value);
    const ctx = setupHiDPICanvas(canvas);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    if (w < 16 || h < 16)
        return;
    const cx = w / 2;
    const cy = h / 2;
    const outerR = Math.min(w, h) / 2 - 4;
    const innerR = outerR * 0.62;
    let startAngle = -Math.PI / 2;
    if (grandTotal === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.fillStyle = '#eef2ea';
        ctx.fill();
    }
    else {
        for (const seg of segments) {
            const angle = (seg.value / grandTotal) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.fill();
            startAngle += angle;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }
    ctx.fillStyle = '#2b4424';
    ctx.textAlign = 'center';
    ctx.font = "700 15px 'Be Vietnam Pro', sans-serif";
    ctx.fillText(formatCompactNumber(grandTotal), cx, cy - 2);
    ctx.font = "11px 'Be Vietnam Pro', sans-serif";
    ctx.fillStyle = '#8a9a8a';
    ctx.fillText('Tổng doanh thu', cx, cy + 16);
    legendEl.innerHTML = segments
        .map((seg) => {
        const pct = grandTotal > 0 ? ((seg.value / grandTotal) * 100).toFixed(1) : '0.0';
        return `<div class="legend-row">
        <span class="legend-dot" style="background:${seg.color}"></span>
        <span class="legend-label">${seg.category}</span>
        <span class="legend-value">${pct}%</span>
      </div>`;
    })
        .join('');
}
// ===================== Top products rank list =====================
function renderTopProducts(rows) {
    const container = document.getElementById('topProductsList');
    if (!container)
        return;
    const valid = rows.filter((r) => r.status !== 'cancelled');
    const totals = new Map();
    for (const row of valid) {
        const existing = totals.get(row.productId);
        if (existing) {
            existing.value += row.total;
            existing.qty += row.quantity;
        }
        else {
            totals.set(row.productId, { name: row.productName, value: row.total, qty: row.quantity, category: row.category });
        }
    }
    const top = Array.from(totals.values()).sort((a, b) => b.value - a.value).slice(0, 6);
    const maxVal = Math.max(1, ...top.map((t) => t.value));
    if (top.length === 0) {
        container.innerHTML = '<p class="empty-hint">Chưa có dữ liệu trong khoảng thời gian này.</p>';
        return;
    }
    container.innerHTML = top
        .map((item) => {
        var _a;
        const pct = (item.value / maxVal) * 100;
        const color = (_a = CATEGORY_COLOR[item.category]) !== null && _a !== void 0 ? _a : '#999';
        return `<div class="rank-row">
        <div class="rank-info">
          <span class="rank-name">${escapeHtml(item.name)}</span>
          <span class="rank-meta">${formatNumber(item.qty)} sản phẩm bán ra</span>
        </div>
        <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="rank-value">${formatCurrency(item.value)}</div>
      </div>`;
    })
        .join('');
}
// ===================== Card-list renderers =====================
function renderOrdersCards(rows) {
    const container = document.getElementById('ordersList');
    if (!container)
        return;
    let filtered = rows;
    if (orderSearchText) {
        const q = orderSearchText.toLowerCase();
        filtered = filtered.filter((r) => r.customerName.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    if (orderStatusFilter)
        filtered = filtered.filter((r) => r.status === orderStatusFilter);
    if (orderCategoryFilter)
        filtered = filtered.filter((r) => r.category === orderCategoryFilter);
    if (orderSellerFilter)
        filtered = filtered.filter((r) => r.sellerId === orderSellerFilter);
    setText('ordersCount', `${filtered.length} đơn hàng`);
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-hint">Không tìm thấy đơn hàng phù hợp.</p>';
        return;
    }
    container.innerHTML = filtered
        .map((r) => `<div class="data-card">
        <div class="data-card-top">
          <span class="data-card-id">${r.id}</span>
          <span class="badge badge-${r.status}">${STATUS_LABEL[r.status]}</span>
        </div>
        <div class="data-card-title">${escapeHtml(r.customerName)}</div>
        <div class="data-card-subtitle">${escapeHtml(r.productName)} × ${r.quantity}</div>
        <div class="data-card-row">
          <span class="data-card-label">${formatDateVN(r.date)}</span>
          <span class="data-card-amount">${formatCurrency(r.total)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">${r.sellerName ? '👤 ' + escapeHtml(r.sellerName) : '— Chưa gán người bán'}</span>
          <span class="data-card-label">${PAYMENT_LABEL[r.payment]}</span>
        </div>
        <div class="data-card-actions">
          <button class="icon-btn" onclick="openOrderModal('${r.id}')">✎ Sửa</button>
          <button class="icon-btn icon-btn-danger" onclick="deleteOrder('${r.id}')">🗑 Xoá</button>
        </div>
      </div>`)
        .join('');
}
function renderProductsCards(rows) {
    const container = document.getElementById('productsList');
    if (!container)
        return;
    const valid = rows.filter((r) => r.status !== 'cancelled');
    const soldMap = new Map();
    for (const row of valid) {
        const existing = soldMap.get(row.productId);
        if (existing) {
            existing.qty += row.quantity;
            existing.revenue += row.total;
        }
        else {
            soldMap.set(row.productId, { qty: row.quantity, revenue: row.total });
        }
    }
    const sorted = products.slice().sort((a, b) => { var _a, _b, _c, _d; return ((_b = (_a = soldMap.get(b.id)) === null || _a === void 0 ? void 0 : _a.revenue) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = soldMap.get(a.id)) === null || _c === void 0 ? void 0 : _c.revenue) !== null && _d !== void 0 ? _d : 0); });
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-hint">Chưa có sản phẩm nào. Bấm "+ Thêm sản phẩm" để bắt đầu.</p>';
        return;
    }
    container.innerHTML = sorted
        .map((p) => {
        var _a, _b, _c;
        const sold = (_a = soldMap.get(p.id)) !== null && _a !== void 0 ? _a : { qty: 0, revenue: 0 };
        const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : '0';
        const lowStock = p.stock <= 20;
        return `<div class="data-card">
        <div class="data-card-top">
          <span class="data-card-title" style="margin:0">${escapeHtml(p.name)}</span>
          <span class="tag-pill" style="background:${(_b = CATEGORY_COLOR[p.category]) !== null && _b !== void 0 ? _b : '#999'}1a;color:${(_c = CATEGORY_COLOR[p.category]) !== null && _c !== void 0 ? _c : '#999'}">${escapeHtml(p.category)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Giá bán</span>
          <span class="data-card-value">${formatCurrency(p.price)} / ${escapeHtml(p.unit)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Biên lợi nhuận</span>
          <span class="data-card-value">${margin}%</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Đã bán / Doanh thu</span>
          <span class="data-card-amount">${formatNumber(sold.qty)} · ${formatCurrency(sold.revenue)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Tồn kho</span>
          <span class="${lowStock ? 'cell-warning' : 'data-card-value'}">${formatNumber(p.stock)} ${escapeHtml(p.unit)}${lowStock ? ' ⚠' : ''}</span>
        </div>
        <div class="data-card-actions">
          <button class="icon-btn" onclick="openProductModal('${p.id}')">✎ Sửa</button>
          <button class="icon-btn icon-btn-danger" onclick="deleteProduct('${p.id}')">🗑 Xoá</button>
        </div>
      </div>`;
    })
        .join('');
}
function renderCustomersCards(rows) {
    const container = document.getElementById('customersList');
    if (!container)
        return;
    const valid = rows.filter((r) => r.status !== 'cancelled');
    const map = new Map();
    for (const row of valid) {
        const existing = map.get(row.customerId);
        if (existing) {
            existing.orders += 1;
            existing.revenue += row.total;
            if (row.date > existing.lastDate)
                existing.lastDate = row.date;
        }
        else {
            map.set(row.customerId, { name: row.customerName, orders: 1, revenue: row.total, lastDate: row.date });
        }
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-hint">Chưa có khách hàng trong khoảng thời gian này.</p>';
        return;
    }
    container.innerHTML = sorted
        .map((c, idx) => `<div class="data-card">
        <div class="data-card-top">
          <span class="data-card-rank">#${idx + 1}</span>
          <span class="data-card-title" style="margin:0">${escapeHtml(c.name)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Số đơn</span>
          <span class="data-card-value">${formatNumber(c.orders)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Tổng chi tiêu</span>
          <span class="data-card-amount">${formatCurrency(c.revenue)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Mua gần nhất</span>
          <span class="data-card-value">${formatDateVN(c.lastDate)}</span>
        </div>
      </div>`)
        .join('');
}
function renderSellersCards(rows) {
    const container = document.getElementById('sellersList');
    if (!container)
        return;
    const valid = rows.filter((r) => r.status !== 'cancelled' && r.sellerId);
    const statsMap = new Map();
    for (const row of valid) {
        const existing = statsMap.get(row.sellerId);
        if (existing) {
            existing.orders += 1;
            existing.revenue += row.total;
        }
        else {
            statsMap.set(row.sellerId, { orders: 1, revenue: row.total });
        }
    }
    const sorted = sellers.slice().sort((a, b) => { var _a, _b, _c, _d; return ((_b = (_a = statsMap.get(b.id)) === null || _a === void 0 ? void 0 : _a.revenue) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = statsMap.get(a.id)) === null || _c === void 0 ? void 0 : _c.revenue) !== null && _d !== void 0 ? _d : 0); });
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-hint">Chưa có người bán hàng nào. Bấm "+ Thêm người bán" để bắt đầu.</p>';
        return;
    }
    container.innerHTML = sorted
        .map((s, idx) => {
        var _a;
        const stat = (_a = statsMap.get(s.id)) !== null && _a !== void 0 ? _a : { orders: 0, revenue: 0 };
        return `<div class="data-card">
        <div class="data-card-top">
          <span class="data-card-rank">#${idx + 1}</span>
          <span class="data-card-title" style="margin:0">${escapeHtml(s.name)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Điện thoại</span>
          <span class="data-card-value">${escapeHtml(s.phone || '—')}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Số đơn</span>
          <span class="data-card-value">${formatNumber(stat.orders)}</span>
        </div>
        <div class="data-card-row">
          <span class="data-card-label">Doanh thu</span>
          <span class="data-card-amount">${formatCurrency(stat.revenue)}</span>
        </div>
        <div class="data-card-actions">
          <button class="icon-btn" onclick="openSellerModal('${s.id}')">✎ Sửa</button>
          <button class="icon-btn icon-btn-danger" onclick="deleteSeller('${s.id}')">🗑 Xoá</button>
        </div>
      </div>`;
    })
        .join('');
}
// ===================== Filters population =====================
function populateCategoryFilter() {
    const select = document.getElementById('orderCategoryFilter');
    if (!select)
        return;
    const categories = Array.from(new Set(products.map((p) => p.category)));
    select.innerHTML = '<option value="">Tất cả danh mục</option>' + categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}
function populateSellerFilter() {
    const select = document.getElementById('orderSellerFilter');
    if (!select)
        return;
    select.innerHTML = '<option value="">Tất cả người bán</option>' + sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}
function populateCustomerDatalist() {
    const list = document.getElementById('customerDatalist');
    if (!list)
        return;
    list.innerHTML = customers.map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join('');
}
function populateSellerSelect() {
    const select = document.getElementById('orderSellerSelect');
    if (!select)
        return;
    select.innerHTML = '<option value="">— Không chọn —</option>' + sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}
function populateProductSelect() {
    const select = document.getElementById('orderProductSelect');
    if (!select)
        return;
    select.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${formatCurrency(p.price)}</option>`).join('');
}
// ===================== Master render =====================
function renderAll() {
    const rows = getRows(currentRange);
    renderKPIs(rows);
    renderRevenueChart(rows);
    renderCategoryDonut(rows);
    renderTopProducts(rows);
    renderOrdersCards(rows);
    renderProductsCards(rows);
    renderCustomersCards(rows);
    renderSellersCards(rows);
    renderRangeLabel();
}
function renderRangeLabel() {
    setText('rangeLabel', `${formatDateVN(currentRange.from)} — ${formatDateVN(currentRange.to)}`);
}
// ===================== Range controls =====================
function setRangePreset(preset) {
    var _a;
    currentPreset = preset;
    currentRange = rangeForPreset(preset);
    document.querySelectorAll('.range-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.preset === preset));
    (_a = document.getElementById('customRangeRow')) === null || _a === void 0 ? void 0 : _a.classList.toggle('show', preset === 'custom');
    renderAll();
}
function applyCustomRange() {
    const fromInput = document.getElementById('customFrom');
    const toInput = document.getElementById('customTo');
    if (!(fromInput === null || fromInput === void 0 ? void 0 : fromInput.value) || !(toInput === null || toInput === void 0 ? void 0 : toInput.value)) {
        showToast('Vui lòng chọn đủ ngày bắt đầu và kết thúc.', 'error');
        return;
    }
    if (fromInput.value > toInput.value) {
        showToast('Ngày bắt đầu phải trước ngày kết thúc.', 'error');
        return;
    }
    currentRange = { from: fromInput.value, to: toInput.value };
    renderAll();
}
// ===================== Tabs =====================
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach((el) => el.classList.toggle('active', el.id === `tab-${tabId}`));
    document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.tab === tabId));
    if (tabId === 'overview') {
        requestAnimationFrame(() => renderAll());
    }
}
// ===================== Toasts =====================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container)
        return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-out'), 2400);
    setTimeout(() => toast.remove(), 2800);
}
// ===================== Order modal =====================
function openOrderModal(orderId) {
    editingOrderId = orderId !== null && orderId !== void 0 ? orderId : null;
    const modal = document.getElementById('orderModal');
    const title = document.getElementById('orderModalTitle');
    const form = document.getElementById('orderForm');
    if (!modal || !form)
        return;
    populateProductSelect();
    populateSellerSelect();
    populateCustomerDatalist();
    form.reset();
    if (orderId) {
        const order = orders.find((o) => o.id === orderId);
        if (!order)
            return;
        if (title)
            title.textContent = `Sửa đơn hàng ${order.id}`;
        const customer = getCustomer(order.customerId);
        document.getElementById('orderCustomer').value = customer ? customer.name : '';
        document.getElementById('orderDate').value = order.date;
        document.getElementById('orderProductSelect').value = order.productId;
        document.getElementById('orderQuantity').value = String(order.quantity);
        document.getElementById('orderStatusSelect').value = order.status;
        document.getElementById('orderPaymentSelect').value = order.payment;
        document.getElementById('orderSellerSelect').value = order.sellerId;
    }
    else {
        if (title)
            title.textContent = 'Thêm đơn hàng mới';
        document.getElementById('orderDate').value = toISODate(new Date());
        document.getElementById('orderQuantity').value = '1';
    }
    modal.classList.add('show');
}
function closeOrderModal() {
    var _a;
    (_a = document.getElementById('orderModal')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
    editingOrderId = null;
}
function handleOrderFormSubmit(e) {
    e.preventDefault();
    const customerName = document.getElementById('orderCustomer').value.trim();
    const date = document.getElementById('orderDate').value;
    const productId = document.getElementById('orderProductSelect').value;
    const quantity = parseInt(document.getElementById('orderQuantity').value, 10);
    const status = document.getElementById('orderStatusSelect').value;
    const payment = document.getElementById('orderPaymentSelect').value;
    const sellerId = document.getElementById('orderSellerSelect').value;
    if (!customerName || !date || !productId || !quantity || quantity < 1) {
        showToast('Vui lòng điền đầy đủ thông tin hợp lệ.', 'error');
        return;
    }
    const customerId = resolveCustomerId(customerName);
    if (editingOrderId) {
        const order = orders.find((o) => o.id === editingOrderId);
        if (order) {
            order.customerId = customerId;
            order.date = date;
            order.productId = productId;
            order.quantity = quantity;
            order.status = status;
            order.payment = payment;
            order.sellerId = sellerId;
        }
        showToast(`Đã cập nhật đơn hàng ${editingOrderId}.`);
    }
    else {
        const nextId = `DH${String(orders.length + 1).padStart(4, '0')}`;
        orders.push({ id: nextId, customerId, date, productId, quantity, status, payment, sellerId });
        showToast(`Đã thêm đơn hàng ${nextId}.`);
    }
    persistOrders();
    closeOrderModal();
    populateCustomerDatalist();
    renderAll();
}
function deleteOrder(orderId) {
    if (!confirm(`Xoá đơn hàng ${orderId}? Hành động này không thể hoàn tác.`))
        return;
    orders = orders.filter((o) => o.id !== orderId);
    persistOrders();
    showToast(`Đã xoá đơn hàng ${orderId}.`);
    renderAll();
}
// ===================== Product modal =====================
function openProductModal(productId) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');
    if (!modal || !form)
        return;
    form.reset();
    if (productId) {
        const product = getProduct(productId);
        if (!product)
            return;
        if (title)
            title.textContent = 'Sửa sản phẩm';
        document.getElementById('productIdField').value = product.id;
        document.getElementById('productNameField').value = product.name;
        document.getElementById('productCategoryField').value = product.category;
        document.getElementById('productUnitField').value = product.unit;
        document.getElementById('productPriceField').value = String(product.price);
        document.getElementById('productCostField').value = String(product.cost);
        document.getElementById('productStockField').value = String(product.stock);
    }
    else {
        if (title)
            title.textContent = 'Thêm sản phẩm mới';
        document.getElementById('productIdField').value = '';
    }
    modal.classList.add('show');
}
function closeProductModal() {
    var _a;
    (_a = document.getElementById('productModal')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
}
function handleProductFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('productIdField').value;
    const name = document.getElementById('productNameField').value.trim();
    const category = document.getElementById('productCategoryField').value.trim();
    const unit = document.getElementById('productUnitField').value.trim();
    const price = parseFloat(document.getElementById('productPriceField').value);
    const cost = parseFloat(document.getElementById('productCostField').value);
    const stock = parseInt(document.getElementById('productStockField').value, 10);
    if (!name || !category || !unit || isNaN(price) || isNaN(cost) || isNaN(stock) || price < 0 || cost < 0 || stock < 0) {
        showToast('Vui lòng nhập đầy đủ thông tin hợp lệ.', 'error');
        return;
    }
    if (id) {
        const product = getProduct(id);
        if (product) {
            product.name = name;
            product.category = category;
            product.unit = unit;
            product.price = price;
            product.cost = cost;
            product.stock = stock;
        }
        showToast(`Đã cập nhật sản phẩm "${name}".`);
    }
    else {
        products.push({ id: `p${Date.now()}`, name, category, unit, price, cost, stock });
        showToast(`Đã thêm sản phẩm "${name}".`);
    }
    persistProducts();
    closeProductModal();
    populateCategoryFilter();
    renderAll();
}
function deleteProduct(productId) {
    var _a;
    const inUse = orders.some((o) => o.productId === productId);
    if (inUse) {
        showToast('Không thể xoá — sản phẩm đang có trong đơn hàng.', 'error');
        return;
    }
    const product = getProduct(productId);
    if (!confirm(`Xoá sản phẩm "${(_a = product === null || product === void 0 ? void 0 : product.name) !== null && _a !== void 0 ? _a : ''}"?`))
        return;
    products = products.filter((p) => p.id !== productId);
    persistProducts();
    showToast('Đã xoá sản phẩm.');
    populateCategoryFilter();
    renderAll();
}
// ===================== Seller modal =====================
function openSellerModal(sellerId) {
    const modal = document.getElementById('sellerModal');
    const title = document.getElementById('sellerModalTitle');
    const form = document.getElementById('sellerForm');
    if (!modal || !form)
        return;
    form.reset();
    if (sellerId) {
        const seller = getSeller(sellerId);
        if (!seller)
            return;
        if (title)
            title.textContent = 'Sửa người bán hàng';
        document.getElementById('sellerIdField').value = seller.id;
        document.getElementById('sellerNameField').value = seller.name;
        document.getElementById('sellerPhoneField').value = seller.phone;
    }
    else {
        if (title)
            title.textContent = 'Thêm người bán hàng';
        document.getElementById('sellerIdField').value = '';
    }
    modal.classList.add('show');
}
function closeSellerModal() {
    var _a;
    (_a = document.getElementById('sellerModal')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
}
function handleSellerFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('sellerIdField').value;
    const name = document.getElementById('sellerNameField').value.trim();
    const phone = document.getElementById('sellerPhoneField').value.trim();
    if (!name) {
        showToast('Vui lòng nhập tên người bán hàng.', 'error');
        return;
    }
    if (id) {
        const seller = getSeller(id);
        if (seller) {
            seller.name = name;
            seller.phone = phone;
        }
        showToast(`Đã cập nhật "${name}".`);
    }
    else {
        sellers.push({ id: `s${Date.now()}`, name, phone });
        showToast(`Đã thêm người bán hàng "${name}".`);
    }
    persistSellers();
    closeSellerModal();
    populateSellerFilter();
    renderAll();
}
function deleteSeller(sellerId) {
    var _a;
    const inUse = orders.some((o) => o.sellerId === sellerId);
    if (inUse) {
        showToast('Không thể xoá — người bán này đang gắn với đơn hàng.', 'error');
        return;
    }
    const seller = getSeller(sellerId);
    if (!confirm(`Xoá người bán hàng "${(_a = seller === null || seller === void 0 ? void 0 : seller.name) !== null && _a !== void 0 ? _a : ''}"?`))
        return;
    sellers = sellers.filter((s) => s.id !== sellerId);
    persistSellers();
    showToast('Đã xoá người bán hàng.');
    populateSellerFilter();
    renderAll();
}
// ===================== CSV export =====================
function exportOrdersCSV() {
    const rows = getRows(currentRange);
    const header = ['Mã đơn', 'Ngày', 'Khách hàng', 'Người bán', 'Sản phẩm', 'Danh mục', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Trạng thái', 'Thanh toán'];
    const lines = [header.join(',')];
    for (const r of rows) {
        const fields = [
            r.id,
            formatDateVN(r.date),
            `"${r.customerName.replace(/"/g, '""')}"`,
            `"${r.sellerName.replace(/"/g, '""')}"`,
            `"${r.productName.replace(/"/g, '""')}"`,
            r.category,
            String(r.quantity),
            String(r.unitPrice),
            String(r.total),
            STATUS_LABEL[r.status],
            PAYMENT_LABEL[r.payment],
        ];
        lines.push(fields.join(','));
    }
    const csv = '﻿' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thubee-farmery-doanhthu-${currentRange.from}-${currentRange.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã xuất file CSV.');
}
// ===================== Init =====================
function bindEvents() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    (_a = document.getElementById('loginForm')) === null || _a === void 0 ? void 0 : _a.addEventListener('submit', handleLoginSubmit);
    (_b = document.getElementById('logoutBtn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', handleLogout);
    document.querySelectorAll('.nav-item').forEach((el) => {
        el.addEventListener('click', () => {
            const tab = el.dataset.tab;
            if (tab)
                switchTab(tab);
        });
    });
    document.querySelectorAll('.range-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (preset)
                setRangePreset(preset);
        });
    });
    (_c = document.getElementById('applyCustomRange')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', applyCustomRange);
    (_d = document.getElementById('addOrderBtn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => openOrderModal());
    (_e = document.getElementById('orderForm')) === null || _e === void 0 ? void 0 : _e.addEventListener('submit', handleOrderFormSubmit);
    (_f = document.getElementById('closeOrderModal')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', closeOrderModal);
    (_g = document.getElementById('cancelOrderModal')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', closeOrderModal);
    (_h = document.getElementById('orderModal')) === null || _h === void 0 ? void 0 : _h.addEventListener('click', (e) => {
        if (e.target === e.currentTarget)
            closeOrderModal();
    });
    (_j = document.getElementById('addProductBtn')) === null || _j === void 0 ? void 0 : _j.addEventListener('click', () => openProductModal());
    (_k = document.getElementById('productForm')) === null || _k === void 0 ? void 0 : _k.addEventListener('submit', handleProductFormSubmit);
    (_l = document.getElementById('closeProductModal')) === null || _l === void 0 ? void 0 : _l.addEventListener('click', closeProductModal);
    (_m = document.getElementById('cancelProductModal')) === null || _m === void 0 ? void 0 : _m.addEventListener('click', closeProductModal);
    (_o = document.getElementById('productModal')) === null || _o === void 0 ? void 0 : _o.addEventListener('click', (e) => {
        if (e.target === e.currentTarget)
            closeProductModal();
    });
    (_p = document.getElementById('addSellerBtn')) === null || _p === void 0 ? void 0 : _p.addEventListener('click', () => openSellerModal());
    (_q = document.getElementById('sellerForm')) === null || _q === void 0 ? void 0 : _q.addEventListener('submit', handleSellerFormSubmit);
    (_r = document.getElementById('closeSellerModal')) === null || _r === void 0 ? void 0 : _r.addEventListener('click', closeSellerModal);
    (_s = document.getElementById('cancelSellerModal')) === null || _s === void 0 ? void 0 : _s.addEventListener('click', closeSellerModal);
    (_t = document.getElementById('sellerModal')) === null || _t === void 0 ? void 0 : _t.addEventListener('click', (e) => {
        if (e.target === e.currentTarget)
            closeSellerModal();
    });
    (_u = document.getElementById('exportCsvBtn')) === null || _u === void 0 ? void 0 : _u.addEventListener('click', exportOrdersCSV);
    const searchInput = document.getElementById('orderSearchInput');
    searchInput === null || searchInput === void 0 ? void 0 : searchInput.addEventListener('input', () => {
        orderSearchText = searchInput.value;
        renderOrdersCards(getRows(currentRange));
    });
    const statusFilter = document.getElementById('orderStatusFilter');
    statusFilter === null || statusFilter === void 0 ? void 0 : statusFilter.addEventListener('change', () => {
        orderStatusFilter = statusFilter.value;
        renderOrdersCards(getRows(currentRange));
    });
    const categoryFilter = document.getElementById('orderCategoryFilter');
    categoryFilter === null || categoryFilter === void 0 ? void 0 : categoryFilter.addEventListener('change', () => {
        orderCategoryFilter = categoryFilter.value;
        renderOrdersCards(getRows(currentRange));
    });
    const sellerFilter = document.getElementById('orderSellerFilter');
    sellerFilter === null || sellerFilter === void 0 ? void 0 : sellerFilter.addEventListener('change', () => {
        orderSellerFilter = sellerFilter.value;
        renderOrdersCards(getRows(currentRange));
    });
    window.addEventListener('resize', () => {
        renderRevenueChart(getRows(currentRange));
        renderCategoryDonut(getRows(currentRange));
    });
}
async function init() {
    await loadState();
    populateCategoryFilter();
    populateSellerFilter();
    currentRange = rangeForPreset(currentPreset);
    bindEvents();
    if (hasValidSession()) {
        showApp();
    }
    else {
        showLogin();
    }
}
document.addEventListener('DOMContentLoaded', () => {
    init();
});
// expose handlers used via inline onclick in card actions
window.openOrderModal = openOrderModal;
window.deleteOrder = deleteOrder;
window.openProductModal = openProductModal;
window.deleteProduct = deleteProduct;
window.openSellerModal = openSellerModal;
window.deleteSeller = deleteSeller;
