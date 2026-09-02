"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/panel";

type LockedFeaturePanelProps = {
  title: string;
  description: string;
  onUpgrade: () => void;
  /** Optional dimmed, non-interactive preview of what the feature contains. */
  children?: ReactNode;
};

/**
 * The one treatment for a Pro-only section.
 *
 * Never hides the feature — a teacher should be able to see what they'd get —
 * but the preview is now collapsed behind a disclosure rather than expanded by
 * default. The old panel listed all ten teaching strategies inline, so the
 * single largest block on the composer was a feature the user couldn't use.
 * Collapsed, it announces itself in one row and expands only if they're
 * curious, which is the right weight for an upsell inside a working tool.
 *
 * Matches the shape of the unlocked `Disclosure` beside it so locked and
 * unlocked sections read as the same kind of thing.
 */
export function LockedFeaturePanel({
  title,
  description,
  onUpgrade,
  children,
}: LockedFeaturePanelProps) {
  return (
    <Disclosure
      title={
        <span className="flex items-center gap-1.5">
          <Lock className="size-3 text-gen-text" aria-hidden />
          {title}
          <span className="rounded-sm border border-gen-border/50 bg-gen-subtle px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-gen-text">
            Pro
          </span>
        </span>
      }
      summary={description}
    >
      <p className="text-[12px] leading-relaxed text-muted">{description}</p>

      {children ? (
        <div className="mt-3 select-none opacity-55" aria-hidden="true">
          {children}
        </div>
      ) : null}

      <Button type="button" size="sm" className="mt-3" onClick={onUpgrade}>
        Upgrade to Pro
      </Button>
    </Disclosure>
  );
}
