"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAuthHeaders } from "@/lib/auth-headers";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import { PRICING_REGIONS, formatRegionalPrice, type PaidPlanKey } from "@/lib/pricing-regions";
import { PLANS } from "@/lib/plans";

const NAVY = "#241A12";
const TEAL = "#0E9484";

export type UpgradePlanKey = "pro" | "proPlus";

type Billing = "monthly" | "annual";

type PaymentModalProps = {
  open: boolean;
  planKey: UpgradePlanKey;
  initialBilling?: Billing;
  onClose: () => void;
  /** Called once a payment has been verified and the plan upgraded server-side. */
  onSuccess?: () => void;
};

const PLAN_INFO: Record<UpgradePlanKey, { name: string; priceKey: PaidPlanKey; generations: string; features: string[] }> = {
  pro: {
    name: "Pro",
    priceKey: "pro",
    generations: `${PLANS.pro.generationsLimit} generations / month`,
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
    generations: `${PLANS.pro_plus.generationsLimit} generations / month`,
    features: [
      "Everything in Pro",
      `${PLANS.pro_plus.generationsLimit} generations per month`,
      "Advanced Analytics",
      "Early Access to New Features",
    ],
  },
};

// Razorpay checkout only supports charging in INR today, so this modal always prices and
// charges off the India region regardless of the visitor's own (now geo-detected) pricing region.
const INR_REGION = PRICING_REGIONS.india;

const RAZORPAY_PLAN_TYPE: Record<UpgradePlanKey, "pro" | "pro_plus"> = {
  pro: "pro",
  proPlus: "pro_plus",
};

type RazorpayResponse = {
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  subscription_id?: string;
  prefill?: { email?: string; contact?: string; method?: "card" | "upi" };
  theme?: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
};

const LAYAH_LOGO_URL = "https://layah.in/Logo.png";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

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

