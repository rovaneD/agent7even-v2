--
-- PostgreSQL database dump
--

\restrict Ulf3BFgjSt5Y01IPucn94svV7iRPJ0KLyBfXppXAFDo2lxz3EOD8Lqfe89GzDU0

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: accessible_profile_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accessible_profile_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT public.current_profile_id()
  WHERE public.current_profile_id() IS NOT NULL
  UNION
  SELECT p.account_id
  FROM public.profiles AS p
  WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
    AND p.account_id IS NOT NULL;
$$;


--
-- Name: current_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT p.id
  FROM public.profiles AS p
  WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
  LIMIT 1;
$$;


--
-- Name: deduct_credits(uuid, integer, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_credits(p_user_id uuid, p_amount integer, p_description text, p_task_id uuid DEFAULT NULL::uuid, p_orchestration_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_new_balance integer;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  if p_amount = 0 then
    select balance into v_new_balance
      from public.credit_balances
     where user_id = p_user_id;
    return coalesce(v_new_balance, 0);
  end if;

  update public.credit_balances
     set balance       = balance - p_amount,
         lifetime_used = coalesce(lifetime_used, 0) + p_amount,
         updated_at    = now()
   where user_id = p_user_id
     and balance >= p_amount
  returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  insert into public.credit_ledger
    (user_id, type, credits, balance_after, description, task_id, orchestration_id, created_at)
  values
    (p_user_id, 'usage', -p_amount, v_new_balance, p_description, p_task_id, p_orchestration_id, now());

  return v_new_balance;
end;
$$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
  LIMIT 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.clerk_user_id = (auth.jwt() ->> 'sub')
      AND p.role IN ('admin', 'owner')
  );
$$;


--
-- Name: refund_credits(uuid, integer, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_credits(p_user_id uuid, p_amount integer, p_reason text, p_task_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_new_balance integer;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  if p_amount = 0 then
    select balance into v_new_balance
      from public.credit_balances
     where user_id = p_user_id;
    return coalesce(v_new_balance, 0);
  end if;

  update public.credit_balances
     set balance    = balance + p_amount,
         updated_at = now()
   where user_id = p_user_id
  returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'NO_BALANCE_ROW' using errcode = 'P0002';
  end if;

  insert into public.credit_ledger
    (user_id, type, credits, balance_after, description, task_id, orchestration_id, created_at)
  values
    (p_user_id, 'refund', p_amount, v_new_balance, p_reason, p_task_id, null, now());

  return v_new_balance;
end;
$$;


--
-- Name: refund_credits(uuid, integer, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_credits(p_user_id uuid, p_amount integer, p_reason text, p_ref_type text DEFAULT NULL::text, p_ref_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_new_balance integer;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  if p_amount = 0 then
    -- Nothing to refund; return current balance.
    select balance into v_new_balance
      from public.credit_balances
     where user_id = p_user_id;
    return v_new_balance;
  end if;

  update public.credit_balances
     set balance    = balance + p_amount,
         -- lifetime_used = greatest(coalesce(lifetime_used,0) - p_amount, 0),  -- NET mode (optional)
         updated_at = now()
   where user_id = p_user_id
  returning balance into v_new_balance;

  if v_new_balance is null then
    -- No balance row for this user — cannot refund to a non-existent account.
    raise exception 'NO_BALANCE_ROW' using errcode = 'P0002';
  end if;

  insert into public.credit_ledger (user_id, amount, balance_after, reason, ref_type, ref_id, created_at)
  values (p_user_id, p_amount, v_new_balance, p_reason, p_ref_type, p_ref_id, now());

  return v_new_balance;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: add_ons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.add_ons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    service text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    stripe_subscription_id text,
    stripe_price_id text,
    start_date date,
    renewal_date date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT add_ons_service_check CHECK ((service = ANY (ARRAY['website'::text, 'social_media'::text, 'photography'::text, 'email_marketing'::text, 'seo'::text, 'brand_identity'::text, 'video_reels'::text, 'ad_management'::text]))),
    CONSTRAINT add_ons_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'cancelled'::text])))
);


--
-- Name: admin_email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    admin_id uuid,
    subject text NOT NULL,
    body text NOT NULL,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    admin_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_constraints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_constraints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    agent_id text NOT NULL,
    constraints text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid,
    user_id uuid,
    agent text NOT NULL,
    output_type text NOT NULL,
    title text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    cost_usd numeric(10,6) DEFAULT 0,
    feedback text,
    feedback_note text,
    feedback_at timestamp with time zone,
    media_storage_path text,
    media_mime text,
    lifecycle_stage text,
    zernio_post_id text,
    actor_profile_id uuid
);


--
-- Name: agent_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    agent text NOT NULL,
    frequency text DEFAULT 'weekly'::text NOT NULL,
    day_of_week integer DEFAULT 1,
    hour_of_day integer DEFAULT 8,
    is_active boolean DEFAULT true,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    name text NOT NULL,
    description text,
    skill_prompt text NOT NULL,
    handoff_to text[],
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    agent text NOT NULL,
    trigger_type text DEFAULT 'user'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb,
    output jsonb DEFAULT '{}'::jsonb,
    error text,
    requires_approval boolean DEFAULT false,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rejection_note text,
    scheduled_for timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    cost_usd numeric(10,6) DEFAULT 0,
    model text,
    orchestration_id uuid,
    updated_at timestamp with time zone DEFAULT now(),
    cached_tokens integer DEFAULT 0 NOT NULL,
    job_type text,
    rejection_reason text,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    assigned_to_profile_id uuid,
    assigned_by_profile_id uuid,
    assignment_note text,
    assignment_due_at timestamp with time zone,
    actor_profile_id uuid
);


--
-- Name: ai_tool_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_tool_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tool text NOT NULL,
    prompt_id uuid,
    input_summary text,
    output_length integer,
    time_saved_mins integer DEFAULT 15,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_tool_usage_tool_check CHECK ((tool = ANY (ARRAY['prompt_library'::text, 'seo_generator'::text, 'caption_generator'::text, 'email_builder'::text, 'ad_copy'::text, 'brand_voice'::text])))
);


