import { getSupabase } from './_supabase.js';
import { requireAdmin } from './_auth.js';
import { writeAudit, getClientIp } from './_audit.js';

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

    const targetUserId = body?.user_id || body?.userId;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Foydalanuvchi ID koʻrsatilmadi' });
    }

    // Admin o'z akkauntini o'chira olmaydi
    if (targetUserId === admin.userId) {
      return res.status(400).json({ success: false, error: 'Oʻz admin akkauntingizni oʻchira olmaysiz' });
    }

    // 1. Foydalanuvchining xabarlarini tozalash
    await supabase
      .from('messages')
      .delete()
      .eq('user_id', targetUserId);

    // 2. Foydalanuvchining pochtalarini tozalash
    await supabase
      .from('emails')
      .delete()
      .eq('user_id', targetUserId);

    // 3. Foydalanuvchini o'zini o'chirish
    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .eq('id', targetUserId);

    if (delErr) {
      return res.status(500).json({ success: false, error: 'Foydalanuvchini oʻchirishda xatolik: ' + delErr.message });
    }

    await writeAudit('user_deleted', { userId: admin.userId, username: admin.username, ip: getClientIp(req), target: targetUserId });

    return res.status(200).json({
      success: true,
      message: 'Foydalanuvchi va uning barcha pochtalari muvaffaqiyatli oʻchirildi',
      deleted_user_id: targetUserId
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
