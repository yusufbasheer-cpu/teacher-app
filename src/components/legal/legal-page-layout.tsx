import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";
import type { ReactNode } from "react";

const NAVY = "var(--text)";
const TEAL = "var(--brand)";

type LegalPageLayoutProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <>
      <main className="min-h-screen pb-20" style={{ background: "var(--canvas)" }}>
        <div className="border-b bg-[var(--surface)]" style={{ borderColor: "color-mix(in oklch, var(--brand) 20%, transparent)" }}>
          <Container className="py-8">
            <Link
              href="/"
              className="text-sm font-semibold transition hover:opacity-80"
              style={{ color: TEAL }}
            >
              ← Back to Layah
            </Link>
            <h1
              className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: NAVY }}
            >
              {title}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Last updated: {lastUpdated}
            </p>
          </Container>
        </div>

        <Container className="mt-10 max-w-3xl">
          <article
            className="rounded-3xl border bg-[var(--surface)] p-6 shadow-sm sm:p-10"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <div
              className="legal-prose space-y-8 text-sm leading-relaxed sm:text-base"
              style={{ color: "var(--text)" }}
            >
              {children}
            </div>
          </article>
        </Container>
      </main>
      <Footer />
    </>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2
        className="mb-3 text-lg font-bold sm:text-xl"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