--
-- Name: analytics_briefings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_briefings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    briefing_text text NOT NULL,
    signals jsonb,
    sources_used text[],
    time_range text NOT NULL,
    ga_snapshot jsonb,
    zernio_social_snapshot jsonb,
    zernio_ads_snapshot jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: anon_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anon_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event text NOT NULL,
    path text NOT NULL,
    variant text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_task_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_task_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    author_profile_id uuid NOT NULL,
    body text NOT NULL,
    note_kind text DEFAULT 'comment'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_task_notes_body_check CHECK ((char_length(TRIM(BOTH FROM body)) > 0)),
    CONSTRAINT approval_task_notes_note_kind_check CHECK ((note_kind = ANY (ARRAY['comment'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: automation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trigger_id uuid,
    status text NOT NULL,
    payload jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automation_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: automation_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_triggers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    trigger_event text NOT NULL,
    action_type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    run_count integer DEFAULT 0,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    content text NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_kit_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_kit_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    section_key text NOT NULL,
    asset_type text NOT NULL,
    name text NOT NULL,
    file_url text,
    external_url text,
    thumbnail_url text,
    metadata jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_kit_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_kit_colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text NOT NULL,
    name text,
    hex text NOT NULL,
    rgb text,
    notes text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_kit_fonts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_kit_fonts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text NOT NULL,
    family text NOT NULL,
    weight text,
    size_guide text,
    source_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_kit_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_kit_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    section_key text NOT NULL,
    completed boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text,
    plan jsonb,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tasks jsonb DEFAULT '[]'::jsonb,
    model_used text
);


--
-- Name: client_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    workspace_id uuid
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    session_id text NOT NULL,
    messages jsonb NOT NULL,
    lead_qualified boolean DEFAULT false,
    visitor_summary text
);


--
-- Name: creative_asset_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creative_asset_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: creative_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creative_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    storage_path text NOT NULL,
    mime text DEFAULT 'image/png'::text NOT NULL,
    asset_type text DEFAULT 'image'::text NOT NULL,
    source text DEFAULT 'generation'::text NOT NULL,
    brief_id uuid,
    option_index integer,
    image_model text,
    image_model_label text,
    brief_excerpt text,
    post_context jsonb,
    is_favorite boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    brief text,
    qa_passed boolean,
    folder_id uuid
);


--
-- Name: credit_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_balances (
    user_id uuid NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    lifetime_used integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    credits integer NOT NULL,
    balance_after integer NOT NULL,
    description text,
    task_id uuid,
    orchestration_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_topups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_topups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    stripe_session_id text NOT NULL,
    stripe_payment_id text,
    credits integer NOT NULL,
    amount_usd numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: daily_digests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_digests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    date date NOT NULL,
    agent_runs jsonb,
    approvals jsonb,
    today_actions jsonb,
    email_sent boolean DEFAULT false,
    email_sent_at timestamp with time zone,
    dismissed boolean DEFAULT false,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    milestone_id uuid,
    title text NOT NULL,
    description text,
    file_url text,
    file_type text,
    file_size integer,
    version integer DEFAULT 1,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: foundation_changelog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foundation_changelog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    signal_type text NOT NULL,
    agent_id text,
    source_task_id uuid,
    content_summary text NOT NULL,
    raw_context jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT foundation_changelog_signal_type_check CHECK ((signal_type = ANY (ARRAY['approved'::text, 'rejected'::text, 'edited'::text])))
);


--
-- Name: foundation_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foundation_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    title text,
    content jsonb,
    markdown text,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: foundation_field_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foundation_field_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    field_key text NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    feedback text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: foundation_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foundation_knowledge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    source_type text NOT NULL,
    source_name text,
    raw_content text,
    extraction_result jsonb,
    confirmed_fields jsonb,
    storage_path text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_purpose text,
    purpose_confidence text,
    purpose_reason text
);


--
-- Name: COLUMN foundation_knowledge.source_purpose; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.foundation_knowledge.source_purpose IS 'own_business | competitor | market_reference | customer_voice | unknown';


--
-- Name: COLUMN foundation_knowledge.purpose_confidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.foundation_knowledge.purpose_confidence IS 'high | medium | low — classifier confidence for source_purpose';


--
-- Name: foundation_layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foundation_layers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    source_proposal_id uuid,
    state text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    theme text,
    approved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT foundation_layers_state_check CHECK ((state = ANY (ARRAY['consistent'::text, 'extending'::text])))
);


--
-- Name: foundation_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foundation_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    state text NOT NULL,
    guardian_verdict text NOT NULL,
    proposal_title text NOT NULL,
    proposal_body text NOT NULL,
    phase1_excerpt text,
    signal_summary text NOT NULL,
    source_changelog_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    theme text,
    rationale text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_decision text DEFAULT 'pending'::text NOT NULL,
    decided_at timestamp with time zone,
    decision_note text,
    CONSTRAINT foundation_proposals_guardian_verdict_check CHECK ((guardian_verdict = ANY (ARRAY['surface'::text, 'hold'::text, 'reject_internal'::text]))),
    CONSTRAINT foundation_proposals_state_check CHECK ((state = ANY (ARRAY['consistent'::text, 'extending'::text, 'contradicting'::text]))),
    CONSTRAINT foundation_proposals_user_decision_check CHECK ((user_decision = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'deferred'::text])))
);


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    access_token text,
    refresh_token text,
    account_id text,
    account_name text,
    account_avatar text,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    connected_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT integrations_platform_check CHECK ((platform = ANY (ARRAY['instagram'::text, 'facebook'::text, 'google_analytics'::text, 'google_drive'::text, 'slack'::text, 'notion'::text, 'mailchimp'::text, 'klaviyo'::text, 'zapier'::text, 'make'::text])))
);


--
-- Name: marketing_chat_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_chat_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    model text,
    prompt_tokens integer,
    completion_tokens integer,
    cost_usd numeric(12,6),
    ip_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_chat_logs_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: maya_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maya_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    mode text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text,
    canvas_context text
);


--
-- Name: milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    due_date date,
    completed_at timestamp with time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT milestones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'complete'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    body text,
    type text NOT NULL,
    link text,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    sender_id uuid,
    email_sent boolean DEFAULT false,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['order_status'::text, 'order_delivered'::text, 'support_reply'::text, 'support_closed'::text, 'deliverable_uploaded'::text, 'brand_kit_generated'::text, 'plan_activated'::text, 'trial_ending'::text, 'credit_topup'::text, 'approval_pending'::text, 'payment_failed'::text, 'subscription_canceled'::text, 'team_member_joined'::text, 'maya_nudge'::text, 'foundation_milestone'::text, 'assignment_created'::text, 'assignment_submitted'::text, 'task_note'::text, 'task_note_mention'::text, 'approval_note'::text, 'approval_note_mention'::text, 'agent_run_failed'::text])))
);


--
-- Name: oauth_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_states (
    nonce text NOT NULL,
    clerk_id text NOT NULL,
    provider text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orchestration_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orchestration_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    triggered_by text,
    status text DEFAULT 'running'::text,
    total_tasks integer DEFAULT 0,
    completed_tasks integer DEFAULT 0,
    total_input_tokens integer DEFAULT 0,
    total_output_tokens integer DEFAULT 0,
    total_cost_usd numeric(10,4) DEFAULT 0,
    budget_cap_usd numeric(10,4),
    budget_exceeded boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    agent_ids text[],
    agent_status jsonb
);


--
-- Name: order_deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    title text NOT NULL,
    file_url text,
    file_type text,
    version integer DEFAULT 1,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    role text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT order_messages_role_check CHECK ((role = ANY (ARRAY['client'::text, 'admin'::text])))
);


--
-- Name: order_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    feedback text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    assigned_admin_id uuid,
    service_type text NOT NULL,
    title text NOT NULL,
    brief text,
    status text DEFAULT 'submitted'::text NOT NULL,
    priority text DEFAULT 'medium'::text,
    due_date date,
    delivered_at timestamp with time zone,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT orders_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'in_review'::text, 'in_progress'::text, 'delivered'::text, 'revision_requested'::text, 'approved'::text, 'cancelled'::text])))
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text,
    company_name text,
    avatar_url text,
    role text DEFAULT 'client'::text NOT NULL,
    plan text,
    status text DEFAULT 'onboarding'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    onboarding_complete boolean DEFAULT false,
    business_type text,
    business_goals text[],
    website_url text,
    instagram_handle text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    clerk_user_id text,
    ga_measurement_id text,
    meta_ad_account_id text,
    ga_refresh_token text,
    ga_oauth_email text,
    ga_connected boolean DEFAULT false,
    meta_access_token text,
    meta_ig_account_id text,
    meta_connected boolean DEFAULT false,
    account_id uuid,
    is_account_owner boolean DEFAULT true,
    ideal_customer text,
    sell_locations text[],
    marketing_budget text,
    competitors text[],
    top_goals text[],
    marketing_challenge text,
    content_comfort text,
    foundation_complete boolean DEFAULT false,
    foundation_step integer DEFAULT 0,
    foundation_score integer DEFAULT 0,
    foundation_answers jsonb,
    foundation_updated_at timestamp with time zone,
    last_active_at timestamp with time zone,
    engagement_score integer DEFAULT 0,
    engagement_updated_at timestamp with time zone,
    last_nudged_at timestamp with time zone,
    email_digest boolean DEFAULT true,
    email_approvals boolean DEFAULT true,
    email_weekly boolean DEFAULT true,
    timezone text DEFAULT 'America/New_York'::text,
    getting_started_dismissed boolean DEFAULT false,
    foundation_research jsonb,
    foundation_research_variant text,
    foundation_knowledge_count integer DEFAULT 0,
    zernio_profile_id text,
    zernio_connected_platforms jsonb DEFAULT '[]'::jsonb,
    zernio_connected_at timestamp with time zone,
    zernio_profile_ids text[] DEFAULT '{}'::text[],
    foundation_answers_previous jsonb,
    foundation_answers_previous_at timestamp with time zone,
    creative_direction jsonb,
    creative_direction_computed_at timestamp with time zone,
    creative_direction_source_hash text,
    billing_exempt boolean DEFAULT false NOT NULL,
    employee_count_bucket text,
    annual_revenue_bucket text,
    site_snapshot jsonb,
    site_snapshot_enabled boolean DEFAULT false NOT NULL,
    site_snapshot_generated_at timestamp with time zone,
    site_snapshot_source_url text,
    CONSTRAINT profiles_plan_check CHECK ((plan = ANY (ARRAY['ai_sprint'::text, 'growth'::text, 'done_for_you'::text, NULL::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'client'::text]))),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['onboarding'::text, 'active'::text, 'paused'::text, 'churned'::text])))
);


