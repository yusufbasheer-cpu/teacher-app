/** App routes that require an active single-device session check. */
export const PROTECTED_APP_PATHS = [
  "/lesson-plan",
  "/my-lesson-plans",
  "/differentiated-worksheets",
  "/question-paper",
] as const;

export function isProtectedAppPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_APP_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Dashboard-chrome routes beyond PROTECTED_APP_PATHS — pages that only make
 * sense signed in, but aren't AI-generation routes so don't need the
 * single-device session poll that PROTECTED_APP_PATHS gates.
 */
const DASHBOARD_ONLY_PATHS = [
  "/dashboard",
  "/overview",
  "/settings",
  "/onboarding",
  "/school-admin",
  "/hod-dashboard",
] as const;

/**
 * True for any route that should show the signed-in dashboard frame
 * (AppShell's AppFrame) rather than the public marketing chrome. This is the
 * single source of truth for that decision — do not re-derive it locally, or
 * a public page can silently start rendering the dashboard sidebar again
 * (this was extracted from exactly that bug: AppShell used to define its own
 * copy of this list and a public page like /about fell through the gap).
 *
 * Deliberately NOT consulted by src/proxy.ts: that middleware only handles
 * session refresh, CSRF, and OAuth-code redirects — it does not gate page
 * access (auth enforcement here is client-side, via AppShell's redirect to
 * /login). /school-admin and /super-admin are exceptions with their own
 * server-side role gate in their page component, which is why proxy.ts
 * refreshes their session directly rather than deferring to this helper.
 */
export function isProtectedClientRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return DASHBOARD_ONLY_PATHS.some((p) => pathname === p) || isProtectedAppPath(pathname);
}
