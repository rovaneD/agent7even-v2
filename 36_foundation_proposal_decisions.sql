-- 36_foundation_proposal_decisions.sql
-- Proposal surface (Build Sequence item 3) — user decisions on surfaced Guardian rows.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Requires: 33_foundation_proposals.sql

ALTER TABLE public.foundation_proposals
  ADD COLUMN IF NOT EXISTS user_decision text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text;

ALTER TABLE public.foundation_proposals
  DROP CONSTRAINT IF EXISTS foundation_proposals_user_decision_check;

ALTER TABLE public.foundation_proposals
  ADD CONSTRAINT foundation_proposals_user_decision_check
  CHECK (user_decision IN ('pending', 'approved', 'rejected', 'deferred'));

CREATE INDEX IF NOT EXISTS idx_foundation_proposals_pending_surface
  ON public.foundation_proposals (profile_id, created_at DESC)
  WHERE guardian_verdict = 'surface' AND user_decision = 'pending';
