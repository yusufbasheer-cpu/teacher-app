"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/ui/container";
import { PaymentModal, type UpgradePlanKey } from "@/components/payment/payment-modal";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import {
  formatRegionalPrice,
  type PaidPlanKey,
  type PricingRegion,
} from "@/lib/pricing-regions";
import { NAVY, TEAL, TEAL_DARK, TEXT_INVERSE, TEXT_MUTED, withAlpha } from "@/lib/design-tokens";
import { PLANS } from "@/lib/plans";
import { BorderTrail } from "@/components/motion-primitives/border-trail";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

type Billing = "monthly" | "annual";

type PlanDef = {
  id: string;
  name: string;
  badge?: "Most Popular" | "Best Value";
  priceKey: PaidPlanKey | null;
  upgradeKey?: UpgradePlanKey;
  generations: string;
  teachers?: string;
  features: readonly string[];
  cta: { label: string; href: string };
  variant?: "light" | "featured" | "school";
};

const TEACHER_PLAN_DEFS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    priceKey: null,
    generations: `${PLANS.free.generationsLimit} per month`,
    features: [
      `${PLANS.free.generationsLimit} Lesson Plans per month`,
      "PPT Slides included",
      "Class details & curriculum setup",
      "Standard Themes",
      "Email Support",
    ],
    cta: { label: "Get Started Free", href: "/signup" },
    variant: "light",
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    priceKey: "pro",
    upgradeKey: "pro",
    generations: `${PLANS.pro.generationsLimit} per month`,
    features: [
      "Everything in Free",
      `${PLANS.pro.generationsLimit} generations per month`,
      "Upload your own source material (PDF, text)",
      "Full Assessment for Learning library",
      "Teaching & Learning Strategy selector",
      "Worksheets, Assessments, Homework & Teacher Notes",
      "Question Paper Generator + Blueprint Generator",
      "Differentiated Worksheet Pack",
      "All 5 Themes",
      "Global Curriculum Framework Alignment",
      "Priority Support",
    ],
    cta: { label: "Join Waitlist", href: "/signup" },
    variant: "featured",
  },
  {
    id: "pro-plus",
    name: "Pro Plus",
    badge: "Best Value",
    priceKey: "proPlus",
    upgradeKey: "proPlus",
    generations: `${PLANS.pro_plus.generationsLimit} per month`,
    features: [
      "Everything in Pro",
      `${PLANS.pro_plus.generationsLimit} generations per month`,
      "Advanced Analytics",
      "Early Access to New Features",
    ],
    cta: { label: "Join Waitlist", href: "/signup" },
    variant: "light",
  },
];

