-- 46_voix_core.sql
-- Voix (AI receptionist) core: spa accounts, staff members, calls from Retell,
-- follow-ups and follow-up activity. Server code uses the service role only,
-- so RLS is enabled with no policies (no anon/authenticated access).
-- Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.voix_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL CHECK (char_length(trim(name)) > 0),
  timezone         text NOT NULL DEFAULT 'America/Los_Angeles',
  retell_agent_ids text[] NOT NULL DEFAULT '{}',
  phone_number     text,
  transfer_number  text,
  alert_emails     text[] NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'pilot' CHECK (status IN ('pilot', 'active', 'paused')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voix_accounts_agent_ids_idx
  ON public.voix_accounts USING gin (retell_agent_ids);

CREATE TABLE IF NOT EXISTS public.voix_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES public.voix_accounts (id) ON DELETE CASCADE,
  email         text NOT NULL CHECK (email = lower(trim(email)) AND position('@' in email) > 1),
  full_name     text,
  clerk_user_id text,
  role          text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  invited_at    timestamptz NOT NULL DEFAULT now(),
  joined_at     timestamptz,
  UNIQUE (account_id, email)
);

CREATE INDEX IF NOT EXISTS voix_members_email_idx ON public.voix_members (email);
CREATE INDEX IF NOT EXISTS voix_members_clerk_idx ON public.voix_members (clerk_user_id);

CREATE TABLE IF NOT EXISTS public.voix_calls (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           uuid NOT NULL REFERENCES public.voix_accounts (id) ON DELETE CASCADE,
  retell_call_id       text NOT NULL UNIQUE,
  agent_id             text,
  direction            text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound', 'web')),
  status               text NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'ended', 'analyzed')),
  from_number          text,
  to_number            text,
  caller_name          text,
  started_at           timestamptz,
  ended_at             timestamptz,
  duration_sec         integer,
  disconnection_reason text,
  recording_url        text,
  transcript           text,
  transcript_object    jsonb,
  summary              text,
  outcome              text CHECK (outcome IN (
                         'booked', 'rescheduled', 'cancelled', 'question_answered',
                         'callback_needed', 'clinical', 'complaint', 'spam', 'hang_up', 'other'
                       )),
  sentiment            text,
  urgent               boolean NOT NULL DEFAULT false,
  treatment_interest   text,
  analysis             jsonb,
  is_sample            boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voix_calls_account_started_idx
  ON public.voix_calls (account_id, started_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS voix_calls_account_from_idx
  ON public.voix_calls (account_id, from_number);

CREATE TABLE IF NOT EXISTS public.voix_followups (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL REFERENCES public.voix_accounts (id) ON DELETE CASCADE,
  call_id            uuid NOT NULL UNIQUE REFERENCES public.voix_calls (id) ON DELETE CASCADE,
  reason             text NOT NULL CHECK (reason IN ('callback_needed', 'clinical', 'complaint', 'booking_failed', 'urgent', 'other')),
  priority           text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'done')),
  assigned_member_id uuid REFERENCES public.voix_members (id) ON DELETE SET NULL,
  snoozed_until      timestamptz,
  done_reason        text CHECK (done_reason IN ('booked', 'resolved', 'no_answer', 'not_interested', 'spam', 'other')),
  done_at            timestamptz,
  done_by_member_id  uuid REFERENCES public.voix_members (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voix_followups_account_status_idx
  ON public.voix_followups (account_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.voix_followup_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id uuid NOT NULL REFERENCES public.voix_followups (id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES public.voix_accounts (id) ON DELETE CASCADE,
  member_id   uuid REFERENCES public.voix_members (id) ON DELETE SET NULL,
  actor_label text,
  type        text NOT NULL CHECK (type IN ('created', 'note', 'called', 'assigned', 'snoozed', 'reopened', 'done')),
  body        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voix_followup_events_followup_idx
  ON public.voix_followup_events (followup_id, created_at ASC);

ALTER TABLE public.voix_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voix_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voix_calls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voix_followups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voix_followup_events ENABLE ROW LEVEL SECURITY;
