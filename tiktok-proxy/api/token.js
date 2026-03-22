// api/token.js — TikTok OAuth token exchange
// Deploy to Vercel: vercel deploy

const TIKTOK_CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const ALLOWED_ORIGIN       = process.env.ALLOWED_ORIGIN || 'https://letranvietlong.github.io';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, redirect_uri, grant_type, refresh_token, code_verifier } = req.body || {};

  try {
    const body = new URLSearchParams();
    body.append('client_key',    TIKTOK_CLIENT_KEY);
    body.append('client_secret', TIKTOK_CLIENT_SECRET);
    body.append('grant_type',    grant_type || 'authorization_code');
    
    if (grant_type === 'refresh_token') {
      body.append('refresh_token', refresh_token);
    } else {
      body.append('code',         code);
      body.append('redirect_uri', redirect_uri);
      if (code_verifier) body.append('code_verifier', code_verifier);
    }

    const ttResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    const data = await ttResp.json();

    if (!ttResp.ok || data.error) {
      return res.status(ttResp.status).json({ 
        error: data.error || 'token_exchange_failed',
        error_description: data.error_description || JSON.stringify(data)
      });
    }

    // Return token data (never expose client_secret to frontend)
    return res.status(200).json({
      access_token:  data.data?.access_token,
      refresh_token: data.data?.refresh_token,
      open_id:       data.data?.open_id,
      expires_in:    data.data?.expires_in || 86400,
      scope:         data.data?.scope,
    });

  } catch (err) {
    return res.status(500).json({ error: 'proxy_error', message: err.message });
  }
}
