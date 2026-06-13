-- Ensure waitlist table exists with plan_interested column
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  plan_interested text,
  created_at timestamp DEFAULT now()
);

-- Add plan_interested column if upgrading from the previous version
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS plan_interested text;

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_insert" ON waitlist;
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT WITH CHECK (true);
