-- Add learning_objectives column to saved_lessons if it doesn't already exist.
-- This column was missing from the original table creation.
ALTER TABLE saved_lessons
  ADD COLUMN IF NOT EXISTS learning_objectives text NOT NULL DEFAULT '';
