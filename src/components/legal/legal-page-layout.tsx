import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";
import type { ReactNode } from "react";

const NAVY = "#241A12";
const TEAL = "#0E9484";

type LegalPageLayoutProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <>
      <main className="min-h-screen pb-20" style={{ background: "#F1E9DC" }}>
        <div className="border-b bg-[#FAF6EF]" style={{ borderColor: "rgba(14, 148, 132,0.2)" }}>
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
            <p className="mt-2 text-sm" style={{ color: "#6B5D4F" }}>
              Last updated: {lastUpdated}
            </p>
          </Container>
        </div>

        <Container className="mt-10 max-w-3xl">
          <article
            className="rounded-3xl border bg-[#FAF6EF] p-6 shadow-sm sm:p-10"
            style={{ borderColor: "rgba(14, 148, 132,0.2)" }}
          >
            <div
              className="legal-prose space-y-8 text-sm leading-relaxed sm:text-base"
              style={{ color: "#2b2118" }}
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
        style={{ color: "#241A12" }}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
