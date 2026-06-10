CREATE TABLE IF NOT EXISTS feedback (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text,
  email      text,
  role       text,
  rating     integer,
  message    text,
  created_at timestamp DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public feedback form — no auth required)
CREATE POLICY "feedback_insert" ON feedback FOR INSERT WITH CHECK (true);
