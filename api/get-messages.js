import { getSupabase } from './_supabase.js';
import { verifySessionToken } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;

    const session = verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Avtorizatsiyadan oʻtmagan' });
    }

    const emailFilter = (req.query.email || '').trim().toLowerCase();

    let query = supabase
      .from('messages')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    // Agar ma'lum bir email bo'yicha filtr tanlangan bo'lsa
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
    return res.status(500).json({ success: false, error: err.message });
  }
}
