import { defaultProviderFor } from "./config";

/**
 * True when this user's PPT will be designed by Gamma by default, so the lesson-plan route should NOT pre-generate
 * the legacy fal.ai/Pexels deck images (Gamma makes its own and ignores them). Everyone the Gamma gate does not
 * authorise keeps the legacy behaviour unchanged. Only the PPT deck images are skipped: section images etc. are untouched.
 * If the tester later picks legacy at download time, the legacy export generates images on demand.
 */
export function shouldSkipLegacyPptImages(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return defaultProviderFor(email, env) === "gamma";
}
