const ALLOWED_ORIGINS = [
  'https://bombaclat.uz',
  'https://www.bombaclat.uz',
  'https://tekinmail.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

export function setCors(req, res, methods = 'GET, POST, OPTIONS') {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    // Same-origin / server-to-server
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  } else {
    // Dev fallback: still allow known production domains only
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleOptions(req, res, methods) {
  setCors(req, res, methods);
  return res.status(204).end();
}
