-- 47_voix_digest_monitoring.sql
-- Voix daily digest settings + send log, webhook delivery log for the admin
-- monitor, and staff last-seen for activity tracking.
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.voix_accounts
  ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_hour smallint NOT NULL DEFAULT 8 CHECK (digest_hour BETWEEN 0 AND 23);

ALTER TABLE public.voix_members
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE TABLE IF NOT EXISTS public.voix_digest_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.voix_accounts (id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  recipients  integer NOT NULL DEFAULT 0,
  calls       integer NOT NULL DEFAULT 0,
  open_followups integer NOT NULL DEFAULT 0,
  is_test     boolean NOT NULL DEFAULT false,
  error       text,
  sent_at     timestamptz NOT NULL DEFAULT now()
);

-- One scheduled digest per spa per local day (test sends are not limited).
CREATE UNIQUE INDEX IF NOT EXISTS voix_digest_log_scheduled_uniq
  ON public.voix_digest_log (account_id, digest_date) WHERE NOT is_test;

CREATE TABLE IF NOT EXISTS public.voix_webhook_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at    timestamptz NOT NULL DEFAULT now(),
  event          text,
  retell_call_id text,
  agent_id       text,
  account_id     uuid REFERENCES public.voix_accounts (id) ON DELETE SET NULL,
  result         text NOT NULL CHECK (result IN ('stored', 'ignored', 'error', 'bad_signature')),
  detail         text
);

CREATE INDEX IF NOT EXISTS voix_webhook_events_received_idx
  ON public.voix_webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS voix_webhook_events_account_idx
  ON public.voix_webhook_events (account_id, received_at DESC);

ALTER TABLE public.voix_digest_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voix_webhook_events ENABLE ROW LEVEL SECURITY;
