import Link from "next/link";
import type { Metadata } from "next";
import { LandingNavSound } from "@/components/landing/landing-nav-sound";
import { StatsSection } from "@/components/home/stats-section";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Layah.ai — AI Lesson Planning for Teachers",
  description:
    "Layah generates complete lesson plans, PowerPoint presentations, worksheets, and assessments in seconds. Built specifically for teachers.",
};

// ─── Brand tokens ────────────────────────────────────────────────────────────
// Primary:  #0A1628  Deep Navy
// Accent:   #00C6A7  Teal Mint
// Surface:  #F7F9FC  Off-white
// TextSec:  #4A5568
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#F7F9FC", color: "#0A1628" }}
    >

      {/* ── NAVBAR ── */}
      <header
        style={{ background: "#0A1628" }}
        className="sticky top-0 z-50 shadow-lg"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link href="/landing" className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: "#00C6A7" }}
            >
              L
            </span>
            <span className="font-layah-logo text-xl font-bold text-white tracking-tight">Layah</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {["Features", "How It Works", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm font-medium text-white/75 transition hover:text-white"
              >
                {item}
              </a>
            ))}
            <Link
              href="/auth"
              className="text-sm font-medium text-white/75 transition hover:text-white"
            >
              Login
            </Link>
            <LandingNavSound />
            <Link
              href="/lesson-plan"
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-90"
              style={{ background: "#00C6A7" }}
            >
              Get Started Free
            </Link>
          </nav>

          {/* Mobile: just the CTA */}
          <Link
            href="/lesson-plan"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white md:hidden"
            style={{ background: "#00C6A7" }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "#0A1628" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#00C6A7 1px, transparent 1px), linear-gradient(90deg, #00C6A7 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-36 lg:py-44">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <span
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ borderColor: "#00C6A7", color: "#00C6A7" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "#00C6A7" }}
              />
              Built for teachers
            </span>

            <h1
              className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl"
              style={{ fontWeight: 700 }}
            >
              Save{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #00C6A7, #0A8F7A)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                95%
              </span>{" "}
              of Your Lesson Planning Time
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-white/70 sm:text-xl">
              Layah generates complete lesson plans, PowerPoint presentations, worksheets, and
              assessments in seconds. Built specifically for teachers.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/lesson-plan"
                className="inline-flex min-h-12 items-center justify-center rounded-lg px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                style={{ background: "#00C6A7" }}
              >
                Get Started Free
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                style={{ borderColor: "rgba(255,255,255,0.3)" }}
              >
                Watch Demo
              </a>
            </div>

            {/* Social proof strip */}
            <p className="mt-10 text-xs font-medium tracking-wide text-white/40 uppercase">
              Trusted by teachers across UAE · CBSE · British · American curricula
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32" style={{ background: "#F7F9FC" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <p
              className="mb-3 text-sm font-semibold uppercase tracking-widest"
              style={{ color: "#00C6A7" }}
            >
              What Layah does
            </p>
            <h2
              className="text-3xl font-bold sm:text-4xl"
              style={{ color: "#0A1628", fontWeight: 700 }}
            >
              Everything you need, generated in seconds
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "#4A5568" }}>
              Stop spending evenings planning. Layah handles the hard work so you can focus on
              teaching.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Card 1 */}
            <FeatureCard
              icon={
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    stroke="#00C6A7"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="Complete Lesson Plans"
              description="Generate fully structured lesson plans aligned with UAE, CBSE, British and American curricula in seconds. Objectives, activities, timings — all included."
            />
            {/* Card 2 */}
            <FeatureCard
              icon={
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                    stroke="#00C6A7"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="Professional PPT Slides"
              description="Beautiful PowerPoint presentations with proper lesson structure, Activity Sheet AFL tools, and differentiated activities — ready to download and present."
            />
            {/* Card 3 */}
            <FeatureCard
              icon={
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    stroke="#00C6A7"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="Full Resource Pack"
              description="Worksheets, assessments, homework, teacher notes and Activity Sheet AFL — all generated together in one complete downloadable package."
            />
          </div>
        </div>
      </section>

      {/* ── STATS / NUMBERS ── */}
      <StatsSection />

      {/* ── HOW IT WORKS ── */}
      <section
        id="how-it-works"
        className="py-24 md:py-32"
        style={{ background: "#0A1628" }}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <p
              className="mb-3 text-sm font-semibold uppercase tracking-widest"
              style={{ color: "#00C6A7" }}
            >
              Simple process
            </p>
            <h2
              className="text-3xl font-bold text-white sm:text-4xl"
              style={{ fontWeight: 700 }}
            >
              How It Works
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/60">
              From blank page to complete lesson pack in under two minutes.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              number="01"
              title="Enter your subject, grade and topic"
              description="Tell Layah what you're teaching. Subject, grade level, curriculum, and the lesson topic."
            />
            <StepCard
              number="02"
              title="Select your curriculum and AFL tools"
              description="Choose from UAE, CBSE, British or American curriculum. Pick AFL tools or let Layah auto-select the best ones."
            />
            <StepCard
              number="03"
              title="Download your complete lesson pack"
              description="Get your lesson plan, PowerPoint, worksheets, assessments, and Activity Sheet AFL — all ready to use."
            />
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/lesson-plan"
              className="inline-flex min-h-12 items-center justify-center rounded-lg px-10 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
              style={{ background: "#00C6A7" }}
            >
              Try It Now — It&apos;s Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32" style={{ background: "#F7F9FC" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <p
              className="mb-3 text-sm font-semibold uppercase tracking-widest"
              style={{ color: "#00C6A7" }}
            >
              Pricing
            </p>
            <h2
              className="text-3xl font-bold sm:text-4xl"
              style={{ color: "#0A1628", fontWeight: 700 }}
            >
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "#4A5568" }}>
              Start free. Upgrade when you need more.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {/* Free */}
            <div
              className="rounded-2xl border bg-white p-8 shadow-sm"
              style={{ borderColor: "#E2E8F0" }}
            >
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#4A5568" }}>
                Free
              </p>
              <p className="mt-3 text-4xl font-bold" style={{ color: "#0A1628" }}>
                $0
                <span className="text-base font-normal text-slate-400"> / month</span>
              </p>
              <ul className="mt-8 space-y-4">
                {["5 lesson plans per month", "PowerPoint generation", "Basic worksheets", "PDF & Word export"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-3 text-sm" style={{ color: "#4A5568" }}>
                      <span
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: "rgba(0,198,167,0.15)" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="#00C6A7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ),
                )}
              </ul>
              <Link
                href="/auth"
                className="mt-8 flex min-h-11 items-center justify-center rounded-lg border text-sm font-semibold transition hover:bg-slate-50"
                style={{ borderColor: "#00C6A7", color: "#00C6A7" }}
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div
              className="relative rounded-2xl p-8 text-white shadow-xl"
              style={{ background: "linear-gradient(135deg, #0A1628 0%, #0e2647 100%)" }}
            >
              <span
                className="absolute right-6 top-6 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ background: "#00C6A7" }}
              >
                Most Popular
              </span>
              <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Pro</p>
              <p className="mt-3 text-4xl font-bold text-white">
                $12
                <span className="text-base font-normal text-white/50"> / month</span>
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Unlimited lesson plans",
                  "Professional PPT slides",
                  "Full resource packs",
                  "Activity Sheet AFL",
                  "All curricula supported",
                  "Priority generation",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/80">
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(0,198,167,0.25)" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="#00C6A7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth"
                className="mt-8 flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                style={{ background: "#00C6A7" }}
              >
                Start Pro Plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section
        className="py-20"
        style={{ background: "linear-gradient(135deg, #00C6A7 0%, #0A8F7A 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl" style={{ fontWeight: 700 }}>
            Start planning better lessons today
          </h2>
          <p className="mt-4 text-base text-white/80">
            Join thousands of teachers who have cut their planning time with Layah.
          </p>
          <Link
            href="/lesson-plan"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-10 py-3 text-sm font-semibold shadow-lg transition hover:bg-slate-50"
            style={{ color: "#0A8F7A" }}
          >
            Get Started Free — No Credit Card Required
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-8 shadow-sm transition hover:shadow-md"
      style={{ border: "1px solid #E2E8F0" }}
    >
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(0,198,167,0.1)" }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold" style={{ color: "#0A1628", fontWeight: 600 }}>
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
        {description}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="relative rounded-2xl p-8 transition hover:shadow-md"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Number */}
      <span
        className="mb-5 block text-5xl font-bold leading-none"
        style={{ color: "#00C6A7", opacity: 0.25, fontWeight: 700 }}
      >
        {number}
      </span>
      {/* Accent line */}
      <div
        className="mb-5 h-0.5 w-10 rounded-full"
        style={{ background: "#00C6A7" }}
      />
      <h3 className="text-lg font-semibold text-white" style={{ fontWeight: 600 }}>
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>
    </div>
  );
}
