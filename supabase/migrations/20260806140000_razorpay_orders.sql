-- Internal payment ledger for Razorpay checkout (Pro / Pro Plus self-serve upgrade).
-- Written to and read from exclusively by the service-role client (create-order / verify-payment
-- API routes) -- never queried directly by the browser, so no authenticated/anon grants are added.
CREATE TABLE IF NOT EXISTS razorpay_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text,
  plan_type text NOT NULL,
  billing_period text NOT NULL,
  amount_paise integer NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS razorpay_orders_user_id_idx ON razorpay_orders(user_id);

ALTER TABLE razorpay_orders ENABLE ROW LEVEL SECURITY;
