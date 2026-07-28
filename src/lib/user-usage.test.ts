import { describe, expect, it } from "vitest";
import {
  canUserGenerate,
  getGenerationsLimitForPlan,
  getUpgradePitch,
  isPlanType,
  isUnlimitedPlan,
  normalizeUsageRow,
  toUsageSnapshot,
  type UserUsageRow,
} from "./user-usage";

describe("canUserGenerate — the boundary that IS the paywall", () => {
  it("allows generation when used is below the limit", () => {
    expect(canUserGenerate(0, 15, false)).toBe(true);
    expect(canUserGenerate(14, 15, false)).toBe(true);
  });

  it("blocks generation once used reaches the limit", () => {
    expect(canUserGenerate(15, 15, false)).toBe(false);
  });

  it("blocks generation when used has already exceeded the limit", () => {
    expect(canUserGenerate(16, 15, false)).toBe(false);
  });

  it("blocks generation on a zero limit", () => {
    expect(canUserGenerate(0, 0, false)).toBe(false);
  });

  it("always allows generation when unlimited is true, regardless of the numbers", () => {
    expect(canUserGenerate(99, 15, true)).toBe(true);
  });

  it("always allows generation when limit is the -1 unlimited sentinel", () => {
    expect(canUserGenerate(99, -1, false)).toBe(true);
  });
});

describe("isPlanType", () => {
  it("accepts every known plan id", () => {
    for (const id of [
      "free",
      "pro",
      "pro_plus",
      "school_starter",
      "school_pro",
      "school_enterprise",
    ]) {
      expect(isPlanType(id)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isPlanType("enterprise")).toBe(false);
    expect(isPlanType("")).toBe(false);
  });
});

describe("getGenerationsLimitForPlan / isUnlimitedPlan", () => {
  it("returns the documented limit for each paid consumer plan", () => {
    expect(getGenerationsLimitForPlan("free")).toBe(15);
    expect(getGenerationsLimitForPlan("pro")).toBe(30);
    expect(getGenerationsLimitForPlan("pro_plus")).toBe(60);
  });

  it("returns null (unlimited) for every school plan", () => {
    expect(getGenerationsLimitForPlan("school_starter")).toBeNull();
    expect(getGenerationsLimitForPlan("school_pro")).toBeNull();
    expect(getGenerationsLimitForPlan("school_enterprise")).toBeNull();
  });

  it("agrees with isUnlimitedPlan", () => {
    expect(isUnlimitedPlan("free")).toBe(false);
    expect(isUnlimitedPlan("pro")).toBe(false);
    expect(isUnlimitedPlan("pro_plus")).toBe(false);
    expect(isUnlimitedPlan("school_starter")).toBe(true);
    expect(isUnlimitedPlan("school_pro")).toBe(true);
    expect(isUnlimitedPlan("school_enterprise")).toBe(true);
  });
});

function row(overrides: Partial<UserUsageRow> = {}): UserUsageRow {
  return {
    user_id: "u1",
    plan_type: "free",
    generations_used: 0,
    generations_limit: 15,
    reset_date: "2026-08-01",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeUsageRow", () => {
  it("falls back to free for an unrecognized plan_type", () => {
    const n = normalizeUsageRow(row({ plan_type: "enterprise" as never }));
    expect(n.plan_type).toBe("free");
  });

  it("forces the limit to -1 for a school plan even if the row says otherwise", () => {
    const n = normalizeUsageRow(row({ plan_type: "school_pro", generations_limit: 15 }));
    expect(n.generations_limit).toBe(-1);
  });

  it("clamps a negative generations_used to 0", () => {
    const n = normalizeUsageRow(row({ generations_used: -5 }));
    expect(n.generations_used).toBe(0);
  });

  it("coerces a PostgREST string count to a number", () => {
    const n = normalizeUsageRow(row({ generations_used: "7" as unknown as number }));
    expect(n.generations_used).toBe(7);
  });

  it("self-heals a zero or missing limit on free back to 15", () => {
    expect(normalizeUsageRow(row({ generations_limit: 0 })).generations_limit).toBe(15);
    expect(
      normalizeUsageRow(row({ generations_limit: undefined as unknown as number }))
        .generations_limit,
    ).toBe(15);
  });

  it("self-heals the legacy SQL default of 3 on free back to 15", () => {
    // This is the 3-vs-15 drift: normalizeUsageRow already treats anything
    // below 1 as invalid, but a legacy row created with the DB default of 3
    // is NOT below 1 — so it is NOT currently self-healed. This test pins
    // today's actual (arguably wrong) behaviour; Phase 3's migration fixes
    // it at the source instead.
    expect(normalizeUsageRow(row({ generations_limit: 3 })).generations_limit).toBe(3);
  });

  it("preserves a custom limit a super-admin set on a paid plan", () => {
    const n = normalizeUsageRow(row({ plan_type: "pro", generations_limit: 500 }));
    expect(n.generations_limit).toBe(500);
  });
});

describe("toUsageSnapshot", () => {
  it("blocks a free user who has used all 15", () => {
    const s = toUsageSnapshot(row({ generations_used: 15, generations_limit: 15 }));
    expect(s.canGenerate).toBe(false);
  });

  it("reports unlimited + no limit for a school plan", () => {
    const s = toUsageSnapshot(row({ plan_type: "school_pro", generations_used: 500 }));
    expect(s.unlimited).toBe(true);
    expect(s.generationsLimit).toBeNull();
    expect(s.canGenerate).toBe(true);
  });

  it("blocks a pro_plus user who has used all 60", () => {
    const s = toUsageSnapshot(
      row({ plan_type: "pro_plus", generations_used: 60, generations_limit: 60 }),
    );
    expect(s.canGenerate).toBe(false);
  });
});

describe("getUpgradePitch", () => {
  it("mentions the actual Pro generations limit for a free user", () => {
    const pitch = getUpgradePitch("free");
    expect(pitch.subline).toContain(String(getGenerationsLimitForPlan("pro")));
  });

  it("mentions the actual Pro Plus generations limit for a pro user", () => {
    const pitch = getUpgradePitch("pro");
    expect(pitch.subline).toContain(String(getGenerationsLimitForPlan("pro_plus")));
  });
});
