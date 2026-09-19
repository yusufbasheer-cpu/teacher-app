"use client";

import { useState } from "react";
import { Check, CreditCard, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { getAuthHeaders } from "@/lib/auth-headers";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import { PRICING_REGIONS, formatRegionalPrice, type PaidPlanKey } from "@/lib/pricing-regions";
import { PLANS } from "@/lib/plans";
import { useErrorToast } from "@/hooks/use-error-toast";

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


/** Mount a fresh checkout each time, so the chosen plan and billing always agree. */
export function PaymentModal(props: PaymentModalProps) {
  return props.open ? <PaymentDialog key={props.planKey} {...props} /> : null;
}

function PaymentDialog({ planKey, initialBilling = "monthly", onClose, onSuccess }: PaymentModalProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [status, setStatus] = useState<"idle" | "loading" | "checkout" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useErrorToast();
  const { regionId } = usePricingRegion();
  const plan = PLAN_INFO[planKey];
  const prices = INR_REGION.prices[plan.priceKey];
  const amount = billing === "annual" ? prices.annual : prices.monthly;
  const isIndia = regionId === "india";
  const isSubscription = planKey === "pro" && billing === "monthly";
  const busy = status === "loading" || status === "checkout";

  const handlePayClick = async (method: "card" | "upi") => {
    if (busy) return;
    if (!window.Razorpay) {
      setStatus("error");
      setErrorMessage("Payment is still loading. Please try again in a moment.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      const { data: { user } } = await supabase.auth.getUser();
      const endpoint = isSubscription ? "/api/razorpay/create-subscription" : "/api/razorpay/create-order";
      const payload = isSubscription
        ? { planType: "pro" }
        : { planType: RAZORPAY_PLAN_TYPE[planKey], billingPeriod: billing === "annual" ? "yearly" : "monthly" };
      const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start checkout.");

      const checkout = new window.Razorpay({
        key: data.keyId,
        ...(isSubscription
          ? { subscription_id: data.subscriptionId }
          : { order_id: data.orderId, amount: data.amount, currency: data.currency }),
        name: "Layah",
        description: isSubscription ? "Pro — Monthly (auto-renews every 30 days)" : `${plan.name} — ${billing === "annual" ? "Annual" : "Monthly"}`,
        image: LAYAH_LOGO_URL,
        prefill: { email: user?.email ?? undefined, method },
        theme: { color: "#4f46e5" },
        handler: async (paymentResponse) => {
          setStatus("loading");
          try {
            const verifyHeaders = await getAuthHeaders();
            const verifyResponse = await fetch(
              isSubscription ? "/api/razorpay/verify-subscription" : "/api/razorpay/verify-payment",
              { method: "POST", headers: verifyHeaders, body: JSON.stringify(paymentResponse) },
            );
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verified.error ?? "Payment verification failed.");
            setStatus("success");
            onSuccess?.();
          } catch (error) {
            setStatus("error");
            setErrorMessage(error instanceof Error ? error.message : "Payment verification failed.");
          }
        },
        modal: { ondismiss: () => setStatus((current) => current === "checkout" ? "idle" : current) },
      });
      setStatus("checkout");
      checkout.open();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not start checkout.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }} modal={status !== "checkout"}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-md sm:p-7" showCloseButton={!busy}>
        <DialogHeader>
          <p className="page-kicker">Your teaching workspace</p>
          <DialogTitle className="text-2xl font-semibold tracking-tight">{status === "success" ? "You’re ready to go." : `Choose ${plan.name}`}</DialogTitle>
          <DialogDescription>{status === "success" ? "Your payment has been verified and your plan is active." : "Review your plan and billing before continuing to secure checkout."}</DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div role="status" className="space-y-5 py-3"><div className="rounded-xl border border-line bg-canvas p-5"><Check className="mb-3 size-6 text-brand-text" aria-hidden /><p className="font-medium">{plan.name} is active</p><p className="mt-2 text-sm text-muted">Your new limits and features are ready. You can manage your plan in Settings.</p></div><Button className="w-full" onClick={onClose}>Continue</Button></div>
        ) : (
          <>
            <div className="flex gap-1 rounded-lg bg-canvas p-1" role="group" aria-label="Payment billing period">
              {(["monthly", "annual"] as const).map((period) => (
                <button key={period} type="button" disabled={busy} aria-pressed={billing === period} onClick={() => { setBilling(period); setErrorMessage(null); setStatus("idle"); }} className="min-h-10 flex-1 rounded-md px-3 text-sm font-medium text-muted transition-colors duration-150 aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 motion-reduce:transition-none">
                  {period === "monthly" ? "Monthly" : "Annual · save 2 months"}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-line bg-canvas p-5" aria-live="polite">
              <p className="text-2xl font-semibold tracking-tight">{formatRegionalPrice(INR_REGION, amount, billing === "annual" ? "year" : "month")}</p>
              <p className="mt-2 text-sm text-muted">{plan.generations}</p>
              {regionId !== "india" ? <p className="mt-3 text-xs leading-relaxed text-muted">Your payment is charged in Indian Rupees (INR). Your bank may apply a currency conversion.</p> : null}
              <p className="mt-3 text-xs leading-relaxed text-muted">{isSubscription ? "Renews automatically every 30 days until cancelled. Manage your subscription from Settings." : billing === "annual" ? "A single payment for one year of access." : "A single payment for one month of access."}</p>
            </div>
            <ul className="space-y-2.5 py-1">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm text-muted"><Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{feature}</li>)}</ul>
            {errorMessage ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">{errorMessage}</p> : null}
            <div className="space-y-3 border-t border-line pt-5">
              <Button className="w-full" disabled={busy} onClick={() => void handlePayClick("card")}>{busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}{status === "checkout" ? "Complete your secure checkout" : status === "loading" ? "Processing…" : "Continue with card"}</Button>
              {isIndia ? <Button variant="outline" className="w-full" disabled={busy} onClick={() => void handlePayClick("upi")}>Pay with UPI</Button> : null}
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><LockKeyhole className="size-3.5" aria-hidden />Secure checkout with Razorpay</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

