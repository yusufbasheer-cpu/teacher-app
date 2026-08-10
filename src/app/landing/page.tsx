import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ClipboardCheck, Presentation } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { BG_SOFT, BORDER, NAVY, TEAL, TEAL_DARK, TEXT_MUTED } from "@/lib/design-tokens";

export const metadata: Metadata = {
  title: "Layah.ai — AI Lesson Planning for Teachers",
  description:
    "Layah generates complete lesson plans, PowerPoint presentations, worksheets, and assessments in seconds. Built specifically for teachers.",
};

const TRUST_BADGES = ["CBSE", "ICSE", "IB", "Cambridge"] as const;

const PREVIEW_CARDS = [
  {
    title: "Lesson Plans",
    icon: BookOpen,
    items: ["Learning objectives", "Teaching sequence", "Differentiation", "Closure activities"],
  },
  {
    title: "PPT Slides",
    icon: Presentation,
    items: ["Slide-by-slide content", "Visual prompts", "Discussion questions", "Key explanations"],
  },
  {
    title: "Worksheets & Assessment",
    icon: ClipboardCheck,
    items: ["Practice questions", "Exit tickets", "Homework", "Teacher notes"],
  },
] as const;

const HOW_IT_WORKS = [
  {
    number: 1,
    title: "Enter your chapter",
    description: "Choose curriculum, grade, subject, and topic.",
  },
  {
    number: 2,
    title: "Add textbook content (optional)",
    description: "Upload a PDF, image, or paste notes.",
  },
  {
    number: 3,
    title: "Generate your teaching package",
    description: "Get lesson plans, PPTs, worksheets, homework, and assessments instantly.",
  },
] as const;

const FOOTER_PRODUCT_LINKS = [
  { href: "/lesson-plan", label: "Lesson Plans" },
  { href: "/differentiated-worksheets", label: "Worksheets" },
  { href: "/question-paper", label: "Question Papers" },
  { href: "/pricing", label: "Pricing" },
] as const;

const FOOTER_COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      <Navbar />

      <main>
        {/* ══════════════════════════════════════════════════════════════
            HERO — compact, centered, single column, max-width 820px
            ══════════════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-[820px] px-4 pb-10 pt-14 text-center sm:px-6">
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{ background: "rgba(14, 148, 132,0.1)", color: TEAL_DARK }}
          >
            AI for Teachers
          </span>

          <h1
            className="mt-5 font-extrabold leading-[1.1] tracking-tight"
            style={{ color: NAVY, fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            Create lesson plans, PPTs, worksheets, and assessments in minutes
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: TEXT_MUTED }}>
            Generate curriculum-aligned teaching resources for <strong style={{ color: NAVY }}>CBSE, ICSE, IB, Cambridge, and 15+ more curriculums</strong> from
            a topic, chapter, or textbook page.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/lesson-plan"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto"
              style={{ background: TEAL }}
            >
              Start Generating
            </Link>
            <a
              href="#preview"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold transition hover:bg-stone-50 sm:w-auto"
              style={{ border: `1px solid ${BORDER}`, color: NAVY }}
            >
              View Sample Package
            </a>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {TRUST_BADGES.map((badge) => (
              <span
                key={badge}
                className="rounded-full px-3.5 py-1.5 text-xs font-bold"
                style={{ background: "#FFFCF7", border: `1px solid ${BORDER}`, color: TEXT_MUTED }}
              >
                {badge}
              </span>
            ))}
            <span
              className="rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{ background: "rgba(14, 148, 132,0.1)", border: `1px solid ${BORDER}`, color: TEAL_DARK }}
            >
              +15 more
            </span>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            PRODUCT PREVIEW — 3-card feature grid
            ══════════════════════════════════════════════════════════════ */}
        <section id="preview" className="mx-auto max-w-6xl px-4 py-[72px] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ color: NAVY }}>
              See what teachers receive
            </h2>
            <p className="mt-3 text-base" style={{ color: TEXT_MUTED }}>
              One generation produces a complete, classroom-ready package.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PREVIEW_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-[20px] bg-[#FAF6EF] p-7 shadow-sm transition-shadow hover:shadow-md"
                  style={{ border: `1px solid ${BORDER}` }}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "rgba(14, 148, 132,0.1)", color: TEAL_DARK }}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 text-base font-bold" style={{ color: NAVY }}>
                    {card.title}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {card.items.map((item) => (
                      <li key={item} className="text-sm" style={{ color: TEXT_MUTED }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            HOW IT WORKS — 3 horizontal numbered steps
            ══════════════════════════════════════════════════════════════ */}
        <section className="py-[72px]" style={{ background: BG_SOFT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ color: NAVY }}>
                How it works
              </h2>
              <p className="mt-3 text-base" style={{ color: TEXT_MUTED }}>
                From blank page to a complete teaching package in three steps.
              </p>
            </div>

            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.number} className="text-center sm:text-left">
                  <span
                    className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white sm:mx-0"
                    style={{ background: TEAL }}
                  >
                    {step.number}
                  </span>
                  <h3 className="mt-4 text-base font-bold" style={{ color: NAVY }}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link
                href="/lesson-plan"
                className="inline-flex min-h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ background: TEAL }}
              >
                Start Generating
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER — simplified, landing-page-specific (the shared Footer
          component is intentionally left untouched — it's also used on
          /about, /contact, /pricing, /blog, /faq).
          ══════════════════════════════════════════════════════════════════ */}
      <footer className="py-14" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 sm:gap-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                Product
              </h3>
              <ul className="mt-4 space-y-2.5">
                {FOOTER_PRODUCT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm transition hover:opacity-70" style={{ color: "#2b2118" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                Company
              </h3>
              <ul className="mt-4 space-y-2.5">
                {FOOTER_COMPANY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm transition hover:opacity-70" style={{ color: "#2b2118" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-12 text-xs" style={{ color: TEXT_MUTED }}>
            © 2026 Layah. Built for teachers.
          </p>
        </div>
      </footer>
    </div>
  );
}
