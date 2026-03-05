/**
 * VietLongCrypto — Cloudflare Worker CORS Proxy
 * 
 * HƯỚNG DẪN DEPLOY (miễn phí, 5 phút):
 * 1. Vào https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Chọn "Create Worker" → đặt tên "vn-stock-proxy"
 * 3. Paste toàn bộ code này vào editor → Save & Deploy
 * 4. Copy URL worker (VD: https://vn-stock-proxy.ten-ban.workers.dev)
 * 5. Trong VietLongCrypto.html, thay YOUR-SUBDOMAIN bằng subdomain của bạn
 *    Dòng: const VN_WORKER_URL='https://vn-stock-proxy.YOUR-SUBDOMAIN.workers.dev';
 * 
 * Cloudflare Workers FREE tier: 100,000 requests/ngày — đủ dùng!
 */

// Chỉ cho phép domain của bạn gọi proxy này
const ALLOWED_ORIGINS = [
  'https://letranvietlong.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

// Chỉ cho phép proxy các domain VN stock sau
const ALLOWED_TARGETS = [
  'apipubaws.tcbs.com.vn',
  'finfo-api.vndirect.com.vn',
  'iboard-query.ssi.com.vn',
];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const isAllowedOrigin = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    // Handle preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Parse target URL
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate target domain
    let targetHost;
    try {
      targetHost = new URL(targetUrl).hostname;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 });
    }

    if (!ALLOWED_TARGETS.some(t => targetHost.endsWith(t))) {
      return new Response(JSON.stringify({ error: 'Target domain not allowed: ' + targetHost }), {
        status: 403,
      });
    }

    // Fetch target
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; VietLongCrypto/1.0)',
        },
      });

      const body = await response.text();

      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'public, max-age=60', // cache 60 giây
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Fetch failed: ' + err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
        },
      });
    }
  },
};
