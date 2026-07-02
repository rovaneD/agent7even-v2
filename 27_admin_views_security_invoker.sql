-- 27_admin_views_security_invoker.sql
-- Fix Supabase linter 0010 (security_definer_view) on admin rollup views.
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- These views are queried only from server admin routes via service_role.
-- security_invoker = true ensures PostgREST clients respect underlying RLS
-- instead of inheriting the view owner's bypass privileges.

-- ── 1. Switch views to SECURITY INVOKER ────────────────────────────────────
ALTER VIEW public.v_account_month_cost SET (security_invoker = true);
ALTER VIEW public.v_x_usage_30d SET (security_invoker = true);
ALTER VIEW public.v_admin_x_usage_summary SET (security_invoker = true);

-- ── 2. Block direct API access (admin routes use service_role) ─────────────
REVOKE ALL ON public.v_account_month_cost FROM anon, authenticated;
REVOKE ALL ON public.v_x_usage_30d FROM anon, authenticated;
REVOKE ALL ON public.v_admin_x_usage_summary FROM anon, authenticated;

-- ── 3. zernio_api_usage: service-only table backing X usage views ──────────
ALTER TABLE public.zernio_api_usage ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies — same pattern as foundation_knowledge.
