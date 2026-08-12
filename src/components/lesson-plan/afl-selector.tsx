"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  AFL_PHASE_GROUPS,
  AFL_PHASE_IDS,
  AFL_RECOMMENDED_IDS,
  type AflPhaseId,
  type AflSelectionsPayload,
} from "@/lib/afl-tools";
import { LockedFeaturePanel } from "@/components/premium/locked-feature-panel";
import { LockedPreviewPill } from "@/components/premium/locked-preview-pill";
import { TEAL } from "@/lib/design-tokens";

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
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition ${
        checked
          ? "border-[#0E9484] bg-[#0E9484]/8 ring-1 ring-[#0E9484]/20"
          : "border-stone-200 bg-[#FAF6EF] hover:border-[#0E9484]/40 hover:bg-[#0E9484]/5"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 size-4 shrink-0 rounded border-stone-300 text-[#0E9484] focus:ring-2 focus:ring-[#0E9484] focus:ring-offset-1"
      />
      <span className="min-w-0">
        <span className={`block font-medium ${checked ? "text-[#0B6B5F]" : "text-stone-900"}`}>{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-stone-500">{purpose}</span>
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
  const [expanded, setExpanded] = useState<Set<AflPhaseId>>(new Set());
  const [search, setSearch] = useState("");

  const totalSelected = countSelected(selected);

  const togglePhaseExpanded = (phase: AflPhaseId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

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
        <h3 className="text-lg font-semibold text-stone-900">Assessment for Learning</h3>
        <p className="mt-1 text-sm text-stone-600">
          Select activities to weave into different phases of your lesson.
        </p>
      </div>
      {!locked && totalSelected > 0 ? (
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: "rgba(14, 148, 132,0.1)", color: "#0B6B5F" }}
        >
          {totalSelected} selected
        </span>
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

      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition"
            style={
              tab === t.id
                ? { background: TEAL, color: "#fff" }
                : { background: "#F1E9DC", color: "#6b5d4f" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recommended" ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-stone-500">
              A curated starting point across all phases — fine-tune below, or use as-is.
            </p>
            <button
              type="button"
              onClick={applyRecommended}
              className="shrink-0 rounded-lg border border-[#0E9484]/30 bg-[#0E9484]/5 px-3 py-1.5 text-xs font-semibold text-[#0B6B5F] hover:bg-[#0E9484]/10"
            >
              Use Recommended
            </button>
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
        </div>
      ) : null}

      {tab === "phase" ? (
        <div className="mt-4 space-y-2">
          {AFL_PHASE_GROUPS.map((group) => {
            const isOpen = expanded.has(group.phase);
            const count = selected[group.phase]?.length ?? 0;
            return (
              <div key={group.phase} className="rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => togglePhaseExpanded(group.phase)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-stone-900">
                    {group.title.replace(" AFL Tools", "")}
                    {count > 0 ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: "rgba(14, 148, 132,0.1)", color: "#0B6B5F" }}
                      >
                        {count}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-stone-400">
                    {group.tools.length} activities
                    <ChevronDown
                      size={16}
                      className="transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                  </span>
                </button>
                {isOpen ? (
                  <div className="grid gap-2 border-t border-stone-100 p-3 sm:grid-cols-2">
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
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "all" ? (
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all 82 activities…"
              className="w-full rounded-xl border border-stone-300 bg-[#FAF6EF] py-2.5 pl-9 pr-3 text-sm outline-none ring-[#0E9484] focus:ring-2"
            />
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {filteredAllTools.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-500">No activities match &quot;{search}&quot;.</p>
            ) : (
              filteredAllTools.map((t) => {
                const checked = (selected[t.phase] ?? []).includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition ${
                      checked
                        ? "border-[#0E9484] bg-[#0E9484]/8 ring-1 ring-[#0E9484]/20"
                        : "border-stone-200 bg-[#FAF6EF] hover:border-[#0E9484]/40 hover:bg-[#0E9484]/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChange(toggleTool(selected, t.phase, t.id))}
                      className="mt-0.5 size-4 shrink-0 rounded border-stone-300 text-[#0E9484] focus:ring-2 focus:ring-[#0E9484] focus:ring-offset-1"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`font-medium ${checked ? "text-[#0B6B5F]" : "text-stone-900"}`}>{t.label}</span>
                        <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                          {t.phaseTitle.replace(" AFL Tools", "")}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-stone-500">{t.purpose}</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {totalSelected > 0 ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-stone-500 hover:text-stone-700"
          >
            Clear all selections
          </button>
        </div>
      ) : null}
    </div>
  );
}
