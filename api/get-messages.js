import { getSupabase } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    const accountKey = req.query.account_key;

    if (!accountKey) {
      return res.status(400).json({ success: false, error: 'account_key is required' });
    }

    // Supabase messages jadvalidan xatlarni olamiz
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`account_key.eq.${accountKey},account_key.eq.global`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(200).json({ success: true, messages: [] });
    }

    const formatted = (messages || []).map(m => ({
      id: m.id,
      to_email: m.to_email,
      from: m.from_address || 'Unknown Sender',
      from_address: m.from_address,
      subject: m.subject || '(no subject)',
      intro: (m.body || m.subject || '').substring(0, 100),
      body: m.body,
      html: m.html,
      created_at: m.created_at
    }));

    return res.status(200).json({
      success: true,
      messages: formatted
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
