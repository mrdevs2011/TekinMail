import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Qattiq: faqat Service Role. Anon key ga hech qachon tushmasin.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY majburiy! ' +
    'Vercel Environment Variables da to\'g\'ri qo\'ying. ANON_KEY ishlatilmaydi.'
  );
}

export function getSupabase() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
