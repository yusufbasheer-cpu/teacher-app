/**
 * AFL (Assessment for Learning) tool catalog for the lesson generator and exports.
 * Each tool has a stable `id` (slug), display `label`, and `howToUse` for slides and AI prompts.
 */

export const AFL_PHASE_IDS = [
  "starter",
  "main",
  "connections",
  "plenary",
  "extended",
  "feedback",
] as const;

export type AflPhaseId = (typeof AFL_PHASE_IDS)[number];

/** When selected, starter slide may receive a dedicated FLUX image (Picture in Time). */
export const PICTURE_IN_TIME_AFL_TOOL_ID = "st-picture-in-time" as const;

export type AflToolDefinition = {
  id: string;
  label: string;
  /** Short classroom instruction for this lesson. */
  howToUse: string;
};

export type AflPhaseGroup = {
  phase: AflPhaseId;
  title: string;
  tools: readonly AflToolDefinition[];
};

function tool(id: string, label: string, howToUse: string): AflToolDefinition {
  return { id, label, howToUse };
}

export const AFL_PHASE_GROUPS: readonly AflPhaseGroup[] = [
  {
    phase: "starter",
    title: "Starter and Pre-Assessment Tools",
    tools: [
      tool("st-brainstorming", "Brainstorming", "Pose an open prompt; capture ideas on board; cluster themes before teaching."),
      tool("st-picture-in-time", "Picture in Time", "Show one image; ask what changed or what comes next to activate curiosity."),
      tool("st-what-do-you-know", "What do you know", "Quick round: one fact or question per student about the topic."),
      tool("st-word-or-phrase", "Word or Phrase activity", "Give a key term; pairs produce related words, then share."),
      tool("st-unscramble-words", "Unscramble the Words", "Scramble vocabulary; teams reorder to reveal the lesson focus."),
      tool("st-odd-one-out", "Odd One Out", "Present four items; justify which does not belong and why."),
      tool("st-insta-hashtags", "Insta Hashtags", "Learners invent hashtags for the topic; discuss tone and key ideas."),
      tool("st-navigation-map", "Navigation Map Activity", "Sketch a simple map of concepts; add nodes as prior links."),
      tool("st-kwl-chart", "KWL Chart", "Complete K and W columns; revisit L at plenary."),
      tool("st-hand-signals", "Hand Signals", "Use agreed signals (A/B/C or confidence) for fast whole-class response."),
      tool("st-abcd-cards", "ABCD Cards", "Each learner holds A–D for MCQ checks during starter."),
      tool("st-traffic-signal", "Traffic Signal", "Red/amber/green for confidence or agreement on a starter claim."),
      tool("st-thumbs-up-down", "Thumbs Up Down", "Thumbs for agree/disagree or ready/not on a short prior-knowledge item."),
      tool("st-show-tell-whiteboard", "Show and Tell Whiteboard Technique", "30-second whiteboard show-and-tell of one idea."),
      tool("st-self-assessment", "Self Assessment", "One criterion self-score before instruction begins."),
      tool("st-peer-assessment", "Peer Assessment", "Pair swap starter answers against a simple checklist."),
      tool("st-online-offline-quiz", "Online Offline Quiz", "One low-stakes digital or paper item to baseline understanding."),
      tool("st-whiteboards", "Whiteboards", "Individual boards for quick answers you can scan across the room."),
    ],
  },
  {
    phase: "main",
    title: "Main Phase AFL Tools",
    tools: [
      tool("mn-wait-time", "Wait Time", "After each question, count 3–5 seconds before accepting hands."),
      tool("mn-pre-reading", "Pre-reading Material Discussion", "Short text or diagram; pairs predict main idea before input."),
      tool("mn-muddiest-point", "Muddiest Point", "Ask what is still unclear mid-lesson; address top themes."),
      tool("mn-devise-questions", "Devise Questions Strategy", "Groups write questions they would ask an expert on the topic."),
      tool("mn-questioning-techniques", "Questioning Techniques", "Mix cold call, bounce, and probe with why/how follow-ups."),
      tool("mn-open-questions", "Open Questions", "Use how/why prompts that require explanation, not single-word answers."),
      tool("mn-closed-questions", "Closed Questions", "Use for hinge checks of facts or procedures after explanation."),
      tool("mn-blooms-questioning", "Blooms Taxonomy Questioning", "Move from remember/understand to apply/analyse within the phase."),
      tool("mn-placemat", "Placemat Method", "Corners contribute; centre synthesises one group output."),
      tool("mn-frayer-model", "Frayer Model", "Define term, facts, examples, non-examples on a four-quadrant template."),
      tool("mn-four-corners", "Four Corners Activity", "Label corners with stances; move and justify choices."),
      tool("mn-group-roles", "Group Roles Strategy", "Assign speaker, scribe, timekeeper for structured tasks."),
      tool("mn-graphic-organisers", "Graphic Organisers", "Use tables, timelines, or cause–effect frames to organise thinking."),
      tool("mn-flow-charts", "Flow Charts", "Sequence steps of a process or algorithm visibly."),
      tool("mn-venn-diagram", "Venn Diagram", "Compare two concepts; justify overlaps and differences."),
      tool("mn-mid-unit-assessment", "Mid-Unit Assessment", "Short formative task aligned to today’s sub-goals."),
      tool("mn-mini-plenary", "Mini Plenary", "Two-minute check: hinge question or show-me response."),
      tool("mn-find-the-fib", "Find the Fib", "Three statements—one false; discuss evidence for each."),
      tool("mn-differentiated-tasks", "Differentiated Tasks", "Offer tiered prompts or scaffolds while same learning goal."),
    ],
  },
  {
    phase: "connections",
    title: "Making Connections Tools",
    tools: [
      tool("cn-prior-knowledge", "Prior Knowledge Connection", "Explicitly link today’s idea to last lesson or schema."),
      tool("cn-real-life", "Real Life Application", "One authentic context where the idea matters outside school."),
      tool("cn-cross-curricular", "Cross Curricular Link", "Name another subject where the same skill or idea appears."),
      tool("cn-uae-link", "UAE Link", "Tie example or context to UAE context where appropriate."),
      tool("cn-sdg", "SDG Connection", "Relate learning to a relevant UN Sustainable Development Goal."),
      tool("cn-research-tasks", "Research Tasks", "Micro-research prompt with a trusted source or keyword list."),
      tool("cn-spinning-wheel", "Spinning Wheel", "Random prompt or group role from a simple spinner for variety."),
      tool("cn-popsicle-sticks", "Popsicle Sticks", "Random sticks for equitable participation during discussion."),
    ],
  },
  {
    phase: "plenary",
    title: "Plenary Tools",
    tools: [
      tool("pl-different-shoes", "Different Shoes Reflection", "How would another stakeholder view today’s learning?"),
      tool("pl-if-reflection", "If Reflection Activity", "If you could change one thing about your work today…"),
      tool("pl-5-5-1", "5-5-1 Strategy", "Five ideas alone, five in pair, one shared with class."),
      tool("pl-5-5-1-deluxe", "5-5-1 Deluxe", "Extend with whole-class refinement of the best pair idea."),
      tool("pl-pyramid-learning", "Pyramid of Learning", "Build from words to sentences to paragraph summary of learning."),
      tool("pl-exit-reflection", "Exit Reflection Questions", "Two printed or oral prompts tied to objectives."),
      tool("pl-questions-still-have", "Questions you still have", "Sticky note or board column for unresolved questions."),
      tool("pl-things-reminded", "Things reminded of", "Connect today’s learning to something familiar or personal."),
      tool("pl-things-learned", "Things learned today", "Each learner states one new thing in a closing round."),
    ],
  },
  {
    phase: "extended",
    title: "Extended Task AFL Tools",
    tools: [
      tool("ex-homework-tasks", "Homework Tasks", "Single clear task with success criteria and estimated time."),
      tool("ex-research-work", "Research Work", "Guided question plus two suggested search terms or sources."),
      tool("ex-checklists", "Checklists", "Student self-check before submission against criteria."),
      tool("ex-rubrics", "Rubrics", "Share level descriptors; optional self-mark against one criterion."),
      tool("ex-best-piece", "Best Piece Reflection", "Identify strongest part of work and one improvement."),
      tool("ex-prep-next", "Preparation for Next Lesson", "One concrete preview task or question."),
      tool("ex-placard", "Placard", "One summary sentence on card held up for gallery view."),
      tool("ex-flipped-class", "Flipped Class", "Short video or reading with a note-taking frame before next lesson."),
    ],
  },
  {
    phase: "feedback",
    title: "Feedback and Assessment Strategies",
    tools: [
      tool("fb-effective-feedback", "Effective Feedback", "Specific, actionable comments tied to criteria—not grades alone."),
      tool("fb-peer-feedback", "Peer Feedback", "Two stars and a wish or structured rubric swap."),
      tool("fb-self-assessment", "Self Assessment", "Traffic lights or rubric row against learning objective."),
      tool("fb-teacher-feedback", "Teacher Feedback", "Whole-class micro-feedback on a common misconception."),
      tool("fb-formative-assessment", "Formative Assessment", "Use results to adjust next explanation or grouping."),
      tool("fb-assessment-as-learning", "Assessment as Learning", "Students track their own progress toward goals."),
      tool("fb-assessment-for-learning", "Assessment for Learning", "Evidence used only to improve teaching and learning now."),
      tool("fb-diagnostic-assessment", "Diagnostic Assessment", "Identify gaps early; do not count toward summative grade."),
    ],
  },
] as const;

