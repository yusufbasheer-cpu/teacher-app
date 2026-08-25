import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export const SUPER_ADMIN_EMAILS = ["yusuf.basheer@gmail.com", "uvaissolanki506@gmail.com"];

export type AdminRole = "super_admin" | "admin";

/**
 * Granular capabilities the narrower 'admin' role can be granted piecemeal
 * (e.g. an admin without "billing.refund"). super_admin has every
 * permission implicitly — see hasPermission(). Validated only in app code
 * (this union), not a DB CHECK, so adding one never needs a migration.
 */
export const ADMIN_PERMISSIONS = [
  "billing.refund",
  "billing.subscription_manage",
  "billing.retry_notify",
  "user.suspend",
  "user.delete",
  "user.impersonate",
  "school.manage",
  "content.moderate",
  "notifications.broadcast",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export function isAdminPermission(value: string): value is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Founder-only check: email allowlist + DB role lookup for 'super_admin'
 * specifically. Reserved for actions that should never be delegable to the
 * narrower 'admin' role no matter what permissions they're granted —
 * granting/revoking other admins, and impersonation. The hardcoded email
 * list is a deliberate defense-in-depth belt-and-suspenders check at this
 * tier only; it is NOT used to gate general admin access (see isAdminUser).
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

/**
 * DB-driven check for *any* admin (super_admin or the narrower admin role)
 * — the gate for reaching /super-admin at all. Deliberately has no email
 * pre-filter: a future narrower-role hire won't be in SUPER_ADMIN_EMAILS,
 * and admin_roles is the sole source of truth for who counts as an admin.
 * Returns the role so callers can branch without a second query.
 */
export async function isAdminUser(
  userId: string | null | undefined,
): Promise<AdminRole | null> {
  if (!userId) return null;

  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error("[super-admin] service role not configured — denying admin access");
    return null;
  }

  const { data } = await admin
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = data?.role as string | undefined;
  return role === "super_admin" || role === "admin" ? role : null;
}

/**
 * True if the user can perform `permission`. super_admin has every
 * permission implicitly; the narrower admin role needs an explicit grant
 * in admin_permissions — omitting one (e.g. "billing.refund") is how a
 * future hire's access gets narrowed.
 */
export async function hasPermission(
  userId: string | null | undefined,
  permission: AdminPermission,
): Promise<boolean> {
  if (!userId) return false;

  const role = await isAdminUser(userId);
  if (!role) return false;
  if (role === "super_admin") return true;

  const admin = getSupabaseServiceRole();
  if (!admin) return false;

  const { data } = await admin
    .from("admin_permissions")
    .select("id")
    .eq("user_id", userId)
    .eq("permission", permission)
    .maybeSingle();

  return Boolean(data);
}
