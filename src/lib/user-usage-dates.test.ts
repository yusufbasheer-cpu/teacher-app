import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstDayOfNextMonthUtc, needsMonthlyReset, todayUtcDateString } from "./user-usage";

describe("test environment sanity", () => {
  it("runs in a non-UTC zone so local-time date bugs actually surface", () => {
    // If this ever reports 0, vitest.config.ts's TZ pin stopped working and
    // every test below would silently stop catching local-time bugs.
    expect(new Date("2026-07-15T00:00:00Z").getTimezoneOffset()).not.toBe(0);
  });
});

describe("firstDayOfNextMonthUtc — pure, takes an injectable `from`", () => {
  it("returns the 1st of the following month for a mid-month date", () => {
    expect(firstDayOfNextMonthUtc(new Date("2026-07-15T09:00:00Z"))).toBe("2026-08-01");
  });

  it("rolls over correctly at the December→January year boundary", () => {
    expect(firstDayOfNextMonthUtc(new Date("2026-12-15T00:00:00Z"))).toBe("2027-01-01");
  });

  it("rolls over correctly from a 31-day month into a 28-day month", () => {
    expect(firstDayOfNextMonthUtc(new Date("2026-01-31T23:59:59Z"))).toBe("2026-02-01");
  });

  it("handles a leap day", () => {
    expect(firstDayOfNextMonthUtc(new Date("2024-02-29T12:00:00Z"))).toBe("2024-03-01");
  });

  it("the last moment of a UTC month is still that month, not the next", () => {
    expect(firstDayOfNextMonthUtc(new Date("2026-08-01T00:00:00Z"))).toBe("2026-09-01");
  });
});

describe("todayUtcDateString / needsMonthlyReset — UTC boundary, not local time", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is still July 31st in UTC at an hour that is already Aug 1st in Dubai (UTC+4)", () => {
    // 2026-07-31T21:00:00Z == 2026-08-01T01:00:00 in Asia/Dubai.
    // A local-time implementation would report this as August 1st; the
    // correct UTC-anchored answer is still July 31st.
    vi.setSystemTime(new Date("2026-07-31T21:00:00Z"));
    expect(todayUtcDateString()).toBe("2026-07-31");
  });

  it("needsMonthlyReset is false right up to the UTC boundary", () => {
    vi.setSystemTime(new Date("2026-07-31T23:00:00Z"));
    expect(needsMonthlyReset("2026-08-01")).toBe(false);
  });

  it("needsMonthlyReset flips true exactly at the UTC boundary", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00Z"));
    expect(needsMonthlyReset("2026-08-01")).toBe(true);
  });

  it("needsMonthlyReset stays true well past the boundary (dormant user)", () => {
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
    expect(needsMonthlyReset("2026-08-01")).toBe(true);
  });
});
