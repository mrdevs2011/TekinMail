-- ========================================================
-- TEKINMAIL // MASTER DATABASE SCHEMA FOR SUPABASE
-- ========================================================

-- 1. FOYDALANUVCHILAR JADVALI (ROOT AKKAUNTLAR)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. FOYDALANUVCHINING SHAXSIY EMAILLARI JADVALI
CREATE TABLE IF NOT EXISTS public.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    address TEXT NOT NULL,
    token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. KIRUVCHI XABARLAR JADVALI (INBOX)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    email_address TEXT NOT NULL,
    from_name TEXT,
    from_address TEXT,
    subject TEXT,
    body TEXT,
    html TEXT,
    is_starred BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TEZKOR QIDIRUV INDEKSLARI
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_address ON public.emails(address);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_email_address ON public.messages(email_address);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- API RUXSATLARI
DROP POLICY IF EXISTS "Allow public all on users" ON public.users;
CREATE POLICY "Allow public all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on emails" ON public.emails;
CREATE POLICY "Allow public all on emails" ON public.emails FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on messages" ON public.messages;
CREATE POLICY "Allow public all on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
