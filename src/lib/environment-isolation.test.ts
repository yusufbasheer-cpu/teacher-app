import { afterEach, describe, expect, it, vi } from "vitest";

const createMiddlewareSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-ssr", () => ({ createMiddlewareSupabaseClient }));

import { NextRequest } from "next/server";
import { GET as environmentCheck } from "@/app/api/environment-check/route";
import { proxy } from "@/proxy";
import { checkEnvironmentIsolation, isIsolatedEnvironment, isolationBlocksOperation, jwtProjectRef } from "./environment-isolation";
import { getSupabaseServiceRole } from "./supabase-admin";

const PROD = "jbwevzvtloahjoamwnjt";
const STG = "stagingref123456789";
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** Unsigned stand-in with the same shape as a Supabase legacy key (only the `ref` claim is read). */
const jwt = (ref: string, role = "anon") => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase", ref, role })}.sig`;

const isolatedOk = {
  GAMMA_ENVIRONMENT_NAME: "staging",
  GAMMA_ALLOWED_SUPABASE_REFS: STG,
  NEXT_PUBLIC_SUPABASE_URL: `https://${STG}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(STG),
  SUPABASE_SERVICE_ROLE_KEY: jwt(STG, "service_role"),
  RAZORPAY_KEY_ID: "disabled-on-gamma-experiment",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("checkEnvironmentIsolation", () => {
  it("is a complete no-op outside an isolated environment (production and ordinary previews)", () => {
    const prodLike = { NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: jwt(PROD, "service_role"), RAZORPAY_KEY_ID: "rzp_live_abc" };
    for (const env of [prodLike, { ...prodLike, GAMMA_ENVIRONMENT_NAME: "production" }, { ...prodLike, GAMMA_ENVIRONMENT_NAME: "" }, {}]) {
      expect(isIsolatedEnvironment(env)).toBe(false);
      expect(isolationBlocksOperation(env)).toBe(false);
      expect(checkEnvironmentIsolation(env).ok).toBe(true);
    }
  });
  it("passes when URL, anon key and service key all belong to the allowlisted staging project", () => {
    const r = checkEnvironmentIsolation(isolatedOk);
    expect(r).toMatchObject({ isolated: true, ok: true, supabaseRef: STG, anonKeyMatchesProject: true, serviceKeyMatchesProject: true, liveRazorpayKeyPresent: false, violations: [] });
  });
  it("blocks the production URL, even if allowlisted", () => {
    const r = checkEnvironmentIsolation({ ...isolatedOk, NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, GAMMA_ALLOWED_SUPABASE_REFS: PROD });
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("supabase-url-is-production");
  });
  it("blocks a URL that is missing, unrecognised or not allowlisted", () => {
    expect(checkEnvironmentIsolation({ ...isolatedOk, NEXT_PUBLIC_SUPABASE_URL: "" }).violations).toContain("supabase-url-missing-or-unrecognised");
    expect(checkEnvironmentIsolation({ ...isolatedOk, NEXT_PUBLIC_SUPABASE_URL: "https://otherproject00000000.supabase.co" }).violations).toContain("supabase-url-not-allowlisted");
    expect(checkEnvironmentIsolation({ ...isolatedOk, GAMMA_ALLOWED_SUPABASE_REFS: "" }).violations).toContain("supabase-url-not-allowlisted");
  });
  it("catches a PRODUCTION service-role key hiding behind a staging URL (the override-precedence failure)", () => {
    const r = checkEnvironmentIsolation({ ...isolatedOk, SUPABASE_SERVICE_ROLE_KEY: jwt(PROD, "service_role") });
    expect(r.ok).toBe(false);
    expect(r.violations).toEqual(["service-role-key-is-production"]);
    expect(r.serviceKeyMatchesProject).toBe(false);
  });
  it("catches a production anon key, and keys it cannot verify (non-JWT, garbage)", () => {
    expect(checkEnvironmentIsolation({ ...isolatedOk, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(PROD) }).violations).toContain("anon-key-is-production");
    expect(checkEnvironmentIsolation({ ...isolatedOk, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xyz" }).violations).toContain("anon-key-not-verifiably-this-project");
    expect(checkEnvironmentIsolation({ ...isolatedOk, SUPABASE_SERVICE_ROLE_KEY: "a.b.c" }).violations).toContain("service-role-key-not-verifiably-this-project");
  });
  it("a missing service-role key is allowed (features degrade) but a mismatched one is not", () => {
    expect(checkEnvironmentIsolation({ ...isolatedOk, SUPABASE_SERVICE_ROLE_KEY: undefined }).ok).toBe(true);
    expect(checkEnvironmentIsolation({ ...isolatedOk, SUPABASE_SERVICE_ROLE_KEY: jwt("someotherproject0000", "service_role") }).ok).toBe(false);
  });
  it("blocks any live Razorpay key, server or public", () => {
    expect(checkEnvironmentIsolation({ ...isolatedOk, RAZORPAY_KEY_ID: "rzp_live_abc123" }).violations).toContain("live-razorpay-key-present");
    expect(checkEnvironmentIsolation({ ...isolatedOk, NEXT_PUBLIC_RAZORPAY_KEY_ID: "RZP_LIVE_abc123" }).violations).toContain("live-razorpay-key-present");
    expect(checkEnvironmentIsolation({ ...isolatedOk, RAZORPAY_KEY_ID: "rzp_test_abc123" }).ok).toBe(true);
  });
  it("never includes secret values in its report", () => {
    const key = jwt(PROD, "service_role");
    const out = JSON.stringify(checkEnvironmentIsolation({ ...isolatedOk, SUPABASE_SERVICE_ROLE_KEY: key, RAZORPAY_KEY_ID: "rzp_live_SECRETVALUE" }));
    expect(out).not.toContain(key);
    expect(out).not.toContain("SECRETVALUE");
  });
  it("jwtProjectRef decodes only the ref claim", () => {
    expect(jwtProjectRef(jwt(STG))).toBe(STG);
    expect(jwtProjectRef("not-a-jwt")).toBeUndefined();
    expect(jwtProjectRef(undefined)).toBeUndefined();
  });
});

describe("proxy: application-wide fail-closed", () => {
  const req = (path: string) => new NextRequest(`https://preview.example${path}`);
  const stubEnv = (env: Record<string, string>) => Object.entries(env).forEach(([k, v]) => vi.stubEnv(k, v));

  it("refuses EVERY page and API request with 503 when an isolated environment is mis-pointed, without touching Supabase", async () => {
    stubEnv({ ...isolatedOk, SUPABASE_SERVICE_ROLE_KEY: jwt(PROD, "service_role") });
    for (const path of ["/", "/dashboard", "/api/lesson-plan", "/api/razorpay/create-order", "/auth/callback?code=x"]) {
      const res = await proxy(req(path));
      expect(res.status, path).toBe(503);
      expect(await res.json()).toMatchObject({ reasons: ["service-role-key-is-production"] });
    }
    expect(createMiddlewareSupabaseClient).not.toHaveBeenCalled();
  });
  it("keeps the diagnostic route reachable so the failure can be inspected", async () => {
    stubEnv({ ...isolatedOk, NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` });
    createMiddlewareSupabaseClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    const res = await proxy(req("/api/environment-check"));
    expect(res.status).not.toBe(503);
  });
  it("does nothing special for a correctly isolated environment or for production", async () => {
    createMiddlewareSupabaseClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    stubEnv(isolatedOk);
    expect((await proxy(req("/dashboard"))).status).not.toBe(503);
    vi.unstubAllEnvs();
    stubEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: jwt(PROD, "service_role"), RAZORPAY_KEY_ID: "rzp_live_abc" });
    expect((await proxy(req("/dashboard"))).status).not.toBe(503);
  });
  it("redirects blocked pages and returns a JSON 404 for blocked APIs only in isolation", async () => {
    stubEnv(isolatedOk);
    const page = await proxy(req("/pricing"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("https://preview.example/lesson-plan?unavailable=experimental-preview");
    const api = await proxy(req("/api/razorpay/create-order"));
    expect(api.status).toBe(404);
    expect(await api.json()).toMatchObject({ code: "experiment_feature_locked" });

    vi.unstubAllEnvs();
    createMiddlewareSupabaseClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    expect((await proxy(req("/pricing"))).status).not.toBe(307);
  });
});

describe("credential clients refuse inside a violating isolated environment (defence in depth)", () => {
  it("getSupabaseServiceRole returns null when isolation fails, a client when it passes, and works as before in production", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${STG}.supabase.co`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", jwt(STG, "service_role"));
    expect(getSupabaseServiceRole()).not.toBeNull(); // not isolated
    Object.entries(isolatedOk).forEach(([k, v]) => vi.stubEnv(k, v));
    expect(getSupabaseServiceRole()).not.toBeNull(); // isolated + ok
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", jwt(PROD, "service_role"));
    expect(getSupabaseServiceRole()).toBeNull(); // isolated + violating
  });
  it("getRazorpayClient stays null for a live key in an isolated environment", async () => {
    vi.resetModules();
    Object.entries({ ...isolatedOk, RAZORPAY_KEY_ID: "rzp_live_abc", RAZORPAY_KEY_SECRET: "secret" }).forEach(([k, v]) => vi.stubEnv(k, v));
    const { getRazorpayClient } = await import("./razorpay");
    expect(getRazorpayClient()).toBeNull();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_abc");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    const prod = await import("./razorpay");
    expect(prod.getRazorpayClient()).not.toBeNull(); // production behaviour unchanged
  });
});

describe("GET /api/environment-check", () => {
  const get = (url = "https://preview.example/api/environment-check") => environmentCheck(new Request(url));
  it("is a 404 outside isolated environments so production reveals nothing", async () => {
    expect((await get()).status).toBe(404);
    vi.stubEnv("GAMMA_ENVIRONMENT_NAME", "production");
    expect((await get()).status).toBe(404);
  });
  it("reports non-secret verification facts for an isolated environment", async () => {
    Object.entries({
      ...isolatedOk, GAMMA_EXPERIMENT_ENABLED: "true", PPT_GENERATION_PROVIDER: "gamma", GAMMA_TESTER_EMAILS: "a@x.com,b@x.com",
      GAMMA_API_KEY: "SECRET-GAMMA-KEY", GAMMA_EXPORT_HOST_ALLOWLIST: "pending-verification.invalid", NEXT_PUBLIC_SITE_URL: "https://preview.example/",
      GAMMA_USER_HOURLY_LIMIT: "2", NEXT_PUBLIC_GAMMA_EXPERIMENT: "true",
    }).forEach(([k, v]) => vi.stubEnv(k, v));
    const res = await get();
    const text = await res.text();
    const body = JSON.parse(text);
    expect(res.status).toBe(200);
    expect(body.isolation).toMatchObject({ isolated: true, ok: true, supabaseRef: STG });
    expect(body.config).toMatchObject({ environmentName: "staging", gammaExperimentEnabled: true, defaultProvider: "gamma", testerCount: 2, gammaKeyPresent: true, exportHostIsPlaceholder: true, siteUrlMatchesRequestOrigin: true, publicGammaExperiment: true });
    expect(body.config.limits.userHourly).toBe("2");
    expect(body.featureLock).toMatchObject({ active: true });
    expect(body.featureLock.allowed).toContain("lesson-plan-pptx");
    for (const secret of ["SECRET-GAMMA-KEY", "a@x.com", jwt(STG, "service_role")]) expect(text).not.toContain(secret);
  });
  it("flags a site-url/origin mismatch", async () => {
    Object.entries({ ...isolatedOk, NEXT_PUBLIC_SITE_URL: "https://elsewhere.example" }).forEach(([k, v]) => vi.stubEnv(k, v));
    expect((await (await get()).json()).config.siteUrlMatchesRequestOrigin).toBe(false);
  });
});
