"use client";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/panel";
import type { CuratedGammaTheme } from "@/lib/gamma/themes";
import { pictureMediumFor, type PictureMedium } from "@/lib/gamma/visual-plan";
import type { GammaThemeLoadState } from "./gamma-ppt";

/** Picture options shown to teachers, each mapped onto Gamma's image source + style. */
const PICTURE_CHOICES: { medium: PictureMedium; label: string; hint: string; source: string; style: string }[] = [
  { medium: "illustration", label: "Illustrations", hint: "Drawn pictures made for this lesson", source: "aiGenerated", style: "clean educational illustration, age-appropriate, uncluttered" },
  { medium: "realistic", label: "Realistic images", hint: "Photo-like pictures made for this lesson", source: "aiGenerated", style: "photorealistic, natural lighting, real-world, classroom-appropriate" },
  { medium: "photo", label: "Real photos", hint: "Photographs from a stock library", source: "pexels", style: "" },
  { medium: "none", label: "No pictures", hint: "Text and the theme's design only", source: "noImages", style: "" },
];

export function GammaDesignControls({
  themes, themeLoadState, themeId, imageSource, imageStyle, onThemeChange, onImageSourceChange, onImageStyleChange, onUseLegacy,
}: {
  themes: CuratedGammaTheme[];
  themeLoadState: GammaThemeLoadState;
  themeId: string;
  imageSource: string;
  imageStyle: string;
  onThemeChange: (id: string) => void;
  onImageSourceChange: (value: string) => void;
  onImageStyleChange: (value: string) => void;
  onUseLegacy: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><p className="font-mono text-[10px] uppercase tracking-wider text-brand-text">Slide design</p><h2 className="mt-1 text-[15px] font-semibold text-ink">Choose a look for your slides</h2><p className="mt-1 text-[12px] text-faint">Your lesson stays the same; the theme sets the colours, fonts and layout.</p></div>
        <Button type="button" variant="ghost" size="xs" onClick={onUseLegacy}>Use Layah templates</Button>
      </div>
      {themeLoadState === "loading" ? <Notice tone="brand" className="mb-3">Loading themes…</Notice> : themeLoadState === "error" || themeLoadState === "empty" ? <Notice tone="brand" className="mb-3">Themes couldn&apos;t be loaded right now. Your slides will use a clean default look.</Notice> : (
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1" role="radiogroup" aria-label="Slide theme">
          {themes.map((theme) => {
            const selected = theme.id === themeId;
            return <button key={theme.id} type="button" role="radio" aria-checked={selected} onClick={() => onThemeChange(theme.id)} className={`min-w-0 rounded-lg border p-2 text-left transition-[border-color,background-color] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selected ? "border-brand bg-brand-subtle" : "border-line-subtle bg-surface hover:border-line-strong"}`}>
              <span className="mb-2 flex h-8 overflow-hidden rounded-md border border-line-subtle bg-sunken" aria-hidden>
                {theme.swatch.map((colour) => <span key={colour} className="flex-1" style={{ background: colour }} />)}
              </span>
              <span className="block truncate text-[12px] font-semibold text-ink">{theme.name}</span>
              <span className="block truncate text-[10px] text-faint">{[...theme.toneKeywords, ...theme.colorKeywords].slice(0, 3).join(" · ") || (theme.type === "custom" ? "Your workspace theme" : " ")}</span>
            </button>;
          })}
        </div>
      )}
      <p className="mt-4 mb-2 text-[11px] font-medium text-muted" id="gamma-picture-label">Pictures on your slides</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="gamma-picture-label">
        {PICTURE_CHOICES.map((choice) => {
          const selected = pictureMediumFor(imageSource, imageStyle) === choice.medium;
          return <button key={choice.medium} type="button" role="radio" aria-checked={selected} onClick={() => { onImageSourceChange(choice.source); onImageStyleChange(choice.style); }} className={`min-w-0 rounded-lg border p-2 text-left transition-[border-color,background-color] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selected ? "border-brand bg-brand-subtle" : "border-line-subtle bg-surface hover:border-line-strong"}`}>
            <span className="block text-[12px] font-semibold text-ink">{choice.label}</span>
            <span className="block text-[10px] text-faint">{choice.hint}</span>
          </button>;
        })}
      </div>
    </div>
  );
}

