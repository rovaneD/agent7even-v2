-- 32_foundation_changelog.sql
-- Foundation Observer v0 — internal decision-signal changelog (write-only from API routes).
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Requires: public.profiles, public.agent_tasks, public.current_profile_id(),
--           public.accessible_profile_ids() from 29_rls_policies.sql

CREATE TABLE IF NOT EXISTS public.foundation_changelog (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  signal_type      text NOT NULL CHECK (signal_type IN ('approved', 'rejected', 'edited')),
  agent_id         text,
  source_task_id   uuid REFERENCES public.agent_tasks (id) ON DELETE SET NULL,
  content_summary  text NOT NULL,
  raw_context      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foundation_changelog_profile
  ON public.foundation_changelog (profile_id, created_at DESC);

ALTER TABLE public.foundation_changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select own account" ON public.foundation_changelog;
DROP POLICY IF EXISTS "No direct client insert on foundation_changelog" ON public.foundation_changelog;
DROP POLICY IF EXISTS "No direct client update on foundation_changelog" ON public.foundation_changelog;
DROP POLICY IF EXISTS "No direct client delete on foundation_changelog" ON public.foundation_changelog;

-- Future reads (Guardian, admin tools) — workspace-scoped like foundation_knowledge.
CREATE POLICY "Tenant select own account"
  ON public.foundation_changelog FOR SELECT TO authenticated
  USING (profile_id IN (SELECT public.accessible_profile_ids()));

-- Writes stay on service_role API routes only.
CREATE POLICY "No direct client insert on foundation_changelog"
  ON public.foundation_changelog FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct client update on foundation_changelog"
  ON public.foundation_changelog FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "No direct client delete on foundation_changelog"
  ON public.foundation_changelog FOR DELETE TO authenticated
  USING (false);
