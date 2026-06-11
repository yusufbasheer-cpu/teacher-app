CREATE TABLE IF NOT EXISTS waitlist (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text NOT NULL,
  created_at timestamp DEFAULT now()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can join the waitlist (no auth required)
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT WITH CHECK (true);
