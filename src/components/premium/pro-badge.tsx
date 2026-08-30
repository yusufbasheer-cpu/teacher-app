import { Lock } from "lucide-react";
import { TEAL, TEAL_DARK } from "@/lib/design-tokens";

type ProBadgeProps = {
  className?: string;
  /** "light" (default) is tuned for the app's usual light/cream surfaces —
   * a darker teal for text contrast. "dark" is for the one place this sits
   * on a dark surface (the sidebar nav): plain brand teal reads better than
   * TEAL_DARK against var(--text). */
  variant?: "light" | "dark";
};

/** Small "PRO" pill used consistently everywhere a Pro-only feature needs to
 * be marked — sidebar nav, package checkboxes, section headers, locked
 * panels. Keep this the single visual definition of "this is a Pro feature"
 * across the platform rather than styling it ad hoc per page. */
export function ProBadge({ className = "", variant = "light" }: ProBadgeProps) {
  const isDark = variant === "dark";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
      style={{
        borderColor: isDark ? "color-mix(in oklch, var(--brand) 50%, transparent)" : TEAL,
        color: isDark ? TEAL : TEAL_DARK,
        background: isDark ? "color-mix(in oklch, var(--brand) 15%, transparent)" : "color-mix(in oklch, var(--brand) 8%, transparent)",
      }}
    >
      <Lock size={10} strokeWidth={2.5} aria-hidden />
      Pro
    </span>
  );
}
