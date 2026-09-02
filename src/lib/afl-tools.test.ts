import { describe, expect, it } from "vitest";
import {
  AFL_PHASE_GROUPS,
  AFL_PHASE_IDS,
  AFL_RECOMMENDED_IDS,
  buildAutoAflSelections,
  formatAflForAiPrompt,
  formatAflForSinglePptSlidePrompt,
  formatDocxAflAppendix,
  getAflToolById,
  sanitizeAflSelections,
  suggestAutoAflToolId,
  suggestRecommendedToolId,
  type AflPhaseId,
  type AflSelectionsPayload,
  type PptSlideAflContext,
} from "./afl-tools";

// A context unlike any example/default topic elsewhere in the codebase — chosen for the
// same reason the topic-drift regression tests use "Friction": a pass here can't be
// explained by coincidentally matching some hardcoded fixture.
const CTX: PptSlideAflContext = {
  subject: "History",
  grade: "Grade 8",
  topic: "Causes of the Industrial Revolution",
  learningObjectives: "Identify three causes of industrialisation in 18th-century Britain.",
};

describe("suggestRecommendedToolId / suggestAutoAflToolId — deterministic, never AI-dependent", () => {
  it("resolves to one of that phase's recommended candidates", () => {
    for (const phase of AFL_PHASE_IDS) {
      const id = suggestRecommendedToolId(phase, CTX);
      expect(id, phase).toBeDefined();
      expect(AFL_RECOMMENDED_IDS[phase]).toContain(id);
    }
  });

  it("is stable for the same context (same inputs -> same output, every time)", () => {
    for (const phase of AFL_PHASE_IDS) {
      const a = suggestRecommendedToolId(phase, CTX);
      const b = suggestRecommendedToolId(phase, CTX);
      const c = suggestRecommendedToolId(phase, { ...CTX });
      expect(a).toBe(b);
      expect(a).toBe(c);
    }
  });

  it("changes with lesson context (not a single hardcoded pick)", () => {
    const otherCtx: PptSlideAflContext = {
      subject: "Math",
      grade: "Grade 3",
      topic: "Adding fractions with unlike denominators",
      learningObjectives: "Find a common denominator and add two fractions.",
    };
    // At least one phase's recommendation should differ across two very different lessons —
    // if every phase always resolved to the same tool regardless of context, that would be a
    // hidden hardcoded default wearing a "recommendation" costume.
    const differs = AFL_PHASE_IDS.some(
      (phase) => suggestRecommendedToolId(phase, CTX) !== suggestRecommendedToolId(phase, otherCtx),
    );
    expect(differs).toBe(true);
  });

  it("suggestAutoAflToolId(slideNumber, ctx) agrees exactly with suggestRecommendedToolId(phase, ctx)", () => {
    // This equivalence is what guarantees the PPT auto-select path and the frontend's
    // phase-based recommendation display can never diverge — same seed, same function.
    const slideToPhase: [number, AflPhaseId][] = [
      [2, "starter"],
      [6, "main"],
      [7, "differentiation"],
      [9, "plenary"],
      [11, "exitTicket"],
      [12, "successCriteria"],
    ];
    for (const [slide, phase] of slideToPhase) {
      expect(suggestAutoAflToolId(slide, CTX)).toBe(suggestRecommendedToolId(phase, CTX));
    }
  });
});

describe("CASE A/B — explicit teacher selection is authoritative in PPT slide prompts", () => {
  it("uses exactly the teacher-selected tool, not a recommendation, and marks it as teacher-selected", () => {
    const selections: AflSelectionsPayload = { starter: ["st-odd-one-out"] };
    const prompt = formatAflForSinglePptSlidePrompt(2, selections, CTX);
    expect(prompt).toContain("Odd One Out");
    expect(prompt.toLowerCase()).toContain("teacher selected");
    expect(prompt.toLowerCase()).not.toContain("system-recommended");
  });

  it("a different explicit selection changes the resolved tool", () => {
    const a = formatAflForSinglePptSlidePrompt(2, { starter: ["st-kwl-chart"] }, CTX);
    const b = formatAflForSinglePptSlidePrompt(2, { starter: ["st-brain-dump"] }, CTX);
    expect(a).toContain("KWL Chart");
    expect(a).not.toContain("Brain Dump");
    expect(b).toContain("Brain Dump");
    expect(b).not.toContain("KWL Chart");
  });

  it("does not add unrelated tools from the same phase's catalog", () => {
    const prompt = formatAflForSinglePptSlidePrompt(2, { starter: ["st-kwl-chart"] }, CTX);
    // Spot-check a handful of other starter tools that were NOT selected.
    expect(prompt).not.toContain("Odd One Out");
    expect(prompt).not.toContain("Four Corners");
    expect(prompt).not.toContain("Silent Debate");
  });
});

