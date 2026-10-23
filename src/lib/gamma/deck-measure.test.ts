/**
 * Opt-in measurement of a downloaded Gamma deck against the Force and Pressure canonical plan. Never calls Gamma.
 *
 *   GAMMA_MEASURE_PPTX="C:/Users/.../force-and-pressure-ppt.pptx" npx vitest run src/lib/gamma/deck-measure.test.ts
 *
 * Prints: slide count and per-slide boundaries, the strict content verdict, font sizes, and pictures per slide.
 * The content verdict is the gate: a failed content check fails this test whatever the design looks like.
 * Credits and stored-artifact reuse come from the server report (X-Layah-Gamma-Report / the AI usage panel).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import fixture from "./__fixtures__/force-and-pressure.json";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { buildGammaPayload } from "./payload";
import { checkLayout, compareToSnapshot, extractPptx } from "./validate";
import { testConfig } from "./test-helpers";

const file = process.env.GAMMA_MEASURE_PPTX;

/** Run sizes (hundredths of a point) actually set on text runs, plus any autofit shrink PowerPoint will apply. */
async function fontSizes(buffer: Buffer): Promise<{ slide: number; minPt: number | null; medianPt: number | null; autofitScale: number | null }[]> {
  const zip = await JSZip.loadAsync(buffer);
  const pres = await zip.file("ppt/presentation.xml")!.async("string");
  const rels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
  const target = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])![1]!, /Target="([^"]+)"/.exec(m[0])![1]!]));
  const order = [...pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => m[1]!);
  const out = [];
  for (const [i, rid] of order.entries()) {
    const xml = await zip.file(`ppt/${target.get(rid)!.replace(/^\/?(ppt\/)?/, "")}`)!.async("string");
    const sizes = [...xml.matchAll(/<a:(?:rPr|defRPr|endParaRPr)\b[^>]*\bsz="(\d+)"/g)].map((m) => Number(m[1]) / 100).sort((a, b) => a - b);
    const scales = [...xml.matchAll(/<a:normAutofit\b[^>]*\bfontScale="(\d+)"/g)].map((m) => Number(m[1]) / 100000);
    out.push({
      slide: i + 1,
      minPt: sizes[0] ?? null,
      medianPt: sizes.length ? sizes[Math.floor(sizes.length / 2)]! : null,
      autofitScale: scales.length ? Math.min(...scales) : null,
    });
  }
  return out;
}

describe.skipIf(!file)("measure a downloaded Gamma deck (opt-in)", () => {
  it("reports boundaries, content, fonts and pictures; content failure fails the run", async () => {
    const buffer = readFileSync(file!);
    const { snapshot, layout, slides } = buildGammaPayload({ deck: fixture.deck as StructuredLessonSlideModel[], title: "t", language: "en", config: testConfig(), lesson: fixture.lesson });
    const deck = await extractPptx(buffer);
    const content = compareToSnapshot(snapshot, deck);
    const pictures = checkLayout(layout, deck);
    const fonts = await fontSizes(buffer);
    const rows = slides.map((s, i) => ({
      slide: i + 1,
      expected: `${s.title}${s.part > 1 ? ` (${s.part}/${s.parts})` : ""}`,
      got: deck.slides[i]?.paragraphs[0]?.text.slice(0, 40) ?? "(missing)",
      pictures: deck.slides[i]?.pictures ?? 0,
      planned: layout[i]!.image,
      minPt: fonts[i]?.minPt,
      medianPt: fonts[i]?.medianPt,
      autofit: fonts[i]?.autofitScale,
    }));
    console.log(JSON.stringify({
      slides: { expected: snapshot.length, actual: deck.slides.length },
      contentVerdict: content.verdict,
      reasons: content.reasons,
      missing: content.missing.slice(0, 10),
      modified: content.modified.slice(0, 10),
      unexpected: content.unexpected.slice(0, 10),
      pictures,
      perSlide: rows,
    }, null, 2));
    expect(content.verdict, content.reasons.join("; ")).not.toBe("failed");
    expect(deck.slides.length).toBe(snapshot.length);
  });
});
