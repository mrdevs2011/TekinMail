import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';
import { getBearerToken, setSecurityHeaders, jsonError, jsonOk, MAX_PREFIX_LEN } from './_utils.js';

const DOMAIN = (process.env.MAIL_DOMAIN || 'bombaclat.uz').trim().toLowerCase();

export default async function handler(req, res) {
  setCors(req, res, 'GET, OPTIONS');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') return handleOptions(req, res, 'GET, OPTIONS');
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');

  try {
    const supabase = getSupabase();
    const token = getBearerToken(req);
    const session = await verifySessionToken(token);
    if (!session) return jsonError(res, 401, 'Avtorizatsiyadan o\u02bbtmagan');

    let prefix = (req.query?.prefix || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!prefix) {
      return jsonOk(res, { available: false, error: 'Prefiks bo\u02bbsh' });
    }
    if (prefix.length > MAX_PREFIX_LEN) {
      prefix = prefix.slice(0, MAX_PREFIX_LEN);
    }

    const targetAddress = `${prefix}@${DOMAIN}`;
    const { data: duplicate } = await supabase
      .from('emails')
      .select('id')
      .eq('address', targetAddress)
      .maybeSingle();

    return jsonOk(res, {
      available: !duplicate,
      isTaken: Boolean(duplicate),
      address: targetAddress
    });
  } catch (err) {
    console.error('[check-email]', err.message);
    return jsonError(res, 500, err.message || 'Internal server error');
  }
}
