import crypto from 'crypto';

const SECRET_SALT = 'tekinmail_root_auth_salt_2026';

// Parolni SHA-256 bilan xesh qilish
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SECRET_SALT).digest('hex');
}

// Xavfsiz sessiya tokeni yaratish
export function createSessionToken(userId, username) {
  const payload = `${userId}:${username}:${Date.now()}`;
  const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

// Sessiya tokenini tekshirish
export function verifySessionToken(token) {
  try {
    if (!token) return null;
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [userId, username, timestamp, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SECRET_SALT).update(`${userId}:${username}:${timestamp}`).digest('hex');
    if (sig !== expectedSig) return null;
    return { userId, username };
  } catch (e) {
    return null;
  }
}

// Admin huquqini tekshirish
export async function requireAdmin(req, res, supabase) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || req.query?.token;
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ success: false, error: 'Avtorizatsiyadan oʻtmagan' });
    return null;
  }

  // 1. Agar username 'admin' bo'lsa darhol ruxsat
  if (session.username.toLowerCase() === 'admin') {
    return session;
  }

  // 2. Bazadan is_admin ustunini tekshirish
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, username, is_admin')
      .eq('id', session.userId)
      .single();

    if (user && (user.is_admin === true || user.username.toLowerCase() === 'admin')) {
      return session;
    }
  } catch (e) {
    // is_admin ustuni hali mavjud bo'lmasligi mumkin
  }

  res.status(403).json({ success: false, error: 'Faqat admin uchun ruxsat etilgan' });
  return null;
}
