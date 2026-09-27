// Shared Playwright helpers for testing products in this repo.
// Usage from a scratch test script (anywhere on disk):
//   const h = require('<repo>/.claude/tools/harness.js');
//   const s = await h.open({ path: '/products/gold-track/html/index.html',
//                            mocks: { 'data/gold-price.json': {...} },
//                            localStorage: { goldtrack_v1: { transactions: [...] } } });
//   ... s.page ...
//   console.log(await h.report(s)); await s.close();
// Requires `npm install --prefix .claude/tools` once, and `serve.sh start`.
const { chromium } = require('playwright');

const DEVICES = {
  iphone14promax: { width: 430, height: 932 },          // Safari tab, full screen
  iphone14promaxStandalone: { width: 430, height: 873 }, // what iOS reports from a Home Screen icon (status bar = default)
  narrow: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 }
};

async function open(opts = {}) {
  // Same default as serve.sh; PORT env lets a whole script follow `serve.sh start <port>`.
  const port = opts.port || Number(process.env.PORT) || 8813;
  const vp = typeof opts.device === 'string' ? DEVICES[opts.device] : (opts.viewport || DEVICES.narrow);
  const browser = opts.browser || await chromium.launch();
  const context = await browser.newContext({
    viewport: vp,
    colorScheme: opts.colorScheme || 'light',
    timezoneId: opts.timezoneId || 'Asia/Ho_Chi_Minh',
    // Block by default: an old cached copy from the service worker would
    // otherwise mask the edit under test. Pass blockSW:false to test offline.
    serviceWorkers: opts.blockSW === false ? 'allow' : 'block'
  });
  const page = await context.newPage();
  // Freeze "today" so date-dependent expectations (calendars, "hôm nay",
  // 7-day ranges) stay valid whenever the test runs. Timers keep running.
  if (opts.now) await page.clock.setFixedTime(new Date(opts.now));
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });

  // mocks: { 'data/gold-price.json': object|string } → matched as '**/<key>'
  for (const [key, body] of Object.entries(opts.mocks || {})) {
    await page.route('**/' + key.replace(/^\/+/, ''), r => r.fulfill({
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body)
    }));
  }
  // Seed localStorage once, before any app script runs (not on later reloads,
  // so tests of "survives reload" still work).
  if (opts.localStorage) {
    await context.addInitScript(seed => {
      if (sessionStorage.getItem('__seeded')) return;
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      sessionStorage.setItem('__seeded', '1');
    }, opts.localStorage);
  }
  const url = opts.url || ('http://localhost:' + port + (opts.path || '/products/gold-track/html/index.html'));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (opts.settleMs !== 0) await page.waitForTimeout(opts.settleMs || 300);

  return {
    browser, context, page, errors, failed,
    close: async () => { if (!opts.browser) await browser.close(); else await context.close(); }
  };
}

// Standard health numbers every test should report.
async function report(s) {
  const layout = await s.page.evaluate(() => {
    const de = document.documentElement;
    // Only controls actually on screen: closed sheets/dialogs stay in the DOM
    // (transformed away or opacity 0) and would otherwise be false positives.
    const onScreen = el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
      for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).pointerEvents === 'none') return false;
      return true;
    };
    const label = el => {
      const owner = el.id ? '#' + el.id : ((el.parentElement && el.parentElement.closest('[id]')) ? '#' + el.parentElement.closest('[id]').id + ' >' : el.tagName.toLowerCase());
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 14);
      return owner + (txt ? ' "' + txt + '"' : '');
    };
    const small = [...document.querySelectorAll('button,a,[role=button],select,input')]
      .filter(el => onScreen(el) && el.getBoundingClientRect().height < 44);
    return {
      horizontalOverflow: de.scrollWidth > de.clientWidth, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth,
      tapTargetsUnder44Count: small.length,
      tapTargetsUnder44: small.slice(0, 15).map(el => label(el) + ' = ' + Math.round(el.getBoundingClientRect().height) + 'px')
    };
  });
  return { errors: s.errors, failedRequests: s.failed, ...layout };
}

// Visible text of an element, whitespace-collapsed — for exact comparisons.
async function text(page, selector) {
  return page.$eval(selector, el => el.innerText.replace(/\s+/g, ' ').trim());
}

// Run the app's iOS-standalone code paths in Chromium: pretend the page was
// opened from a Home Screen icon on a screen `extra` px taller than the
// viewport. Chromium still can't reproduce real safe-area insets or WebKit's
// clipping — say "chưa kiểm chứng trên máy thật" for those.
async function simulateStandalone(page, extra = 59) {
  await page.evaluate(extra => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    Object.defineProperty(screen, 'height', { value: innerHeight + extra, configurable: true });
    Object.defineProperty(screen, 'width', { value: innerWidth, configurable: true });
    window.dispatchEvent(new Event('resize'));
  }, extra);
}

module.exports = { chromium, DEVICES, open, report, text, simulateStandalone };
