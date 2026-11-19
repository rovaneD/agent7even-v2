-- 51_voix_prospect_runs.sql
-- Log of automatic outreach top-ups: when every spa in Outreach has been
-- contacted, Voix researches the next batch of independent med spas.
-- One run at a time (partial unique index). Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.voix_prospect_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger      text NOT NULL CHECK (trigger IN ('queue_empty', 'cron', 'manual')),
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  candidates   int,
  added        int NOT NULL DEFAULT 0,
  error        text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS voix_prospect_runs_one_running
  ON public.voix_prospect_runs ((true)) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS voix_prospect_runs_started_idx ON public.voix_prospect_runs (started_at DESC);

ALTER TABLE public.voix_prospect_runs ENABLE ROW LEVEL SECURITY;
