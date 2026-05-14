export const PPT_THEME_IDS = [
  "ocean-blue",
  "emerald-professional",
  "sunset-warm",
  "midnight-modern",
  "clean-minimal",
] as const;

export type PptThemeId = (typeof PPT_THEME_IDS)[number];

export const DEFAULT_PPT_THEME_ID: PptThemeId = "ocean-blue";

export function isValidPptThemeId(value: unknown): value is PptThemeId {
  return typeof value === "string" && (PPT_THEME_IDS as readonly string[]).includes(value);
}

/** Card data for the lesson plan generator (preview swatches are hex without #). */
export const PPT_THEME_CARDS: readonly {
  id: PptThemeId;
  themeNumber: number;
  name: string;
  description: string;
  preview: readonly [string, string, string];
}[] = [
  {
    id: "ocean-blue",
    themeNumber: 1,
    name: "Ocean Blue",
    description: "Dark blue and gold",
    preview: ["102746", "1B3A6B", "F5A623"],
  },
  {
    id: "emerald-professional",
    themeNumber: 2,
    name: "Emerald Professional",
    description: "Deep green and white",
    preview: ["064E3B", "047857", "FFFFFF"],
  },
  {
    id: "sunset-warm",
    themeNumber: 3,
    name: "Sunset Warm",
    description: "Orange and cream",
    preview: ["C2410C", "FB923C", "FFF7ED"],
  },
  {
    id: "midnight-modern",
    themeNumber: 4,
    name: "Midnight Modern",
    description: "Dark mode purple",
    preview: ["1E1B4B", "4C1D95", "C4B5FD"],
  },
  {
    id: "clean-minimal",
    themeNumber: 5,
    name: "Clean Minimal",
    description: "Pure white corporate",
    preview: ["111827", "E5E7EB", "FFFFFF"],
  },
];

/** Colors and chrome for PptxGenJS (hex without #). */
export type PptRenderTheme = {
  id: PptThemeId;
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
};

/**
 * Build a PptRenderTheme from colors extracted from a school's .pptx template.
 * All hex values must be 6-char without the leading #.
 */
export function buildSchoolTemplatePptRenderTheme(params: {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  darkColor: string;
}): PptRenderTheme {
  const { primaryColor, accentColor, backgroundColor, darkColor } = params;
  return {
    id: "ocean-blue", // placeholder — won't be used for rendering
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
    titleText: primaryColor,
    titleUnderline: accentColor,
    metaText: "5B6472",
    bodyText: "333333",
    bodyAccent: primaryColor,
    footerLine: "DDE6F5",
    footerText: "5B6472",
    imagePanelFill: "F0F4FA",
    imagePanelLine: "D0DEFA",
    placeholderFill: "F6F8FC",
    placeholderLine: "D0DEFA",
    placeholderInner: "E3EAF8",
    closingDeep: darkColor,
    closingWash: primaryColor,
    closingTitle: "FFFFFF",
    closingSubtitle: "E2ECFF",
    closingFooter: "D7E7FF",
  };
}

