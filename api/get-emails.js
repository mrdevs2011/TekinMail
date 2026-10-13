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

    const { data: emails, error } = await supabase
      .from('emails')
      .select('id, address, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({
      success: true,
      domain: process.env.MAIL_DOMAIN || 'bombaclat.uz',
      emails: emails || []
    });

  } catch (err) {
    console.error('[get-emails]', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
