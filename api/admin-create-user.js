import { getSupabase } from './_supabase.js';
import { requireAdmin, hashPassword } from './_auth.js';

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
    const admin = await requireAdmin(req, res, supabase);
    if (!admin) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const fullName = (body?.full_name || '').trim();
    const rawUsername = (body?.username || '').trim().toLowerCase();
    const password = body?.password || '';
    const makeAdmin = Boolean(body?.is_admin);

    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ success: false, error: 'Ismni toʻliq kiriting (kamida 2 ta belgi)' });
    }

    if (!rawUsername || rawUsername.length < 3 || !/^[a-z0-9_.-]+$/.test(rawUsername)) {
      return res.status(400).json({ success: false, error: 'Username kamida 3 ta belgi (harflar, raqamlar, _, .)' });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, error: 'Parol kamida 4 ta belgi boʻlishi kerak' });
    }

    // Username bandligini tekshirish
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', rawUsername)
      .single();

    if (existing) {
      return res.status(409).json({ success: false, error: 'Bu username allaqachon mavjud' });
    }

    const passwordHash = hashPassword(password);
    const insertPayload = {
      full_name: fullName,
      username: rawUsername,
      password_hash: passwordHash
    };
    if (makeAdmin) {
      insertPayload.is_admin = true;
    }

    let newUser;
    const { data: createdWithAdmin, error: err1 } = await supabase
      .from('users')
      .insert([insertPayload])
      .select('id, full_name, username, created_at')
      .single();

    if (!err1 && createdWithAdmin) {
      newUser = createdWithAdmin;
    } else {
      delete insertPayload.is_admin;
      const { data: createdBasic, error: err2 } = await supabase
        .from('users')
        .insert([insertPayload])
        .select('id, full_name, username, created_at')
        .single();

      if (err2 || !createdBasic) {
        return res.status(500).json({ success: false, error: 'Foydalanuvchi yaratishda xatolik: ' + (err2?.message || '') });
      }
      newUser = createdBasic;
    }

    // Foydalanuvchiga dastlabki email manzilini ham ochib beramiz
    const domain = process.env.MAIL_DOMAIN || 'bombaclat.uz';
    const initialAddress = `${rawUsername}@${domain}`;
    await supabase.from('emails').insert([{
      user_id: newUser.id,
      address: initialAddress,
      token: 'tk_' + Math.random().toString(36).substring(2)
    }]);

    return res.status(200).json({
      success: true,
      message: 'Yangi foydalanuvchi muvaffaqiyatli yaratildi',
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        username: newUser.username,
        is_admin: makeAdmin || rawUsername === 'admin'
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
