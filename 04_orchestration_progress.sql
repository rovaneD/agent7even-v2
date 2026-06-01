-- Add agent list and per-agent status tracking to orchestration sessions
-- Run in Supabase SQL editor before deploying code changes

ALTER TABLE orchestration_sessions
  ADD COLUMN IF NOT EXISTS agent_ids    text[],
  ADD COLUMN IF NOT EXISTS agent_status jsonb;
