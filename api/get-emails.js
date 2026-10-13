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

    const session = await verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Avtorizatsiyadan oʻtmagan' });
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
    return res.status(500).json({ success: false, error: err.message });
  }
}
