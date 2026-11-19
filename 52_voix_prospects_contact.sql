-- 52_voix_prospects_contact.sql
-- Email and phone on Outreach spas. Outreach now leads with an after-hours
-- call and an email (Instagram DMs from non-followers land in message requests).
-- Run once in Supabase SQL Editor. Safe to re-run. (Already applied to production.)

ALTER TABLE public.voix_prospects ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.voix_prospects ADD COLUMN IF NOT EXISTS phone text;

-- Drafted email for the "Open email" button (body without the footer; the app adds it).
ALTER TABLE public.voix_prospects ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE public.voix_prospects ADD COLUMN IF NOT EXISTS email_body text;

-- 'later': spas worth revisiting after the pilot (chains, multi-location). Not active, not counted.
ALTER TABLE public.voix_prospects DROP CONSTRAINT IF EXISTS voix_prospects_status_check;
ALTER TABLE public.voix_prospects ADD CONSTRAINT voix_prospects_status_check
  CHECK (status IN ('to_contact', 'contacted', 'replied', 'demo', 'pilot', 'not_interested', 'later'));
