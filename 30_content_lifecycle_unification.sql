-- 30_content_lifecycle_unification.sql
-- Thread 3 v1: single lifecycle spine on agent_outputs for post pipeline.
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.agent_outputs
  ADD COLUMN IF NOT EXISTS lifecycle_stage text,
  ADD COLUMN IF NOT EXISTS zernio_post_id text;

CREATE INDEX IF NOT EXISTS agent_outputs_user_lifecycle_idx
  ON public.agent_outputs (user_id, lifecycle_stage)
  WHERE lifecycle_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_outputs_zernio_post_id_idx
  ON public.agent_outputs (zernio_post_id)
  WHERE zernio_post_id IS NOT NULL;

-- Backfill from existing status column
UPDATE public.agent_outputs
SET lifecycle_stage = CASE
  WHEN status = 'pending_approval' THEN 'review'
  WHEN status = 'rejected' THEN 'rejected'
  ELSE 'approved'
END
WHERE lifecycle_stage IS NULL;
