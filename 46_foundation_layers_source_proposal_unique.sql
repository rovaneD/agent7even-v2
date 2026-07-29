-- 46_foundation_layers_source_proposal_unique.sql
-- One approved layer per proposal (idempotent re-approve / race guard).
-- Safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS idx_foundation_layers_source_proposal_unique
  ON public.foundation_layers (source_proposal_id)
  WHERE source_proposal_id IS NOT NULL;
