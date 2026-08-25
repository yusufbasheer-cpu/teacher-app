import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export const SUPER_ADMIN_EMAILS = ["yusuf.basheer@gmail.com", "uvaissolanki506@gmail.com"];

/**
 * Authoritative super-admin check: email pre-filter + DB role lookup.
 * Both must pass — the DB role is the source of truth.
 */
export async function isSuperAdmin(
  userId: string | null | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  if (!userId || !email) return false;

  // Fast pre-filter — avoids DB call for obviously non-admin emails
  if (!SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase())) return false;

  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error("[super-admin] service role not configured — denying admin access");
    return false;
  }

  const { data } = await admin
    .from("admin_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();

  return Boolean(data);
}

/** Synchronous email-only check used only for the /api/super-admin/me probe. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
