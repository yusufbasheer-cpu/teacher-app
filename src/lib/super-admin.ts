export const SUPER_ADMIN_EMAIL = "yusuf.basheer@gmail.com";

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}
