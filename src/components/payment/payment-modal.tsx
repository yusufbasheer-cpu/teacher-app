"use client";

import { useState } from "react";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import { formatRegionalPrice, type PaidPlanKey } from "@/lib/pricing-regions";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

export type UpgradePlanKey = "pro" | "proPlus";

type Billing = "monthly" | "annual";

type PaymentModalProps = {
  open: boolean;
  planKey: UpgradePlanKey;
  initialBilling?: Billing;
  onClose: () => void;
};

const PLAN_INFO: Record<UpgradePlanKey, { name: string; priceKey: PaidPlanKey; generations: string; features: string[] }> = {
  pro: {
    name: "Pro",
    priceKey: "pro",
    generations: "30 generations / month",
    features: [
      "All 5 PPT themes",
      "Question Paper Generator",
      "Blueprint Generator",
      "Differentiated Worksheet Pack",
      "Global Curriculum Alignment",
      "Priority Support",
    ],
  },
  proPlus: {
    name: "Pro Plus",
    priceKey: "proPlus",
    generations: "60 generations / month",
    features: [
      "Everything in Pro",
      "60 generations per month",
      "Advanced Analytics",
      "Early Access to New Features",
    ],
  },
};

function CheckIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8l3 3 7-7" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UpiIcon() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 40 20" fill="none" aria-hidden>
      <text x="0" y="15" fontSize="13" fontWeight="700" fill="#5F259F" fontFamily="Arial, sans-serif">UPI</text>
    </svg>
  );
}

export function PaymentModal({ open, planKey, initialBilling = "monthly", onClose }: PaymentModalProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [payClicked, setPayClicked] = useState(false);
  const { region, regionId } = usePricingRegion();

  if (!open) return null;

  const plan = PLAN_INFO[planKey];
  const prices = region.prices[plan.priceKey];
  const amount = billing === "annual" ? prices.annual : prices.monthly;
  const period = billing === "annual" ? "year" : "month";
  const isIndia = regionId === "india";

  const handlePayClick = () => setPayClicked(true);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-[#0A1628]/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md rounded-3xl border bg-white shadow-2xl"
        style={{ borderColor: "rgba(0,198,167,0.3)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-3xl px-6 py-5"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #132a4a 100%)` }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: TEAL }}>
              Upgrade Plan
            </p>
            <h2
              id="payment-modal-title"
              className="mt-0.5 text-xl font-bold text-white"
            >
              {plan.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Billing toggle */}
          <div
            className="mb-5 inline-flex w-full rounded-xl p-1"
            style={{ background: "#f1f5f9" }}
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition"
              style={{
                background: billing === "monthly" ? "#fff" : "transparent",
                color: billing === "monthly" ? NAVY : "#64748b",
                boxShadow: billing === "monthly" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition"
              style={{
                background: billing === "annual" ? "#fff" : "transparent",
                color: billing === "annual" ? NAVY : "#64748b",
                boxShadow: billing === "annual" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Annual
              <span
                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: "rgba(0,198,167,0.15)", color: "#0A8F7A" }}
              >
                -17%
              </span>
            </button>
          </div>

          {/* Price */}
          <div className="mb-5 rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid rgba(0,198,167,0.15)" }}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ color: NAVY }}>
                  {formatRegionalPrice(region, amount, period)}
                </p>
                <p className="mt-1 text-xs font-medium" style={{ color: "#64748b" }}>
                  {plan.generations}
                </p>
              </div>
              {billing === "annual" && (
                <p className="text-xs font-semibold" style={{ color: "#0A8F7A" }}>
                  2 months free
                </p>
              )}
            </div>
          </div>

          {/* Features */}
          <ul className="mb-5 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#374151" }}>
                <CheckIcon />
                {f}
              </li>
            ))}
          </ul>

          {/* Payment buttons / Coming soon */}
          {payClicked ? (
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: "rgba(0,198,167,0.08)", border: "1px solid rgba(0,198,167,0.3)" }}
            >
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "rgba(0,198,167,0.15)" }}
              >
                <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <p className="font-bold" style={{ color: NAVY }}>
                Payments Launching Soon!
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
                We are finalising our payment system and will be live within 24 hours. You will receive an email notification as soon as payments are ready.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: NAVY }}
              >
                Got it
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handlePayClick}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: NAVY }}
              >
                <LockIcon />
                Pay with Card
              </button>

              {isIndia && (
                <button
                  type="button"
                  onClick={handlePayClick}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold transition hover:bg-slate-50"
                  style={{ borderColor: "#5F259F", color: "#5F259F" }}
                >
                  <UpiIcon />
                  Pay with UPI
                </button>
              )}

              <p className="flex items-center justify-center gap-1.5 text-xs" style={{ color: "#94a3b8" }}>
                <LockIcon />
                Secure payment · Cancel anytime
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
