import { getSupabase } from './_supabase.js';
import { setCors, handleOptions } from './_cors.js';
import { setSecurityHeaders, parseBody } from './_utils.js';

// Quoted-Printable (e.g. =3D -> =, =\n -> '') decoder
function decodeQuotedPrintable(str) {
  if (!str) return '';
  // Faqat Quoted-Printable formatida bo'lsa (masalan =3D yoki =\r\n bo'lsa) dekodlaymiz.
  // Agar allaqachon dekodlangan bo'lsa, URL query paramlaridagi =20, =40 kabilarni buzmaslik uchun tegmaymiz!
  if (!/=3D/i.test(str) && !/=(?:\r\n|\n|\r)/.test(str)) {
    return str;
  }
  const unsoft = str.replace(/=(?:\r\n|\n|\r)/g, '');
  return unsoft.replace(/((?:=[0-9A-Fa-f]{2})+)/g, (match) => {
    try {
      const bytes = [];
      for (let i = 0; i < match.length; i += 3) {
        bytes.push(parseInt(match.substr(i + 1, 2), 16));
      }
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch (e) {
      return match;
    }
  });
}

// MIME Header (e.g. =?UTF-8?B?...?= or =?UTF-8?Q?...?=) decoder
function decodeMimeHeader(header) {
  if (!header) return '';
  return header.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const decoded = Buffer.from(text, 'base64');
        return new TextDecoder(charset || 'utf-8').decode(decoded);
      } else if (encoding.toUpperCase() === 'Q') {
        const qp = text.replace(/_/g, ' ');
        return decodeQuotedPrintable(qp);
      }
    } catch (e) {}
    return text;
  });
}

// Strip HTML tags for clean inbox snippet
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse MIME multipart & HTML
function parseEmailPayload(rawText, initialBody, initialHtml) {
  let text = initialBody || '';
  let html = initialHtml || '';

  const fullContent = rawText || initialBody || '';

  // 1. Agar boundary bo'lsa (multipart)
  const boundaryMatch = fullContent.match(/boundary=["']?([^"';\r\n]+)["']?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = fullContent.split('--' + boundary);

    for (const part of parts) {
      if (/content-type:\s*text\/html/i.test(part)) {
        const bodyStart = part.indexOf('\r\n\r\n');
        const altStart = part.indexOf('\n\n');
        const splitIdx = bodyStart !== -1 ? bodyStart + 4 : (altStart !== -1 ? altStart + 2 : -1);
        if (splitIdx !== -1) {
          html = part.substring(splitIdx).replace(/--$/, '').trim();
        }
      } else if (/content-type:\s*text\/plain/i.test(part)) {
        const bodyStart = part.indexOf('\r\n\r\n');
        const altStart = part.indexOf('\n\n');
        const splitIdx = bodyStart !== -1 ? bodyStart + 4 : (altStart !== -1 ? altStart + 2 : -1);
        if (splitIdx !== -1) {
          text = part.substring(splitIdx).replace(/--$/, '').trim();
        }
      }
    }
  }

  // 2. Agar html hali topilmagan bo'lsa, lekin contentda html teglari bo'lsa
  if (!html && (fullContent.includes('<!doctype html') || fullContent.includes('<html'))) {
    const lower = fullContent.toLowerCase();
    const idx = lower.indexOf('<!doctype html') !== -1 ? lower.indexOf('<!doctype html') : lower.indexOf('<html');
    html = fullContent.substring(idx).trim();
  }

  // 3. Quoted-Printable dekodlash
  if (html) html = decodeQuotedPrintable(html);
  if (text) text = decodeQuotedPrintable(text);

  // 4. Agar text bo'sh bo'lsa, uni HTML'dan toza matn qilib olamiz
  if (!text && html) {
    text = stripHtml(html);
  }

  return { text, html };
}