--
-- Name: COLUMN profiles.creative_direction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.creative_direction IS 'Cached CreativeDirection object from translateFoundationToCreativeDirection()';


--
-- Name: COLUMN profiles.creative_direction_source_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.creative_direction_source_hash IS 'SHA-256 of answer + document fields the translation layer reads';


--
-- Name: COLUMN profiles.billing_exempt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.billing_exempt IS 'When true, account has complimentary access at profiles.plan tier — no Stripe subscription required.';


--
-- Name: COLUMN profiles.site_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.site_snapshot IS 'Structured SiteSnapshot from enrichFromWebsite — user-reviewed; does not mutate foundation_answers';


--
-- Name: COLUMN profiles.site_snapshot_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.site_snapshot_enabled IS 'When true, agents read site_snapshot in buildAgentContext';


--
-- Name: project_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    service_type text NOT NULL,
    project_name text NOT NULL,
    description text NOT NULL,
    platform text[],
    has_existing_brand boolean DEFAULT false,
    has_existing_designs boolean DEFAULT false,
    timeline text,
    budget_range text,
    additional_notes text,
    status text DEFAULT 'new'::text,
    admin_notes text,
    proposal_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    phase text DEFAULT 'discovery'::text NOT NULL,
    progress_percent integer DEFAULT 0,
    start_date date,
    due_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT projects_phase_check CHECK ((phase = ANY (ARRAY['discovery'::text, 'building'::text, 'review'::text, 'delivered'::text]))),
    CONSTRAINT projects_progress_percent_check CHECK (((progress_percent >= 0) AND (progress_percent <= 100)))
);


--
-- Name: prompt_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompt_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text,
    prompt text NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb,
    time_saved_mins integer DEFAULT 15,
    is_active boolean DEFAULT true,
    is_premium boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT prompt_library_category_check CHECK ((category = ANY (ARRAY['email'::text, 'social'::text, 'seo'::text, 'ads'::text, 'brand'::text, 'sales'::text, 'operations'::text, 'general'::text])))
);


--
-- Name: prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: saved_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    prompt text NOT NULL,
    category text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    category text,
    requires_scope boolean DEFAULT false
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    role text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT support_messages_role_check CHECK ((role = ANY (ARRAY['client'::text, 'admin'::text])))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    assigned_admin_id uuid,
    subject text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'medium'::text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    body text,
    CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    member_profile_id uuid,
    role text DEFAULT 'member'::text,
    permissions jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text,
    invited_email text,
    invite_token text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: team_task_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_task_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    author_profile_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_task_notes_body_check CHECK ((char_length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: template_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    template_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text,
    file_url text,
    preview_url text,
    is_active boolean DEFAULT true,
    is_premium boolean DEFAULT false,
    download_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT templates_category_check CHECK ((category = ANY (ARRAY['content_calendar'::text, 'brand_kit'::text, 'email_sequence'::text, 'sop'::text, 'social_strategy'::text, 'ads'::text, 'general'::text])))
);


--
-- Name: v_account_month_cost; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_account_month_cost WITH (security_invoker='true') AS
 SELECT p.id AS user_id,
    p.company_name,
    p.plan,
        CASE lower(p.plan)
            WHEN 'starter'::text THEN 49
            WHEN 'growth'::text THEN 89
            WHEN 'proagent'::text THEN 149
            ELSE 0
        END AS mrr_usd,
    count(t.id) AS tasks_this_month,
    COALESCE(sum(t.input_tokens), (0)::bigint) AS input_tokens,
    COALESCE(sum(t.output_tokens), (0)::bigint) AS output_tokens,
    COALESCE(sum(t.cached_tokens), (0)::bigint) AS cached_tokens,
    COALESCE(sum(t.cost_usd), (0)::numeric) AS cost_usd,
    COALESCE(sum(
        CASE
            WHEN (t.agent = 'maya'::text) THEN t.cost_usd
            ELSE (0)::numeric
        END), (0)::numeric) AS maya_cost_usd,
    cb.balance AS credits_remaining,
    date_trunc('month'::text, (now() AT TIME ZONE 'UTC'::text)) AS month_start
   FROM ((public.profiles p
     LEFT JOIN public.agent_tasks t ON (((t.user_id = p.id) AND (t.status = 'completed'::text) AND (t.created_at >= date_trunc('month'::text, (now() AT TIME ZONE 'UTC'::text))))))
     LEFT JOIN public.credit_balances cb ON ((cb.user_id = p.id)))
  GROUP BY p.id, p.company_name, p.plan, cb.balance;


--
-- Name: zernio_api_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zernio_api_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    zernio_profile_id text,
    platform text,
    operation text NOT NULL,
    http_method text DEFAULT 'GET'::text NOT NULL,
    path text NOT NULL,
    status_code integer,
    estimated_cost_usd numeric(12,6) DEFAULT 0 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_admin_x_usage_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_admin_x_usage_summary WITH (security_invoker='true') AS
 SELECT count(*) FILTER (WHERE (platform = 'x'::text)) AS x_calls_30d,
    COALESCE(sum(estimated_cost_usd) FILTER (WHERE (platform = 'x'::text)), (0)::numeric) AS x_cost_30d,
    count(DISTINCT user_id) FILTER (WHERE (platform = 'x'::text)) AS x_active_tenants_30d,
    count(*) AS total_calls_30d,
    COALESCE(sum(estimated_cost_usd), (0)::numeric) AS total_estimated_cost_30d
   FROM public.zernio_api_usage
  WHERE (created_at >= ((now() AT TIME ZONE 'UTC'::text) - '30 days'::interval));


--
-- Name: v_x_usage_30d; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_x_usage_30d WITH (security_invoker='true') AS
 SELECT u.user_id,
    p.company_name,
    p.plan,
    count(*) AS x_call_count,
    COALESCE(sum(u.estimated_cost_usd), (0)::numeric) AS x_estimated_cost_usd
   FROM (public.zernio_api_usage u
     JOIN public.profiles p ON ((p.id = u.user_id)))
  WHERE ((u.platform = 'x'::text) AND (u.created_at >= ((now() AT TIME ZONE 'UTC'::text) - '30 days'::interval)))
  GROUP BY u.user_id, p.company_name, p.plan;


--
-- Name: value_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.value_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    hours_saved numeric DEFAULT 0,
    content_count integer DEFAULT 0,
    posts_published integer DEFAULT 0,
    emails_sent integer DEFAULT 0,
    ai_outputs_generated integer DEFAULT 0,
    follower_delta integer DEFAULT 0,
    website_sessions integer DEFAULT 0,
    leads_captured integer DEFAULT 0,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: white_label_tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.white_label_tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tool_type text NOT NULL,
    custom_slug text,
    brand_name text,
    logo_url text,
    accent_color text DEFAULT '#c8522a'::text,
    is_active boolean DEFAULT true,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT white_label_tools_tool_type_check CHECK ((tool_type = ANY (ARRAY['seo_generator'::text, 'caption_generator'::text, 'email_builder'::text, 'ad_copy'::text])))
);


