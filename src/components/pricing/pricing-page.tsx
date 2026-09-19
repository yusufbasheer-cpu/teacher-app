"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Plus, School } from "lucide-react";
import { PublicPage } from "@/components/marketing/public-page";
import { Button, buttonVariants } from "@/components/ui/button";
import { PaymentModal, type UpgradePlanKey } from "@/components/payment/payment-modal";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import { useErrorToast } from "@/hooks/use-error-toast";
import { formatRegionalPrice, PRICING_REGION_LIST, isPricingRegionId, type PricingRegion } from "@/lib/pricing-regions";
import { PLANS } from "@/lib/plans";
import { supabase } from "@/lib/supabase";

type Billing = "monthly" | "annual";
type Plan = { id: "free" | UpgradePlanKey; name: string; description: string; limit: number | null; features: string[] };

const TEACHER_PLANS: Plan[] = [
  { id: "free", name: "Free", description: "Find your lesson planning rhythm.", limit: PLANS.free.generationsLimit, features: ["Lesson plans and presentation slides", "Class details and curriculum setup", "Standard presentation themes", "Email support"] },
  { id: "pro", name: "Pro", description: "Prepare the complete teaching package.", limit: PLANS.pro.generationsLimit, features: ["Everything in Free", "Upload your source material", "Worksheets, assessments and homework", "Teacher notes and the full AFL library", "Question papers and blueprints", "Differentiated worksheet packs", "All presentation themes", "Teaching strategies and global frameworks", "Priority support"] },
  { id: "proPlus", name: "Pro Plus", description: "More room for a busy teaching schedule.", limit: PLANS.pro_plus.generationsLimit, features: ["Everything in Pro", "Twice the monthly generations", "Advanced analytics", "Early access to new features"] },
];
const FAQ = [
  { q: "What counts as a generation?", a: "Each AI run, such as a lesson package, question paper or worksheet pack, counts as one generation toward your monthly limit." },
  { q: "Can I cancel my subscription?", a: "You can manage and cancel an active subscription from Settings. Your checkout shows the billing period and whether the plan renews automatically." },
  { q: "How does annual billing work?", a: "You pay once for the year. Annual pricing is equivalent to ten monthly payments, saving two months compared with paying monthly." },
  { q: "Does each teacher need an account?", a: "Yes. Teachers have individual accounts under a school plan, with unlimited generations and access managed by the school." },
];

function Price({ plan, region, billing }: { plan: Plan; region: PricingRegion; billing: Billing }) {
  if (plan.id === "free") return <p className="text-3xl font-semibold tracking-tight">Free</p>;
  const prices = region.prices[plan.id];
  return <div><p className="text-2xl font-semibold tracking-tight">{formatRegionalPrice(region, prices[billing], billing === "annual" ? "year" : "month")}</p><p className="mt-1 text-xs text-muted">{billing === "annual" ? "Billed annually · save 2 months" : "Monthly billing"}</p></div>;
}

