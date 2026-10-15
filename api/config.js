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

  // 0. Cron cleanup (eski xabarlar)
  if (req.query?.action === 'cleanup' || req.query?.cleanup === '1') {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const querySecret = (req.query?.secret || '').trim();
    const provided = authHeader || querySecret;
    if (cronSecret && provided !== cronSecret) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (!cronSecret && process.env.VERCEL_ENV === 'production') {
      return res.status(500).json({ success: false, error: 'CRON_SECRET sozlanmagan' });
    }
    try {
      const { getSupabase } = await import('./_supabase.js');
      const days = Math.max(1, parseInt(process.env.MESSAGE_TTL_DAYS || '30', 10) || 30);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const supabase = getSupabase();
      const { data, error } = await supabase.from('messages').delete({ count: 'exact' }).lt('created_at', cutoff).select('id');
      if (error) return res.status(500).json({ success: false, error: error.message });
      const deleted = Array.isArray(data) ? data.length : 0;
      const loginCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('login_attempts').delete().lt('created_at', loginCutoff);
      return res.status(200).json({ success: true, deleted, cutoff, ttlDays: days });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || 'cleanup failed' });
    }
  }

  // 1. Agar rasm proxy so'rovi bo'lsa (/api/config?url=... yoki /api/config?img=...)
  const rawUrl = req.query?.url || req.query?.img;
  if (rawUrl && typeof rawUrl === 'string') {
    let targetUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).send('Invalid url protocol: only http and https allowed');
    }

    // TRACKING PIXEL HIMOYASI:
    // Anthropic, SendGrid va boshqa provayderlarning kuzatuvchi 1x1 piksellari Vercel server IP-sini
    // fosh qilmasligi uchun ularga umuman so'rov jo'natmaymiz, to'g'ridan-to'g'ri bo'sh 1x1 GIF qaytaramiz!
    const lower = targetUrl.toLowerCase();
    const isTracking = lower.includes('/open/') || lower.includes('/wf/open') ||
                       lower.includes('pixel') || lower.includes('beacon') ||
                       lower.includes('track') || lower.includes('telemetry') ||
                       lower.includes('mail.anthropic.com') || lower.includes('sendgrid.net') ||
                       lower.includes('awstrack.me') || lower.includes('mandrillapp.com');

    if (isTracking) {
      const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(TRANSPARENT_GIF);
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

  // 2. Standart public config (multi-domain)
  const multi = (process.env.MAIL_DOMAINS || '').trim();
  let domains = [];
  if (multi) {
    domains = multi.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  } else {
    const single = (process.env.MAIL_DOMAIN || '').trim().toLowerCase();
    if (single) domains = [single];
  }
  const domain = domains[0] || '';

  return res.status(200).json({
    success: true,
    domain,
    domains,
    appName: process.env.APP_NAME || 'TekinMail'
  });
}
