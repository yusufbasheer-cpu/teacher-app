const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/** Extracts a small gallery from the actual exported PPTX so the loader never invents image previews. */
export async function extractGammaImagePreviews(blob: Blob, limit = 12, maxTotalBytes = 4 * 1024 * 1024): Promise<string[]> {
  try {
    // Loaded on demand: only a finished Gamma deck needs it, so it stays out of the generator's initial bundle.
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files)
      .filter((name) => /^ppt\/media\/[^/]+\.(?:png|jpe?g|webp|gif)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const previews: string[] = [];
    let totalBytes = 0;
    for (const name of names) {
      if (previews.length >= limit) break;
      const bytes = await zip.file(name)!.async("uint8array");
      if (totalBytes + bytes.byteLength > maxTotalBytes) continue;
      totalBytes += bytes.byteLength;
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const extension = name.split(".").pop()!.toLowerCase();
      previews.push(`data:${IMAGE_MIME[extension]};base64,${btoa(binary)}`);
    }
    return previews;
  } catch {
    return [];
  }
}
