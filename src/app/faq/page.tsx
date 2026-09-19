"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, ArrowUpRight } from "lucide-react";
import { PublicPage } from "@/components/marketing/public-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLANS } from "@/lib/plans";

type FaqItem = { q: string; a: string };
type FaqCategory = { title: string; items: FaqItem[] };
const FAQ_DATA: FaqCategory[] = [
  {
    title: "General Questions",
    items: [
      {
        q: "What is Layah?",
        a: "Layah is an AI-powered lesson planning tool built specifically for teachers. It generates complete lesson plans, PowerPoint presentations, worksheets, assessments, question papers and more in seconds.",
      },
      {
        q: "Who is Layah for?",
        a: "Layah is designed for teachers and schools following any curriculum including UAE MOE, CBSE, British, American, Cambridge, IB and 15+ more.",
      },
      {
        q: "How does Layah work?",
        a: "Simply enter your subject, grade, topic and learning objectives. Select your curriculum and any Activity Sheet AFL tools you want to use. Click generate and Layah creates a complete lesson package for you in seconds.",
      },
    ],
  },
  {
    title: "Pricing Questions",
    items: [
      {
        q: "Is there a free plan?",
        a: `Yes! Our free plan gives you ${PLANS.free.generationsLimit} lesson plan generations per month forever. No credit card required.`,
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes, absolutely. No contracts or long-term commitments. Cancel anytime from your account settings.",
      },
      {
        q: "Do you offer school plans?",
        a: "Yes, we have School Starter, School Pro and School Enterprise plans for schools. Visit our pricing page or contact us at info@layah.in for more details.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept credit cards, debit cards and UPI for Indian teachers. More payment options coming soon.",
      },
    ],
  },
  {
    title: "Technical Questions",
    items: [
      {
        q: "What curriculums does Layah support?",
        a: "Layah supports 15+ curriculums including UAE MOE, CBSE, British National Curriculum, American Common Core, Cambridge CAIE, IB, Edexcel and many more.",
      },
      {
        q: "Can I upload my own content?",
        a: "Yes! You can upload PDF files, images or paste your own content and Layah will generate resources based on your specific material.",
      },
      {
        q: "Is my data safe?",
        a: "Yes. We take data privacy seriously. See our Privacy Policy for how account information, lesson content and service providers are handled.",
      },
      {
        q: "Does Layah work on mobile?",
        a: "Yes, Layah is fully responsive and works on all devices including phones, tablets and computers.",
      },
    ],
  },
];


export default function FaqPage() {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = FAQ_DATA.map((category) => ({
    ...category,
    items: category.items.filter((item) => item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)),
  })).filter((category) => category.items.length > 0);
  const count = filtered.reduce((total, category) => total + category.items.length, 0);

  return (
    <PublicPage
      eyebrow="Help centre"
      title="A little help, when you need it."
      description="Find answers about getting started, your plan and the resources you can create."
      headerContent={
        <div className="relative max-w-xl">
          <label htmlFor="faq-search" className="sr-only">Search questions and answers</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input id="faq-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions and answers" className="h-12 bg-canvas pl-10" />
        </div>
      }
    >
      <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-24">
          <p className="text-sm font-medium">Browse by topic</p>
          <nav aria-label="Help topics" className="mt-3 flex flex-wrap gap-2 lg:flex-col">
            {FAQ_DATA.map((category, index) => <a key={category.title} href={`#faq-category-${index}`} onClick={() => setSearch("")} className="rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{category.title.replace(" Questions", "")}</a>)}
          </nav>
          <div className="mt-6 border-t border-line pt-6"><p className="text-sm font-medium">Need a hand?</p><p className="mt-2 text-sm leading-relaxed text-muted">Our team can help with your specific question.</p><Link href="/contact" className="mt-3 inline-flex items-center gap-1 rounded text-sm font-medium text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Contact support <ArrowUpRight className="size-4" aria-hidden /></Link></div>
        </aside>
        <div className="min-w-0">
          <p className="mb-5 text-sm text-muted" role="status">{query ? `${count} answer${count === 1 ? "" : "s"} matching ?${search.trim()}?` : "Common questions, answered."}</p>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface p-8 text-center"><h2 className="section-heading">No matching answers</h2><p className="mt-2 text-sm text-muted">Try another phrase, browse the topics or contact our team.</p><Button variant="outline" className="mt-5" onClick={() => setSearch("")}>Clear search</Button></div>
          ) : filtered.map((category) => (
            <section key={category.title} id={`faq-category-${FAQ_DATA.findIndex((item) => item.title === category.title)}`} className="mb-8 scroll-mt-24 last:mb-0">
              <h2 className="section-heading mb-4">{category.title.replace(" Questions", "")}</h2>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {category.items.map((item) => (
                  <details key={item.q} className="group px-5 sm:px-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-medium marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                      {item.q}<Plus className="size-4 shrink-0 text-faint transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none" aria-hidden />
                    </summary>
                    <p className="max-w-2xl pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PublicPage>
  );
}
