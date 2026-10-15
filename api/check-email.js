import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import {
  getBearerToken, setSecurityHeaders, jsonError, jsonOk, MAX_PREFIX_LEN,
  getPrimaryDomain, isAllowedDomain, getAllowedDomains
} from './_utils.js';

const tokenCache = new Map();

async function fastVerifyToken(token) {
  if (!token) return null;
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && (now - cached.time) < 60_000) {
    return cached.userId;
  }
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  tokenCache.set(token, { userId: user.id, time: now });
  if (tokenCache.size > 500) {
    for (const [k, v] of tokenCache.entries()) {
      if (now - v.time > 60_000) tokenCache.delete(k);
    }
  }
  return user.id;
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, OPTIONS');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') return handleOptions(req, res, 'GET, OPTIONS');
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');

  try {
    const token = getBearerToken(req);
    const userId = await fastVerifyToken(token);
    if (!userId) return jsonError(res, 401, 'Avtorizatsiyadan o\u02bbtmagan');

    const domains = getAllowedDomains();
    if (!domains.length) {
      return jsonError(res, 500, 'MAIL_DOMAIN sozlanmagan');
    }

    let prefix = (req.query?.prefix || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!prefix) {
      return jsonOk(res, { available: false, error: 'Prefiks bo\u02bbsh' });
    }
    if (prefix.length > MAX_PREFIX_LEN) {
      prefix = prefix.slice(0, MAX_PREFIX_LEN);
    }

    let requestedDomain = (req.query?.domain || '').trim().toLowerCase();
    if (requestedDomain && !isAllowedDomain(requestedDomain)) {
      return jsonError(res, 400, 'Bu domen ruxsat etilmagan');
    }
    const domain = requestedDomain || getPrimaryDomain();

    const targetAddress = `${prefix}@${domain}`;
    const supabase = getSupabase();
    const { data: duplicate } = await supabase
      .from('emails')
      .select('id')
      .eq('address', targetAddress)
      .limit(1)
      .maybeSingle();

    res.setHeader('Cache-Control', 'private, max-age=5');

    return jsonOk(res, {
      available: !duplicate,
      isTaken: Boolean(duplicate),
      address: targetAddress,
      domain
    });
  } catch (err) {
    console.error('[check-email]', err.message);
    return jsonError(res, 500, err.message || 'Internal server error');
  }
}
