-- 23_creative_direction_cache.sql
-- Cache Foundation → Creative Direction translation on profiles.
-- Run in Supabase SQL editor before deploying cache reads/writes.
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS creative_direction jsonb,
  ADD COLUMN IF NOT EXISTS creative_direction_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS creative_direction_source_hash text;

COMMENT ON COLUMN profiles.creative_direction IS
  'Cached CreativeDirection object from translateFoundationToCreativeDirection()';
COMMENT ON COLUMN profiles.creative_direction_source_hash IS
  'SHA-256 of answer + document fields the translation layer reads';
