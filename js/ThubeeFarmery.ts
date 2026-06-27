/**
 * Thubee Farmery — Quản lý Doanh thu
 * Thiết kế riêng cho iPhone 14 Pro Max — không hỗ trợ desktop.
 * Đăng nhập là client-side password gate (không có backend) — chỉ ngăn người xem thường, không chống người cố tình đọc source.
 * Đổi mật khẩu: mở Console, gọi `ThubeeAuth.hashPassword("user","pass")` rồi thay AUTH_PASSWORD_HASH + AUTH_USERNAME.
 * Dữ liệu: json/*.json là dữ liệu khởi tạo (seed) + nguồn combobox; mọi thêm/sửa/xoá lưu vào localStorage của trình duyệt
 * (không đồng bộ nhiều thiết bị, không ghi ngược lại file json — đây là giới hạn của site tĩnh không backend).
 */

// ===================== Types =====================

type OrderStatus = 'completed' | 'pending' | 'cancelled';
type PaymentMethod = 'cash' | 'transfer' | 'cod';
type RangePreset = '7d' | '30d' | '90d' | '180d' | 'all' | 'custom';
type TabId = 'overview' | 'orders' | 'products' | 'customers' | 'sellers';

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Seller {
  id: string;
  name: string;
  phone: string;
}

interface Order {
  id: string;
  date: string; // ISO yyyy-mm-dd
  customerId: string;
  sellerId: string; // '' = chưa gán
  productId: string;
  quantity: number;
  status: OrderStatus;
  payment: PaymentMethod;
}

interface OrderRow extends Order {
  productName: string;
  category: string;
  unitPrice: number;
  total: number;
  cost: number;
  profit: number;
  customerName: string;
  sellerName: string;
}

interface DateRange {
  from: string;
  to: string;
}

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

const STATUS_LABEL: Record<OrderStatus, string> = {
  completed: 'Hoàn thành',
  pending: 'Đang xử lý',
  cancelled: 'Đã hủy',
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  cod: 'COD',
};

const CATEGORY_COLOR: Record<string, string> = {
  'Mật ong': '#c5963a',
  'Trái cây sấy': '#df7a35',
  'Rau củ organic': '#6f9c3c',
  'Trà thảo mộc': '#8a5a3a',
  'Nông sản tươi': '#2b4424',
};

// Dùng khi fetch json/products.json thất bại (ví dụ mở file trực tiếp bằng file://), để app vẫn dùng được.
const FALLBACK_PRODUCTS: Product[] = [
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

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ThubeeAuth = {
  async hashPassword(username: string, password: string): Promise<string> {
    const hash = await sha256Hex(`${AUTH_SALT}:${username}:${password}`);
    console.log('AUTH_PASSWORD_HASH =', hash);
    return hash;
  },
};
(window as any).ThubeeAuth = ThubeeAuth;

function hasValidSession(): boolean {
  const raw = sessionStorage.getItem(STORAGE_SESSION);
  if (!raw) return false;
  try {
    const session = JSON.parse(raw) as { user: string; ts: number };
    return session.user === AUTH_USERNAME && typeof session.ts === 'number';
  } catch {
    return false;
  }
}

function setLoginError(message: string): void {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('show', Boolean(message));
}

async function handleLoginSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const now = Date.now();
  if (now < lockedUntil) {
    const secs = Math.ceil((lockedUntil - now) / 1000);
    setLoginError(`Đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${secs}s.`);
    return;
  }

  const usernameInput = document.getElementById('loginUsername') as HTMLInputElement | null;
  const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
  const submitBtn = document.getElementById('loginSubmitBtn') as HTMLButtonElement | null;
  if (!usernameInput || !passwordInput) return;

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
  } else {
    failedAttempts += 1;
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_MS;
      setLoginError(`Sai tài khoản hoặc mật khẩu. Tạm khoá đăng nhập ${LOCKOUT_MS / 1000}s.`);
    } else {
      setLoginError(`Sai tài khoản hoặc mật khẩu. (${failedAttempts}/${MAX_ATTEMPTS} lần)`);
    }
    passwordInput.value = '';
  }
}

function handleLogout(): void {
  sessionStorage.removeItem(STORAGE_SESSION);
  const usernameInput = document.getElementById('loginUsername') as HTMLInputElement | null;
  const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  setLoginError('');
  showLogin();
}

