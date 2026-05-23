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
