-- 49_voix_prospects.sql
-- Light outreach tracker for Voix: spas we're pitching (Instagram DMs, email,
-- walk-ins). Admins manage it in /voix/app/admin?view=outreach.
-- Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.voix_prospects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spa_name          text NOT NULL,
  website           text,
  instagram         text,
  city              text,
  contact_name      text,
  channel           text NOT NULL DEFAULT 'ig_dm'
                    CHECK (channel IN ('ig_dm', 'email', 'in_person', 'phone', 'other')),
  status            text NOT NULL DEFAULT 'to_contact'
                    CHECK (status IN ('to_contact', 'contacted', 'replied', 'demo', 'pilot', 'not_interested')),
  last_contacted_at timestamptz,
  next_follow_up    date,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voix_prospects_status_idx ON public.voix_prospects (status, next_follow_up);

ALTER TABLE public.voix_prospects ENABLE ROW LEVEL SECURITY;
