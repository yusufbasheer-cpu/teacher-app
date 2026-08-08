import { redirect } from "next/navigation";

/**
 * /auth is kept as a redirect target for existing links/bookmarks and for
 * server-side flows (active-session-guard, auth/callback) that still point
 * here — the real pages are /login and /signup. ?tab=signup routes to
 * /signup; every other query param (error, revoked, etc.) is preserved so
 * AuthCard on the destination page still picks it up.
 */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const target = params.tab === "signup" ? "/signup" : "/login";

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab") continue;
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value) && typeof value[0] === "string") {
      query.set(key, value[0]);
    }
  }

  const qs = query.toString();
  redirect(qs ? `${target}?${qs}` : target);
}
