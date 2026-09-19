import Link from "next/link";
import type { ReactNode } from "react";
import { PublicPage } from "@/components/marketing/public-page";

export function LegalPageLayout({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: ReactNode }) {
  return (
    <PublicPage eyebrow="Legal & privacy" title={title} description={<>Last updated: {lastUpdated}</>}>
      <div className="grid items-start gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Legal documents" className="flex flex-wrap gap-2 lg:sticky lg:top-24 lg:flex-col">
          {[["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"]].map(([href, label]) => (
            <Link key={href} href={href} aria-current={title.toLowerCase().includes(href.slice(1)) ? "page" : undefined} className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink aria-[current=page]:bg-brand/10 aria-[current=page]:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{label}</Link>
          ))}
          <Link href="/contact" className="rounded-lg px-3 py-2.5 text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Contact the team</Link>
        </nav>
        <article className="min-w-0 max-w-3xl rounded-xl border border-line bg-surface p-6 sm:p-9">
          <div className="legal-prose space-y-9 text-sm leading-relaxed text-muted sm:text-base">{children}</div>
        </article>
      </div>
    </PublicPage>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2><div className="space-y-3">{children}</div></section>;
}

