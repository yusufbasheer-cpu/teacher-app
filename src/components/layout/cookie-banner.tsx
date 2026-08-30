"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "layah_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[500] px-4 py-4 sm:px-6"
      role="region"
      aria-label="Cookie consent"
    >
      <div
        className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl p-5 shadow-2xl sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: "var(--text)",
          border: "1px solid color-mix(in oklch, var(--brand) 30%, transparent)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.35)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            We use cookies
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            We use essential cookies to keep you signed in and remember your preferences.{" "}
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
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="inline-flex min-h-9 items-center rounded-xl px-5 text-sm font-bold transition hover:opacity-90"
            style={{ background: "var(--brand)", color: "var(--text)" }}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
