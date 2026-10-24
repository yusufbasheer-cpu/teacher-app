const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export type GammaSlidePreview = { title: string; lines: string[]; imagePreview?: string };

function decodeXmlText(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}

function slideNumber(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

/** Reads the exported PPTX in physical order and keeps each real visual attached to its owning slide. */
export async function extractGammaSlidePreviews(blob: Blob, maxImageBytes = 4 * 1024 * 1024): Promise<GammaSlidePreview[]> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => slideNumber(a) - slideNumber(b));
    let totalImageBytes = 0;

    const previews: GammaSlidePreview[] = [];
    for (const [index, name] of slideNames.entries()) {
      const xml = await zip.file(name)!.async("text");
      const text = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi)].map((m) => decodeXmlText(m[1]!)).filter(Boolean);
      const relFile = zip.file(name.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels");
      let imagePreview: string | undefined;
      if (relFile) {
        const rels = new Map([...((await relFile.async("text")).matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/gi))].map((m) => [m[1]!, m[2]!]));
        for (const match of xml.matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"/gi)) {
          const target = rels.get(match[1]!)?.replace(/^\.\.\//, "ppt/");
          const extension = target?.split(".").pop()?.toLowerCase();
          const media = target ? zip.file(target) : null;
          if (!media || !extension || !IMAGE_MIME[extension]) continue;
          const bytes = await media.async("uint8array");
          if (totalImageBytes + bytes.byteLength > maxImageBytes) continue;
          totalImageBytes += bytes.byteLength;
          let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          imagePreview = `data:${IMAGE_MIME[extension]};base64,${btoa(binary)}`;
          break;
        }
      }
      previews.push({ title: text[0] || `Slide ${index + 1}`, lines: text.slice(1, 5), ...(imagePreview ? { imagePreview } : {}) });
    }
    return previews;
  } catch {
    return [];
  }
}
