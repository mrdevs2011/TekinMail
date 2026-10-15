import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';
import {
  parseBody, getBearerToken, setSecurityHeaders,
  jsonError, jsonOk, MAX_PREFIX_LEN,
  getAllowedDomains, getPrimaryDomain, isAllowedDomain
} from './_utils.js';

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

    const domains = getAllowedDomains();
    if (!domains.length) {
      return jsonError(res, 500, 'MAIL_DOMAIN / MAIL_DOMAINS sozlanmagan. Vercel Environment Variables da qo\u02bbshing.');
    }

    let requestedDomain = (body?.domain || '').trim().toLowerCase();
    if (requestedDomain && !isAllowedDomain(requestedDomain)) {
      return jsonError(res, 400, 'Bu domen ruxsat etilmagan');
    }
    const domain = requestedDomain || getPrimaryDomain();

    let customPrefix = (body?.prefix || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (customPrefix.length > MAX_PREFIX_LEN) {
      customPrefix = customPrefix.slice(0, MAX_PREFIX_LEN);
    }

    if (!customPrefix) {
      const { data: existingEmails } = await supabase
        .from('emails')
        .select('id')
        .eq('user_id', session.userId);
      const count = (existingEmails || []).length;
      customPrefix = count === 0 ? session.username : `${session.username}_${count + 1}`;
    }

    // Foydalanuvchi kiritgan prefiks aynan ishlatiladi
    const finalAddress = `${customPrefix}@${domain}`;

    const { data: duplicate } = await supabase
      .from('emails')
      .select('id')
      .eq('address', finalAddress)
      .maybeSingle();

    if (duplicate) {
      return jsonError(res, 409, 'Bu email allaqachon band');
    }

    const { data: inserted, error: insErr } = await supabase
      .from('emails')
      .insert([{
        user_id: session.userId,
        address: finalAddress,
        token: 'tk_' + Math.random().toString(36).substring(2, 14)
      }])
      .select('id, address, created_at')
      .single();

    if (insErr) {
      return jsonError(res, 500, 'Emailni saqlashda xatolik: ' + insErr.message);
    }

    return jsonOk(res, { email: inserted });
  } catch (err) {
    console.error('[add-emails]', err.message);
    return jsonError(res, 500, err.message || 'Internal server error');
  }
}
