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

-- ========================================================
-- MULTI-DOMAIN + CLEANUP INDEXES
-- ========================================================
-- messages.created_at index for TTL cleanup cron
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Optional: store domain separately (address already contains it)
-- MAIL_DOMAINS env: comma-separated list e.g. bombaclat.uz,other.uz
-- MESSAGE_TTL_DAYS (default 30), CRON_SECRET for /api/cleanup-old-messages

-- ========================================================
-- EMAIL BAN HOLATLARI (Anthropic / Instagram ... ban-suspend aniqlash)
-- Xat kelganda api/_ban-detector.js avtomatik yozadi.
-- Supabase → SQL Editor da BIR MARTA ishga tushiring.
-- ========================================================
CREATE TABLE IF NOT EXISTS public.email_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID REFERENCES public.emails(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    address TEXT NOT NULL,
    service TEXT NOT NULL,
    service_label TEXT,
    status TEXT NOT NULL DEFAULT 'banned' CHECK (status IN ('banned', 'lifted')),
    subject TEXT,
    evidence TEXT,
    message_id UUID,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    lifted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT email_bans_address_service_unique UNIQUE (address, service)
);
CREATE INDEX IF NOT EXISTS idx_email_bans_user ON public.email_bans(user_id, status);
ALTER TABLE public.email_bans ENABLE ROW LEVEL SECURITY;
-- Public policy yo'q. Faqat Service Role (backend) yozadi/o'qiydi.

-- ========================================================
-- EMAILS TABLARI (Barchasi / Banned emaillar) + OMMAVIY O'CHIRISH
-- Supabase -> SQL Editor da BIR MARTA ishga tushiring (qayta ishga tushirsa ham xavfsiz).
-- Ommaviy o'chirish tezroq ishlashi uchun indekslar.
-- ========================================================
-- email_bans jadvali yuqorida yaratilgan bo'lishi kerak (EMAIL BAN HOLATLARI bo'limi).
CREATE INDEX IF NOT EXISTS idx_email_bans_address ON public.email_bans(address);
CREATE INDEX IF NOT EXISTS idx_email_bans_email_id ON public.email_bans(email_id);
CREATE INDEX IF NOT EXISTS idx_email_bans_user_address ON public.email_bans(user_id, address);
CREATE INDEX IF NOT EXISTS idx_messages_user_email ON public.messages(user_id, email_address);

-- Tekshirish: nechta email banned? (user_id ni o'zingiznikiga almashtiring)
-- SELECT COUNT(DISTINCT address) FROM public.email_bans WHERE status = 'banned';

-- Qo'lda tozalash (xohlasangiz): barcha banned emaillar va ularning xatlari
-- DELETE FROM public.messages WHERE email_address IN (SELECT address FROM public.email_bans WHERE status = 'banned');
-- DELETE FROM public.emails   WHERE address       IN (SELECT address FROM public.email_bans WHERE status = 'banned');
