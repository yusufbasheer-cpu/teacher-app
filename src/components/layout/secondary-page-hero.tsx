import Link from "next/link";
import { BORDER, NAVY, TEAL, TEAL_DARK, TEXT_MUTED } from "@/lib/design-tokens";

type SecondaryPageHeroProps = {
  badge: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  ctaHref: string;
};

/** Standard hero pattern for secondary/marketing pages — same layout and
 * spacing as the landing page hero, only the copy changes per page. */
export function SecondaryPageHero({ badge, headline, subtext, ctaLabel, ctaHref }: SecondaryPageHeroProps) {
  return (
    <section className="mx-auto max-w-[820px] px-4 pb-8 pt-14 text-center sm:px-6">
      <span
        className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide"
        style={{ background: "rgba(14, 148, 132,0.1)", color: TEAL_DARK }}
      >
        {badge}
      </span>

      <h1
        className="mt-5 font-extrabold leading-[1.1] tracking-tight"
        style={{ color: NAVY, fontSize: "clamp(1.75rem, 4.5vw, 3rem)" }}
      >
        {headline}
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: TEXT_MUTED }}>
        {subtext}
      </p>

      <div className="mt-8 flex justify-center">
        <Link
          href={ctaHref}
          className="inline-flex min-h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: TEAL }}
        >
          {ctaLabel}
        </Link>
      </div>

      <div className="mx-auto mt-10 max-w-2xl" style={{ borderTop: `1px solid ${BORDER}` }} />
    </section>
  );
}
