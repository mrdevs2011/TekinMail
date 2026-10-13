import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';
import { parseBody, getBearerToken, setSecurityHeaders, jsonError, jsonOk } from './_utils.js';

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') return handleOptions(req, res, 'POST, OPTIONS');
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  try {
    const supabase = getSupabase();
    const body = parseBody(req);
    const token = getBearerToken(req, body);
    const session = await verifySessionToken(token);
    if (!session) return jsonError(res, 401, 'Avtorizatsiyadan o\u02bbtmagan');

    const address = (body?.address || '').trim().toLowerCase();
    if (!address || !address.includes('@') || address.length > 254) {
      return jsonError(res, 400, 'Email manzili ko\u02bbrsatilmadi');
    }

    await supabase
      .from('messages')
      .delete()
      .eq('user_id', session.userId)
      .eq('email_address', address);

    const { data: deleted, error } = await supabase
      .from('emails')
      .delete()
      .eq('user_id', session.userId)
      .eq('address', address)
      .select('id');

    if (error) return jsonError(res, 500, error.message);
    if (!deleted || deleted.length === 0) {
      return jsonError(res, 404, 'Email topilmadi');
    }

    return jsonOk(res, { message: 'Email butunlay o\u02bbchirildi', address });
  } catch (err) {
    console.error('[delete-email]', err.message);
    return jsonError(res, 500, err.message || 'Server xatoligi');
  }
}
