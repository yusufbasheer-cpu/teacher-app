import { Lock } from "lucide-react";
import { TEAL, TEAL_DARK } from "@/lib/design-tokens";

type ProBadgeProps = {
  className?: string;
};

/** Small "PRO" pill used consistently everywhere a Pro-only feature needs to
 * be marked — sidebar nav, package checkboxes, section headers, locked
 * panels. Keep this the single visual definition of "this is a Pro feature"
 * across the platform rather than styling it ad hoc per page. */
export function ProBadge({ className = "" }: ProBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
      style={{ borderColor: TEAL, color: TEAL_DARK, background: "rgba(14, 148, 132,0.08)" }}
    >
      <Lock size={10} strokeWidth={2.5} aria-hidden />
      Pro
    </span>
  );
}
