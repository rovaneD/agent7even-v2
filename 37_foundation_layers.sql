-- 37_foundation_layers.sql
-- Layer persistence (Build Sequence item 4, v0) — approved Foundation evolution layers.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Requires: 33_foundation_proposals.sql, 29_rls_policies.sql

CREATE TABLE IF NOT EXISTS public.foundation_layers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  source_proposal_id   uuid REFERENCES public.foundation_proposals (id) ON DELETE SET NULL,
  state                text NOT NULL CHECK (state IN ('consistent', 'extending')),
  title                text NOT NULL,
  body                 text NOT NULL,
  theme                text,
  approved_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foundation_layers_profile
  ON public.foundation_layers (profile_id, approved_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_foundation_layers_source_proposal_unique
  ON public.foundation_layers (source_proposal_id)
  WHERE source_proposal_id IS NOT NULL;

ALTER TABLE public.foundation_layers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select own account" ON public.foundation_layers;
DROP POLICY IF EXISTS "No direct client insert on foundation_layers" ON public.foundation_layers;
DROP POLICY IF EXISTS "No direct client update on foundation_layers" ON public.foundation_layers;
DROP POLICY IF EXISTS "No direct client delete on foundation_layers" ON public.foundation_layers;

CREATE POLICY "Tenant select own account"
  ON public.foundation_layers FOR SELECT TO authenticated
  USING (profile_id IN (SELECT public.accessible_profile_ids()));

CREATE POLICY "No direct client insert on foundation_layers"
  ON public.foundation_layers FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct client update on foundation_layers"
  ON public.foundation_layers FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "No direct client delete on foundation_layers"
  ON public.foundation_layers FOR DELETE TO authenticated
  USING (false);
