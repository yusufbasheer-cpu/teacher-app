import type { ReactNode } from "react";
import { NAVY, TEAL, TEAL_DARK } from "@/lib/design-tokens";

const TRUST_ITEMS = ["CBSE", "ICSE", "IB", "Cambridge"] as const;

type AuthLayoutProps = {
  badge: string;
  headline: string;
  subtext: string;
  children: ReactNode;
};

/** Shared two-column shell for /login and /signup: a brand panel on the left,
 * the auth form on the right. Collapses to a single column on mobile. */
export function AuthLayout({ badge, headline, subtext, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-2">
      <div
        className="hidden flex-col justify-center px-12 py-16 lg:flex"
        style={{ background: NAVY }}
      >
        <div className="mx-auto max-w-md">
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{ background: "rgba(14, 148, 132,0.15)", color: TEAL }}
          >
            {badge}
          </span>

          <h2 className="mt-6 text-3xl font-extrabold leading-tight text-white">{headline}</h2>

          <p className="mt-4 text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            {subtext}
          </p>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
            {TRUST_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-semibold text-white">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: TEAL, color: NAVY }}
                  aria-hidden
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold" style={{ color: TEAL }}>
            + 15 more curriculums supported
          </p>

          {/* Subtle decorative illustration — a few soft rounded shapes, no imagery */}
          <div className="relative mt-16 h-40" aria-hidden>
            <div
              className="absolute left-0 top-0 h-24 w-24 rounded-3xl"
              style={{ background: "rgba(14, 148, 132,0.12)" }}
            />
            <div
              className="absolute left-16 top-10 h-28 w-28 rounded-full"
              style={{ background: "rgba(14, 148, 132,0.08)" }}
            />
            <div
              className="absolute left-8 top-24 h-16 w-16 rounded-2xl border"
              style={{ borderColor: "rgba(255,255,255,0.15)" }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-md lg:hidden">
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{ background: "rgba(14, 148, 132,0.1)", color: TEAL_DARK }}
          >
            {badge}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
