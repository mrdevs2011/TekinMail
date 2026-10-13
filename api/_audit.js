import { getSupabase } from './_supabase.js';

export async function writeAudit(action, details = {}) {
  try {
    const supabase = getSupabase();
    await supabase.from('audit_logs').insert([{
      action,
      user_id: details.userId || null,
      username: details.username || null,
      ip: details.ip || null,
      target: details.target || null,
      meta: details.meta || null,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    // jadval yo'q yoki xato bo'lsa e'tiborsiz
  }
}

export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

export function setCors(res) {
  const allowed = [
    'https://bombaclat.uz',
    'https://www.bombaclat.uz',
    'https://tekinmail.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  // Oddiy: ruxsat etilgan originlarni qabul qilamiz
  // (aniq origin tekshiruvi keyinroq qattiqroq qilinishi mumkin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');
}
