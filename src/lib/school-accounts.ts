import type { PlanType } from "@/lib/user-usage";
import { PLANS } from "@/lib/plans";

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
  status: "active" | "inactive";
};

export type SchoolTeacherRow = {
  id: string;
  /** References school_accounts.id */
  school_id: string;
  user_id: string;
  email: string;
  joined_at: string;
  generations_used_this_month: number;
  role: "teacher" | "hod" | "admin";
  department: string | null;
};

export const SCHOOL_WELCOME_SESSION_KEY = "layah_school_welcome";

export function buildSchoolMaxTeachersMessage(adminEmail: string): string {
  return `Your school has reached the maximum number of teacher accounts. Please contact your school administrator at ${adminEmail}`;
}

export function buildSchoolDeactivatedMessage(adminEmail: string): string {
  return `Your school's Layah account is currently inactive. Please contact your school administrator at ${adminEmail}, or reach out to info@layah.in.`;
}

export function buildSchoolWelcomeMessage(schoolName: string): string {
  return `Welcome! You have been added to ${schoolName} account`;
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "me.com",
  "protonmail.com",
]);

export function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(normalizeEmailDomain(domain));
}

const ADMIN_EMAILS = new Set(["yusuf.basheer@gmail.com"]);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return normalizeEmailDomain(parts[1]);
}

export function normalizeEmailDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, "");
}

export function isSchoolPlanType(value: string): value is SchoolPlanType {
  return value === "school_starter" || value === "school_pro" || value === "school_enterprise";
}

/** Unlimited generations for all school plans. */
export function schoolPlanGenerationsLimit(plan: SchoolPlanType): number {
  return PLANS[plan].generationsLimit ?? -1;
}

/** School teachers receive the same product access as Pro Plus subscribers. */
export function schoolPlanHasProPlusFeatures(plan: SchoolPlanType): boolean {
  return PLANS[plan].proPlusFeatures;
}
