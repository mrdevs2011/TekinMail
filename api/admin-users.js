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

    // 1. Foydalanuvchilar ro'yxatini olish
    let users = [];
    const { data: usersWithAdmin, error: uErr1 } = await supabase
      .from('users')
      .select('id, full_name, username, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (!uErr1 && usersWithAdmin) {
      users = usersWithAdmin;
    } else {
      const { data: usersBasic, error: uErr2 } = await supabase
        .from('users')
        .select('id, full_name, username, created_at')
        .order('created_at', { ascending: false });

      if (uErr2) throw uErr2;
      users = (usersBasic || []).map(u => ({
        ...u,
        is_admin: u.username?.toLowerCase() === 'admin'
      }));
    }

    // 2. Har bir foydalanuvchining ochgan emaillari va kelgan xatlari sonini hisoblash
    const { data: emails } = await supabase.from('emails').select('user_id');
    const { data: messages } = await supabase.from('messages').select('user_id');

    const emailCounts = {};
    (emails || []).forEach(e => {
      emailCounts[e.user_id] = (emailCounts[e.user_id] || 0) + 1;
    });

    const msgCounts = {};
    (messages || []).forEach(m => {
      msgCounts[m.user_id] = (msgCounts[m.user_id] || 0) + 1;
    });

    const enrichedUsers = users.map(u => ({
      id: u.id,
      full_name: u.full_name,
      username: u.username,
      is_admin: Boolean(u.is_admin || u.username?.toLowerCase() === 'admin'),
      created_at: u.created_at,
      email_count: emailCounts[u.id] || 0,
      message_count: msgCounts[u.id] || 0
    }));

    return res.status(200).json({
      success: true,
      users: enrichedUsers,
      stats: {
        total_users: enrichedUsers.length,
        total_emails: (emails || []).length,
        total_messages: (messages || []).length
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server xatoligi' });
  }
}
