import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables missing! Please check SUPABASE_URL and SUPABASE_ANON_KEY in Vercel settings.');
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}
