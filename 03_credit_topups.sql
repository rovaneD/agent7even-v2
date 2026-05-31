-- Credit top-up purchases table
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS credit_topups (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_session_id  text NOT NULL,
  stripe_payment_id  text,
  credits            integer NOT NULL,
  amount_usd         numeric(10, 2) NOT NULL,
  status             text DEFAULT 'pending', -- pending | completed | refunded
  created_at         timestamptz DEFAULT now(),
  completed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_credit_topups_user    ON credit_topups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_topups_session ON credit_topups(stripe_session_id);
