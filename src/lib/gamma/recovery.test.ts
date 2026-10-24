import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GammaConfig } from "./config";
import { GammaError } from "./config";
import { renderPptxWithGamma } from "./render";
import { InMemoryGammaStore, type GammaStore } from "./store";
import { EXPORT_HOST, fakeClock, fakeGamma, makeDeck, pptxFrom, publicResolver, sourceLines, testConfig, type FakeGammaOpts } from "./test-helpers";

let pptx: Buffer;
let changed: Buffer;
beforeEach(async () => {
  pptx = await pptxFrom(sourceLines(), 11);
  changed = await pptxFrom(sourceLines().map((l) => l.map((x) => x.replace("12.5", "13.5"))));
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function harness(opts: Partial<FakeGammaOpts> = {}, cfg: Partial<GammaConfig> = {}) {
  const clock = fakeClock();
  const store = new InMemoryGammaStore();
  const gamma = fakeGamma({ pptx, ...opts });
  const config = testConfig(cfg);
  const run = (over: { deck?: ReturnType<typeof makeDeck>; userId?: string; config?: GammaConfig; store?: GammaStore } = {}) =>
    renderPptxWithGamma(
      { deck: over.deck ?? makeDeck(), title: "t", language: "en", userId: over.userId ?? "u1", config: over.config ?? config, store: over.store ?? store, startedAt: clock.now() },
      { fetchImpl: gamma.fetchImpl, now: clock.now, sleep: clock.sleep, resolveHost: publicResolver },
    );
  return { clock, store, gamma, config, run };
}

describe("finding 1 — polling timeout never releases the lock; the next request RESUMES", () => {
  it("times out, keeps the generation id, then resumes with NO second submission and records credits", async () => {
    const h = harness({ pendingPolls: 10_000, credits: 55 });
    await expect(h.run()).rejects.toMatchObject({ code: "poll_timeout" });
    expect(h.gamma.state.posts).toBe(1);
    expect(h.store.rows).toHaveLength(1);
    expect(h.store.rows[0]).toMatchObject({ status: "pending", generationId: "gen-1", delivered: false });
  expect(h.store.rows[0].sourceSnapshot).toHaveLength(13);

    h.gamma.state.pendingPolls = 0; // Gamma finished in the meantime
    h.clock.advance(60_000);
    const r = await h.run();
    expect(h.gamma.state.posts).toBe(1); // still exactly one paid submission
    expect(r.metrics).toMatchObject({ resumed: true, outcome: "success", validation: "passed", creditsDeducted: 55, generationId: "gen-1" });
    expect(h.store.rows).toHaveLength(1);
    expect(h.store.rows[0]).toMatchObject({ status: "completed", creditsDeducted: 55, delivered: true });
  });
  it("while the first generation is still pending, an immediate retry resumes polling instead of resubmitting", async () => {
    const h = harness({ pendingPolls: 10_000 });
    await expect(h.run()).rejects.toMatchObject({ code: "poll_timeout" });
    await expect(h.run()).rejects.toMatchObject({ code: "poll_timeout" });
    expect(h.gamma.state.posts).toBe(1);
  });
  it("a DIFFERENT presentation is blocked while one is still running (generation_in_progress)", async () => {
    const h = harness({ pendingPolls: 10_000 });
    await expect(h.run()).rejects.toMatchObject({ code: "poll_timeout" });
    await expect(h.run({ deck: makeDeck(13, " other") })).rejects.toMatchObject({ code: "generation_in_progress" });
    expect(h.gamma.state.posts).toBe(1);
  });
  it("a pending row older than staleActiveMs is abandoned (credits stay reserved) and a new run is allowed", async () => {
    const h = harness({ pendingPolls: 10_000 });
    await expect(h.run()).rejects.toMatchObject({ code: "poll_timeout" });
    h.clock.advance(h.config.staleActiveMs + 1);
    h.gamma.state.pendingPolls = 10_000;
    await expect(h.run()).rejects.toMatchObject({ code: "poll_timeout" }); // new submission, polls pending again
    expect(h.gamma.state.posts).toBe(2);
    expect(h.store.rows.map((r) => r.status)).toEqual(["abandoned", "pending"]);
  });
  it("a generation that Gamma reports failed is recorded, and a later retry is a new submission", async () => {
    const h = harness();
    const original = h.gamma.fetchImpl;
    let failNext = true;
    const fetchImpl = (async (u: string | URL | Request, init?: RequestInit) => {
      if (failNext && String(u).includes("/generations/")) {
        failNext = false;
        return new Response(JSON.stringify({ status: "failed", error: { message: "render crashed" }, credits: { deducted: 7 } }), { status: 200 });
      }
      return original(u, init);
    }) as unknown as typeof fetch;
    const run = () => renderPptxWithGamma({ deck: makeDeck(), title: "t", language: "en", userId: "u1", config: h.config, store: h.store, startedAt: h.clock.now() }, { fetchImpl, now: h.clock.now, sleep: h.clock.sleep, resolveHost: publicResolver });
    await expect(run()).rejects.toMatchObject({ code: "generation_failed" });
    expect(h.store.rows[0]).toMatchObject({ status: "failed", creditsDeducted: 7 });
    await expect(run()).resolves.toBeTruthy();
    expect(h.gamma.state.posts).toBe(2);
  });
});

describe("finding 1 — unknown submission outcome cannot trigger another paid generation", () => {
  it.each(["stall", "http500", "noid"] as const)("create=%s ⇒ row 'unknown'; immediate retry is refused without any POST", async (create) => {
    const h = harness({ create });
    await expect(h.run()).rejects.toMatchObject({ code: "submission_unknown" });
    expect(h.store.rows[0]).toMatchObject({ status: "unknown", generationId: null });
    expect(h.gamma.state.posts).toBe(1);

    h.gamma.state.opts.create = "ok";
    await expect(h.run()).rejects.toMatchObject({ code: "submission_unknown" });
    await expect(h.run({ deck: makeDeck(13, " different") })).rejects.toMatchObject({ code: "submission_unknown" });
    expect(h.gamma.state.posts).toBe(1); // never re-submitted
  });
  it("after the quarantine the row is written off as 'abandoned' and the user may submit again", async () => {
    const h = harness({ create: "stall" });
    await expect(h.run()).rejects.toMatchObject({ code: "submission_unknown" });
    h.gamma.state.opts.create = "ok";
    h.clock.advance(h.config.unknownQuarantineMs + 1);
    await expect(h.run()).resolves.toBeTruthy();
    expect(h.gamma.state.posts).toBe(2);
    expect(h.store.rows[0].status).toBe("abandoned");
  });
  it("an abandoned/unknown row keeps its credits RESERVED in the budget", async () => {
    const h = harness({ create: "stall" }, { dailyCreditBudget: 100, estimatedCreditsPerRun: 60 });
    await expect(h.run()).rejects.toMatchObject({ code: "submission_unknown" });
    h.clock.advance(h.config.unknownQuarantineMs + 1);
    h.gamma.state.opts.create = "ok";
    // reserved 60 (unknown row) + 60 (this run) > 100
    await expect(h.run()).rejects.toMatchObject({ code: "budget_exceeded" });
    expect(h.gamma.state.posts).toBe(1);
  });
  it("a definite failure (402) frees the lock; the next attempt is a normal new submission", async () => {
    const h = harness({ create: "http402" });
    await expect(h.run()).rejects.toMatchObject({ code: "insufficient_credits" });
    expect(h.store.rows[0].status).toBe("failed");
    h.gamma.state.opts.create = "ok";
    await expect(h.run()).resolves.toBeTruthy();
    expect(h.gamma.state.posts).toBe(2);
  });
  it("an interrupted create (client aborts) is also 'unknown', never a free retry", async () => {
    const h = harness();
    const fetchImpl = vi.fn(async () => { throw new TypeError("socket hang up"); }) as unknown as typeof fetch;
    await expect(renderPptxWithGamma({ deck: makeDeck(), title: "t", language: "en", userId: "u1", config: h.config, store: h.store }, { fetchImpl, resolveHost: publicResolver })).rejects.toMatchObject({ code: "submission_unknown" });
    expect(h.store.rows[0].status).toBe("unknown");
  });
});

describe("finding 1/2 — completed-but-undelivered generations are resumable at no cost", () => {
  it("download rejected (host not allowlisted) leaves the paid row completed; fixing the allowlist retrieves it with NO new POST", async () => {
    const h = harness({ exportHost: "assets.unverified.example", credits: 55 });
    const err = await h.run().catch((e) => e);
    expect(err).toBeInstanceOf(GammaError);
    expect(err.code).toBe("download_rejected");
    expect(err.message).toContain("assets.unverified.example");
    expect(h.store.rows[0]).toMatchObject({ status: "completed", delivered: false, creditsDeducted: 55 });

    const fixed = testConfig({ exportHosts: ["assets.unverified.example"] });
    const r = await h.run({ config: fixed });
    expect(h.gamma.state.posts).toBe(1);
    expect(r.metrics).toMatchObject({ resumed: true, outcome: "success" });
    expect(h.store.rows[0].delivered).toBe(true);
  });
  it("a corrupt download is retried for free on the next request", async () => {
    const h = harness({ pptx: Buffer.from("<html>not a zip</html>") });
    await expect(h.run()).rejects.toMatchObject({ code: "invalid_export" });
    h.gamma.state.opts.pptx = pptx;
    await expect(h.run()).resolves.toBeTruthy();
    expect(h.gamma.state.posts).toBe(1);
  });
  it("credits are written to the ledger even when the file is never delivered", async () => {
    const h = harness({ exportHost: "nope.example", credits: 41 });
    await expect(h.run()).rejects.toMatchObject({ code: "download_rejected" });
    expect(h.store.rows[0].creditsDeducted).toBe(41);
  });
});

describe("finding 5 — concurrency, per-user limits and budgets (all from the persistent ledger)", () => {
  it("two concurrent identical requests: exactly one POST, the other is rejected", async () => {
    let open = () => {};
    const gate = new Promise<void>((r) => (open = r));
    const h = harness({ gate });
    const a = h.run();
    const b = h.run();
    await expect(b).rejects.toMatchObject({ code: expect.stringMatching(/duplicate_in_flight|generation_in_progress|submission_unknown/) });
    open();
    await expect(a).resolves.toBeTruthy();
    expect(h.gamma.state.posts).toBe(1);
  });
  it("two concurrent DIFFERENT presentations from one user: exactly one POST", async () => {
    let open = () => {};
    const gate = new Promise<void>((r) => (open = r));
    const h = harness({ gate });
    const results = Promise.allSettled([h.run(), h.run({ deck: makeDeck(13, " B") })]);
    open();
    const [x, y] = await results;
    expect([x.status, y.status].sort()).toEqual(["fulfilled", "rejected"]);
    expect(h.gamma.state.posts).toBe(1);
  });
  it("different users do not block each other", async () => {
    const h = harness();
    await Promise.all([h.run({ userId: "a" }), h.run({ userId: "b" })]);
    expect(h.gamma.state.posts).toBe(2);
  });
  it("hourly and daily per-user limits are enforced before any paid call", async () => {
    const h = harness({}, { userHourlyLimit: 2, userDailyLimit: 3 });
    await h.run();
    await h.run();
    await expect(h.run()).rejects.toMatchObject({ code: "user_rate_limited" });
    expect(h.gamma.state.posts).toBe(2);
    h.clock.advance(61 * 60_000); // hour window passes, day window does not
    await h.run();
    await expect(h.run()).rejects.toMatchObject({ code: "user_rate_limited" });
    expect(h.gamma.state.posts).toBe(3);
  });
  it("daily credit budget: settled spend + this run's estimate must fit", async () => {
    const h = harness({ credits: 55 }, { dailyCreditBudget: 100, estimatedCreditsPerRun: 40 });
    await h.run(); // 0 + 40 <= 100; settles at 55
    await h.run(); // 55 + 40 = 95 <= 100; settles at 110
    await expect(h.run()).rejects.toMatchObject({ code: "budget_exceeded" }); // 110 + 40 > 100
    expect(h.gamma.state.posts).toBe(2);
  });
  it("monthly budget is enforced independently of the daily one, and old spend ages out of the daily window", async () => {
    const h = harness({ credits: 80 }, { dailyCreditBudget: 100, monthlyCreditBudget: 150, estimatedCreditsPerRun: 60 });
    await h.run(); // 60 <= 100 and <= 150; settles at 80
    h.clock.advance(25 * 60 * 60_000); // outside the 24h window, inside the 30d window
    await h.run(); // daily 0 + 60 ok; monthly 80 + 60 = 140 <= 150; settles at 160
    h.clock.advance(25 * 60 * 60_000);
    await expect(h.run()).rejects.toMatchObject({ code: "budget_exceeded" }); // monthly 160 + 60 > 150
    expect(h.gamma.state.posts).toBe(2);
  });
  it("in-flight runs are charged conservatively at the estimate", async () => {
    const h = harness({ pendingPolls: 10_000 }, { dailyCreditBudget: 100, estimatedCreditsPerRun: 60 });
    await expect(h.run()).rejects.toMatchObject({ code: "poll_timeout" });
    h.store.rows[0].status = "completed"; // simulate it finishing without a credits figure (unknown cost)
    h.store.rows[0].delivered = true;
    await expect(h.run({ deck: makeDeck(13, " B") })).rejects.toMatchObject({ code: "budget_exceeded" });
  });
  it("rejects oversized decks", async () => {
    const h = harness({}, { maxCardsPerRun: 5 });
    await expect(h.run()).rejects.toMatchObject({ code: "budget_exceeded" });
    expect(h.gamma.state.posts).toBe(0);
  });
  it("FAILS CLOSED when the ledger is unavailable: no paid call, clear error", async () => {
    const h = harness();
    const broken: GammaStore = {
      insertSubmitting: async () => { throw new GammaError("store_unavailable", "down"); },
      update: async () => { throw new GammaError("store_unavailable", "down"); },
      findActiveForUser: async () => { throw new GammaError("store_unavailable", "down"); },
      findUndelivered: async () => { throw new GammaError("store_unavailable", "down"); },
      countStartedSince: async () => { throw new GammaError("store_unavailable", "down"); },
      rowsSince: async () => { throw new GammaError("store_unavailable", "down"); },
    };
    await expect(h.run({ store: broken })).rejects.toMatchObject({ code: "store_unavailable" });
    expect(h.gamma.state.posts).toBe(0);
  });
  it("fails closed if the ledger write after the paid call's id is lost: the error propagates and nothing re-submits", async () => {
    const h = harness();
    const flaky = new InMemoryGammaStore();
    const upd = flaky.update.bind(flaky);
    flaky.update = async (id, patch, now) => {
      if (patch.generationId) throw new GammaError("store_unavailable", "write failed");
      return upd(id, patch, now);
    };
    await expect(h.run({ store: flaky })).rejects.toMatchObject({ code: "store_unavailable" });
    expect(h.gamma.state.posts).toBe(1);
    // the row is still 'submitting' => treated as unknown outcome, so no second paid submission is possible
    await expect(h.run({ store: flaky })).rejects.toMatchObject({ code: "submission_unknown" });
    expect(h.gamma.state.posts).toBe(1);
  });
});

describe("logging hygiene and validation pass-through", () => {
  it("logs metrics only: no API key, signed URL, slide text, or request body", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const h = harness();
    await h.run();
    const text = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(text).toContain("[gamma-ppt]");
    expect(text).not.toMatch(/test-key-123|SECRET-SIG|Point A0|files\.gamma-test/);
    expect(JSON.parse(text.split("[gamma-ppt] ")[1])).toMatchObject({ provider: "gamma", requestedSlides: 13, actualSlides: 13, creditsDeducted: 55, creditsDeductedTotal: 55, validation: "passed", resumed: false });
  });
  it("returns (does not hide) a deck whose content changed, verdict failed", async () => {
    const h = harness({ pptx: changed });
    const r = await h.run();
    expect(r.metrics.validation).toBe("failed");
    expect(r.validation.numbers.unexpected).toContain("13.5");
    expect(EXPORT_HOST).toBeTruthy();
  });
});
