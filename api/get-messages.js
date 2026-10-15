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

    const emailFilter = (req.query?.email || '').trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 15, 1), 50);
    const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0);

    let query = supabase
      .from('messages')
      .select('id, user_id, email_address, from_name, from_address, subject, body, html, is_starred, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    if (emailFilter && emailFilter !== 'all') {
      if (emailFilter.length > 254) return jsonError(res, 400, 'Noto\u02bbg\u02bbri filtr');
      query = query.eq('email_address', emailFilter);
    }

    const { data: messages, error } = await query.range(offset, offset + limit - 1);
    if (error) return jsonError(res, 500, error.message);

    const msgs = messages || [];
    const hasMore = msgs.length === limit;

    return jsonOk(res, {
      messages: msgs,
      hasMore,
      limit,
      offset
    });
  } catch (err) {
    console.error('[get-messages]', err.message);
    return jsonError(res, 500, err.message || 'Server xatoligi');
  }
}
