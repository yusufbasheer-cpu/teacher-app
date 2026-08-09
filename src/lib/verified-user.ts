import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { USER_EMAIL_HEADER, USER_ID_HEADER } from "@/lib/auth-header-names";

export type VerifiedUser = { id: string; email: string | null };

/**
 * Reads the user identity middleware already verified for this exact
 * request (see src/proxy.ts) instead of calling supabase.auth.getUser()
 * again from a Server Component — that used to mean two sequential network
 * round-trips to Supabase's auth server on every single page navigation.
 *
 * Falls back to a real getUser() call if the header is missing entirely
 * (as opposed to present-but-empty, which means "middleware ran and found
 * no user") — fails safe rather than fails open if a route ever ends up
 * outside the middleware matcher.
 */
export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  const h = await headers();

  if (!h.has(USER_ID_HEADER)) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ? { id: user.id, email: user.email ?? null } : null;
  }

  const id = h.get(USER_ID_HEADER);
  if (!id) return null;
  return { id, email: h.get(USER_EMAIL_HEADER) || null };
}
