/**
 * Thubee Farmery — Quản lý Doanh thu
 * Dashboard nội bộ: yêu cầu đăng nhập (client-side gate), dữ liệu lưu localStorage.
 * Đây KHÔNG phải bảo mật thật (không có backend) — chỉ ngăn người xem thường truy cập.
 * Đổi mật khẩu: mở Console, gọi `ThubeeAuth.hashPassword("user","pass")` rồi thay AUTH_PASSWORD_HASH.
 */

// ===================== Types =====================

type OrderStatus = 'completed' | 'pending' | 'cancelled';
type PaymentMethod = 'cash' | 'transfer' | 'cod';
type RangePreset = '7d' | '30d' | '90d' | '180d' | 'all' | 'custom';

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
}

interface Order {
  id: string;
  date: string; // ISO yyyy-mm-dd
  customer: string;
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
}

interface DateRange {
  from: string;
  to: string;
}

// ===================== Constants =====================

const STORAGE_PRODUCTS = 'thubee_farmery_products';
const STORAGE_ORDERS = 'thubee_farmery_orders';
const STORAGE_SESSION = 'thubee_farmery_session';

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
  'Mật ong': '#e8a33d',
  'Trái cây sấy': '#e8633d',
  'Rau củ organic': '#5a8f3c',
  'Trà thảo mộc': '#3d8f7a',
  'Nông sản tươi': '#8f6a3d',
};

