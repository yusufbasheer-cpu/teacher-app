import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";

/** Shared reading rhythm for the public site. AppShell supplies navigation. */
export function PublicPage({
  eyebrow, title, description, children, headerContent,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  headerContent?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <p className="page-kicker">{eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
            <div className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{description}</div>
            {headerContent ? <div className="mt-7">{headerContent}</div> : null}
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

