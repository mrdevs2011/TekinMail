function buildAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const extras = [];
  const domain = (process.env.MAIL_DOMAIN || '').trim().toLowerCase();
  if (domain) {
    extras.push(`https://${domain}`, `https://www.${domain}`);
  }
  if (process.env.VERCEL_URL) {
    extras.push(`https://${process.env.VERCEL_URL}`);
  }
  // Local dev
  extras.push('http://localhost:3000', 'http://localhost:5173');

  return [...new Set([...fromEnv, ...extras])];
}

export function setCors(req, res, methods = 'GET, POST, OPTIONS') {
  const allowed = buildAllowedOrigins();
  const origin = req.headers?.origin || '';

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    // same-origin / server-to-server
    res.setHeader('Access-Control-Allow-Origin', allowed[0] || '*');
  } else if (allowed.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleOptions(req, res, methods) {
  setCors(req, res, methods);
  return res.status(204).end();
}
