-- 50_voix_pilot_waitlist.sql
-- Adds a 'waitlist' status to pilot requests, for applicants beyond the
-- 10 founding pilot spots. Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.voix_pilot_requests DROP CONSTRAINT IF EXISTS voix_pilot_requests_status_check;
ALTER TABLE public.voix_pilot_requests
  ADD CONSTRAINT voix_pilot_requests_status_check
  CHECK (status IN ('new', 'contacted', 'waitlist', 'set_up', 'declined'));
