/**
 * Utilities for parsing an uploaded .pptx template file.
 * Extracts color scheme, fonts, logo image, and thumbnail using JSZip.
 *
 * Required Supabase setup — run BOTH queries in Supabase SQL editor:
 * ─────────────────────────────────────────────────────────────────────
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
 *   logo_base64 text,
 *   created_at timestamptz DEFAULT now(),
 *   UNIQUE(user_id)
 * );
 * ALTER TABLE school_templates ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own template" ON school_templates
 *   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 * -- If table already exists, add the new column:
 * ALTER TABLE school_templates ADD COLUMN IF NOT EXISTS logo_base64 TEXT;
 * ─────────────────────────────────────────────────────────────────────
 */
import JSZip from "jszip";

export type PptxExtractedTheme = {
  primaryColor: string;    // hex without #  (dark brand color → header bar, title text)
  accentColor: string;     // hex without #  (vivid accent → underlines, highlights)
  backgroundColor: string; // hex without #  (slide background)
  darkColor: string;       // hex without #  (deep dark for hero slides)
  fontHeading: string;     // font name for headings
  fontBody: string;        // font name for body text
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
  logo_base64: string | null;
};

// ─── Color Extraction Helpers ────────────────────────────────────────────────

/** Extract a 6-char hex colour value from an XML colour element snippet. */
function extractHex(xmlSnippet: string): string | null {
  // srgbClr val="RRGGBB"
  const m = xmlSnippet.match(/srgbClr\s+val="([0-9A-Fa-f]{6})"/);
  if (m) return m[1]!.toUpperCase();
  // sysClr lastClr="RRGGBB"
  const m2 = xmlSnippet.match(/sysClr[^>]+lastClr="([0-9A-Fa-f]{6})"/);
  if (m2) return m2[1]!.toUpperCase();
  return null;
}

/**
 * Try multiple patterns to get a color from a broad XML context.
 * Handles both namespaced (a:srgbClr) and non-namespaced forms.
 */
function extractHexBroad(xmlSnippet: string): string | null {
  const patterns = [
    /srgbClr\s+val="([0-9A-Fa-f]{6})"/,
    /sysClr[^>]+lastClr="([0-9A-Fa-f]{6})"/,
    /clr\s+val="([0-9A-Fa-f]{6})"/,
    /val="([0-9A-Fa-f]{6})"/,
  ];
  for (const p of patterns) {
    const m = xmlSnippet.match(p);
    if (m) return m[1]!.toUpperCase();
  }
  return null;
}

/** Parse a colour from a named theme colour slot tag. */
function getThemeColor(themeXml: string, tag: string): string | null {
  // Try with namespace prefix first, then without
  for (const prefix of ["a:", ""]) {
    const regex = new RegExp(
      `<${prefix}${tag}[\\s>]([\\s\\S]*?)<\\/${prefix}${tag}>`,
      "i",
    );
    const match = themeXml.match(regex);
    if (match) {
      const color = extractHex(match[1]!);
      if (color) return color;
    }
  }
  return null;
}

// ─── Theme & Font Parsing ─────────────────────────────────────────────────────

function parseThemeColors(
  themeXml: string,
): Omit<PptxExtractedTheme, "fontHeading" | "fontBody"> {
  const dk1 = getThemeColor(themeXml, "dk1");
  const lt1 = getThemeColor(themeXml, "lt1");
  const dk2 = getThemeColor(themeXml, "dk2");
  const lt2 = getThemeColor(themeXml, "lt2");
  const accent1 = getThemeColor(themeXml, "accent1");
  const accent2 = getThemeColor(themeXml, "accent2");
  const accent3 = getThemeColor(themeXml, "accent3");
  const accent6 = getThemeColor(themeXml, "accent6");

  console.log("[pptx-template] Raw theme colour slots extracted:", {
    dk1, lt1, dk2, lt2, accent1, accent2, accent3, accent6,
  });

  // Map to semantic slots
  // primaryColor: the dominant brand colour used for bars and titles
  const primaryColor = accent1 ?? dk2 ?? dk1 ?? "1B3A6B";
  // accentColor: a vivid highlight colour
  const accentColor = accent2 ?? accent3 ?? accent6 ?? "F5A623";
  // backgroundColor: the slide background (usually light or white)
  const backgroundColor = lt1 ?? lt2 ?? "FFFFFF";
  // darkColor: deep colour used for hero/closing slides
  const darkColor = dk1 ?? dk2 ?? "0A1628";

  console.log("[pptx-template] Mapped theme colours:", {
    primaryColor, accentColor, backgroundColor, darkColor,
  });

  return { primaryColor, accentColor, backgroundColor, darkColor };
}