describe("CASE C/D — no selection (or omitted field) resolves a recommendation, never a fake selection", () => {
  it("an empty selections object produces the deterministic recommendation, clearly labeled as not-selected", () => {
    const recommendedId = suggestRecommendedToolId("starter", CTX)!;
    const recommendedTool = getAflToolById(recommendedId)!;
    const prompt = formatAflForSinglePptSlidePrompt(2, {}, CTX);
    expect(prompt).toContain(recommendedTool.label);
    expect(prompt.toLowerCase()).toContain("system-recommended");
    expect(prompt.toLowerCase()).toContain("a teacher choice"); // "...it is **not** a teacher choice."
  });

  it("an omitted phase key behaves identically to an explicitly empty array for that phase", () => {
    const omitted = formatAflForSinglePptSlidePrompt(6, {}, CTX);
    const explicitEmpty = formatAflForSinglePptSlidePrompt(6, { main: [] }, CTX);
    expect(omitted).toBe(explicitEmpty);
  });

  it("never claims a system-recommended tool was chosen by the teacher", () => {
    for (const [slide] of [[2], [6], [7], [9], [11], [12]] as const) {
      const prompt = formatAflForSinglePptSlidePrompt(slide, {}, CTX);
      // The only place "teacher" may appear is inside the explicit negation.
      const idx = prompt.toLowerCase().indexOf("teacher");
      if (idx === -1) continue;
      const nearby = prompt.toLowerCase().slice(Math.max(0, idx - 40), idx + 60);
      expect(nearby, `slide ${slide}: "${nearby}"`).toContain("not");
    }
  });
});

describe("CASE 6 — multiple sections resolve independently in the same request", () => {
  it("a mix of selected and unselected phases each keep their own correct provenance", () => {
    const mixed: AflSelectionsPayload = {
      starter: ["st-kwl-chart"], // teacher-selected
      // main: intentionally omitted — no selection
      plenary: ["pl-hot-seat"], // teacher-selected
    };
    const prompt = formatAflForAiPrompt(mixed, CTX);

    // Starter: teacher-selected, correctly labeled.
    expect(prompt).toMatch(/Starter Activity AFL Tools — TEACHER-SELECTED[\s\S]*KWL Chart/);
    // Plenary: teacher-selected, correctly labeled.
    expect(prompt).toMatch(/Plenary AFL Tools — TEACHER-SELECTED[\s\S]*Hot Seat/);
    // Main: NOT teacher-selected — must carry a recommendation, not silence, and not be
    // mislabeled as teacher-selected.
    const mainRecommended = getAflToolById(suggestRecommendedToolId("main", CTX)!)!;
    expect(prompt).toMatch(/Main Phase AFL Tools — SYSTEM-RECOMMENDED/);
    expect(prompt).toContain(mainRecommended.label);
    expect(prompt).not.toMatch(/Main Phase AFL Tools — TEACHER-SELECTED/);
  });

  it("a selection in one phase never appears attached to a different phase's block", () => {
    const mixed: AflSelectionsPayload = { starter: ["st-kwl-chart"] };
    const prompt = formatAflForAiPrompt(mixed, CTX);
    const starterBlockStart = prompt.indexOf("Starter Activity AFL Tools");
    const mainBlockStart = prompt.indexOf("Main Phase AFL Tools");
    expect(starterBlockStart).toBeGreaterThan(-1);
    expect(mainBlockStart).toBeGreaterThan(starterBlockStart);
    const starterBlock = prompt.slice(starterBlockStart, mainBlockStart);
    expect(starterBlock).toContain("KWL Chart");
  });
});