--
-- Name: add_ons add_ons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.add_ons
    ADD CONSTRAINT add_ons_pkey PRIMARY KEY (id);


--
-- Name: admin_email_log admin_email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_email_log
    ADD CONSTRAINT admin_email_log_pkey PRIMARY KEY (id);


--
-- Name: admin_notes admin_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notes
    ADD CONSTRAINT admin_notes_pkey PRIMARY KEY (id);


--
-- Name: agent_constraints agent_constraints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_constraints
    ADD CONSTRAINT agent_constraints_pkey PRIMARY KEY (id);


--
-- Name: agent_constraints agent_constraints_user_id_agent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_constraints
    ADD CONSTRAINT agent_constraints_user_id_agent_id_key UNIQUE (user_id, agent_id);


--
-- Name: agent_outputs agent_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs
    ADD CONSTRAINT agent_outputs_pkey PRIMARY KEY (id);


--
-- Name: agent_schedules agent_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_schedules
    ADD CONSTRAINT agent_schedules_pkey PRIMARY KEY (id);


--
-- Name: agent_skills agent_skills_agent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_agent_id_key UNIQUE (agent_id);


--
-- Name: agent_skills agent_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_pkey PRIMARY KEY (id);


--
-- Name: agent_tasks agent_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_pkey PRIMARY KEY (id);


--
-- Name: ai_tool_usage ai_tool_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tool_usage
    ADD CONSTRAINT ai_tool_usage_pkey PRIMARY KEY (id);


--
-- Name: analytics_briefings analytics_briefings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_briefings
    ADD CONSTRAINT analytics_briefings_pkey PRIMARY KEY (id);


--
-- Name: anon_events anon_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anon_events
    ADD CONSTRAINT anon_events_pkey PRIMARY KEY (id);


--
-- Name: approval_task_notes approval_task_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_task_notes
    ADD CONSTRAINT approval_task_notes_pkey PRIMARY KEY (id);


--
-- Name: automation_logs automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_triggers automation_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_triggers
    ADD CONSTRAINT automation_triggers_pkey PRIMARY KEY (id);


--
-- Name: brand_answers brand_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_answers
    ADD CONSTRAINT brand_answers_pkey PRIMARY KEY (id);


--
-- Name: brand_document_versions brand_document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_document_versions
    ADD CONSTRAINT brand_document_versions_pkey PRIMARY KEY (id);


--
-- Name: brand_documents brand_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_documents
    ADD CONSTRAINT brand_documents_pkey PRIMARY KEY (id);


--
-- Name: brand_kit_assets brand_kit_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_assets
    ADD CONSTRAINT brand_kit_assets_pkey PRIMARY KEY (id);


--
-- Name: brand_kit_colors brand_kit_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_colors
    ADD CONSTRAINT brand_kit_colors_pkey PRIMARY KEY (id);


--
-- Name: brand_kit_fonts brand_kit_fonts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_fonts
    ADD CONSTRAINT brand_kit_fonts_pkey PRIMARY KEY (id);


--
-- Name: brand_kit_fonts brand_kit_fonts_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_fonts
    ADD CONSTRAINT brand_kit_fonts_user_id_role_key UNIQUE (user_id, role);


--
-- Name: brand_kit_sections brand_kit_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_sections
    ADD CONSTRAINT brand_kit_sections_pkey PRIMARY KEY (id);


--
-- Name: brand_kit_sections brand_kit_sections_user_id_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_sections
    ADD CONSTRAINT brand_kit_sections_user_id_section_key_key UNIQUE (user_id, section_key);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: client_activity_log client_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_activity_log
    ADD CONSTRAINT client_activity_log_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_session_id_key UNIQUE (session_id);


--
-- Name: creative_asset_folders creative_asset_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creative_asset_folders
    ADD CONSTRAINT creative_asset_folders_pkey PRIMARY KEY (id);


--
-- Name: creative_asset_folders creative_asset_folders_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creative_asset_folders
    ADD CONSTRAINT creative_asset_folders_user_id_name_key UNIQUE (user_id, name);


--
-- Name: creative_assets creative_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creative_assets
    ADD CONSTRAINT creative_assets_pkey PRIMARY KEY (id);


--
-- Name: creative_assets creative_assets_user_id_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creative_assets
    ADD CONSTRAINT creative_assets_user_id_storage_path_key UNIQUE (user_id, storage_path);


--
-- Name: credit_balances credit_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_balances
    ADD CONSTRAINT credit_balances_pkey PRIMARY KEY (user_id);


--
-- Name: credit_ledger credit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_pkey PRIMARY KEY (id);


--
-- Name: credit_topups credit_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_pkey PRIMARY KEY (id);


--
-- Name: daily_digests daily_digests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_digests
    ADD CONSTRAINT daily_digests_pkey PRIMARY KEY (id);


--
-- Name: daily_digests daily_digests_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_digests
    ADD CONSTRAINT daily_digests_user_id_date_key UNIQUE (user_id, date);


--
-- Name: deliverables deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_pkey PRIMARY KEY (id);


--
-- Name: foundation_changelog foundation_changelog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_changelog
    ADD CONSTRAINT foundation_changelog_pkey PRIMARY KEY (id);


--
-- Name: foundation_documents foundation_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_documents
    ADD CONSTRAINT foundation_documents_pkey PRIMARY KEY (id);


--
-- Name: foundation_documents foundation_documents_user_id_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_documents
    ADD CONSTRAINT foundation_documents_user_id_type_key UNIQUE (user_id, type);


--
-- Name: foundation_field_scores foundation_field_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_field_scores
    ADD CONSTRAINT foundation_field_scores_pkey PRIMARY KEY (id);


--
-- Name: foundation_field_scores foundation_field_scores_user_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_field_scores
    ADD CONSTRAINT foundation_field_scores_user_id_field_key_key UNIQUE (user_id, field_key);


--
-- Name: foundation_knowledge foundation_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_knowledge
    ADD CONSTRAINT foundation_knowledge_pkey PRIMARY KEY (id);


--
-- Name: foundation_layers foundation_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_layers
    ADD CONSTRAINT foundation_layers_pkey PRIMARY KEY (id);


--
-- Name: foundation_proposals foundation_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_proposals
    ADD CONSTRAINT foundation_proposals_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_user_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_platform_key UNIQUE (user_id, platform);


--
-- Name: marketing_chat_logs marketing_chat_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_chat_logs
    ADD CONSTRAINT marketing_chat_logs_pkey PRIMARY KEY (id);


--
-- Name: maya_sessions maya_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maya_sessions
    ADD CONSTRAINT maya_sessions_pkey PRIMARY KEY (id);


--
-- Name: milestones milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: oauth_states oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_pkey PRIMARY KEY (nonce);


--
-- Name: orchestration_sessions orchestration_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_sessions
    ADD CONSTRAINT orchestration_sessions_pkey PRIMARY KEY (id);


--
-- Name: order_deliverables order_deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_deliverables
    ADD CONSTRAINT order_deliverables_pkey PRIMARY KEY (id);


--
-- Name: order_messages order_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_pkey PRIMARY KEY (id);


--
-- Name: order_revisions order_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_revisions
    ADD CONSTRAINT order_revisions_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_key_key UNIQUE (key);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_clerk_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_clerk_user_id_key UNIQUE (clerk_user_id);