export function getPptRenderTheme(id: PptThemeId | undefined): PptRenderTheme {
  const themeId = id && isValidPptThemeId(id) ? id : DEFAULT_PPT_THEME_ID;
  switch (themeId) {
    case "emerald-professional":
      return {
        id: themeId,
        heroDeep: "022C22",
        heroMid: "064E3B",
        heroWash: "047857",
        heroAccentLine: "A7F3D0",
        heroTitle: "FFFFFF",
        heroSubtitle: "D1FAE5",
        heroFooter: "ECFDF5",
        slideBg: "FFFFFF",
        topBar: "064E3B",
        sideAccent: "10B981",
        titleText: "064E3B",
        titleUnderline: "059669",
        metaText: "4B5563",
        bodyText: "1F2937",
        bodyAccent: "047857",
        footerLine: "D1FAE5",
        footerText: "6B7280",
        imagePanelFill: "ECFDF5",
        imagePanelLine: "A7F3D0",
        placeholderFill: "F0FDF4",
        placeholderLine: "86EFAC",
        placeholderInner: "BBF7D0",
        closingDeep: "022C22",
        closingWash: "064E3B",
        closingTitle: "FFFFFF",
        closingSubtitle: "D1FAE5",
        closingFooter: "ECFDF5",
      };
    case "sunset-warm":
      return {
        id: themeId,
        heroDeep: "7C2D12",
        heroMid: "C2410C",
        heroWash: "EA580C",
        heroAccentLine: "FDE68A",
        heroTitle: "FFFFFF",
        heroSubtitle: "FFEDD5",
        heroFooter: "FFF7ED",
        slideBg: "FFF7ED",
        topBar: "C2410C",
        sideAccent: "FB923C",
        titleText: "9A3412",
        titleUnderline: "F97316",
        metaText: "7C2D12",
        bodyText: "431407",
        bodyAccent: "EA580C",
        footerLine: "FED7AA",
        footerText: "9A3412",
        imagePanelFill: "FFEDD5",
        imagePanelLine: "FDBA74",
        placeholderFill: "FFF1E6",
        placeholderLine: "FDBA74",
        placeholderInner: "FDE68A",
        closingDeep: "7C2D12",
        closingWash: "C2410C",
        closingTitle: "FFFFFF",
        closingSubtitle: "FFEDD5",
        closingFooter: "FFF7ED",
      };
    case "midnight-modern":
      return {
        id: themeId,
        heroDeep: "0F0720",
        heroMid: "1E1B4B",
        heroWash: "312E81",
        heroAccentLine: "C4B5FD",
        heroTitle: "F5F3FF",
        heroSubtitle: "DDD6FE",
        heroFooter: "EDE9FE",
        slideBg: "F5F3FF",
        topBar: "312E81",
        sideAccent: "7C3AED",
        titleText: "312E81",
        titleUnderline: "A855F7",
        metaText: "5B21B6",
        bodyText: "1E1B4B",
        bodyAccent: "7C3AED",
        footerLine: "DDD6FE",
        footerText: "5B21B6",
        imagePanelFill: "EDE9FE",
        imagePanelLine: "C4B5FD",
        placeholderFill: "EDE9FE",
        placeholderLine: "A78BFA",
        placeholderInner: "DDD6FE",
        closingDeep: "0F0720",
        closingWash: "312E81",
        closingTitle: "F5F3FF",
        closingSubtitle: "DDD6FE",
        closingFooter: "EDE9FE",
      };
    case "clean-minimal":
      return {
        id: themeId,
        heroDeep: "F9FAFB",
        heroMid: "F3F4F6",
        heroWash: "E5E7EB",
        heroAccentLine: "111827",
        heroTitle: "111827",
        heroSubtitle: "4B5563",
        heroFooter: "6B7280",
        slideBg: "FFFFFF",
        topBar: "111827",
        sideAccent: "9CA3AF",
        titleText: "111827",
        titleUnderline: "374151",
        metaText: "6B7280",
        bodyText: "1F2937",
        bodyAccent: "111827",
        footerLine: "E5E7EB",
        footerText: "6B7280",
        imagePanelFill: "F9FAFB",
        imagePanelLine: "E5E7EB",
        placeholderFill: "F3F4F6",
        placeholderLine: "D1D5DB",
        placeholderInner: "E5E7EB",
        closingDeep: "111827",
        closingWash: "1F2937",
        closingTitle: "FFFFFF",
        closingSubtitle: "E5E7EB",
        closingFooter: "D1D5DB",
      };
    case "ocean-blue":
    default:
      return {
        id: "ocean-blue",
        heroDeep: "102746",
        heroMid: "1B3A6B",
        heroWash: "234A82",
        heroAccentLine: "F5A623",
        heroTitle: "FFFFFF",
        heroSubtitle: "E2ECFF",
        heroFooter: "D7E7FF",
        slideBg: "FFFFFF",
        topBar: "1B3A6B",
        sideAccent: "F5A623",
        titleText: "1B3A6B",
        titleUnderline: "F5A623",
        metaText: "5B6472",
        bodyText: "333333",
        bodyAccent: "1B3A6B",
        footerLine: "DDE6F5",
        footerText: "5B6472",
        imagePanelFill: "EAF1FB",
        imagePanelLine: "D0DEFA",
        placeholderFill: "F6F8FC",
        placeholderLine: "D0DEFA",
        placeholderInner: "E3EAF8",
        closingDeep: "102746",
        closingWash: "1B3A6B",
        closingTitle: "FFFFFF",
        closingSubtitle: "E2ECFF",
        closingFooter: "D7E7FF",
      };
  }
}
