import { describe, expect, it } from "vitest";
import { estimateDeepSeekCostUsd, parseDeepSeekUsage } from "./deepseek";

describe("DeepSeek usage", () => {
  const usage = { promptTokens: 1000, completionTokens: 200, cacheHitTokens: 400, cacheMissTokens: 600, totalTokens: 1200 };

  it("reads the documented usage shape without changing completion parsing", () => {
    expect(parseDeepSeekUsage(JSON.stringify({ model: "deepseek-flash", usage: { prompt_tokens: 1000, completion_tokens: 200, prompt_cache_hit_tokens: 400, prompt_cache_miss_tokens: 600, total_tokens: 1200 } }))).toEqual({ model: "deepseek-flash", usage });
    expect(parseDeepSeekUsage("not-json").usage).toBeNull();
  });

  it("uses conservative current peak pricing and allows env overrides", () => {
    expect(estimateDeepSeekCostUsd("deepseek-flash", usage)).toBeCloseTo((400 * 0.006 + 600 * 0.3 + 200 * 1.2) / 1_000_000);
    expect(estimateDeepSeekCostUsd("deepseek-flash", usage, { DEEPSEEK_CACHE_HIT_USD_PER_MILLION: "1", DEEPSEEK_CACHE_MISS_USD_PER_MILLION: "2", DEEPSEEK_OUTPUT_USD_PER_MILLION: "3" })).toBeCloseTo(0.0022);
  });

  it("does not invent a price for the retired deepseek-chat model name", () => {
    expect(estimateDeepSeekCostUsd("deepseek-chat", usage)).toBeNull();
  });
});
