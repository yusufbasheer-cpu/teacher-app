import { describe, expect, it } from "vitest";
import { chunkLinesByHeight } from "./ppt-template-engine";
import { estimateRowHeight, isGroupHeaderLine } from "./ppt-render-primitives";

// Wide enough that none of the fixture lines below wrap onto a second line, so each
// line's height is driven purely by whether it's a group-header row, not word-wrap.
const CPL = 200;

const HEADER_1 = "Higher Achievers task";
const INSTR_1 = "First instruction sentence.";
const INSTR_2 = "Second instruction sentence.";
const HEADER_2 = "Middle Achievers task";
const INSTR_3 = "Third instruction sentence.";

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
