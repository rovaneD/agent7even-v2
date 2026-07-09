-- 42_team_task_notes.sql
-- Phase 5: threaded notes on team assignments (agent_tasks).
-- Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.team_task_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           uuid NOT NULL REFERENCES public.agent_tasks (id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  author_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body              text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_task_notes_task_created_idx
  ON public.team_task_notes (task_id, created_at ASC);

CREATE INDEX IF NOT EXISTS team_task_notes_workspace_idx
  ON public.team_task_notes (workspace_id, created_at DESC);

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'order_status',
    'order_delivered',
    'support_reply',
    'support_closed',
    'deliverable_uploaded',
    'brand_kit_generated',
    'plan_activated',
    'trial_ending',
    'credit_topup',
    'approval_pending',
    'payment_failed',
    'subscription_canceled',
    'team_member_joined',
    'maya_nudge',
    'foundation_milestone',
    'assignment_created',
    'assignment_submitted',
    'task_note',
    'task_note_mention'
  ));
