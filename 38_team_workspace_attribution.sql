-- 38_team_workspace_attribution.sql
-- Phase 2: actor attribution on agent rows + workspace rollup on activity log.
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.agent_outputs
  ADD COLUMN IF NOT EXISTS actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.client_activity_log
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS agent_tasks_workspace_actor_idx
  ON public.agent_tasks (user_id, actor_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_outputs_workspace_actor_idx
  ON public.agent_outputs (user_id, actor_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS client_activity_log_workspace_created_idx
  ON public.client_activity_log (workspace_id, created_at DESC);

-- Legacy rows: actor was the same profile as user_id before workspace SSOT.
UPDATE public.agent_tasks
SET actor_profile_id = user_id
WHERE actor_profile_id IS NULL;

UPDATE public.agent_outputs
SET actor_profile_id = user_id
WHERE actor_profile_id IS NULL;

UPDATE public.client_activity_log
SET workspace_id = user_id
WHERE workspace_id IS NULL;
