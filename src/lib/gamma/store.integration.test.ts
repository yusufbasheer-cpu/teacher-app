import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { checkAdmission } from "./policy";
import { SupabaseGammaStore } from "./store";
import { testConfig } from "./test-helpers";

/**
 * Database-backed ledger test. SKIPPED unless explicitly enabled and pointed at a NON-production project:
 *   GAMMA_LEDGER_IT=1 NEXT_PUBLIC_SUPABASE_URL=<staging url> SUPABASE_SERVICE_ROLE_KEY=<staging key> npx vitest run src/lib/gamma/store.integration.test.ts
 * It only ever creates rows for random user ids and deletes them afterwards.
 */
const PROD_REF = "jbwevzvtloahjoamwnjt";
const wanted = process.env.GAMMA_LEDGER_IT === "1";
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")?.[1];
const enabled = wanted && !!ref && ref !== PROD_REF && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("ledger integration guard", () => {
  it("refuses to run against the production project", () => {
    if (wanted) expect(ref, "GAMMA_LEDGER_IT=1 but the Supabase URL is production or missing").not.toBe(PROD_REF);
    expect(true).toBe(true);
  });
});

describe.skipIf(!enabled)("gamma_generations ledger on real Postgres (staging)", () => {
  const store = new SupabaseGammaStore();
  const users: string[] = [];
  const newUser = () => {
    const id = randomUUID();
    users.push(id);
    return id;
  };
  const now = Date.now();

  afterAll(async () => {
    const db = getSupabaseServiceRole();
    if (db && users.length) await db.from("gamma_generations").delete().in("user_id", users);
  });

  it("inserts, enforces ONE active generation per user atomically, allows other users", async () => {
    const u = newUser();
    const first = await store.insertSubmitting({ userId: u, requestHash: "h1", requestedSlides: 13, now });
    expect(first).toMatchObject({ status: "submitting", userId: u });
    expect(await store.insertSubmitting({ userId: u, requestHash: "h2", requestedSlides: 13, now })).toBeNull();
    expect(await store.insertSubmitting({ userId: newUser(), requestHash: "h1", requestedSlides: 13, now })).not.toBeNull();
  });

  it("under real concurrency exactly one of N simultaneous submissions wins", async () => {
    const u = newUser();
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => store.insertSubmitting({ userId: u, requestHash: `c${i}`, requestedSlides: 13, now })));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("persists state across store instances: pending id, active lookup, completion frees the lock, undelivered is resumable", async () => {
    const u = newUser();
    const row = (await store.insertSubmitting({ userId: u, requestHash: "p1", requestedSlides: 13, now }))!;
    await store.update(row.id, { status: "pending", generationId: "gen-it-1" }, now + 1);
    const fresh = new SupabaseGammaStore();
    expect(await fresh.findActiveForUser(u)).toMatchObject({ id: row.id, status: "pending", generationId: "gen-it-1" });

    await fresh.update(row.id, { status: "completed", creditsDeducted: 42.5, creditsRemaining: 900 }, now + 2);
    expect(await fresh.findActiveForUser(u)).toBeNull();
    expect(await fresh.insertSubmitting({ userId: u, requestHash: "p2", requestedSlides: 13, now: now + 3 })).not.toBeNull();
    const undelivered = await fresh.findUndelivered(u, "p1", now - 1000);
    expect(undelivered).toMatchObject({ generationId: "gen-it-1", creditsDeducted: 42.5, delivered: false });
    await fresh.update(row.id, { delivered: true }, now + 4);
    expect(await fresh.findUndelivered(u, "p1", now - 1000)).toBeNull();
  });

  it("counts per-user starts and exposes spend rows with timestamps", async () => {
    const u = newUser();
    const a = (await store.insertSubmitting({ userId: u, requestHash: "k1", requestedSlides: 13, now }))!;
    await store.update(a.id, { status: "completed", creditsDeducted: 10 }, now);
    await store.insertSubmitting({ userId: u, requestHash: "k2", requestedSlides: 13, now });
    expect(await store.countStartedSince(u, now - 60_000)).toBe(2);
    expect(await store.countStartedSince(newUser(), now - 60_000)).toBe(0);
    const rows = await store.rowsSince(now - 60_000);
    expect(rows.some((r) => r.status === "completed" && r.creditsDeducted === 10 && typeof r.createdAt === "number")).toBe(true);
  });

  it("admission control reads the real ledger: budget and per-user limits reject BEFORE any paid call", async () => {
    const u = newUser();
    await expect(checkAdmission(store, testConfig({ dailyCreditBudget: 10, estimatedCreditsPerRun: 60 }), u, 13, Date.now())).rejects.toMatchObject({ code: "budget_exceeded" });
    await expect(checkAdmission(store, testConfig({ dailyCreditBudget: 1e9, monthlyCreditBudget: 1e9, estimatedCreditsPerRun: 1 }), u, 13, Date.now())).resolves.toBeUndefined();
    await store.insertSubmitting({ userId: u, requestHash: "l1", requestedSlides: 13, now: Date.now() });
    await expect(checkAdmission(store, testConfig({ userHourlyLimit: 1, dailyCreditBudget: 1e9, monthlyCreditBudget: 1e9, estimatedCreditsPerRun: 1 }), u, 13, Date.now())).rejects.toMatchObject({ code: "user_rate_limited" });
  });

  it("RLS blocks the anon role from reading the ledger", async () => {
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anon) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/gamma_generations?select=id&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    const body = await res.json();
    expect(Array.isArray(body) ? body : []).toHaveLength(0);
  });
});
