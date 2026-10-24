import { describe, expect, it } from "vitest";
import { defaultProviderFor, gammaGate, getGammaConfig, GammaError, resolvePptProvider } from "./config";

// Finding 4 — production protection / provider selection.
const staging = {
  GAMMA_EXPERIMENT_ENABLED: "true",
  GAMMA_ENVIRONMENT_NAME: "staging",
  GAMMA_ALLOWED_ENVIRONMENTS: "staging, preview-gamma",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref123456789.supabase.co",
  GAMMA_ALLOWED_SUPABASE_REFS: "stagingref123456789",
  GAMMA_TESTER_EMAILS: "T@x.com, b@x.com",
};

describe("open to every signed-in user (staging: GAMMA_TESTER_EMAILS=*)", () => {
  const open = { ...staging, GAMMA_TESTER_EMAILS: "*" };
  it("allows any signed-in user", () => {
    expect(gammaGate("anyone@school.ae", open)).toEqual({ available: true, reason: "authorized" });
  });
  it("still needs a signed-in user and every environment and database check", () => {
    expect(gammaGate(null, open).available).toBe(false);
    expect(gammaGate("anyone@school.ae", { ...open, VERCEL_ENV: "production" }).reason).toBe("production-environment");
    expect(gammaGate("anyone@school.ae", { ...open, GAMMA_ALLOWED_SUPABASE_REFS: "other" }).reason).toBe("database-not-allowlisted");
    expect(gammaGate("anyone@school.ae", { ...open, NEXT_PUBLIC_SUPABASE_URL: "https://jbwevzvtloahjoamwnjt.supabase.co", GAMMA_ALLOWED_SUPABASE_REFS: "jbwevzvtloahjoamwnjt" }).reason).toBe("production-database");
  });
});

describe("gammaGate fails closed", () => {
  it("is disabled by default", () => {
    expect(gammaGate("t@x.com", {}).available).toBe(false);
    expect(resolvePptProvider({ requested: "gamma", email: "t@x.com" }, {}).provider).toBe("legacy");
  });
  it("is disabled when the server does not name its environment (unknown identity)", () => {
    expect(gammaGate("t@x.com", { ...staging, GAMMA_ENVIRONMENT_NAME: undefined })).toEqual({ available: false, reason: "environment-identity-unknown" });
  });
  it("is disabled when the environment is not allowlisted", () => {
    expect(gammaGate("t@x.com", { ...staging, GAMMA_ENVIRONMENT_NAME: "qa" }).reason).toBe("environment-not-allowlisted");
  });
  it.each(["production", "PROD", "live"])("never runs in an environment named %s, even if allowlisted", (name) => {
    const env = { ...staging, GAMMA_ENVIRONMENT_NAME: name, GAMMA_ALLOWED_ENVIRONMENTS: name };
    expect(gammaGate("t@x.com", env)).toEqual({ available: false, reason: "production-environment" });
  });
  it("is disabled on Vercel production even when the name says staging", () => {
    expect(gammaGate("t@x.com", { ...staging, VERCEL_ENV: "production" }).reason).toBe("production-environment");
  });
  it("refuses the PRODUCTION database even if someone allowlists it", () => {
    const env = { ...staging, NEXT_PUBLIC_SUPABASE_URL: "https://jbwevzvtloahjoamwnjt.supabase.co", GAMMA_ALLOWED_SUPABASE_REFS: "jbwevzvtloahjoamwnjt" };
    expect(gammaGate("t@x.com", env)).toEqual({ available: false, reason: "production-database" });
    expect(resolvePptProvider({ requested: "gamma", email: "t@x.com" }, env).provider).toBe("legacy");
  });
  it("fails closed when the database is unknown or not allowlisted", () => {
    expect(gammaGate("t@x.com", { ...staging, NEXT_PUBLIC_SUPABASE_URL: "" }).reason).toBe("database-not-allowlisted");
    expect(gammaGate("t@x.com", { ...staging, NEXT_PUBLIC_SUPABASE_URL: "https://otherproject00000000.supabase.co" }).reason).toBe("database-not-allowlisted");
    expect(gammaGate("t@x.com", { ...staging, GAMMA_ALLOWED_SUPABASE_REFS: "" }).reason).toBe("database-not-allowlisted");
  });
  it("requires an allowlisted tester email (case-insensitive)", () => {
    expect(gammaGate("other@x.com", staging).reason).toBe("not-an-authorized-tester");
    expect(gammaGate(null, staging).available).toBe(false);
    expect(gammaGate("t@x.com", staging).available).toBe(true);
  });
  it("requires the experiment flag to be exactly 'true'", () => {
    expect(gammaGate("t@x.com", { ...staging, GAMMA_EXPERIMENT_ENABLED: "1" }).available).toBe(false);
  });
});

