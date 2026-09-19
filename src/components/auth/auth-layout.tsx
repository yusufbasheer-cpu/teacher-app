import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, FileCheck2, Layers3 } from "lucide-react";

const WORKSPACE_TOOLS = [
  { icon: BookOpen, title: "Plan with confidence", detail: "Build lessons around your curriculum and classroom." },
  { icon: FileCheck2, title: "Prepare your assessments", detail: "Create question papers and differentiated practice." },
  { icon: Layers3, title: "Keep everything together", detail: "Return to saved resources whenever you need them." },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-64px)] bg-canvas px-4 py-8 sm:px-6 lg:py-14">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:grid-cols-[1fr_1.05fr]">
        <aside className="flex flex-col justify-between border-b border-line bg-sunken p-6 sm:p-10 lg:border-b-0 lg:border-r">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 text-lg font-semibold text-ink">
              <img src="/logo-mark.png" alt="" aria-hidden className="size-10 rounded-xl object-cover" />
              Layah
            </Link>
            <p className="page-kicker mt-10">Your teaching workspace</p>
            <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-ink">
              A clearer start to every lesson.
            </h2>
            <p className="mt-4 max-w-sm text-base leading-7 text-muted">
              Bring your preparation into one place, from the first lesson idea to classroom resources.
            </p>
          </div>
          <ul className="mt-10 hidden space-y-6 lg:block">
            {WORKSPACE_TOOLS.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-text" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <div className="flex flex-col justify-center p-6 sm:p-10">
          {children}
          <p className="mt-8 text-center text-sm leading-6 text-faint">
            <Link href="/privacy" className="hover:text-ink hover:underline">Privacy policy</Link>
            <span className="mx-2" aria-hidden>?</span>
            <Link href="/terms" className="hover:text-ink hover:underline">Terms of service</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
