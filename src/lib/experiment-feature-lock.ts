import { isIsolatedEnvironment } from "./environment-isolation";

type Env = Record<string, string | undefined>;

export const DEFAULT_EXPERIMENT_FEATURES = [
  "home",
  "auth",
  "dashboard",
  "lesson-plan",
  "lesson-plan-docx",
  "lesson-plan-pptx",
  "lesson-plan-zip",
  "my-lesson-plans",
  "settings",
  "super-admin",
  "user-usage",
  "environment-check",
] as const;

export type ExperimentFeature = (typeof DEFAULT_EXPERIMENT_FEATURES)[number] | string;

const PATH_FEATURES: Array<{ match: (path: string) => boolean; feature: ExperimentFeature }> = [
  { match: (p) => p === "/", feature: "home" },
  { match: (p) => p === "/login" || p === "/signup" || p === "/auth" || p.startsWith("/auth/"), feature: "auth" },
  { match: (p) => p === "/api/auth/verify-captcha" || p === "/api/auth/school-enrollment", feature: "auth" },
  { match: (p) => p === "/dashboard" || p === "/overview", feature: "dashboard" },
  { match: (p) => p === "/lesson-plan" || p === "/api/lesson-plan" || p === "/api/lesson-plan/extract-upload", feature: "lesson-plan" },
  { match: (p) => p === "/api/lesson-plan/export/docx", feature: "lesson-plan-docx" },
  { match: (p) => p === "/api/lesson-plan/export/pptx" || p.startsWith("/api/lesson-plan/export/pptx/"), feature: "lesson-plan-pptx" },
  { match: (p) => p === "/api/lesson-plan/export/zip", feature: "lesson-plan-zip" },
  { match: (p) => p === "/my-lesson-plans" || p.startsWith("/my-lesson-plans/"), feature: "my-lesson-plans" },
  { match: (p) => p === "/settings" || p.startsWith("/api/account/"), feature: "settings" },
  { match: (p) => p === "/super-admin" || p.startsWith("/api/super-admin/"), feature: "super-admin" },
  { match: (p) => p === "/api/user-usage", feature: "user-usage" },
  { match: (p) => p === "/api/environment-check", feature: "environment-check" },
];

function normalisePath(pathOrFeature: string): string {
  if (!pathOrFeature.startsWith("/")) return pathOrFeature.trim().toLowerCase();
  try {
    return new URL(pathOrFeature, "https://experiment.invalid").pathname.replace(/\/$/, "") || "/";
  } catch {
    return pathOrFeature.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  }
}

export function experimentAllowedFeatures(env: Env = process.env): string[] {
  const configured = env.EXPERIMENT_ALLOWED_FEATURES?.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  return [...new Set(configured?.length ? configured : DEFAULT_EXPERIMENT_FEATURES)];
}

export function experimentFeatureForPath(path: string): string | null {
  const normalised = normalisePath(path);
  if (!normalised.startsWith("/")) return normalised;
  return PATH_FEATURES.find(({ match }) => match(normalised))?.feature ?? null;
}

/** Server authority for the focused preview. It is deliberately a no-op outside isolated environments. */
export function isFeatureAllowed(pathOrFeature: string, env: Env = process.env): boolean {
  if (!isIsolatedEnvironment(env)) return true;
  const feature = experimentFeatureForPath(pathOrFeature);
  return feature !== null && experimentAllowedFeatures(env).includes(feature);
}

/** UI-only mirror. The server lock remains authoritative; the public flag only hides unavailable navigation. */
export function isFeatureVisible(pathOrFeature: string, env: Env = process.env): boolean {
  const clientExperiment = env.NEXT_PUBLIC_GAMMA_EXPERIMENT === "true";
  if (!clientExperiment && !isIsolatedEnvironment(env)) return true;
  const feature = experimentFeatureForPath(pathOrFeature);
  return feature !== null && experimentAllowedFeatures(env).includes(feature);
}

export function experimentFeatureLockReport(env: Env = process.env) {
  return { active: isIsolatedEnvironment(env), allowed: experimentAllowedFeatures(env) };
}
