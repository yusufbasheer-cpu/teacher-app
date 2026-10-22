import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldSkipLegacyPptImages } from "./legacy-images";

// Step 9: Gamma mode must not pay for legacy fal.ai/Pexels deck images, without affecting anyone else.
const staging = {
  GAMMA_EXPERIMENT_ENABLED: "true",
  GAMMA_ENVIRONMENT_NAME: "staging",
  GAMMA_ALLOWED_ENVIRONMENTS: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref123456789.supabase.co",
  GAMMA_ALLOWED_SUPABASE_REFS: "stagingref123456789",
  GAMMA_TESTER_EMAILS: "tester@x.com",
  PPT_GENERATION_PROVIDER: "gamma",
};

describe("shouldSkipLegacyPptImages", () => {
  it("skips only for an authorised tester when the server default is gamma", () => {
    expect(shouldSkipLegacyPptImages("tester@x.com", staging)).toBe(true);
  });
  it("never skips by default (legacy keeps generating images)", () => {
    expect(shouldSkipLegacyPptImages("tester@x.com", {})).toBe(false);
    expect(shouldSkipLegacyPptImages("tester@x.com", { ...staging, PPT_GENERATION_PROVIDER: "legacy" })).toBe(false);
  });
  it("never skips for users the gate rejects, or when identity/environment is unsafe", () => {
    expect(shouldSkipLegacyPptImages("someone@x.com", staging)).toBe(false);
    expect(shouldSkipLegacyPptImages(null, staging)).toBe(false);
    expect(shouldSkipLegacyPptImages("tester@x.com", { ...staging, GAMMA_ENVIRONMENT_NAME: "production" })).toBe(false);
    expect(shouldSkipLegacyPptImages("tester@x.com", { ...staging, GAMMA_ENVIRONMENT_NAME: "" })).toBe(false);
    expect(shouldSkipLegacyPptImages("tester@x.com", { ...staging, GAMMA_EXPERIMENT_ENABLED: "false" })).toBe(false);
    expect(shouldSkipLegacyPptImages("tester@x.com", { ...staging, VERCEL_ENV: "production" })).toBe(false);
    expect(shouldSkipLegacyPptImages("tester@x.com", { ...staging, NEXT_PUBLIC_SUPABASE_URL: "https://jbwevzvtloahjoamwnjt.supabase.co" })).toBe(false);
  });
});

describe("lesson-plan route wiring guard", () => {
  // The route is not unit-testable in isolation (large, entitlement/DeepSeek-coupled), so guard the wiring textually.
  const src = readFileSync(new URL("../../app/api/lesson-plan/route.ts", import.meta.url), "utf8");
  it("passes the flag at BOTH call sites and only gates the PPT deck images", () => {
    expect(src.match(/runFluxAndBuildResponsePayload\(input, sections, mergedPlan, parseNotices, sourceMaterial, skipPptDeckImages\)/g)).toHaveLength(2);
    expect(src).toContain('if (sections.includes("PPT Slide Content") && !skipPptDeckImages)');
    expect(src).toContain("const skipPptDeckImages = shouldSkipLegacyPptImages(auth.email);");
    // section images (other features) are not gated
    expect(src).toMatch(/generateFluxSectionImages\(\{\s*input,\s*plan: workingPlan,\s*sections,\s*\}\)/);
  });
});