function showApp(): void {
  document.getElementById('loadingScreen')?.remove();
  document.getElementById('authScreen')?.classList.remove('visible');
  document.getElementById('appShell')?.classList.add('visible');
  renderAll();
}

function showLogin(): void {
  document.getElementById('loadingScreen')?.remove();
  document.getElementById('appShell')?.classList.remove('visible');
  document.getElementById('authScreen')?.classList.add('visible');
}

// ===================== Data loading =====================

let products: Product[] = [];
let customers: Customer[] = [];
let sellers: Seller[] = [];
let orders: Order[] = [];

async function loadEntity<T>(storageKey: string, jsonPath: string, fallback: T): Promise<T> {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored) as T;
    } catch {
      // fall through to re-seed
    }
  }
  try {
    const res = await fetch(jsonPath);
    if (!res.ok) throw new Error(`fetch ${jsonPath} failed`);
    const data = (await res.json()) as T;
    localStorage.setItem(storageKey, JSON.stringify(data));
    return data;
  } catch {
    localStorage.setItem(storageKey, JSON.stringify(fallback));
    return fallback;
  }
}

async function loadState(): Promise<void> {
  [products, customers, sellers, orders] = await Promise.all([
    loadEntity<Product[]>(STORAGE_PRODUCTS, JSON_PATHS.products, FALLBACK_PRODUCTS),
    loadEntity<Customer[]>(STORAGE_CUSTOMERS, JSON_PATHS.customers, []),
    loadEntity<Seller[]>(STORAGE_SELLERS, JSON_PATHS.sellers, []),
    loadEntity<Order[]>(STORAGE_ORDERS, JSON_PATHS.orders, []),
  ]);
}

function persistProducts(): void {
  localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
}
function persistCustomers(): void {
  localStorage.setItem(STORAGE_CUSTOMERS, JSON.stringify(customers));
}
function persistSellers(): void {
  localStorage.setItem(STORAGE_SELLERS, JSON.stringify(sellers));
}
function persistOrders(): void {
  localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
}

// ===================== Formatting =====================

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

