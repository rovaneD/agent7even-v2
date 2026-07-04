-- 34_foundation_site_snapshot.sql
-- Website-derived strategic snapshot (separate from guarded Phase 1 answers).
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS site_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS site_snapshot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_snapshot_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS site_snapshot_source_url text;

COMMENT ON COLUMN public.profiles.site_snapshot IS
  'Structured SiteSnapshot from enrichFromWebsite — user-reviewed; does not mutate foundation_answers';
COMMENT ON COLUMN public.profiles.site_snapshot_enabled IS
  'When true, agents read site_snapshot in buildAgentContext';
