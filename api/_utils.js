/** Shared helpers for TekinMail API */

export function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}

export function getBearerToken(req, body) {
  const authHeader = req.headers?.authorization || '';
  const fromHeader = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (fromHeader) return fromHeader;
  if (body?.token) return String(body.token);
  if (req.query?.token) return String(req.query.token);
  return '';
}

export function isValidUuid(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
}

export function jsonError(res, status, error) {
  return res.status(status).json({ success: false, error });
}

export function jsonOk(res, data = {}) {
  return res.status(200).json({ success: true, ...data });
}

/** Max prefix length for custom email */
export const MAX_PREFIX_LEN = 64;

/** Allowed mail domains: MAIL_DOMAINS (comma-separated) or MAIL_DOMAIN fallback */
export function getAllowedDomains() {
  const multi = (process.env.MAIL_DOMAINS || '').trim();
  if (multi) {
    return multi.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  }
  const single = (process.env.MAIL_DOMAIN || '').trim().toLowerCase();
  return single ? [single] : [];
}

export function getPrimaryDomain() {
  const domains = getAllowedDomains();
  return domains[0] || '';
}

export function isAllowedDomain(domain) {
  if (!domain) return false;
  const d = String(domain).trim().toLowerCase();
  return getAllowedDomains().includes(d);
}
