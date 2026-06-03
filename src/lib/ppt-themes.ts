/**
 * PPT theme identity — thin wrapper that re-exports the canonical template IDs
 * and card metadata from the template engine.  The actual rendering is done by
 * ppt-template-engine.ts; this file exists so every import site can keep using
 * the PptThemeId / PPT_THEME_CARDS / DEFAULT_PPT_THEME_ID names unchanged.
 */

export {
  TEMPLATE_IDS      as PPT_THEME_IDS,
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  isValidTemplateId as isValidPptThemeId,
  TEMPLATE_CARDS    as PPT_THEME_CARDS,
  type TemplateId   as PptThemeId,
} from "@/lib/ppt-template-config";

// ─── PptRenderTheme ─────────────────────────────────────────────────────────
// Kept for school-template compatibility (buildSchoolTemplatePptRenderTheme).
// No longer used for the main Layah rendering path.

/** @deprecated Use ppt-template-engine.ts TemplateConfig for rendering. */
export type PptRenderTheme = {
  id: string;
  heroDeep: string;
  heroMid: string;
  heroWash: string;
  heroAccentLine: string;
  heroTitle: string;
  heroSubtitle: string;
  heroFooter: string;
  slideBg: string;
  topBar: string;
  sideAccent: string;
  titleText: string;
  titleUnderline: string;
  metaText: string;
  bodyText: string;
  bodyAccent: string;
  footerLine: string;
  footerText: string;
  imagePanelFill: string;
  imagePanelLine: string;
  placeholderFill: string;
  placeholderLine: string;
  placeholderInner: string;
  closingDeep: string;
  closingWash: string;
  closingTitle: string;
  closingSubtitle: string;
  closingFooter: string;
  fontFace?: string;
};

/**
 * Build a PptRenderTheme from colors extracted from a school's .pptx template.
 * All hex values are 6-char without the leading #.
 * @deprecated Use buildPptxFromTemplateEngine with a custom TemplateConfig instead.
 */
export function buildSchoolTemplatePptRenderTheme(params: {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  darkColor: string;
  fontFace?: string;
}): PptRenderTheme {
  const { primaryColor, accentColor, backgroundColor, darkColor, fontFace } = params;
  const isLightBg = _isLight(backgroundColor);
  const bodyText  = isLightBg ? "1A1A2E" : "F0F4FF";
  const metaText  = isLightBg ? "5B6472" : "C0CFEE";
  return {
    id: "custom",
    heroDeep: darkColor,
    heroMid: primaryColor,
    heroWash: primaryColor,
    heroAccentLine: accentColor,
    heroTitle: "FFFFFF",
    heroSubtitle: "E2ECFF",
    heroFooter: "D7E7FF",
    slideBg: backgroundColor,
    topBar: primaryColor,
    sideAccent: accentColor,
    titleText: isLightBg ? primaryColor : "FFFFFF",
    titleUnderline: accentColor,
    metaText,
    bodyText,
    bodyAccent: accentColor,
    footerLine: isLightBg ? "DDE6F5" : "2A4070",
    footerText: metaText,
    imagePanelFill: isLightBg ? "F0F4FA" : "1E3A6A",
    imagePanelLine: isLightBg ? "D0DEFA" : "2E4E8A",
    placeholderFill: isLightBg ? "F6F8FC" : "1E3A6A",
    placeholderLine: isLightBg ? "D0DEFA" : "2E4E8A",
    placeholderInner: isLightBg ? "E3EAF8" : "2A4070",
    closingDeep: darkColor,
    closingWash: primaryColor,
    closingTitle: "FFFFFF",
    closingSubtitle: "E2ECFF",
    closingFooter: "D7E7FF",
    fontFace: fontFace && !fontFace.startsWith("+") ? fontFace : undefined,
  };
}

/** @deprecated kept only for buildSchoolTemplatePptRenderTheme */
export function getPptRenderTheme(_id: string | undefined): PptRenderTheme {
  // This function is no longer used by the main rendering path.
  // It returns a stub so any lingering call sites don't throw.
  return buildSchoolTemplatePptRenderTheme({
    primaryColor: "0A1628", accentColor: "00C6A7",
    backgroundColor: "FFFFFF", darkColor: "06101E",
  });
}

function _isLight(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}
