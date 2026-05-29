"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/ui/container";
import { PaymentModal, type UpgradePlanKey } from "@/components/payment/payment-modal";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import {
  formatRegionalPrice,
  getCountryFlag,
  PRICING_REGION_LIST,
  type PaidPlanKey,
  type PricingRegion,
} from "@/lib/pricing-regions";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

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
    generations: "3 per month",
    features: [
      "3 Lesson Plans",
      "3 PPT Downloads",
      "3 Worksheets",
      "Basic Activity Sheet AFL",
      "Standard Themes",
      "Email Support",
    ],
    cta: { label: "Get Started Free", href: "/auth" },
    variant: "light",
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    priceKey: "pro",
    upgradeKey: "pro",
    generations: "30 per month",
    features: [
      "Everything in Free",
      "Unlimited within 30 generations",
      "All Activity Sheet AFL Tools",
      "All 5 Themes",
      "Question Paper Generator",
      "Blueprint Generator",
      "Differentiated Worksheet Pack",
      "Global Curriculum Framework Alignment",
      "Priority Support",
    ],
    cta: { label: "Start Pro Plan", href: "/auth" },
    variant: "featured",
  },
  {
    id: "pro-plus",
    name: "Pro Plus",
    badge: "Best Value",
    priceKey: "proPlus",
    upgradeKey: "proPlus",
    generations: "60 per month",
    features: [
      "Everything in Pro",
      "60 generations per month",
      "Advanced Analytics",
      "Early Access to New Features",
    ],
    cta: { label: "Start Pro Plus", href: "/auth" },
    variant: "light",
  },
];

