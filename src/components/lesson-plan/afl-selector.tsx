"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  AFL_PHASE_GROUPS,
  AFL_PHASE_IDS,
  AFL_RECOMMENDED_IDS,
  type AflPhaseId,
  type AflSelectionsPayload,
} from "@/lib/afl-tools";
import { LockedFeaturePanel } from "@/components/premium/locked-feature-panel";
import { LockedPreviewPill } from "@/components/premium/locked-preview-pill";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { Badge, Disclosure } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Tab = "recommended" | "phase" | "all";

type AflSelectorProps = {
  selected: AflSelectionsPayload;
  onChange: (next: AflSelectionsPayload) => void;
  locked: boolean;
  onUpgrade: () => void;
};

function countSelected(selected: AflSelectionsPayload): number {
  return AFL_PHASE_IDS.reduce((sum, phase) => sum + (selected[phase]?.length ?? 0), 0);
}

function toggleTool(
  selected: AflSelectionsPayload,
  phase: AflPhaseId,
  toolId: string,
): AflSelectionsPayload {
  const current = selected[phase] ?? [];
  const next = current.includes(toolId)
    ? current.filter((id) => id !== toolId)
    : [...current, toolId];
  return { ...selected, [phase]: next };
}

const TABS: { id: Tab; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "phase", label: "By Lesson Phase" },
  { id: "all", label: "All Activities" },
];

const TOOL_ROW_CLASS =
  "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors duration-[110ms]";

function ToolCheckbox({
  checked,
  onToggle,
  label,
  purpose,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  purpose: string;
}) {
  return (
    <label
      className={cn(
        TOOL_ROW_CLASS,
        checked
          ? "border-brand bg-brand-subtle"
          : "border-line-subtle bg-surface hover:border-line hover:bg-hover",
      )}
    >
      <Checkbox checked={checked} onChange={onToggle} className="mt-0.5" />
      <span className="min-w-0">
        <span className={cn("block font-medium", checked ? "text-brand-text" : "text-ink")}>
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-faint">{purpose}</span>
      </span>
    </label>
  );
}

/** Assessment for Learning activity picker. Replaces the old "click a bar to
 * expand a tall stacked panel" interaction with three lightweight views over
 * the real 6-phase / 82-tool catalog: a one-click Recommended set, the full
 * catalog grouped by lesson phase (collapsed by default), and a searchable
 * flat list for anyone who wants to browse everything. For Free users the
 * whole thing renders inside a LockedFeaturePanel with only the phase
 * categories + counts visible — never the full interactive catalog. */
export function AflSelector({ selected, onChange, locked, onUpgrade }: AflSelectorProps) {
  const [tab, setTab] = useState<Tab>("phase");
  const [search, setSearch] = useState("");

  const totalSelected = countSelected(selected);

  const applyRecommended = () => {
    onChange(
      Object.fromEntries(AFL_PHASE_IDS.map((p) => [p, [...AFL_RECOMMENDED_IDS[p]]])) as AflSelectionsPayload,
    );
  };

  const clearAll = () => onChange({});

  const allToolsFlat = useMemo(
    () =>
      AFL_PHASE_GROUPS.flatMap((group) =>
        group.tools.map((t) => ({ ...t, phase: group.phase, phaseTitle: group.title })),
      ),
    [],
  );

  const filteredAllTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allToolsFlat;
    return allToolsFlat.filter(
      (t) => t.label.toLowerCase().includes(q) || t.phaseTitle.toLowerCase().includes(q),
    );
  }, [allToolsFlat, search]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-ink">Assessment for Learning</h3>
        <p className="mt-1 text-sm text-muted">
          Select activities to weave into different phases of your lesson.
        </p>
      </div>
      {!locked && totalSelected > 0 ? (
        <Badge tone="brand" className="shrink-0 rounded-full px-3 py-1 text-xs">
          {totalSelected} selected
        </Badge>
      ) : null}
    </div>
  );

  if (locked) {
    return (
      <div>
        {header}
        <div className="mt-4">
          <LockedFeaturePanel
            title="Activity selection"
            description="Pro users can select AFL activities — like Think-Pair-Share, Exit Tickets, and Silent Debate — for each phase of the lesson, woven directly into the plan and slides."
            onUpgrade={onUpgrade}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {AFL_PHASE_GROUPS.map((group) => (
                <LockedPreviewPill
                  key={group.phase}
                  label={group.title.replace(" AFL Tools", "")}
                  meta={`${group.tools.length} activities`}
                />
              ))}
            </div>
          </LockedFeaturePanel>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-4">
        <TabsList variant="line">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="recommended" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-faint">
              A curated starting point across all phases — fine-tune below, or use as-is.
            </p>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={applyRecommended}>
              Use Recommended
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {AFL_PHASE_GROUPS.flatMap((group) =>
              group.tools
                .filter((t) => AFL_RECOMMENDED_IDS[group.phase].includes(t.id))
                .map((t) => (
                  <ToolCheckbox
                    key={t.id}
                    checked={(selected[group.phase] ?? []).includes(t.id)}
                    onToggle={() => onChange(toggleTool(selected, group.phase, t.id))}
                    label={t.label}
                    purpose={t.purpose}
                  />
                )),
            )}
          </div>
        </TabsContent>

        <TabsContent value="phase" className="mt-4 space-y-2">
          {AFL_PHASE_GROUPS.map((group) => {
            const count = selected[group.phase]?.length ?? 0;
            return (
              <Disclosure
                key={group.phase}
                defaultOpen={count > 0}
                title={
                  <span className="flex items-center gap-2">
                    {group.title.replace(" AFL Tools", "")}
                    {count > 0 ? <Badge tone="brand">{count}</Badge> : null}
                  </span>
                }
                summary={`${group.tools.length} activities`}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.tools.map((t) => (
                    <ToolCheckbox
                      key={t.id}
                      checked={(selected[group.phase] ?? []).includes(t.id)}
                      onToggle={() => onChange(toggleTool(selected, group.phase, t.id))}
                      label={t.label}
                      purpose={t.purpose}
                    />
                  ))}
                </div>
              </Disclosure>
            );
          })}
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all 82 activities…"
              className="h-10 pl-9"
            />
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {filteredAllTools.length === 0 ? (
              <p className="py-6 text-center text-sm text-faint">No activities match &quot;{search}&quot;.</p>
            ) : (
              filteredAllTools.map((t) => {
                const checked = (selected[t.phase] ?? []).includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={cn(
                      TOOL_ROW_CLASS,
                      checked
                        ? "border-brand bg-brand-subtle"
                        : "border-line-subtle bg-surface hover:border-line hover:bg-hover",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => onChange(toggleTool(selected, t.phase, t.id))}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("font-medium", checked ? "text-brand-text" : "text-ink")}>
                          {t.label}
                        </span>
                        <span className="rounded-full bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                          {t.phaseTitle.replace(" AFL Tools", "")}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-faint">{t.purpose}</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {totalSelected > 0 ? (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="ghost" size="xs" onClick={clearAll}>
            Clear all selections
          </Button>
        </div>
      ) : null}
    </div>
  );
}
