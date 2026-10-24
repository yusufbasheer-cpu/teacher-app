export const CONSENT_STORAGE_KEY = "layah_cookie_consent";
export const CONSENT_EVENT = "layah:cookie-consent";

/** Signed-in workspaces and admin tools never feed Google Analytics. */
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/settings",
  "/my-lesson-plans",
  "/onboarding",
  "/school-admin",
  "/hod-dashboard",
  "/super-admin",
  "/auth",
  "/overview",
];

export function isTrackablePath(pathname: string): boolean {
  return !PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
