"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  PanelsTopLeft,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { clearActiveSession } from "@/lib/active-session";
import { useUserUsage } from "@/hooks/use-user-usage";
import { PLANS, isFreePlan } from "@/lib/plans";
import { isNavActive, navGroups, routeLabel, type NavItem } from "@/lib/app-nav";
import { getTeacherDisplayName } from "@/lib/user-profile";
import { Badge, Kbd, Meter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app/theme";
import { CommandPalette } from "@/components/app/command-palette";

/**
 * The authenticated app frame.
 *
 * Replaces a 248px sidebar that had no responsive treatment at all — on a
 * 390px phone it took 248px of the viewport and left ~140px for content,
 * wrapping body text to one word per line. That was the single most serious
 * defect in the product, since most of this audience works from a phone.
 *
 * Structure:
 *   ≥lg   fixed rail (collapsible, persisted) + sticky top bar + content
 *   <lg   top bar with a menu button; the rail becomes an overlay drawer and
 *         content gets the full width
 *
 * The rail carries navigation only. Identity, quota, search and theme live in
 * the top bar, so the rail can collapse to icons without hiding anything the
 * user needs.
 */

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

/* -------------------------------------------------------------------------- */
/* Rail                                                                       */
/* -------------------------------------------------------------------------- */

function RailLink({
  item,
  active,
  collapsed,
  isFree,
  onNavigate,
  onBeforeNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  isFree: boolean;
  onNavigate?: () => void;
  /** Fires synchronously in the click, before the router transition starts —
   *  see useOptimisticActivePath above. */
  onBeforeNavigate: (href: string) => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={() => {
        onBeforeNavigate(item.href);
        onNavigate?.();
      }}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md py-1.5 text-[13px]",
        "transition-colors duration-[110ms]",
        collapsed ? "justify-center px-0" : "px-2",
        active ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink",
      )}
    >
      {/* The active marker is a rule segment — the same ruled-margin device
          the composer and package viewer use — and it is ONE shared element
          rather than one-per-link. `layoutId` makes Framer Motion treat every
          render of it (regardless of which link it's currently inside) as the
          same physical object, so moving between items animates as a single
          surface travelling to its new position instead of one bar fading out
          while another fades in. Conditionally rendered — only the active
          link ever mounts it — which is what lets it "jump" DOM parents while
          still reading as continuous motion. */}
      {active ? (
        <motion.span
          layoutId="rail-active-indicator"
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand",
            collapsed && "left-[-6px]",
          )}
          transition={{ type: "spring", stiffness: 620, damping: 45, mass: 0.5 }}
        />
      ) : null}
      <Icon
        className={cn(
          "size-4 shrink-0 transition-[color,transform] duration-150 ease-out",
          active ? "scale-[1.05] text-brand-text" : "text-faint group-hover:text-muted",
        )}
        aria-hidden
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.pro && isFree ? (
            <Badge tone="generated" className="shrink-0">
              Pro
            </Badge>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function RailContent({
  activePath,
  roles,
  collapsed,
  isFree,
  onNavigate,
  onBeforeNavigate,
}: {
  /** The optimistic path — see useOptimisticActivePath. Drives which item
   *  lights up; may be ahead of the browser's real current route. */
  activePath: string;
  roles: Roles;
  collapsed: boolean;
  isFree: boolean;
  onNavigate?: () => void;
  onBeforeNavigate: (href: string) => void;
}) {
  const groups = navGroups(roles);
  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-2" aria-label="Main">
      {groups.map((group, gi) => (
        <div key={group.id} className={cn(gi > 0 && "mt-4")}>
          {!collapsed ? (
            <p className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-disabled">
              {group.label}
            </p>
          ) : gi > 0 ? (
            <div className="mx-auto mb-2 h-px w-5 bg-line-subtle" aria-hidden />
          ) : null}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <RailLink
                key={item.href}
                item={item}
                active={isNavActive(activePath, item.href)}
                collapsed={collapsed}
                isFree={isFree}
                onNavigate={onNavigate}
                onBeforeNavigate={onBeforeNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Account menu                                                               */
/* -------------------------------------------------------------------------- */

function AccountMenu({ user }: { user: User }) {
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { usage } = useUserUsage(true);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);
    try {
      await clearActiveSession(user.id);
    } catch {
      /* local sign-out below still ends the session */
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* proceed to redirect regardless */
    }
    window.location.href = "/login";
  };

  const name = getTeacherDisplayName(user);
  const plan = usage ? PLANS[usage.planType].adminLabel : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className={cn(
          "flex size-7 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-on",
          "transition-opacity duration-[110ms] hover:opacity-90",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        )}
      >
        {initials(user)}
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-pop absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-lg border border-line bg-raised shadow-overlay"
        >
          <div className="border-b border-line-subtle px-3 py-2.5">
            <p className="truncate text-[13px] font-medium text-ink">{name}</p>
            <p className="truncate text-[11px] text-faint">{user.email}</p>
            {plan ? (
              <Badge tone={usage && isFreePlan(usage.planType) ? "neutral" : "brand"} className="mt-2">
                {plan}
              </Badge>
            ) : null}
          </div>
          <div className="p-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-muted hover:bg-hover hover:text-ink"
            >
              <Settings className="size-3.5" aria-hidden />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void onLogout()}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] text-muted hover:bg-hover hover:text-ink disabled:opacity-60"
            >
              <LogOut className="size-3.5" aria-hidden />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quota pill                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Quota in the top bar rather than as a dashboard stat card. It is a *constraint
 * on the current action*, so it belongs where the user is working — and it only
 * takes visual weight once it starts to matter.
 */
function QuotaPill() {
  const { usage, loading } = useUserUsage(true);
  if (loading || !usage) return null;
  if (usage.unlimited || usage.generationsLimit == null) return null;

  const left = Math.max(0, usage.generationsLimit - usage.generationsUsed);
  const low = left <= Math.max(1, usage.generationsLimit * 0.2);

  return (
    <Link
      href="/settings"
      className="hidden items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-hover sm:flex"
      title={`${usage.generationsUsed} of ${usage.generationsLimit} generations used this month`}
    >
      {/* The bar only appears once headroom is short. At full quota an empty
          track is a line that says nothing; when it matters, the bar and its
          colour carry the urgency that the number alone doesn't. */}
      {low ? (
        <Meter used={usage.generationsUsed} limit={usage.generationsLimit} className="w-10" />
      ) : null}
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          left === 0 ? "text-danger-text" : low ? "text-gen-text" : "text-faint",
        )}
      >
        {left} left
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Frame                                                                      */
/* -------------------------------------------------------------------------- */

export function AppFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activePath, onNavigate: onBeforeNavigate } = useOptimisticActivePath(pathname);
  const roles = useRoles(user.id);
  const { usage } = useUserUsage(true);
  const isFree = Boolean(usage && isFreePlan(usage.planType));

  const [collapsed, setCollapsed] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  // Close the drawer on navigation — otherwise it covers the page you just
  // asked for.
  React.useEffect(() => setDrawer(false), [pathname]);

  React.useEffect(() => {
    if (!drawer) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onEsc);
    // Prevent the page behind the drawer from scrolling under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  /* `g` then a key jumps to a section — the standard two-stroke navigation
     idiom, skipped whenever focus is in a field so it never eats typing. */
  React.useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (armed) {
        armed = false;
        clearTimeout(timer);
        const all = navGroups(roles).flatMap((g) => g.items);
        const hit = all.find((i) => i.key === e.key.toLowerCase());
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        armed = true;
        timer = setTimeout(() => (armed = false), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [roles, router]);

  const railWidth = collapsed ? "lg:w-14" : "lg:w-[232px]";

  return (
    <div className="flex min-h-screen bg-canvas">
      <CommandPalette roles={roles} />

      {/* ---- Rail (desktop) ---- */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line-subtle bg-surface lg:flex",
          "transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          railWidth,
        )}
      >
        <div
          className={cn(
            "flex h-[52px] shrink-0 items-center justify-between border-b border-line-subtle px-3",
          )}
        >
          <Link href="/overview" aria-label="Layah — dashboard" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" aria-hidden className="size-6 rounded-sm object-cover" />
            {!collapsed ? (
              <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">Layah</span>
            ) : null}
          </Link>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </Button>
        </div>

        <RailContent
          activePath={activePath}
          roles={roles}
          collapsed={collapsed}
          isFree={isFree}
          onBeforeNavigate={onBeforeNavigate}
        />

      </aside>

      {/* ---- Drawer (below lg) ---- */}
      {drawer ? (
        <div className="fixed inset-0 z-[200] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="animate-fade-in absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
          />
          <div className="animate-rise absolute inset-y-0 left-0 flex w-[264px] max-w-[82vw] flex-col border-r border-line bg-surface shadow-overlay">
            <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line-subtle px-3">
              <span className="flex items-center gap-2">
                <img src="/logo-mark.png" alt="" aria-hidden className="size-6 rounded-sm object-cover" />
                <span className="text-[13px] font-semibold text-ink">Layah</span>
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => setDrawer(false)} aria-label="Close navigation">
                <X />
              </Button>
            </div>
            <RailContent
              activePath={activePath}
              roles={roles}
              collapsed={false}
              isFree={isFree}
              onNavigate={() => setDrawer(false)}
              onBeforeNavigate={onBeforeNavigate}
            />
            <div className="border-t border-line-subtle p-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center gap-2 border-b border-line-subtle bg-canvas/85 px-3 backdrop-blur-md sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>

          <span className="flex min-w-0 items-center gap-1.5">
            <PanelsTopLeft className="hidden size-3.5 shrink-0 text-disabled sm:block" aria-hidden />
            <h2 className="truncate text-[13px] font-medium text-ink">{routeLabel(activePath)}</h2>
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <QuotaPill />

            {/* Dispatches the same ⌘K the palette listens for, so there is one
                code path whether you click or type. */}
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
                )
              }
              aria-label="Search lessons or run a command"
              className={cn(
                "flex items-center gap-2 rounded-md border border-line-subtle bg-surface py-1 pl-2 pr-1.5",
                "text-[12px] text-faint transition-colors hover:border-line hover:text-muted",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              )}
            >
              <Search className="size-3.5" aria-hidden />
              <span className="hidden md:inline">Search</span>
              <Kbd className="hidden md:inline-flex">⌘K</Kbd>
            </button>

            <ThemeToggle className="hidden sm:inline-flex" />
            <AccountMenu user={user} />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
