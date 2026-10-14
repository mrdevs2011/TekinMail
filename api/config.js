import { setCors, handleOptions } from './_cors.js';
import { setSecurityHeaders } from './_utils.js';

export default async function handler(req, res) {
  setSecurityHeaders(res);
  setCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return handleOptions(req, res, 'GET, OPTIONS');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  // 1. Agar rasm proxy so'rovi bo'lsa (/api/config?url=... yoki /api/config?img=...)
  const rawUrl = req.query?.url || req.query?.img;
  if (rawUrl && typeof rawUrl === 'string') {
    let targetUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).send('Invalid url protocol: only http and https allowed');
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const upstream = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        redirect: 'follow'
      });

      clearTimeout(timeout);

      if (!upstream.ok) {
        return res.status(upstream.status).send(`Upstream returned ${upstream.status}`);
      }

      const contentType = upstream.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const buffer = await upstream.arrayBuffer();
      return res.status(200).send(Buffer.from(buffer));
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).send('Gateway timeout');
      }
      return res.status(502).send(`Proxy fetch failed: ${err.message}`);
    }
  }

  // 2. Standart public config
  const domain = (process.env.MAIL_DOMAIN || '').trim().toLowerCase();

  return res.status(200).json({
    success: true,
    domain,
    appName: process.env.APP_NAME || 'TekinMail'
  });
}
