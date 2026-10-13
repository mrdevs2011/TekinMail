import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { requireAdmin, usernameToEmail } from './_auth.js';
import { writeAudit, getClientIp } from './_audit.js';

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
    const admin = await requireAdmin(req, res, supabase);
    if (!admin) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const fullName = (body?.full_name || '').trim();
    const rawUsername = (body?.username || '').trim().toLowerCase();
    const password = body?.password || '';
    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ success: false, error: 'Ismni to\u2018liq kiriting (kamida 2 ta belgi)' });
    }

    if (!rawUsername || rawUsername.length < 3 || !/^[a-z0-9_.-]+$/.test(rawUsername)) {
      return res.status(400).json({ success: false, error: 'Username kamida 3 ta belgi (harflar, raqamlar, _, .)' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Parol kamida 8 ta belgi bo\u2018lishi kerak' });
    }

    const email = usernameToEmail(rawUsername);

    // Supabase Auth da user yaratamiz
    const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username: rawUsername,
        is_admin: false
      }
    });

    if (createErr || !authUser?.user) {
      const msg = createErr?.message || 'User yaratishda xatolik';
      if (msg.includes('already') || msg.includes('exists')) {
        return res.status(409).json({ success: false, error: 'Bu username allaqachon mavjud' });
      }
      return res.status(500).json({ success: false, error: msg });
    }

    const newAuthUser = authUser.user;

    // public.users profilini yaratamiz (id = auth.users.id)
    const insertPayload = {
      id: newAuthUser.id,
      full_name: fullName,
      username: rawUsername,
      is_admin: false,
      password_hash: 'supabase-auth' // eski maydon uchun placeholder
    };

    const { error: profileErr } = await supabase
      .from('users')
      .insert([insertPayload]);

    if (profileErr) {
      // Auth user yaratilgan, profil xato bo'lsa ham davom etamiz (keyin tuzatish mumkin)
      console.error('Profile insert error:', profileErr.message);
    }

    // Dastlabki email manzil (faqat MAIL_DOMAIN sozlangan bo'lsa)
    const domain = (process.env.MAIL_DOMAIN || '').trim().toLowerCase();
    if (domain) {
      const initialAddress = `${rawUsername}@${domain}`;
      await supabase.from('emails').insert([{
        user_id: newAuthUser.id,
        address: initialAddress,
        token: 'tk_' + Math.random().toString(36).substring(2)
      }]);
    }

    await writeAudit('user_created', { userId: admin.userId, username: admin.username, ip: getClientIp(req), target: rawUsername });

    return res.status(200).json({
      success: true,
      message: 'Yangi foydalanuvchi muvaffaqiyatli yaratildi (Supabase Auth)',
      user: {
        id: newAuthUser.id,
        full_name: fullName,
        username: rawUsername,
        is_admin: false
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
