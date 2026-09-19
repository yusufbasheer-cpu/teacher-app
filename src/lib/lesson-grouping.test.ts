import { describe, expect, it } from "vitest";
import { groupByRecency } from "./lesson-grouping";

const NOW = new Date("2026-09-19T12:00:00Z").getTime();
const daysAgo = (n: number) => ({
  created_at: new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString(),
});

describe("groupByRecency", () => {
  it("bands lessons into this week, earlier this month, and older", () => {
    const groups = groupByRecency(
      [daysAgo(1), daysAgo(3), daysAgo(12), daysAgo(200)],
      NOW,
    );

    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ["This week", 2],
      ["Earlier this month", 1],
      ["Older", 1],
    ]);
  });

  it("omits bands that would render empty rather than showing a bare heading", () => {
    const groups = groupByRecency([daysAgo(1), daysAgo(400)], NOW);
    expect(groups.map((g) => g.id)).toEqual(["this-week", "older"]);
  });

  it("keeps every item exactly once, in the order given", () => {
    const items = [daysAgo(0), daysAgo(2), daysAgo(9), daysAgo(40), daysAgo(5)];
    const groups = groupByRecency(items, NOW);
    const flattened = groups.flatMap((g) => g.items);

    expect(flattened).toHaveLength(items.length);
    expect(new Set(flattened).size).toBe(items.length);
    // Within a band, arrival order survives: day 0, day 2 and day 5 stay in
    // the order the caller's sort put them.
    expect(groups[0]!.items).toEqual([items[0], items[1], items[4]]);
  });

  it("puts a lesson exactly on a boundary in the older band", () => {
    // 7 days is not "this week" any more; 30 is not "this month".
    expect(groupByRecency([daysAgo(7)], NOW)[0]!.id).toBe("this-month");
    expect(groupByRecency([daysAgo(30)], NOW)[0]!.id).toBe("older");
  });

  it("does not lose a lesson with a future or unreadable timestamp", () => {
    const groups = groupByRecency(
      [{ created_at: "not a date" }, { created_at: new Date(NOW + 5000).toISOString() }],
      NOW,
    );

    expect(groups.flatMap((g) => g.items)).toHaveLength(2);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByRecency([], NOW)).toEqual([]);
  });
});
