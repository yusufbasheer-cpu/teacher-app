-- Razorpay Subscriptions tracking (Pro Monthly auto-pay). Same convention as razorpay_orders:
-- written to and read from exclusively by the service-role client (create-subscription,
-- verify-subscription, webhook, cancel-subscription, and the GET status route all use the
-- service role) -- never queried directly by the browser, so no authenticated/anon grants.
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  razorpay_subscription_id text NOT NULL UNIQUE,
  razorpay_plan_id text NOT NULL,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'active', 'pending', 'halted', 'cancelled')),
  cancel_at_cycle_end boolean NOT NULL DEFAULT false,
  current_period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