const ALL_BY_ID: Map<string, AflToolDefinition> = new Map();
for (const g of AFL_PHASE_GROUPS) {
  for (const tool of g.tools) {
    ALL_BY_ID.set(tool.id, tool);
  }
}

export function getAflToolById(id: string): AflToolDefinition | undefined {
  return ALL_BY_ID.get(id);
}

export function isValidAflPhaseId(v: string): v is AflPhaseId {
  return (AFL_PHASE_IDS as readonly string[]).includes(v);
}

/** Recommended “one click” picks per phase (tool ids). */
export const AFL_RECOMMENDED_IDS: Record<AflPhaseId, readonly string[]> = {
  starter: ["st-thumbs-up-down", "st-kwl-chart", "st-whiteboards", "st-brainstorming", "st-self-assessment"],
  main: [
    "mn-wait-time",
    "mn-open-questions",
    "mn-mini-plenary",
    "mn-graphic-organisers",
    "mn-placemat",
  ],
  connections: ["cn-prior-knowledge", "cn-real-life", "cn-cross-curricular"],
  plenary: ["pl-exit-reflection", "pl-things-learned", "pl-pyramid-learning"],
  extended: ["ex-homework-tasks", "ex-rubrics", "ex-checklists"],
  feedback: ["fb-formative-assessment", "fb-assessment-for-learning", "fb-peer-feedback", "fb-effective-feedback"],
};

