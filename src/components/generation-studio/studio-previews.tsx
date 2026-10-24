"use client";

/**
 * Previews for Layah Studio. They only ever show real data: canonical structure, text that has actually been
 * written, and the chosen theme's colours. Anything not yet known is a labelled placeholder, never invented
 * content, and the caption says what the teacher is looking at.
 */

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudioIndicator } from "./generation-studio";

export type PreviewSlide = { title: string; lines: string[] };

type SlideDeckPreviewProps = {
  eyebrow: string;
  deckTitle: string;
  /** Canonical slides; `lines` stay empty until that text has really been written. */
  slides: PreviewSlide[];
  /** Up to three theme colours (background, accent, extra) when a real theme is known. */
  swatch?: string[];
  caption: string;
  busy: boolean;
};

/** Readable ink for a hex background (only hex comes from the theme swatches). */
function inkFor(hex: string | undefined): { ink: string; soft: string } | null {
  const m = hex?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6 ? { ink: "#1f2629", soft: "rgba(31,38,41,.74)" } : { ink: "#f4f6f5", soft: "rgba(244,246,245,.8)" };
}

function SlideFace({ slide, index, eyebrow, deckTitle, swatch, large }: { slide: PreviewSlide; index: number; eyebrow: string; deckTitle: string; swatch?: string[]; large?: boolean }) {
  const ink = inkFor(swatch?.[0]);
  const themed = Boolean(ink);
  const bg = themed ? swatch![0] : undefined;
  const accent = swatch?.[1] ?? "var(--brand)";
  const cover = index === 0;
  const text = { color: ink?.ink };
  const soft = { color: ink?.soft };
  return (
    <div
      className={cn("relative flex h-full w-full flex-col overflow-hidden", !themed && "bg-surface", large ? "p-[6%]" : "p-[8%]")}
      style={{ background: bg }}
    >
      {cover ? (
        <div className="flex h-full flex-col justify-center">
          {large ? <p className={cn("font-mono text-[11px] uppercase tracking-wider", !themed && "text-faint")} style={soft}>{eyebrow}</p> : null}
          <p className={cn("mt-[3%] font-semibold leading-tight", large ? "text-[clamp(18px,2.4vw,30px)]" : "text-[8px]", !themed && "text-ink")} style={text}>
            {deckTitle}
          </p>
          <span className="mt-[4%] block h-[3px] w-1/3 rounded-full" style={{ background: accent }} />
        </div>
      ) : (
        <>
          <p className={cn("font-semibold leading-tight", large ? "text-[clamp(14px,1.7vw,22px)]" : "text-[6.5px]", !themed && "text-ink")} style={text}>
            {slide.title}
          </p>
          <span className="mt-[3%] block h-[2px] w-1/5 rounded-full" style={{ background: accent }} />
          <div className={cn("mt-[5%] flex flex-col", large ? "gap-2.5" : "gap-[3px]")}>
            {slide.lines.length
              ? slide.lines.map((l, i) => (
                  <p
                    key={i}
                    className={cn("std-in line-clamp-2 font-serif", large ? "text-[clamp(11px,1.1vw,15px)] leading-snug" : "text-[4.5px] leading-tight", !themed && "text-muted")}
                    style={{ ...soft, animationDelay: `${i * 70}ms` }}
                  >
                    {l}
                  </p>
                ))
              : [0.9, 0.75, 0.82].map((w, i) => (
                  <span key={i} className={cn("std-skel block rounded-full", large ? "h-2.5" : "h-[3px]", themed && "opacity-60")} style={{ width: `${w * 100}%` }} />
                ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SlideDeckPreview({ eyebrow, deckTitle, slides, swatch, caption, busy }: SlideDeckPreviewProps) {
  const [selected, setSelected] = useState(0);
  const current = slides[selected] ?? slides[0];
  if (!current) return null;
  return (
    <div className="rounded-2xl border border-line bg-sunken/60 p-3 sm:p-5">
      <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-xl border border-line-subtle shadow-[var(--shadow-pop)]">
        <SlideFace key={selected} slide={current} index={selected} eyebrow={eyebrow} deckTitle={deckTitle} swatch={swatch} large />
        {busy ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2 py-1 text-[11px] font-medium text-muted backdrop-blur">
            <StudioIndicator size={12} /> Preview
          </span>
        ) : null}
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-7" aria-label="Slides">
        {slides.map((s, i) => (
          <li key={i} className="std-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <button
              type="button"
              onClick={() => setSelected(i)}
              aria-current={i === selected ? "true" : undefined}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              className={cn(
                "group block w-full text-left outline-none",
              )}
            >
              <span
                className={cn(
                  "block aspect-video overflow-hidden rounded-md border transition-[border-color,box-shadow] duration-150",
                  i === selected ? "border-brand ring-2 ring-brand/25" : "border-line-subtle group-hover:border-line-strong",
                )}
              >
                <SlideFace slide={s} index={i} eyebrow={eyebrow} deckTitle={deckTitle} swatch={swatch} />
              </span>
              <span className="mt-1 flex items-baseline gap-1 text-[10px] leading-tight">
                <span className="font-mono text-faint">{i + 1}</span>
                <span className="truncate text-muted">{s.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-[11px] text-faint">{caption}</p>
    </div>
  );
}

export type PreviewPage = {
  key: string;
  title: string;
  /** Short real facts about the page (e.g. "Foundation level"). */
  subtitle?: string;
  status: "pending" | "active" | "done" | "error";
};

/** Artifact pages for packages, worksheets and question papers: a document sheet per resource, with its real status. */
export function ArtifactPagesPreview({ pages, caption }: { pages: PreviewPage[]; caption: string }) {
  return (
    <div className="rounded-2xl border border-line bg-sunken/60 p-3 sm:p-5">
      <div className={cn("grid gap-3", pages.length === 1 ? "grid-cols-1 sm:mx-auto sm:max-w-[420px]" : pages.length === 2 ? "grid-cols-2" : pages.length === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
        {pages.map((p, i) => (
          <div
            key={p.key}
            className={cn(
              "std-in relative flex aspect-[1/1.3] flex-col overflow-hidden rounded-lg border bg-surface p-[9%] shadow-[var(--shadow-pop)] transition-[border-color,opacity] duration-300",
              p.status === "active" ? "border-brand" : p.status === "error" ? "border-danger-border" : "border-line-subtle",
              p.status === "pending" && "opacity-60",
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="absolute right-2.5 top-2.5">
              {p.status === "active" ? <StudioIndicator size={14} /> : p.status === "done" ? (
                <span className="std-scale-in flex size-4 items-center justify-center rounded-full bg-brand text-brand-on"><Check className="size-2.5" strokeWidth={3} /></span>
              ) : p.status === "error" ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-danger text-danger-on"><X className="size-2.5" strokeWidth={3} /></span>
              ) : null}
            </span>
            <p className="pr-5 font-serif text-[13px] font-semibold leading-tight text-ink sm:text-[14px]">{p.title}</p>
            {p.subtitle ? <p className="mt-0.5 text-[10px] text-faint">{p.subtitle}</p> : null}
            <span className="mt-[8%] block h-[2px] w-1/4 rounded-full bg-brand/70" />
            <div className="mt-[8%] flex flex-1 flex-col gap-[7%]">
              {[0.92, 0.8, 0.88, 0.6, 0.85, 0.7].map((w, j) => (
                <span
                  key={j}
                  className={cn("block h-[5px] rounded-full", p.status === "active" ? "std-skel" : p.status === "done" ? "bg-line" : "bg-line-subtle")}
                  style={{ width: `${w * 100}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-faint">{caption}</p>
    </div>
  );
}
