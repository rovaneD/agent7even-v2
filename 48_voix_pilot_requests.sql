-- 48_voix_pilot_requests.sql
-- Pilot requests for Voix: from the /voix form and from calls to Voix's own
-- sales line. Admins work them in /voix/app/admin and turn them into spas.
-- Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.voix_pilot_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'phone')),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'set_up', 'declined')),
  contact_name    text,
  spa_name        text,
  email           text,
  phone           text,
  instagram       text,
  booking_software text,
  locations       text,
  preferred_time  text,
  notes           text,
  retell_call_id  text UNIQUE,
  account_id      uuid REFERENCES public.voix_accounts (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voix_pilot_requests_created_idx
  ON public.voix_pilot_requests (created_at DESC);

ALTER TABLE public.voix_pilot_requests ENABLE ROW LEVEL SECURITY;