--
-- Name: profiles profiles_clerk_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_clerk_user_id_unique UNIQUE (clerk_user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_inquiries project_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_inquiries
    ADD CONSTRAINT project_inquiries_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: prompt_library prompt_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_library
    ADD CONSTRAINT prompt_library_pkey PRIMARY KEY (id);


--
-- Name: prompts prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompts
    ADD CONSTRAINT prompts_pkey PRIMARY KEY (id);


--
-- Name: saved_prompts saved_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_prompts
    ADD CONSTRAINT saved_prompts_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_invite_token_key UNIQUE (invite_token);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_task_notes team_task_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_notes
    ADD CONSTRAINT team_task_notes_pkey PRIMARY KEY (id);


--
-- Name: template_downloads template_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_downloads
    ADD CONSTRAINT template_downloads_pkey PRIMARY KEY (id);


--
-- Name: template_downloads template_downloads_user_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_downloads
    ADD CONSTRAINT template_downloads_user_id_template_id_key UNIQUE (user_id, template_id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: value_snapshots value_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_snapshots
    ADD CONSTRAINT value_snapshots_pkey PRIMARY KEY (id);


--
-- Name: value_snapshots value_snapshots_user_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_snapshots
    ADD CONSTRAINT value_snapshots_user_id_snapshot_date_key UNIQUE (user_id, snapshot_date);


--
-- Name: white_label_tools white_label_tools_custom_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.white_label_tools
    ADD CONSTRAINT white_label_tools_custom_slug_key UNIQUE (custom_slug);


--
-- Name: white_label_tools white_label_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.white_label_tools
    ADD CONSTRAINT white_label_tools_pkey PRIMARY KEY (id);


--
-- Name: zernio_api_usage zernio_api_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zernio_api_usage
    ADD CONSTRAINT zernio_api_usage_pkey PRIMARY KEY (id);


--
-- Name: agent_outputs_user_lifecycle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_outputs_user_lifecycle_idx ON public.agent_outputs USING btree (user_id, lifecycle_stage) WHERE (lifecycle_stage IS NOT NULL);


--
-- Name: agent_outputs_workspace_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_outputs_workspace_actor_idx ON public.agent_outputs USING btree (user_id, actor_profile_id, created_at DESC);


--
-- Name: agent_outputs_zernio_post_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_outputs_zernio_post_id_idx ON public.agent_outputs USING btree (zernio_post_id) WHERE (zernio_post_id IS NOT NULL);


--
-- Name: agent_tasks_agent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_agent_idx ON public.agent_tasks USING btree (agent);


--
-- Name: agent_tasks_assigned_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_assigned_to_idx ON public.agent_tasks USING btree (assigned_to_profile_id, status, created_at DESC) WHERE (assigned_to_profile_id IS NOT NULL);


--
-- Name: agent_tasks_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_created_at_idx ON public.agent_tasks USING btree (created_at DESC);


--
-- Name: agent_tasks_job_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_job_type_idx ON public.agent_tasks USING btree (job_type);


--
-- Name: agent_tasks_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_status_idx ON public.agent_tasks USING btree (status);


--
-- Name: agent_tasks_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_user_id_idx ON public.agent_tasks USING btree (user_id);


--
-- Name: agent_tasks_user_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_user_month_idx ON public.agent_tasks USING btree (user_id, created_at DESC);


--
-- Name: agent_tasks_workspace_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_workspace_actor_idx ON public.agent_tasks USING btree (user_id, actor_profile_id, created_at DESC);


--
-- Name: agent_tasks_workspace_assigned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tasks_workspace_assigned_idx ON public.agent_tasks USING btree (user_id, assigned_to_profile_id, created_at DESC) WHERE (assigned_to_profile_id IS NOT NULL);


--
-- Name: analytics_briefings_profile_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_briefings_profile_created ON public.analytics_briefings USING btree (profile_id, created_at DESC);


--
-- Name: anon_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anon_events_created_at_idx ON public.anon_events USING btree (created_at DESC);


--
-- Name: anon_events_event_variant_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anon_events_event_variant_created_idx ON public.anon_events USING btree (event, variant, created_at DESC);


--
-- Name: approval_task_notes_task_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_task_notes_task_created_idx ON public.approval_task_notes USING btree (task_id, created_at);


--
-- Name: approval_task_notes_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_task_notes_workspace_idx ON public.approval_task_notes USING btree (workspace_id, created_at DESC);


--
-- Name: brand_answers_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brand_answers_user_id_idx ON public.brand_answers USING btree (user_id);


--
-- Name: brand_documents_user_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brand_documents_user_type_idx ON public.brand_documents USING btree (user_id, type);


--
-- Name: client_activity_log_workspace_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_activity_log_workspace_created_idx ON public.client_activity_log USING btree (workspace_id, created_at DESC);


--
-- Name: foundation_knowledge_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foundation_knowledge_profile_id_idx ON public.foundation_knowledge USING btree (profile_id);


--
-- Name: foundation_knowledge_source_purpose_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foundation_knowledge_source_purpose_idx ON public.foundation_knowledge USING btree (profile_id, source_purpose);


--
-- Name: idx_admin_email_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_email_log_user ON public.admin_email_log USING btree (user_id, sent_at DESC);


--
-- Name: idx_admin_notes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notes_user ON public.admin_notes USING btree (user_id, created_at DESC);


--
-- Name: idx_agent_constraints_user_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_constraints_user_agent ON public.agent_constraints USING btree (user_id, agent_id);


--
-- Name: idx_brand_kit_assets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_kit_assets_user ON public.brand_kit_assets USING btree (user_id, section_key);


--
-- Name: idx_brand_kit_colors_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_kit_colors_user ON public.brand_kit_colors USING btree (user_id);


--
-- Name: idx_brand_kit_fonts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_kit_fonts_user ON public.brand_kit_fonts USING btree (user_id);


--
-- Name: idx_client_activity_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_activity_recent ON public.client_activity_log USING btree (created_at DESC);


--
-- Name: idx_client_activity_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_activity_user ON public.client_activity_log USING btree (user_id, created_at DESC);


--
-- Name: idx_creative_asset_folders_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creative_asset_folders_user ON public.creative_asset_folders USING btree (user_id, created_at DESC);


--
-- Name: idx_creative_assets_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creative_assets_user_created ON public.creative_assets USING btree (user_id, created_at DESC);


--
-- Name: idx_creative_assets_user_favorite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creative_assets_user_favorite ON public.creative_assets USING btree (user_id, is_favorite) WHERE (is_favorite = true);


--
-- Name: idx_creative_assets_user_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creative_assets_user_folder ON public.creative_assets USING btree (user_id, folder_id);


--
-- Name: idx_credit_topups_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_topups_session ON public.credit_topups USING btree (stripe_session_id);


--
-- Name: idx_credit_topups_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_topups_user ON public.credit_topups USING btree (user_id, created_at DESC);


--
-- Name: idx_daily_digests_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_digests_user_date ON public.daily_digests USING btree (user_id, date DESC);


--
-- Name: idx_foundation_changelog_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foundation_changelog_profile ON public.foundation_changelog USING btree (profile_id, created_at DESC);


--
-- Name: idx_foundation_layers_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foundation_layers_profile ON public.foundation_layers USING btree (profile_id, approved_at DESC);


--
-- Name: idx_foundation_proposals_pending_surface; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foundation_proposals_pending_surface ON public.foundation_proposals USING btree (profile_id, created_at DESC) WHERE ((guardian_verdict = 'surface'::text) AND (user_decision = 'pending'::text));


--
-- Name: idx_foundation_proposals_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foundation_proposals_profile ON public.foundation_proposals USING btree (profile_id, created_at DESC);


--
-- Name: idx_maya_sessions_user_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maya_sessions_user_updated ON public.maya_sessions USING btree (user_id, updated_at DESC);


--
-- Name: marketing_chat_logs_ip_hash_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_chat_logs_ip_hash_created_idx ON public.marketing_chat_logs USING btree (ip_hash, created_at DESC);


--
-- Name: marketing_chat_logs_session_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_chat_logs_session_created_idx ON public.marketing_chat_logs USING btree (session_id, created_at);


--
-- Name: maya_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maya_sessions_user_id_idx ON public.maya_sessions USING btree (user_id);


--
-- Name: notifications_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id) WHERE (read = false);


--
-- Name: oauth_states_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX oauth_states_expires_at_idx ON public.oauth_states USING btree (expires_at);


--
-- Name: profiles_client_email_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_client_email_active_unique ON public.profiles USING btree (lower(TRIM(BOTH FROM email))) WHERE ((role = 'client'::text) AND (status = ANY (ARRAY['active'::text, 'onboarding'::text, 'paused'::text])) AND (email IS NOT NULL) AND (TRIM(BOTH FROM email) <> ''::text));


--
-- Name: project_inquiries_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_inquiries_status_idx ON public.project_inquiries USING btree (status);


--
-- Name: project_inquiries_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_inquiries_user_id_idx ON public.project_inquiries USING btree (user_id);


--
-- Name: team_task_notes_task_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_task_notes_task_created_idx ON public.team_task_notes USING btree (task_id, created_at);


--
-- Name: team_task_notes_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_task_notes_workspace_idx ON public.team_task_notes USING btree (workspace_id, created_at DESC);


--
-- Name: zernio_api_usage_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zernio_api_usage_created_at_idx ON public.zernio_api_usage USING btree (created_at DESC);


--
-- Name: zernio_api_usage_platform_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zernio_api_usage_platform_created_idx ON public.zernio_api_usage USING btree (platform, created_at DESC) WHERE (platform = 'x'::text);


--
-- Name: zernio_api_usage_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zernio_api_usage_user_created_idx ON public.zernio_api_usage USING btree (user_id, created_at DESC);


--
-- Name: orders set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: support_tickets set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: add_ons add_ons_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.add_ons
    ADD CONSTRAINT add_ons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: admin_email_log admin_email_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_email_log
    ADD CONSTRAINT admin_email_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: admin_email_log admin_email_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_email_log
    ADD CONSTRAINT admin_email_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: admin_notes admin_notes_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notes
    ADD CONSTRAINT admin_notes_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: admin_notes admin_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notes
    ADD CONSTRAINT admin_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: agent_constraints agent_constraints_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_constraints
    ADD CONSTRAINT agent_constraints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: agent_outputs agent_outputs_actor_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs
    ADD CONSTRAINT agent_outputs_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: agent_outputs agent_outputs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs
    ADD CONSTRAINT agent_outputs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.agent_tasks(id) ON DELETE CASCADE;


--
-- Name: agent_outputs agent_outputs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_outputs
    ADD CONSTRAINT agent_outputs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: agent_schedules agent_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_schedules
    ADD CONSTRAINT agent_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: agent_tasks agent_tasks_actor_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: agent_tasks agent_tasks_assigned_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_assigned_by_profile_id_fkey FOREIGN KEY (assigned_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: agent_tasks agent_tasks_assigned_to_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_assigned_to_profile_id_fkey FOREIGN KEY (assigned_to_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: agent_tasks agent_tasks_orchestration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_orchestration_id_fkey FOREIGN KEY (orchestration_id) REFERENCES public.orchestration_sessions(id) ON DELETE SET NULL;


--
-- Name: agent_tasks agent_tasks_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: agent_tasks agent_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ai_tool_usage ai_tool_usage_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tool_usage
    ADD CONSTRAINT ai_tool_usage_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompt_library(id) ON DELETE SET NULL;


--
-- Name: ai_tool_usage ai_tool_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tool_usage
    ADD CONSTRAINT ai_tool_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: analytics_briefings analytics_briefings_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_briefings
    ADD CONSTRAINT analytics_briefings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: approval_task_notes approval_task_notes_author_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_task_notes
    ADD CONSTRAINT approval_task_notes_author_profile_id_fkey FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: approval_task_notes approval_task_notes_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_task_notes
    ADD CONSTRAINT approval_task_notes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.agent_tasks(id) ON DELETE CASCADE;


--
-- Name: approval_task_notes approval_task_notes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_task_notes
    ADD CONSTRAINT approval_task_notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: automation_logs automation_logs_trigger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES public.automation_triggers(id) ON DELETE CASCADE;


--
-- Name: automation_logs automation_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: automation_triggers automation_triggers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_triggers
    ADD CONSTRAINT automation_triggers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brand_answers brand_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_answers
    ADD CONSTRAINT brand_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brand_document_versions brand_document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_document_versions
    ADD CONSTRAINT brand_document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.brand_documents(id) ON DELETE CASCADE;


--
-- Name: brand_documents brand_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_documents
    ADD CONSTRAINT brand_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brand_kit_assets brand_kit_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_assets
    ADD CONSTRAINT brand_kit_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brand_kit_colors brand_kit_colors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_colors
    ADD CONSTRAINT brand_kit_colors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brand_kit_fonts brand_kit_fonts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_fonts
    ADD CONSTRAINT brand_kit_fonts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brand_kit_sections brand_kit_sections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit_sections
    ADD CONSTRAINT brand_kit_sections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: client_activity_log client_activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_activity_log
    ADD CONSTRAINT client_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: client_activity_log client_activity_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_activity_log
    ADD CONSTRAINT client_activity_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: creative_asset_folders creative_asset_folders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creative_asset_folders
    ADD CONSTRAINT creative_asset_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: creative_assets creative_assets_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creative_assets
    ADD CONSTRAINT creative_assets_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.creative_asset_folders(id) ON DELETE SET NULL;


--
-- Name: creative_assets creative_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creative_assets
    ADD CONSTRAINT creative_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: credit_balances credit_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_balances
    ADD CONSTRAINT credit_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: credit_ledger credit_ledger_orchestration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_orchestration_id_fkey FOREIGN KEY (orchestration_id) REFERENCES public.orchestration_sessions(id) ON DELETE SET NULL;


--
-- Name: credit_ledger credit_ledger_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.agent_tasks(id) ON DELETE SET NULL;


--
-- Name: credit_ledger credit_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: credit_topups credit_topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_digests daily_digests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_digests
    ADD CONSTRAINT daily_digests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: deliverables deliverables_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE SET NULL;


--
-- Name: deliverables deliverables_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: deliverables deliverables_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);


--
-- Name: foundation_changelog foundation_changelog_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_changelog
    ADD CONSTRAINT foundation_changelog_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: foundation_changelog foundation_changelog_source_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_changelog
    ADD CONSTRAINT foundation_changelog_source_task_id_fkey FOREIGN KEY (source_task_id) REFERENCES public.agent_tasks(id) ON DELETE SET NULL;


--
-- Name: foundation_documents foundation_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_documents
    ADD CONSTRAINT foundation_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: foundation_field_scores foundation_field_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_field_scores
    ADD CONSTRAINT foundation_field_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: foundation_knowledge foundation_knowledge_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_knowledge
    ADD CONSTRAINT foundation_knowledge_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: foundation_layers foundation_layers_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_layers
    ADD CONSTRAINT foundation_layers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: foundation_layers foundation_layers_source_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_layers
    ADD CONSTRAINT foundation_layers_source_proposal_id_fkey FOREIGN KEY (source_proposal_id) REFERENCES public.foundation_proposals(id) ON DELETE SET NULL;


--
-- Name: foundation_proposals foundation_proposals_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foundation_proposals
    ADD CONSTRAINT foundation_proposals_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: integrations integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: maya_sessions maya_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maya_sessions
    ADD CONSTRAINT maya_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: milestones milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: orchestration_sessions orchestration_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_sessions
    ADD CONSTRAINT orchestration_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: order_deliverables order_deliverables_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_deliverables
    ADD CONSTRAINT order_deliverables_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_deliverables order_deliverables_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_deliverables
    ADD CONSTRAINT order_deliverables_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);


--
-- Name: order_messages order_messages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_messages order_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: order_revisions order_revisions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_revisions
    ADD CONSTRAINT order_revisions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_revisions order_revisions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_revisions
    ADD CONSTRAINT order_revisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: orders orders_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.profiles(id);


--
-- Name: project_inquiries project_inquiries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_inquiries
    ADD CONSTRAINT project_inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: projects projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: saved_prompts saved_prompts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_prompts
    ADD CONSTRAINT saved_prompts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.profiles(id);


--
-- Name: team_members team_members_member_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_member_profile_id_fkey FOREIGN KEY (member_profile_id) REFERENCES public.profiles(id);


--
-- Name: team_task_notes team_task_notes_author_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_notes
    ADD CONSTRAINT team_task_notes_author_profile_id_fkey FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: team_task_notes team_task_notes_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_notes
    ADD CONSTRAINT team_task_notes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.agent_tasks(id) ON DELETE CASCADE;


--
-- Name: team_task_notes team_task_notes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_notes
    ADD CONSTRAINT team_task_notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: template_downloads template_downloads_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_downloads
    ADD CONSTRAINT template_downloads_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: template_downloads template_downloads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_downloads
    ADD CONSTRAINT template_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: value_snapshots value_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_snapshots
    ADD CONSTRAINT value_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: white_label_tools white_label_tools_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.white_label_tools
    ADD CONSTRAINT white_label_tools_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: zernio_api_usage zernio_api_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zernio_api_usage
    ADD CONSTRAINT zernio_api_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: team_members Account members can read team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Account members can read team" ON public.team_members FOR SELECT TO authenticated USING (((account_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)) OR (member_profile_id = public.current_profile_id())));


--
-- Name: notifications Admins can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create notifications" ON public.notifications FOR INSERT WITH CHECK ((public.is_admin() OR (auth.uid() = user_id)));


--
-- Name: projects Admins can create projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create projects" ON public.projects FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.is_admin());


--
-- Name: add_ons Admins manage all add-ons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all add-ons" ON public.add_ons USING (public.is_admin());


--
-- Name: orders Admins manage all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all orders" ON public.orders USING (public.is_admin());


--
-- Name: projects Admins manage all projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all projects" ON public.projects USING (public.is_admin());


--
-- Name: support_tickets Admins manage all tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all tickets" ON public.support_tickets USING (public.is_admin());


--
-- Name: deliverables Admins manage deliverables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage deliverables" ON public.deliverables USING (public.is_admin());


--
-- Name: milestones Admins manage milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage milestones" ON public.milestones USING (public.is_admin());


--
-- Name: prompt_library Admins manage prompt library; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage prompt library" ON public.prompt_library USING (public.is_admin());


--
-- Name: templates Admins manage templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage templates" ON public.templates USING (public.is_admin());


--
-- Name: order_deliverables Admins upload deliverables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins upload deliverables" ON public.order_deliverables FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: prompt_library Anyone can read active prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active prompts" ON public.prompt_library FOR SELECT USING ((is_active = true));


--
-- Name: templates Anyone can read active templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active templates" ON public.templates FOR SELECT USING ((is_active = true));


--
-- Name: conversations Block public access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block public access" ON public.conversations TO anon USING (false);


--
-- Name: prompts Block public access to prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block public access to prompts" ON public.prompts TO anon USING (false);


--
-- Name: orders Clients can create orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can create orders" ON public.orders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: support_tickets Clients can create tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can create tickets" ON public.support_tickets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: template_downloads Clients can download; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can download" ON public.template_downloads FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: add_ons Clients can insert own add-ons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can insert own add-ons" ON public.add_ons FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_tool_usage Clients can log usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can log usage" ON public.ai_tool_usage FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: automation_triggers Clients manage own automations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients manage own automations" ON public.automation_triggers USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: integrations Clients manage own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients manage own integrations" ON public.integrations USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: saved_prompts Clients manage own saved prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients manage own saved prompts" ON public.saved_prompts USING ((auth.uid() = user_id));


--
-- Name: white_label_tools Clients manage own white-label tools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients manage own white-label tools" ON public.white_label_tools USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: add_ons Clients see own add-ons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own add-ons" ON public.add_ons FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: automation_logs Clients see own automation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own automation logs" ON public.automation_logs FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: deliverables Clients see own deliverables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own deliverables" ON public.deliverables FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = deliverables.project_id) AND ((projects.user_id = auth.uid()) OR public.is_admin())))));


