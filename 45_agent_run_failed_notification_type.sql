-- 45_agent_run_failed_notification_type.sql
-- Add 'agent_run_failed' to the notifications type CHECK so scheduled agent
-- failures can notify the user instead of failing silently forever.
-- Run once in Supabase SQL Editor. Safe to re-run.

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
    'task_note_mention',
    'approval_note',
    'approval_note_mention',
    'agent_run_failed'
  ));
