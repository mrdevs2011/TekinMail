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

    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_key', accountKey)
      .single();

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const { data: emails } = await supabase
      .from('emails')
      .select('id, address, token')
      .eq('account_id', account.id);

    if (!emails || emails.length === 0) {
      return res.status(200).json({ success: true, messages: [] });
    }

    // Har bir email tokeni bo'yicha xatlarni parallel olish
    const fetchPromises = emails.map(async (em) => {
      if (!em.token) return [];
      try {
        const inboxRes = await fetch(`https://api.tempmail.lol/auth/${encodeURIComponent(em.token)}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TekinMail/1.0'
          }
        });

        if (!inboxRes.ok) return [];
        const inboxData = await inboxRes.json();
        const emailList = inboxData.email || [];

        return emailList.map((m, idx) => ({
          id: `${em.id}_${idx}_${Date.now()}`,
          token: em.token,
          to_email: em.address,
          from: m.from || 'Unknown Sender',
          from_address: m.from || '',
          subject: m.subject || '(no subject)',
          intro: m.body ? m.body.substring(0, 120) : '',
          body: m.body || '',
          html: m.html || '',
          created_at: m.date ? new Date(m.date).toISOString() : new Date().toISOString()
        }));
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    const allMessages = results.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({
      success: true,
      messages: allMessages
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
