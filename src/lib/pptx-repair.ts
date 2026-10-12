import JSZip from "jszip";

/**
 * Last-line defence for generated .pptx files.
 *
 * PowerPoint opens a package it considers malformed with "found a problem with content ...
 * repair". The generator tries not to emit such XML, but its inputs are AI output and
 * uploaded documents, so this pass makes the package safe regardless of what reached it:
 *
 *  - strips characters XML 1.0 forbids (form feeds, NULs and similar come from PDF/OCR text);
 *  - rewrites negative shape sizes (illegal in OOXML) as a positive box plus a flip;
 *  - drops [Content_Types] overrides for parts that do not exist;
 *  - writes [Content_Types].xml as the first zip entry.
 *
 * Any failure returns the original buffer: a deck that merely might prompt for repair is
 * better than no download.
 */

const ILLEGAL_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function stripIllegalXmlChars(text: string): string {
  return text.replace(ILLEGAL_XML_CHARS, "");
}

const XFRM =
  /<((?:a|p):xfrm)((?:\s[^>]*)?)>(\s*)<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>(\s*)<a:ext cx="(-?\d+)" cy="(-?\d+)"\s*\/>/g;

function setFlip(attrs: string, name: "flipH" | "flipV"): string {
  const re = new RegExp(`\\s${name}="(?:1|true)"`);
  // A flip that is already set cancels out: flipping a mirrored box restores it.
  if (re.test(attrs)) return attrs.replace(re, "");
  return `${attrs.replace(new RegExp(`\\s${name}="(?:0|false)"`), "")} ${name}="1"`;
}

/** Turns a negative width/height into a positive one at the right offset, with a flip. */
export function fixNegativeExtents(xml: string): string {
  return xml.replace(XFRM, (match, tag, attrs, ws1, x, y, ws2, cx, cy) => {
    let nx = Number(x);
    let ny = Number(y);
    let ncx = Number(cx);
    let ncy = Number(cy);
    if (ncx >= 0 && ncy >= 0) return match;
    let nextAttrs: string = attrs;
    if (ncx < 0) {
      nx += ncx;
      ncx = -ncx;
      nextAttrs = setFlip(nextAttrs, "flipH");
    }
    if (ncy < 0) {
      ny += ncy;
      ncy = -ncy;
      nextAttrs = setFlip(nextAttrs, "flipV");
    }
    return `<${tag}${nextAttrs}>${ws1}<a:off x="${nx}" y="${ny}"/>${ws2}<a:ext cx="${ncx}" cy="${ncy}"/>`;
  });
}

function dropDanglingOverrides(contentTypes: string, parts: Set<string>): string {
  return contentTypes.replace(/<Override\b[^>]*\/>/g, (tag) => {
    const part = /PartName="([^"]+)"/.exec(tag)?.[1];
    return part && !parts.has(part.replace(/^\//, "")) ? "" : tag;
  });
}

export async function repairPptxPackage(buffer: Buffer): Promise<Buffer> {
  try {
    const source = await JSZip.loadAsync(buffer);
    const names = Object.keys(source.files).filter((name) => !source.files[name]!.dir);
    const parts = new Set(names);
    const out = new JSZip();

    const order = ["[Content_Types].xml", ...names.filter((n) => n !== "[Content_Types].xml")];
    for (const name of order) {
      const entry = source.files[name];
      if (!entry) continue;
      if (/\.(xml|rels)$/i.test(name)) {
        let text = stripIllegalXmlChars(await entry.async("string"));
        if (/^ppt\/(slides|slideLayouts|slideMasters|notesSlides)\//.test(name)) text = fixNegativeExtents(text);
        if (name === "[Content_Types].xml") text = dropDanglingOverrides(text, parts);
        out.file(name, text);
      } else {
        out.file(name, await entry.async("nodebuffer"));
      }
    }
    return await out.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  } catch (error) {
    console.error("[pptx-repair] could not post-process the deck; returning it unchanged:", error);
    return buffer;
  }
}
