import { getSupabase } from './_supabase.js';
import { verifySessionToken } from './_auth.js';

const DOMAIN = process.env.MAIL_DOMAIN || 'tekinmail.uz';

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

    const session = verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Avtorizatsiyadan oʻtmagan' });
    }

    // 5 ta unikal prefiks yaratamiz
    const prefixes = ['dev', 'core', 'user', 'lab', 'box', 'hub', 'pro', 'net', 'fast', 'cl', 'ai', 'cloud'];
    const createdEmails = [];
    const inserts = [];

    for (let i = 0; i < 5; i++) {
      const randPref = prefixes[Math.floor(Math.random() * prefixes.length)];
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const randHex = Math.random().toString(36).substring(2, 5);
      const emailAddress = `${randPref}_${randNum}${randHex}@${DOMAIN}`;

      inserts.push({
        user_id: session.userId,
        address: emailAddress,
        token: 'tk_' + Math.random().toString(36).substring(2)
      });
    }

    const { data: inserted, error: insErr } = await supabase
      .from('emails')
      .insert(inserts)
      .select('id, address, created_at');

    if (insErr) {
      return res.status(500).json({ success: false, error: 'Emaillarni saqlashda xatolik: ' + insErr.message });
    }

    return res.status(200).json({
      success: true,
      added_count: (inserted || []).length,
      emails: inserted || []
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
