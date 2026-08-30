/**
 * Client-safe template metadata — no Node.js built-ins.
 * Import from here in client components (lesson-plan-generator, teacher-package-viewer).
 * Server-only rendering lives in ppt-template-engine.ts.
 */

// ─── JSON template types ──────────────────────────────────────────────────────

type TemplateColors = {
  accent: string;
  background: string;
  headerBar: string;
  headerText: string;
  titleSlideBackground: string;
  titleSlideTitle: string;
  titleSlideSubtitle: string;
  contentText: string;
  footerBackground: string;
  footerBorder: string;
  footerText: string;
  progressTrack: string;
  progressFill: string;
  imagePanelBackground: string;
  imagePanelBorder: string;
};

type TemplateFonts = { titleSize: number; contentSize: number; face: string };

type TemplateDesign = {
  radius: { card: number; chip: number; image: number };
  shadow: { color: string; opacity: number; blur: number; offset: number };
  cardFill: string;
  cardBorder: string;
  checklistTick: string;
  chipFill: string;
  chipText: string;
  typography: { sectionLabel: number; bulletLead: number; caption: number };
};

const DEFAULT_DESIGN: TemplateDesign = {
  radius: { card: 0.12, chip: 0.14, image: 0.14 },
  shadow: { color: "0A1628", opacity: 0.18, blur: 8, offset: 3 },
  cardFill: "F6FBFA",
  cardBorder: "E2E8F0",
  checklistTick: "00C6A7",
  chipFill: "EEF9F7",
  chipText: "0A8F7A",
  typography: { sectionLabel: 12, bulletLead: 16, caption: 11 },
};

type TitleSlideLayout = {
  accentBarW: number;
  iconX: number; iconY: number; iconFontSize: number;
  titleX: number; titleY: number; titleW: number; titleH: number; titleFontSize: number;
  accentLineY: number;
  subtitleX: number; subtitleY: number; subtitleW: number; subtitleH: number; subtitleFontSize: number;
  imageX: number; imageY: number; imageW: number; imageH: number;
};

type TemplateLayout = {
  slideW: number; slideH: number;
  header: { x: number; y: number; w: number; h: number };
  headerIconX: number;
  headerTitleX: number;
  contentArea: { x: number; y: number; w: number; h: number };
  imageArea: { x: number; y: number; w: number; h: number };
  footer: { x: number; y: number; w: number; h: number };
  progressBar: { y: number; h: number };
  titleSlide: TitleSlideLayout;
};

export type TemplateConfig = {
  id: string;
  name: string;
  description: string;
  colors: TemplateColors;
  fonts: TemplateFonts;
  layout: TemplateLayout;
  design: TemplateDesign;
};

// ─── Public template IDs ──────────────────────────────────────────────────────

export type TemplateId = "classic" | "modern" | "warm" | "dark" | "minimal";
export const TEMPLATE_IDS: readonly TemplateId[] = ["classic", "modern", "warm", "dark", "minimal"];
export const DEFAULT_TEMPLATE_ID: TemplateId = "classic";

export function isValidTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

// ─── Template configs (bundled from JSON at build time) ───────────────────────

import classicJson from "./ppt-templates/classic.json";
import modernJson  from "./ppt-templates/modern.json";
import warmJson    from "./ppt-templates/warm.json";
import darkJson    from "./ppt-templates/dark.json";
import minimalJson from "./ppt-templates/minimal.json";

function withDesignDefaults(raw: unknown): TemplateConfig {
  const cfg = raw as TemplateConfig;
  return { ...cfg, design: { ...DEFAULT_DESIGN, ...(cfg.design ?? {}) } };
}

const TEMPLATE_MAP: Record<TemplateId, TemplateConfig> = {
  classic: withDesignDefaults(classicJson),
  modern:  withDesignDefaults(modernJson),
  warm:    withDesignDefaults(warmJson),
  dark:    withDesignDefaults(darkJson),
  minimal: withDesignDefaults(minimalJson),
};

export function getTemplateConfig(id: string): TemplateConfig {
  return TEMPLATE_MAP[id as TemplateId] ?? TEMPLATE_MAP.classic;
}

// ─── UI selector card metadata ────────────────────────────────────────────────

export const TEMPLATE_CARDS: readonly {
  id: TemplateId;
  themeNumber: number;
  name: string;
  description: string;
  preview: readonly [string, string, string];
}[] = [
  { id: "classic", themeNumber: 1, name: "Classic", description: "Clean professional Navy and White", preview: ["0A1628", "007B67", "FFFFFF"] },
  { id: "modern",  themeNumber: 2, name: "Modern",  description: "Bold Minimal Teal and White",       preview: ["006B5A", "087866", "FFFFFF"] },
  { id: "warm",    themeNumber: 3, name: "Warm",     description: "Friendly Orange and Cream",         preview: ["A13C11", "92400E", "FFF8F0"] },
  { id: "dark",    themeNumber: 4, name: "Dark",     description: "Premium Dark Navy and Gold",        preview: ["1A1A2E", "FFD700", "16213E"] },
  { id: "minimal", themeNumber: 5, name: "Minimal",  description: "Pure Clean White",                 preview: ["111827", "6B7280", "FFFFFF"] },
];
