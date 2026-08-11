"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  Building2,
  ClipboardList,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  type LucideIcon,
  NotebookPen,
  PanelLeft,
  PanelLeftClose,
  Shield,
} from "lucide-react";
import {
  HOD_DASHBOARD_NAV_LINK,
  SCHOOL_ADMIN_NAV_LINK,
  SUPER_ADMIN_NAV_LINK,
  isNavLinkActive,
} from "@/lib/app-nav-links";
import { supabase } from "@/lib/supabase";
import { UserMenu } from "@/components/layout/user-menu";
import { useUserUsage } from "@/hooks/use-user-usage";
import { isFreePlan } from "@/lib/plans";
import { ProBadge } from "@/components/premium/pro-badge";

const NAV_ITEMS = [
  { href: "/overview", label: "Dashboard", icon: LayoutDashboard, proOnly: false },
  { href: "/my-lesson-plans", label: "My Lessons", icon: BookOpen, proOnly: false },
  { href: "/lesson-plan", label: "Generate Lesson Plan", icon: NotebookPen, proOnly: false },
  { href: "/question-paper", label: "Question Paper", icon: ClipboardList, proOnly: true },
  { href: "/differentiated-worksheets", label: "Differentiated Worksheet", icon: Layers3, proOnly: true },
] as const;

const COLLAPSE_STORAGE_KEY = "layah:sidebar-collapsed";

type Props = { user: User };

export function AppSidebar({ user }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isHod, setIsHod] = useState(false);
  const { usage } = useUserUsage(true);
  const callerIsFree = Boolean(usage && isFreePlan(usage.planType));

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      try {
        const [schoolRes, superRes, hodRes] = await Promise.all([
          fetch("/api/school-admin/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch("/api/super-admin/me"),
          fetch("/api/hod/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        const schoolBody = (await schoolRes.json()) as { isAdmin?: boolean };
        const superBody = (await superRes.json()) as { isSuperAdmin?: boolean };
        const hodBody = (await hodRes.json()) as { isHod?: boolean };
        setIsSchoolAdmin(Boolean(schoolBody.isAdmin));
        setIsSuperAdmin(Boolean(superBody.isSuperAdmin));
        setIsHod(Boolean(hodBody.isHod));
      } catch {
        setIsSchoolAdmin(false);
        setIsSuperAdmin(false);
        setIsHod(false);
      }
    };

    void checkAdmin();
  }, [user.id]);

  type NavItem = { href: string; label: string; icon: LucideIcon; proOnly?: boolean };

  const rawAdminItems: (NavItem | null)[] = [
    isSchoolAdmin
      ? ({ href: SCHOOL_ADMIN_NAV_LINK.href, label: SCHOOL_ADMIN_NAV_LINK.label, icon: Building2 } as NavItem)
      : null,
    isHod
      ? ({ href: HOD_DASHBOARD_NAV_LINK.href, label: HOD_DASHBOARD_NAV_LINK.label, icon: GraduationCap } as NavItem)
      : null,
    isSuperAdmin
      ? ({ href: SUPER_ADMIN_NAV_LINK.href, label: SUPER_ADMIN_NAV_LINK.label, icon: Shield } as NavItem)
      : null,
  ];
  const adminItems = rawAdminItems.filter((item): item is NavItem => item !== null);

  return (
    <aside
      className="sticky top-0 flex h-screen shrink-0 flex-col bg-[#FAF6EF] transition-[width] duration-200"
      style={{ width: collapsed ? 72 : 248, borderRight: "1px solid #E3D9C8" }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-4">
        <Link href="/overview" aria-label="Layah dashboard" className="shrink-0">
          <img src="/logo-mark.png" alt="Layah" className="h-9 w-9 rounded-xl object-cover" />
        </Link>
        {!collapsed ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-50 hover:text-stone-700"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        ) : null}
      </div>

      {collapsed ? (
        <div className="mb-1 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-50 hover:text-stone-700"
          >
            <PanelLeft size={18} />
          </button>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {[...NAV_ITEMS, ...adminItems].map((item) => {
          const active = isNavLinkActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition"
              style={{
                color: active ? "#0E9484" : "#6b5d4f",
                background: active ? "rgba(14, 148, 132,0.08)" : "transparent",
                fontWeight: active ? 600 : 500,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed ? (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  {item.proOnly && callerIsFree ? <ProBadge /> : null}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3" style={{ borderTop: "1px solid #E3D9C8" }}>
        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
