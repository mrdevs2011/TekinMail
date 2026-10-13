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
