import { getSupabase } from './_supabase.js';
import { hashPassword, createSessionToken } from './_auth.js';

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

    const rawUsername = (body?.username || '').trim().toLowerCase();
    const password = body?.password || '';

    if (!rawUsername || !password) {
      return res.status(400).json({ success: false, error: 'Username va parolni kiriting' });
    }

    // Foydalanuvchini bazadan qidiramiz
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, full_name, username, password_hash')
      .eq('username', rawUsername)
      .single();

    if (userErr || !user) {
      return res.status(401).json({ success: false, error: 'Foydalanuvchi nomi yoki parol notoʻgʻri' });
    }

    // Parol mosligini tekshiramiz
    const inputHash = hashPassword(password);
    if (inputHash !== user.password_hash) {
      return res.status(401).json({ success: false, error: 'Foydalanuvchi nomi yoki parol notoʻgʻri' });
    }

    // Token yaratamiz
    const token = createSessionToken(user.id, user.username);

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username
      },
      token
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
