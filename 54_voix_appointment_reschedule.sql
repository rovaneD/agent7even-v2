-- Decline with other times: the team offers alternatives, Voix calls the client to pick one.
ALTER TABLE public.voix_appointments
  ADD COLUMN IF NOT EXISTS alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reschedule_status text NOT NULL DEFAULT 'none'
    CHECK (reschedule_status IN ('none', 'offered', 'rescheduled', 'callback_needed')),
  ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES public.voix_appointments (id) ON DELETE SET NULL;
