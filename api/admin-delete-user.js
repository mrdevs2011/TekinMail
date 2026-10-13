import { getSupabase } from './_supabase.js';
import { requireAdmin } from './_auth.js';
import { writeAudit, getClientIp } from './_audit.js';
import { setCors, handleOptions } from './_cors.js';
import { parseBody, isValidUuid, setSecurityHeaders, jsonError, jsonOk } from './_utils.js';

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') return handleOptions(req, res, 'POST, OPTIONS');
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  try {
    const supabase = getSupabase();
    const admin = await requireAdmin(req, res, supabase);
    if (!admin) return;

    const body = parseBody(req);
    const targetUserId = body?.user_id || body?.userId;

    if (!isValidUuid(targetUserId)) {
      return jsonError(res, 400, 'Foydalanuvchi ID noto\u02bbg\u02bbri');
    }

    if (targetUserId === admin.userId) {
      return jsonError(res, 400, 'O\u02bbz admin akkauntingizni o\u02bbchira olmaysiz');
    }

    await supabase.from('messages').delete().eq('user_id', targetUserId);
    await supabase.from('emails').delete().eq('user_id', targetUserId);

    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .eq('id', targetUserId);

    if (delErr) {
      return jsonError(res, 500, 'Foydalanuvchini o\u02bbchirishda xatolik: ' + delErr.message);
    }

    try {
      await supabase.auth.admin.deleteUser(targetUserId);
    } catch (e) {
      console.error('[admin-delete-user] auth:', e?.message);
    }

    await writeAudit('user_deleted', {
      userId: admin.userId,
      username: admin.username,
      ip: getClientIp(req),
      target: targetUserId
    });

    return jsonOk(res, {
      message: 'Foydalanuvchi va uning barcha pochtalari muvaffaqiyatli o\u02bbchirildi',
      deleted_user_id: targetUserId
    });
  } catch (err) {
    console.error('[admin-delete-user]', err.message);
    return jsonError(res, 500, err.message || 'Server xatoligi');
  }
}