export function PaymentModal({ open, planKey, initialBilling = "monthly", onClose, onSuccess }: PaymentModalProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { regionId } = usePricingRegion();

  if (!open) return null;

  const plan = PLAN_INFO[planKey];
  const prices = INR_REGION.prices[plan.priceKey];
  const amount = billing === "annual" ? prices.annual : prices.monthly;
  const period = billing === "annual" ? "year" : "month";
  const isIndia = regionId === "india";
  const isProMonthlySubscription = planKey === "pro" && billing === "monthly";

  const handlePayClick = async (method: "card" | "upi") => {
    if (typeof window === "undefined" || !window.Razorpay) {
      setStatus("error");
      setErrorMessage("Payment is still loading. Please try again in a moment.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const headers = await getAuthHeaders();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isProMonthlySubscription) {
        const subRes = await fetch("/api/razorpay/create-subscription", {
          method: "POST",
          headers,
          body: JSON.stringify({ planType: "pro" }),
        });
        const subData = await subRes.json();
        if (!subRes.ok) {
          throw new Error(subData.error ?? "Could not start checkout.");
        }

        const razorpay = new window.Razorpay({
          key: subData.keyId,
          name: "Layah",
          description: "Pro — Monthly (auto-renews every 30 days)",
          image: LAYAH_LOGO_URL,
          subscription_id: subData.subscriptionId,
          prefill: { email: user?.email ?? undefined, method },
          theme: { color: NAVY },
          handler: async (response) => {
            try {
              const verifyHeaders = await getAuthHeaders();
              const verifyRes = await fetch("/api/razorpay/verify-subscription", {
                method: "POST",
                headers: verifyHeaders,
                body: JSON.stringify(response),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) {
                throw new Error(verifyData.error ?? "Subscription verification failed.");
              }
              setStatus("success");
              onSuccess?.();
            } catch (err) {
              setStatus("error");
              setErrorMessage(err instanceof Error ? err.message : "Subscription verification failed.");
            }
          },
          modal: {
            ondismiss: () => setStatus("idle"),
          },
        });

        razorpay.open();
        setStatus("idle");
        return;
      }

      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers,
        body: JSON.stringify({
          planType: RAZORPAY_PLAN_TYPE[planKey],
          billingPeriod: billing === "annual" ? "yearly" : "monthly",
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error ?? "Could not start checkout.");
      }

      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Layah",
        description: `${plan.name} — ${billing === "annual" ? "Annual" : "Monthly"}`,
        image: LAYAH_LOGO_URL,
        order_id: orderData.orderId,
        prefill: { email: user?.email ?? undefined, method },
        theme: { color: NAVY },
        handler: async (response) => {
          try {
            const verifyHeaders = await getAuthHeaders();
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: verifyHeaders,
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error ?? "Payment verification failed.");
            }
            setStatus("success");
            onSuccess?.();
          } catch (err) {
            setStatus("error");
            setErrorMessage(err instanceof Error ? err.message : "Payment verification failed.");
          }
        },
        modal: {
          ondismiss: () => setStatus("idle"),
        },
      });

      razorpay.open();
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Could not start checkout.");
    }
  };

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
        className="absolute inset-0 bg-[#241A12]/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md rounded-3xl border bg-[#FAF6EF] shadow-2xl"
        style={{ borderColor: "rgba(14, 148, 132,0.3)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-3xl px-6 py-5"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #3a2a1e 100%)` }}
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
            style={{ background: "#f1e9dc" }}
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition"
              style={{
                background: billing === "monthly" ? "#fff" : "transparent",
                color: billing === "monthly" ? NAVY : "#7a6e5f",
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
                color: billing === "annual" ? NAVY : "#7a6e5f",
                boxShadow: billing === "annual" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Annual
              <span
                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: "rgba(14, 148, 132,0.15)", color: "#0B6B5F" }}
              >
                -17%
              </span>
            </button>
          </div>

          {/* Price */}
          <div className="mb-5 rounded-2xl p-4" style={{ background: "#f1e9dc", border: "1px solid rgba(14, 148, 132,0.15)" }}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ color: NAVY }}>
                  {formatRegionalPrice(INR_REGION, amount, period)}
                </p>
                <p className="mt-1 text-xs font-medium" style={{ color: "#7a6e5f" }}>
                  {plan.generations}
                </p>
              </div>
              {billing === "annual" && (
                <p className="text-xs font-semibold" style={{ color: "#0B6B5F" }}>
                  2 months free
                </p>
              )}
            </div>
            {!isIndia && (
              <p className="mt-2 text-[11px]" style={{ color: "#a79a87" }}>
                Billed in Indian Rupees (INR) via Razorpay, regardless of your local currency shown elsewhere.
              </p>
            )}
            {isProMonthlySubscription && (
              <p className="mt-2 text-[11px]" style={{ color: "#a79a87" }}>
                Auto-renews every 30 days until cancelled. Manage or cancel anytime from Settings.
              </p>
            )}
          </div>

          {/* Features */}
          <ul className="mb-5 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#2b2118" }}>
                <CheckIcon />
                {f}
              </li>
            ))}
          </ul>

          {/* Payment buttons / status */}
          {status === "success" ? (
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: "rgba(14, 148, 132,0.08)", border: "1px solid rgba(14, 148, 132,0.3)" }}
            >
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "rgba(14, 148, 132,0.15)" }}
              >
                <CheckIcon />
              </div>
              <p className="font-bold" style={{ color: NAVY }}>
                {isProMonthlySubscription
                  ? "Your Pro subscription is active!"
                  : "Your plan has been upgraded successfully!"}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
                Refresh the page to see your new limits and unlocked features.
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
              {status === "error" && errorMessage && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
              )}
              <button
                type="button"
                onClick={() => handlePayClick("card")}
                disabled={status === "loading"}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ background: NAVY }}
              >
                <LockIcon />
                {status === "loading" ? "Starting checkout…" : "Pay with Card"}
              </button>

              {isIndia && (
                <button
                  type="button"
                  onClick={() => handlePayClick("upi")}
                  disabled={status === "loading"}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold transition hover:bg-stone-50 disabled:opacity-60"
                  style={{ borderColor: "#5F259F", color: "#5F259F" }}
                >
                  <UpiIcon />
                  Pay with UPI
                </button>
              )}

              <p className="flex items-center justify-center gap-1.5 text-xs" style={{ color: "#a79a87" }}>
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
