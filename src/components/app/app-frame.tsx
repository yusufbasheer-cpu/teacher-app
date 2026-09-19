"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowUpRight, ChevronsLeft, ChevronsRight, ChevronDown, HelpCircle, LogOut, Menu, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { clearActiveSession } from "@/lib/active-session";
import { useUserUsage } from "@/hooks/use-user-usage";
import { PLANS, isFreePlan } from "@/lib/plans";
import { isNavActive, navGroups, routeLabel } from "@/lib/app-nav";
import { getTeacherDisplayName } from "@/lib/user-profile";
import { Badge, Kbd } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/app/theme";
import { CommandPalette } from "@/components/app/command-palette";

const COLLAPSE_KEY = "layah:rail-collapsed";

/**
 * Optimistic active-nav state.
 *
 * `usePathname()` only reflects the route that has actually finished
 * resolving, so binding the rail's highlight to it directly means the
 * highlight waits on the same round-trip the click itself is waiting on —
 * the middleware's Supabase auth check plus the page's own Server Component.
 * That is what made the indicator (and the whole sidebar) feel like it
 * lagged behind the click.
 *
 * `pendingHref` is set synchronously in the nav link's own onClick, in the
 * same event as the click — before Next.js's router transition, before any
 * network call — so the highlight moves the instant the user acts. It
 * reconciles itself against the real pathname once navigation lands, and
 * clears on a short safety timer so a cancelled/blocked navigation can't
 * strand the indicator on the wrong item.
 */
function useOptimisticActivePath(pathname: string) {
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pendingHref && pathname === pendingHref) setPendingHref(null);
  }, [pathname, pendingHref]);

  React.useEffect(() => {
    if (!pendingHref) return;
    const t = setTimeout(() => setPendingHref(null), 4000);
    return () => clearTimeout(t);
  }, [pendingHref]);

  return { activePath: pendingHref ?? pathname, onNavigate: setPendingHref };
}

type Roles = { schoolAdmin: boolean; hod: boolean; superAdmin: boolean };

function useRoles(userId: string | undefined): Roles {
  const [roles, setRoles] = React.useState<Roles>({
    schoolAdmin: false,
    hod: false,
    superAdmin: false,
  });

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const auth = { Authorization: `Bearer ${session.access_token}` };
      try {
        const [school, superA, hod] = await Promise.all([
          fetch("/api/school-admin/me", { headers: auth }),
          fetch("/api/super-admin/me"),
          fetch("/api/hod/me", { headers: auth }),
        ]);
        const [sb, ub, hb] = await Promise.all([school.json(), superA.json(), hod.json()]);
        if (cancelled) return;
        setRoles({
          schoolAdmin: Boolean((sb as { isAdmin?: boolean }).isAdmin),
          superAdmin: Boolean((ub as { role?: string | null }).role),
          hod: Boolean((hb as { isHod?: boolean }).isHod),
        });
      } catch {
        /* role links stay hidden — the routes themselves are still gated */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return roles;
}

function initials(user: User): string {
  const name = getTeacherDisplayName(user).trim();
  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("");
  }
  return (user.email?.[0] ?? "?").toUpperCase();
}

