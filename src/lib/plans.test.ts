import { describe, expect, it } from "vitest";
import { dbLimitValue, isFreePlan, PLAN_IDS, planIdByAdminLabel, PLANS, SCHOOL_PLAN_IDS } from "./plans";

describe("PLANS registry consistency", () => {
  it("every entry's key matches its own id", () => {
    for (const [key, plan] of Object.entries(PLANS)) {
      expect(plan.id).toBe(key);
    }
  });

  it("unlimited is true exactly when generationsLimit is null", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.unlimited).toBe(plan.generationsLimit === null);
    }
  });

  it("every school plan is unlimited and has Pro Plus features", () => {
    for (const id of SCHOOL_PLAN_IDS) {
      expect(PLANS[id].unlimited).toBe(true);
      expect(PLANS[id].proPlusFeatures).toBe(true);
    }
  });

  it("free < pro < pro_plus on generationsLimit (catches a fat-fingered digit)", () => {
    expect(PLANS.free.generationsLimit).not.toBeNull();
    expect(PLANS.pro.generationsLimit).not.toBeNull();
    expect(PLANS.pro_plus.generationsLimit).not.toBeNull();
    expect(PLANS.free.generationsLimit as number).toBeLessThan(PLANS.pro.generationsLimit as number);
    expect(PLANS.pro.generationsLimit as number).toBeLessThan(PLANS.pro_plus.generationsLimit as number);
  });

  it("dbLimitValue returns -1 for exactly the unlimited plans, the real number otherwise", () => {
    for (const id of PLAN_IDS) {
      if (PLANS[id].unlimited) {
        expect(dbLimitValue(id)).toBe(-1);
      } else {
        expect(dbLimitValue(id)).toBe(PLANS[id].generationsLimit);
      }
    }
  });

  it("every non-free plan has a unique, non-null priceKey and slug", () => {
    const nonFree = PLAN_IDS.filter((id) => id !== "free");
    const priceKeys = nonFree.map((id) => PLANS[id].priceKey);
    for (const id of nonFree) {
      expect(PLANS[id].priceKey).not.toBeNull();
      expect(PLANS[id].slug).not.toBeNull();
    }
    expect(new Set(priceKeys).size).toBe(priceKeys.length);
  });

  it("free has no slug or priceKey", () => {
    expect(PLANS.free.slug).toBeNull();
    expect(PLANS.free.priceKey).toBeNull();
  });
});

describe("Free vs Pro feature entitlements", () => {
  it("free has every new gate locked and only the 2 free-tier sections allowed", () => {
    expect(PLANS.free.sourceContent).toBe(false);
    expect(PLANS.free.afl).toBe(false);
    expect(PLANS.free.teachingStrategy).toBe(false);
    expect(PLANS.free.questionPaper).toBe(false);
    expect(PLANS.free.differentiatedWorksheets).toBe(false);
    expect(PLANS.free.allowedSections).toEqual(["Full Lesson Plan", "PPT Slide Content"]);
  });

  it("every plan above free has every new gate unlocked and all 7 sections allowed", () => {
    for (const id of PLAN_IDS.filter((id) => id !== "free")) {
      expect(PLANS[id].sourceContent).toBe(true);
      expect(PLANS[id].afl).toBe(true);
      expect(PLANS[id].teachingStrategy).toBe(true);
      expect(PLANS[id].questionPaper).toBe(true);
      expect(PLANS[id].differentiatedWorksheets).toBe(true);
      expect(PLANS[id].allowedSections).toHaveLength(7);
    }
  });

  it("isFreePlan is true only for free", () => {
    expect(isFreePlan("free")).toBe(true);
    for (const id of PLAN_IDS.filter((id) => id !== "free")) {
      expect(isFreePlan(id)).toBe(false);
    }
  });
});

describe("planIdByAdminLabel", () => {
  it("resolves every plan's own admin label back to its id", () => {
    for (const id of PLAN_IDS) {
      expect(planIdByAdminLabel(PLANS[id].adminLabel)).toBe(id);
    }
  });

  it("returns null for an unrecognized label", () => {
    expect(planIdByAdminLabel("Enterprise Ultra")).toBeNull();
  });
});
