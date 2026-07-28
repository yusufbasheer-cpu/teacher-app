import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { StatsSection } from "@/components/home/stats-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { FeedbackSection } from "@/components/home/feedback-section";
import { Footer } from "@/components/layout/footer";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/marketing/section-label";
import { PeriodList, PeriodItem } from "@/components/marketing/period-list";

export const metadata: Metadata = {
  title: "Layah.ai — AI Lesson Planning for Teachers",
  description:
    "Layah generates complete lesson plans, PowerPoint presentations, worksheets, and assessments in seconds. Built specifically for teachers.",
};

const FEATURES = [
  {
    title: "Complete lesson plans",
    description:
      "Fully structured plans aligned to UAE, CBSE, British and American curricula. Objectives, activities and timings included.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.04A8.97 8.97 0 006 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 016 18c2.3 0 4.4.87 6 2.29m0-14.25a8.97 8.97 0 016-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0018 18a8.97 8.97 0 00-6 2.29m0-14.25v14.25" />
    ),
  },
  {
    title: "Professional PPT slides",
    description:
      "13-slide decks with proper lesson structure and AFL tools built in — ready to open and present.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25a2.25 2.25 0 01-2.25 2.25h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3" />
    ),
  },
  {
    title: "Full resource pack",
    description:
      "Worksheets, assessments, homework and teacher notes generated together in one download.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.11c0-1.14-.85-2.1-1.98-2.2a48 48 0 00-1.12-.08m-5.8 0c-.06.21-.1.44-.1.67 0 .42.34.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.67m-5.8 0c-.38.02-.75.05-1.13.08-1.13.1-1.97 1.06-1.97 2.2v2.14M8.25 8.25H4.88c-.63 0-1.13.5-1.13 1.13v11.25c0 .62.5 1.12 1.13 1.12h9.75c.62 0 1.12-.5 1.12-1.12V9.38c0-.63-.5-1.13-1.12-1.13H8.25z" />
    ),
  },
  {
    title: "Curriculum alignment",
    description:
      "Outcomes mapped to grade-level learning standards across 15+ curricula worldwide.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.04A8.97 8.97 0 006 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 016 18c2.3 0 4.4.87 6 2.29m0-14.25a8.97 8.97 0 016-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0018 18a8.97 8.97 0 00-6 2.29m0-14.25v14.25" />
    ),
  },
  {
    title: "87 AFL tools",
    description:
      "Built-in Assessment for Learning tools, auto-selected or chosen by hand for each lesson phase.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: "One-click export",
    description: "Download everything as Word, PowerPoint or a single ZIP — no reformatting.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    ),
  },
];

const HERO_CHECKLIST = [
  "Learning objectives — UAE MOE aligned",
  "Differentiated for higher, middle and lower achievers",
  "KHDA & SPEA inspection-ready format",
  "87 AFL tools integrated",
  "13-slide professional PowerPoint",
  "Question paper with mark scheme",
] as const;

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      {children}
    </svg>
  );
}

function HeroPreviewCard() {
  return (
    <Card className="mx-auto w-full max-w-md gap-0 border-navy-rule/15 py-0 shadow-lg lg:mx-0">
      <div className="h-1 w-full bg-primary" />
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 pb-4 pt-5">
        <div>
          <p className="font-mono-editorial text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            Science · Grade 7
          </p>
          <p className="font-display mt-1.5 text-xl font-semibold leading-tight text-navy">
            Photosynthesis
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Generated in 45 seconds</p>
        </div>
        <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 font-mono-editorial text-[0.65rem] font-medium text-primary">
          UAE MOE
        </span>
      </div>
      <ul className="space-y-2.5 px-5 py-4">
        {HERO_CHECKLIST.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-foreground/80">
            <svg className="mt-0.5 size-4 shrink-0 text-primary" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-5 pb-5 pt-3">
        <p className="text-xs leading-snug text-muted-foreground">
          Joined by <strong className="text-navy">500+ teachers</strong> saving hours every week
        </p>
      </div>
    </Card>
  );
}

export default function LandingPage() {
  return (
    <div className="site-editorial min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <SectionLabel className="justify-center lg:justify-start lg:flex">
                Curriculum-aligned · UAE · CBSE · British · American
              </SectionLabel>

              <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-chalk sm:text-5xl lg:text-5xl xl:text-6xl">
                Plan better lessons in the time it takes to mark one.
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-chalk/70 lg:mx-0">
                Layah generates complete lesson plans, presentations, worksheets and assessments —
                so your evenings go back to being yours.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/lesson-plan"
                  className={buttonVariants({ size: "lg", className: "h-12 rounded-lg px-8 text-base" })}
                >
                  Start for free
                </Link>
                <a
                  href="#how-it-works"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className:
                      "h-12 rounded-lg border-chalk/25 bg-transparent px-8 text-base text-chalk hover:bg-chalk/10 hover:text-chalk",
                  })}
                >
                  See how it works
                </a>
              </div>

              <p className="font-mono-editorial mt-6 text-xs uppercase tracking-wider text-chalk/45">
                No credit card required
              </p>
            </div>

            <div className="w-full flex-shrink-0 lg:w-[440px]">
              <HeroPreviewCard />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-xl">
            <SectionLabel>Period 1 — what layah does</SectionLabel>
            <h2 className="font-display mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Everything a teacher needs, generated together
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Stop spending evenings planning. Layah handles the structure so you can focus on
              teaching.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-border shadow-none transition hover:shadow-md">
                <CardContent>
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FeatureIcon>{feature.icon}</FeatureIcon>
                  </div>
                  <h3 className="font-display text-base font-semibold text-navy">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <TestimonialsSection />

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <StatsSection />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-border py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 max-w-xl">
            <SectionLabel>Period 2 — how it works</SectionLabel>
            <h2 className="font-display mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Ready in under two minutes
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              From blank page to a complete lesson pack, in three steps.
            </p>
          </div>

          <PeriodList className="md:grid md:grid-cols-3 md:gap-8 md:space-y-0">
            <PeriodItem number="01">
              <h3 className="font-display text-base font-semibold text-navy">
                Enter subject, grade and topic
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tell Layah what you&apos;re teaching — subject, grade level, curriculum and topic.
              </p>
            </PeriodItem>
            <PeriodItem number="02">
              <h3 className="font-display text-base font-semibold text-navy">
                Select curriculum and AFL tools
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Choose UAE, CBSE, British or American curriculum, or let Layah auto-select.
              </p>
            </PeriodItem>
            <PeriodItem number="03">
              <h3 className="font-display text-base font-semibold text-navy">
                Download the complete pack
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Lesson plan, PowerPoint, worksheets and assessments — all ready to use.
              </p>
            </PeriodItem>
          </PeriodList>

          <div className="mt-14 text-center">
            <Link
              href="/lesson-plan"
              className={buttonVariants({ size: "lg", className: "h-12 rounded-lg px-10 text-base" })}
            >
              Try it now — it&apos;s free
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEEDBACK ─────────────────────────────────────────────────────── */}
      <FeedbackSection />

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="bg-navy py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <SectionLabel className="justify-center flex">Start today</SectionLabel>
          <h2 className="font-display mt-3 text-3xl font-semibold text-chalk sm:text-4xl">
            Plan your next lesson in minutes, not hours
          </h2>
          <p className="mt-4 text-base text-chalk/65">
            Save hours every week. Walk into inspections prepared.
          </p>
          <Link
            href="/lesson-plan"
            className={buttonVariants({ size: "lg", className: "mt-8 h-12 rounded-lg px-10 text-base" })}
          >
            Get started free
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
