import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';
import { getBearerToken, setSecurityHeaders, jsonError, jsonOk } from './_utils.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET, OPTIONS');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') return handleOptions(req, res, 'GET, OPTIONS');
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');

  try {
    const supabase = getSupabase();
    const token = getBearerToken(req);
    const session = await verifySessionToken(token);
    if (!session) return jsonError(res, 401, 'Avtorizatsiyadan o\u02bbtmagan');

    const { data: emails, error } = await supabase
      .from('emails')
      .select('id, address, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    if (error) return jsonError(res, 500, error.message);

    // Ban holatlari (jadval hali yaratilmagan bo'lsa ham emaillar ro'yxati ishlayveradi)
    const bansByAddress = {};
    try {
      const { data: bans, error: banErr } = await supabase
        .from('email_bans')
        .select('address, service, service_label, subject, detected_at')
        .eq('user_id', session.userId)
        .eq('status', 'banned');
      if (!banErr) {
        for (const b of bans || []) {
          (bansByAddress[b.address] = bansByAddress[b.address] || []).push({
            service: b.service,
            label: b.service_label,
            subject: b.subject,
            detected_at: b.detected_at
          });
        }
      }
    } catch (e) { /* ignore */ }

    return jsonOk(res, {
      domain: (process.env.MAIL_DOMAIN || '').trim().toLowerCase(),
      emails: (emails || []).map((e) => ({ ...e, bans: bansByAddress[e.address] || [] }))
    });
  } catch (err) {
    console.error('[get-emails]', err.message);
    return jsonError(res, 500, err.message || 'Server xatoligi');
  }
}
