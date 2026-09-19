"use client";

import { useId, type ReactNode } from "react";
import { Download, FileText, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceArtifact = {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  onDownload?: () => void | Promise<void>;
  downloadLabel?: string;
};

/** One navigation and one contextual download action for every generated file. */
export function ArtifactWorkspace({ artifacts, activeId, onSelect, busy = false, downloading = false, children, sidebarFooter }: {
  artifacts: WorkspaceArtifact[];
  activeId: string;
  onSelect: (id: string) => void;
  busy?: boolean;
  downloading?: boolean;
  children: ReactNode;
  sidebarFooter?: ReactNode;
}) {
  const id = useId();
  const selectedIndex = Math.max(0, artifacts.findIndex((item) => item.id === activeId));
  const active = artifacts[selectedIndex];
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
        <div className="rounded-xl border border-line bg-surface p-2">
          <p className="px-3 pb-3 pt-2 text-sm font-semibold text-ink">Package contents</p>
          <div role="tablist" aria-label="Generated documents" aria-orientation="vertical" className="flex flex-col gap-1">
            {artifacts.map((item, index) => {
              const Icon = item.icon ?? FileText;
              const selected = index === selectedIndex;
              return (
                <button key={item.id} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={selected} aria-controls={`${id}-panel`} tabIndex={selected ? 0 : -1}
                  onClick={() => onSelect(item.id)}
                  onKeyDown={(event) => {
                    let next = index;
                    if (event.key === "ArrowDown") next = (index + 1) % artifacts.length;
                    else if (event.key === "ArrowUp") next = (index - 1 + artifacts.length) % artifacts.length;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End") next = artifacts.length - 1;
                    else return;
                    event.preventDefault();
                    onSelect(artifacts[next]!.id);
                    document.getElementById(`${id}-tab-${next}`)?.focus();
                  }}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand", selected ? "bg-brand-subtle font-semibold text-brand-text" : "text-muted hover:bg-hover hover:text-ink")}
                ><Icon className="size-4 shrink-0" aria-hidden /><span>{item.title}</span></button>
              );
            })}
          </div>
        </div>
        {sidebarFooter}
      </aside>
      <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${selectedIndex}`} tabIndex={0} className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface focus-visible:outline-2 focus-visible:outline-brand">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div><h2 className="section-heading">{active?.title ?? "Preview"}</h2>{active?.description ? <p className="mt-1 text-sm text-faint">{active.description}</p> : null}</div>
          {active?.onDownload ? <Button disabled={busy} onClick={active.onDownload}><Download aria-hidden />{downloading ? "Preparing file…" : active.downloadLabel ?? "Download Word"}</Button> : null}
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </section>
    </div>
  );
}
