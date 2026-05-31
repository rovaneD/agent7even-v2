-- 01_cost_instrumentation.sql
-- Run once in Supabase SQL Editor.
-- Adds cached_tokens, job_type, indexes, and v_account_month_cost view.
-- Safe to re-run (all operations use IF NOT EXISTS / CREATE OR REPLACE).

-- ── 1. agent_tasks: add cached_tokens ──────────────────────────────────────
-- Deferred from AI SDK v6 (doesn't surface cached_tokens yet).
-- Column added now so it's ready when the SDK exposes it.
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS cached_tokens integer NOT NULL DEFAULT 0;

-- ── 2. agent_tasks: add job_type ───────────────────────────────────────────
-- agent  = which agent ran (e.g. 'maya')
-- job_type = what job it did (e.g. 'maya_chat', 'social_post', 'seo_audit')
-- Needed for Screen 4 wedge-finder — agent alone is too coarse.
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS job_type text;

-- Backfill existing maya chat rows
UPDATE agent_tasks
  SET job_type = 'maya_chat'
  WHERE agent = 'maya' AND job_type IS NULL;

-- ── 3. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS agent_tasks_user_id_idx
  ON agent_tasks(user_id);

CREATE INDEX IF NOT EXISTS agent_tasks_agent_idx
  ON agent_tasks(agent);

CREATE INDEX IF NOT EXISTS agent_tasks_job_type_idx
  ON agent_tasks(job_type);

CREATE INDEX IF NOT EXISTS agent_tasks_status_idx
  ON agent_tasks(status);

CREATE INDEX IF NOT EXISTS agent_tasks_created_at_idx
  ON agent_tasks(created_at DESC);

-- Composite for per-user monthly rollups (used by the view below)
CREATE INDEX IF NOT EXISTS agent_tasks_user_month_idx
  ON agent_tasks(user_id, created_at DESC);

-- ── 4. v_account_month_cost view ────────────────────────────────────────────
-- Per-account cost + usage rollup for the current calendar month.
-- Used by Admin Screen 1 (Margin Overview) and Screen 2 (Account Activity).
-- MRR derived from profiles.plan: starter=$49, growth=$89, proagent=$149.
CREATE OR REPLACE VIEW v_account_month_cost AS
SELECT
  p.id                                              AS user_id,
  p.company_name,
  p.plan,
  CASE LOWER(p.plan)
    WHEN 'starter'   THEN 49
    WHEN 'growth'    THEN 89
    WHEN 'proagent'  THEN 149
    ELSE 0
  END                                               AS mrr_usd,
  COUNT(t.id)                                       AS tasks_this_month,
  COALESCE(SUM(t.input_tokens),   0)                AS input_tokens,
  COALESCE(SUM(t.output_tokens),  0)                AS output_tokens,
  COALESCE(SUM(t.cached_tokens),  0)                AS cached_tokens,
  COALESCE(SUM(t.cost_usd),       0)                AS cost_usd,
  COALESCE(SUM(CASE WHEN t.agent = 'maya' THEN t.cost_usd ELSE 0 END), 0)
                                                    AS maya_cost_usd,
  cb.balance                                        AS credits_remaining,
  DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')     AS month_start
FROM profiles p
LEFT JOIN agent_tasks t
  ON  t.user_id = p.id
  AND t.status  = 'completed'
  AND t.created_at >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
LEFT JOIN credit_balances cb ON cb.user_id = p.id
GROUP BY
  p.id, p.company_name, p.plan, cb.balance;