--
-- Name: template_downloads Clients see own downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own downloads" ON public.template_downloads FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: milestones Clients see own milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own milestones" ON public.milestones FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = milestones.project_id) AND ((projects.user_id = auth.uid()) OR public.is_admin())))));


--
-- Name: orders Clients see own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own orders" ON public.orders FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: projects Clients see own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own projects" ON public.projects FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: value_snapshots Clients see own snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own snapshots" ON public.value_snapshots FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: support_tickets Clients see own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own tickets" ON public.support_tickets FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: ai_tool_usage Clients see own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients see own usage" ON public.ai_tool_usage FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: admin_email_log No direct client access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client access" ON public.admin_email_log TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: agent_skills No direct client access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client access" ON public.agent_skills TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: client_activity_log No direct client access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client access" ON public.client_activity_log TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: oauth_states No direct client access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client access" ON public.oauth_states TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: platform_settings No direct client access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client access" ON public.platform_settings TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: services No direct client access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client access" ON public.services TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: zernio_api_usage No direct client access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client access" ON public.zernio_api_usage TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: foundation_changelog No direct client delete on foundation_changelog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client delete on foundation_changelog" ON public.foundation_changelog FOR DELETE TO authenticated USING (false);


--
-- Name: foundation_layers No direct client delete on foundation_layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client delete on foundation_layers" ON public.foundation_layers FOR DELETE TO authenticated USING (false);


