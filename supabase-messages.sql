-- 3. Kelgan xabarlar jadvali (Supabase)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_key TEXT NOT NULL,
    to_email TEXT NOT NULL,
    from_address TEXT,
    subject TEXT,
    body TEXT,
    html TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_account_key ON public.messages(account_key);
CREATE INDEX IF NOT EXISTS idx_messages_to_email ON public.messages(to_email);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
