import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateSlide2,
  generateSlide3,
  generateSlide5,
  generateSlide6,
  generateSlide7,
  generateSlide8,
  generateSlide9,
  generateSlide10,
  generateSlide11,
  generateSlide12,
  type SlideGenParams,
} from "./ppt-individual-slide-generator";

// A topic unlike any example/default topic that appears anywhere else in the
// codebase, so a pass here can't be explained by a hardcoded fallback that
// happens to match a common test fixture.
const FRICTION_PARAMS: SlideGenParams = {
  topic: "Factors Affecting Friction and Its Everyday Applications",
  subject: "Science",
  grade: "Grade 9",
  chapter: "Friction",
  curriculumType: "CBSE",
  learningObjectives: "Explain how friction affects motion in everyday situations.",
  uaeFrameworkEnabled: false,
  dateStr: "1 September 2026",
};

const DEFAULT_TOPIC_DRIFT_STRINGS = [
  "photosynthesis",
  "cellular respiration",
  "states of matter",
  "particle theory",
  "chemical change",
  "cell structure",
  "kinetic energy",
];

type CapturedCall = { system: string; user: string };

function mockDeepSeekFetch(): { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as {
        messages: { role: string; content: string }[];
      };
      const system = body.messages.find((m) => m.role === "system")?.content ?? "";
      const user = body.messages.find((m) => m.role === "user")?.content ?? "";
      calls.push({ system, user });
      return new Response(
        JSON.stringify({
          choices: [
            { message: { content: "Generated content specific to the requested topic." } },
          ],
        }),
        { status: 200 },
      );
    }),
  );
  return { calls };
}

const SLIDE_GENERATORS = {
  slide2_starter: generateSlide2,
  slide3_chapterTopicSdg: generateSlide3,
  slide5_outcomes: generateSlide5,
  slide6_mainPhase: generateSlide6,
  slide7_differentiated: generateSlide7,
  slide8_realLife: generateSlide8,
  slide9_plenary: generateSlide9,
  slide10_extendedTask: generateSlide10,
  slide11_exitTicket: generateSlide11,
  slide12_successCriteria: generateSlide12,
};

