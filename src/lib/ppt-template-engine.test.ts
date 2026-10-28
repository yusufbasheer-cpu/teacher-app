import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import sharp from "sharp";
import { buildStructuredLessonSlides } from "./ppt-structured-lesson";
import { buildPptxFromTemplateEngine, chunkLinesByHeight, normalizePptImageForPptx } from "./ppt-template-engine";
import { estimateRowHeight, isGroupHeaderLine } from "./ppt-render-primitives";

// Wide enough that none of the fixture lines below wrap onto a second line, so each
// line's height is driven purely by whether it's a group-header row, not word-wrap.
const CPL = 200;

const HEADER_1 = "Higher Achievers task";
const INSTR_1 = "First instruction sentence.";
const INSTR_2 = "Second instruction sentence.";
const HEADER_2 = "Middle Achievers task";
const INSTR_3 = "Third instruction sentence.";

describe("PPTX untrusted image normalization", () => {
  it("accepts legitimate PNG and JPEG input but passes only JPEG bytes to PptxGenJS", async () => {
    const png = await sharp({ create: { width: 1600, height: 900, channels: 4, background: "#2288cc" } }).png().toBuffer();
    const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#cc8822" } }).jpeg().toBuffer();
    for (const input of [png, jpeg]) {
      const asset = await normalizePptImageForPptx(input);
      expect(asset.dataUri).toMatch(/^data:image\/jpeg;base64,/);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      const output = Buffer.from(asset.dataUri.split(",")[1]!, "base64");
      expect(output.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    }
  });

  it("rejects malformed and unsupported image inputs before PPTX rendering", async () => {
    await expect(normalizePptImageForPptx(Buffer.from("not an image"))).rejects.toThrow("Unsupported PPT image format");
    await expect(normalizePptImageForPptx(Buffer.from("GIF89a"))).rejects.toThrow("Unsupported PPT image format");
  });

  it("rejects a PNG with dimensions over the image processing budget", async () => {
    const oversized = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversized);
    oversized.writeUInt32BE(50_000, 16);
    oversized.writeUInt32BE(50_000, 20);
    await expect(normalizePptImageForPptx(oversized)).rejects.toThrow("exceeding");
  });
});

describe("chunkLinesByHeight — activity headers never get stranded across a page break", () => {
  it("carries a standalone sub-heading forward instead of leaving it as the last line of a chunk", () => {
    const lines = [HEADER_1, INSTR_1, INSTR_2, HEADER_2, INSTR_3];
    // Just enough room for one header line alone — the tightest possible budget, and
    // the exact shape that used to strand a header at the bottom of a slide with none
    // of its own content ("Step 2" heading on one slide, its instructions starting a
    // bare "Continued" slide with no heading at all).
    const maxHeight = estimateRowHeight(HEADER_1, CPL, 1, "activity");

    const chunks = chunkLinesByHeight(lines, CPL, maxHeight, "activity");

    // No chunk ends on a bare group-header line.
    for (const chunk of chunks) {
      const last = chunk[chunk.length - 1]!;
      expect(isGroupHeaderLine(last), `chunk ${JSON.stringify(chunk)} ends on a header`).toBe(false);
    }

    // Every header stays in the same chunk as at least the next line, not alone.
    for (const chunk of chunks) {
      if (chunk[0] === HEADER_1 || chunk[0] === HEADER_2) {
        expect(chunk.length, `header-led chunk ${JSON.stringify(chunk)} has content after it`).toBeGreaterThan(1);
      }
    }

    // No line dropped, duplicated, or reordered by chunking.
    expect(chunks.flat()).toEqual(lines);
  });

  it("still chunks normally when there is no orphan-header risk", () => {
    const lines = [INSTR_1, INSTR_2, INSTR_3];
    const tightHeight = estimateRowHeight(INSTR_1, CPL, 1, "activity");
    const chunks = chunkLinesByHeight(lines, CPL, tightHeight, "activity");
    expect(chunks.flat()).toEqual(lines);
    // One instruction per chunk at this tight a budget — no header-carry logic needed.
    expect(chunks.every((c) => c.length === 1)).toBe(true);
  });

  it("does not apply header-carry logic to non-activity variants", () => {
    // "Higher Achievers task" still matches isGroupHeaderLine shape, but bullet/checklist
    // variants never render it as a heading in the first place, so there is nothing to
    // strand — the carry-forward path is intentionally scoped to variant === "activity".
    const lines = [HEADER_1, INSTR_1];
    const maxHeight = estimateRowHeight(HEADER_1, CPL, 1, "bullet");
    const chunks = chunkLinesByHeight(lines, CPL, maxHeight, "bullet");
    expect(chunks.flat()).toEqual(lines);
  });

  it("never loses or reorders lines across an arbitrary number of forced breaks", () => {
    const lines = Array.from({ length: 12 }, (_, i) =>
      i % 3 === 0 ? `Group ${i / 3 + 1} task` : `Instruction line number ${i}.`,
    );
    const tightHeight = estimateRowHeight(lines[0]!, CPL, 1, "activity");
    const chunks = chunkLinesByHeight(lines, CPL, tightHeight, "activity");
    expect(chunks.flat()).toEqual(lines);
  });
});

describe("PPT renderer student-facing cleanup", () => {
  it("moves teacher-only lines out of visible slide XML and does not render CONTINUED labels", async () => {
    const slides = buildStructuredLessonSlides({
      subject: "Math",
      grade: "Grade 8",
      topic: "Linear Equations",
      teacherName: "Teacher",
      learningObjectivesText: "Solve linear equations using inverse operations.",
      language: "en",
    });
    slides[1] = {
      ...slides[1]!,
      body:
        "TIME: 8 minutes\nTeacher Instructions: Ask students to predict the solution.\nSelected AFL for this part of lesson\nBalance puzzle: compare equal token trays.",
    };

    const buffer = await buildPptxFromTemplateEngine({
      templateId: "modern",
      slides,
      subject: "Math",
      grade: "Grade 8",
      topic: "Linear Equations",
      language: "en",
    });
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .map((name) => zip.file(name)!.async("string")),
      )
    ).join("\n");

    expect(slideXml).toMatch(/BALANCE PUZZLE/i);
    expect(slideXml).not.toMatch(/Teacher Instructions|Selected AFL|TIME: 8 minutes|CONTINUED/i);
  });

  it("uses a purposeful closing slide instead of a generic thank-you slide", () => {
    const slides = buildStructuredLessonSlides({
      subject: "Science",
      grade: "Grade 8",
      topic: "Irrigation Methods",
      teacherName: "Teacher",
      learningObjectivesText: "Compare irrigation methods.",
      language: "en",
    });

    const close = slides[12]!;
    expect(close.slideTitle).toBe("Lesson Takeaway");
    expect(close.body).toContain("Irrigation Methods");
    expect(close.body).toContain("What would you try next");
    expect(close.body).not.toMatch(/^Thank you/i);
  });
});
