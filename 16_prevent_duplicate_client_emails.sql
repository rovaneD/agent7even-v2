-- Prevent duplicate active client profiles for the same email.
-- Run in Supabase SQL editor after removing any existing duplicates.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_client_email_active_unique
  ON public.profiles (lower(trim(email)))
  WHERE role = 'client'
    AND status IN ('active', 'onboarding', 'paused')
    AND email IS NOT NULL
    AND trim(email) <> '';
