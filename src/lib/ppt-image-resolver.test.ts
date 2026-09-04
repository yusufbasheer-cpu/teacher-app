/**
 * Image-provider routing.
 *
 * The bug these cover: Fal failures were swallowed and three of the four slides that are
 * supposed to be Fal-generated quietly served a Pexels stock photo instead, so a failure was
 * indistinguishable from a success. Every external call here is mocked — the suite must never
 * make a paid Fal request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateLessonPptFluxImageDeduped = vi.fn();
const getFalPptCircuitOpenReason = vi.fn(() => null as string | null);
const fetchPexelsUniqueLandscapeUrl = vi.fn();
const getFalCredentials = vi.fn(() => "id:secret" as string | undefined);
const resolvePexelsApiKey = vi.fn(() => "pexels-key" as string | undefined);
const captureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }));
vi.mock("@/lib/fal-ppt-slide-images", () => ({
  generateLessonPptFluxImageDeduped: (...a: unknown[]) => generateLessonPptFluxImageDeduped(...a),
  getFalPptCircuitOpenReason: () => getFalPptCircuitOpenReason(),
}));
vi.mock("@/lib/pexels-images", () => ({
  fetchPexelsUniqueLandscapeUrl: (...a: unknown[]) => fetchPexelsUniqueLandscapeUrl(...a),
}));
vi.mock("@/lib/fal-flux-section-images", () => ({
  getFalCredentials: () => getFalCredentials(),
}));
vi.mock("@/lib/image-api-env", () => ({
  resolvePexelsApiKey: () => resolvePexelsApiKey(),
  logPexelsEnvStatus: () => undefined,
}));

const {
  generatePptDeckSlideImages,
  getDeckImageProviderPolicy,
  pexelsIsAllowedForDeckIndex,
  FAL_REQUIRED_DECK_INDICES,
} = await import("./ppt-image-resolver");

const META = { subject: "Science", grade: "Grade 5", topic: "The Water Cycle" };

/** The four slides the product requires to be Fal-generated. */
const REQUIRED = {
  starter: 1,
  differentiatedAndMiniPlenary: 6,
  uaeRealLifeCrossCurricular: 7,
  extendedTask: 9,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  getFalPptCircuitOpenReason.mockReturnValue(null);
  getFalCredentials.mockReturnValue("id:secret");
  resolvePexelsApiKey.mockReturnValue("pexels-key");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("provider policy", () => {
  it("marks exactly the four required slides as fal-required", () => {
    expect([...FAL_REQUIRED_DECK_INDICES].sort()).toEqual(
      Object.values(REQUIRED).slice().sort(),
    );
    for (const idx of Object.values(REQUIRED)) {
      expect(getDeckImageProviderPolicy(idx)).toBe("fal-required");
    }
  });

  it("never allows Pexels for a fal-required slide", () => {
    for (const idx of Object.values(REQUIRED)) {
      expect(pexelsIsAllowedForDeckIndex(idx)).toBe(false);
    }
  });

  it("still allows Pexels for the slides that were always stock-photo capable", () => {
    // Title slide and Plenary keep their previous fallback behaviour.
    expect(pexelsIsAllowedForDeckIndex(0)).toBe(true);
    expect(pexelsIsAllowedForDeckIndex(8)).toBe(true);
  });
});

describe("routing when fal succeeds", () => {
  it("routes every required slide to fal and puts the URL on the matching deck index", async () => {
    generateLessonPptFluxImageDeduped.mockImplementation((_meta, slot: string) =>
      Promise.resolve({ ok: true, url: `https://v3.fal.media/${slot}.png` }),
    );

    const { urls, diagnostics } = await generatePptDeckSlideImages(META);

    expect(fetchPexelsUniqueLandscapeUrl).not.toHaveBeenCalled();
    for (const idx of Object.values(REQUIRED)) {
      expect(urls[idx]).toMatch(/^https:\/\/v3\.fal\.media\//);
      const d = diagnostics.find((x) => x.deckIndex === idx);
      expect(d?.resolvedProvider).toBe("fal");
    }
  });

  it("passes each slide's own lesson content into its image prompt", async () => {
    generateLessonPptFluxImageDeduped.mockResolvedValue({ ok: true, url: "https://fal.media/a.png" });
    const slideContentByIndex = Array.from({ length: 13 }, (_, i) => `body for slide ${i + 1}`);

    await generatePptDeckSlideImages({ ...META, slideContentByIndex });

    const starterCall = generateLessonPptFluxImageDeduped.mock.calls.find(
      (c) => c[1] === "fallback_pexels_starter",
    );
    expect(starterCall?.[0]).toMatchObject({ lessonContentSnippet: "body for slide 2" });
  });
});

describe("routing when fal fails", () => {
  beforeEach(() => {
    generateLessonPptFluxImageDeduped.mockResolvedValue({
      ok: false,
      kind: "balance",
      reason: "fal account has no balance",
    });
    fetchPexelsUniqueLandscapeUrl.mockResolvedValue("https://images.pexels.com/stock.jpg");
  });

  it("leaves required slides imageless rather than substituting a Pexels photo", async () => {
    const { urls } = await generatePptDeckSlideImages(META);

    for (const idx of Object.values(REQUIRED)) {
      expect(urls[idx]).toBeNull();
    }
    // Whatever Pexels was asked for, it was never for a required slide.
    for (const call of fetchPexelsUniqueLandscapeUrl.mock.calls) {
      expect(call[2]?.slideNumber1Based).not.toBeUndefined();
      const idx = (call[2] as { slideNumber1Based: number }).slideNumber1Based - 1;
      expect(Object.values(REQUIRED)).not.toContain(idx);
    }
  });

  it("records the failure instead of reporting a silent success", async () => {
    const { diagnostics } = await generatePptDeckSlideImages(META);

    for (const idx of Object.values(REQUIRED)) {
      const d = diagnostics.find((x) => x.deckIndex === idx);
      expect(d?.resolvedProvider).toBe("none");
      expect(d?.falFailureKind).toBe("balance");
      expect(d?.falFailureReason).toContain("balance");
    }
    // One Sentry report per required slide — the fal-preferred ones must not raise.
    expect(captureException).toHaveBeenCalledTimes(Object.values(REQUIRED).length);
  });

  it("still lets fal-preferred slides fall back to Pexels", async () => {
    const { urls, diagnostics } = await generatePptDeckSlideImages(META);

    expect(urls[0]).toBe("https://images.pexels.com/stock.jpg");
    expect(diagnostics.find((d) => d.deckIndex === 0)?.resolvedProvider).toBe("pexels");
  });
});

describe("when fal is unavailable entirely", () => {
  it("classifies missing credentials without calling fal", async () => {
    getFalCredentials.mockReturnValue(undefined);
    fetchPexelsUniqueLandscapeUrl.mockResolvedValue(null);

    const { diagnostics, notices } = await generatePptDeckSlideImages(META);

    expect(generateLessonPptFluxImageDeduped).not.toHaveBeenCalled();
    expect(diagnostics.find((d) => d.deckIndex === REQUIRED.starter)?.falFailureKind).toBe(
      "not-configured",
    );
    expect(notices.join(" ")).toMatch(/not configured/i);
  });

  it("classifies an open circuit breaker", async () => {
    getFalPptCircuitOpenReason.mockReturnValue("fal account has no balance");
    fetchPexelsUniqueLandscapeUrl.mockResolvedValue(null);

    const { diagnostics } = await generatePptDeckSlideImages(META);

    expect(generateLessonPptFluxImageDeduped).not.toHaveBeenCalled();
    expect(diagnostics.find((d) => d.deckIndex === REQUIRED.extendedTask)?.falFailureKind).toBe(
      "circuit-open",
    );
  });
});

describe("deduplication", () => {
  it("reserves each URL as it resolves so a later concurrent slot can see it", async () => {
    // Staggered so the calls genuinely finish at different times — with an instantly-resolving
    // mock every callback would snapshot before any of them resolved, and the test would pass
    // or fail on microtask ordering rather than on the behaviour being checked.
    let order = 0;
    const seenBySlot = new Map<string, number>();
    generateLessonPptFluxImageDeduped.mockImplementation(
      async (_meta, slot: string, used: Set<string>) => {
        const delay = order++;
        await new Promise((r) => setTimeout(r, delay));
        seenBySlot.set(slot, used.size);
        return { ok: true, url: `https://fal.media/${slot}.png` };
      },
    );

    await generatePptDeckSlideImages(META);

    // Before the fix the shared set was only filled after Promise.all resolved, so every call
    // saw an empty set and dedup could never fire. The last slot to finish must see the
    // reservations made by the ones before it.
    const sizes = [...seenBySlot.values()];
    expect(Math.max(...sizes)).toBeGreaterThan(0);
  });
});
