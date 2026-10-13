import { getSupabase } from './_supabase.js';
import { verifySessionToken } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || body?.token;

    const session = await verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Avtorizatsiyadan oʻtmagan' });
    }

    const address = (body?.address || '').trim().toLowerCase();
    if (!address) {
      return res.status(400).json({ success: false, error: 'Email manzili koʻrsatilmadi' });
    }

    // 1. O'chirilayotgan emailga kelgan xatlarni tozalash
    await supabase
      .from('messages')
      .delete()
      .eq('user_id', session.userId)
      .eq('email_address', address);

    // 2. Emailning o'zini bazadan butunlay o'chirish
    const { error } = await supabase
      .from('emails')
      .delete()
      .eq('user_id', session.userId)
      .eq('address', address);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Email butunlay oʻchirildi',
      address
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
