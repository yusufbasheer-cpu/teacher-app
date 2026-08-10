"use client";

import { FormEvent, useState } from "react";

const NAVY = "#241A12";
const TEAL = "#0E9484";
const SESSION_KEY = "layah_super_admin_verified";

type Props = { children: React.ReactNode };

export function SuperAdminPinGate({ children }: Props) {
  const [verified, setVerified] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (verified) return <>{children}</>;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/super-admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setError(data.error ?? "Incorrect PIN. Please try again.");
        setPin("");
        return;
      }

      sessionStorage.setItem(SESSION_KEY, "1");
      setVerified(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="w-full max-w-sm rounded-3xl border bg-[#FAF6EF] p-8 shadow-xl"
        style={{ borderColor: "rgba(14, 148, 132,0.3)" }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(14, 148, 132,0.12)" }}
        >
          <svg className="size-7" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" stroke={TEAL} strokeWidth="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-center text-xl font-bold" style={{ color: NAVY }}>
          Admin Verification
        </h1>
        <p className="mt-2 text-center text-sm" style={{ color: "#7a6e5f" }}>
          Enter your 6-digit admin PIN to access the dashboard.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            minLength={6}
            maxLength={6}
            placeholder="● ● ● ● ● ●"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="current-password"
            className="w-full rounded-xl border px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none transition"
            style={{ borderColor: "#D9CCB8", color: NAVY }}
            onFocus={(e) => (e.target.style.borderColor = TEAL)}
            onBlur={(e) => (e.target.style.borderColor = "#D9CCB8")}
            required
            disabled={loading}
          />
          <p className="text-center text-xs" style={{ color: "#a79a87" }}>
            {pin.length}/6 digits entered
          </p>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || pin.length !== 6}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ background: NAVY }}
          >
            {loading ? "Verifying…" : "Confirm"}
          </button>
        </form>
      </div>
    </div>
  );
}
