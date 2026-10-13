import { getSupabase } from './_supabase.js';
import { requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    const admin = await requireAdmin(req, res, supabase);
    if (!admin) return;

    const targetUserId = req.query?.user_id || req.query?.userId;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Foydalanuvchi ID koʻrsatilmadi' });
    }

    // 1. Foydalanuvchi ma'lumotlari
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id, full_name, username, created_at')
      .eq('id', targetUserId)
      .single();

    if (uErr || !user) {
      return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }

    // 2. Foydalanuvchining barcha email manzillari
    const { data: emails, error: eErr } = await supabase
      .from('emails')
      .select('id, address, created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    // 3. Foydalanuvchiga kelgan barcha xabarlar
    const { data: messages, error: mErr } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    return res.status(200).json({
      success: true,
      user,
      emails: emails || [],
      messages: messages || []
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