--
-- Name: foundation_proposals No direct client delete on foundation_proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client delete on foundation_proposals" ON public.foundation_proposals FOR DELETE TO authenticated USING (false);


--
-- Name: notifications No direct client delete on notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client delete on notifications" ON public.notifications FOR DELETE TO authenticated USING (false);


--
-- Name: foundation_changelog No direct client insert on foundation_changelog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client insert on foundation_changelog" ON public.foundation_changelog FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: foundation_layers No direct client insert on foundation_layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client insert on foundation_layers" ON public.foundation_layers FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: foundation_proposals No direct client insert on foundation_proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client insert on foundation_proposals" ON public.foundation_proposals FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: notifications No direct client insert on notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client insert on notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: foundation_changelog No direct client update on foundation_changelog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client update on foundation_changelog" ON public.foundation_changelog FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: foundation_layers No direct client update on foundation_layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client update on foundation_layers" ON public.foundation_layers FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: foundation_proposals No direct client update on foundation_proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct client update on foundation_proposals" ON public.foundation_proposals FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: admin_notes Only admins see admin notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins see admin notes" ON public.admin_notes USING (public.is_admin());


--
-- Name: order_messages Order participants can see messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order participants can see messages" ON public.order_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_messages.order_id) AND ((orders.user_id = auth.uid()) OR public.is_admin())))));


--
-- Name: order_messages Order participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order participants can send messages" ON public.order_messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: order_deliverables Order participants see deliverables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order participants see deliverables" ON public.order_deliverables FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_deliverables.order_id) AND ((orders.user_id = auth.uid()) OR public.is_admin())))));


--
-- Name: notifications Recipients read own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipients read own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = public.current_profile_id()));


--
-- Name: notifications Recipients update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipients update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = public.current_profile_id())) WITH CHECK ((user_id = public.current_profile_id()));


--
-- Name: conversations Service role can insert conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert conversations" ON public.conversations FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: prompts Service role can insert prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert prompts" ON public.prompts FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: prompts Service role can read prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read prompts" ON public.prompts FOR SELECT TO service_role USING (true);


