import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabase() {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  // Faqat Service Role — Anon key hech qachon ishlatilmasin
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY majburiy. ' +
      'Vercel → Project → Settings → Environment Variables da sozlang.'
    );
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  return _client;
}
