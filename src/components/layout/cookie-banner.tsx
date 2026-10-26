"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CONSENT_EVENT, CONSENT_STORAGE_KEY as STORAGE_KEY } from "@/lib/analytics-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    window.dispatchEvent(new Event(CONSENT_EVENT));
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[500] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      role="region"
      aria-label="Cookie consent"
    >
      <div
        className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl p-5 shadow-2xl sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.25)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            We use cookies
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            We use essential cookies to keep you signed in and remember your preferences.
            {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
              ? " If you accept, we also use Google Analytics to see which public pages are visited."
              : ""}{" "}
            <Link href="/privacy" className="underline hover:opacity-80" style={{ color: "var(--brand)" }}>
              Privacy Policy
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={decline}
            className="inline-flex min-h-9 items-center rounded-xl border px-4 text-sm font-semibold transition hover:bg-surface/5"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="inline-flex min-h-9 items-center rounded-xl px-5 text-sm font-bold transition hover:opacity-90"
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
