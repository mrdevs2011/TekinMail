import { getSupabase } from './_supabase.js';
import { usernameToEmail } from './_auth.js';
import { writeAudit, getClientIp } from './_audit.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

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
    const ip = getClientIp(req);

    if (!rawUsername || !password) {
      return res.status(400).json({ success: false, error: 'Username va parolni kiriting' });
    }

    // Rate limit: oxirgi 15 daqiqadagi muvaffaqiyatsiz urinishlar
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: failCount } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('username', rawUsername)
      .eq('success', false)
      .gte('created_at', since);

    if ((failCount || 0) >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        error: `Juda ko\u2018p urinish. ${WINDOW_MINUTES} daqiqadan keyin qayta urinib ko\u2018ring.`
      });
    }

    const email = usernameToEmail(rawUsername);

    // Supabase Auth orqali kirish
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    const success = !authErr && authData?.session && authData?.user;

    // Urinishni yozish (jadval bo'lmasa xato bermaydi)
    await supabase.from('login_attempts').insert([{
      username: rawUsername,
      ip,
      success: Boolean(success),
      created_at: new Date().toISOString()
    }]).then(() => {}).catch(() => {});

    if (!success) {
      await writeAudit('login_failed', { username: rawUsername, ip });
      return res.status(401).json({ success: false, error: 'Foydalanuvchi nomi yoki parol noto\u2018g\u2018ri' });
    }

    const user = authData.user;
    const token = authData.session.access_token;

    // Profilni olamiz
    let profile = null;
    const { data: p } = await supabase
      .from('users')
      .select('id, full_name, username, is_admin')
      .eq('id', user.id)
      .single();

    if (p) {
      profile = p;
    } else {
      profile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || rawUsername,
        username: user.user_metadata?.username || rawUsername,
        is_admin: false
      };
    }

    const isAdmin = Boolean(profile.is_admin || profile.username.toLowerCase() === 'admin');

    await writeAudit('login_success', { userId: user.id, username: profile.username, ip });

    return res.status(200).json({
      success: true,
      user: {
        id: profile.id,
        full_name: profile.full_name,
        username: profile.username,
        is_admin: isAdmin
      },
      token
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