// Parse sender into clean display name and valid email address
function parseSender(fromNameRaw, fromAddressRaw, fallbackDomain = 'mail.local') {
  let displayName = (fromNameRaw || '').trim();
  let email = (fromAddressRaw || '').trim();

  // If fromNameRaw has format: "Anthropic" <no-reply@mail.anthropic.com>
  const match = displayName.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
  if (match) {
    displayName = match[1].trim();
    const extractedEmail = match[2].trim().toLowerCase();
    // If fromAddress was a bounce address, empty, or missing @, use the clean extracted email
    if (!email || email.includes('bounces+') || email.includes('bounce-') || !email.includes('@')) {
      email = extractedEmail;
    }
  } else if (displayName.includes('@') && !displayName.includes(' ')) {
    // If displayName is actually an email address
    if (!email || email.includes('bounces+')) {
      email = displayName.replace(/[<>]/g, '').trim().toLowerCase();
    }
  }

  // Remove surrounding quotes and brackets
  displayName = displayName.replace(/^["']+|["']+$/g, '').trim();
  email = email.replace(/[<>]/g, '').trim().toLowerCase();

  // Clean random VERP tracking hash from no-reply addresses (e.g. no-reply-k6ks6oole3u67k3659mibw@mail.anthropic.com -> no-reply@mail.anthropic.com)
  email = email.replace(/^(no-?reply)[+_-][a-zA-Z0-9_-]{6,}@/i, '$1@');

  // If displayName is empty, extract from email or fallback
  if (!displayName) {
    if (email && email.includes('@')) {
      displayName = email.split('@')[0];
    } else {
      displayName = 'Xabarchi';
    }
  }

  if (!email) {
    email = `no-reply@${fallbackDomain}`;
  }

  return { displayName, email };
}

// Clean trailing anti-threading timestamp from subject (e.g. "Subject | 2026-10-15 06:53:35" -> "Subject")
function cleanSubject(subject) {
  if (!subject) return 'Mavzusiz';
  return subject.replace(/\s*[|\-–]\s*\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?.*$/i, '').trim() || subject;
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Qattiq: webhook secret tekshiruvi (ixtiyoriy, lekin tavsiya etiladi)
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const provided = req.headers['x-webhook-secret'] || req.headers['authorization'] || '';
    const clean = provided.replace(/^Bearer\s+/i, '');
    if (clean !== webhookSecret) {
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const to_email = (body?.to || body?.recipient || body?.email_address || '').trim().toLowerCase();
    const rawFromName = decodeMimeHeader(body?.from_name || body?.sender_name || '');
    const _fallbackDomain = (process.env.MAIL_DOMAIN || 'mail.local').trim().toLowerCase();
    const rawFromAddress = body?.from || body?.from_address || '';
    let subject = cleanSubject(decodeMimeHeader(body?.subject || 'Mavzusiz'));

    // Toza nom va email manzilini ajratib olamiz
    const { displayName: from_name, email: from_address } = parseSender(rawFromName, rawFromAddress, _fallbackDomain);

    // MIME va HTML/Plain textni 1:1 mukammal ajratish
    const parsed = parseEmailPayload(body?.raw || '', body?.body || body?.text || '', body?.html || '');
    const MAX_BODY = 200_000;
    const MAX_SUBJECT = 500;
    let cleanText = parsed.text || 'Xat matni mavjud emas';
    let cleanHtml = parsed.html || '';
    if (cleanText.length > MAX_BODY) cleanText = cleanText.slice(0, MAX_BODY);
    if (cleanHtml.length > MAX_BODY) cleanHtml = cleanHtml.slice(0, MAX_BODY);
    if (subject.length > MAX_SUBJECT) subject = subject.slice(0, MAX_SUBJECT);
    
    if (!to_email) {
      return res.status(400).json({ success: false, error: 'to_email is required' });
    }

    // Bu email egasini topamiz
    const { data: emailRecord } = await supabase
      .from('emails')
      .select('user_id, address')
      .eq('address', to_email)
      .single();

    if (!emailRecord) {
      return res.status(404).json({ success: false, error: 'Recipient address not found in system' });
    }

    // Xabarni yozamiz
    const { data: insertedMsg, error: insErr } = await supabase
      .from('messages')
      .insert([{
        user_id: emailRecord.user_id,
        email_address: emailRecord.address,
        from_name: from_name || 'Xabarchi',
        from_address: from_address,
        subject: subject,
        body: cleanText,
        html: cleanHtml
      }])
      .select()
      .single();

    if (insErr) {
      return res.status(500).json({ success: false, error: insErr.message });
    }

    return res.status(200).json({ success: true, message: insertedMsg });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
