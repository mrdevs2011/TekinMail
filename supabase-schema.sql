-- TEKINMAIL DATABASE SCHEMA FOR SUPABASE

-- 1. Foydalanuvchilar hisobi jadvali
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Biriktirilgan emaillar jadvali (har bir hisobda cheksiz bo'lishi mumkin)
CREATE TABLE IF NOT EXISTS public.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    mailtm_id TEXT NOT NULL,
    address TEXT NOT NULL,
    password TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexlar - tez qidirish uchun
CREATE INDEX IF NOT EXISTS idx_emails_account_id ON public.emails(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_key ON public.accounts(account_key);

-- 3. Row Level Security (RLS) yoqish va public o'qish/yozish siyosatlari
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Anonim kirish uchun ruxsatlar (API orqali o'qish va yozish uchun)
CREATE POLICY "Allow public all on accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on emails" ON public.emails FOR ALL USING (true) WITH CHECK (true);
