import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';
import { getBearerToken, setSecurityHeaders, jsonError, jsonOk } from './_utils.js';

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

    const { data: emails, error } = await supabase
      .from('emails')
      .select('id, address, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    if (error) return jsonError(res, 500, error.message);

    return jsonOk(res, {
      domain: (process.env.MAIL_DOMAIN || '').trim().toLowerCase(),
      emails: emails || []
    });
  } catch (err) {
    console.error('[get-emails]', err.message);
    return jsonError(res, 500, err.message || 'Server xatoligi');
  }
}
