-- Phase 1: tag agent_tasks rows with actionCosts.ts keys for cost reporting.
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS action_type text;

CREATE INDEX IF NOT EXISTS agent_tasks_action_type_created_at_idx
  ON public.agent_tasks (action_type, created_at DESC)
  WHERE action_type IS NOT NULL;
