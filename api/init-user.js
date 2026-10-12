import { getSupabase } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    let accountKey = req.query.account_key || (req.body && req.body.account_key);

    if (accountKey) {
      const { data: account } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_key', accountKey)
        .single();

      if (account) {
        const { data: emails } = await supabase
          .from('emails')
          .select('id, address, created_at')
          .eq('account_id', account.id)
          .order('created_at', { ascending: false });

        return res.status(200).json({
          success: true,
          account_id: account.id,
          account_key: account.account_key,
          emails: emails || []
        });
      }
    }

    const newAccountKey = 'tm_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    const { data: newAccount, error: createErr } = await supabase
      .from('accounts')
      .insert([{ account_key: newAccountKey }])
      .select()
      .single();

    if (createErr) {
      return res.status(500).json({ success: false, error: 'Database error: ' + createErr.message });
    }

    return res.status(200).json({
      success: true,
      account_id: newAccount.id,
      account_key: newAccount.account_key,
      emails: []
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
