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

    const fullName = (body?.full_name || '').trim();
    const rawUsername = (body?.username || '').trim().toLowerCase();
    const password = body?.password || '';

    // Validatsiya
    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ success: false, error: 'Ismingizni toʻliq kiriting (kamida 2 ta belgi)' });
    }

    if (!rawUsername || rawUsername.length < 3) {
      return res.status(400).json({ success: false, error: 'Username kamida 3 ta belgi boʻlishi kerak' });
    }

    if (!/^[a-z0-9_.-]+$/.test(rawUsername)) {
      return res.status(400).json({ success: false, error: 'Usernameda faqat harflar, raqamlar va _ . ruxsat etiladi' });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, error: 'Parol kamida 4 ta belgi boʻlishi kerak' });
    }

    // Username bandligini tekshiramiz
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', rawUsername)
      .single();

    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Bu username allaqachon band, boshqasini tanlang' });
    }

    // Yangi user yaratamiz
    const passwordHash = hashPassword(password);
    const { data: newUser, error: createErr } = await supabase
      .from('users')
      .insert([{
        full_name: fullName,
        username: rawUsername,
        password_hash: passwordHash
      }])
      .select('id, full_name, username, created_at')
      .single();

    if (createErr || !newUser) {
      return res.status(500).json({ success: false, error: 'Foydalanuvchi yaratishda xatolik: ' + (createErr?.message || '') });
    }

    // Token yaratamiz
    const token = createSessionToken(newUser.id, newUser.username);

    return res.status(200).json({
      success: true,
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        username: newUser.username
      },
      token
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
