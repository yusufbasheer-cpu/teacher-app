"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChevronUp } from "lucide-react";
import { clearActiveSession } from "@/lib/active-session";
import { useUserUsage } from "@/hooks/use-user-usage";
import { supabase } from "@/lib/supabase";
import { PLANS } from "@/lib/plans";
import { getUpgradePlan, UPGRADE_COPY } from "@/components/usage/upgrade-usage-indicator";
import { WaitlistModal } from "@/components/payment/waitlist-modal";

const TEAL = "#0E9484";
const NAVY = "#241A12";

function initialsFor(user: User): string {
  const name = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  }
  return (user.email?.[0] ?? "?").toUpperCase();
}

type Props = {
  user: User;
  /** Sidebar is collapsed to icon-only width — show just the avatar. */
  collapsed?: boolean;
};

/** Account control docked in the app sidebar footer: avatar, name, a quiet
 * usage line, and a dropdown (plan, upgrade, logout) that opens upward. */
export function UserMenu({ user, collapsed = false }: Props) {
  const [open, setOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { usage } = useUserUsage(true);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);

    // Best-effort cleanup — neither step should be able to block the redirect below.
    try {
      await clearActiveSession(user.id);
    } catch {
      /* ignore — local sign-out below still ends the session */
    }
    try {
      // scope: "local" clears the session on this device immediately, without
      // waiting on a network round-trip to revoke the refresh token server-side.
      // The default "global" scope was the source of the reported "logout
      // sometimes hangs / sidebar stays" behavior — a slow or failed revoke
      // call left stale cookies behind.
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore — proceed to redirect regardless */
    }

    // Hard navigation (not router.push) so every client component — sidebar,
    // usage hooks, etc. — remounts from a clean, freshly-fetched auth state
    // instead of relying on onAuthStateChange firing everywhere in time.
    window.location.href = "/login";
  };

  const displayName = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email;
  const planLabel = usage ? PLANS[usage.planType].adminLabel : null;
  const usageLine = !usage
    ? "Loading…"
    : usage.unlimited || usage.generationsLimit == null
      ? `${planLabel} · Unlimited`
      : `${planLabel} · ${Math.max(0, usage.generationsLimit - usage.generationsUsed)} left`;
  const upgradePlan = getUpgradePlan(usage);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-stone-50"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: NAVY }}
        >
          {initialsFor(user)}
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold" style={{ color: NAVY }}>
                {displayName}
              </span>
              <span className="block truncate text-xs" style={{ color: "#A79A87" }}>
                {usageLine}
              </span>
            </span>
            <ChevronUp
              size={16}
              className="shrink-0 text-stone-400 transition-transform"
              style={{ transform: open ? "none" : "rotate(180deg)" }}
            />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute bottom-full z-50 mb-2 w-64 rounded-2xl border bg-[#FAF6EF] p-4 shadow-lg"
          style={{ borderColor: "rgba(14, 148, 132,0.2)", left: collapsed ? "calc(100% + 8px)" : 0 }}
        >
          <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>
            {displayName}
          </p>
          <p className="mt-0.5 truncate text-xs" style={{ color: "#7a6e5f" }}>
            {user.email}
          </p>

          <div
            className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "rgba(14, 148, 132,0.1)", color: "#0B6B5F" }}
          >
            {planLabel ?? "—"} plan
          </div>

          {upgradePlan ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setWaitlistOpen(true);
              }}
              className="mt-3 flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: TEAL }}
            >
              {UPGRADE_COPY[upgradePlan].label}
            </button>
          ) : null}

          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="mt-2 flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition hover:opacity-70"
            style={{ color: "#2b2118", border: "1px solid #E5E7EB" }}
          >
            View plans
          </Link>

          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={loggingOut}
            className="mt-2 flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: "#ef4444" }}
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      ) : null}

      <WaitlistModal
        open={waitlistOpen}
        plan={upgradePlan ?? undefined}
        onClose={() => setWaitlistOpen(false)}
      />
    </div>
  );
}
