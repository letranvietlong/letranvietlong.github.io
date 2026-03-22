// api/auth.js — Generate TikTok OAuth URL & handle redirect

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const ALLOWED_ORIGIN    = process.env.ALLOWED_ORIGIN || 'https://letranvietlong.github.io';
const SCOPES            = 'user.info.basic,video.upload,video.publish';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { redirect_uri, state, code_challenge } = req.query;

  if (!redirect_uri || !state) {
    return res.status(400).json({ error: 'Missing redirect_uri or state' });
  }

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key',             TIKTOK_CLIENT_KEY);
  authUrl.searchParams.set('scope',                  SCOPES);
  authUrl.searchParams.set('response_type',          'code');
  authUrl.searchParams.set('redirect_uri',           redirect_uri);
  authUrl.searchParams.set('state',                  state);
  if (code_challenge) {
    authUrl.searchParams.set('code_challenge',        code_challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
  }

  // Return URL (frontend opens as popup)
  return res.status(200).json({ auth_url: authUrl.toString() });
}
