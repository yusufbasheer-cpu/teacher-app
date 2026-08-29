"use client";

import { useState, useEffect } from "react";
import { useErrorToast } from "@/hooks/use-error-toast";

const NAVY = "#241A12";
const TEAL = "#0E9484";

type WaitlistModalProps = {
  open: boolean;
  onClose: () => void;
  plan?: string;
  initialEmail?: string;
};

export function WaitlistModal({ open, onClose, plan, initialEmail = "" }: WaitlistModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useErrorToast();

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      onClose();
      setTimeout(() => { setDone(false); setError(null); }, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [done, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plan_interested: plan ?? null }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Something went wrong.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setDone(false); setError(null); }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#241A12]/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={handleClose}
      />

      <div
        className="relative w-full max-w-sm rounded-3xl border bg-[#FAF6EF] shadow-2xl"
        style={{ borderColor: "rgba(14, 148, 132,0.3)" }}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          aria-label="Close"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="px-7 py-8">
          {done ? (
            <div className="text-center">
              <p className="text-4xl">🎉</p>
              <h2 className="mt-4 text-xl font-bold" style={{ color: NAVY }}>
                You&apos;re on the list!
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
                We&apos;ll email you as soon as Pro plans launch.
              </p>
              <p className="mt-2 text-xs" style={{ color: "#a79a87" }}>
                Closing automatically…
              </p>
            </div>
          ) : (
            <>
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: "rgba(14, 148, 132,0.12)" }}
              >
                <svg className="size-7" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h2
                id="waitlist-modal-title"
                className="text-center text-xl font-bold"
                style={{ color: NAVY }}
              >
                Payment System Coming Soon! 🚀
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
                We are putting the final touches on our payment system. Join the waitlist and we will notify you the moment Pro plans are available.
              </p>

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none ring-[#0E9484] focus:ring-2"
                  autoFocus
                />

                {error ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-70"
                  style={{ background: TEAL }}
                >
                  {submitting ? "Joining…" : "Join Waitlist"}
                </button>
              </form>

              <p className="mt-4 text-center text-xs" style={{ color: "#a79a87" }}>
                No spam. We&apos;ll only email you when payments are ready.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