export function PricingPage() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [paymentPlan, setPaymentPlan] = useState<UpgradePlanKey | null>(null);
  const [openingPlan, setOpeningPlan] = useState<UpgradePlanKey | null>(null);
  const [error, setError] = useErrorToast<string>("");
  const { region, regionId, setRegionManually, loading: regionLoading } = usePricingRegion();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selected = params.get("plan");
    if (selected !== "pro" && selected !== "proPlus") return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      setBilling(params.get("billing") === "annual" ? "annual" : "monthly");
      setPaymentPlan(selected);
      params.delete("plan");
      params.delete("billing");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", `/pricing${query ? `?${query}` : ""}${window.location.hash}`);
    });
    return () => { cancelled = true; };
  }, []);

  const openPayment = async (plan: UpgradePlanKey) => {
    if (openingPlan) return;
    setError("");
    setOpeningPlan(plan);
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!data.session) {
        const next = `/pricing?plan=${plan}&billing=${billing}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setPaymentPlan(plan);
    } catch {
      setError("We couldn’t open checkout. Please try again.");
    } finally {
      setOpeningPlan(null);
    }
  };

  return (
    <>
      <PublicPage eyebrow="Plans & pricing" title="A plan for the way you teach." description="Start with the essentials. Choose more resources and capacity as your teaching needs grow.">
        <section aria-labelledby="teacher-plans-title">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div><h2 id="teacher-plans-title" className="section-heading">For individual teachers</h2><p className="mt-2 text-sm text-muted">One account. Your teaching workspace.</p></div>
            <div className="inline-flex gap-1 rounded-lg border border-line bg-surface p-1" role="group" aria-label="Billing period">
              {(["monthly", "annual"] as const).map((period) => <button key={period} type="button" aria-pressed={billing === period} onClick={() => setBilling(period)} className="min-h-10 rounded-md px-4 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink aria-pressed:bg-brand/10 aria-pressed:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none">{period === "monthly" ? "Monthly" : "Annual · save 2 months"}</button>)}
            </div>
          </div>
          {error ? <p role="alert" className="mb-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-5 lg:grid-cols-3">
            {TEACHER_PLANS.map((plan) => (
              <article key={plan.id} className={`flex flex-col rounded-xl border bg-surface p-6 sm:p-7 ${plan.id === "pro" ? "border-brand ring-1 ring-brand/15" : "border-line"}`}>
                <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">{plan.name}</h3>{plan.id === "pro" ? <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand-text">Complete toolkit</span> : null}</div>
                <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted">{plan.description}</p>
                <div className="mt-6 min-h-16" aria-live="polite">{regionLoading && plan.id !== "free" ? <p className="text-sm text-muted">Loading local pricing…</p> : <Price plan={plan} region={region} billing={billing} />}</div>
                <p className="mt-4 text-sm font-medium">{plan.limit} generations per month</p>
                {plan.id === "free" ? <Link href="/lesson-plan" className={buttonVariants({ variant: "outline", className: "mt-5 w-full" })}>Start free</Link> : <Button variant={plan.id === "pro" ? "default" : "outline"} className="mt-5 w-full" disabled={openingPlan !== null || regionLoading} onClick={() => void openPayment(plan.id as UpgradePlanKey)}>{openingPlan === plan.id ? "Opening…" : `Choose ${plan.name}`}</Button>}
                <ul className="mt-6 space-y-3 border-t border-line pt-6">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted"><Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{feature}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4 text-xs text-muted">
            <p className="max-w-lg leading-relaxed">Prices are displayed for your region. Checkout is billed in INR; you can review the final amount before paying. Generation limits renew monthly on both billing periods.</p>
            <label className="flex items-center gap-2">Display currency<select aria-label="Display pricing region and currency" value={regionId} onChange={(event) => { if (isPricingRegionId(event.target.value)) setRegionManually(event.target.value); }} className="min-h-9 max-w-48 rounded-md border border-line bg-surface px-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand">{PRICING_REGION_LIST.map((item) => <option key={item.id} value={item.id}>{item.selectorLabel}</option>)}</select></label>
          </div>
        </section>

        <section id="schools" className="mt-14 grid scroll-mt-24 gap-8 rounded-xl border border-line bg-surface p-7 sm:p-9 md:grid-cols-2">
          <div><School className="size-6 text-brand-text" aria-hidden /><p className="page-kicker mt-5">For schools & institutes</p><h2 className="mt-3 text-2xl font-semibold tracking-tight">Bring your teaching team together.</h2><p className="mt-3 text-sm leading-relaxed text-muted">Individual teacher accounts, unlimited generations and a shared view of your school’s teaching resources. Contact us for a plan that fits your team.</p><div className="mt-6 flex flex-wrap items-center gap-4"><Link href="/school-register" className={buttonVariants()}>Register your school <ArrowRight className="size-4" aria-hidden /></Link><a href="mailto:info@layah.in?subject=School%20plan%20enquiry" className="rounded text-sm font-medium text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Talk to our team</a></div></div>
          <ul className="space-y-4 md:border-l md:border-line md:pl-8">{["Unlimited generations for every teacher", "HOD dashboards and department groups", "School branding on presentations", "Usage analytics", "Custom features and API access", "Dedicated account support"].map((feature) => <li key={feature} className="flex gap-3 text-sm text-muted"><Check className="size-4 shrink-0 text-brand-text" aria-hidden />{feature}</li>)}</ul>
        </section>

        <section className="mt-14 grid gap-8 md:grid-cols-[0.6fr_1.4fr]">
          <div><h2 className="section-heading">Before you choose</h2><p className="mt-3 text-sm text-muted">Need a little more detail?</p><Link href="/faq" className="mt-3 inline-flex rounded text-sm font-medium text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Visit the help centre</Link></div>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">{FAQ.map((item) => <details key={item.q} className="group px-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-medium marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">{item.q}<Plus className="size-4 shrink-0 text-faint transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none" aria-hidden /></summary><p className="pb-5 text-sm leading-relaxed text-muted">{item.a}</p></details>)}</div>
        </section>
      </PublicPage>
      {paymentPlan ? <PaymentModal open planKey={paymentPlan} initialBilling={billing} onClose={() => setPaymentPlan(null)} onSuccess={() => window.location.assign("/settings")} /> : null}
    </>
  );
}