--
-- Name: conversations Service role can select conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can select conversations" ON public.conversations FOR SELECT TO service_role USING (true);


--
-- Name: conversations Service role can update conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update conversations" ON public.conversations FOR UPDATE TO service_role USING (true);


--
-- Name: prompts Service role can update prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update prompts" ON public.prompts FOR UPDATE TO service_role USING (true);


--
-- Name: automation_logs System can insert automation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert automation logs" ON public.automation_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: value_snapshots System can insert value snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert value snapshots" ON public.value_snapshots FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_constraints Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.agent_constraints FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_outputs Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.agent_outputs FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_schedules Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.agent_schedules FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_tasks Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.agent_tasks FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_answers Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.brand_answers FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_document_versions Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.brand_document_versions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.brand_documents d
  WHERE ((d.id = brand_document_versions.document_id) AND (d.user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))))));


--
-- Name: brand_documents Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.brand_documents FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_assets Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.brand_kit_assets FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_colors Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.brand_kit_colors FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_fonts Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.brand_kit_fonts FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_sections Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.brand_kit_sections FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: campaigns Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.campaigns FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_asset_folders Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.creative_asset_folders FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_assets Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.creative_assets FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_balances Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.credit_balances FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_ledger Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.credit_ledger FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_topups Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.credit_topups FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: daily_digests Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.daily_digests FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_documents Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.foundation_documents FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_field_scores Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.foundation_field_scores FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_knowledge Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.foundation_knowledge FOR DELETE TO authenticated USING ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: maya_sessions Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.maya_sessions FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: orchestration_sessions Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.orchestration_sessions FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: project_inquiries Tenant delete own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant delete own account" ON public.project_inquiries FOR DELETE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_constraints Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.agent_constraints FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_outputs Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.agent_outputs FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_schedules Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.agent_schedules FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_tasks Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.agent_tasks FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_answers Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.brand_answers FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_document_versions Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.brand_document_versions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.brand_documents d
  WHERE ((d.id = brand_document_versions.document_id) AND (d.user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))))));


--
-- Name: brand_documents Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.brand_documents FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_assets Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.brand_kit_assets FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_colors Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.brand_kit_colors FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_fonts Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.brand_kit_fonts FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_sections Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.brand_kit_sections FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: campaigns Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.campaigns FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_asset_folders Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.creative_asset_folders FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_assets Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.creative_assets FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_balances Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.credit_balances FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_ledger Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.credit_ledger FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_topups Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.credit_topups FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: daily_digests Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.daily_digests FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_documents Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.foundation_documents FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_field_scores Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.foundation_field_scores FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_knowledge Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.foundation_knowledge FOR INSERT TO authenticated WITH CHECK ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: maya_sessions Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.maya_sessions FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: orchestration_sessions Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.orchestration_sessions FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: order_revisions Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.order_revisions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_revisions.order_id) AND (o.user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))))));


--
-- Name: project_inquiries Tenant insert own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant insert own account" ON public.project_inquiries FOR INSERT TO authenticated WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_constraints Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.agent_constraints FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_outputs Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.agent_outputs FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_schedules Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.agent_schedules FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_tasks Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.agent_tasks FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_answers Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.brand_answers FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_document_versions Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.brand_document_versions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.brand_documents d
  WHERE ((d.id = brand_document_versions.document_id) AND (d.user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))))));


--
-- Name: brand_documents Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.brand_documents FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_assets Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.brand_kit_assets FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_colors Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.brand_kit_colors FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_fonts Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.brand_kit_fonts FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_sections Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.brand_kit_sections FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: campaigns Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.campaigns FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_asset_folders Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.creative_asset_folders FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_assets Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.creative_assets FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_balances Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.credit_balances FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_ledger Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.credit_ledger FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_topups Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.credit_topups FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: daily_digests Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.daily_digests FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_changelog Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.foundation_changelog FOR SELECT TO authenticated USING ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_documents Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.foundation_documents FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_field_scores Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.foundation_field_scores FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_knowledge Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.foundation_knowledge FOR SELECT TO authenticated USING ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_layers Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.foundation_layers FOR SELECT TO authenticated USING ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_proposals Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.foundation_proposals FOR SELECT TO authenticated USING ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: maya_sessions Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.maya_sessions FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: orchestration_sessions Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.orchestration_sessions FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: order_revisions Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.order_revisions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_revisions.order_id) AND (o.user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))))));


--
-- Name: project_inquiries Tenant select own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant select own account" ON public.project_inquiries FOR SELECT TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_constraints Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.agent_constraints FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_outputs Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.agent_outputs FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_schedules Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.agent_schedules FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: agent_tasks Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.agent_tasks FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_answers Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.brand_answers FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_documents Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.brand_documents FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_assets Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.brand_kit_assets FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_colors Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.brand_kit_colors FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_fonts Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.brand_kit_fonts FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: brand_kit_sections Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.brand_kit_sections FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: campaigns Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.campaigns FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_asset_folders Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.creative_asset_folders FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: creative_assets Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.creative_assets FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_balances Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.credit_balances FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_ledger Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.credit_ledger FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: credit_topups Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.credit_topups FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: daily_digests Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.daily_digests FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_documents Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.foundation_documents FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_field_scores Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.foundation_field_scores FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: foundation_knowledge Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.foundation_knowledge FOR UPDATE TO authenticated USING ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((profile_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: maya_sessions Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.maya_sessions FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: orchestration_sessions Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.orchestration_sessions FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: project_inquiries Tenant update own account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant update own account" ON public.project_inquiries FOR UPDATE TO authenticated USING ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids))) WITH CHECK ((user_id IN ( SELECT public.accessible_profile_ids() AS accessible_profile_ids)));


--
-- Name: support_messages Ticket participants can message; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ticket participants can message" ON public.support_messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: support_messages Ticket participants see messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ticket participants see messages" ON public.support_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.support_tickets
  WHERE ((support_tickets.id = support_messages.ticket_id) AND ((support_tickets.user_id = auth.uid()) OR public.is_admin())))));


--
-- Name: notifications Users can mark notifications read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark notifications read" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: analytics_briefings Users can read own briefings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own briefings" ON public.analytics_briefings FOR SELECT USING ((profile_id IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.clerk_user_id = (auth.jwt() ->> 'sub'::text)))));


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (((auth.uid() = id) OR public.is_admin()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: notifications Users see own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: add_ons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_email_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_email_log ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_constraints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_constraints ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_outputs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_tool_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_tool_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_briefings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_briefings ENABLE ROW LEVEL SECURITY;

--
-- Name: anon_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anon_events ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_task_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_task_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_triggers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_triggers ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_document_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_kit_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_kit_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_kit_colors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_kit_colors ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_kit_fonts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_kit_fonts ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_kit_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_kit_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: client_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: creative_asset_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creative_asset_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: creative_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_topups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_topups ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_digests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;

--
-- Name: deliverables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

--
-- Name: foundation_changelog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foundation_changelog ENABLE ROW LEVEL SECURITY;

--
-- Name: foundation_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foundation_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: foundation_field_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foundation_field_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: foundation_knowledge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foundation_knowledge ENABLE ROW LEVEL SECURITY;

--
-- Name: foundation_layers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foundation_layers ENABLE ROW LEVEL SECURITY;

--
-- Name: foundation_proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foundation_proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_chat_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_chat_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: maya_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maya_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

--
-- Name: orchestration_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orchestration_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: order_deliverables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_deliverables ENABLE ROW LEVEL SECURITY;

--
-- Name: order_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: order_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: prompt_library; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;

--
-- Name: prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: support_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: team_task_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_task_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: template_downloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_downloads ENABLE ROW LEVEL SECURITY;

--
-- Name: templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

--
-- Name: value_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.value_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: white_label_tools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.white_label_tools ENABLE ROW LEVEL SECURITY;

--
-- Name: zernio_api_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zernio_api_usage ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict Ulf3BFgjSt5Y01IPucn94svV7iRPJ0KLyBfXppXAFDo2lxz3EOD8Lqfe89GzDU0

