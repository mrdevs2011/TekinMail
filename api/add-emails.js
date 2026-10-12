import { getSupabase } from './_supabase.js';

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

    // Agar hisob bo'lmasa, yangi yaratamiz
    if (!account) {
      account_key = 'tm_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const { data: newAcc, error: createErr } = await supabase
        .from('accounts')
        .insert([{ account_key }])
        .select('id, account_key')
        .single();

      if (createErr || !newAcc) {
        return res.status(500).json({ 
          success: false, 
          error: 'Supabase accounts error: ' + (createErr?.message || '') 
        });
      }
      account = newAcc;
    }

    // 5 ta yangi email yaratish (tempmail.lol orqali)
    const createdEmails = [];
    const errorsList = [];

    for (let i = 0; i < 5; i++) {
      try {
        const genRes = await fetch('https://api.tempmail.lol/generate', {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TekinMail/1.0'
          }
        });

        if (!genRes.ok) {
          const errTxt = await genRes.text();
          errorsList.push(`tempmail API HTTP ${genRes.status}: ${errTxt}`);
          continue;
        }

        const genData = await genRes.json();
        const address = genData.address;
        const token = genData.token;

        if (!address || !token) {
          errorsList.push('Invalid response from tempmail API');
          continue;
        }

        // Supabase'ga yozish
        const { data: insertedEmail, error: insErr } = await supabase
          .from('emails')
          .insert([{
            account_id: account.id,
            mailtm_id: token.substring(0, 36), // ID o'rnida token qismi
            address: address,
            password: 'none',
            token: token
          }])
          .select('id, address, created_at')
          .single();

        if (insErr) {
          errorsList.push(`Supabase insert failed: ${insErr.message}`);
        } else if (insertedEmail) {
          createdEmails.push(insertedEmail);
        }

        await sleep(150); // Xavfsiz oraliq
      } catch (err) {
        errorsList.push(`Loop error: ${err.message}`);
      }
    }

    if (createdEmails.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to allocate addresses: ' + errorsList.join('; '),
        details: errorsList
      });
    }

    return res.status(200).json({
      success: true,
      account_key: account.account_key,
      added_count: createdEmails.length,
      emails: createdEmails
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
