import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, HeartHandshake, SlidersHorizontal } from "lucide-react";
import { PublicPage } from "@/components/marketing/public-page";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About Layah — Built by a teacher, for teachers",
  description: "Meet the people behind Layah and our mission to give teachers more time for their students.",
};

const TEAM = [
  { initials: "MY", name: "Mohammed Yusuf", role: "Founder & Teacher", bio: "A working teacher who experienced the hours spent planning lessons and formatting resources. Layah began with the tool he wanted for his own classroom.", href: "https://www.linkedin.com/company/layah-ai/" },
  { initials: "MU", name: "Mohammed Uvais", role: "Founder & Developer", bio: "Turning classroom needs into practical software, with a focus on making each step of lesson preparation simpler and more useful.", href: "https://www.linkedin.com/in/uvais-solanki-6504b8297/" },
];

export default function AboutPage() {
  return (
    <PublicPage eyebrow="About Layah" title="Built around the work teachers do." description="A teacher and a developer, working on one shared idea: preparation should leave you with more time for your students.">
      <section className="grid gap-8 border-b border-line pb-12 md:grid-cols-[0.65fr_1.35fr] md:gap-16">
        <h2 className="section-heading">It started in a classroom.</h2>
        <div className="max-w-2xl space-y-4 text-base leading-relaxed text-muted">
          <p>Layah began with a familiar frustration: a lesson is only part of the preparation. There are slides to make, activities to adapt, questions to write and documents to format.</p>
          <p>Our founder experienced this as a teacher. Together, we built a workspace that brings those tasks together, with AI to create a starting point and teachers in control of what reaches the classroom.</p>
          <p>Today, Layah supports lesson plans, PowerPoint presentations, differentiated worksheets, assessments and activity sheets, shaped around your curriculum and teaching goals.</p>
        </div>
      </section>

      <section className="py-12">
        <div className="mb-7"><p className="page-kicker">What guides the product</p><h2 className="mt-3 text-2xl font-semibold tracking-tight">Useful in the real teaching day.</h2></div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: BookOpen, title: "Classroom context first", text: "Your curriculum, grade, subject and learning objectives give every resource its starting point." },
            { icon: SlidersHorizontal, title: "Teacher judgement matters", text: "Review and adapt generated content for the learners you know. Your expertise stays central to the lesson." },
            { icon: HeartHandshake, title: "Accessible to start", text: "A free plan lets you try the workflow. Paid and school plans support a wider set of teaching needs." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-line bg-surface p-6"><Icon className="size-5 text-brand-text" aria-hidden /><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{text}</p></div>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-12">
        <div className="mb-7"><p className="page-kicker">The people behind Layah</p><h2 className="mt-3 text-2xl font-semibold tracking-tight">Teaching experience. Practical engineering.</h2></div>
        <div className="grid gap-5 md:grid-cols-2">
          {TEAM.map((person) => (
            <article key={person.name} className="rounded-xl border border-line bg-surface p-6 sm:p-8">
              <div className="flex items-center gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 font-semibold text-brand-text" aria-hidden>{person.initials}</div><div><h3 className="font-semibold">{person.name}</h3><p className="mt-1 text-sm text-muted">{person.role}</p></div></div>
              <p className="mt-5 text-sm leading-relaxed text-muted">{person.bio}</p>
              <a href={person.href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded text-sm font-medium text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Connect on LinkedIn <ArrowUpRight className="size-4" aria-hidden /><span className="sr-only"> with {person.name} (opens in a new tab)</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div><h2 className="section-heading">Help shape what comes next.</h2><p className="mt-2 text-sm text-muted">Share feedback, ask a question or talk to us about your school.</p></div>
        <Link href="/contact" className={buttonVariants({ variant: "outline" })}>Get in touch</Link>
      </section>
    </PublicPage>
  );
}

