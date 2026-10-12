-- Orders can now be charged in the buyer's local currency, not just INR.
-- amount_paise is kept as the column name for backwards compatibility but holds the amount in the
-- minor unit of `currency` (paise for INR, cents for USD, ...). Existing rows were all INR.
ALTER TABLE razorpay_orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';
