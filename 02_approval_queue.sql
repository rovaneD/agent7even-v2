-- Approval Queue schema additions
-- Run in Supabase SQL editor

ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by      uuid REFERENCES profiles(id);

ALTER TABLE agent_outputs
  ADD COLUMN IF NOT EXISTS feedback        text,
  ADD COLUMN IF NOT EXISTS feedback_note   text,
  ADD COLUMN IF NOT EXISTS feedback_at     timestamptz;
