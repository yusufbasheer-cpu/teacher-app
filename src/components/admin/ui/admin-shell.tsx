"use client";

import Link from "next/link";
import {
  Building2,
  CreditCard,
  ArrowLeft,
  LayoutGrid,
  Megaphone,
  ShieldCheck,
  ShieldPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Same containment as AppFrame: the row is capped to one viewport and the main
  // column owns the scrolling, so the sidebar can never scroll away.
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/overview" className="flex items-center gap-3 px-2 text-lg font-semibold text-ink">
          {/* Same plain <img> the public navbar/footer and app frame use for the
              logo mark, so all five sites stay on one pattern. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" aria-hidden className="size-9 rounded-lg object-cover" />
          Layah <span className="text-sm font-normal text-muted">Console</span>
        </Link>
        <p className="mb-3 mt-10 px-3 text-sm font-medium text-faint">Administration</p>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Administration sections">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.tab === active;
            return (
              <button key={item.tab} type="button" onClick={() => onNavigate(item.tab)} aria-current={isActive ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-[var(--t-fast)]", isActive ? "bg-brand-subtle text-brand-text" : "text-muted hover:bg-hover hover:text-ink")}>
                <Icon className="size-4 shrink-0" aria-hidden /><span className="flex-1">{item.label}</span>
                {item.tab === "pending" && pendingCount > 0 ? <span className="rounded-md bg-surface px-2 py-0.5 text-xs tabular-nums">{pendingCount}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-line px-3 pt-5"><p className="truncate text-sm font-medium text-ink" title={email}>{email}</p><p className="mt-1 text-sm text-faint">{role === "super_admin" ? "Super administrator" : "Administrator"}</p></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <header className="sticky top-0 z-40 flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4 sm:px-8">
          <p className="text-sm text-muted">Administration <span className="mx-2 text-faint" aria-hidden>/</span><span className="font-medium text-ink">{activeItem?.label}</span></p>
          <Link href="/overview" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-hover"><ArrowLeft className="size-4" aria-hidden />Back to workspace</Link>
        </header>
        <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-line bg-surface px-5 py-3 lg:hidden" aria-label="Administration sections">
          {items.map((item) => <button key={item.tab} type="button" onClick={() => onNavigate(item.tab)} aria-current={item.tab === active ? "page" : undefined} className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-medium", item.tab === active ? "bg-brand-subtle text-brand-text" : "text-muted hover:bg-hover")}>{item.label}{item.tab === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}</button>)}
        </nav>
        <div className="workspace-page">
          <div className="page-header"><div><p className="page-kicker">Layah console</p><h1 className="page-title">{activeItem?.label ?? "Overview"}</h1><p className="page-description">{active === "overview" ? "A clear view of platform activity and the work that needs attention." : `Manage ${activeItem?.label.toLowerCase() ?? "your platform"} from one place.`}</p></div></div>
          {children}
        </div>
      </div>
    </div>
  );
}
