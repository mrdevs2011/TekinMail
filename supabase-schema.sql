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

-- Manzil unique (bir email faqat bitta userga)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emails_address_unique'
  ) THEN
    ALTER TABLE public.emails ADD CONSTRAINT emails_address_unique UNIQUE (address);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_email_address ON public.messages(email_address);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- API RUXSATLARI (qattiq rejim)
-- Ochiq policy'lar olib tashlandi. Faqat Service Role ishlaydi.

-- 4. ADMIN ROLLARI (MIGRATION)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
UPDATE public.users SET is_admin = true WHERE LOWER(username) = 'admin';

-- ========================================================
-- SUPABASE AUTH MIGRATION (oddiy)
-- password_hash endi ishlatilmaydi. Auth auth.users da.
-- public.users.id = auth.users.id bo'lishi kerak.
-- Ichki email: username@tekinmail.local
-- ========================================================
-- Eski password_hash maydonini ixtiyoriy qoldirish mumkin:
-- ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
-- ========================================================
-- QATTIQ RLS (Supabase Auth + Service Role)
-- Anon kalit bilan hech narsa o'qib-yozib bo'lmaydi.
-- Server (Service Role) RLS ni bypass qiladi.
-- ========================================================

-- Eski ochiq policy'larni o'chirish
DROP POLICY IF EXISTS "Allow public all on users" ON public.users;
DROP POLICY IF EXISTS "Allow public all on emails" ON public.emails;
DROP POLICY IF EXISTS "Allow public all on messages" ON public.messages;

-- Hech qanday public policy qoldirmaymiz.
-- Faqat Service Role (backend) ishlaydi.
-- Kerak bo'lsa keyinroq authenticated user uchun policy qo'shiladi.

-- password_hash ni optional qilish (endi ishlatilmaydi)
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN password_hash SET DEFAULT 'supabase-auth';

-- ========================================================
-- LOGIN ATTEMPTS (rate limit uchun)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    ip TEXT,
    success BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time 
  ON public.login_attempts(username, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- Hech qanday public policy yo'q. Faqat Service Role yozadi/o'qiydi.

-- ========================================================
-- AUDIT LOGS
-- ========================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_id UUID,
    username TEXT,
    ip TEXT,
    target TEXT,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Faqat Service Role yozadi/o'qiydi.
