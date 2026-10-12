import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildPptxFromPptContent } from "@/lib/lesson-plan-export";
import { fixNegativeExtents, repairPptxPackage, stripIllegalXmlChars } from "@/lib/pptx-repair";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/;
const NEGATIVE_EXTENT = /<a:ext cx="-\d+"|<a:ext cx="\d+" cy="-\d+"/;

describe("stripIllegalXmlChars", () => {
  it("removes characters XML 1.0 forbids and keeps ordinary text, tabs and newlines", () => {
    expect(stripIllegalXmlChars("Ti\u000ctle \u0000with\u000b junk\u001f\tand\nlines — مرحبا 😀")).toBe(
      "Title with junk\tand\nlines — مرحبا 😀",
    );
  });
});

describe("fixNegativeExtents", () => {
  it("turns a negative height into a positive box with a vertical flip", () => {
    const out = fixNegativeExtents('<a:xfrm><a:off x="100" y="500"/><a:ext cx="40" cy="-200"/></a:xfrm>');
    expect(out).toBe('<a:xfrm flipV="1"><a:off x="100" y="300"/><a:ext cx="40" cy="200"/></a:xfrm>');
  });

  it("handles a negative width and keeps other attributes", () => {
    const out = fixNegativeExtents('<a:xfrm rot="60000"><a:off x="100" y="50"/><a:ext cx="-30" cy="10"/></a:xfrm>');
    expect(out).toBe('<a:xfrm rot="60000" flipH="1"><a:off x="70" y="50"/><a:ext cx="30" cy="10"/></a:xfrm>');
  });

  it("leaves valid shapes untouched", () => {
    const xml = '<a:xfrm flipV="1"><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm>';
    expect(fixNegativeExtents(xml)).toBe(xml);
  });
});

function hostileDeck(): StructuredLessonSlideModel[] {
  return Array.from({ length: 13 }, (_, i) => ({
    slideTitle: `Slide ${i + 1} \u0001 & <title>`,
    body: `Body \u000b with \u0000 control chars & <markup>\n- point\n- another \u001f point`,
    speakerNotes: `Notes \u0008 & more ${i}`,
    includeImageSlot: false,
  }));
}

describe("generated deck", () => {
  it.each(["classic", "modern", "warm", "dark", "minimal"] as const)(
    "has no illegal characters or negative shape sizes (%s)",
    async (themeId) => {
      const buffer = await buildPptxFromPptContent({
        subject: "ICT",
        grade: "Grade 10",
        topic: "Applying ICT",
        pptContent: "x",
        themeId,
        structuredSlides: hostileDeck(),
      });
      const zip = await JSZip.loadAsync(buffer);
      const names = Object.keys(zip.files).filter((n) => /\.(xml|rels)$/.test(n));
      expect(names.length).toBeGreaterThan(20);
      for (const name of names) {
        const text = await zip.files[name]!.async("string");
        expect(ILLEGAL.test(text), `${name} has an illegal XML character`).toBe(false);
        if (name.startsWith("ppt/slides/")) {
          expect(NEGATIVE_EXTENT.test(text), `${name} has a negative shape size`).toBe(false);
        }
      }
      expect(Object.keys(zip.files)[0]).toBe("[Content_Types].xml");
    },
    60000,
  );
});

describe("repairPptxPackage", () => {
  it("returns the input unchanged when it is not a zip", async () => {
    const notZip = Buffer.from("not a pptx");
    expect(await repairPptxPackage(notZip)).toBe(notZip);
  });
});
