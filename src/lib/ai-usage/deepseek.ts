import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export const DEEPSEEK_PRICING = {
  sourceDate: "2026-10-22",
  sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing/",
  basis: "peak" as const,
  models: {
    "deepseek-flash": { cacheHitInputPerMillion: 0.006, cacheMissInputPerMillion: 0.3, outputPerMillion: 1.2 },
    "deepseek-v4-flash": { cacheHitInputPerMillion: 0.006, cacheMissInputPerMillion: 0.3, outputPerMillion: 1.2 },
  },
};

export type DeepSeekUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  totalTokens: number | null;
};

const nonNegative = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

export function parseDeepSeekUsage(rawBody: string): { model: string | null; usage: DeepSeekUsage | null } {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const raw = parsed.usage;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { model: typeof parsed.model === "string" ? parsed.model : null, usage: null };
    const u = raw as Record<string, unknown>;
    return {
      model: typeof parsed.model === "string" ? parsed.model : null,
      usage: {
        promptTokens: nonNegative(u.prompt_tokens),
        completionTokens: nonNegative(u.completion_tokens),
        cacheHitTokens: nonNegative(u.prompt_cache_hit_tokens),
        cacheMissTokens: nonNegative(u.prompt_cache_miss_tokens),
        totalTokens: nonNegative(u.total_tokens),
      },
    };
  } catch {
    return { model: null, usage: null };
  }
}

export function estimateDeepSeekCostUsd(model: string, usage: DeepSeekUsage, env: Record<string, string | undefined> = process.env): number | null {
  const base = DEEPSEEK_PRICING.models[model.toLowerCase() as keyof typeof DEEPSEEK_PRICING.models];
  if (!base) return null;
  const numberEnv = (name: string, fallback: number) => {
    const value = Number(env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const hit = usage.cacheHitTokens ?? 0;
  const miss = usage.cacheMissTokens ?? Math.max(0, (usage.promptTokens ?? 0) - hit);
  const output = usage.completionTokens ?? 0;
  return (
    hit * numberEnv("DEEPSEEK_CACHE_HIT_USD_PER_MILLION", base.cacheHitInputPerMillion) +
    miss * numberEnv("DEEPSEEK_CACHE_MISS_USD_PER_MILLION", base.cacheMissInputPerMillion) +
    output * numberEnv("DEEPSEEK_OUTPUT_USD_PER_MILLION", base.outputPerMillion)
  ) / 1_000_000;
}

/** Best-effort append-only logging. Deliberately never throws and is safe to fire-and-forget. */
export async function logDeepSeekUsage(params: {
  userId: string;
  operation: string;
  requestedModel: string;
  rawBody?: string;
  status: "success" | "failed";
  durationMs: number;
}): Promise<void> {
  try {
    const admin = getSupabaseServiceRole();
    if (!admin) return;
    const parsed = params.rawBody ? parseDeepSeekUsage(params.rawBody) : { model: null, usage: null };
    const model = parsed.model ?? params.requestedModel;
    const cost = parsed.usage ? estimateDeepSeekCostUsd(model, parsed.usage) : null;
    const { error } = await admin.from("ai_usage_events").insert({
      user_id: params.userId,
      provider: "deepseek",
      operation: params.operation.slice(0, 160),
      model: model.slice(0, 100),
      prompt_tokens: parsed.usage?.promptTokens ?? null,
      completion_tokens: parsed.usage?.completionTokens ?? null,
      cache_hit_tokens: parsed.usage?.cacheHitTokens ?? null,
      cache_miss_tokens: parsed.usage?.cacheMissTokens ?? null,
      total_tokens: parsed.usage?.totalTokens ?? null,
      estimated_cost_usd: cost,
      status: params.status,
      duration_ms: Math.max(0, Math.round(params.durationMs)),
    });
    if (error) console.error("[ai-usage] insert failed:", error.message);
  } catch (error) {
    console.error("[ai-usage] unexpected error:", error instanceof Error ? error.message : error);
  }
}
