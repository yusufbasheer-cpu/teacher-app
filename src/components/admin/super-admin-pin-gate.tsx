"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ACCENT, ACCENT_SOFT, AdminButton, AdminInput, BORDER, FONT_DISPLAY, INK, INK_MUTED, PAPER } from "@/components/admin/ui/admin-kit";
import { useErrorToast } from "@/hooks/use-error-toast";

const SESSION_KEY = "layah_super_admin_verified";

type Props = { children: React.ReactNode };

export function SuperAdminPinGate({ children }: Props) {
  const [verified, setVerified] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useErrorToast();
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
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: PAPER }}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-xl" style={{ border: `1px solid ${BORDER}` }}>
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl" style={{ background: ACCENT_SOFT }}>
          <ShieldCheck className="size-7" style={{ color: ACCENT }} />
        </div>
        <h1 className={`text-center text-xl font-semibold ${FONT_DISPLAY}`} style={{ color: INK }}>
          Admin Verification
        </h1>
        <p className="mt-2 text-center text-sm" style={{ color: INK_MUTED }}>
          Enter your 6-digit admin PIN to access the console.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <AdminInput
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            minLength={6}
            maxLength={6}
            placeholder="● ● ● ● ● ●"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="current-password"
            className="text-center text-2xl tracking-[0.5em]"
            required
            disabled={loading}
          />
          <p className="text-center text-xs" style={{ color: INK_MUTED }}>{pin.length}/6 digits entered</p>
          {error && <p className="text-center text-sm font-medium" style={{ color: "#B3261E" }}>{error}</p>}
          <AdminButton type="submit" tone="primary" disabled={pin.length !== 6} loading={loading} className="w-full">
            Confirm
          </AdminButton>
        </form>
      </div>
    </div>
  );
}
