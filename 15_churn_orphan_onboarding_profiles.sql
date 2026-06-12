-- Optional cleanup: onboarding/test profiles with no Stripe customer and no plan.
-- Review rows before running in Supabase SQL editor.
-- Does NOT touch Stripe — archive or delete test customers separately in Stripe Dashboard.

UPDATE public.profiles
SET
  status = 'churned',
  plan = NULL,
  updated_at = now()
WHERE role = 'client'
  AND status = 'onboarding'
  AND plan = NULL
  AND stripe_customer_id IS NULL
  AND stripe_subscription_id IS NULL;
