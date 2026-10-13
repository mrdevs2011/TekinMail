import { getSupabase } from './_supabase.js';

// Oddiy Supabase Auth
// Ichki email: username@tekinmail.local

export function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}@tekinmail.local`;
}

export function emailToUsername(email) {
  if (!email) return '';
  return email.replace(/@tekinmail\.local$/i, '');
}

// Sessiya tokenini tekshirish (Supabase JWT)
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Profilni public.users dan olamiz
    const { data: profile } = await supabase
      .from('users')
      .select('id, full_name, username, is_admin')
      .eq('id', user.id)
      .single();

    if (!profile) {
      // Agar profil yo'q bo'lsa, metadata dan olishga urinib ko'ramiz
      const username = user.user_metadata?.username || emailToUsername(user.email);
      return {
        userId: user.id,
        username,
        full_name: user.user_metadata?.full_name || username,
        is_admin: Boolean(user.user_metadata?.is_admin)
      };
    }

    return {
      userId: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      is_admin: Boolean(profile.is_admin)
    };
  } catch (e) {
    return null;
  }
}

// Admin huquqini tekshirish
export async function requireAdmin(req, res, supabase) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || req.query?.token;
  const session = await verifySessionToken(token);
  if (!session) {
    res.status(401).json({ success: false, error: 'Avtorizatsiyadan o\u2018tmagan' });
    return null;
  }

  if (session.username?.toLowerCase() === 'admin' || session.is_admin) {
    return session;
  }

  res.status(403).json({ success: false, error: 'Faqat admin uchun ruxsat etilgan' });
  return null;
}
