import { getSupabase } from './_supabase.js';
import { verifySessionToken } from './_auth.js';
import { setCors, handleOptions } from './_cors.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return handleOptions(req, res, 'GET, OPTIONS');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query?.token;

    const session = await verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Avtorizatsiyadan o\u02bbtmagan' });
    }

    const emailFilter = (req.query?.email || '').trim().toLowerCase();

    let query = supabase
      .from('messages')
      .select('id, user_id, email_address, from_name, from_address, subject, body, html, is_starred, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    if (emailFilter && emailFilter !== 'all') {
      query = query.eq('email_address', emailFilter);
    }

    const { data: messages, error } = await query.limit(100);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({
      success: true,
      messages: messages || []
    });

  } catch (err) {
    console.error('[get-messages]', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
