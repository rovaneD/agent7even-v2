-- Single-slot undo for Foundation identity (foundation_answers only).
-- Run manually in Supabase SQL editor — do NOT auto-apply from app deploy.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foundation_answers_previous jsonb,
  ADD COLUMN IF NOT EXISTS foundation_answers_previous_at timestamptz;