describe("Selection cleared returns to recommendation behavior", () => {
  it("clearing a phase's selection (removing the key) drops the teacher-selected block and adds a recommendation", () => {
    const withSelection: AflSelectionsPayload = { starter: ["st-kwl-chart"] };
    const cleared: AflSelectionsPayload = {};
    const before = formatAflForSinglePptSlidePrompt(2, withSelection, CTX);
    const after = formatAflForSinglePptSlidePrompt(2, cleared, CTX);
    expect(before).toContain("KWL Chart");
    // The positive "this IS a teacher pick" marker — distinct from the negative instruction
    // text below, which itself legitimately contains the words "teacher selected" inside a
    // "do NOT narrate that the teacher selected it" sentence.
    expect(before.toLowerCase()).toContain("mandatory — teacher selected");
    expect(after.toLowerCase()).not.toContain("mandatory — teacher selected");
    expect(after.toLowerCase()).toContain("system-recommended");
  });
});

describe("I Do / We Do / You Do — structural pedagogy is separate from AFL selection", () => {
  it("mn-i-do-we-do-you-do is a real, ordinary catalog entry — not a hidden fallback object", () => {
    const tool = getAflToolById("mn-i-do-we-do-you-do");
    expect(tool).toBeDefined();
    expect(tool!.label).toBe("I Do We Do You Do");
    const group = AFL_PHASE_GROUPS.find((g) => g.phase === "main")!;
    expect(group.tools.map((t) => t.id)).toContain("mn-i-do-we-do-you-do");
  });

  it("selecting a different main-phase tool does not fall back to I Do We Do You Do", () => {
    const prompt = formatAflForSinglePptSlidePrompt(6, { main: ["mn-jigsaw"] }, CTX);
    expect(prompt).toContain("Jigsaw Activity");
    expect(prompt).not.toContain("I Do We Do You Do");
  });

  it("when main phase is unselected, the recommendation may legitimately be I Do We Do You Do — but only when the deterministic function actually resolves to it, and it is still labeled system-recommended, not teacher-selected", () => {
    const recommendedId = suggestRecommendedToolId("main", CTX);
    const prompt = formatAflForSinglePptSlidePrompt(6, {}, CTX);
    if (recommendedId === "mn-i-do-we-do-you-do") {
      expect(prompt).toContain("I Do We Do You Do");
    }
    expect(prompt.toLowerCase()).toContain("system-recommended");
    expect(prompt.toLowerCase()).not.toContain("mandatory — teacher selected");
  });
});

describe("buildAutoAflSelections — AFL Activity Sheets fallback matches the same deterministic recommendation", () => {
  it("produces the same per-phase picks as suggestRecommendedToolId for every AFL-bearing slide", () => {
    const auto = buildAutoAflSelections(CTX);
    const phaseForSlide: Record<number, AflPhaseId> = {
      2: "starter",
      6: "main",
      7: "differentiation",
      9: "plenary",
      11: "exitTicket",
      12: "successCriteria",
    };
    for (const phase of Object.values(phaseForSlide)) {
      const expected = suggestRecommendedToolId(phase, CTX);
      expect(auto[phase]).toContain(expected);
    }
  });
});

describe("sanitizeAflSelections — no hidden defaults injected for invalid/missing input", () => {
  it("returns an empty object for missing, null, or malformed input (never a default selection)", () => {
    expect(sanitizeAflSelections(undefined)).toEqual({});
    expect(sanitizeAflSelections(null)).toEqual({});
    expect(sanitizeAflSelections("not an object")).toEqual({});
    expect(sanitizeAflSelections([])).toEqual({});
    expect(sanitizeAflSelections({})).toEqual({});
  });

  it("drops unknown phase keys and tool ids that don't belong to that phase, without substituting anything", () => {
    const out = sanitizeAflSelections({
      starter: ["st-kwl-chart", "mn-jigsaw", "not-a-real-id"],
      notARealPhase: ["st-kwl-chart"],
    });
    expect(out).toEqual({ starter: ["st-kwl-chart"] });
  });
});

describe("Export/download consistency — the DOCX AFL appendix never claims a recommendation was selected", () => {
  it("produces an empty appendix when nothing was explicitly selected (no recommendation leaks in as a fake selection)", () => {
    expect(formatDocxAflAppendix({})).toBe("");
  });

  it("only lists what is actually present in the selections payload passed to it", () => {
    const appendix = formatDocxAflAppendix({ starter: ["st-kwl-chart"] });
    expect(appendix).toContain("KWL Chart");
    expect(appendix).not.toContain("Odd One Out");
  });
});
