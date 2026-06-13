-- Add role and department columns to school_teachers
ALTER TABLE school_teachers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'teacher'
    CONSTRAINT school_teachers_role_check CHECK (role IN ('teacher', 'hod', 'admin'));

ALTER TABLE school_teachers
  ADD COLUMN IF NOT EXISTS department text;

-- Allow school admin to update role/department for teachers in their school
CREATE POLICY "school_admin_update_teacher_role" ON school_teachers
  FOR UPDATE
  USING (
    school_account_id IN (
      SELECT id FROM school_accounts
      WHERE admin_email ILIKE (auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    school_account_id IN (
      SELECT id FROM school_accounts
      WHERE admin_email ILIKE (auth.jwt() ->> 'email')
    )
  );
