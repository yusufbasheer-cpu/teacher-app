export type PlanType =
  | "free"
  | "pro"
  | "pro_plus"
  | "school_starter"
  | "school_pro"
  | "school_enterprise";

export type UserUsageRow = {
  id?: string;
  user_id: string;
  plan_type: PlanType;
  generations_used: number;
  generations_limit: number;
  reset_date: string;
  created_at: string;
};

/** Safe defaults when the usage row cannot be loaded (fail-open for generation). */
export function defaultFreeUsageSnapshot(): UserUsageSnapshot {
  return {
    planType: "free",
    generationsUsed: 0,
    generationsLimit: 15,
    unlimited: false,
    canGenerate: true,
    resetDate: firstDayOfNextMonthUtc(),
  };
}

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
      return 15;
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

/** Pro Plus and all school plans (unlimited generations + full product tier). */
export function hasProPlusAccess(plan: PlanType): boolean {
  return plan === "pro_plus" || SCHOOL_PLANS.includes(plan);
}

function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayUtcDateString(): string {
  return formatYmd(new Date());
}

export function firstDayOfCurrentMonthUtc(): string {
  const now = new Date();
  return formatYmd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

/** First calendar day of the month after `from` (UTC). Used as the next reset anchor for new users. */
export function firstDayOfNextMonthUtc(from: Date = new Date()): string {
  return formatYmd(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)));
}

/** Reset usage once the reset_date (first day of next month) is reached. */
export function needsMonthlyReset(resetDate: string): boolean {
  return todayUtcDateString() >= resetDate;
}

export function normalizeUsageRow(row: UserUsageRow): UserUsageRow {
  const plan = isPlanType(row.plan_type) ? row.plan_type : "free";
  const unlimited = isUnlimitedPlan(plan);
  const used = Math.max(0, Number(row.generations_used) || 0);

  let generations_limit = Number(row.generations_limit);
  if (unlimited) {
    generations_limit = -1;
  } else if (!Number.isFinite(generations_limit) || generations_limit < 1) {
    generations_limit = getGenerationsLimitForPlan(plan) ?? 15;
  }

  return {
    ...row,
    plan_type: plan,
    generations_used: used,
    generations_limit,
  };
}

/** Block only when used has reached or exceeded the plan limit. */
export function canUserGenerate(used: number, limit: number, unlimited: boolean): boolean {
  if (unlimited || limit < 0) return true;
  return used < limit;
}

export function toUsageSnapshot(row: UserUsageRow): UserUsageSnapshot {
  const normalized = normalizeUsageRow(row);
  const unlimited = isUnlimitedPlan(normalized.plan_type);
  const limit = unlimited ? null : normalized.generations_limit;
  const canGenerate = canUserGenerate(
    normalized.generations_used,
    normalized.generations_limit,
    unlimited,
  );

  return {
    planType: normalized.plan_type,
    generationsUsed: normalized.generations_used,
    generationsLimit: limit,
    unlimited,
    canGenerate,
    resetDate: normalized.reset_date,
  };
}

export function logUsageSnapshot(context: string, usage: UserUsageSnapshot): void {
  console.log(`[user-usage] ${context}`, {
    generations_used: usage.generationsUsed,
    generations_limit: usage.unlimited ? "unlimited" : usage.generationsLimit,
    canGenerate: usage.canGenerate,
    plan_type: usage.planType,
    reset_date: usage.resetDate,
  });
}

/** Log after a successful generation is counted against the monthly limit. */
export function logGenerationCounted(usage: UserUsageSnapshot): void {
  const limitLabel = usage.unlimited ? "unlimited" : String(usage.generationsLimit ?? "?");
  console.log(`Generation counted - used ${usage.generationsUsed} of ${limitLabel}`);
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

export const DEFAULT_FREE_USAGE_INSERT = {
  plan_type: "free" as const,
  generations_used: 0,
  generations_limit: 15,
};
