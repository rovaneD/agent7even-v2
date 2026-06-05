-- Exa Foundation pre-fill columns
-- Run in Supabase SQL editor.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS foundation_research         jsonb,
  ADD COLUMN IF NOT EXISTS foundation_research_variant text;