function RailContent({ activePath, roles, collapsed, isFree, onNavigate }: {
  activePath: string;
  roles: Roles;
  collapsed: boolean;
  isFree: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav className="min-h-0 flex-1 space-y-7 overflow-y-auto px-3 py-6" aria-label="Workspace">
      {navGroups(roles).map((group) => (
        <div key={group.id}>
          {!collapsed && <p className="mb-2 px-3 text-xs font-medium text-faint">{group.label}</p>}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isNavActive(activePath, item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={(event) => {
                  if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate(item.href);
                }} title={collapsed ? item.label : undefined} aria-label={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-11 items-center gap-3 rounded-md text-sm transition-colors duration-[140ms]", collapsed ? "justify-center px-2" : "px-3", active ? "bg-brand-subtle font-semibold text-brand-text" : "text-muted hover:bg-hover hover:text-ink")}>
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  {!collapsed && <><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.pro && isFree && <Badge className="text-[10px]">Pro</Badge>}</>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu({ user }: { user: User }) {
  const [loggingOut, setLoggingOut] = React.useState(false);
  const { usage } = useUserUsage(true);
  const name = getTeacherDisplayName(user);
  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await clearActiveSession(user.id); } catch { /* local sign-out still ends this session */ }
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* redirect even if remote cleanup fails */ }
    window.location.href = "/login";
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" aria-label="Open account menu" />}>
        <span className="flex size-9 items-center justify-center rounded-full border border-brand-border bg-brand-subtle text-xs font-semibold text-brand-text">{initials(user)}</span>
        <ChevronDown className="hidden size-3.5 text-faint sm:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-1.5">
        <div className="px-3 py-3">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="mt-0.5 truncate text-xs text-faint">{user.email}</p>
          {usage && <Badge className="mt-2" tone={isFreePlan(usage.planType) ? "neutral" : "brand"}>{PLANS[usage.planType].adminLabel}</Badge>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}><Settings aria-hidden />Account & settings</DropdownMenuItem>
        <DropdownMenuItem disabled={loggingOut} onClick={() => void onLogout()}><LogOut aria-hidden />{loggingOut ? "Signing out?" : "Sign out"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuotaPill() {
  const { usage, loading } = useUserUsage(true);
  if (loading || !usage || usage.unlimited || usage.generationsLimit == null) return null;
  const left = Math.max(0, usage.generationsLimit - usage.generationsUsed);
  const low = left <= Math.max(1, usage.generationsLimit * 0.2);
  return (
    <Link href="/settings" className={cn("hidden min-h-9 items-center gap-2 rounded-md px-3 text-xs transition-colors hover:bg-hover xl:flex", left === 0 ? "text-danger-text" : low ? "text-gen-text" : "text-faint")}
      title={`${usage.generationsUsed} of ${usage.generationsLimit} generations used this month`}>
      <span className={cn("size-1.5 rounded-full", left === 0 ? "bg-danger" : low ? "bg-gen" : "bg-success")} aria-hidden />
      {left} generations left
    </Link>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/overview" aria-label="Layah dashboard" className={cn("flex items-center gap-3", collapsed && "justify-center")}>
      <img src="/logo-mark.png" alt="" aria-hidden className="size-9 rounded-md object-cover" />
      {!collapsed && <span><span className="block text-xl font-semibold tracking-[-0.04em] text-ink">Layah</span><span className="block text-[11px] text-faint">Teacher workspace</span></span>}
    </Link>
  );
}

export function AppFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activePath, onNavigate } = useOptimisticActivePath(pathname);
  const roles = useRoles(user.id);
  const { usage } = useUserUsage(true);
  const isFree = Boolean(usage && isFreePlan(usage.planType));
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try { setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* storage may be unavailable */ }
  }, []);
  React.useEffect(() => {
    setDrawer(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  // A drawer opened on a phone must release its focus trap when resized to desktop.
  React.useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setDrawer(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const toggleCollapsed = () => setCollapsed((previous) => {
    const next = !previous;
    try { window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* keep local state */ }
    return next;
  });
  React.useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element && (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.isContentEditable || element.closest('[role="dialog"]'))) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (armed) {
        armed = false;
        clearTimeout(timer);
        const hit = navGroups(roles).flatMap((group) => group.items).find((item) => item.key === event.key.toLowerCase());
        if (hit) { event.preventDefault(); router.push(hit.href); }
      } else if (event.key.toLowerCase() === "g") {
        armed = true;
        timer = setTimeout(() => { armed = false; }, 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, [roles, router]);

  return (
    <Sheet open={drawer} onOpenChange={setDrawer}>
      <div className="flex h-dvh overflow-hidden bg-canvas">
        <a href="#workspace-content" className="skip-link">Skip to content</a>
        <CommandPalette roles={roles} />
        <aside className={cn("hidden shrink-0 flex-col border-r border-line-subtle bg-surface lg:flex", collapsed ? "w-[76px]" : "w-64")}>
          <div className={cn("flex h-[88px] shrink-0 items-center", collapsed ? "justify-center" : "px-6")}><Brand collapsed={collapsed} /></div>
          <RailContent activePath={activePath} roles={roles} collapsed={collapsed} isFree={isFree} onNavigate={onNavigate} />
          <div className="space-y-3 border-t border-line-subtle p-3">
            <Link href="/faq" title={collapsed ? "Help & support" : undefined} aria-label={collapsed ? "Help & support" : undefined}
              className={cn("flex min-h-10 items-center gap-3 rounded-md text-sm text-muted hover:bg-hover", collapsed ? "justify-center" : "px-3")}>
              <HelpCircle className="size-[18px] shrink-0" aria-hidden />{!collapsed && <><span className="flex-1">Help & support</span><ArrowUpRight className="size-3.5" aria-hidden /></>}
            </Link>
            {/* The theme toggle used to be dropped entirely while collapsed, so
                a teacher whose rail was collapsed — a setting that persists in
                localStorage across sessions — had no way to change theme
                anywhere in the app. Collapsing the rail stacks it instead. */}
            <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between px-1")}>
              <ThemeToggle orientation={collapsed ? "vertical" : "horizontal"} />
              <Button variant="ghost" size="icon-sm" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
                {collapsed ? <ChevronsRight aria-hidden /> : <ChevronsLeft aria-hidden />}
              </Button>
            </div>
          </div>
        </aside>
        <SheetContent side="left" className="w-[300px] max-w-[88vw] gap-0 p-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate your teaching tools and account.</SheetDescription>
          <div className="flex h-20 shrink-0 items-center border-b border-line-subtle px-5"><Brand /></div>
          <RailContent activePath={activePath} roles={roles} collapsed={false} isFree={isFree} onNavigate={(href) => { onNavigate(href); setDrawer(false); }} />
          <div className="flex items-center justify-between border-t border-line-subtle p-4"><ThemeToggle /><Button variant="ghost" size="sm" render={<Link href="/faq" />}>Help & support</Button></div>
        </SheetContent>
        <div ref={scrollRef} className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <header className="sticky top-0 z-40 flex h-[72px] shrink-0 items-center gap-3 border-b border-line-subtle bg-surface/95 px-4 backdrop-blur-md sm:px-6 lg:px-9">
            <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}><Menu aria-hidden /></SheetTrigger>
            <div className="flex min-w-0 items-center gap-3 text-sm"><span className="hidden text-faint lg:inline">Workspace</span><span className="hidden text-disabled lg:inline" aria-hidden>/</span><span className="truncate font-medium text-ink">{routeLabel(activePath)}</span></div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <QuotaPill />
              <Button variant="outline" className="px-2.5 text-faint sm:w-44 sm:justify-start" onClick={() => window.dispatchEvent(new Event("layah:open-command-palette"))} aria-label="Search lessons and commands">
                <Search className="size-4" aria-hidden /><span className="hidden sm:inline">Search</span><Kbd className="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
              </Button>
              <AccountMenu user={user} />
            </div>
          </header>
          <main id="workspace-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
        </div>
      </div>
    </Sheet>
  );
}