const DEFAULT_PRODUCTS: Product[] = [
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

const CUSTOMER_NAMES: string[] = [
  'Nguyễn Thị Hoa', 'Trần Văn Minh', 'Lê Thị Lan', 'Phạm Văn Hùng', 'Hoàng Thị Mai',
  'Vũ Văn Đức', 'Đặng Thị Thu', 'Bùi Văn Sơn', 'Đỗ Thị Hằng', 'Ngô Văn Tài',
  'Dương Thị Nga', 'Lý Văn Phúc', 'Trịnh Thị Yến', 'Phan Văn Khoa', 'Tô Thị Loan', 'Mai Văn Quân',
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
  document.getElementById('authScreen')?.classList.remove('visible');
  document.getElementById('appShell')?.classList.add('visible');
  renderAll();
}

function showLogin(): void {
  document.getElementById('appShell')?.classList.remove('visible');
  document.getElementById('authScreen')?.classList.add('visible');
}

// ===================== PRNG seed data =====================

function mulberry32(seed: number): () => number {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function generateSeedOrders(products: Product[]): Order[] {
  const rand = mulberry32(20260627);
  const orders: Order[] = [];
  const days = 150;
  const today = new Date();
  let counter = 1;

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const iso = toISODate(date);
    const ordersToday = Math.floor(rand() * 4) + (rand() > 0.5 ? 1 : 0); // 0-4
    for (let j = 0; j < ordersToday; j++) {
      const product = products[Math.floor(rand() * products.length)];
      const customer = CUSTOMER_NAMES[Math.floor(rand() * CUSTOMER_NAMES.length)];
      const quantity = Math.floor(rand() * 4) + 1;
      const statusRoll = rand();
      let status: OrderStatus = 'completed';
      if (i <= 7 && statusRoll > 0.7) status = 'pending';
      else if (statusRoll > 0.95) status = 'cancelled';
      const paymentRoll = rand();
      const payment: PaymentMethod = paymentRoll < 0.4 ? 'cash' : paymentRoll < 0.8 ? 'transfer' : 'cod';
      orders.push({
        id: `DH${String(counter).padStart(4, '0')}`,
        date: iso,
        customer,
        productId: product.id,
        quantity,
        status,
        payment,
      });
      counter += 1;
    }
  }
  return orders;
}

// ===================== State =====================

let products: Product[] = [];
let orders: Order[] = [];
let currentRange: DateRange = { from: '', to: '' };
let currentPreset: RangePreset = '30d';
let orderSearchText = '';
let orderStatusFilter = '';
let orderCategoryFilter = '';
let editingOrderId: string | null = null;

function loadState(): void {
  const storedProducts = localStorage.getItem(STORAGE_PRODUCTS);
  if (storedProducts) {
    try {
      products = JSON.parse(storedProducts) as Product[];
    } catch {
      products = DEFAULT_PRODUCTS.slice();
    }
  } else {
    products = DEFAULT_PRODUCTS.slice();
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
  }

  const storedOrders = localStorage.getItem(STORAGE_ORDERS);
  if (storedOrders) {
    try {
      orders = JSON.parse(storedOrders) as Order[];
    } catch {
      orders = generateSeedOrders(products);
    }
  } else {
    orders = generateSeedOrders(products);
    localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
  }
}

function persistProducts(): void {
  localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
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

// ===================== Data helpers =====================

function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

function toRow(order: Order): OrderRow | null {
  const product = getProduct(order.productId);
  if (!product) return null;
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
  };
}

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

function getRows(range: DateRange, opts?: { excludeCancelled?: boolean }): OrderRow[] {
  const rows: OrderRow[] = [];
  for (const order of orders) {
    if (!inRange(order.date, range)) continue;
    if (opts?.excludeCancelled && order.status === 'cancelled') continue;
    const row = toRow(order);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

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
  const prevRows = getRows(prevRange);
  const previous = computeKPIs(prevRows);

  setText('kpiRevenue', formatCurrency(current.revenue));
  setText('kpiOrders', formatNumber(current.orderCount));
  setText('kpiProfit', formatCurrency(current.profit));
  setText('kpiAov', formatCurrency(Math.round(current.aov)));

  renderDelta('kpiRevenueDelta', deltaPercent(current.revenue, previous.revenue));
  renderDelta('kpiOrdersDelta', deltaPercent(current.orderCount, previous.orderCount));
  renderDelta('kpiProfitDelta', deltaPercent(current.profit, previous.profit));
  renderDelta('kpiAovDelta', deltaPercent(current.aov, previous.aov));
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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

let revenueChartPoints: ChartPoint[] = [];

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

  // group by week for longer ranges
  const points: ChartPoint[] = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(cursor.getDate() + 6);
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

function drawLineChart(canvas: HTMLCanvasElement, points: ChartPoint[]): void {
  const ctx = setupHiDPICanvas(canvas);
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (w < 40 || h < 40) return;

  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxVal = Math.max(1, ...points.map((p) => p.value));
  const niceMax = maxVal === 0 ? 10 : Math.ceil(maxVal / Math.pow(10, Math.floor(Math.log10(maxVal)))) * Math.pow(10, Math.floor(Math.log10(maxVal)));

  ctx.font = '11px Inter, sans-serif';
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

  // area fill
  const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  gradient.addColorStop(0, 'rgba(232,163,61,0.32)');
  gradient.addColorStop(1, 'rgba(232,163,61,0.02)');
  ctx.beginPath();
  ctx.moveTo(coords[0].x, padT + plotH);
  coords.forEach((c) => ctx.lineTo(c.x, c.y));
  ctx.lineTo(coords[coords.length - 1].x, padT + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // line
  ctx.beginPath();
  coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
  ctx.strokeStyle = '#e8a33d';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // x labels (sparse)
  ctx.fillStyle = '#8a9a8a';
  ctx.textAlign = 'center';
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  points.forEach((p, i) => {
    if (i % labelEvery === 0 || i === points.length - 1) {
      ctx.fillText(p.label, coords[i].x, h - 8);
    }
  });

  setupChartTooltip(canvas, coords, points, padT, plotH);
}

function formatCompactNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

let chartTooltipBound = false;
function setupChartTooltip(
  canvas: HTMLCanvasElement,
  coords: { x: number; y: number }[],
  points: ChartPoint[],
  padT: number,
  plotH: number
): void {
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

  canvas.onmousemove = handleMove;
  canvas.onmouseleave = handleLeave;
}

function renderRevenueChart(rows: OrderRow[]): void {
  const canvas = document.getElementById('revenueChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  revenueChartPoints = buildRevenueTrend(rows, currentRange);
  drawLineChart(canvas, revenueChartPoints);
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

  ctx.fillStyle = '#2d5016';
  ctx.textAlign = 'center';
  ctx.font = '700 15px Inter, sans-serif';
  ctx.fillText(formatCompactNumber(grandTotal), cx, cy - 2);
  ctx.font = '11px Inter, sans-serif';
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

// ===================== Top products bar list =====================

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
          <span class="rank-name">${item.name}</span>
          <span class="rank-meta">${formatNumber(item.qty)} sản phẩm bán ra</span>
        </div>
        <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="rank-value">${formatCurrency(item.value)}</div>
      </div>`;
    })
    .join('');
}

// ===================== Orders table =====================

function renderOrdersTable(rows: OrderRow[]): void {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  let filtered = rows;
  if (orderSearchText) {
    const q = orderSearchText.toLowerCase();
    filtered = filtered.filter((r) => r.customer.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }
  if (orderStatusFilter) {
    filtered = filtered.filter((r) => r.status === orderStatusFilter);
  }
  if (orderCategoryFilter) {
    filtered = filtered.filter((r) => r.category === orderCategoryFilter);
  }

  setText('ordersCount', `${filtered.length} đơn hàng`);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-hint">Không tìm thấy đơn hàng phù hợp.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (r) => `<tr>
        <td>${r.id}</td>
        <td>${formatDateVN(r.date)}</td>
        <td>${escapeHtml(r.customer)}</td>
        <td>${escapeHtml(r.productName)}</td>
        <td>${r.quantity}</td>
        <td>${formatCurrency(r.unitPrice)}</td>
        <td class="cell-strong">${formatCurrency(r.total)}</td>
        <td><span class="badge badge-${r.status}">${STATUS_LABEL[r.status]}</span></td>
        <td class="cell-actions">
          <button class="icon-btn" title="Sửa" onclick="openOrderModal('${r.id}')">✎</button>
          <button class="icon-btn icon-btn-danger" title="Xoá" onclick="deleteOrder('${r.id}')">🗑</button>
        </td>
      </tr>`
    )
    .join('');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===================== Products tab =====================

function renderProductsTable(rows: OrderRow[]): void {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
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

  tbody.innerHTML = sorted
    .map((p) => {
      const sold = soldMap.get(p.id) ?? { qty: 0, revenue: 0 };
      const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : '0';
      const lowStock = p.stock <= 20;
      return `<tr>
        <td>${escapeHtml(p.name)}</td>
        <td><span class="tag-pill" style="background:${CATEGORY_COLOR[p.category] ?? '#999'}1a;color:${CATEGORY_COLOR[p.category] ?? '#999'}">${p.category}</span></td>
        <td>${formatCurrency(p.price)} / ${p.unit}</td>
        <td>${margin}%</td>
        <td>${formatNumber(sold.qty)}</td>
        <td class="cell-strong">${formatCurrency(sold.revenue)}</td>
        <td class="${lowStock ? 'cell-warning' : ''}">${formatNumber(p.stock)} ${p.unit}${lowStock ? ' ⚠' : ''}</td>
        <td class="cell-actions"><button class="icon-btn" title="Sửa" onclick="openProductModal('${p.id}')">✎</button></td>
      </tr>`;
    })
    .join('');
}

// ===================== Customers tab =====================

function renderCustomersTable(rows: OrderRow[]): void {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;
  const valid = rows.filter((r) => r.status !== 'cancelled');
  const map = new Map<string, { orders: number; revenue: number; lastDate: string }>();
  for (const row of valid) {
    const existing = map.get(row.customer);
    if (existing) {
      existing.orders += 1;
      existing.revenue += row.total;
      if (row.date > existing.lastDate) existing.lastDate = row.date;
    } else {
      map.set(row.customer, { orders: 1, revenue: row.total, lastDate: row.date });
    }
  }
  const sorted = Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue);

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-hint">Chưa có khách hàng trong khoảng thời gian này.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted
    .map(([name, data], idx) => {
      const aov = data.revenue / data.orders;
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(name)}</td>
        <td>${formatNumber(data.orders)}</td>
        <td class="cell-strong">${formatCurrency(data.revenue)}</td>
        <td>${formatDateVN(data.lastDate)}</td>
      </tr>`;
    })
    .join('');
}

// ===================== Filters population =====================

function populateCategoryFilter(): void {
  const select = document.getElementById('orderCategoryFilter') as HTMLSelectElement | null;
  if (!select) return;
  const categories = Array.from(new Set(products.map((p) => p.category)));
  select.innerHTML = '<option value="">Tất cả danh mục</option>' + categories.map((c) => `<option value="${c}">${c}</option>`).join('');
}

// ===================== Master render =====================

function renderAll(): void {
  const rows = getRows(currentRange);
  renderKPIs(rows);
  renderRevenueChart(rows);
  renderCategoryDonut(rows);
  renderTopProducts(rows);
  renderOrdersTable(rows);
  renderProductsTable(rows);
  renderCustomersTable(rows);
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

// ===================== Tabs & sidebar =====================

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

function populateProductSelect(): void {
  const select = document.getElementById('orderProductSelect') as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = products.map((p) => `<option value="${p.id}">${p.name} — ${formatCurrency(p.price)}</option>`).join('');
}

function openOrderModal(orderId?: string): void {
  editingOrderId = orderId ?? null;
  const modal = document.getElementById('orderModal');
  const title = document.getElementById('orderModalTitle');
  const form = document.getElementById('orderForm') as HTMLFormElement | null;
  if (!modal || !form) return;

  populateProductSelect();
  form.reset();

  if (orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (title) title.textContent = `Sửa đơn hàng ${order.id}`;
    (document.getElementById('orderCustomer') as HTMLInputElement).value = order.customer;
    (document.getElementById('orderDate') as HTMLInputElement).value = order.date;
    (document.getElementById('orderProductSelect') as HTMLSelectElement).value = order.productId;
    (document.getElementById('orderQuantity') as HTMLInputElement).value = String(order.quantity);
    (document.getElementById('orderStatusSelect') as HTMLSelectElement).value = order.status;
    (document.getElementById('orderPaymentSelect') as HTMLSelectElement).value = order.payment;
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
  const customer = (document.getElementById('orderCustomer') as HTMLInputElement).value.trim();
  const date = (document.getElementById('orderDate') as HTMLInputElement).value;
  const productId = (document.getElementById('orderProductSelect') as HTMLSelectElement).value;
  const quantity = parseInt((document.getElementById('orderQuantity') as HTMLInputElement).value, 10);
  const status = (document.getElementById('orderStatusSelect') as HTMLSelectElement).value as OrderStatus;
  const payment = (document.getElementById('orderPaymentSelect') as HTMLSelectElement).value as PaymentMethod;

  if (!customer || !date || !productId || !quantity || quantity < 1) {
    showToast('Vui lòng điền đầy đủ thông tin hợp lệ.', 'error');
    return;
  }

  if (editingOrderId) {
    const order = orders.find((o) => o.id === editingOrderId);
    if (order) {
      order.customer = customer;
      order.date = date;
      order.productId = productId;
      order.quantity = quantity;
      order.status = status;
      order.payment = payment;
    }
    showToast(`Đã cập nhật đơn hàng ${editingOrderId}.`);
  } else {
    const nextId = `DH${String(orders.length + 1).padStart(4, '0')}`;
    orders.push({ id: nextId, customer, date, productId, quantity, status, payment });
    showToast(`Đã thêm đơn hàng ${nextId}.`);
  }

  persistOrders();
  closeOrderModal();
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

function openProductModal(productId: string): void {
  const product = getProduct(productId);
  if (!product) return;
  const modal = document.getElementById('productModal');
  if (!modal) return;
  (document.getElementById('productModalName') as HTMLElement).textContent = product.name;
  (document.getElementById('productIdField') as HTMLInputElement).value = product.id;
  (document.getElementById('productPriceField') as HTMLInputElement).value = String(product.price);
  (document.getElementById('productCostField') as HTMLInputElement).value = String(product.cost);
  (document.getElementById('productStockField') as HTMLInputElement).value = String(product.stock);
  modal.classList.add('show');
}

function closeProductModal(): void {
  document.getElementById('productModal')?.classList.remove('show');
}

function handleProductFormSubmit(e: Event): void {
  e.preventDefault();
  const id = (document.getElementById('productIdField') as HTMLInputElement).value;
  const price = parseFloat((document.getElementById('productPriceField') as HTMLInputElement).value);
  const cost = parseFloat((document.getElementById('productCostField') as HTMLInputElement).value);
  const stock = parseInt((document.getElementById('productStockField') as HTMLInputElement).value, 10);

  const product = getProduct(id);
  if (!product || isNaN(price) || isNaN(cost) || isNaN(stock) || price < 0 || cost < 0 || stock < 0) {
    showToast('Vui lòng nhập giá trị hợp lệ.', 'error');
    return;
  }

  product.price = price;
  product.cost = cost;
  product.stock = stock;
  persistProducts();
  closeProductModal();
  showToast(`Đã cập nhật sản phẩm "${product.name}".`);
  renderAll();
}

// ===================== CSV export =====================

function exportOrdersCSV(): void {
  const rows = getRows(currentRange);
  const header = ['Mã đơn', 'Ngày', 'Khách hàng', 'Sản phẩm', 'Danh mục', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Trạng thái', 'Thanh toán'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const fields = [
      r.id,
      formatDateVN(r.date),
      `"${r.customer.replace(/"/g, '""')}"`,
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

  document.getElementById('productForm')?.addEventListener('submit', handleProductFormSubmit);
  document.getElementById('closeProductModal')?.addEventListener('click', closeProductModal);
  document.getElementById('cancelProductModal')?.addEventListener('click', closeProductModal);
  document.getElementById('productModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  document.getElementById('exportCsvBtn')?.addEventListener('click', exportOrdersCSV);

  const searchInput = document.getElementById('orderSearchInput') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    orderSearchText = searchInput.value;
    renderOrdersTable(getRows(currentRange));
  });

  const statusFilter = document.getElementById('orderStatusFilter') as HTMLSelectElement | null;
  statusFilter?.addEventListener('change', () => {
    orderStatusFilter = statusFilter.value;
    renderOrdersTable(getRows(currentRange));
  });

  const categoryFilter = document.getElementById('orderCategoryFilter') as HTMLSelectElement | null;
  categoryFilter?.addEventListener('change', () => {
    orderCategoryFilter = categoryFilter.value;
    renderOrdersTable(getRows(currentRange));
  });

  window.addEventListener('resize', () => {
    renderRevenueChart(getRows(currentRange));
    renderCategoryDonut(getRows(currentRange));
  });
}

function init(): void {
  loadState();
  populateCategoryFilter();
  currentRange = rangeForPreset(currentPreset);
  bindEvents();

  if (hasValidSession()) {
    showApp();
  } else {
    showLogin();
  }
}

document.addEventListener('DOMContentLoaded', init);

// expose handlers used via inline onclick in table rows
(window as any).openOrderModal = openOrderModal;
(window as any).deleteOrder = deleteOrder;
(window as any).openProductModal = openProductModal;
