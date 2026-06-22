-- Optional extension for saved asset → queue flow (full brief + QA cache)
-- Run after 19_creative_assets.sql

ALTER TABLE creative_assets
  ADD COLUMN IF NOT EXISTS brief text,
  ADD COLUMN IF NOT EXISTS qa_passed boolean;
