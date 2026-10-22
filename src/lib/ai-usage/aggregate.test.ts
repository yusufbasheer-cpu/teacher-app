import { describe, expect, it } from "vitest";
import { aggregateAiUsage, type DeepSeekUsageRow, type GammaUsageRow } from "./aggregate";

describe("aggregateAiUsage", () => {
  it("keeps unsettled Gamma costs distinct and aggregates DeepSeek operations", () => {
    const gamma: GammaUsageRow[] = [
      { user_id: "u1", status: "completed", credits_deducted: 21, credits_remaining: 900, delivered: true, error_code: null, created_at: "2026-10-22T01:00:00Z" },
      { user_id: "u1", status: "pending", credits_deducted: null, credits_remaining: null, delivered: false, error_code: null, created_at: "2026-10-22T02:00:00Z" },
      { user_id: "u2", status: "completed", credits_deducted: null, credits_remaining: null, delivered: false, error_code: null, created_at: "2026-10-21T02:00:00Z" },
    ];
    const deep: DeepSeekUsageRow[] = [
      { user_id: "u1", operation: "lesson_plan_section", status: "success", prompt_tokens: 10, completion_tokens: 5, cache_hit_tokens: 2, cache_miss_tokens: 8, total_tokens: 15, estimated_cost_usd: 0.01, created_at: "2026-10-22T03:00:00Z" },
      { user_id: "u2", operation: "lesson_plan_section", status: "success", prompt_tokens: 20, completion_tokens: 10, cache_hit_tokens: 0, cache_miss_tokens: 20, total_tokens: 30, estimated_cost_usd: null, created_at: "2026-10-22T04:00:00Z" },
    ];
    const result = aggregateAiUsage(gamma, deep);
    expect(result.gamma).toMatchObject({ runs: 3, creditsUsed: 21, unsettled: 2, undelivered: 1, latestCreditsRemaining: 900 });
    expect(result.deepSeek).toMatchObject({ calls: 2, totalTokens: 45, estimatedCostUsd: 0.01, unpriced: 1 });
    expect(result.deepSeek.operations[0]).toMatchObject({ operation: "lesson_plan_section", calls: 2, tokens: 45, unpriced: 1 });
  });

  it("returns stable zero/empty values", () => {
    expect(aggregateAiUsage([], [])).toMatchObject({ gamma: { runs: 0, unsettled: 0, creditsUsed: 0 }, deepSeek: { calls: 0, totalTokens: 0, operations: [], topUsers: [] }, trend: [] });
  });
});
