// ========================================================
// Eski xatlarni skanerlab ban holatlarini tiklash (backfill).
// /api/config?action=rescan-bans[&apply=1][&all=1] orqali chaqiriladi.
//  - Faqat tizimga kirgan foydalanuvchi: O'Z xatlarini skanerlaydi
//  - all=1 faqat admin uchun (hamma foydalanuvchilar)
//  - apply=1 bo'lmasa dry-run: hech narsa yozilmaydi
// ========================================================
import { getSupabase } from './_supabase.js';
import { verifySessionToken } from './_auth.js';
import { getBearerToken } from './_utils.js';
import { detectAccountStatus } from './_ban-detector.js';

const PAGE = 500;
const MAX_PAGES = 10; // 5000 ta xatgacha (Vercel vaqt chegarasi uchun)

const strip = (h) => String(h || '')
  .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();

export async function rescanBans(req, res) {
  const session = await verifySessionToken(getBearerToken(req));
  if (!session) return res.status(401).json({ success: false, error: 'Avtorizatsiyadan o\u02bbtmagan' });

  const apply = req.query?.apply === '1';
  const all = req.query?.all === '1';
  if (all && !(session.is_admin || session.username?.toLowerCase() === 'admin')) {
    return res.status(403).json({ success: false, error: 'all=1 faqat admin uchun' });
  }

  try {
    const supabase = getSupabase();

    const probe = await supabase.from('email_bans').select('id').limit(1);
    if (probe.error) {
      return res.status(500).json({ success: false, error: 'email_bans jadvali yo\u02bbq: ' + probe.error.message });
    }

    let emailQ = supabase.from('emails').select('id, user_id, address');
    if (!all) emailQ = emailQ.eq('user_id', session.userId);
    const { data: emails, error: eErr } = await emailQ;
    if (eErr) throw eErr;
    const emailByAddr = new Map((emails || []).map((e) => [e.address, e]));

    const state = new Map(); // "address|service" -> yozuv
    let scanned = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      let q = supabase.from('messages')
        .select('id, email_address, from_name, from_address, subject, body, html, created_at')
        .order('created_at', { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (!all) q = q.eq('user_id', session.userId);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || !data.length) break;

      for (const m of data) {
        scanned++;
        if (!emailByAddr.has(m.email_address)) continue;
        const text = (m.body && m.body !== 'Xat matni mavjud emas') ? m.body : strip(m.html);
        const det = detectAccountStatus({
          from: m.from_address,
          fromName: `${m.from_name || ''} <${m.from_address || ''}>`,
          fromAddress: m.from_address,
          subject: m.subject,
          text
        });
        if (!det) continue;
        const k = `${m.email_address}|${det.service}`;
        if (det.event === 'banned') {
          state.set(k, { m, det, status: 'banned', liftedAt: null });
        } else if (state.get(k)?.status === 'banned') {
          state.get(k).status = 'lifted';
          state.get(k).liftedAt = m.created_at;
        }
      }
      if (data.length < PAGE) break;
    }

    const found = [...state.values()].map((s) => ({
      address: s.m.email_address, service: s.det.service, status: s.status, subject: s.m.subject, at: s.m.created_at
    }));

    let written = 0;
    if (apply && state.size) {
      let exQ = supabase.from('email_bans').select('address, service, detected_at');
      if (!all) exQ = exQ.eq('user_id', session.userId);
      const { data: existing } = await exQ;
      const exMap = new Map((existing || []).map((r) => [`${r.address}|${r.service}`, r.detected_at]));

      const rows = [];
      for (const [k, s] of state) {
        const rec = emailByAddr.get(s.m.email_address);
        const prev = exMap.get(k);
        // Real vaqtda aniqlangan (yangiroq) yozuvni eski xat bilan ustidan yozmaymiz
        if (prev && prev >= s.m.created_at) continue;
        rows.push({
          email_id: rec.id, user_id: rec.user_id, address: rec.address,
          service: s.det.service, service_label: s.det.label, status: s.status,
          subject: String(s.m.subject || '').slice(0, 300), evidence: s.det.evidence,
          message_id: s.m.id, detected_at: s.m.created_at, lifted_at: s.liftedAt
        });
      }
      if (rows.length) {
        const { error } = await supabase.from('email_bans').upsert(rows, { onConflict: 'address,service' });
        if (error) throw error;
        written = rows.length;
      }
    }

    return res.status(200).json({ success: true, dryRun: !apply, scanned, found, written });
  } catch (err) {
    console.error('[rescan-bans]', err.message);
    return res.status(500).json({ success: false, error: err.message || 'rescan failed' });
  }
}
