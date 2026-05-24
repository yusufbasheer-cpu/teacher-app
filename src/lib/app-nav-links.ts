/** Primary app navigation (main header + mobile menu). */
export const APP_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/lesson-plan", label: "Generate Lesson Plan" },
  { href: "/question-paper", label: "Question Paper" },
  { href: "/differentiated-worksheets", label: "Differentiated Worksheet Pack" },
  { href: "/pricing", label: "Pricing" },
  { href: "/my-lesson-plans", label: "My Lessons" },
] as const;

export const SCHOOL_ADMIN_NAV_LINK = {
  href: "/school-admin",
  label: "School Admin",
} as const;

export type AppNavLink = (typeof APP_NAV_LINKS)[number];

export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
