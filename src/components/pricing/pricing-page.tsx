"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/ui/container";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

const FREE_FEATURES = [
  "3 Lesson Plans per month",
  "3 PPT Downloads per month",
  "3 Worksheets per month",
  "Basic AFL Tools",
  "Standard themes",
  "Email support",
] as const;

const PRO_FEATURES = [
  "Unlimited Lesson Plans",
  "Unlimited PPT Downloads",
  "Unlimited Worksheets",
  "Full AFL Tools Library",
  "All 5 Premium Themes",
  "Question Paper Generator",
  "Blueprint Generator",
  "Differentiated Worksheet Pack",
  "UAE Framework Alignment",
  "All Curriculum Types",
  "Priority Support",
  "School Logo Upload",
] as const;

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes absolutely. No contracts or commitments.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes our free plan gives you 3 lesson plans per month forever.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Credit card, debit card, and UPI for Indian teachers.",
  },
  {
    q: "Can my whole school use Layah?",
    a: "Yes contact us for special school pricing.",
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

export function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const isAnnual = billing === "annual";

  return (
    <main
      className="min-h-screen pb-20 pt-10"
      style={{ background: "linear-gradient(180deg, #f0f4f8 0%, #ffffff 45%)" }}
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
            Simple, Affordable Pricing for Teachers
          </h1>
          <p className="mt-4 text-base sm:text-lg" style={{ color: "#4A5568" }}>
            Start free. Upgrade when you are ready.
          </p>
        </header>

        <div className="mx-auto mt-10 flex justify-center">
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
        </div>

        {isAnnual ? (
          <p className="mt-4 text-center text-sm font-medium" style={{ color: TEAL }}>
            Save 2 months with the annual plan — pay 150 AED/year instead of 180 AED
          </p>
        ) : null}

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-stretch">
          {/* Free */}
          <article
            className="flex flex-col rounded-3xl border-2 bg-white p-8 shadow-sm transition hover:shadow-md"
            style={{ borderColor: NAVY }}
          >
            <h2 className="text-xl font-bold" style={{ color: NAVY }}>
              Free
            </h2>
            <p className="mt-3 text-3xl font-extrabold tracking-tight" style={{ color: NAVY }}>
              Free Forever
            </p>
            <ul className="mt-8 flex flex-1 flex-col gap-3">
              {FREE_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "#334155" }}>
                  <CheckIcon className="text-[#0A1628]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/auth"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-semibold text-white transition hover:opacity-95"
              style={{ background: NAVY }}
            >
              Get Started Free
            </Link>
          </article>

          {/* Pro */}
          <article
            className="relative flex flex-col overflow-hidden rounded-3xl p-8 shadow-xl"
            style={{
              background: `linear-gradient(160deg, ${NAVY} 0%, #132a4a 55%, ${NAVY} 100%)`,
              border: `2px solid ${TEAL}`,
              boxShadow: `0 20px 50px rgba(0,198,167,0.2)`,
            }}
          >
            <span
              className="absolute right-6 top-6 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
              style={{ background: TEAL }}
            >
              Most Popular
            </span>

            <h2 className="text-xl font-bold text-white">Pro</h2>

            <div className="mt-3">
              {isAnnual ? (
                <>
                  <p className="text-sm text-white/60 line-through">180 AED / year</p>
                  <p className="text-3xl font-extrabold tracking-tight text-white">
                    150 AED
                    <span className="text-lg font-semibold text-white/80"> / year</span>
                  </p>
                  <p className="mt-2 text-sm font-semibold" style={{ color: TEAL }}>
                    Save 2 months with annual plan
                  </p>
                </>
              ) : (
                <p className="text-3xl font-extrabold tracking-tight text-white">
                  15 AED
                  <span className="text-lg font-semibold text-white/80"> / month</span>
                </p>
              )}
            </div>

            {!isAnnual ? (
              <p className="mt-2 text-sm text-white/70">
                Or <span className="font-semibold text-white">150 AED / year</span> — save 2 months
              </p>
            ) : null}

            <ul className="mt-8 flex flex-1 flex-col gap-3">
              {PRO_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                  <CheckIcon className="text-[#00C6A7]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/auth"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-semibold transition hover:opacity-95"
              style={{ background: TEAL, color: NAVY }}
            >
              Start Pro Plan
            </Link>
          </article>
        </div>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: NAVY }}>
            Frequently asked questions
          </h2>
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border bg-white p-5 shadow-sm open:shadow-md"
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
    </main>
  );
}