describe("PPT isolated slide generators — topic propagation (regression for cross-section drift)", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  for (const [name, generator] of Object.entries(SLIDE_GENERATORS)) {
    it(`${name} — every LLM call is grounded in the canonical topic, subject, and grade`, async () => {
      const { calls } = mockDeepSeekFetch();
      await generator(FRICTION_PARAMS);

      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const combined = `${call.system}\n${call.user}`;
        expect(combined).toContain(FRICTION_PARAMS.topic);
        expect(combined).toContain(FRICTION_PARAMS.subject);
        expect(combined).toContain(FRICTION_PARAMS.grade);

        // The system prompt must lock the topic as authoritative context —
        // not leave grounding to the user message alone.
        expect(call.system).toContain(FRICTION_PARAMS.topic);

        // None of the known default/example science topics should appear —
        // this call was never given a reason to mention any of them.
        const lower = combined.toLowerCase();
        for (const driftTopic of DEFAULT_TOPIC_DRIFT_STRINGS) {
          expect(lower, `${name} prompt should not mention "${driftTopic}"`).not.toContain(
            driftTopic,
          );
        }
      }
    });
  }

  it("CASE C — curriculum selected (UAE) + a subject with unrelated example domains still keeps the user's topic authoritative", async () => {
    const { calls } = mockDeepSeekFetch();
    const uaeParams: SlideGenParams = { ...FRICTION_PARAMS, uaeFrameworkEnabled: true };
    await generateSlide8(uaeParams);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.user).toContain(FRICTION_PARAMS.topic);
      // Slide 8's UAE example bank must stay explicitly scoped to what
      // "genuinely connects" to the requested topic, not dictate it.
      expect(call.user.toLowerCase()).toContain("genuinely connects");
    }
  });

  it("omitted topic falls back to chapter rather than interpolating a blank focus", async () => {
    const { calls } = mockDeepSeekFetch();
    const blankTopicParams: SlideGenParams = {
      ...FRICTION_PARAMS,
      topic: "", // caller is expected to have already applied resolveGenerationTopic,
      // but the slide generator's own system-prompt fallback must still hold
      // if it ever receives an empty topic directly.
    };
    await generateSlide9(blankTopicParams);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.system).toContain(FRICTION_PARAMS.chapter);
      expect(call.system).not.toMatch(/Topic:\s*$/m);
    }
  });

  describe("Slide 6 (Main Phase) - the teacher's selected activity drives the structure", () => {
    it("uses I Do / We Do / You Do only when the teacher actually selected gradual release", async () => {
      const { calls } = mockDeepSeekFetch();
      await generateSlide6({
        ...FRICTION_PARAMS,
        mainActivity: {
          id: "mn-i-do-we-do-you-do",
          label: "I Do We Do You Do",
          howTo: "I Do: teacher demonstrates. We Do: together. You Do: independently.",
          isGradualRelease: true,
          systemRecommended: false,
        },
      });
      expect(calls[0]!.user).toMatch(/I Do[\s\S]*We Do[\s\S]*You Do/);
    });

    it("uses the selected alternative activity and does NOT fall back to gradual release", async () => {
      const { calls } = mockDeepSeekFetch();
      await generateSlide6({
        ...FRICTION_PARAMS,
        mainAflBlock: "AFL Main Phase Tool: Jigsaw Activity details here",
        mainActivity: {
          id: "mn-jigsaw",
          label: "Jigsaw Activity",
          howTo: "Group A learns part A, Group B learns part B; students teach each other.",
          isGradualRelease: false,
          systemRecommended: false,
        },
      });
      const user = calls[0]!.user;
      expect(user).toContain("Jigsaw Activity");
      expect(user).toContain("TEACHER-SELECTED");
      // The regression this whole change exists to fix: the deck used to render gradual-release
      // headings no matter what the teacher picked. These are the exact heading strings the old
      // prompt emitted (em dash, as in the source), so a vacuous match can't hide a regression.
      expect(user).not.toContain("I Do — Teacher Explanation");
      expect(user).not.toContain("We Do — Guided Practice");
      expect(user).not.toContain("You Do — Independent Practice");
    });

    it("labels an unselected main phase as system-recommended rather than teacher-selected", async () => {
      const { calls } = mockDeepSeekFetch();
      await generateSlide6({
        ...FRICTION_PARAMS,
        mainActivity: {
          id: "mn-concept-mapping",
          label: "Concept Mapping",
          howTo: "Create diagrams linking concepts.",
          isGradualRelease: false,
          systemRecommended: true,
        },
      });
      const user = calls[0]!.user;
      expect(user).toContain("Concept Mapping");
      expect(user).toContain("system-recommended");
      expect(user).not.toContain("TEACHER-SELECTED");
    });

    it("asks for a coherent structure instead of imposing one when no activity resolves", async () => {
      const { calls } = mockDeepSeekFetch();
      await generateSlide6({ ...FRICTION_PARAMS, mainActivity: undefined });
      const user = calls[0]!.user;
      expect(user).not.toContain("I Do — Teacher Explanation");
      expect(user).toContain("Choose one coherent, age-appropriate activity structure");
    });

    it("embeds exactly the supplied AFL block text — no separate hardcoded activity substituted", async () => {
      const { calls } = mockDeepSeekFetch();
      await generateSlide6({
        ...FRICTION_PARAMS,
        mainAflBlock: "AFL Main Phase Tool: Socratic Questioning — teacher poses open questions.",
      });
      expect(calls[0]!.user).toContain("Socratic Questioning");
    });

    it("omits the AFL Main Phase Tool line entirely when no block is supplied, rather than inventing one", async () => {
      const { calls } = mockDeepSeekFetch();
      await generateSlide6({ ...FRICTION_PARAMS, mainAflBlock: undefined });
      expect(calls[0]!.user).not.toContain("AFL Main Phase Tool:");
    });
  });
});
