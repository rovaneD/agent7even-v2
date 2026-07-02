-- 28_function_search_path_and_rpc_lockdown.sql
-- Fix Supabase linter warnings:
--   0011 function_search_path_mutable
--   0028 anon_security_definer_function_executable
--   0029 authenticated_security_definer_function_executable
--
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- App auth is Clerk (profiles.clerk_user_id). Profiles are created by the Clerk
-- webhook via service_role — not handle_new_user(). Role checks for admin UI
-- run in Next.js (requireAdmin), not via PostgREST RPC.

-- ── 1. Trigger helper: updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 2. RLS helpers: Clerk JWT + SECURITY INVOKER ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
      AND p.role IN ('admin', 'owner')
  );
$$;

-- ── 3. Legacy Supabase-auth signup trigger (keep body, pin search_path) ──────
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public';
  END IF;
END $$;

-- ── 4. Block direct PostgREST RPC on these functions ─────────────────────────
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- Triggers and server-side callers use postgres/service_role privileges.
