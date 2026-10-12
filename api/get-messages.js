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

    const fetchPromises = emails.map(async (em) => {
      if (!em.token) return [];
      try {
        const msgRes = await fetch(`${MAIL_TM_API}/messages`, {
          headers: {
            'Authorization': `Bearer ${em.token}`,
            'Accept': 'application/json'
          }
        });

        if (!msgRes.ok) return [];
        const msgData = await msgRes.json();
        const list = msgData['hydra:member'] || [];

        return list.map((m) => ({
          id: m.id,
          to_email: em.address,
          from: m.from ? `${m.from.name || ''} <${m.from.address}>`.trim() : 'Unknown',
          from_address: m.from?.address || '',
          subject: m.subject || '(no subject)',
          intro: m.intro || '',
          created_at: m.createdAt,
          has_attachments: m.hasAttachments || false
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
