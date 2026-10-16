// ========================================================
// TEKINMAIL // BAN / SUSPEND DETECTOR
// --------------------------------------------------------
// Kiruvchi xat "akkaunt ban/suspend qilindi" xabari ekanini aniqlaydi.
// Fayl nomi "_" bilan boshlanadi — Vercel uni alohida function deb
// hisoblamaydi (Hobby 12-function limit buzilmaydi).
//
// Maqsad: FALSE POSITIVE = 0.  Aniq ishonch bo'lmasa — null qaytaradi.
// Uch qatlam himoya:
//   1) Jo'natuvchi domeni servisga mos bo'lishi SHART (anthropic.com ...)
//   2) Matnda BAJARILGAN harakat iborasi ("has been suspended",
//      "we have revoked your access") — ogohlantirish emas
//   3) Shartli/inkor gap ("if your account is suspended", "may be
//      suspended", "has not been banned") hisobga olinmaydi
// Ban bekor qilinsa ("reinstated", "appeal approved") — 'lifted' qaytadi.
// ========================================================

// Servislar. Yangisini qo'shish uchun shu ro'yxatga bitta obyekt qo'shing.
//  senders     — jo'natuvchi domen(lar)i (subdomain ham mos keladi)
//  requireText — (ixtiyoriy) xat matnida shu bo'lishi shart
//  excludeText — (ixtiyoriy) xat matnida shu bo'lsa, bu servis EMAS
export const SERVICES = [
  { id: 'anthropic', label: 'Anthropic', senders: ['anthropic.com', 'claude.ai', 'claude.com'] },
  { id: 'instagram', label: 'Instagram', senders: ['instagram.com', 'facebookmail.com'], requireText: /instagram/i },
  { id: 'facebook',  label: 'Facebook',  senders: ['facebook.com', 'facebookmail.com'], excludeText: /instagram/i },
  { id: 'openai',    label: 'OpenAI',    senders: ['openai.com'] },
  { id: 'tiktok',    label: 'TikTok',    senders: ['tiktok.com', 'tiktokmail.com'] },
  { id: 'discord',   label: 'Discord',   senders: ['discord.com', 'discordapp.com'] },
  { id: 'x',         label: 'X',         senders: ['x.com', 'twitter.com'] }
];

