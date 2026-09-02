"use client";

import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type LockedPageStateProps = {
  title: string;
  description: string;
  onUpgrade: () => void;
  /** Concrete things the plan unlocks here. Sell the work, not the tier. */
  includes?: readonly string[];
};

/**
 * Shown instead of a generator when a Free caller opens a Pro-only tool.
 *
 * For most of the user base this *is* the page, so it should do a job rather
 * than apologise. The old version centred a lock icon and a one-line pitch in
 * an otherwise empty screen, under a page header that already said the same
 * thing — two titles and no information.
 *
 * This states plainly what the tool produces, so the decision is about the
 * work rather than about a tier name, and offers a way to compare plans rather
 * than only a single upgrade button.
 */
export function LockedPageState({
  title,
  description,
  onUpgrade,
  includes,
}: LockedPageStateProps) {
  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-14">
      <Panel className="p-5">
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-gen-border/50 bg-gen-subtle px-1.5 py-0.5 text-[11px] font-medium text-gen-text">
          <Lock className="size-3" aria-hidden />
          Pro
        </span>

        <h1 className="mt-3 text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{description}</p>

        {includes?.length ? (
          <ul className="mt-4 space-y-1.5 border-t border-line-subtle pt-4">
            {includes.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-muted">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-text" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={onUpgrade}>
            Upgrade to Pro
          </Button>
          <Button variant="ghost" size="lg" render={<Link href="/pricing" />}>
            Compare plans
          </Button>
        </div>
      </Panel>
    </div>
  );
}
