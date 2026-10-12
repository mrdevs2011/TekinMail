import { getSupabase } from './_supabase.js';

const MAIL_TM_API = 'https://api.mail.tm';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    // Body parsing
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const account_key = body?.account_key;

    if (!account_key) {
      return res.status(400).json({ success: false, error: 'account_key is required in request body' });
    }

    // 1. Account tekshirish
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_key', account_key)
      .single();

    if (accErr || !account) {
      return res.status(404).json({ 
        success: false, 
        error: `Account with key '${account_key}' not found in Supabase. (${accErr?.message || ''})` 
      });
    }

    // 2. Mail.tm domenlarini olish
    const domainsRes = await fetch(`${MAIL_TM_API}/domains`);
    if (!domainsRes.ok) {
      const errText = await domainsRes.text();
      return res.status(502).json({ 
        success: false, 
        error: `Mail.tm domain fetch failed: ${domainsRes.status} ${errText}` 
      });
    }

    const domainsData = await domainsRes.json();
    const domainList = domainsData['hydra:member'] || [];

    if (domainList.length === 0) {
      return res.status(503).json({ success: false, error: 'Mail.tm returned no active domains' });
    }

    const targetDomain = domainList[0].domain;

    // 3. 5 ta unikal email yaratish
    const createdEmails = [];
    const errorsList = [];

    for (let i = 0; i < 5; i++) {
      const randStr = Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(4);
      const emailAddress = `tk_${randStr}@${targetDomain}`;
      const password = 'Pass_' + Math.random().toString(36).substring(2, 10) + '9!';

      try {
        // Mail.tm ga ro'yxatdan o'tkazish
        const createRes = await fetch(`${MAIL_TM_API}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: emailAddress, password: password })
        });

        if (!createRes.ok) {
          const errDetail = await createRes.text();
          errorsList.push(`Failed ${emailAddress}: ${errDetail}`);
          continue;
        }

        const createData = await createRes.json();
        const mailtmId = createData.id;

        // Token olish
        await sleep(150);
        const tokenRes = await fetch(`${MAIL_TM_API}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: emailAddress, password: password })
        });

        let token = '';
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          token = tokenData.token;
        }

        // Supabase'ga yozish
        const { data: insertedEmail, error: insErr } = await supabase
          .from('emails')
          .insert([{
            account_id: account.id,
            mailtm_id: mailtmId,
            address: emailAddress,
            password: password,
            token: token
          }])
          .select('id, address, created_at')
          .single();

        if (insErr) {
          errorsList.push(`Supabase insert failed: ${insErr.message}`);
        } else if (insertedEmail) {
          createdEmails.push(insertedEmail);
        }

        await sleep(250);
      } catch (loopErr) {
        errorsList.push(`Loop error: ${loopErr.message}`);
      }
    }

    if (createdEmails.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create any email.',
        details: errorsList
      });
    }

    return res.status(200).json({
      success: true,
      added_count: createdEmails.length,
      emails: createdEmails,
      warnings: errorsList.length > 0 ? errorsList : undefined
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
