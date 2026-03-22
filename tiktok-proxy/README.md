# VietLong Creator — TikTok OAuth Proxy

Deploy lên Vercel trong 3 phút:

## Setup

1. Fork repo này hoặc upload lên GitHub
2. Vào vercel.com → Import Project
3. Add Environment Variables:
   - TIKTOK_CLIENT_KEY = (từ developers.tiktok.com)
   - TIKTOK_CLIENT_SECRET = (từ developers.tiktok.com)  
   - ALLOWED_ORIGIN = https://letranvietlong.github.io
4. Deploy → copy URL (vd: https://vietlong-proxy.vercel.app)
5. Paste URL vào VietLong Creator app

## Endpoints
- GET  /api/auth    — Generate TikTok OAuth URL
- POST /api/token   — Exchange code for token
- GET  /api/userinfo — Get user profile
