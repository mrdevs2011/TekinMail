import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';
import { parseBody, getBearerToken, setSecurityHeaders, jsonError, jsonOk } from './_utils.js';

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') return handleOptions(req, res, 'POST, OPTIONS');
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  try {
    const supabase = getSupabase();
    const body = parseBody(req);
    const token = getBearerToken(req, body);
    const session = await verifySessionToken(token);
    if (!session) return jsonError(res, 401, 'Avtorizatsiyadan o\u02bbtmagan');

    // Ommaviy o'chirish: scope = 'banned' (faqat banned emaillar) yoki 'all' (barcha emaillar)
    const scope = body?.scope;
    if (scope === 'banned' || scope === 'all') {
      if (body?.confirm !== true) return jsonError(res, 400, 'Tasdiqlash talab qilinadi');

      const uid = session.userId;
      const removed = [];
      // Supabase bir so'rovda cheklangan qator qaytaradi, shuning uchun bo'laklab o'chiramiz
      for (let round = 0; round < 60; round++) {
        let rows;
        if (scope === 'banned') {
          const { data, error: bErr } = await supabase
            .from('email_bans')
            .select('address')
            .eq('user_id', uid)
            .eq('status', 'banned')
            .limit(500);
          if (bErr) return jsonError(res, 500, bErr.message);
          rows = data;
        } else {
          const { data, error: aErr } = await supabase
            .from('emails')
            .select('address')
            .eq('user_id', uid)
            .limit(500);
          if (aErr) return jsonError(res, 500, aErr.message);
          rows = data;
        }
        const chunk = [...new Set((rows || []).map((r) => r.address))];
        if (chunk.length === 0) break;

        // Faqat shu foydalanuvchining ma'lumotlari (user_id har doim filtrda)
        await supabase.from('messages').delete().eq('user_id', uid).in('email_address', chunk);
        await supabase.from('email_bans').delete().eq('user_id', uid).in('address', chunk);
        const { data: del, error: dErr } = await supabase
          .from('emails')
          .delete()
          .eq('user_id', uid)
          .in('address', chunk)
          .select('address');
        if (dErr) return jsonError(res, 500, dErr.message);
        (del || []).forEach((d) => removed.push(d.address));
        // Banned yozuvi bor-u, email qatori yo'q bo'lsa ham keyingi aylanishda bans tozalanib bo'lgan
        if (scope === 'all' && (!del || del.length === 0)) break;
      }

      return jsonOk(res, { scope, deleted: removed.length, addresses: removed });
    }

    const address = (body?.address || '').trim().toLowerCase();
    if (!address || !address.includes('@') || address.length > 254) {
      return jsonError(res, 400, 'Email manzili ko\u02bbrsatilmadi');
    }

    await supabase
      .from('messages')
      .delete()
      .eq('user_id', session.userId)
      .eq('email_address', address);

    const { data: deleted, error } = await supabase
      .from('emails')
      .delete()
      .eq('user_id', session.userId)
      .eq('address', address)
      .select('id');

    if (error) return jsonError(res, 500, error.message);
    if (!deleted || deleted.length === 0) {
      return jsonError(res, 404, 'Email topilmadi');
    }

    return jsonOk(res, { message: 'Email butunlay o\u02bbchirildi', address });
  } catch (err) {
    console.error('[delete-email]', err.message);
    return jsonError(res, 500, err.message || 'Server xatoligi');
  }
}
