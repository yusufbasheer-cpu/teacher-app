"use client";

import {
  BarChart3,
  Building2,
  CreditCard,
  LayoutGrid,
  Megaphone,
  ShieldCheck,
  ShieldPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT, ACCENT_SOFT, BORDER, FONT_DISPLAY, FONT_MONO, INK, INK_FAINT, INK_MUTED, PAPER } from "./admin-kit";

export type AdminTab = "overview" | "pending" | "schools" | "users" | "admins" | "content" | "billing" | "announcements";

const NAV: { tab: AdminTab; label: string; icon: typeof LayoutGrid; founderOnly?: boolean }[] = [
  { tab: "overview", label: "Overview", icon: LayoutGrid },
  { tab: "pending", label: "Pending Schools", icon: Building2 },
  { tab: "schools", label: "Schools", icon: Building2 },
  { tab: "users", label: "Users", icon: Users },
  { tab: "billing", label: "Billing", icon: CreditCard },
  { tab: "content", label: "Content", icon: ShieldCheck },
  { tab: "announcements", label: "Announcements", icon: Megaphone },
  { tab: "admins", label: "Admins", icon: ShieldPlus, founderOnly: true },
];

export function AdminShell({
  active,
  onNavigate,
  role,
  email,
  pendingCount,
  children,
}: {
  active: AdminTab;
  onNavigate: (tab: AdminTab) => void;
  role: "super_admin" | "admin";
  email: string;
  pendingCount: number;
  children: React.ReactNode;
}) {
  const items = NAV.filter((item) => !item.founderOnly || role === "super_admin");
  const activeItem = NAV.find((n) => n.tab === active);

  return (
    <div className="flex min-h-screen" style={{ background: PAPER }}>
      <aside
        className="hidden w-60 shrink-0 flex-col gap-1 px-3 py-5 lg:flex"
        style={{ borderRight: `1px solid ${BORDER}` }}
      >
        <div className="mb-5 flex items-center gap-2 px-2">
          <div
            className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: ACCENT }}
          >
            L
          </div>
          <div>
            <p className={cn("text-sm font-semibold leading-tight", FONT_DISPLAY)} style={{ color: INK }}>
              Layah Console
            </p>
            <p className={cn("text-[10px] uppercase tracking-wider", FONT_MONO)} style={{ color: INK_FAINT }}>
              Operator access
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.tab === active;
            const count = item.tab === "pending" ? pendingCount : undefined;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition"
                style={{
                  background: isActive ? ACCENT_SOFT : "transparent",
                  color: isActive ? ACCENT : INK_MUTED,
                }}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {!!count && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: isActive ? "white" : "#EDEBE6", color: isActive ? ACCENT : INK_FAINT }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 rounded-lg px-2.5 py-2.5" style={{ background: "#EFEEEA" }}>
          <p className="truncate text-xs font-semibold" style={{ color: INK }}>
            {email}
          </p>
          <p className="mt-0.5 text-[11px] font-medium" style={{ color: INK_FAINT }}>
            {role === "super_admin" ? "Super Admin" : "Admin"}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header
          className="flex items-center justify-between gap-3 px-5 py-4 lg:px-8"
          style={{ borderBottom: `1px solid ${BORDER}` }}
        >
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-wider", FONT_MONO)} style={{ color: INK_FAINT }}>
              Super Admin
            </p>
            <h1 className={cn("text-xl font-semibold tracking-tight", FONT_DISPLAY)} style={{ color: INK }}>
              {activeItem?.label ?? "Overview"}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: ACCENT_SOFT, color: ACCENT }}>
            <BarChart3 className="size-3.5" />
            Live data
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden" style={{ borderColor: BORDER }}>
          {items.map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: item.tab === active ? ACCENT : "transparent",
                color: item.tab === active ? "white" : INK_MUTED,
                border: item.tab === active ? "none" : `1px solid ${BORDER}`,
              }}
            >
              {item.label}
              {item.tab === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </nav>

        <main className="px-5 py-6 pb-16 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
