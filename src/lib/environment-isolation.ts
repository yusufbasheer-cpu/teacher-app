/**
 * Application-wide isolation for an EXPERIMENTAL environment (e.g. the Gamma preview).
 *
 * An environment declares itself isolated by setting GAMMA_ENVIRONMENT_NAME to anything that is not production.
 * Production and ordinary previews never set it, so for them every function here is a no-op (returns "not isolated").
 *
 * Why: Vercel Preview variables can be inherited from Production. This guard does not trust variable precedence: it checks
 * that the credentials the server will actually use belong to an allowlisted, non-production Supabase project, and that no
 * live payment key is present. It never reads or returns a secret value, only decoded non-secret claims (`ref`) and booleans.
 */
type Env = Record<string, string | undefined>;

const PRODUCTION_SUPABASE_REF = "jbwevzvtloahjoamwnjt";
const PRODUCTION_NAMES = new Set(["production", "prod", "live"]);

const csv = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export function isIsolatedEnvironment(env: Env = process.env): boolean {
  const name = env.GAMMA_ENVIRONMENT_NAME?.trim().toLowerCase();
  return !!name && !PRODUCTION_NAMES.has(name);
}

export function supabaseRefFromUrl(url: string | undefined): string | undefined {
  return /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url?.trim() ?? "")?.[1]?.toLowerCase();
}

/** `ref` claim of a legacy Supabase JWT key, or undefined for non-JWT / undecodable keys. Edge-runtime safe (atob). */
export function jwtProjectRef(key: string | undefined): string | undefined {
  const parts = key?.trim().split(".");
  if (!parts || parts.length !== 3) return undefined;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))) as { ref?: unknown };
    return typeof claims.ref === "string" ? claims.ref.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export type IsolationReport = {
  isolated: boolean;
  ok: boolean;
  supabaseRef: string | null;
  /** Machine-readable reasons only (never values). Empty when ok. */
  violations: string[];
  anonKeyMatchesProject: boolean | null;
  serviceKeyMatchesProject: boolean | null;
  liveRazorpayKeyPresent: boolean;
};

export function checkEnvironmentIsolation(env: Env = process.env): IsolationReport {
  const isolated = isIsolatedEnvironment(env);
  const ref = supabaseRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const live = [env.RAZORPAY_KEY_ID, env.NEXT_PUBLIC_RAZORPAY_KEY_ID].some((k) => k?.trim().toLowerCase().startsWith("rzp_live_"));
  const report: IsolationReport = {
    isolated,
    ok: true,
    supabaseRef: ref ?? null,
    violations: [],
    anonKeyMatchesProject: null,
    serviceKeyMatchesProject: null,
    liveRazorpayKeyPresent: live,
  };
  if (!isolated) return report;

  const v = report.violations;
  if (!ref) v.push("supabase-url-missing-or-unrecognised");
  else if (ref === PRODUCTION_SUPABASE_REF) v.push("supabase-url-is-production");
  else if (!csv(env.GAMMA_ALLOWED_SUPABASE_REFS).includes(ref)) v.push("supabase-url-not-allowlisted");

  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anon) {
    const k = jwtProjectRef(anon);
    report.anonKeyMatchesProject = !!ref && k === ref;
    if (!report.anonKeyMatchesProject) v.push(k === PRODUCTION_SUPABASE_REF ? "anon-key-is-production" : "anon-key-not-verifiably-this-project");
  }
  const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) {
    const k = jwtProjectRef(service);
    report.serviceKeyMatchesProject = !!ref && k === ref;
    if (!report.serviceKeyMatchesProject) v.push(k === PRODUCTION_SUPABASE_REF ? "service-role-key-is-production" : "service-role-key-not-verifiably-this-project");
  }
  if (live) v.push("live-razorpay-key-present");

  report.ok = v.length === 0;
  return report;
}

/** True when this isolated environment must refuse to operate. Always false outside isolated environments. */
export function isolationBlocksOperation(env: Env = process.env): boolean {
  const r = checkEnvironmentIsolation(env);
  return r.isolated && !r.ok;
}
