"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

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
        a: "Yes! Our free plan gives you 15 lesson plan generations per month forever. No credit card required.",
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
        a: "Yes. We take data privacy seriously. Your lesson plans and personal information are securely stored and never shared with third parties.",
      },
      {
        q: "Does Layah work on mobile?",
        a: "Yes, Layah is fully responsive and works on all devices including phones, tablets and computers.",
      },
    ],
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="size-5 shrink-0 transition-transform duration-300"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: open ? TEAL : "#94A3B8" }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function AccordionItem({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b" style={{ borderColor: "#E2E8F0" }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-semibold sm:text-base" style={{ color: NAVY }}>
          {item.q}
        </span>
        <ChevronIcon open={isOpen} />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}
      >
        <p className="pb-5 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
          {item.a}
        </p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = FAQ_DATA.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="min-h-screen" style={{ background: "#F7F9FC", color: NAVY }}>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: NAVY }}>
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 50%, ${TEAL}33, transparent 60%)` }} />
        <Container>
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(0,198,167,0.15)", color: TEAL }}>
              Help Center
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl" style={{ fontWeight: 700 }}>
              Frequently Asked Questions
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60">
              Everything you need to know about Layah. Can&apos;t find the answer you&apos;re looking for? Reach out to our support team.
            </p>

            {/* Search */}
            <div className="relative mx-auto mt-8 max-w-md">
              <svg className="absolute left-4 top-1/2 size-5 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions..."
                className="w-full rounded-xl border py-3 pl-12 pr-4 text-sm text-white placeholder-white/40 outline-none transition focus:ring-2"
                style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ Content */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-lg font-semibold" style={{ color: NAVY }}>No results found</p>
                <p className="mt-2 text-sm" style={{ color: "#4A5568" }}>
                  Try a different search term or browse all questions below.
                </p>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-4 rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: TEAL }}
                >
                  Clear Search
                </button>
              </div>
            ) : (
              filtered.map((category) => (
                <div key={category.title} className="mb-10">
                  <h2 className="mb-1 text-lg font-bold sm:text-xl" style={{ color: NAVY }}>
                    {category.title}
                  </h2>
                  <div className="mb-4 h-0.5 w-12 rounded-full" style={{ background: TEAL }} />
                  {category.items.map((item) => {
                    const key = `${category.title}-${item.q}`;
                    return (
                      <AccordionItem
                        key={key}
                        item={item}
                        isOpen={openKey === key}
                        onToggle={() => setOpenKey(openKey === key ? null : key)}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </Container>
      </section>

      {/* Still have questions */}
      <section className="py-16 sm:py-20" style={{ background: `linear-gradient(135deg, ${TEAL}, #0A8F7A)` }}>
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Still have questions?</h2>
            <p className="mt-4 text-base text-white/80">
              Our team is here to help. Reach out and we&apos;ll get back to you within 24 hours.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-8 py-3 text-sm font-semibold shadow-lg transition hover:bg-slate-50"
                style={{ color: "#0A8F7A" }}
              >
                Contact Us
              </Link>
              <a
                href="mailto:info@layah.in"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/30 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                info@layah.in
              </a>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
