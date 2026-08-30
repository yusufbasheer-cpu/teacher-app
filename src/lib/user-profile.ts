import type { User } from "@supabase/supabase-js";

export type TeacherProfileMetadata = {
  full_name?: string | null;
  phone?: string | null;
  subjects?: string | null;
  designation?: string | null;
  grades_teach?: string | null;
  school_name?: string | null;
  city?: string | null;
  experience_years?: string | null;
  about_you?: string | null;
  profile_completed?: boolean | string | number | null;
  onboarding_completed_at?: string | null;
};

function getMetadata(user: User | null | undefined): TeacherProfileMetadata {
  const metadata = user?.user_metadata;
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as TeacherProfileMetadata;
}

function isTruthy(value: TeacherProfileMetadata["profile_completed"]): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function hasCompletedTeacherProfile(user: User | null | undefined): boolean {
  return isTruthy(getMetadata(user).profile_completed);
}

export function getTeacherProfile(user: User | null | undefined): TeacherProfileMetadata {
  return getMetadata(user);
}

export function getTeacherDisplayName(user: User | null | undefined): string {
  const fullName = getMetadata(user).full_name?.trim();
  if (fullName) return fullName;
  return user?.email ?? "Teacher";
}

export function getTeacherPhone(user: User | null | undefined): string | null {
  const phone = getMetadata(user).phone?.trim();
  return phone || null;
}
