-- Add welcome_email_sent flag to user_usage
ALTER TABLE user_usage
  ADD COLUMN IF NOT EXISTS welcome_email_sent boolean DEFAULT false;
