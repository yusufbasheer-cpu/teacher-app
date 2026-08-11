import { Sparkles } from "lucide-react";
import { ProBadge } from "@/components/premium/pro-badge";
import { NAVY, TEAL, TEXT_MUTED } from "@/lib/design-tokens";

type LockedPageStateProps = {
  title: string;
  description: string;
  onUpgrade: () => void;
};

/** Full-page locked state shown instead of a generator wizard when a Free
 * caller opens a Pro-only page (Question Paper, Differentiated Worksheets).
 * Never renders a partially-working form — this replaces the whole wizard. */
export function LockedPageState({ title, description, onUpgrade }: LockedPageStateProps) {
  return (
    <div className="mx-auto w-full max-w-lg py-16 text-center">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(14, 148, 132,0.1)" }}
      >
        <Sparkles size={26} color={TEAL} aria-hidden />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <h1 className="text-xl font-bold" style={{ color: NAVY }}>
          {title}
        </h1>
        <ProBadge />
      </div>

      <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
        {description}
      </p>

      <button
        type="button"
        onClick={onUpgrade}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: TEAL }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}
