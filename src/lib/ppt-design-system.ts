import type { PresentationLanguage } from "@/lib/ppt-language";
import type { TemplateConfig } from "@/lib/ppt-template-config";

export const PPT_DESIGN_SYSTEM_VERSION = 1 as const;

export const PPT_GRID = {
  width: 13.333,
  height: 7.5,
  safe: { left: 0.68, right: 0.68, top: 0.42, bottom: 0.38 },
  title: { y: 0.38, h: 0.78 },
  content: { y: 1.48, bottom: 6.84 },
  footer: { y: 7.08, h: 0.42 },
  gap: 0.34,
} as const;

export type PptDesignTokens = {
  version: typeof PPT_DESIGN_SYSTEM_VERSION;
  width: number;
  height: number;
  rtl: boolean;
  fontFace: string;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    mutedText: string;
    accent: string;
    accentText: string;
    accentSoft: string;
    rule: string;
    positive: string;
  };
  type: {
    display: number;
    title: number;
    section: number;
    body: number;
    caption: number;
    minimumBody: number;
    lineHeight: number;
  };
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
};

function safeHex(value: string, fallback: string): string {
  return /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

export function hexLuminance(hex: string): number {
  const value = safeHex(hex.replace(/^#/, ""), "000000");
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [hexLuminance(foreground), hexLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Shared design tokens for both future preview code and the current editable PPTX renderer. */
export function getPptDesignTokens(
  template: TemplateConfig,
  language: PresentationLanguage,
): PptDesignTokens {
  const rtl = language === "ar";
  const background = safeHex(template.colors.background, "FFFFFF");
  const text = safeHex(template.colors.contentText, "202A35");
  const accent = safeHex(template.colors.accent, "087866");
  const accentText = contrastRatio("FFFFFF", accent) >= contrastRatio("111827", accent) ? "FFFFFF" : "111827";
  const preferredSurface = safeHex(template.design.cardFill, "F3F7F6");
  const softAccent = safeHex(template.design.chipFill, "EEF6F4");
  const mutedText = safeHex(template.colors.footerText, "4B5563");
  const body = Math.max(16, Math.min(18, template.fonts.contentSize));
  return {
    version: PPT_DESIGN_SYSTEM_VERSION,
    width: template.layout.slideW,
    height: template.layout.slideH,
    rtl,
    fontFace: template.fonts.face,
    colors: {
      background,
      surface: preferredSurface,
      surfaceAlt: safeHex(template.colors.footerBackground, "F7F9FA"),
      text,
      mutedText: contrastRatio(mutedText, background) >= 4.5 ? mutedText : text,
      accent,
      accentText,
      accentSoft: softAccent,
      rule: safeHex(template.design.cardBorder, "D7E0E2"),
      positive: safeHex(template.design.checklistTick, accent),
    },
    type: {
      display: 32,
      title: Math.max(28, Math.min(34, template.fonts.titleSize - 2)),
      section: 22,
      body,
      caption: 13,
      minimumBody: 15,
      lineHeight: 1.16,
    },
    space: { xs: 0.12, sm: 0.22, md: 0.34, lg: 0.56, xl: 0.82 },
  };
}

export function estimateTextLineCount(text: string, widthInches: number, fontPt: number): number {
  const charsPerLine = Math.max(18, Math.floor(widthInches * (72 / Math.max(fontPt * 0.53, 6))));
  return text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

export function estimateTextHeight(text: string, widthInches: number, fontPt: number): number {
  return estimateTextLineCount(text, widthInches, fontPt) * (fontPt / 72) * 1.28;
}

export function textFitsRegion(text: string, region: { w: number; h: number }, fontPt: number): boolean {
  return estimateTextHeight(text, region.w, fontPt) <= region.h;
}

export function mirrorRegion(region: { x: number; y: number; w: number; h: number }, rtl: boolean): typeof region {
  return rtl ? { ...region, x: PPT_GRID.width - region.x - region.w } : region;
}