export type AflSelectionsPayload = Partial<Record<AflPhaseId, string[]>>;

/** Keep only known phase keys and tool ids that belong to that phase. */
export function sanitizeAflSelections(raw: unknown): AflSelectionsPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AflSelectionsPayload = {};
  for (const phase of AFL_PHASE_IDS) {
    const arr = (raw as Record<string, unknown>)[phase];
    if (!Array.isArray(arr)) continue;
    const allowed = new Set(
      AFL_PHASE_GROUPS.find((g) => g.phase === phase)?.tools.map((x) => x.id) ?? [],
    );
    const ids = arr
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter((id) => allowed.has(id));
    if (ids.length) out[phase] = [...new Set(ids)];
  }
  return out;
}

export function formatAflForAiPrompt(selections: AflSelectionsPayload): string {
  const lines: string[] = [];
  lines.push(
    "### Teacher-selected AFL tools (mandatory — finished classroom content, not coaching)",
    "The teacher picked specific AFL tools below. You MUST embed each tool as **fully written, ready-to-project material** for this exact topic, grade, and subject.",
    "",
    "**Full Lesson Plan:** For every selected tool, write the real activity: exact questions, prompts, item banks, MCQ stems with options and the correct answer marked, sorting cards text, brainstorming categories filled with 6–10 example items for this topic, quiz items, exit-ticket questions, etc. Do NOT write meta lines like “the teacher should…” or “pose an open question”; write the question itself.",
    "",
    "**PPT Slide Content:** The export is **exactly 13 slides** in a fixed order. **Only** Starter AFL tools are embedded on **slide 2 (Starter)** and **only** Plenary AFL tools on **slide 9 (Plenary)**. Other AFL phases belong in the **Full Lesson Plan** and other resources, not as extra slides or injections elsewhere in the deck. For each selected Starter or Plenary tool, output finished learner-facing prompts on those slides only.",
    "",
    "**Picture in Time (if selected):** Write the **exact** comparison or prediction question and what changed between two moments so it can pair with the starter slide text.",
    "",
    "**Catalog reference (tool intent only — you replace with lesson-specific finished content):**",
    "",
  );
  let listedAny = false;
  for (const group of AFL_PHASE_GROUPS) {
    const ids = selections[group.phase];
    if (!ids?.length) continue;
    listedAny = true;
    lines.push(`**${group.title}**`);
    for (const id of ids) {
      const tool = getAflToolById(id);
      if (!tool) continue;
      lines.push(`- ${tool.label} (${id}): ${tool.howToUse}`);
    }
    lines.push("");
  }
  if (!listedAny) {
    return "";
  }
  return lines.join("\n").trim();
}

