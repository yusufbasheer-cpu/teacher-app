/**
 * Which deployment this code is running in, for telemetry gating.
 *
 * Analytics and error reporting were firing from every environment into the
 * same PostHog project and the same Sentry project as production, with no
 * `environment` tag to tell them apart — so a click on staging counted as a
 * teacher's pageview, and an error deliberately triggered while testing
 * staging arrived indistinguishable from a real production incident.
 *
 * Detection is by hostname rather than an env var: `NEXT_PUBLIC_VERCEL_ENV` is
 * not configured on this project, and `NODE_ENV` is "production" for every
 * Vercel build including previews, so neither can separate staging from
 * production in the browser. The production hostnames are already hardcoded
 * the same way in `csrf.ts`.
 */

const PRODUCTION_HOSTS = new Set(["layah.in", "www.layah.in"]);

export type TelemetryEnvironment = "production" | "preview" | "development";

/** Resolve an environment from a hostname. Exported for tests. */
export function environmentForHost(hostname: string): TelemetryEnvironment {
  if (PRODUCTION_HOSTS.has(hostname)) return "production";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) {
    return "development";
  }
  // Preview deployments, staging.layah.in, and anything else served over the
  // network that is not the production domain.
  return "preview";
}

/** The environment this browser session is running in. */
export function browserEnvironment(): TelemetryEnvironment {
  if (typeof window === "undefined") return "development";
  return environmentForHost(window.location.hostname);
}

/**
 * Whether user-facing telemetry (product analytics, error reporting) should
 * send. Only real production traffic is worth recording; everywhere else the
 * events are our own testing, and sending them corrupts the data we rely on.
 */
export function shouldSendTelemetry(): boolean {
  return browserEnvironment() === "production";
}

/**
 * Server-side equivalent. `VERCEL_ENV` is set automatically on Vercel and is
 * authoritative there; absent it (local `next dev`, tests) this is not
 * production.
 */
export function serverEnvironment(): TelemetryEnvironment {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  return "development";
}
