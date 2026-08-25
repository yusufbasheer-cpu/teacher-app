import type { ReactNode } from "react";
import { NAVY } from "@/lib/design-tokens";

const TRUST_BADGES = ["CBSE", "ICSE", "IB", "Cambridge"] as const;

type AuthLayoutProps = {
  children: ReactNode;
};

/** Shared two-column shell for /login and /signup: a brand panel (Haikei
 * blob background) on the left, the auth form on the right. Left panel
 * collapses away on mobile — form only below `lg`. */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full flex-col lg:flex-row">
      <div className="relative hidden w-full flex-col justify-end p-4 lg:flex lg:min-h-[calc(100vh-64px)] lg:w-1/2">
        <div
          className="relative h-full w-full overflow-hidden rounded-[32px] shadow-2xl"
          style={{ background: NAVY }}
        >
          <img
            src="/hero-bg.svg"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to top, ${NAVY} 0%, ${NAVY}00 72%)` }}
          />

          <div className="relative z-10 flex w-full flex-col items-center gap-6 pb-14 text-center">
            <div className="flex flex-col items-center gap-3">
              <img
                src="/logo-mark.png"
                alt="Layah"
                className="h-14 w-14 rounded-2xl object-cover shadow-lg"
              />
              <div>
                <p className="text-2xl font-extrabold text-white">Layah</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Prep Less. Teach More.
                </p>
              </div>
            </div>

            {/* Backgrounds are deliberately opaque (not a faint tint) — the blob
                can shift under this row at different panel aspect ratios, and a
                near-transparent chip loses contrast against its cream fill. An
                opaque navy surface keeps the white text readable regardless of
                what's behind it. */}
            <div className="flex flex-wrap items-center justify-center gap-2 px-10">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ background: "rgba(36,26,18,0.65)", border: "1px solid rgba(255,255,255,0.22)" }}
                >
                  {badge}
                </span>
              ))}
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: "rgba(36,26,18,0.65)",
                  color: "#6EE7D8",
                  border: "1px solid rgba(14, 148, 132,0.55)",
                }}
              >
                +15 more curriculums
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-[#FAF6EF] px-6 py-12 sm:px-12 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
