/**
 * Utilities for parsing an uploaded .pptx template file.
 * Extracts color scheme, fonts, and thumbnail using JSZip.
 *
 * Required Supabase setup (run once in Supabase SQL editor):
 * ─────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS school_templates (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
 *   original_filename text NOT NULL,
 *   thumbnail_base64 text,
 *   primary_color text NOT NULL DEFAULT '1B3A6B',
 *   accent_color text NOT NULL DEFAULT 'F5A623',
 *   background_color text NOT NULL DEFAULT 'FFFFFF',
 *   dark_color text NOT NULL DEFAULT '0A1628',
 *   font_heading text NOT NULL DEFAULT 'Calibri',
 *   font_body text NOT NULL DEFAULT 'Calibri',
 *   created_at timestamptz DEFAULT now(),
 *   UNIQUE(user_id)
 * );
 * ALTER TABLE school_templates ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own template" ON school_templates
 *   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 * ─────────────────────────────────────────────────────────
 */
import JSZip from "jszip";

export type PptxExtractedTheme = {
  primaryColor: string;   // hex without #  (dark brand color → used for header bar, title text)
  accentColor: string;    // hex without #  (vivid accent → used for underlines, highlights)
  backgroundColor: string; // hex without # (slide background)
  darkColor: string;       // hex without # (deep dark for hero slides)
  fontHeading: string;
  fontBody: string;
};

export type SchoolTemplateRecord = {
  original_filename: string;
  thumbnail_base64: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  dark_color: string;
  font_heading: string;
  font_body: string;
};

/** Extract a hex color value from an XML color element string. */
function extractHex(xmlSnippet: string): string | null {
  // srgbClr val="RRGGBB"
  const m = xmlSnippet.match(/srgbClr\s+val="([0-9A-Fa-f]{6})"/);
  if (m) return m[1]!.toUpperCase();
  // sysClr lastClr="RRGGBB"
  const m2 = xmlSnippet.match(/sysClr[^>]+lastClr="([0-9A-Fa-f]{6})"/);
  if (m2) return m2[1]!.toUpperCase();
  return null;
}

/** Parse a simple color scheme from ppt/theme/theme1.xml XML string. */
function parseThemeColors(themeXml: string): Omit<PptxExtractedTheme, "fontHeading" | "fontBody"> {
  // We care about: dk1 (dark1), lt1 (light1), accent1, accent2
  const getColor = (tag: string): string | null => {
    const regex = new RegExp(`<a:${tag}>([\\s\\S]*?)<\\/a:${tag}>`, "i");
    const match = themeXml.match(regex);
    if (!match) return null;
    return extractHex(match[1]!);
  };

  const dk1 = getColor("dk1");
  const lt1 = getColor("lt1");
  const dk2 = getColor("dk2");
  const accent1 = getColor("accent1");
  const accent2 = getColor("accent2");

  // Map to our semantic slots
  const primaryColor = accent1 ?? dk2 ?? "1B3A6B";
  const accentColor = accent2 ?? "F5A623";
  const backgroundColor = lt1 ?? "FFFFFF";
  const darkColor = dk1 ?? "0A1628";

  return { primaryColor, accentColor, backgroundColor, darkColor };
}

/** Parse fonts from ppt/theme/theme1.xml. */
function parseThemeFonts(themeXml: string): { fontHeading: string; fontBody: string } {
  const majorMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);
  const minorMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);
  return {
    fontHeading: majorMatch?.[1] ?? "Calibri",
    fontBody: minorMatch?.[1] ?? "Calibri",
  };
}

/**
 * Extract color scheme, fonts, and thumbnail from a .pptx buffer.
 */
export async function extractPptxTemplate(
  buffer: ArrayBuffer,
): Promise<{ theme: PptxExtractedTheme; thumbnailBase64: string | null }> {
  const zip = await JSZip.loadAsync(buffer);

  // ── Colors & fonts from ppt/theme/theme1.xml ──────────────────────────────
  let theme: PptxExtractedTheme = {
    primaryColor: "1B3A6B",
    accentColor: "F5A623",
    backgroundColor: "FFFFFF",
    darkColor: "0A1628",
    fontHeading: "Calibri",
    fontBody: "Calibri",
  };

  const themeFile =
    zip.file("ppt/theme/theme1.xml") ??
    zip.file("ppt/theme/theme2.xml") ??
    zip.file("ppt/theme/theme3.xml");

  if (themeFile) {
    const themeXml = await themeFile.async("text");
    const colors = parseThemeColors(themeXml);
    const fonts = parseThemeFonts(themeXml);
    theme = { ...colors, ...fonts };
  }

  // ── Thumbnail from docProps/thumbnail.jpeg / .png ─────────────────────────
  let thumbnailBase64: string | null = null;
  const thumbFile =
    zip.file("docProps/thumbnail.jpeg") ??
    zip.file("docProps/thumbnail.jpg") ??
    zip.file("docProps/thumbnail.png") ??
    zip.file("docProps/thumbnail.wmf") ??
    zip.file("docProps/thumbnail.emf");

  if (thumbFile) {
    const thumbBytes = await thumbFile.async("uint8array");
    const b64 = Buffer.from(thumbBytes).toString("base64");
    const name = thumbFile.name.toLowerCase();
    const mime = name.endsWith(".png") ? "image/png" : "image/jpeg";
    thumbnailBase64 = `data:${mime};base64,${b64}`;
  }

  return { theme, thumbnailBase64 };
}
