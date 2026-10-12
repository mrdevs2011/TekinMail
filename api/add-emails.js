import { getSupabase } from './_supabase.js';

const MAIL_TM_API = 'https://api.mail.tm';
const FALLBACK_DOMAINS = ['maxxspace.com'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

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
        error: `Account not found: ${accErr?.message || ''}` 
      });
    }

    // 2. Domen olish (Failover / Fallback bilan)
    let targetDomain = FALLBACK_DOMAINS[0];

    try {
      const domainsRes = await fetch(`${MAIL_TM_API}/domains`, {
        headers: DEFAULT_HEADERS
      });

      if (domainsRes.ok) {
        const domainsData = await domainsRes.json();
        const domainList = domainsData['hydra:member'] || [];
        if (domainList.length > 0 && domainList[0].domain) {
          targetDomain = domainList[0].domain;
        }
      }
    } catch (domainErr) {
      console.warn('Domain fetch failed, using fallback domain:', targetDomain);
    }

    // 3. 5 ta unikal email yaratish
    const createdEmails = [];
    const errorsList = [];

    for (let i = 0; i < 5; i++) {
      const randStr = Math.random().toString(36).substring(2, 7) + Date.now().toString(36).substring(4, 8);
      const emailAddress = `dev_${randStr}@${targetDomain}`;
      const password = 'Pass_' + Math.random().toString(36).substring(2, 10) + '9!';

      try {
        // Mail.tm ga ro'yxatdan o'tkazish
        const createRes = await fetch(`${MAIL_TM_API}/accounts`, {
          method: 'POST',
          headers: DEFAULT_HEADERS,
          body: JSON.stringify({ address: emailAddress, password: password })
        });

        if (!createRes.ok) {
          const errDetail = await createRes.text();
          errorsList.push(`Failed ${emailAddress}: HTTP ${createRes.status} ${errDetail}`);
          continue;
        }

        const createData = await createRes.json();
        const mailtmId = createData.id;

        // Token olish
        await sleep(200);
        const tokenRes = await fetch(`${MAIL_TM_API}/token`, {
          method: 'POST',
          headers: DEFAULT_HEADERS,
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
      const combinedError = errorsList.length > 0 ? errorsList.join('; ') : 'Unknown Mail.tm or Supabase failure';
      return res.status(500).json({
        success: false,
        error: combinedError,
        details: errorsList
      });
    }

    return res.status(200).json({
      success: true,
      added_count: createdEmails.length,
      emails: createdEmails,
      domain_used: targetDomain
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
