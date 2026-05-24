import type { PlanType } from "@/lib/user-usage";

export type SchoolPlanType = Extract<
  PlanType,
  "school_starter" | "school_pro" | "school_enterprise"
>;

export type SchoolAccountRow = {
  id: string;
  school_name: string;
  email_domain: string;
  plan_type: SchoolPlanType;
  max_teachers: number;
  active_teachers: number;
  admin_email: string;
  created_at: string;
};

export type SchoolTeacherRow = {
  id: string;
  school_account_id: string;
  user_id: string;
  email: string;
  joined_at: string;
};

export const SCHOOL_MAX_TEACHERS_MESSAGE =
  "Your school has reached the maximum number of teachers. Please contact your school administrator.";

export const SCHOOL_WELCOME_MESSAGE =
  "Welcome! You have been added to your school account.";

export const SCHOOL_WELCOME_SESSION_KEY = "layah_school_welcome";

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1);
  return domain.length > 0 ? domain : null;
}

export function normalizeEmailDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, "");
}

export function isSchoolPlanType(value: string): value is SchoolPlanType {
  return value === "school_starter" || value === "school_pro" || value === "school_enterprise";
}

export function schoolPlanGenerationsLimit(plan: SchoolPlanType): number {
  return -1;
}
