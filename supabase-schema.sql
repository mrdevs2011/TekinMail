-- ========================================================
-- TEKINMAIL // MASTER DATABASE SCHEMA FOR SUPABASE
-- Yangi Supabase loyihasi uchun yagona, mukammal SQL skript
-- ========================================================

-- 1. FOYDALANUVCHILAR JADVALI (ROOT AKKAUNTLAR - HECH QANDAY EMAIL KERAK EMAS)
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

-- 3. TEZKOR QIDIRUV INDEKSLARI
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_address ON public.emails(address);

-- 4. ROW LEVEL SECURITY (RLS) YOQISH
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- 5. API UCHUN RUXSAT SIYOSATLARI (POLICIES)
DROP POLICY IF EXISTS "Allow public all on users" ON public.users;
CREATE POLICY "Allow public all on users" ON public.users 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on emails" ON public.emails;
CREATE POLICY "Allow public all on emails" ON public.emails 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
