-- 44_marketing_chat_logs.sql
-- Anonymous marketing-site Ask Maya chat logs (service role only).
-- Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.marketing_chat_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        text NOT NULL,
  role              text NOT NULL CHECK (role IN ('user', 'assistant')),
  content           text NOT NULL,
  model             text,
  prompt_tokens     int,
  completion_tokens int,
  cost_usd          numeric(12, 6),
  ip_hash           text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_chat_logs_ip_hash_created_idx
  ON public.marketing_chat_logs (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_chat_logs_session_created_idx
  ON public.marketing_chat_logs (session_id, created_at ASC);

ALTER TABLE public.marketing_chat_logs ENABLE ROW LEVEL SECURITY;

-- No RLS policies: anon/authenticated clients cannot read or write.
-- Server routes use SUPABASE_SERVICE_ROLE_KEY.
