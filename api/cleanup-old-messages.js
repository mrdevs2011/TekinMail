import { getSupabase } from './_supabase.js';
import { setSecurityHeaders, jsonError, jsonOk } from './_utils.js';

/**
 * Vercel Cron: eski xabarlarni avtomatik o'chirish.
 * GET /api/cleanup-old-messages
 * Auth: Authorization: Bearer $CRON_SECRET yoki ?secret=
 * Env: MESSAGE_TTL_DAYS (default 30)
 */
export default async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const authHeader = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const querySecret = (req.query?.secret || '').trim();
  const provided = authHeader || querySecret;

  // Vercel Cron avtomatik Authorization: Bearer <CRON_SECRET> yuboradi
  if (cronSecret && provided !== cronSecret) {
    return jsonError(res, 401, 'Unauthorized');
  }
  // CRON_SECRET yo'q bo'lsa ham local/dev da ishlashi uchun faqat production da majburiy
  if (!cronSecret && process.env.VERCEL_ENV === 'production') {
    return jsonError(res, 500, 'CRON_SECRET sozlanmagan');
  }

  try {
    const days = Math.max(1, parseInt(process.env.MESSAGE_TTL_DAYS || '30', 10) || 30);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const supabase = getSupabase();

    // Batch delete eski xabarlar
    const { data, error, count } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      console.error('[cleanup]', error.message);
      return jsonError(res, 500, error.message);
    }

    const deleted = Array.isArray(data) ? data.length : (count || 0);
    console.log(`[cleanup] deleted ${deleted} messages older than ${days} days (before ${cutoff})`);

    // Eski login_attempts ham tozalash (7 kun)
    const loginCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('login_attempts').delete().lt('created_at', loginCutoff);

    return jsonOk(res, {
      deleted,
      cutoff,
      ttlDays: days,
      message: `${deleted} ta eski xabar o'chirildi`
    });
  } catch (err) {
    console.error('[cleanup]', err.message);
    return jsonError(res, 500, err.message || 'Internal server error');
  }
}
