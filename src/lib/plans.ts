/**
 * Single source of truth for plan definitions. Every other module that needs
 * a plan name, a generations limit, or a school/pro-plus check should derive
 * it from PLANS rather than redefining its own copy — plan limits were
 * previously duplicated across 8+ files (including a SQL migration default
 * that drifted to 3 while every TS copy said 15). See
 * supabase/migrations/20260728120000_usage_gate_functions.sql for the
 * matching SQL-side source of truth (plan_generations_limit()), which a
 * vitest spec cross-checks against this file.
 *
 * `sourceContent`/`afl`/`teachingStrategy`/`questionPaper`/
 * `differentiatedWorksheets`/`allowedSections` are a separate, newer
 * entitlement axis from `proPlusFeatures` (which is Pro Plus's own extra
 * perks — analytics, early access). These five gates are "Free vs everyone
 * else": true for pro and every tier above it, false only for free. Both
 * frontend (disabled controls/locked panels) and backend (API route
 * rejection) read from these same fields — never redefine the free/paid
 * split locally in a component or route.
 */

import type { TeacherPackageSectionKey } from "./lesson-plan";

export type PlanId =
  | "free"
  | "pro"
  | "pro_plus"
  | "school_starter"
  | "school_pro"
  | "school_enterprise";

export type PlanDefinition = {
  id: PlanId;
  /** Human label used in super-admin UIs and approval emails. */
  adminLabel: string;
  /** null = unlimited. Stored in the DB as -1. */
  generationsLimit: number | null;
  unlimited: boolean;
  isSchool: boolean;
  /** Full product tier (Pro Plus feature set). */
  proPlusFeatures: boolean;
  /** URL slug used by /pricing, e.g. getPlanPriceKey("pro-plus"). null for free. */
  slug: string | null;
  /** Key into PRICING_REGIONS[x].prices. null for free. */
  priceKey: "pro" | "proPlus" | "schoolStarter" | "schoolPro" | "schoolEnterprise" | null;
  /** Can upload a PDF/pasted source document for generation to use. */
  sourceContent: boolean;
  /** Can select Assessment for Learning activities. */
  afl: boolean;
  /** Can select a Teaching & Learning Strategy. */
  teachingStrategy: boolean;
  /** Can use the Question Paper generator at all. */
  questionPaper: boolean;
  /** Can use the Differentiated Worksheets generator at all. */
  differentiatedWorksheets: boolean;
  /** Which of the 7 teacher-package items this plan may generate. */
  allowedSections: readonly TeacherPackageSectionKey[];
};

const ALL_SECTIONS: readonly TeacherPackageSectionKey[] = [
  "Full Lesson Plan",
  "PPT Slide Content",
  "Worksheet",
  "Assessment Questions",
  "Homework Task",
  "Teacher Notes",
  "AFL Activity Sheets",
];

const FREE_SECTIONS: readonly TeacherPackageSectionKey[] = ["Full Lesson Plan", "PPT Slide Content"];

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    adminLabel: "Free",
    generationsLimit: 3,
    unlimited: false,
    isSchool: false,
    proPlusFeatures: false,
    slug: null,
    priceKey: null,
    sourceContent: false,
    afl: false,
    teachingStrategy: false,
    questionPaper: false,
    differentiatedWorksheets: false,
    allowedSections: FREE_SECTIONS,
  },
  pro: {
    id: "pro",
    adminLabel: "Pro",
    generationsLimit: 30,
    unlimited: false,
    isSchool: false,
    proPlusFeatures: false,
    slug: "pro",
    priceKey: "pro",
    sourceContent: true,
    afl: true,
    teachingStrategy: true,
    questionPaper: true,
    differentiatedWorksheets: true,
    allowedSections: ALL_SECTIONS,
  },
  pro_plus: {
    id: "pro_plus",
    adminLabel: "Pro Plus",
    generationsLimit: 60,
    unlimited: false,
    isSchool: false,
    proPlusFeatures: true,
    slug: "pro-plus",
    priceKey: "proPlus",
    sourceContent: true,
    afl: true,
    teachingStrategy: true,
    questionPaper: true,
    differentiatedWorksheets: true,
    allowedSections: ALL_SECTIONS,
  },
  school_starter: {
    id: "school_starter",
    adminLabel: "School Starter",
    generationsLimit: null,
    unlimited: true,
    isSchool: true,
    proPlusFeatures: true,
    slug: "school-starter",
    priceKey: "schoolStarter",
    sourceContent: true,
    afl: true,
    teachingStrategy: true,
    questionPaper: true,
    differentiatedWorksheets: true,
    allowedSections: ALL_SECTIONS,
  },
  school_pro: {
    id: "school_pro",
    adminLabel: "School Pro",
    generationsLimit: null,
    unlimited: true,
    isSchool: true,
    proPlusFeatures: true,
    slug: "school-pro",
    priceKey: "schoolPro",
    sourceContent: true,
    afl: true,
    teachingStrategy: true,
    questionPaper: true,
    differentiatedWorksheets: true,
    allowedSections: ALL_SECTIONS,
  },
  school_enterprise: {
    id: "school_enterprise",
    adminLabel: "School Enterprise",
    generationsLimit: null,
    unlimited: true,
    isSchool: true,
    proPlusFeatures: true,
    slug: "school-enterprise",
    priceKey: "schoolEnterprise",
    sourceContent: true,
    afl: true,
    teachingStrategy: true,
    questionPaper: true,
    differentiatedWorksheets: true,
    allowedSections: ALL_SECTIONS,
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const SCHOOL_PLAN_IDS: PlanId[] = PLAN_IDS.filter((id) => PLANS[id].isSchool);

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

/** True only for the free plan — the one tier every new feature gate excludes. */
export function isFreePlan(id: PlanId): boolean {
  return id === "free";
}

/** The value stored in user_usage.generations_limit. -1 == unlimited. */
export function dbLimitValue(id: PlanId): number {
  return PLANS[id].generationsLimit ?? -1;
}

/** Reverse lookup for admin UIs that only have the display label (e.g. school-registration "plan_selected"). */
export function planIdByAdminLabel(label: string): PlanId | null {
  const found = PLAN_IDS.find((id) => PLANS[id].adminLabel === label);
  return found ?? null;
}

/** Error code returned by generation routes when a Free caller requests a Pro-only feature. */
export const FEATURE_LOCKED_ERROR_CODE = "FEATURE_REQUIRES_PRO";
