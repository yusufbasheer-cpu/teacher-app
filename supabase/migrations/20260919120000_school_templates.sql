CREATE TABLE IF NOT EXISTS public.school_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  thumbnail_base64 text,
  primary_color text NOT NULL DEFAULT '1B3A6B',
  accent_color text NOT NULL DEFAULT 'F5A623',
  background_color text NOT NULL DEFAULT 'FFFFFF',
  dark_color text NOT NULL DEFAULT '0A1628',
  font_heading text NOT NULL DEFAULT 'Calibri',
  font_body text NOT NULL DEFAULT 'Calibri',
  logo_base64 text,
  file_data text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.school_templates ADD COLUMN IF NOT EXISTS logo_base64 text;
ALTER TABLE public.school_templates ADD COLUMN IF NOT EXISTS file_data text;
ALTER TABLE public.school_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own template" ON public.school_templates;
CREATE POLICY "Users manage own template" ON public.school_templates
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_templates TO authenticated;
