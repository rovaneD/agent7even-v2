-- Voix appointments: Voix proposes a time inside the spa's booking windows,
-- the team confirms in the dashboard, and Voix calls the client back.
ALTER TABLE public.voix_accounts
  ADD COLUMN IF NOT EXISTS booking_windows jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 10 AND 240);

CREATE TABLE IF NOT EXISTS public.voix_appointments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           uuid NOT NULL REFERENCES public.voix_accounts (id) ON DELETE CASCADE,
  retell_call_id       text,
  caller_name          text,
  caller_phone         text,
  service              text,
  notes                text,
  start_at             timestamptz NOT NULL,
  duration_min         integer NOT NULL DEFAULT 30,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  decided_at           timestamptz,
  decided_by_member_id uuid REFERENCES public.voix_members (id) ON DELETE SET NULL,
  decided_by_label     text,
  callback_status      text NOT NULL DEFAULT 'none' CHECK (callback_status IN ('none', 'placed', 'failed', 'skipped')),
  callback_call_id     text,
  callback_error       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voix_appointments_account_start_idx
  ON public.voix_appointments (account_id, start_at);

ALTER TABLE public.voix_appointments ENABLE ROW LEVEL SECURITY;

-- Demo spa: consult windows Tue–Sat 10:00–17:00 local, 30-minute slots, demo line as caller ID.
UPDATE public.voix_accounts
   SET booking_windows = '{"2":[["10:00","17:00"]],"3":[["10:00","17:00"]],"4":[["10:00","17:00"]],"5":[["10:00","17:00"]],"6":[["10:00","16:00"]]}'::jsonb,
       phone_number = COALESCE(phone_number, '+12533229496')
 WHERE id = '9d4b1580-adec-40d4-a749-1c3268b124b4';
