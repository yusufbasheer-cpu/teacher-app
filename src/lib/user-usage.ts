export type PlanType =
  | "free"
  | "pro"
  | "pro_plus"
  | "school_starter"
  | "school_pro"
  | "school_enterprise";

export type UserUsageRow = {
  user_id: string;
  plan_type: PlanType;
  generations_used: number;
  generations_limit: number;
  reset_date: string;
  created_at: string;
};

export type UserUsageSnapshot = {
  planType: PlanType;
  generationsUsed: number;
  generationsLimit: number | null;
  unlimited: boolean;
  canGenerate: boolean;
  resetDate: string;
};

export const GENERATION_LIMIT_ERROR_CODE = "GENERATION_LIMIT_REACHED";

const SCHOOL_PLANS: PlanType[] = ["school_starter", "school_pro", "school_enterprise"];

export function isPlanType(value: string): value is PlanType {
  return [
    "free",
    "pro",
    "pro_plus",
    "school_starter",
    "school_pro",
    "school_enterprise",
  ].includes(value);
}

export function getGenerationsLimitForPlan(plan: PlanType): number | null {
  switch (plan) {
    case "free":
      return 3;
    case "pro":
      return 30;
    case "pro_plus":
      return 60;
    default:
      return null;
  }
}

export function isUnlimitedPlan(plan: PlanType): boolean {
  return SCHOOL_PLANS.includes(plan) || getGenerationsLimitForPlan(plan) === null;
}

export function firstDayOfCurrentMonthUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function needsMonthlyReset(resetDate: string): boolean {
  const current = firstDayOfCurrentMonthUtc();
  return resetDate < current;
}

export function toUsageSnapshot(row: UserUsageRow): UserUsageSnapshot {
  const unlimited = isUnlimitedPlan(row.plan_type);
  const limit = unlimited ? null : row.generations_limit;
  const canGenerate = unlimited || row.generations_used < row.generations_limit;

  return {
    planType: row.plan_type,
    generationsUsed: row.generations_used,
    generationsLimit: limit,
    unlimited,
    canGenerate,
    resetDate: row.reset_date,
  };
}

export function getUpgradePitch(plan: PlanType): { headline: string; subline: string } {
  if (plan === "free") {
    return {
      headline: "You have used all your generations for this month.",
      subline: "Upgrade to Pro for 30 generations per month for just 15 AED.",
    };
  }
  if (plan === "pro") {
    return {
      headline: "You have used all your Pro generations for this month.",
      subline: "Upgrade to Pro Plus for 60 generations per month for just 25 AED.",
    };
  }
  return {
    headline: "You have used all your generations for this month.",
    subline: "Upgrade your plan on the pricing page for more generations.",
  };
}

export function formatLimitMessage(used: number, limit: number | null, unlimited: boolean): string {
  if (unlimited) return "Unlimited";
  if (limit == null) return "Unlimited";
  return `Generations used: ${used} of ${limit} this month`;
}
