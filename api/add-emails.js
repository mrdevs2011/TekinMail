import { getSupabase } from './_supabase.js';

const DOMAIN = 'tekinmail.abrdns.com';

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
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    let account_key = body?.account_key || req.query?.account_key;
    let account = null;

    if (account_key) {
      const { data: existingAccount } = await supabase
        .from('accounts')
        .select('id, account_key')
        .eq('account_key', account_key)
        .single();
      account = existingAccount;
    }

    // Hisob bo'lmasa, yangi hisob ochish
    if (!account) {
      account_key = 'tm_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const { data: newAcc, error: createErr } = await supabase
        .from('accounts')
        .insert([{ account_key }])
        .select('id, account_key')
        .single();

      if (createErr || !newAcc) {
        return res.status(500).json({ success: false, error: 'Supabase accounts error: ' + (createErr?.message || '') });
      }
      account = newAcc;
    }

    // 5 ta yangi unikal toza email yaratish (tekinmail.abrdns.com)
    const prefixes = [
      'dev', 'cl', 'ai', 'core', 'user', 'lab', 'box', 'hub', 'pro', 'bot'
    ];
    const createdEmails = [];

    for (let i = 0; i < 5; i++) {
      const randPref = prefixes[Math.floor(Math.random() * prefixes.length)];
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const emailAddress = `${randPref}_${randNum}@${DOMAIN}`;

      const { data: insertedEmail, error: insErr } = await supabase
        .from('emails')
        .insert([{
          account_id: account.id,
          mailtm_id: 'custom_' + Date.now() + '_' + i,
          address: emailAddress,
          password: 'none',
          token: 'token_' + Math.random().toString(36).substring(2)
        }])
        .select('id, address, created_at')
        .single();

      if (insertedEmail) {
        createdEmails.push(insertedEmail);
      }
    }

    return res.status(200).json({
      success: true,
      account_key: account.account_key,
      added_count: createdEmails.length,
      emails: createdEmails,
      domain_used: DOMAIN
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
