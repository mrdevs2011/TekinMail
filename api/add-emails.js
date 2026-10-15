import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { verifySessionToken } from './_auth.js';
import {
  parseBody, getBearerToken, setSecurityHeaders,
  jsonError, jsonOk, MAX_PREFIX_LEN
} from './_utils.js';

const DOMAIN = (process.env.MAIL_DOMAIN || '').trim().toLowerCase();

const FIRST_NAMES = [
  'anvar', 'jasur', 'rustam', 'dilshod', 'sardor', 'bobur', 'azamat', 'sanjar',
  'farhod', 'ulugbek', 'eldor', 'shohruh', 'nodir', 'umid', 'jamshid', 'davron',
  'kamol', 'otabek', 'sherzod', 'bekzod', 'muzaffar', 'ilhom', 'alisher', 'timur'
];

const LAST_NAMES = [
  'karimov', 'sattorov', 'rahimov', 'alimov', 'usmonov', 'yusupov', 'nurmatov',
  'umarov', 'tursunov', 'qodirov', 'mahmudov', 'xalilov', 'ahmedov', 'nazarov',
  'isroilov', 'holiqov', 'valiyev', 'samadov', 'toirov', 'shokirov'
];

const ROLES = [
  'dev', 'qa', 'tech', 'eng', 'cloud', 'data', 'ops', 'sec', 'lead', 'core'
];

function generateHumanizedPrefix() {
  const mode = Math.floor(Math.random() * 3);
  const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const rl = ROLES[Math.floor(Math.random() * ROLES.length)];
  const year = 85 + Math.floor(Math.random() * 18);

  if (mode === 0) {
    const withNum = Math.random() > 0.4 ? year : '';
    return `${fn}.${ln}${withNum}`;
  } else if (mode === 1) {
    const sep = Math.random() > 0.5 ? '.' : '_';
    return `${fn}${sep}${rl}`;
  } else {
    return `${fn[0]}.${ln}`;
  }
}

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

    if (!DOMAIN) {
      return jsonError(res, 500, 'MAIL_DOMAIN sozlanmagan. Vercel Environment Variables da qo\u02bbshing.');
    }

    let customPrefix = (body?.prefix || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (customPrefix.length > MAX_PREFIX_LEN) {
      customPrefix = customPrefix.slice(0, MAX_PREFIX_LEN);
    }

    // Agar prefiks kiritilmagan bo'lsa yoki robot/raqamli formatda bo'lsa (masalan 1, 2.1, 3.1)
    // antifrod filtrlarga tushmasligi uchun insoniy ism-sharif generatsiya qilamiz
    const isBotLike = !customPrefix || /^\d+(\.\d+)?$/.test(customPrefix) || /^[0-9._-]+$/.test(customPrefix);

    let finalAddress = '';
    let duplicate = true;
    let attempts = 0;

    while (duplicate && attempts < 10) {
      attempts++;
      let prefix = isBotLike ? generateHumanizedPrefix() : customPrefix;
      if (attempts > 1 && !isBotLike) {
        prefix = `${customPrefix}_${attempts}`;
      }
      finalAddress = `${prefix}@${DOMAIN}`;

      const { data: dupCheck } = await supabase
        .from('emails')
        .select('id')
        .eq('address', finalAddress)
        .maybeSingle();

      duplicate = !!dupCheck;
    }

    if (duplicate) {
      return jsonError(res, 409, 'Bu email allaqachon band. Iltimos qaytadan urinib ko\'ring.');
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
