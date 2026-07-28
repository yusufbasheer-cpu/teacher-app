import { describe, expect, it } from "vitest";
import {
  formatRegionalPrice,
  getPlanPriceKey,
  getRegionForCountryCode,
  isPricingRegionId,
  PRICING_REGION_LIST,
  PRICING_REGIONS,
  type PaidPlanKey,
} from "./pricing-regions";

const PLAN_KEYS: PaidPlanKey[] = ["pro", "proPlus", "schoolStarter", "schoolPro", "schoolEnterprise"];

describe("PRICING_REGIONS table invariants", () => {
  it("every region's id matches its own key in the record", () => {
    for (const [key, region] of Object.entries(PRICING_REGIONS)) {
      expect(region.id).toBe(key);
    }
  });

  it("every region defines all 5 paid plans with positive prices", () => {
    for (const region of PRICING_REGION_LIST) {
      for (const key of PLAN_KEYS) {
        const pair = region.prices[key];
        expect(pair, `${region.id}.${key}`).toBeDefined();
        expect(pair.monthly).toBeGreaterThan(0);
        expect(pair.annual).toBeGreaterThan(0);
      }
    }
  });

  it("annual pricing is always cheaper than paying monthly for 12 months", () => {
    for (const region of PRICING_REGION_LIST) {
      for (const key of PLAN_KEYS) {
        const { monthly, annual } = region.prices[key];
        expect(annual, `${region.id}.${key}`).toBeLessThan(monthly * 12);
      }
    }
  });

  it("decimals is 0 or 2 for every region and prices respect it", () => {
    for (const region of PRICING_REGION_LIST) {
      expect([0, 2]).toContain(region.decimals);
    }
  });
});

describe("isPricingRegionId", () => {
  it("accepts every real region id", () => {
    for (const id of Object.keys(PRICING_REGIONS)) {
      expect(isPricingRegionId(id)).toBe(true);
    }
  });

  it("rejects an unknown id", () => {
    expect(isPricingRegionId("mars")).toBe(false);
  });
});

describe("getRegionForCountryCode", () => {
  it.each([
    ["AE", "gcc"],
    ["SA", "gcc"],
    ["IN", "india"],
    ["PK", "pakistan"],
    ["GB", "uk"],
    ["US", "usd"],
    ["CA", "usd"],
    ["AU", "australia"],
    ["DE", "europe"],
    ["SG", "singapore"],
    ["MM", "myanmar"],
  ])("maps %s to %s", (cc, expected) => {
    expect(getRegionForCountryCode(cc)).toBe(expected);
  });

  it("falls back to usd for empty, null, or unrecognized input", () => {
    expect(getRegionForCountryCode("")).toBe("usd");
    expect(getRegionForCountryCode(null)).toBe("usd");
    expect(getRegionForCountryCode(undefined)).toBe("usd");
    expect(getRegionForCountryCode("ZZ")).toBe("usd");
  });

  it("is case-insensitive", () => {
    expect(getRegionForCountryCode("ae")).toBe("gcc");
  });
});

describe("getPlanPriceKey", () => {
  it("maps every pricing-page slug to its price key", () => {
    expect(getPlanPriceKey("pro")).toBe("pro");
    expect(getPlanPriceKey("pro-plus")).toBe("proPlus");
    expect(getPlanPriceKey("school-starter")).toBe("schoolStarter");
    expect(getPlanPriceKey("school-pro")).toBe("schoolPro");
    expect(getPlanPriceKey("school-enterprise")).toBe("schoolEnterprise");
  });

  it("returns null for an unrecognized slug", () => {
    expect(getPlanPriceKey("bogus")).toBeNull();
  });
});

describe("formatRegionalPrice", () => {
  it("renders GBP with a £ symbol and 2 decimals", () => {
    const uk = PRICING_REGIONS.uk;
    expect(formatRegionalPrice(uk, 7.99, "month")).toBe("£7.99 / month");
  });

  it("renders AED-style regions with 0 decimals and no symbol clutter", () => {
    const gcc = PRICING_REGIONS.gcc;
    expect(formatRegionalPrice(gcc, 150, "year")).toBe("150 AED / year");
  });

  it("renders USD with a $ prefix", () => {
    const usd = PRICING_REGIONS.usd;
    expect(formatRegionalPrice(usd, 9.99, "month")).toBe("$9.99 / month");
  });
});
