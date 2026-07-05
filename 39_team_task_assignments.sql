-- 39_team_task_assignments.sql
-- Phase 3: owner → member task handoffs on agent_tasks.
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS assigned_to_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_note text,
  ADD COLUMN IF NOT EXISTS assignment_due_at timestamptz;

CREATE INDEX IF NOT EXISTS agent_tasks_assigned_to_idx
  ON public.agent_tasks (assigned_to_profile_id, status, created_at DESC)
  WHERE assigned_to_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_tasks_workspace_assigned_idx
  ON public.agent_tasks (user_id, assigned_to_profile_id, created_at DESC)
  WHERE assigned_to_profile_id IS NOT NULL;
