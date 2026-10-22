import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.GAMMA_LEDGER_IT === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const productionRef = "jbwevzvtloahjoamwnjt";
const safe = enabled && !!url && !!serviceKey && !url.includes(productionRef);

describe.skipIf(!safe)("ai_usage_events staging integration", () => {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const ids: string[] = [];

  beforeAll(() => {
    if (url.includes(productionRef)) throw new Error("Refusing production Supabase");
  });
  afterAll(async () => {
    if (ids.length) await admin.from("ai_usage_events").delete().in("id", ids);
  });

  it("persists through service role and denies anon reads", async () => {
    const { data, error } = await admin.from("ai_usage_events").insert({ user_id: crypto.randomUUID(), provider: "deepseek", operation: "integration_test", model: "deepseek-flash", total_tokens: 3, status: "success", duration_ms: 1 }).select("id,total_tokens").single();
    expect(error).toBeNull();
    expect(data?.total_tokens).toBe(3);
    if (data?.id) ids.push(data.id);
    if (anonKey) {
      const anon = createClient(url, anonKey, { auth: { persistSession: false } });
      const result = await anon.from("ai_usage_events").select("id");
      expect(result.error).not.toBeNull();
    }
  });
});
