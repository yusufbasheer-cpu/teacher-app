import {
  BookOpen,
  Building2,
  ClipboardList,
  GraduationCap,
  Layers3,
  LayoutGrid,
  type LucideIcon,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";

/**
 * The authenticated app's navigation, as data.
 *
 * One source of truth consumed by the rail, the mobile drawer and the command
 * palette — previously the sidebar, the marketing navbar and the palette-less
 * app each carried their own list, and they had already drifted (the header's
 * "Dashboard" link pointed at /lesson-plan while the OAuth callback sent people
 * to /dashboard).
 *
 * Grouping reflects how a teacher actually works rather than what the backend
 * happens to expose: the things you *make* sit together and lead, the things
 * you've *made* sit together beneath, and role surfaces are separated out so a
 * teacher who is also an HOD doesn't get admin links mixed into their daily
 * tools.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the command palette to disambiguate similar entries. */
  hint?: string;
  /** Gated behind a paid plan — surfaces a Pro marker for free users. */
  pro?: boolean;
  /** Single-key shortcut, pressed after `g` (g then d → dashboard). */
  key?: string;
};

export type NavGroup = { id: string; label: string; items: NavItem[] };

export const CREATE_ITEMS: NavItem[] = [
  {
    href: "/lesson-plan",
    label: "Lesson plan",
    icon: Sparkles,
    hint: "Plan, slides, worksheet, homework and notes",
    key: "n",
  },
  {
    href: "/question-paper",
    label: "Question paper",
    icon: ClipboardList,
    hint: "Exam paper with mark scheme and blueprint",
    pro: true,
    key: "q",
  },
  {
    href: "/differentiated-worksheets",
    label: "Worksheet pack",
    icon: Layers3,
    hint: "Foundation, Core and Extension versions",
    pro: true,
    key: "w",
  },
];

export const LIBRARY_ITEMS: NavItem[] = [
  { href: "/overview", label: "Dashboard", icon: LayoutGrid, key: "d" },
  { href: "/my-lesson-plans", label: "My lessons", icon: BookOpen, key: "l" },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, hint: "Plan, billing and account", key: "s" },
];

export const ROLE_ITEMS = {
  schoolAdmin: { href: "/school-admin", label: "School admin", icon: Building2 } as NavItem,
  hod: { href: "/hod-dashboard", label: "Department", icon: GraduationCap } as NavItem,
  superAdmin: { href: "/super-admin", label: "Console", icon: Shield } as NavItem,
};

/** Groups shown in the rail, in order. */
export function navGroups(roles: {
  schoolAdmin: boolean;
  hod: boolean;
  superAdmin: boolean;
}): NavGroup[] {
  const role: NavItem[] = [];
  if (roles.schoolAdmin) role.push(ROLE_ITEMS.schoolAdmin);
  if (roles.hod) role.push(ROLE_ITEMS.hod);
  if (roles.superAdmin) role.push(ROLE_ITEMS.superAdmin);

  const groups: NavGroup[] = [
    { id: "library", label: "Library", items: LIBRARY_ITEMS },
    { id: "create", label: "Create", items: CREATE_ITEMS },
  ];
  if (role.length) groups.push({ id: "manage", label: "Manage", items: role });
  return groups;
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Human label for the current route, for the top bar and document context. */
export function routeLabel(pathname: string): string {
  const all = [
    ...CREATE_ITEMS,
    ...LIBRARY_ITEMS,
    ...ACCOUNT_ITEMS,
    ...Object.values(ROLE_ITEMS),
  ];
  const match = all
    .filter((i) => isNavActive(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Layah";
}
