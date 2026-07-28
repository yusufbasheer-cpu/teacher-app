import type { ReactNode } from "react";

/**
 * Tracked-out mono eyebrow label — the "Term Planner" direction's stand-in
 * for the old rounded-pill badges. Marketing pages only.
 */
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-mono-editorial text-[0.7rem] font-medium uppercase tracking-[0.16em] text-primary ${className}`}
    >
      {children}
    </p>
  );
}
