-- 29_rls_policies.sql
-- Fix Supabase linter 0008 (rls_enabled_no_policy) on 34 public tables.
-- Run once in Supabase SQL Editor. Safe to re-run (DROP POLICY IF EXISTS).
--
-- Auth model: Clerk JWT in Supabase (`auth.jwt() ->> 'sub'` = profiles.clerk_user_id).
-- Server routes use service_role (bypasses RLS). Client/realtime uses authenticated + these policies.

-- ── Helpers ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles AS p
  WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accessible_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.current_profile_id()
  WHERE public.current_profile_id() IS NOT NULL
  UNION
  SELECT p.account_id
  FROM public.profiles AS p
  WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
    AND p.account_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accessible_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_profile_ids() TO authenticated;

-- ── Block direct client API on service-only tables ────────────────────────────
DO $$
DECLARE
  t text;
  service_tables text[] := ARRAY[
    'admin_email_log',
    'client_activity_log',
    'oauth_states',
    'zernio_api_usage',
    'agent_skills',
    'platform_settings',
    'services'
  ];
BEGIN
  FOREACH t IN ARRAY service_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Skipping % — table missing', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "No direct client access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "No direct client access" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- ── Standard tenant isolation (user_id → profiles) ───────────────────────────
DO $$
DECLARE
  t text;
  tenant_user_id_tables text[] := ARRAY[
    'agent_constraints',
    'agent_outputs',
    'agent_schedules',
    'agent_tasks',
    'brand_answers',
    'brand_documents',
    'brand_kit_assets',
    'brand_kit_colors',
    'brand_kit_fonts',
    'brand_kit_sections',
    'campaigns',
    'creative_asset_folders',
    'creative_assets',
    'credit_balances',
    'credit_ledger',
    'credit_topups',
    'daily_digests',
    'foundation_documents',
    'foundation_field_scores',
    'maya_sessions',
    'orchestration_sessions',
    'project_inquiries'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_user_id_tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'user_id'
    ) THEN
      RAISE NOTICE 'Skipping % — no user_id column', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "Tenant select own account" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant insert own account" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant update own account" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant delete own account" ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY "Tenant select own account" ON public.%I FOR SELECT TO authenticated USING (user_id IN (SELECT public.accessible_profile_ids()))',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Tenant insert own account" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id IN (SELECT public.accessible_profile_ids()))',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Tenant update own account" ON public.%I FOR UPDATE TO authenticated USING (user_id IN (SELECT public.accessible_profile_ids())) WITH CHECK (user_id IN (SELECT public.accessible_profile_ids()))',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Tenant delete own account" ON public.%I FOR DELETE TO authenticated USING (user_id IN (SELECT public.accessible_profile_ids()))',
      t
    );
  END LOOP;
END $$;

-- ── profile_id tenant tables ──────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.foundation_knowledge') IS NULL THEN
    RAISE NOTICE 'Skipping foundation_knowledge — table missing';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Tenant select own account" ON public.foundation_knowledge;
DROP POLICY IF EXISTS "Tenant insert own account" ON public.foundation_knowledge;
DROP POLICY IF EXISTS "Tenant update own account" ON public.foundation_knowledge;
DROP POLICY IF EXISTS "Tenant delete own account" ON public.foundation_knowledge;

CREATE POLICY "Tenant select own account"
  ON public.foundation_knowledge FOR SELECT TO authenticated
  USING (profile_id IN (SELECT public.accessible_profile_ids()));

CREATE POLICY "Tenant insert own account"
  ON public.foundation_knowledge FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT public.accessible_profile_ids()));

CREATE POLICY "Tenant update own account"
  ON public.foundation_knowledge FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT public.accessible_profile_ids()))
  WITH CHECK (profile_id IN (SELECT public.accessible_profile_ids()));

CREATE POLICY "Tenant delete own account"
  ON public.foundation_knowledge FOR DELETE TO authenticated
  USING (profile_id IN (SELECT public.accessible_profile_ids()));
END $$;

-- ── brand_document_versions (via brand_documents.user_id) ─────────────────────
DO $$
BEGIN
  IF to_regclass('public.brand_document_versions') IS NULL THEN
    RAISE NOTICE 'Skipping brand_document_versions — table missing';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Tenant select own account" ON public.brand_document_versions;
  DROP POLICY IF EXISTS "Tenant insert own account" ON public.brand_document_versions;
  DROP POLICY IF EXISTS "Tenant delete own account" ON public.brand_document_versions;

  CREATE POLICY "Tenant select own account"
    ON public.brand_document_versions FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.brand_documents AS d
        WHERE d.id = brand_document_versions.document_id
          AND d.user_id IN (SELECT public.accessible_profile_ids())
      )
    );

  CREATE POLICY "Tenant insert own account"
    ON public.brand_document_versions FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.brand_documents AS d
        WHERE d.id = brand_document_versions.document_id
          AND d.user_id IN (SELECT public.accessible_profile_ids())
      )
    );

  CREATE POLICY "Tenant delete own account"
    ON public.brand_document_versions FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.brand_documents AS d
        WHERE d.id = brand_document_versions.document_id
          AND d.user_id IN (SELECT public.accessible_profile_ids())
      )
    );
END $$;

-- ── order_revisions (via orders.user_id) ──────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.order_revisions') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'order_revisions' AND column_name = 'order_id'
     ) THEN
    RAISE NOTICE 'Skipping order_revisions — table/column missing';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Tenant select own account" ON public.order_revisions;
  DROP POLICY IF EXISTS "Tenant insert own account" ON public.order_revisions;

  CREATE POLICY "Tenant select own account"
    ON public.order_revisions FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.orders AS o
        WHERE o.id = order_revisions.order_id
          AND o.user_id IN (SELECT public.accessible_profile_ids())
      )
    );

  CREATE POLICY "Tenant insert own account"
    ON public.order_revisions FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.orders AS o
        WHERE o.id = order_revisions.order_id
          AND o.user_id IN (SELECT public.accessible_profile_ids())
      )
    );
END $$;

-- ── team_members (read membership; writes stay on service_role API routes) ─────
DROP POLICY IF EXISTS "Account members can read team" ON public.team_members;

CREATE POLICY "Account members can read team"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT public.accessible_profile_ids())
    OR member_profile_id = public.current_profile_id()
  );