function parseThemeFonts(themeXml: string): { fontHeading: string; fontBody: string } {
  const majorMatch = themeXml.match(/<a:majorFont[^>]*>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);
  const minorMatch = themeXml.match(/<a:minorFont[^>]*>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);

  // +Body / +Heading are pptx meta-names that mean "default theme font"
  const rawHeading = majorMatch?.[1] ?? "Calibri";
  const rawBody    = minorMatch?.[1] ?? "Calibri";
  const fontHeading = rawHeading.startsWith("+") ? "Calibri" : rawHeading;
  const fontBody    = rawBody.startsWith("+")    ? "Calibri" : rawBody;

  console.log("[pptx-template] Extracted fonts:", { fontHeading, fontBody });
  return { fontHeading, fontBody };
}

// ─── Slide Master Background Colour ───────────────────────────────────────────

async function extractMasterBackgroundColor(zip: JSZip): Promise<string | null> {
  const masterFile = zip.file("ppt/slideMasters/slideMaster1.xml");
  if (!masterFile) return null;

  const xml = await masterFile.async("text");

  // Look for background shape (p:bg > p:bgPr > ...) or solid fill (a:solidFill > a:srgbClr)
  const bgPrMatch = xml.match(/<p:bgPr>([\s\S]*?)<\/p:bgPr>/i);
  if (bgPrMatch) {
    const color = extractHexBroad(bgPrMatch[1]!);
    if (color) {
      console.log("[pptx-template] Background colour from slide master bgPr:", color);
      return color;
    }
  }
  return null;
}

// ─── Logo Extraction ──────────────────────────────────────────────────────────

/**
 * Extract the first logo/image found in the slide master.
 * Returns a data-URI string (data:image/png;base64,...) or null.
 */
