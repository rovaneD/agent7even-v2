-- 52_voix_prospects_contact.sql
-- Email and phone on Outreach spas. Outreach now leads with an after-hours
-- call and an email (Instagram DMs from non-followers land in message requests).
-- Run once in Supabase SQL Editor. Safe to re-run. (Already applied to production.)

ALTER TABLE public.voix_prospects ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.voix_prospects ADD COLUMN IF NOT EXISTS phone text;
