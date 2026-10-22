export type GammaUsageRow = {
  user_id: string;
  status: string;
  credits_deducted: number | null;
  credits_remaining: number | null;
  delivered: boolean;
  error_code: string | null;
  created_at: string;
};

export type DeepSeekUsageRow = {
  user_id: string;
  operation: string;
  status: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
};

const add = (a: number, b: number | null | undefined) => a + (Number(b) || 0);
const day = (iso: string) => iso.slice(0, 10);

export function aggregateAiUsage(gammaRows: GammaUsageRow[], deepSeekRows: DeepSeekUsageRow[]) {
  const gamma = {
    runs: gammaRows.length,
    failures: gammaRows.filter((r) => r.status === "failed").length,
    undelivered: gammaRows.filter((r) => r.status === "completed" && !r.delivered).length,
    unsettled: gammaRows.filter((r) => r.credits_deducted == null).length,
    creditsUsed: gammaRows.reduce((n, r) => add(n, r.credits_deducted), 0),
    latestCreditsRemaining: gammaRows.find((r) => r.credits_remaining != null)?.credits_remaining ?? null,
  };

  const operations = new Map<string, { calls: number; tokens: number; estimatedCostUsd: number; unpriced: number }>();
  const users = new Map<string, { calls: number; tokens: number; estimatedCostUsd: number }>();
  const trend = new Map<string, { gammaCredits: number; deepSeekTokens: number; deepSeekEstimatedCostUsd: number }>();
  for (const row of deepSeekRows) {
    const op = operations.get(row.operation) ?? { calls: 0, tokens: 0, estimatedCostUsd: 0, unpriced: 0 };
    op.calls += 1;
    op.tokens = add(op.tokens, row.total_tokens);
    op.estimatedCostUsd = add(op.estimatedCostUsd, row.estimated_cost_usd);
    if (row.estimated_cost_usd == null) op.unpriced += 1;
    operations.set(row.operation, op);

    const user = users.get(row.user_id) ?? { calls: 0, tokens: 0, estimatedCostUsd: 0 };
    user.calls += 1;
    user.tokens = add(user.tokens, row.total_tokens);
    user.estimatedCostUsd = add(user.estimatedCostUsd, row.estimated_cost_usd);
    users.set(row.user_id, user);

    const key = day(row.created_at);
    const point = trend.get(key) ?? { gammaCredits: 0, deepSeekTokens: 0, deepSeekEstimatedCostUsd: 0 };
    point.deepSeekTokens = add(point.deepSeekTokens, row.total_tokens);
    point.deepSeekEstimatedCostUsd = add(point.deepSeekEstimatedCostUsd, row.estimated_cost_usd);
    trend.set(key, point);
  }
  for (const row of gammaRows) {
    const key = day(row.created_at);
    const point = trend.get(key) ?? { gammaCredits: 0, deepSeekTokens: 0, deepSeekEstimatedCostUsd: 0 };
    point.gammaCredits = add(point.gammaCredits, row.credits_deducted);
    trend.set(key, point);
  }

  return {
    gamma,
    deepSeek: {
      calls: deepSeekRows.length,
      failures: deepSeekRows.filter((r) => r.status === "failed").length,
      promptTokens: deepSeekRows.reduce((n, r) => add(n, r.prompt_tokens), 0),
      completionTokens: deepSeekRows.reduce((n, r) => add(n, r.completion_tokens), 0),
      cacheHitTokens: deepSeekRows.reduce((n, r) => add(n, r.cache_hit_tokens), 0),
      cacheMissTokens: deepSeekRows.reduce((n, r) => add(n, r.cache_miss_tokens), 0),
      totalTokens: deepSeekRows.reduce((n, r) => add(n, r.total_tokens), 0),
      estimatedCostUsd: deepSeekRows.reduce((n, r) => add(n, r.estimated_cost_usd), 0),
      unpriced: deepSeekRows.filter((r) => r.estimated_cost_usd == null).length,
      operations: [...operations.entries()].map(([operation, value]) => ({ operation, ...value })).sort((a, b) => b.tokens - a.tokens),
      topUsers: [...users.entries()].map(([userId, value]) => ({ userId, ...value })).sort((a, b) => b.tokens - a.tokens).slice(0, 5),
    },
    trend: [...trend.entries()].map(([date, value]) => ({ date, ...value })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
