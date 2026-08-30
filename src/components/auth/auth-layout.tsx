import Link from "next/link";
import type { ReactNode } from "react";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";

const CURRICULA = ["CBSE", "ICSE", "IB", "Cambridge"] as const;

/**
 * Shell for /login and /signup.
 *
 * Was a two-column split: a navy panel carrying a decorative blob, the logo and
 * four floating badges on the left, the form on the right. At most widths the
 * left half read as empty — a large branded rectangle doing no work — and it
 * disappeared entirely below `lg`, so the desktop and mobile versions of the
 * page had nothing in common.
 *
 * A single centred column is both more professional and more honest about what
 * the page is for: one task, one focal point, nothing competing with it. The
 * ruled backdrop is the same one the homepage hero uses, so arriving here from
 * the marketing site feels continuous rather than like a different product.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100vh-64px)] w-full flex-col items-center justify-center px-4 py-12">
      <HeroBackdrop />

      <div className="flex w-full max-w-[400px] flex-col items-center">
        <Link href="/" className="mb-7 flex flex-col items-center gap-2.5">
          <img
            src="/logo-mark.png"
            alt=""
            aria-hidden
            className="size-10 rounded-lg object-cover"
          />
          <span className="text-center">
            <span className="block text-[15px] font-semibold tracking-[-0.015em] text-ink">Layah</span>
            <span className="mt-0.5 block text-[12px] text-faint">Prep less. Teach more.</span>
          </span>
        </Link>

        {children}

        {/* Trust signal as one quiet line rather than a row of floating chips.
            It supports the decision without competing with the form. */}
        <p className="mt-7 text-center text-[11px] leading-relaxed text-disabled">
          Curriculum-aligned for{" "}
          <span className="text-faint">{CURRICULA.join(", ")}</span> and 15+ more
        </p>
      </div>
    </div>
  );
}