describe("provider selection", () => {
  it("defaults to legacy", () => {
    expect(resolvePptProvider({ email: "t@x.com" }, staging).provider).toBe("legacy");
    expect(defaultProviderFor("t@x.com", staging)).toBe("legacy");
  });
  it("lets an authorised tester pick gamma, and always lets them pick legacy", () => {
    expect(resolvePptProvider({ requested: "gamma", email: "t@x.com" }, staging).provider).toBe("gamma");
    expect(resolvePptProvider({ requested: "legacy", email: "t@x.com" }, { ...staging, PPT_GENERATION_PROVIDER: "gamma" })).toMatchObject({ provider: "legacy", reason: "legacy-selected" });
  });
  it("follows the server default (gamma) for an authorised tester who expresses no choice", () => {
    const env = { ...staging, PPT_GENERATION_PROVIDER: "gamma" };
    expect(resolvePptProvider({ email: "b@x.com" }, env).provider).toBe("gamma");
    expect(defaultProviderFor("b@x.com", env)).toBe("gamma");
  });
  it("a server default of gamma is ignored for everyone the gate rejects", () => {
    const env = { ...staging, PPT_GENERATION_PROVIDER: "gamma" };
    expect(resolvePptProvider({ email: "nobody@x.com" }, env).provider).toBe("legacy");
    expect(defaultProviderFor("nobody@x.com", env)).toBe("legacy");
    expect(resolvePptProvider({ email: "t@x.com" }, { ...env, GAMMA_ENVIRONMENT_NAME: "production" }).provider).toBe("legacy");
  });
  it("the client cannot widen access: junk values are ignored", () => {
    expect(resolvePptProvider({ requested: { toString: () => "gamma" }, email: "nobody@x.com" }, staging).provider).toBe("legacy");
    expect(resolvePptProvider({ requested: "GAMMA", email: "t@x.com" }, staging).provider).toBe("legacy");
  });
});

describe("config preflight (before any paid call)", () => {
  const key = { GAMMA_API_KEY: "k" };
  it("requires the API key, and legacy never needs it", () => {
    expect(() => getGammaConfig({})).toThrowError(/GAMMA_API_KEY/);
    expect(() => resolvePptProvider({ email: "t@x.com" }, {})).not.toThrow();
  });
  it("has NO default export-host allowlist (Gamma documents none) and refuses to start without one", () => {
    try {
      getGammaConfig(key);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as GammaError).code).toBe("export_host_unconfigured");
    }
    expect(getGammaConfig({ ...key, GAMMA_EXPORT_HOST_ALLOWLIST: "A.example, *.b.example" }).exportHosts).toEqual(["a.example", "*.b.example"]);
  });
  it("keeps the overall budget below the 180s route limit by default", () => {
    const c = getGammaConfig({ ...key, GAMMA_EXPORT_HOST_ALLOWLIST: "a.example" });
    expect(c.overallBudgetMs).toBeLessThan(180_000);
    expect(c.requestTimeoutMs).toBeLessThan(c.pollTimeoutMs);
    expect(c.pollTimeoutMs).toBeLessThanOrEqual(c.overallBudgetMs);
  });
});