/** One short classroom line for slide bullets (name + how-to). */
export function briefHowToUseForSlide(howToUse: string, maxLen = 160): string {
  const t = howToUse.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const end = t.search(/[.!?]\s/);
  const firstSentence =
    end > 6 && end < Math.min(140, t.length) ? t.slice(0, end + 1).trim() : t;
  return firstSentence.length > maxLen ? `${firstSentence.slice(0, maxLen - 1).trim()}…` : firstSentence;
}

export function formatToolsBlockForSlide(phase: AflPhaseId, selectedIds: string[] | undefined): string {
  if (!selectedIds?.length) return "";
  const parts: string[] = ["\n\nSelected AFL for this part of the lesson\n"];
  for (const id of selectedIds) {
    const tool = getAflToolById(id);
    if (!tool) continue;
    const how = briefHowToUseForSlide(tool.howToUse);
    parts.push(`• ${tool.label}: ${how}`);
  }
  return parts.length > 1 ? parts.join("\n") : "";
}

/** Split tool ids across N slides (round-robin). */
export function distributeIds(ids: string[], buckets: number): string[][] {
  if (buckets <= 0) return [];
  const out: string[][] = Array.from({ length: buckets }, () => [] as string[]);
  ids.forEach((id, i) => {
    out[i % buckets]!.push(id);
  });
  return out;
}

export function formatDocxAflAppendix(selections: AflSelectionsPayload): string {
  const lines: string[] = [
    "",
    "────────────────────────────────────────",
    "Selected AFL tools (teacher checklist)",
    "────────────────────────────────────────",
    "",
  ];
  let any = false;
  for (const group of AFL_PHASE_GROUPS) {
    const ids = selections[group.phase];
    if (!ids?.length) continue;
    any = true;
    lines.push(group.title);
    for (const id of ids) {
      const tool = getAflToolById(id);
      if (!tool) continue;
      lines.push(`• ${tool.label}: ${tool.howToUse}`);
    }
    lines.push("");
  }
  return any ? lines.join("\n") : "";
}
