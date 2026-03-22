// api/userinfo.js — Fetch TikTok user info (proxied to avoid CORS)

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://letranvietlong.github.io';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const resp = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,avatar_url,open_id,profile_deep_link',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
