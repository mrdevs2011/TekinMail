import { getSupabase } from './_supabase.js';
import { usernameToEmail } from './_auth.js';
import { writeAudit, getClientIp } from './_audit.js';
import { setCors, handleOptions } from './_cors.js';
import { setSecurityHeaders } from './_utils.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export default async function handler(req, res) {
  setSecurityHeaders(res);
  setCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return handleOptions(req, res, 'POST, OPTIONS');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const rawUsername = (body?.username || '').trim().toLowerCase();
    const password = body?.password || '';
    const ip = getClientIp(req);

    if (!rawUsername || !password) {
      return res.status(400).json({ success: false, error: 'Username va parolni kiriting' });
    }

    if (rawUsername.length > 64 || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Noto\u2018g\u2018ri so\u2018rov' });
    }

    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    // Rate limit: username bo\u2018yicha
    const { count: failByUser } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('username', rawUsername)
      .eq('success', false)
      .gte('created_at', since);

    if ((failByUser || 0) >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        error: `Juda ko\u2018p urinish. ${WINDOW_MINUTES} daqiqadan keyin qayta urinib ko\u2018ring.`
      });
    }

    // Rate limit: IP bo\u2018yicha (bruteforce himoya)
    const { count: failByIp } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('success', false)
      .gte('created_at', since);

    if ((failByIp || 0) >= MAX_ATTEMPTS * 3) {
      return res.status(429).json({
        success: false,
        error: `IP bo\u2018yicha juda ko\u2018p urinish. ${WINDOW_MINUTES} daqiqadan keyin qayta urinib ko\u2018ring.`
      });
    }

    const email = usernameToEmail(rawUsername);

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    const success = !authErr && authData?.session && authData?.user;

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

    const isAdmin = Boolean(profile.is_admin || profile.username?.toLowerCase() === 'admin');

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
    console.error('[login]', err.message);
    return res.status(500).json({
      success: false,
      error: err.message?.includes('SUPABASE_') ? err.message : 'Server xatoligi'
    });
  }
}