async function extractMasterLogo(zip: JSZip): Promise<string | null> {
  // Read the slide master relationships to find embedded images
  const masterRelsFile =
    zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels") ??
    zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels");

  if (!masterRelsFile) {
    console.log("[pptx-template] No slide master relationship file found.");
    return null;
  }

  const relsXml = await masterRelsFile.async("text");
  console.log("[pptx-template] Slide master relationships XML (first 500 chars):", relsXml.slice(0, 500));

  // Find all image relationships
  const imageRels: Array<{ id: string; target: string }> = [];
  const relRegex = /Id="([^"]+)"[^>]+Type="[^"]*image[^"]*"[^>]+Target="([^"]+)"/gi;
  let relMatch;
  while ((relMatch = relRegex.exec(relsXml)) !== null) {
    imageRels.push({ id: relMatch[1]!, target: relMatch[2]! });
  }

  console.log("[pptx-template] Image relationships found in master:", imageRels);

  if (imageRels.length === 0) {
    console.log("[pptx-template] No image relationships in slide master — no logo extracted.");
    return null;
  }

  // Use the first image as the logo
  const firstRel = imageRels[0]!;
  // Target is relative to the _rels file location, e.g. "../media/image1.png"
  // Resolve relative to ppt/slideMasters/
  let mediaPath = firstRel.target.replace(/^\.\.\//, "ppt/");
  if (!mediaPath.startsWith("ppt/")) {
    mediaPath = `ppt/slideMasters/${firstRel.target}`;
  }

  console.log("[pptx-template] Trying to read logo from:", mediaPath);

  const imgFile = zip.file(mediaPath);
  if (!imgFile) {
    // Try alternate path resolution
    const altPath = `ppt/media/${firstRel.target.split("/").pop()}`;
    console.log("[pptx-template] Primary path failed, trying:", altPath);
    const altFile = zip.file(altPath);
    if (!altFile) {
      console.log("[pptx-template] Could not find logo image file.");
      return null;
    }
    return await readImageAsDataUri(altFile, altPath);
  }

  return await readImageAsDataUri(imgFile, mediaPath);
}

async function readImageAsDataUri(
  file: JSZip.JSZipObject,
  path: string,
): Promise<string | null> {
  try {
    const bytes = await file.async("uint8array");
    const b64 = Buffer.from(bytes).toString("base64");
    const name = path.toLowerCase();
    let mime = "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mime = "image/jpeg";
    else if (name.endsWith(".gif")) mime = "image/gif";
    else if (name.endsWith(".bmp")) mime = "image/bmp";
    else if (name.endsWith(".svg")) mime = "image/svg+xml";
    const dataUri = `data:${mime};base64,${b64}`;
    console.log(
      `[pptx-template] Logo image extracted: ${path} (${bytes.length} bytes, mime=${mime})`,
    );
    return dataUri;
  } catch (e) {
    console.error("[pptx-template] Failed to read logo image:", e);
    return null;
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Extract colour scheme, fonts, logo image, and thumbnail from a .pptx buffer.
 * Logs each extracted element to the console for verification.
 */
export async function extractPptxTemplate(buffer: ArrayBuffer): Promise<{
  theme: PptxExtractedTheme;
  thumbnailBase64: string | null;
  logoBase64: string | null;
}> {
  console.log("[pptx-template] Starting extraction from uploaded .pptx file...");

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    console.error("[pptx-template] Failed to unzip the .pptx file:", e);
    throw new Error("The uploaded file could not be read as a valid .pptx (ZIP) file.");
  }

  // List all files in the ZIP for debugging
  const allFiles = Object.keys(zip.files);
  console.log("[pptx-template] Files inside .pptx archive:", allFiles.slice(0, 40));

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
    console.log("[pptx-template] Reading theme file:", themeFile.name);
    const themeXml = await themeFile.async("text");
    console.log("[pptx-template] Theme XML length:", themeXml.length, "chars");
    const colors = parseThemeColors(themeXml);
    const fonts = parseThemeFonts(themeXml);
    theme = { ...colors, ...fonts };
  } else {
    console.warn("[pptx-template] No theme XML file found in .pptx. Using defaults.");
  }

  // ── Override background colour from slide master if available ─────────────
  const masterBg = await extractMasterBackgroundColor(zip);
  if (masterBg) {
    theme.backgroundColor = masterBg;
    console.log("[pptx-template] Background colour overridden from slide master:", masterBg);
  }

  // ── Logo from slide master ─────────────────────────────────────────────────
  let logoBase64: string | null = null;
  try {
    logoBase64 = await extractMasterLogo(zip);
    if (logoBase64) {
      console.log("[pptx-template] Logo successfully extracted, data URI length:", logoBase64.length);
    } else {
      console.log("[pptx-template] No logo image extracted from slide master.");
    }
  } catch (e) {
    console.error("[pptx-template] Error during logo extraction:", e);
  }

  // ── Thumbnail from docProps/thumbnail.* ──────────────────────────────────
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
    console.log(
      "[pptx-template] Thumbnail extracted:",
      thumbFile.name,
      `(${thumbBytes.length} bytes)`,
    );
  } else {
    console.log("[pptx-template] No thumbnail found in docProps/.");
  }

  console.log("[pptx-template] Final extracted theme:", theme);
  console.log("[pptx-template] Extraction complete. Logo:", logoBase64 ? "YES" : "NO", "| Thumbnail:", thumbnailBase64 ? "YES" : "NO");

  return { theme, thumbnailBase64, logoBase64 };
}

// ─── Template Design Injection ────────────────────────────────────────────────

/**
 * Inject the visual design from a school's .pptx template into a freshly
 * generated lesson PPTX.
 *
 * Strategy:
 *  1. Open both ZIPs with JSZip.
 *  2. Remove the generated PPT's own theme / slide-masters / slide-layouts.
 *  3. Copy the corresponding files from the template (which contain the school's
 *     background colour, logo on master, fonts, etc.).
 *  4. Also copy any media (images) referenced by the template masters.
 *  5. Repackage as a new PPTX buffer.
 *
 * Falls back to the unmodified generated buffer on any error so the teacher
 * always gets a downloadable file.
 */
export async function injectTemplateDesign(
  generatedBuffer: Buffer,
  templateBuffer: Buffer,
): Promise<Buffer> {
  console.log("[pptx-template] ══ injectTemplateDesign: starting ══");

  let generatedZip: JSZip;
  let templateZip: JSZip;

  try {
    [generatedZip, templateZip] = await Promise.all([
      JSZip.loadAsync(generatedBuffer),
      JSZip.loadAsync(templateBuffer),
    ]);
  } catch (e) {
    console.error("[pptx-template] Failed to open PPTX ZIPs — returning generated buffer unchanged:", e);
    return generatedBuffer;
  }

  const genFileList  = Object.keys(generatedZip.files);
  const tmplFileList = Object.keys(templateZip.files);
  console.log("[pptx-template] Generated PPTX files:", genFileList.length);
  console.log("[pptx-template] Template  PPTX files:", tmplFileList.length);
  console.log("[pptx-template] Template files (first 30):", tmplFileList.slice(0, 30));

  // Design-related paths we want to copy from the template
  const isDesignPath = (p: string) =>
    p.startsWith("ppt/theme/") ||
    p.startsWith("ppt/slideMasters/") ||
    p.startsWith("ppt/slideLayouts/");

  // Step 1 — remove existing design files from the generated PPTX
  const toRemove = genFileList.filter(isDesignPath);
  console.log(`[pptx-template] Removing ${toRemove.length} design files from generated PPTX:`, toRemove);
  toRemove.forEach(p => generatedZip.remove(p));

  // Step 2 — copy design files from the template
  const copied: string[] = [];
  const mediaRefs = new Set<string>();

  for (const path of tmplFileList) {
    if (!isDesignPath(path)) continue;
    const file = templateZip.files[path]!;
    if (file.dir) continue;

    const content = await file.async("arraybuffer");
    generatedZip.file(path, content);
    copied.push(path);

    // Collect media filenames referenced inside .rels files
    if (path.endsWith(".rels")) {
      const xml = new TextDecoder().decode(content);
      const re  = /Target="(?:\.\.\/)?media\/([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        mediaRefs.add(m[1]!);
      }
    }
  }

  console.log(`[pptx-template] Copied ${copied.length} design files from template.`);
  console.log("[pptx-template] Media files referenced by template masters:", [...mediaRefs]);

  // Step 3 — copy media files that the template masters depend on
  let mediaCopied = 0;
  for (const mediaFile of mediaRefs) {
    const srcPath = `ppt/media/${mediaFile}`;
    const srcFile = templateZip.files[srcPath];
    if (!srcFile) {
      console.warn("[pptx-template] Media reference not found in template ZIP:", srcPath);
      continue;
    }
    const content = await srcFile.async("arraybuffer");
    generatedZip.file(srcPath, content);
    mediaCopied++;
    console.log("[pptx-template] Copied media:", srcPath);
  }
  console.log(`[pptx-template] Copied ${mediaCopied} media file(s) from template.`);

  // Step 4 — repackage
  const result = await generatedZip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  console.log(`[pptx-template] ══ Injection complete — output size: ${result.length} bytes ══`);
  return result;
}
