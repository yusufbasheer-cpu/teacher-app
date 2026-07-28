"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionLabel } from "@/components/marketing/section-label";
import { WaitlistModal } from "@/components/payment/waitlist-modal";
import type { UpgradePlanKey } from "@/components/payment/payment-modal";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import {
  formatRegionalPrice,
  type PaidPlanKey,
  type PricingRegion,
} from "@/lib/pricing-regions";

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
    generations: "15 per month",
    features: [
      "15 Lesson Plans",
      "15 PPT Downloads",
      "15 Worksheets",
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
    cta: { label: "Join Waitlist", href: "/auth" },
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
    cta: { label: "Join Waitlist", href: "/auth" },
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
    <svg className={`size-5 shrink-0 ${className}`} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <p className={`font-display text-3xl font-semibold tracking-tight ${lightText ? "text-chalk" : "text-navy"}`}>
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
        <p className={`text-sm line-through ${lightText ? "text-chalk/50" : "text-muted-foreground"}`}>
          {formatRegionalPrice(region, prices.monthly * 12, "year")}
        </p>
      ) : null}
      <p className={`font-display text-3xl font-semibold tracking-tight ${lightText ? "text-chalk" : "text-navy"}`}>
        {formatRegionalPrice(region, amount, period)}
      </p>
      {billing === "annual" ? (
        <span className="mt-2 inline-flex rounded-md bg-primary/15 px-2 py-0.5 font-mono-editorial text-[0.65rem] font-medium uppercase tracking-wide text-primary">
          Save 2 months
        </span>
      ) : null}
      {billing === "monthly" ? (
        <p className={`mt-2 text-sm ${lightText ? "text-chalk/65" : "text-muted-foreground"}`}>
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
  const ctaClassName = "mt-8 w-full rounded-lg";

  return (
    <Card
      className={`relative gap-0 py-7 shadow-none transition sm:py-8 ${
        isFeatured
          ? "border-2 border-primary bg-navy lg:scale-[1.02]"
          : isSchool
            ? "border-2 border-navy"
            : "border-border"
      }`}
    >
      <CardContent className="flex flex-1 flex-col">
        {plan.badge ? (
          <span
            className={`absolute right-6 top-6 rounded-md px-2.5 py-1 font-mono-editorial text-[0.65rem] font-medium uppercase tracking-wide ${
              plan.badge === "Best Value" ? "bg-navy text-chalk" : "bg-primary text-navy"
            }`}
          >
            {plan.badge}
          </span>
        ) : null}

        <h3 className={`font-display text-xl font-semibold ${lightText ? "text-chalk" : "text-navy"}`}>
          {plan.name}
        </h3>

        <div className="mt-3">
          <PlanPrice plan={plan} region={region} billing={billing} lightText={lightText} />
        </div>

        <p className={`mt-4 text-sm font-medium ${lightText ? "text-primary" : "text-primary"}`}>
          {plan.generations}
        </p>
        {plan.teachers ? (
          <p className={`mt-1 text-sm ${lightText ? "text-chalk/75" : "text-muted-foreground"}`}>{plan.teachers}</p>
        ) : null}

        <ul className="mt-6 flex flex-1 flex-col gap-2.5">
          {plan.features.map((item) => (
            <li
              key={item}
              className={`flex items-start gap-2.5 text-sm leading-snug ${lightText ? "text-chalk/90" : "text-foreground/80"}`}
            >
              <CheckIcon className="text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {plan.upgradeKey && onUpgrade ? (
          <Button
            type="button"
            onClick={() => onUpgrade(plan.upgradeKey!)}
            className={ctaClassName}
            variant={isFeatured ? "default" : "outline"}
          >
            {plan.cta.label}
          </Button>
        ) : isMailto ? (
          <a href={plan.cta.href} className={buttonVariants({ variant: "outline", className: ctaClassName })}>
            {plan.cta.label}
          </a>
        ) : (
          <Link href={plan.cta.href} className={buttonVariants({ className: ctaClassName })}>
            {plan.cta.label}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function PricingPage() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistPlan, setWaitlistPlan] = useState<string | undefined>(undefined);
  const { region } = usePricingRegion();
  const isAnnual = billing === "annual";

  const openPayment = (planKey: UpgradePlanKey) => {
    setWaitlistPlan(planKey);
    setWaitlistOpen(true);
  };

  return (
    <main className="site-editorial min-h-screen bg-background pb-24 pt-10 text-foreground">
      <Container>
        <header className="mx-auto max-w-3xl text-center">
          <SectionLabel className="justify-center flex">Pricing</SectionLabel>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-navy sm:text-4xl md:text-5xl">
            Plans for every teacher and school
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Start free. Upgrade when you are ready. Schools get unlimited generations for every teacher.
          </p>
        </header>

        <div className="mx-auto mt-6 flex justify-center">
          <p className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-navy shadow-sm">
            <span className="text-lg leading-none" aria-hidden>
              🇦🇪
            </span>
            <span>
              Prices shown in <strong>AED</strong> (UAE Dirham)
            </span>
          </p>
        </div>

        <div className="mx-auto mt-10 flex flex-col items-center gap-3">
          <Tabs value={billing} onValueChange={(v) => setBilling(v as Billing)}>
            <TabsList className="h-11 gap-0.5 rounded-lg bg-card p-1 shadow-sm ring-1 ring-border">
              <TabsTrigger
                value="monthly"
                className="h-9 rounded-md px-6 text-sm font-medium data-active:bg-navy data-active:text-chalk"
              >
                Monthly
              </TabsTrigger>
              <TabsTrigger
                value="annual"
                className="h-9 rounded-md px-6 text-sm font-medium data-active:bg-navy data-active:text-chalk"
              >
                Annual
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {isAnnual ? (
            <p className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Save 2 months on all annual plans
            </p>
          ) : null}
        </div>

        <section className="mt-14">
          <SectionLabel className="justify-center flex">For teachers</SectionLabel>
          <p className="mt-2 text-center text-lg font-semibold text-navy sm:text-xl">Individual plans</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
            {TEACHER_PLAN_DEFS.map((plan) => (
              <PricingCard key={plan.id} plan={plan} region={region} billing={billing} onUpgrade={openPayment} />
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-navy-rule/20 bg-navy p-6 sm:p-10">
          <SectionLabel className="justify-center flex">For schools</SectionLabel>
          <p className="mt-2 text-center text-lg font-semibold text-chalk sm:text-xl">School &amp; district plans</p>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-chalk/65">
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
              className={buttonVariants({ size: "lg", className: "h-12 rounded-lg px-8" })}
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              Get School Plan
            </Link>
            <p className="mt-3 text-sm text-chalk/50">
              Register your school and our team will set you up within 24 hours
            </p>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-center text-2xl font-semibold text-navy sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-card p-5 shadow-sm transition open:shadow-md"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-navy marker:content-none">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-xl font-normal text-primary transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </Container>

      <WaitlistModal open={waitlistOpen} plan={waitlistPlan} onClose={() => setWaitlistOpen(false)} />
    </main>
  );
}
