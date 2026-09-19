import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Check, FileText, Presentation, School } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LessonPlanBento } from "@/components/landing/lesson-plan-bento";
import { HowItWorksTimeline } from "@/components/landing/how-it-works-timeline";
import { buttonVariants } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Layah — A teaching day, thoughtfully prepared",
  description: "Create lesson plans, PowerPoint presentations, worksheets and assessments in one teaching workspace. Built by a teacher, for teachers.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />
      <main>
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div>
              <p className="page-kicker">The workspace for your teaching day</p>
              <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                {/* The space before the <br /> is load-bearing: without it the
                    accessible name runs the two sentences together as
                    "Less preparation.More teaching." */}
                Less preparation. <br />
                <span className="text-brand-text">More teaching.</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
                Turn your next topic into a complete lesson, presentation and classroom resources. All together, ready for your review.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/lesson-plan" className={buttonVariants({ size: "lg" })}>
                  Create a lesson <ArrowRight className="size-4" aria-hidden />
                </Link>
                <a href="#teaching-tools" className="rounded-lg px-2 py-3 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none">
                  Explore the tools
                </a>
              </div>
              <p className="mt-4 text-sm text-muted">Start with {PLANS.free.generationsLimit} free lesson generations per month. No card required.</p>
              <p className="mt-10 border-t border-line pt-5 text-sm leading-relaxed text-muted">
                For CBSE, ICSE, British, Cambridge, IB and more.
              </p>
            </div>

            <figure className="rounded-2xl border border-line bg-canvas p-3 shadow-sm sm:p-4">
              <figcaption className="flex items-center justify-between gap-3 px-2 pb-4 pt-1 text-xs font-medium text-muted">
                <span className="flex items-center gap-2"><BookOpen className="size-4 text-brand-text" aria-hidden /> A look inside a lesson</span>
                <span className="rounded-md border border-line bg-surface px-2 py-1">Example</span>
              </figcaption>
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="border-b border-line p-5 sm:p-6">
                  <p className="text-xs font-medium text-brand-text">Science · Grade 5 · 40 minutes</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">The water cycle</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">How does water move through our world?</p>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  <div>
                    <h3 className="text-sm font-semibold">Learning objective</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">Explain evaporation, condensation and precipitation using an everyday example.</p>
                  </div>
                  <ol className="space-y-3">
                    {[
                      ["Engage", "Where do puddles go after it rains?", "5 min"],
                      ["Explore", "Observe water changing state.", "20 min"],
                      ["Apply", "Draw and explain the cycle.", "10 min"],
                      ["Reflect", "Check understanding with an exit ticket.", "5 min"],
                    ].map(([title, detail, time]) => (
                      <li key={title} className="flex items-start gap-3 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                        <div className="min-w-0 flex-1"><span className="font-medium">{title}</span><p className="mt-0.5 text-xs leading-relaxed text-muted">{detail}</p></div>
                        <span className="shrink-0 text-xs tabular-nums text-faint">{time}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line bg-canvas px-5 py-4 text-xs font-medium text-muted">
                  <span className="flex items-center gap-1.5"><Presentation className="size-3.5" aria-hidden /> Slides</span>
                  <span className="flex items-center gap-1.5"><FileText className="size-3.5" aria-hidden /> Worksheet</span>
                  <span className="flex items-center gap-1.5"><Check className="size-3.5" aria-hidden /> Assessment</span>
                </div>
              </div>
            </figure>
          </div>
        </section>

        <section id="teaching-tools" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div><p className="page-kicker">One connected workspace</p><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Prepare for the whole lesson.</h2></div>
            <p className="max-w-md text-sm leading-relaxed text-muted">Choose a starting point. Keep your curriculum, teaching goals and classroom needs at the centre.</p>
          </div>
          <LessonPlanBento />
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <div className="max-w-xl"><p className="page-kicker">Your expertise, supported</p><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">From your idea to your classroom.</h2></div>
            <HowItWorksTimeline />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid gap-8 rounded-2xl border border-line bg-surface p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div><School className="mb-5 size-7 text-brand-text" aria-hidden /><h2 className="text-2xl font-semibold tracking-tight">A shared standard for your school.</h2><p className="mt-3 max-w-xl text-base leading-relaxed text-muted">Give teachers their own workspace, support departments and bring your school branding to teaching resources.</p></div>
            <Link href="/pricing#schools" className={buttonVariants({ variant: "outline", size: "lg" })}>Explore school plans <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

