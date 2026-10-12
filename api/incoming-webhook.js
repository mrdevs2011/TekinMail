import { getSupabase } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const to_email = body?.to || body?.recipient || body?.to_email || 'unknown@tekinmail.abrdns.com';
    const from_address = body?.from || body?.sender || body?.from_address || 'unknown';
    const subject = body?.subject || '(no subject)';
    const textBody = body?.text || body?.body || body?.plain || '';
    const htmlBody = body?.html || '';

    // Qaysi hisobga tegishli ekanini qidiramiz
    const { data: emailRecord } = await supabase
      .from('emails')
      .select('accounts(account_key)')
      .eq('address', to_email.toLowerCase().trim())
      .single();

    const account_key = emailRecord?.accounts?.account_key || 'global';

    // Bazaga saqlaymiz
    const { data: insertedMsg, error: insErr } = await supabase
      .from('messages')
      .insert([{
        account_key: account_key,
        to_email: to_email,
        from_address: from_address,
        subject: subject,
        body: textBody,
        html: htmlBody
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
