import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import { extractPptxTemplate, injectTemplateDesign } from "./pptx-template";
import * as uploadSecurity from "./upload-security";

const MINIMAL_THEME_XML = `<?xml version="1.0"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:clrScheme>
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:accent1><a:srgbClr val="1B3A6B"/></a:accent1>
      <a:accent2><a:srgbClr val="F5A623"/></a:accent2>
    </a:clrScheme>
  </a:themeElements>
</a:theme>`;

/** `extractPptxTemplate` takes an ArrayBuffer, `injectTemplateDesign` takes a
 *  Buffer (matching how each is actually called in the app) — this converts
 *  a Node Buffer to a real standalone ArrayBuffer (not just `.buffer`, which
 *  can be a larger pooled allocation than the Buffer's own view into it). */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function buildMinimalPptx(opts?: {
  masterRelsXml?: string;
  masterMediaEntries?: Record<string, string>;
}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("ppt/theme/theme1.xml", MINIMAL_THEME_XML);
  zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    opts?.masterRelsXml ??
      '<Relationships xmlns="x"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>',
  );
  for (const [path, content] of Object.entries(opts?.masterMediaEntries ?? { "ppt/media/image1.png": "fake-png-bytes" })) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("extractPptxTemplate", () => {
  it("extracts theme colors from a well-formed .pptx", async () => {
    const buf = await buildMinimalPptx();
    const result = await extractPptxTemplate(toArrayBuffer(buf));
    expect(result.theme.primaryColor).toBe("1B3A6B");
    expect(result.theme.accentColor).toBe("F5A623");
  });

  it("rejects a buffer that isn't a real zip at all", async () => {
    await expect(extractPptxTemplate(toArrayBuffer(Buffer.from("not a zip file")))).rejects.toThrow(
      /could not be read as a valid \.pptx/i,
    );
  });

  it("skips an SVG master image instead of extracting it as the logo (no script-capable data URI)", async () => {
    const buf = await buildMinimalPptx({
      masterRelsXml:
        '<Relationships xmlns="x"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.svg"/></Relationships>',
      masterMediaEntries: { "ppt/media/image1.svg": "<svg onload=\"alert(1)\"/>" },
    });
    const result = await extractPptxTemplate(toArrayBuffer(buf));
    expect(result.logoBase64).toBeNull();
  });

  it("extracts a real raster logo as a data URI", async () => {
    const buf = await buildMinimalPptx();
    const result = await extractPptxTemplate(toArrayBuffer(buf));
    expect(result.logoBase64).toMatch(/^data:image\/png;base64,/);
  });

  describe("decompression-bomb wiring", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("rejects the archive when the zip-safety check fails, before ever returning extracted content", async () => {
      // A real zip bomb has a tiny buffer whose CENTRAL DIRECTORY declares an
      // enormous uncompressed size (see upload-security.test.ts for that
      // check exercised directly against constructed metadata). What matters
      // here is the *wiring*: extractPptxTemplate must actually call
      // inspectZipSafety and refuse to proceed when it fails, rather than
      // extracting first and checking later (by which point a real bomb
      // would have already been decompressed).
      vi.spyOn(uploadSecurity, "inspectZipSafety").mockReturnValue({
        ok: false,
        reason: "simulated: would expand past the safety limit",
      });
      const buf = await buildMinimalPptx();
      await expect(extractPptxTemplate(toArrayBuffer(buf))).rejects.toThrow(/rejected/i);
    });
  });
});

describe("injectTemplateDesign", () => {
  it("merges the template's theme/master/layout files into the generated deck", async () => {
    const generated = await buildMinimalPptx();
    const template = await buildMinimalPptx();
    const result = await injectTemplateDesign(generated, template);
    const zip = await JSZip.loadAsync(result);
    expect(zip.files["ppt/theme/theme1.xml"]).toBeDefined();
  });

  it("falls back to the unmodified generated buffer when the template isn't a real zip", async () => {
    const generated = await buildMinimalPptx();
    const notAZip = Buffer.from("garbage, not a zip");
    const result = await injectTemplateDesign(generated, notAZip);
    expect(result).toBe(generated);
  });

  it("drops a media reference that attempts path traversal instead of copying it verbatim", async () => {
    const generated = await buildMinimalPptx();
    const template = await buildMinimalPptx({
      masterRelsXml:
        '<Relationships xmlns="x"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/../../../../etc/passwd.png"/></Relationships>',
      masterMediaEntries: { "ppt/media/image1.png": "unrelated, the traversal target doesn't exist in this zip" },
    });
    const result = await injectTemplateDesign(generated, template);
    const zip = await JSZip.loadAsync(result);
    // Nothing named with a traversal segment should ever appear in the output.
    for (const name of Object.keys(zip.files)) {
      expect(name).not.toContain("..");
    }
  });

  it("drops a media reference whose extension is not an allowed raster/vector-office format", async () => {
    const generated = await buildMinimalPptx();
    const template = await buildMinimalPptx({
      masterRelsXml:
        '<Relationships xmlns="x"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/payload.html"/></Relationships>',
      masterMediaEntries: { "ppt/media/payload.html": "<script>alert(1)</script>" },
    });
    const result = await injectTemplateDesign(generated, template);
    const zip = await JSZip.loadAsync(result);
    expect(zip.files["ppt/media/payload.html"]).toBeUndefined();
  });
});