const SCHOOL_PLAN_DEFS: PlanDef[] = [
  {
    id: "schools-institutes",
    name: "Schools & Institutes",
    priceKey: null,
    generations: "Unlimited generations for every teacher",
    features: [
      "HOD Dashboard & Department Groups",
      "School Branding on PPTs",
      "Usage Analytics",
      "Custom Feature Requests & API Access",
      "Dedicated Account Manager & SLA Support",
    ],
    cta: {
      label: "Contact Sales",
      href: "mailto:info@layah.in?subject=School%2FInstitute%20Plan%20Enquiry",
    },
    variant: "school",
  },
];

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts — cancel monthly or annual plans whenever you like.",
  },
  {
    q: "What counts as a generation?",
    a: "Each full AI run (lesson plan, question paper, worksheet pack, etc.) counts as one generation toward your monthly limit.",
  },
  {
    q: "Do school plans share one login?",
    a: "No. Each teacher gets their own account under your school plan, with unlimited generations for the school.",
  },
  {
    q: "How does annual billing save money?",
    a: "Annual plans are priced at 10 months — you get 2 months free compared to paying monthly.",
  },
] as const;

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`size-5 shrink-0 ${className}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 10l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanPrice({
  plan,
  region,
  billing,
  lightText,
}: {
  plan: PlanDef;
  region: PricingRegion;
  billing: Billing;
  lightText?: boolean;
}) {
  if (!plan.priceKey) {
    return (
      <p
        className="text-3xl font-extrabold tracking-tight"
        style={{ color: lightText ? TEXT_INVERSE : NAVY }}
      >
        {plan.variant === "school" ? "Custom Pricing" : "Free Forever"}
      </p>
    );
  }

  const prices = region.prices[plan.priceKey];
  const amount = billing === "annual" ? prices.annual : prices.monthly;
  const period = billing === "annual" ? "year" : "month";
  const showStrike = billing === "annual";

  return (
    <div>
      {showStrike ? (
        <p
          className="text-sm line-through"
          style={{ color: lightText ? withAlpha(TEXT_INVERSE, 0.5) : "var(--text-disabled)" }}
        >
          {formatRegionalPrice(region, prices.monthly * 12, "year")}
        </p>
      ) : null}
      <p
        className="text-3xl font-extrabold tracking-tight"
        style={{ color: lightText ? TEXT_INVERSE : NAVY }}
      >
        {formatRegionalPrice(region, amount, period)}
      </p>
      {billing === "annual" ? (
        <span
          className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
          style={{ background: "color-mix(in oklch, var(--brand) 20%, transparent)", color: TEAL }}
        >
          Save 2 months
        </span>
      ) : null}
      {billing === "monthly" ? (
        <p
          className="mt-2 text-sm"
          style={{ color: lightText ? withAlpha(TEXT_INVERSE, 0.65) : "var(--text-secondary)" }}
        >
          Or {formatRegionalPrice(region, prices.annual, "year")}
        </p>
      ) : null}
    </div>
  );
}

function PricingCard({
  plan,
  region,
  billing,
  onUpgrade,
}: {
  plan: PlanDef;
  region: PricingRegion;
  billing: Billing;
  onUpgrade?: (key: UpgradePlanKey) => void;
}) {
  const isFeatured = plan.variant === "featured";
  const isSchool = plan.variant === "school";
  const lightText = isFeatured;
  const isMailto = plan.cta.href.startsWith("mailto:");
  const ctaClassName = `mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-semibold transition hover:opacity-95 ${FOCUS_RING}`;
  const ctaStyle = isFeatured
    ? { background: TEAL, color: NAVY }
    : plan.id === "schools-institutes"
      ? { background: NAVY, color: TEXT_INVERSE, border: `2px solid ${TEAL}` }
      : { background: NAVY, color: TEXT_INVERSE };

  return (
    <article
      className={`relative flex flex-col rounded-3xl p-7 shadow-sm transition duration-300 hover:shadow-lg sm:p-8 ${
        isFeatured ? "lg:-translate-y-3 lg:scale-[1.04] lg:hover:-translate-y-4" : ""
      }`}
      style={
        isFeatured
          ? {
              background: `linear-gradient(160deg, ${NAVY} 0%, var(--l-gray-11) 55%, ${NAVY} 100%)`,
              border: `2px solid ${TEAL}`,
              boxShadow: `0 24px 60px -12px color-mix(in oklch, var(--brand) 35%, transparent), 0 0 0 1px color-mix(in oklch, var(--brand) 15%, transparent)`,
            }
          : isSchool
            ? { background: "var(--surface-raised)", border: `2px solid ${NAVY}` }
            : { background: "var(--surface-raised)", border: `1px solid color-mix(in oklch, var(--text) 12%, transparent)` }
      }
    >
      {plan.badge ? (
        <span
          className="absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{
            background: plan.badge === "Best Value" ? NAVY : TEAL,
            color: plan.badge === "Best Value" ? TEXT_INVERSE : NAVY,
          }}
        >
          {plan.badge}
        </span>
      ) : null}

      <h3 className="text-xl font-bold" style={{ color: lightText ? TEXT_INVERSE : NAVY }}>
        {plan.name}
      </h3>

      <div className="mt-3">
        <PlanPrice plan={plan} region={region} billing={billing} lightText={lightText} />
      </div>

      <p className="mt-4 text-sm font-semibold" style={{ color: lightText ? TEAL : "var(--brand-active)" }}>
        {plan.generations}
      </p>
      {plan.teachers ? (
        <p className="mt-1 text-sm" style={{ color: lightText ? withAlpha(TEXT_INVERSE, 0.75) : "var(--text-secondary)" }}>
          {plan.teachers}
        </p>
      ) : null}

      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-sm leading-snug"
            style={{ color: lightText ? withAlpha(TEXT_INVERSE, 0.9) : "var(--text)" }}
          >
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: lightText ? "color-mix(in oklch, var(--brand) 22%, transparent)" : "color-mix(in oklch, var(--brand) 12%, transparent)" }}
            >
              <CheckIcon
                className={`!size-3 ${lightText ? "text-[var(--brand)]" : "text-[var(--brand-active)]"}`}
              />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {plan.upgradeKey && onUpgrade ? (
        <button
          type="button"
          onClick={() => onUpgrade(plan.upgradeKey!)}
          className={`relative ${ctaClassName}`}
          style={ctaStyle}
        >
          {isFeatured ? (
            <BorderTrail
              className="bg-[var(--text)]"
              size={40}
              style={{ boxShadow: "0 0 8px 2px color-mix(in oklch, var(--text) 50%, transparent), 0 0 16px 4px color-mix(in oklch, var(--text) 25%, transparent)" }}
            />
          ) : null}
          {plan.cta.label}
        </button>
      ) : isMailto ? (
        <a href={plan.cta.href} className={ctaClassName} style={ctaStyle}>
          {plan.cta.label}
        </a>
      ) : (
        <Link href={plan.cta.href} className={ctaClassName} style={ctaStyle}>
          {plan.cta.label}
        </Link>
      )}
    </article>
  );
}

export function PricingPage() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<UpgradePlanKey>("pro");
  const { region } = usePricingRegion();
  const isAnnual = billing === "annual";

  const openPayment = (planKey: UpgradePlanKey) => { setPaymentPlan(planKey); setPaymentOpen(true); };

  return (
    <main className="min-h-screen bg-[var(--surface)] pb-24">
      <Container>
        {/* Standard secondary-page hero: badge + headline + subtext, matching
            the landing page's hero pattern. */}
        <section className="mx-auto max-w-[820px] px-4 pb-4 pt-14 text-center sm:px-6">
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{ background: "color-mix(in oklch, var(--brand) 10%, transparent)", color: TEAL_DARK }}
          >
            Pricing
          </span>
          <h1
            className="mt-5 font-extrabold leading-[1.1] tracking-tight"
            style={{ color: NAVY, fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            Simple pricing for teachers and schools
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: TEXT_MUTED }}>
            Start free. Upgrade when you are ready. Schools get unlimited generations for every teacher.
          </p>
        </section>

        <div className="mx-auto mt-6 flex justify-center">
          <p
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm"
            style={{ background: "var(--surface-raised)", border: `1px solid color-mix(in oklch, var(--brand) 30%, transparent)`, color: NAVY }}
          >
            <span className="text-lg leading-none" aria-hidden>{region.flag}</span>
            <span>
              Prices shown in <strong>{region.currency}</strong> ({region.currencyName})
            </span>
          </p>
        </div>

        <div className="mx-auto mt-10 flex flex-col items-center gap-3">
          <div
            className="inline-flex rounded-full p-1 shadow-sm"
            style={{ background: "var(--surface-raised)", border: `1px solid color-mix(in oklch, var(--text) 12%, transparent)` }}
            role="group"
            aria-label="Billing period"
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-6 py-3 text-sm font-semibold transition ${FOCUS_RING}`}
              style={{
                background: !isAnnual ? NAVY : "transparent",
                color: !isAnnual ? TEXT_INVERSE : "var(--text-secondary)",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`rounded-full px-6 py-3 text-sm font-semibold transition ${FOCUS_RING}`}
              style={{
                background: isAnnual ? NAVY : "transparent",
                color: isAnnual ? TEXT_INVERSE : "var(--text-secondary)",
              }}
            >
              Annual
            </button>
          </div>
          {isAnnual ? (
            <p
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ background: "color-mix(in oklch, var(--brand) 12%, transparent)", color: "var(--brand-active)" }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: TEAL }} aria-hidden />
              Save 2 months on all annual plans
            </p>
          ) : null}
        </div>

        <section className="mt-14">
          <h2 className="text-center text-sm font-bold uppercase tracking-widest" style={{ color: TEAL }}>
            For teachers
          </h2>
          <p className="mt-2 text-center text-lg font-semibold sm:text-xl" style={{ color: NAVY }}>
            Individual plans
          </p>
          <div className="mt-8 grid gap-6 pt-2 md:grid-cols-2 lg:pt-4 xl:grid-cols-3 xl:items-stretch">
            {TEACHER_PLAN_DEFS.map((plan) => (
              <PricingCard key={plan.id} plan={plan} region={region} billing={billing} onUpgrade={openPayment} />
            ))}
          </div>
        </section>

        <section
          className="mt-20 rounded-3xl p-6 sm:p-10"
          style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, var(--l-gray-11) 100%)`,
            border: `1px solid color-mix(in oklch, var(--brand) 25%, transparent)`,
          }}
        >
          <h2 className="text-center text-sm font-bold uppercase tracking-widest text-[var(--brand)]">
            For schools
          </h2>
          <p className="mt-2 text-center text-lg font-semibold text-white sm:text-xl">
            School &amp; district plans
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-white/65">
            Unlimited generations for every teacher on your plan. Enterprise includes custom branding and API access.
          </p>
          <div className="mx-auto mt-10 max-w-md">
            {SCHOOL_PLAN_DEFS.map((plan) => (
              <PricingCard key={plan.id} plan={plan} region={region} billing={billing} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-white/50">Prefer to self-serve?</p>
            <Link
              href="/school-register"
              className={`mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--text)]`}
              style={{ background: TEAL, color: NAVY }}
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              Register Your School
            </Link>
            <p className="mt-3 text-sm text-white/50">
              Set up your own plan and our team will onboard you within 24 hours
            </p>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: NAVY }}>
            Frequently asked questions
          </h2>
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border bg-[var(--surface)] p-5 shadow-sm transition hover:shadow-md open:shadow-md"
                style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}
              >
                <summary
                  className={`cursor-pointer list-none rounded-lg text-base font-semibold marker:content-none ${FOCUS_RING}`}
                  style={{ color: NAVY }}
                >
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span
                      className="text-xl font-normal transition group-open:rotate-45"
                      style={{ color: TEAL }}
                      aria-hidden
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </Container>

      <PaymentModal
        open={paymentOpen}
        planKey={paymentPlan}
        initialBilling={billing}
        onClose={() => setPaymentOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </main>
  );
}
