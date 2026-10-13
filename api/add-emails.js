import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';

const DOMAIN = process.env.MAIL_DOMAIN || 'bombaclat.uz';

export default async function handler(req, res) {
  setCors(req, res);

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

    let customPrefix = (body?.prefix || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

    // Agar maxsus prefiks berilmagan bo'lsa
    if (!customPrefix) {
      const { data: existingEmails } = await supabase
        .from('emails')
        .select('address')
        .eq('user_id', session.userId);

      const count = (existingEmails || []).length;
      if (count === 0) {
        customPrefix = session.username;
      } else {
        customPrefix = `${session.username}_${count + 1}`;
      }
    }

    const targetAddress = `${customPrefix}@${DOMAIN}`;

    // Mavjudligini tekshiramiz
    const { data: duplicate } = await supabase
      .from('emails')
      .select('id')
      .eq('address', targetAddress)
      .single();

    if (duplicate) {
      const uniqueSuffix = Math.floor(100 + Math.random() * 900);
      customPrefix = `${customPrefix}_${uniqueSuffix}`;
    }

    const finalAddress = `${customPrefix}@${DOMAIN}`;

    const { data: inserted, error: insErr } = await supabase
      .from('emails')
      .insert([{
        user_id: session.userId,
        address: finalAddress,
        token: 'tk_' + Math.random().toString(36).substring(2)
      }])
      .select('id, address, created_at')
      .single();

    if (insErr) {
      return res.status(500).json({ success: false, error: 'Emailni saqlashda xatolik: ' + insErr.message });
    }

    return res.status(200).json({
      success: true,
      email: inserted
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
