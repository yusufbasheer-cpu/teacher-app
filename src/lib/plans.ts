/**
 * Single source of truth for plan definitions. Every other module that needs
 * a plan name, a generations limit, or a school/pro-plus check should derive
 * it from PLANS rather than redefining its own copy — plan limits were
 * previously duplicated across 8+ files (including a SQL migration default
 * that drifted to 3 while every TS copy said 15). See
 * supabase/migrations/20260728120000_usage_gate_functions.sql for the
 * matching SQL-side source of truth (plan_generations_limit()), which a
 * vitest spec cross-checks against this file.
 */

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
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    adminLabel: "Free",
    generationsLimit: 15,
    unlimited: false,
    isSchool: false,
    proPlusFeatures: false,
    slug: null,
    priceKey: null,
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
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const SCHOOL_PLAN_IDS: PlanId[] = PLAN_IDS.filter((id) => PLANS[id].isSchool);

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
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
