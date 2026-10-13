import { getSupabase } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    const from_name = body?.from_name || body?.sender_name || 'Supabase';
    const from_address = body?.from || body?.from_address || 'no-reply@supabase.io';
    const subject = body?.subject || 'Welcome to Supabase';
    const textBody = body?.body || body?.text || 'Welcome to Supabase, the Postgres development platform.';
    const htmlBody = body?.html || '';

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
        from_name: from_name,
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
