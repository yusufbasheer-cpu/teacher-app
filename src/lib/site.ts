/**
 * Single source of truth for the public site identity used by metadata,
 * robots, sitemap and JSON-LD.
 *
 * The apex `layah.in` 30x-redirects to `www.layah.in`, so `www` is the
 * canonical host. Canonicals deliberately stay on production even for preview
 * deployments; previews are kept out of the index by `isIndexableDeployment`.
 */
export const SITE_URL = "https://www.layah.in";
export const SITE_NAME = "Layah";
export const CONTACT_EMAIL = "info@layah.in";

/** Verified in the public footer (src/components/layout/footer.tsx). */
export const SOCIAL_PROFILES = [
  "https://www.instagram.com/layah.teachers",
  "https://www.linkedin.com/company/layah-ai/",
  "https://x.com/layah_ai",
] as const;

export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Layah — AI lesson planning for teachers",
} as const;

export function absoluteUrl(path = "/"): string {
  // Home is the bare origin, matching the canonical Next emits for "/".
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * True only for the real production deployment. On Vercel, previews and
 * branch/staging deployments have VERCEL_ENV "preview"; local dev/test has it
 * unset, which we treat as not indexable.
 */
export function isIndexableDeployment(env: string | undefined = process.env.VERCEL_ENV): boolean {
  return env === "production";
}
