import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const GROUPS = [
  { title: "Teaching tools", links: [
    ["Lesson plans & slides", "/lesson-plan"], ["Worksheet packs", "/differentiated-worksheets"], ["Question papers", "/question-paper"], ["Plans & pricing", "/pricing"],
  ] },
  { title: "Layah", links: [
    ["About us", "/about"], ["For schools", "/school-register"], ["Teacher resources", "/blog"], ["Contact", "/contact"],
  ] },
  { title: "Support", links: [
    ["Help & FAQs", "/faq"], ["Privacy policy", "/privacy"], ["Terms of service", "/terms"],
  ] },
];

export function Footer() {
  return (
    <footer className="border-t border-line-subtle bg-surface">
      <div className="mx-auto max-w-7xl px-5 pb-7 pt-14 sm:px-8 lg:pt-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Layah home" className="inline-flex items-center gap-2.5">
              <img src="/logo-mark.png" alt="" aria-hidden className="size-9 rounded-md object-cover" />
              <span className="text-[23px] font-semibold tracking-[-0.04em] text-ink">Layah</span>
            </Link>
            <p className="mt-4 max-w-[270px] text-sm leading-relaxed text-muted">A thoughtful workspace for lesson planning, classroom resources, and the teachers behind them.</p>
            <div className="mt-5 flex items-center gap-2">
              <a href="https://www.instagram.com/layah.teachers" target="_blank" rel="noopener noreferrer" aria-label="Layah on Instagram" className="flex size-10 items-center justify-center rounded-md border border-line-subtle text-faint transition-colors hover:bg-hover hover:text-ink"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" /></svg></a>
              <a href="https://www.linkedin.com/company/layah-ai/" target="_blank" rel="noopener noreferrer" aria-label="Layah on LinkedIn" className="flex size-10 items-center justify-center rounded-md border border-line-subtle text-faint transition-colors hover:bg-hover hover:text-ink"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" /><path d="M2 9h4v12H2z" /><circle cx="4" cy="4" r="2" /></svg></a>
              <a href="https://x.com/layah_ai" target="_blank" rel="noopener noreferrer" aria-label="Layah on X" className="flex size-10 items-center justify-center rounded-md border border-line-subtle text-sm text-faint transition-colors hover:bg-hover hover:text-ink">X</a>
            </div>
          </div>
          {GROUPS.map((group) => <div key={group.title}>
            <h2 className="mb-3 text-sm font-semibold text-ink">{group.title}</h2>
            <ul className="space-y-1">{group.links.map(([label, href]) => <li key={href}><Link href={href} className="inline-flex min-h-10 items-center text-sm text-muted transition-colors hover:text-brand-text">{label}</Link></li>)}</ul>
          </div>)}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle pt-6 text-xs text-faint">
          <p>&copy; {new Date().getFullYear()} Layah. All rights reserved.</p>
          <Link href="/contact" className="inline-flex items-center gap-1.5 hover:text-brand-text">Built around your teaching day<ArrowUpRight className="size-3.5" aria-hidden /></Link>
        </div>
      </div>
    </footer>
  );
}