// --- Ban iboralari (bajarilgan harakat) ---------------------------------
const BAN_STATE = '(?:suspended|disabled|banned|terminated|deactivated|revoked)';
const BAN_PATTERNS = [
  // "Your account has been suspended" / "Your Claude account was disabled" / "access has been revoked"
  new RegExp(`\\b(?:your|the|this)\\s+(?:[\\w.-]+\\s+){0,3}?(?:account|profile|access)\\s+(?:has\\s+been|have\\s+been|was|were|is(?:\\s+now)?)\\s+(?:\\w+ly\\s+)?${BAN_STATE}\\b`, 'i'),
  // "We have revoked your access" / "We've disabled your account" / "we permanently banned the account"
  new RegExp(`\\bwe(?:'ve|\\s+have)?\\s+(?:\\w+ly\\s+)?${BAN_STATE}\\s+(?:your|access|the\\s+account)`, 'i'),
  // "revoked your access to Claude"
  /\b(?:revoked|terminated)\s+(?:your|all)\s+(?:\w+\s+)?access\b/i,
  // "You have been banned from ..." / "you've been suspended"
  /\byou(?:'ve|\s+have)\s+been\s+(?:\w+ly\s+)?(?:banned|suspended)\b/i,
  // "Access to Claude has been revoked"
  new RegExp(`\\baccess\\s+to\\s+(?:[\\w.-]+\\s+){1,3}?(?:has\\s+been|was|is)\\s+${BAN_STATE}\\b`, 'i'),
  // Apellyatsiya rad etildi — akkaunt baribir banda
  /\bappeal\b[^.!?\n]{0,40}\b(?:has\s+been|was|is|were)\s+(?:\w+ly\s+)?(?:denied|rejected|declined|refused)\b/i,
  /\bwe(?:'ve|\s+have)?\s+(?:denied|rejected|declined)\s+your\s+appeal\b/i
];

// --- Ban bekor qilindi iboralari ----------------------------------------
const LIFT_STATE = '(?:reinstated|restored|reactivated|re-?enabled|unsuspended|unbanned|unlocked|reopened)';
const LIFT_PATTERNS = [
  new RegExp(`\\b(?:your|the)\\s+(?:[\\w.-]+\\s+){0,3}?(?:account|access|profile)\\s+(?:has\\s+been|have\\s+been|was|is\\s+now|is)\\s+(?:\\w+ly\\s+)?${LIFT_STATE}\\b`, 'i'),
  new RegExp(`\\bwe(?:'ve|\\s+have)?\\s+(?:\\w+ly\\s+)?${LIFT_STATE}\\s+(?:your|access|the)`, 'i'),
  /\b(?:suspension|ban|restriction|block)\b[^.!?\n]{0,30}\b(?:lifted|removed|reversed|overturned)\b/i,
  /\bappeal\b[^.!?\n]{0,40}\b(?:has\s+been|was|is|were)\s+(?:\w+ly\s+)?(?:approved|accepted|granted|successful)\b/i,
  /\b(?:decision|restriction)\b[^.!?\n]{0,30}\b(?:was|has\s+been|is)\s+(?:overturned|reversed)\b/i
];

// Gap boshidan (match'gacha) shartli ibora bo'lsa — haqiqiy ban emas
const BAN_CONDITIONAL = /\b(?:if|unless|whether|in\s+case|what\s+happens|how\s+to|ways\s+to|avoid|prevent|learn\s+why|reasons?\s+(?:why|your))\b/i;
const LIFT_CONDITIONAL = /\b(?:if|unless|whether|in\s+case|once|when|until|as\s+soon\s+as|should|may|might|can|could|will|would|how\s+to)\b/i;
// Match ichida yoki undan oldin inkor bo'lsa
const NEGATION = /\b(?:not|never|no\s+longer|cannot|can't|won't|isn't|wasn't|hasn't|haven't|didn't|doesn't)\b|n't\b/i;

function normalize(s) {
  return String(s || '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

function splitSentences(text) {
  return normalize(text)
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .map((s) => (s.length > 400 ? s.slice(0, 400) : s));
}

// Eski javob-xat sitatalarini (">" bilan boshlangan qatorlar) tashlab yuboramiz
function stripQuoted(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*>/.test(l))
    .join('\n');
}

function extractAddresses(...values) {
  const out = new Set();
  for (const v of values) {
    const str = String(v || '').toLowerCase();
    const re = /[a-z0-9._%+'-]+@([a-z0-9.-]+\.[a-z]{2,})/g;
    let m;
    while ((m = re.exec(str)) !== null) out.add(m[1]);
  }
  return [...out];
}

function domainMatches(domain, allowed) {
  return allowed.some((d) => domain === d || domain.endsWith('.' + d));
}

// Xat DKIM/DMARC tekshiruvidan o'tmagan bo'lsa (soxta jo'natuvchi) — e'tiborsiz
function failedAuthentication(raw) {
  if (!raw) return false;
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headers = (headerEnd === -1 ? raw : raw.slice(0, headerEnd)).slice(0, 20000).replace(/\r?\n[ \t]+/g, ' ');
  const m = headers.match(/^authentication-results:\s*(.*)$/gim);
  if (!m) return false;
  return m.some((line) => /\b(?:dkim|dmarc)=fail\b/i.test(line));
}

function findStatement(sentences, patterns, conditional, { allowNegation = false } = {}) {
  for (const sentence of sentences) {
    for (const re of patterns) {
      const m = re.exec(sentence);
      if (!m) continue;
      const before = sentence.slice(0, m.index);
      if (conditional.test(before)) continue;
      if (!allowNegation) {
        if (NEGATION.test(m[0])) continue;
        // Match'dan oldingi 30 belgida inkor bo'lsa ("doesn't mean your account was suspended")
        if (NEGATION.test(before.slice(-30))) continue;
      }
      return sentence.length > 220 ? sentence.slice(0, 220) + '…' : sentence;
    }
  }
  return null;
}

/**
 * @param {object} p
 * @param {string} p.from       — envelope from (message.from)
 * @param {string} p.fromName   — "From" header to'liq qiymati
 * @param {string} p.fromAddress— tozalangan jo'natuvchi email
 * @param {string} p.subject
 * @param {string} p.text       — xat matni (plain yoki HTML'dan olingan)
 * @param {string} p.raw        — xom MIME (ixtiyoriy, autentifikatsiya sarlavhasi uchun)
 * @returns {null | {service:string, label:string, event:'banned'|'lifted', evidence:string}}
 */
export function detectAccountStatus({ from, fromName, fromAddress, subject, text, raw } = {}) {
  try {
    if (failedAuthentication(raw)) return null;

    const domains = extractAddresses(from, fromName, fromAddress);
    if (domains.length === 0) return null;

    const body = stripQuoted(text).slice(0, 6000);
    const haystackForServiceCheck = `${subject || ''}\n${body}`;

    // 1) Servisni jo'natuvchi domeni bo'yicha aniqlaymiz
    const service = SERVICES.find((s) => {
      if (!domains.some((d) => domainMatches(d, s.senders))) return false;
      if (s.requireText && !s.requireText.test(haystackForServiceCheck) && !s.requireText.test(String(fromName || ''))) return false;
      if (s.excludeText && s.excludeText.test(haystackForServiceCheck)) return false;
      return true;
    });
    if (!service) return null;

    const sentences = [...splitSentences(subject), ...splitSentences(body)];
    if (sentences.length === 0) return null;

    // 2) Avval "bekor qilindi" — u aniqroq va ban iborasini ham o'z ichiga olishi mumkin
    const lifted = findStatement(sentences, LIFT_PATTERNS, LIFT_CONDITIONAL);
    if (lifted) return { service: service.id, label: service.label, event: 'lifted', evidence: lifted };

    // 3) Ban
    const banned = findStatement(sentences, BAN_PATTERNS, BAN_CONDITIONAL);
    if (banned) return { service: service.id, label: service.label, event: 'banned', evidence: banned };

    return null;
  } catch (err) {
    // Detektor hech qachon xat qabul qilishni buzmasligi kerak
    console.warn('[ban-detector]', err && err.message);
    return null;
  }
}

// --- Bazaga qo'llash ------------------------------------------------------
// emailRecord: { id, user_id, address }
// Jadval hali yaratilmagan bo'lsa ham xato tashlamaydi.
export async function applyDetection(supabase, emailRecord, messageId, subject, detection) {
  if (!detection || !emailRecord) return { applied: false };
  try {
    const now = new Date().toISOString();
    if (detection.event === 'banned') {
      const { error } = await supabase.from('email_bans').upsert({
        email_id: emailRecord.id || null,
        user_id: emailRecord.user_id,
        address: emailRecord.address,
        service: detection.service,
        service_label: detection.label,
        status: 'banned',
        subject: String(subject || '').slice(0, 300),
        evidence: detection.evidence,
        message_id: messageId || null,
        detected_at: now,
        lifted_at: null
      }, { onConflict: 'address,service' });
      if (error) throw error;
      return { applied: true, event: 'banned' };
    }
    if (detection.event === 'lifted') {
      // Faqat avval 'banned' bo'lgan yozuvni bekor qilamiz (yo'q joyga yozmaymiz)
      const { error } = await supabase.from('email_bans')
        .update({ status: 'lifted', lifted_at: now, subject: String(subject || '').slice(0, 300), evidence: detection.evidence })
        .eq('address', emailRecord.address)
        .eq('service', detection.service)
        .eq('status', 'banned');
      if (error) throw error;
      return { applied: true, event: 'lifted' };
    }
  } catch (err) {
    console.warn('[ban-detector] DB yozilmadi:', err && err.message);
  }
  return { applied: false };
}
