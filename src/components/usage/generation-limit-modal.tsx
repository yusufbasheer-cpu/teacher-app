"use client";

import { useState } from "react";
import { PaymentModal } from "@/components/payment/payment-modal";
import { getUpgradePlan } from "@/components/usage/upgrade-usage-indicator";
import type { UserUsageSnapshot } from "@/lib/user-usage";
import { PLANS } from "@/lib/plans";

const NAVY = "#241A12";
const TEAL = "#0E9484";

type GenerationLimitModalProps = {
  open: boolean;
  usage: UserUsageSnapshot | null;
  headline: string;
  subline: string;
  onClose: () => void;
};

export function GenerationLimitModal({
  open,
  usage,
  headline,
  subline,
  onClose,
}: GenerationLimitModalProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!open) return null;

  const limit = usage?.generationsLimit ?? PLANS.free.generationsLimit ?? 0;
  const used = usage?.generationsUsed ?? 0;
  const upgradePlan = getUpgradePlan(usage);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-limit-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#241A12]/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-3xl border bg-[#FAF6EF] p-8 shadow-2xl"
        style={{ borderColor: "rgba(14, 148, 132,0.35)" }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(14, 148, 132,0.12)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke={TEAL}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h2 id="generation-limit-title" className="text-center text-xl font-bold" style={{ color: NAVY }}>
          Monthly limit reached
        </h2>

        <p className="mt-3 text-center text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
          You have used all {limit} generations for this month.
          {used >= limit ? ` (${used} of ${limit} used)` : null}
        </p>
        <p className="mt-2 text-center text-sm font-medium leading-relaxed" style={{ color: NAVY }}>
          {subline || headline}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {upgradePlan && (
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-95"
              style={{ background: TEAL }}
            >
              Upgrade Now
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-stone-50"
            style={{ borderColor: "#D9CCB8", color: "#6B5D4F" }}
          >
            Maybe Later
          </button>
        </div>

        {upgradePlan && (
          <PaymentModal
            open={paymentOpen}
            planKey={upgradePlan}
            onClose={() => { setPaymentOpen(false); onClose(); }}
            onSuccess={() => window.location.reload()}
          />
        )}
      </div>
    </div>
  );
}
