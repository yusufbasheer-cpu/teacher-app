import { Lock } from "lucide-react";
import { NAVY } from "@/lib/design-tokens";

type LockedPreviewPillProps = {
  label: string;
  /** Optional trailing detail, e.g. an activity count. */
  meta?: string;
};

/** One inert "here's what Pro unlocks" row — used inside LockedFeaturePanel
 * for AFL activity categories, Teaching & Learning Strategy names, and
 * Source Content upload options. Deliberately NOT dimmed with opacity: full
 * text contrast, a real card boundary, and a trailing lock glyph do the work
 * of reading as "locked" instead of "broken/disabled". */
export function LockedPreviewPill({ label, meta }: LockedPreviewPillProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-[#FAF6EF] px-3 py-2.5">
      <span className="min-w-0 truncate text-sm font-medium" style={{ color: NAVY }}>
        {label}
        {meta ? <span className="ml-1.5 font-normal text-stone-400">· {meta}</span> : null}
      </span>
      <Lock size={13} strokeWidth={2.5} className="shrink-0 text-stone-300" aria-hidden />
    </div>
  );
}
