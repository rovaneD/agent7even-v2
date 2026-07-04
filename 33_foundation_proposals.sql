-- 33_foundation_proposals.sql
-- Foundation Guardian v0 — verified proposal rows (internal until proposal UI ships).
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Requires: public.profiles, public.current_profile_id(),
--           public.accessible_profile_ids() from 29_rls_policies.sql

CREATE TABLE IF NOT EXISTS public.foundation_proposals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  state                text NOT NULL CHECK (state IN ('consistent', 'extending', 'contradicting')),
  guardian_verdict     text NOT NULL CHECK (guardian_verdict IN ('surface', 'hold', 'reject_internal')),
  proposal_title       text NOT NULL,
  proposal_body        text NOT NULL,
  phase1_excerpt       text,
  signal_summary       text NOT NULL,
  source_changelog_ids uuid[] NOT NULL DEFAULT '{}',
  theme                text,
  rationale            text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foundation_proposals_profile
  ON public.foundation_proposals (profile_id, created_at DESC);

ALTER TABLE public.foundation_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select own account" ON public.foundation_proposals;
DROP POLICY IF EXISTS "No direct client insert on foundation_proposals" ON public.foundation_proposals;
DROP POLICY IF EXISTS "No direct client update on foundation_proposals" ON public.foundation_proposals;
DROP POLICY IF EXISTS "No direct client delete on foundation_proposals" ON public.foundation_proposals;

CREATE POLICY "Tenant select own account"
  ON public.foundation_proposals FOR SELECT TO authenticated
  USING (profile_id IN (SELECT public.accessible_profile_ids()));

CREATE POLICY "No direct client insert on foundation_proposals"
  ON public.foundation_proposals FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct client update on foundation_proposals"
  ON public.foundation_proposals FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "No direct client delete on foundation_proposals"
  ON public.foundation_proposals FOR DELETE TO authenticated
  USING (false);
