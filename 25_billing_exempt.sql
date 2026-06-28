-- Complimentary access: admin-granted full platform access without Stripe checkout.
-- When billing_exempt = true, profiles.plan holds the effective tier (starter/growth/proagent).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.billing_exempt IS
  'When true, account has complimentary access at profiles.plan tier — no Stripe subscription required.';