function formatDateVN(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===================== Lookup helpers =====================

function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
function getCustomer(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}
function getSeller(id: string): Seller | undefined {
  return sellers.find((s) => s.id === id);
}

function resolveCustomerId(name: string): string {
  const trimmed = name.trim();
  const existing = customers.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const created: Customer = { id: `c${Date.now()}`, name: trimmed, phone: '' };
  customers.push(created);
  persistCustomers();
  return created.id;
}

function toRow(order: Order): OrderRow | null {
  const product = getProduct(order.productId);
  if (!product) return null;
  const customer = getCustomer(order.customerId);
  const seller = order.sellerId ? getSeller(order.sellerId) : undefined;
  const unitPrice = product.price;
  const total = unitPrice * order.quantity;
  const cost = product.cost * order.quantity;
  return {
    ...order,
    productName: product.name,
    category: product.category,
    unitPrice,
    total,
    cost,
    profit: total - cost,
    customerName: customer ? customer.name : '(Khách lẻ)',
    sellerName: seller ? seller.name : '',
  };
}

// ===================== Date range =====================

function rangeForPreset(preset: RangePreset, customFrom?: string, customTo?: string): DateRange {
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

function previousRange(range: DateRange): DateRange {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { from: toISODate(prevFrom), to: toISODate(prevTo) };
}

function inRange(dateIso: string, range: DateRange): boolean {
  return dateIso >= range.from && dateIso <= range.to;
}

function getRows(range: DateRange): OrderRow[] {
  const rows: OrderRow[] = [];
  for (const order of orders) {
    if (!inRange(order.date, range)) continue;
    const row = toRow(order);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ===================== State =====================

let currentRange: DateRange = { from: '', to: '' };
let currentPreset: RangePreset = '30d';
let orderSearchText = '';
let orderStatusFilter = '';
let orderCategoryFilter = '';
let orderSellerFilter = '';
let editingOrderId: string | null = null;

// ===================== KPIs =====================

function computeKPIs(rows: OrderRow[]): { revenue: number; orderCount: number; profit: number; aov: number } {
  const valid = rows.filter((r) => r.status !== 'cancelled');
  const revenue = valid.reduce((sum, r) => sum + r.total, 0);
  const profit = valid.reduce((sum, r) => sum + r.profit, 0);
  const orderCount = valid.length;
  const aov = orderCount > 0 ? revenue / orderCount : 0;
  return { revenue, orderCount, profit, aov };
}

function deltaPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderDelta(elId: string, delta: number): void {
  const el = document.getElementById(elId);
  if (!el) return;
  const up = delta >= 0;
  el.className = `kpi-delta ${up ? 'up' : 'down'}`;
  el.innerHTML = `<span>${up ? '▲' : '▼'}</span> ${Math.abs(delta).toFixed(1)}% so với kỳ trước`;
}

function renderKPIs(rows: OrderRow[]): void {
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

// ===================== Canvas chart: revenue trend =====================

interface ChartPoint {
  label: string;
  value: number;
}

function setupHiDPICanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function buildRevenueTrend(rows: OrderRow[], range: DateRange): ChartPoint[] {
  const valid = rows.filter((r) => r.status !== 'cancelled');
  const from = new Date(range.from);
  const to = new Date(range.to);
  const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const byDay = new Map<string, number>();
  for (const row of valid) {
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.total);
  }

  if (totalDays <= 60) {
    const points: ChartPoint[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const iso = toISODate(d);
      points.push({ label: formatDateShort(iso), value: byDay.get(iso) ?? 0 });
    }
    return points;
  }

  const points: ChartPoint[] = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      if (d > to) break;
      sum += byDay.get(toISODate(d)) ?? 0;
    }
    points.push({ label: formatDateShort(toISODate(cursor)), value: sum });
    cursor.setDate(cursor.getDate() + 7);
  }
  return points;
}

function formatCompactNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

function setupChartTooltip(canvas: HTMLCanvasElement, coords: { x: number; y: number }[], points: ChartPoint[]): void {
  const tooltip = document.getElementById('chartTooltip');
  if (!tooltip) return;

  const handleMove = (e: MouseEvent) => {
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
    if (!point) return;
    tooltip.style.display = 'block';
    tooltip.style.left = `${rect.left + coord.x}px`;
    tooltip.style.top = `${rect.top + coord.y - 10}px`;
    tooltip.innerHTML = `<strong>${point.label}</strong><br>${formatCurrency(point.value)}`;
  };
  const handleLeave = () => {
    tooltip.style.display = 'none';
  };

  canvas.ontouchstart = (e) => handleMove(e.touches[0] as unknown as MouseEvent);
  canvas.ontouchmove = (e) => {
    e.preventDefault();
    handleMove(e.touches[0] as unknown as MouseEvent);
  };
  canvas.ontouchend = handleLeave;
  canvas.onmousemove = handleMove;
  canvas.onmouseleave = handleLeave;
}

function drawLineChart(canvas: HTMLCanvasElement, points: ChartPoint[]): void {
  const ctx = setupHiDPICanvas(canvas);
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (w < 40 || h < 40) return;

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

  if (points.length === 0) return;

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

function renderRevenueChart(rows: OrderRow[]): void {
  const canvas = document.getElementById('revenueChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  drawLineChart(canvas, buildRevenueTrend(rows, currentRange));
}

// ===================== Canvas chart: category donut =====================

function renderCategoryDonut(rows: OrderRow[]): void {
  const canvas = document.getElementById('categoryDonut') as HTMLCanvasElement | null;
  const legendEl = document.getElementById('categoryLegend');
  if (!canvas || !legendEl) return;

  const valid = rows.filter((r) => r.status !== 'cancelled');
  const totals = new Map<string, number>();
  for (const row of valid) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.total);
  }
  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const segments = Array.from(totals.entries())
    .map(([category, value]) => ({ category, value, color: CATEGORY_COLOR[category] ?? '#999' }))
    .sort((a, b) => b.value - a.value);

  const ctx = setupHiDPICanvas(canvas);
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (w < 16 || h < 16) return;

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
  } else {
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

function renderTopProducts(rows: OrderRow[]): void {
  const container = document.getElementById('topProductsList');
  if (!container) return;
  const valid = rows.filter((r) => r.status !== 'cancelled');
  const totals = new Map<string, { name: string; value: number; qty: number; category: string }>();
  for (const row of valid) {
    const existing = totals.get(row.productId);
    if (existing) {
      existing.value += row.total;
      existing.qty += row.quantity;
    } else {
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
      const pct = (item.value / maxVal) * 100;
      const color = CATEGORY_COLOR[item.category] ?? '#999';
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

function renderOrdersCards(rows: OrderRow[]): void {
  const container = document.getElementById('ordersList');
  if (!container) return;

  let filtered = rows;
  if (orderSearchText) {
    const q = orderSearchText.toLowerCase();
    filtered = filtered.filter((r) => r.customerName.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }
  if (orderStatusFilter) filtered = filtered.filter((r) => r.status === orderStatusFilter);
  if (orderCategoryFilter) filtered = filtered.filter((r) => r.category === orderCategoryFilter);
  if (orderSellerFilter) filtered = filtered.filter((r) => r.sellerId === orderSellerFilter);

  setText('ordersCount', `${filtered.length} đơn hàng`);

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-hint">Không tìm thấy đơn hàng phù hợp.</p>';
    return;
  }

  container.innerHTML = filtered
    .map(
      (r) => `<div class="data-card">
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
      </div>`
    )
    .join('');
}

function renderProductsCards(rows: OrderRow[]): void {
  const container = document.getElementById('productsList');
  if (!container) return;
  const valid = rows.filter((r) => r.status !== 'cancelled');
  const soldMap = new Map<string, { qty: number; revenue: number }>();
  for (const row of valid) {
    const existing = soldMap.get(row.productId);
    if (existing) {
      existing.qty += row.quantity;
      existing.revenue += row.total;
    } else {
      soldMap.set(row.productId, { qty: row.quantity, revenue: row.total });
    }
  }

  const sorted = products.slice().sort((a, b) => (soldMap.get(b.id)?.revenue ?? 0) - (soldMap.get(a.id)?.revenue ?? 0));

  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-hint">Chưa có sản phẩm nào. Bấm "+ Thêm sản phẩm" để bắt đầu.</p>';
    return;
  }

  container.innerHTML = sorted
    .map((p) => {
      const sold = soldMap.get(p.id) ?? { qty: 0, revenue: 0 };
      const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : '0';
      const lowStock = p.stock <= 20;
      return `<div class="data-card">
        <div class="data-card-top">
          <span class="data-card-title" style="margin:0">${escapeHtml(p.name)}</span>
          <span class="tag-pill" style="background:${CATEGORY_COLOR[p.category] ?? '#999'}1a;color:${CATEGORY_COLOR[p.category] ?? '#999'}">${escapeHtml(p.category)}</span>
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

function renderCustomersCards(rows: OrderRow[]): void {
  const container = document.getElementById('customersList');
  if (!container) return;
  const valid = rows.filter((r) => r.status !== 'cancelled');
  const map = new Map<string, { name: string; orders: number; revenue: number; lastDate: string }>();
  for (const row of valid) {
    const existing = map.get(row.customerId);
    if (existing) {
      existing.orders += 1;
      existing.revenue += row.total;
      if (row.date > existing.lastDate) existing.lastDate = row.date;
    } else {
      map.set(row.customerId, { name: row.customerName, orders: 1, revenue: row.total, lastDate: row.date });
    }
  }
  const sorted = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);

  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-hint">Chưa có khách hàng trong khoảng thời gian này.</p>';
    return;
  }

  container.innerHTML = sorted
    .map(
      (c, idx) => `<div class="data-card">
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
      </div>`
    )
    .join('');
}

function renderSellersCards(rows: OrderRow[]): void {
  const container = document.getElementById('sellersList');
  if (!container) return;
  const valid = rows.filter((r) => r.status !== 'cancelled' && r.sellerId);
  const statsMap = new Map<string, { orders: number; revenue: number }>();
  for (const row of valid) {
    const existing = statsMap.get(row.sellerId);
    if (existing) {
      existing.orders += 1;
      existing.revenue += row.total;
    } else {
      statsMap.set(row.sellerId, { orders: 1, revenue: row.total });
    }
  }

  const sorted = sellers.slice().sort((a, b) => (statsMap.get(b.id)?.revenue ?? 0) - (statsMap.get(a.id)?.revenue ?? 0));

  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-hint">Chưa có người bán hàng nào. Bấm "+ Thêm người bán" để bắt đầu.</p>';
    return;
  }

  container.innerHTML = sorted
    .map((s, idx) => {
      const stat = statsMap.get(s.id) ?? { orders: 0, revenue: 0 };
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

function populateCategoryFilter(): void {
  const select = document.getElementById('orderCategoryFilter') as HTMLSelectElement | null;
  if (!select) return;
  const categories = Array.from(new Set(products.map((p) => p.category)));
  select.innerHTML = '<option value="">Tất cả danh mục</option>' + categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function populateSellerFilter(): void {
  const select = document.getElementById('orderSellerFilter') as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = '<option value="">Tất cả người bán</option>' + sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

function populateCustomerDatalist(): void {
  const list = document.getElementById('customerDatalist');
  if (!list) return;
  list.innerHTML = customers.map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join('');
}

function populateSellerSelect(): void {
  const select = document.getElementById('orderSellerSelect') as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = '<option value="">— Không chọn —</option>' + sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

function populateProductSelect(): void {
  const select = document.getElementById('orderProductSelect') as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${formatCurrency(p.price)}</option>`).join('');
}

// ===================== Master render =====================

function renderAll(): void {
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

function renderRangeLabel(): void {
  setText('rangeLabel', `${formatDateVN(currentRange.from)} — ${formatDateVN(currentRange.to)}`);
}

// ===================== Range controls =====================

function setRangePreset(preset: RangePreset): void {
  currentPreset = preset;
  currentRange = rangeForPreset(preset);
  document.querySelectorAll('.range-btn').forEach((btn) => btn.classList.toggle('active', (btn as HTMLElement).dataset.preset === preset));
  document.getElementById('customRangeRow')?.classList.toggle('show', preset === 'custom');
  renderAll();
}

function applyCustomRange(): void {
  const fromInput = document.getElementById('customFrom') as HTMLInputElement | null;
  const toInput = document.getElementById('customTo') as HTMLInputElement | null;
  if (!fromInput?.value || !toInput?.value) {
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

function switchTab(tabId: string): void {
  document.querySelectorAll('.tab-panel').forEach((el) => el.classList.toggle('active', el.id === `tab-${tabId}`));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', (el as HTMLElement).dataset.tab === tabId));
  if (tabId === 'overview') {
    requestAnimationFrame(() => renderAll());
  }
}

// ===================== Toasts =====================

function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-out'), 2400);
  setTimeout(() => toast.remove(), 2800);
}

// ===================== Order modal =====================

function openOrderModal(orderId?: string): void {
  editingOrderId = orderId ?? null;
  const modal = document.getElementById('orderModal');
  const title = document.getElementById('orderModalTitle');
  const form = document.getElementById('orderForm') as HTMLFormElement | null;
  if (!modal || !form) return;

  populateProductSelect();
  populateSellerSelect();
  populateCustomerDatalist();
  form.reset();

  if (orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (title) title.textContent = `Sửa đơn hàng ${order.id}`;
    const customer = getCustomer(order.customerId);
    (document.getElementById('orderCustomer') as HTMLInputElement).value = customer ? customer.name : '';
    (document.getElementById('orderDate') as HTMLInputElement).value = order.date;
    (document.getElementById('orderProductSelect') as HTMLSelectElement).value = order.productId;
    (document.getElementById('orderQuantity') as HTMLInputElement).value = String(order.quantity);
    (document.getElementById('orderStatusSelect') as HTMLSelectElement).value = order.status;
    (document.getElementById('orderPaymentSelect') as HTMLSelectElement).value = order.payment;
    (document.getElementById('orderSellerSelect') as HTMLSelectElement).value = order.sellerId;
  } else {
    if (title) title.textContent = 'Thêm đơn hàng mới';
    (document.getElementById('orderDate') as HTMLInputElement).value = toISODate(new Date());
    (document.getElementById('orderQuantity') as HTMLInputElement).value = '1';
  }

  modal.classList.add('show');
}

function closeOrderModal(): void {
  document.getElementById('orderModal')?.classList.remove('show');
  editingOrderId = null;
}

function handleOrderFormSubmit(e: Event): void {
  e.preventDefault();
  const customerName = (document.getElementById('orderCustomer') as HTMLInputElement).value.trim();
  const date = (document.getElementById('orderDate') as HTMLInputElement).value;
  const productId = (document.getElementById('orderProductSelect') as HTMLSelectElement).value;
  const quantity = parseInt((document.getElementById('orderQuantity') as HTMLInputElement).value, 10);
  const status = (document.getElementById('orderStatusSelect') as HTMLSelectElement).value as OrderStatus;
  const payment = (document.getElementById('orderPaymentSelect') as HTMLSelectElement).value as PaymentMethod;
  const sellerId = (document.getElementById('orderSellerSelect') as HTMLSelectElement).value;

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
  } else {
    const nextId = `DH${String(orders.length + 1).padStart(4, '0')}`;
    orders.push({ id: nextId, customerId, date, productId, quantity, status, payment, sellerId });
    showToast(`Đã thêm đơn hàng ${nextId}.`);
  }

  persistOrders();
  closeOrderModal();
  populateCustomerDatalist();
  renderAll();
}

function deleteOrder(orderId: string): void {
  if (!confirm(`Xoá đơn hàng ${orderId}? Hành động này không thể hoàn tác.`)) return;
  orders = orders.filter((o) => o.id !== orderId);
  persistOrders();
  showToast(`Đã xoá đơn hàng ${orderId}.`);
  renderAll();
}

// ===================== Product modal =====================

function openProductModal(productId?: string): void {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');
  const form = document.getElementById('productForm') as HTMLFormElement | null;
  if (!modal || !form) return;
  form.reset();

  if (productId) {
    const product = getProduct(productId);
    if (!product) return;
    if (title) title.textContent = 'Sửa sản phẩm';
    (document.getElementById('productIdField') as HTMLInputElement).value = product.id;
    (document.getElementById('productNameField') as HTMLInputElement).value = product.name;
    (document.getElementById('productCategoryField') as HTMLInputElement).value = product.category;
    (document.getElementById('productUnitField') as HTMLInputElement).value = product.unit;
    (document.getElementById('productPriceField') as HTMLInputElement).value = String(product.price);
    (document.getElementById('productCostField') as HTMLInputElement).value = String(product.cost);
    (document.getElementById('productStockField') as HTMLInputElement).value = String(product.stock);
  } else {
    if (title) title.textContent = 'Thêm sản phẩm mới';
    (document.getElementById('productIdField') as HTMLInputElement).value = '';
  }

  modal.classList.add('show');
}

function closeProductModal(): void {
  document.getElementById('productModal')?.classList.remove('show');
}

function handleProductFormSubmit(e: Event): void {
  e.preventDefault();
  const id = (document.getElementById('productIdField') as HTMLInputElement).value;
  const name = (document.getElementById('productNameField') as HTMLInputElement).value.trim();
  const category = (document.getElementById('productCategoryField') as HTMLInputElement).value.trim();
  const unit = (document.getElementById('productUnitField') as HTMLInputElement).value.trim();
  const price = parseFloat((document.getElementById('productPriceField') as HTMLInputElement).value);
  const cost = parseFloat((document.getElementById('productCostField') as HTMLInputElement).value);
  const stock = parseInt((document.getElementById('productStockField') as HTMLInputElement).value, 10);

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
  } else {
    products.push({ id: `p${Date.now()}`, name, category, unit, price, cost, stock });
    showToast(`Đã thêm sản phẩm "${name}".`);
  }

  persistProducts();
  closeProductModal();
  populateCategoryFilter();
  renderAll();
}

function deleteProduct(productId: string): void {
  const inUse = orders.some((o) => o.productId === productId);
  if (inUse) {
    showToast('Không thể xoá — sản phẩm đang có trong đơn hàng.', 'error');
    return;
  }
  const product = getProduct(productId);
  if (!confirm(`Xoá sản phẩm "${product?.name ?? ''}"?`)) return;
  products = products.filter((p) => p.id !== productId);
  persistProducts();
  showToast('Đã xoá sản phẩm.');
  populateCategoryFilter();
  renderAll();
}

// ===================== Seller modal =====================

function openSellerModal(sellerId?: string): void {
  const modal = document.getElementById('sellerModal');
  const title = document.getElementById('sellerModalTitle');
  const form = document.getElementById('sellerForm') as HTMLFormElement | null;
  if (!modal || !form) return;
  form.reset();

  if (sellerId) {
    const seller = getSeller(sellerId);
    if (!seller) return;
    if (title) title.textContent = 'Sửa người bán hàng';
    (document.getElementById('sellerIdField') as HTMLInputElement).value = seller.id;
    (document.getElementById('sellerNameField') as HTMLInputElement).value = seller.name;
    (document.getElementById('sellerPhoneField') as HTMLInputElement).value = seller.phone;
  } else {
    if (title) title.textContent = 'Thêm người bán hàng';
    (document.getElementById('sellerIdField') as HTMLInputElement).value = '';
  }

  modal.classList.add('show');
}

function closeSellerModal(): void {
  document.getElementById('sellerModal')?.classList.remove('show');
}

function handleSellerFormSubmit(e: Event): void {
  e.preventDefault();
  const id = (document.getElementById('sellerIdField') as HTMLInputElement).value;
  const name = (document.getElementById('sellerNameField') as HTMLInputElement).value.trim();
  const phone = (document.getElementById('sellerPhoneField') as HTMLInputElement).value.trim();

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
  } else {
    sellers.push({ id: `s${Date.now()}`, name, phone });
    showToast(`Đã thêm người bán hàng "${name}".`);
  }

  persistSellers();
  closeSellerModal();
  populateSellerFilter();
  renderAll();
}

function deleteSeller(sellerId: string): void {
  const inUse = orders.some((o) => o.sellerId === sellerId);
  if (inUse) {
    showToast('Không thể xoá — người bán này đang gắn với đơn hàng.', 'error');
    return;
  }
  const seller = getSeller(sellerId);
  if (!confirm(`Xoá người bán hàng "${seller?.name ?? ''}"?`)) return;
  sellers = sellers.filter((s) => s.id !== sellerId);
  persistSellers();
  showToast('Đã xoá người bán hàng.');
  populateSellerFilter();
  renderAll();
}

// ===================== CSV export =====================

function exportOrdersCSV(): void {
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

function bindEvents(): void {
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.addEventListener('click', () => {
      const tab = (el as HTMLElement).dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  document.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = (btn as HTMLElement).dataset.preset as RangePreset;
      if (preset) setRangePreset(preset);
    });
  });
  document.getElementById('applyCustomRange')?.addEventListener('click', applyCustomRange);

  document.getElementById('addOrderBtn')?.addEventListener('click', () => openOrderModal());
  document.getElementById('orderForm')?.addEventListener('submit', handleOrderFormSubmit);
  document.getElementById('closeOrderModal')?.addEventListener('click', closeOrderModal);
  document.getElementById('cancelOrderModal')?.addEventListener('click', closeOrderModal);
  document.getElementById('orderModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeOrderModal();
  });

  document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
  document.getElementById('productForm')?.addEventListener('submit', handleProductFormSubmit);
  document.getElementById('closeProductModal')?.addEventListener('click', closeProductModal);
  document.getElementById('cancelProductModal')?.addEventListener('click', closeProductModal);
  document.getElementById('productModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  document.getElementById('addSellerBtn')?.addEventListener('click', () => openSellerModal());
  document.getElementById('sellerForm')?.addEventListener('submit', handleSellerFormSubmit);
  document.getElementById('closeSellerModal')?.addEventListener('click', closeSellerModal);
  document.getElementById('cancelSellerModal')?.addEventListener('click', closeSellerModal);
  document.getElementById('sellerModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSellerModal();
  });

  document.getElementById('exportCsvBtn')?.addEventListener('click', exportOrdersCSV);

  const searchInput = document.getElementById('orderSearchInput') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    orderSearchText = searchInput.value;
    renderOrdersCards(getRows(currentRange));
  });

  const statusFilter = document.getElementById('orderStatusFilter') as HTMLSelectElement | null;
  statusFilter?.addEventListener('change', () => {
    orderStatusFilter = statusFilter.value;
    renderOrdersCards(getRows(currentRange));
  });

  const categoryFilter = document.getElementById('orderCategoryFilter') as HTMLSelectElement | null;
  categoryFilter?.addEventListener('change', () => {
    orderCategoryFilter = categoryFilter.value;
    renderOrdersCards(getRows(currentRange));
  });

  const sellerFilter = document.getElementById('orderSellerFilter') as HTMLSelectElement | null;
  sellerFilter?.addEventListener('change', () => {
    orderSellerFilter = sellerFilter.value;
    renderOrdersCards(getRows(currentRange));
  });

  window.addEventListener('resize', () => {
    renderRevenueChart(getRows(currentRange));
    renderCategoryDonut(getRows(currentRange));
  });
}

async function init(): Promise<void> {
  await loadState();
  populateCategoryFilter();
  populateSellerFilter();
  currentRange = rangeForPreset(currentPreset);
  bindEvents();

  if (hasValidSession()) {
    showApp();
  } else {
    showLogin();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});

// expose handlers used via inline onclick in card actions
(window as any).openOrderModal = openOrderModal;
(window as any).deleteOrder = deleteOrder;
(window as any).openProductModal = openProductModal;
(window as any).deleteProduct = deleteProduct;
(window as any).openSellerModal = openSellerModal;
(window as any).deleteSeller = deleteSeller;
