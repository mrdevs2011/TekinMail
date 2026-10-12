import { getSupabase } from './_supabase.js';

const MAIL_TM_API = 'https://api.mail.tm';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    const { message_id, to_email } = req.query;

    if (!message_id || !to_email) {
      return res.status(400).json({ success: false, error: 'message_id and to_email are required' });
    }

    const { data: emailRecord } = await supabase
      .from('emails')
      .select('token')
      .eq('address', to_email)
      .single();

    if (!emailRecord || !emailRecord.token) {
      return res.status(404).json({ success: false, error: 'Email record or token not found' });
    }

    const detailRes = await fetch(`${MAIL_TM_API}/messages/${message_id}`, {
      headers: {
        'Authorization': `Bearer ${emailRecord.token}`,
        'Accept': 'application/json'
      }
    });

    if (!detailRes.ok) {
      return res.status(detailRes.status).json({ success: false, error: 'Failed to fetch message details' });
    }

    const messageData = await detailRes.json();

    return res.status(200).json({
      success: true,
      message: {
        id: messageData.id,
        to: to_email,
        from: messageData.from,
        subject: messageData.subject,
        intro: messageData.intro,
        text: messageData.text,
        html: messageData.html ? messageData.html.join('') : '',
        created_at: messageData.createdAt
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