const SCHOOL_PLAN_DEFS: PlanDef[] = [
  {
    id: "school-starter",
    name: "School Starter",
    priceKey: "schoolStarter",
    generations: "Unlimited for all teachers",
    teachers: "Up to 10 teachers",
    features: [
      "Everything in Pro Plus",
      "HOD Dashboard",
      "Department Groups",
      "School Branding on PPTs",
      "Usage Analytics",
      "Priority Support",
    ],
    cta: { label: "Contact Sales", href: "mailto:support@layah.in?subject=School%20Starter%20Plan" },
    variant: "school",
  },
  {
    id: "school-pro",
    name: "School Pro",
    priceKey: "schoolPro",
    generations: "Unlimited for all teachers",
    teachers: "Up to 30 teachers",
    features: [
      "Everything in School Starter",
      "Lesson Plan Approval System",
      "Advanced Analytics",
      "Dedicated Account Manager",
    ],
    cta: { label: "Contact Sales", href: "mailto:support@layah.in?subject=School%20Pro%20Plan" },
    variant: "school",
  },
  {
    id: "school-enterprise",
    name: "School Enterprise",
    priceKey: "schoolEnterprise",
    generations: "Unlimited",
    teachers: "Unlimited teachers",
    features: [
      "Everything in School Pro",
      "Custom School Branding",
      "API Access",
      "Custom Feature Requests",
      "SLA Support",
    ],
    cta: {
      label: "Contact Us",
      href: "mailto:support@layah.in?subject=School%20Enterprise%20Plan",
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
        style={{ color: lightText ? "#fff" : NAVY }}
      >
        Free Forever
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
          style={{ color: lightText ? "rgba(255,255,255,0.5)" : "#94a3b8" }}
        >
          {formatRegionalPrice(region, prices.monthly * 12, "year")}
        </p>
      ) : null}
      <p
        className="text-3xl font-extrabold tracking-tight"
        style={{ color: lightText ? "#fff" : NAVY }}
      >
        {formatRegionalPrice(region, amount, period)}
      </p>
      {billing === "annual" ? (
        <span
          className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
          style={{ background: "rgba(0,198,167,0.2)", color: TEAL }}
        >
          Save 2 months
        </span>
      ) : null}
      {billing === "monthly" ? (
        <p
          className="mt-2 text-sm"
          style={{ color: lightText ? "rgba(255,255,255,0.65)" : "#64748b" }}
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
  const ctaClassName =
    "mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-semibold transition hover:opacity-95";
  const ctaStyle = isFeatured
    ? { background: TEAL, color: NAVY }
    : plan.id === "school-enterprise"
      ? { background: NAVY, color: "#fff", border: `2px solid ${TEAL}` }
      : { background: NAVY, color: "#fff" };

  return (
    <article
      className={`relative flex flex-col rounded-3xl p-7 shadow-sm transition hover:shadow-lg sm:p-8 ${
        isFeatured ? "lg:scale-[1.02] lg:shadow-xl" : ""
      }`}
      style={
        isFeatured
          ? {
              background: `linear-gradient(160deg, ${NAVY} 0%, #132a4a 55%, ${NAVY} 100%)`,
              border: `2px solid ${TEAL}`,
              boxShadow: `0 20px 50px rgba(0,198,167,0.18)`,
            }
          : isSchool
            ? { background: "#fff", border: `2px solid ${NAVY}` }
            : { background: "#fff", border: `1px solid rgba(10,22,40,0.12)` }
      }
    >
      {plan.badge ? (
        <span
          className="absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{
            background: plan.badge === "Best Value" ? NAVY : TEAL,
            color: plan.badge === "Best Value" ? "#fff" : NAVY,
          }}
        >
          {plan.badge}
        </span>
      ) : null}

      <h3 className="text-xl font-bold" style={{ color: lightText ? "#fff" : NAVY }}>
        {plan.name}
      </h3>

      <div className="mt-3">
        <PlanPrice plan={plan} region={region} billing={billing} lightText={lightText} />
      </div>

      <p className="mt-4 text-sm font-semibold" style={{ color: lightText ? TEAL : "#0A8F7A" }}>
        {plan.generations}
      </p>
      {plan.teachers ? (
        <p className="mt-1 text-sm" style={{ color: lightText ? "rgba(255,255,255,0.75)" : "#64748b" }}>
          {plan.teachers}
        </p>
      ) : null}

      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-sm leading-snug"
            style={{ color: lightText ? "rgba(255,255,255,0.9)" : "#334155" }}
          >
            <CheckIcon className={lightText ? "text-[#00C6A7]" : "text-[#0A8F7A]"} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {plan.upgradeKey && onUpgrade ? (
        <button
          type="button"
          onClick={() => onUpgrade(plan.upgradeKey!)}
          className={ctaClassName}
          style={ctaStyle}
        >
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
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; planKey: UpgradePlanKey }>({
    open: false,
    planKey: "pro",
  });
  const { region, regionId, countryCode, countryName, loading, setRegionManually } =
    usePricingRegion();
  const isAnnual = billing === "annual";

  const openPayment = (planKey: UpgradePlanKey) =>
    setPaymentModal({ open: true, planKey });
  const closePayment = () =>
    setPaymentModal((s) => ({ ...s, open: false }));

  const locationLabel =
    countryName ??
    region.selectorLabel.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const displayFlag = getCountryFlag(countryCode, region);

  return (
    <main
      className="min-h-screen pb-24 pt-10"
      style={{ background: "linear-gradient(180deg, #eef2f7 0%, #f7f9fc 35%, #ffffff 70%)" }}
    >
      <Container>
        <header className="mx-auto max-w-3xl text-center">
          <p
            className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}
          >
            Pricing
          </p>
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            style={{ color: NAVY }}
          >
            Plans for every teacher and school
          </h1>
          <p className="mt-4 text-base sm:text-lg" style={{ color: "#4A5568" }}>
            Start free. Upgrade when you are ready. Schools get unlimited generations for every teacher.
          </p>
        </header>

        <div className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-3 sm:max-w-none">
          {loading ? (
            <p className="text-sm font-medium" style={{ color: "#64748b" }}>
              Detecting your region…
            </p>
          ) : (
            <p
              className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm"
              style={{ background: "#fff", border: `1px solid rgba(0,198,167,0.3)`, color: NAVY }}
            >
              <span className="text-lg leading-none" aria-hidden>
                {displayFlag}
              </span>
              <span>
                Showing prices in <strong>{region.currency}</strong> ({region.currencyName}) for{" "}
                <strong>{locationLabel}</strong>
              </span>
            </p>
          )}

          <label className="flex w-full max-w-sm flex-col gap-1.5 text-left sm:max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>
              Change currency
            </span>
            <select
              value={regionId}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setRegionManually(v as typeof regionId);
              }}
              disabled={loading}
              className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-medium outline-none transition"
              style={{ borderColor: "rgba(10,22,40,0.15)", color: NAVY }}
              aria-label="Select pricing currency"
            >
              {PRICING_REGION_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.flag} {r.selectorLabel}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mx-auto mt-10 flex flex-col items-center gap-3">
          <div
            className="inline-flex rounded-full p-1 shadow-sm"
            style={{ background: "#fff", border: `1px solid rgba(10,22,40,0.12)` }}
            role="group"
            aria-label="Billing period"
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className="rounded-full px-6 py-2.5 text-sm font-semibold transition"
              style={{
                background: !isAnnual ? NAVY : "transparent",
                color: !isAnnual ? "#fff" : "#64748b",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className="rounded-full px-6 py-2.5 text-sm font-semibold transition"
              style={{
                background: isAnnual ? NAVY : "transparent",
                color: isAnnual ? "#fff" : "#64748b",
              }}
            >
              Annual
            </button>
          </div>
          {isAnnual ? (
            <p
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ background: "rgba(0,198,167,0.12)", color: "#0A8F7A" }}
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
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
            {TEACHER_PLAN_DEFS.map((plan) => (
              <PricingCard key={plan.id} plan={plan} region={region} billing={billing} onUpgrade={openPayment} />
            ))}
          </div>
        </section>

        <section
          className="mt-20 rounded-3xl p-6 sm:p-10"
          style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, #132a4a 100%)`,
            border: `1px solid rgba(0,198,167,0.25)`,
          }}
        >
          <h2 className="text-center text-sm font-bold uppercase tracking-widest text-[#00C6A7]">
            For schools
          </h2>
          <p className="mt-2 text-center text-lg font-semibold text-white sm:text-xl">
            School &amp; district plans
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-white/65">
            Unlimited generations for every teacher on your plan. Enterprise includes custom branding and API access.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {SCHOOL_PLAN_DEFS.map((plan) => (
              <PricingCard key={plan.id} plan={plan} region={region} billing={billing} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/school-register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold transition hover:opacity-90"
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
              Get School Plan
            </Link>
            <p className="mt-3 text-sm text-white/50">
              Register your school and our team will set you up within 24 hours
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
                className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md open:shadow-md"
                style={{ borderColor: "rgba(0,198,167,0.25)" }}
              >
                <summary
                  className="cursor-pointer list-none text-base font-semibold marker:content-none"
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
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </Container>

      <PaymentModal
        open={paymentModal.open}
        planKey={paymentModal.planKey}
        initialBilling={billing}
        onClose={closePayment}
      />
    </main>
  );
}
