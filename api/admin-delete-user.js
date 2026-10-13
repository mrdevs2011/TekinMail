import { getSupabase } from './_supabase.js';
import { requireAdmin } from './_auth.js';
import { writeAudit, getClientIp } from './_audit.js';
import { setCors, handleOptions } from './_cors.js';

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return handleOptions(req, res, 'POST, OPTIONS');
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
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const targetUserId = body?.user_id || body?.userId;
    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ success: false, error: 'Foydalanuvchi ID ko\u02bbrsatilmadi' });
    }

    if (targetUserId === admin.userId) {
      return res.status(400).json({ success: false, error: 'O\u02bbz admin akkauntingizni o\u02bbchira olmaysiz' });
    }

    // Cascade: messages → emails → public.users → auth.users
    await supabase.from('messages').delete().eq('user_id', targetUserId);
    await supabase.from('emails').delete().eq('user_id', targetUserId);

    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .eq('id', targetUserId);

    if (delErr) {
      return res.status(500).json({
        success: false,
        error: 'Foydalanuvchini o\u02bbchirishda xatolik: ' + delErr.message
      });
    }

    // Auth user ni ham o\u02bbchirish (orphan qoldirmaslik)
    try {
      await supabase.auth.admin.deleteUser(targetUserId);
    } catch (authDelErr) {
      console.error('[admin-delete-user] auth delete:', authDelErr?.message);
    }

    await writeAudit('user_deleted', {
      userId: admin.userId,
      username: admin.username,
      ip: getClientIp(req),
      target: targetUserId
    });

    return res.status(200).json({
      success: true,
      message: 'Foydalanuvchi va uning barcha pochtalari muvaffaqiyatli o\u02bbchirildi',
      deleted_user_id: targetUserId
    });

  } catch (err) {
    console.error('[admin-delete-user]', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
