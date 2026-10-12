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

    const { step, pass1, pass2 } = body || {};

    const { data: auth, error } = await supabase
      .from('admin_auth')
      .select('pass1, pass2')
      .eq('id', 1)
      .single();

    if (error || !auth) {
      return res.status(500).json({ 
        success: false, 
        error: 'Admin auth table not initialized in Supabase' 
      });
    }

    // 1-bosqich tekshiruvi
    if (step === 1) {
      if (pass1 === auth.pass1) {
        return res.status(200).json({ success: true, next_step: 2 });
      }
      return res.status(401).json({ success: false, error: '1-parol notoʻgʻri' });
    }

    // 2-bosqich tekshiruvi
    if (step === 2) {
      if (pass1 === auth.pass1 && pass2 === auth.pass2) {
        return res.status(200).json({ 
          success: true, 
          token: 'auth_' + Date.now().toString(36) 
        });
      }
      return res.status(401).json({ success: false, error: '2-parol notoʻgʻri' });
    }

    return res.status(400).json({ success: false, error: 'Invalid step' });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
