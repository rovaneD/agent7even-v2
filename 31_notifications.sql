-- 31_notifications.sql
-- In-app notification feed (bell, /dashboard/notifications, email_sent tracking).
-- Table already exists in production — this file documents schema + RLS for new envs.
-- Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  type        text NOT NULL,
  link        text,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sender_id   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  email_sent  boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id)
  WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Recipients update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "No direct client insert on notifications" ON public.notifications;
DROP POLICY IF EXISTS "No direct client delete on notifications" ON public.notifications;

-- Bell + notifications page: authenticated client reads own rows (Clerk JWT → current_profile_id).
CREATE POLICY "Recipients read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());

-- Mark-read API can also be called from client realtime flows.
CREATE POLICY "Recipients update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- Inserts/deletes stay on service_role API routes (webhooks, agents, admin).
CREATE POLICY "No direct client insert on notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct client delete on notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (false);
