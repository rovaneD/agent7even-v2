-- 24_zernio_api_usage.sql
-- Zernio vendor API usage ledger (X pass-through measurement + admin policy views).
-- Run once in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).

CREATE TABLE IF NOT EXISTS zernio_api_usage (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES profiles(id) ON DELETE CASCADE,
  zernio_profile_id   text,
  platform            text,
  operation           text NOT NULL,
  http_method         text NOT NULL DEFAULT 'GET',
  path                text NOT NULL,
  status_code         integer,
  estimated_cost_usd  numeric(12, 6) NOT NULL DEFAULT 0,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zernio_api_usage_user_created_idx
  ON zernio_api_usage(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS zernio_api_usage_platform_created_idx
  ON zernio_api_usage(platform, created_at DESC)
  WHERE platform = 'x';

CREATE INDEX IF NOT EXISTS zernio_api_usage_created_at_idx
  ON zernio_api_usage(created_at DESC);

-- Per-tenant X usage in the rolling 30-day measurement window
CREATE OR REPLACE VIEW v_x_usage_30d AS
SELECT
  u.user_id,
  p.company_name,
  p.plan,
  COUNT(*)::bigint                                    AS x_call_count,
  COALESCE(SUM(u.estimated_cost_usd), 0)::numeric     AS x_estimated_cost_usd
FROM zernio_api_usage u
JOIN profiles p ON p.id = u.user_id
WHERE u.platform = 'x'
  AND u.created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '30 days'
GROUP BY u.user_id, p.company_name, p.plan;

-- Fleet-wide X rollup for admin dashboard
CREATE OR REPLACE VIEW v_admin_x_usage_summary AS
SELECT
  COUNT(*) FILTER (WHERE platform = 'x')::bigint                          AS x_calls_30d,
  COALESCE(SUM(estimated_cost_usd) FILTER (WHERE platform = 'x'), 0)    AS x_cost_30d,
  COUNT(DISTINCT user_id) FILTER (WHERE platform = 'x')::bigint           AS x_active_tenants_30d,
  COUNT(*)::bigint                                                        AS total_calls_30d,
  COALESCE(SUM(estimated_cost_usd), 0)                                    AS total_estimated_cost_30d
FROM zernio_api_usage
WHERE created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '30 days';
