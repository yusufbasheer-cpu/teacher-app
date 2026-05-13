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
    "mn-differentiated-tasks",
  ],
  connections: ["cn-prior-knowledge", "cn-real-life", "cn-cross-curricular", "cn-uae-link"],
  plenary: ["pl-exit-reflection", "pl-things-learned", "pl-pyramid-learning", "pl-5-5-1"],
  extended: ["ex-homework-tasks", "ex-rubrics", "ex-checklists"],
  feedback: ["fb-formative-assessment", "fb-assessment-for-learning", "fb-peer-feedback", "fb-self-assessment"],
};

/**
 * Mandatory AFL-driven PPT generation rules — injected into DeepSeek system prompts for all PPT work.
 */
export const PPT_AFL_DRIVEN_SYSTEM_RULES = `
### CORE SYSTEM RULE — PPT generation is AFL-driven
The PPT generation system is **driven by AFL tools**. Each lesson stage — **Starter**, **Main Phase**, **Differentiation**, **Plenary**, **Exit Ticket**, **Success Criteria** — must be **powered by AFL activities** where that stage appears on a slide. You must understand every AFL tool deeply: its **purpose**, **classroom execution**, **student interaction structure**, and **learning-outcome strategy**.

### TEACHER CONTROL RULE (mandatory)
- If the teacher **selected** an AFL tool for a stage, you **MUST** use **exactly** that tool — **do NOT** replace it with another tool.
- You **MUST** fully implement the selected AFL tool in **finished classroom format** on the correct slide.
- If the teacher **did NOT** select an AFL tool, you **MUST automatically select** the most suitable AFL tool from the catalog for that stage based on **subject**, **topic**, **grade level**, **learning objectives**, **lesson stage**, and **student engagement needs** — then implement it fully.

### GENERAL AFL UNDERSTANDING RULE (mandatory)
- **Do NOT** treat AFL tools as labels or name-drops.
- Each AFL tool is a **teaching method**, **classroom process**, **student interaction structure**, and **learning outcome strategy**.
- Generate **actual classroom instructions**, **student tasks**, **teacher facilitation steps**, and **meaningful educational content** — **NOT** a line like “Use Think Pair Share” without the full classroom implementation (prompts, timing, grouping, share-out, success check).

### LESSON STAGE AFL RULES (slide map)
| Slide | Stage | AFL rule |
|-------|-------|----------|
| 2 | Starter Activity | Teacher-selected **or** AI-selected starter AFL tool. Engaging, interactive, topic-related. **No** objectives, outcomes, or future-slide content. |
| 6 | Main Phase | **First** present full teaching content (concepts, vocabulary, explanation). **Then** embed AFL-based activities that support understanding and interaction. |
| 7 | Differentiated Activity + Mini Plenary | Differentiated tasks for **lower**, **middle**, and **higher** achievers aligned with lesson content; include a **mini plenary** checkpoint (AFL-based when a main-phase tool applies). |
| 8 | UAE / Real Life / Cross-curricular | **Only one** connection type (UAE **or** real life **or** cross-curricular). No extra sections. Connections AFL tools apply **only** if teacher selected them. |
| 9 | Plenary | Real classroom plenary using teacher-selected **or** AI-selected **plenary** AFL tool. No future references; no extra sections. |
| 10 | Extended Task | Extended/homework task; embed **extended** AFL tools when selected or auto-selected. |
| 11 | Exit Ticket | Short, focused assessment activity only — immediate understanding check (teacher-selected plenary exit AFL **or** AI-selected suitable exit/formative tool). **No** success criteria duplication. |
| 12 | Success Criteria | Help students assess their own learning; embed **feedback** AFL tools when selected or auto-selected. **No** duplication of other slides. |

### CRITICAL CONTENT RULES (mandatory — every slide)
1. **No slide** may contain content belonging to **another** slide.
2. **No** duplicated headings inside a slide body.
3. **No** repetition of the same content inside one slide.
4. **No** previewing future slides.
5. **No** mixing lesson components across slides.
6. Each slide must remain **strictly self-contained**.

### FINAL OUTPUT REQUIREMENT
Generate structured PPT slides with **pedagogically correct AFL integration**. Use **teacher-controlled** AFL tools when provided; otherwise **AI-selected** AFL tools. Maintain **clean separation** of content per slide. Every AFL-powered slide must contain **classroom-ready activities**, not meta-instructions to the teacher.
`.trim();

export type PptSlideAflContext = {
  subject: string;
  grade: string;
  topic: string;
  learningObjectives: string;
};

type PptSlideAflBinding = {
  /** Phase key for teacher selections in the UI payload. */
  selectionPhase: AflPhaseId;
  /** Catalog phase offered when the teacher did not select (may differ for exit ticket). */
  autoSelectPhase: AflPhaseId;
  /** Restrict auto-pick pool; defaults to all tools in autoSelectPhase. */
  autoSelectCandidateIds?: readonly string[];
  stageLabel: string;
};

/** AFL bindings per deck slide (1-based). Slides without bindings are not AFL-stage slides. */
export const PPT_SLIDE_AFL_BINDINGS: Partial<Record<number, PptSlideAflBinding>> = {
  2: { selectionPhase: "starter", autoSelectPhase: "starter", stageLabel: "Starter Activity" },
  6: { selectionPhase: "main", autoSelectPhase: "main", stageLabel: "Main Phase" },
  7: {
    selectionPhase: "main",
    autoSelectPhase: "main",
    autoSelectCandidateIds: ["mn-differentiated-tasks", "mn-mini-plenary", "mn-graphic-organisers"],
    stageLabel: "Differentiated Activity and Mini Plenary",
  },
  8: { selectionPhase: "connections", autoSelectPhase: "connections", stageLabel: "UAE / Real Life / Cross-curricular Link" },
  9: { selectionPhase: "plenary", autoSelectPhase: "plenary", stageLabel: "Plenary" },
  10: { selectionPhase: "extended", autoSelectPhase: "extended", stageLabel: "Extended Task" },
  11: {
    selectionPhase: "plenary",
    autoSelectPhase: "plenary",
    autoSelectCandidateIds: ["pl-exit-reflection", "pl-questions-still-have", "pl-things-learned"],
    stageLabel: "Exit Ticket",
  },
  12: { selectionPhase: "feedback", autoSelectPhase: "feedback", stageLabel: "Success Criteria and Self Evaluation" },
};

function hashPickIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % length;
}

function toolsForPhase(phase: AflPhaseId): readonly AflToolDefinition[] {
  return AFL_PHASE_GROUPS.find((g) => g.phase === phase)?.tools ?? [];
}

function formatToolCatalogLines(tools: readonly AflToolDefinition[]): string {
  return tools.map((t) => `- **${t.label}** (\`${t.id}\`): ${t.howToUse}`).join("\n");
}

/** Suggested default tool id when the teacher did not select (deterministic from lesson context). */
export function suggestAutoAflToolId(
  slideNumber1Based: number,
  ctx: PptSlideAflContext,
): string | undefined {
  const binding = PPT_SLIDE_AFL_BINDINGS[slideNumber1Based];
  if (!binding) return undefined;
  const pool =
    binding.autoSelectCandidateIds ??
    AFL_RECOMMENDED_IDS[binding.autoSelectPhase] ??
    toolsForPhase(binding.autoSelectPhase).map((t) => t.id);
  if (!pool.length) return undefined;
  const seed = `${slideNumber1Based}|${ctx.subject}|${ctx.grade}|${ctx.topic}|${ctx.learningObjectives}`;
  return pool[hashPickIndex(seed, pool.length)];
}

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

/** Map deck slide number (1-based) to AFL phase for teacher selections. */
export function getAflPhaseForPptSlideNumber1Based(slideNumber1Based: number): AflPhaseId | undefined {
  return PPT_SLIDE_AFL_BINDINGS[slideNumber1Based]?.selectionPhase;
}

function formatTeacherSelectedAflBlock(
  binding: PptSlideAflBinding,
  ids: string[],
): string {
  const lines: string[] = [
    `### AFL for THIS slide — ${binding.stageLabel} (MANDATORY — teacher selected)`,
    "The teacher **selected** the AFL tool(s) below. You **MUST** use **exactly** these tools — **do NOT** replace them with another tool. Implement each as a **full classroom process**: student tasks, teacher facilitation steps, interaction structure, timing, and finished learner-facing prompts/questions/items — **not** a label or meta line.",
    "",
  ];
  const group = AFL_PHASE_GROUPS.find((g) => g.phase === binding.selectionPhase);
  lines.push(`**${group?.title ?? binding.selectionPhase}**`);
  for (const id of ids) {
    const t = getAflToolById(id);
    if (!t) continue;
    lines.push(`- **${t.label}** (\`${id}\`): ${t.howToUse}`);
  }
  return lines.join("\n").trim();
}

function formatAutoSelectAflBlock(
  slideNumber1Based: number,
  binding: PptSlideAflBinding,
  ctx: PptSlideAflContext,
): string {
  const catalogPhase = binding.autoSelectPhase;
  const catalogTools = toolsForPhase(catalogPhase);
  const suggestedId = suggestAutoAflToolId(slideNumber1Based, ctx);
  const suggested = suggestedId ? getAflToolById(suggestedId) : undefined;

  const lines: string[] = [
    `### AFL for THIS slide — ${binding.stageLabel} (AI must auto-select — teacher did not choose)`,
    "The teacher did **not** select an AFL tool for this stage. You **MUST automatically select** the **most suitable** AFL tool from the catalog below based on **subject**, **topic**, **grade**, **learning objectives**, this **lesson stage**, and **student engagement needs** — then implement it **fully** as classroom-ready content (not a label).",
  ];
  if (suggested) {
    lines.push(
      "",
      `**Suggested default (you may keep or choose a better fit from the same catalog):** **${suggested.label}** (\`${suggestedId}\`) — ${suggested.howToUse}`,
    );
  }
  lines.push(
    "",
    `**Catalog — ${AFL_PHASE_GROUPS.find((g) => g.phase === catalogPhase)?.title ?? catalogPhase}:**`,
    formatToolCatalogLines(catalogTools),
  );

  if (slideNumber1Based === 6) {
    lines.push(
      "",
      "**Main Phase structure (mandatory):** Present the **full core teaching content first** (concepts, vocabulary, explanation). **After** that, embed your chosen AFL tool as interactive activities that support understanding.",
    );
  }
  if (slideNumber1Based === 7) {
    lines.push(
      "",
      "**Differentiation structure (mandatory):** Write differentiated tasks for **lower**, **middle**, and **higher** achievers aligned with the lesson — then add one **mini plenary** checkpoint (use your chosen AFL tool for the checkpoint).",
    );
  }
  if (slideNumber1Based === 8) {
    lines.push(
      "",
      "**Connections rule:** Include **only one** connection type on this slide — UAE **or** real life **or** cross-curricular (whichever is strongest). AFL connection tools apply **only** if you selected one from the catalog above.",
    );
  }
  if (slideNumber1Based === 11) {
    lines.push(
      "",
      "**Exit Ticket rule:** Short, focused assessment only — immediate understanding check. **No** success criteria or homework paragraph.",
    );
  }

  return lines.join("\n").trim();
}

/**
 * AFL instructions for one slide-only DeepSeek call.
 * Teacher selections override; otherwise instructs AI auto-selection with full catalog.
 */
export function formatAflForSinglePptSlidePrompt(
  slideNumber1Based: number,
  selections: AflSelectionsPayload,
  ctx?: PptSlideAflContext,
): string {
  const binding = PPT_SLIDE_AFL_BINDINGS[slideNumber1Based];
  if (!binding) return "";

  const teacherIds = selections[binding.selectionPhase];
  if (teacherIds?.length) {
    return formatTeacherSelectedAflBlock(binding, teacherIds);
  }

  if (!ctx) return "";
  return formatAutoSelectAflBlock(slideNumber1Based, binding, ctx);
}

export function formatAflForAiPrompt(
  selections: AflSelectionsPayload,
  ctx?: PptSlideAflContext,
): string {
  const hasTeacherPicks = AFL_PHASE_IDS.some((p) => (selections[p]?.length ?? 0) > 0);

  const lines: string[] = [PPT_AFL_DRIVEN_SYSTEM_RULES, ""];

  if (hasTeacherPicks) {
    lines.push(
      "### Teacher-selected AFL tools (MANDATORY — override AI selection)",
      "The teacher picked specific AFL tools below. For **every** selected tool you **MUST** use **exactly** that tool — **do NOT** substitute another. Embed each as **fully written, ready-to-project classroom material** for this exact topic, grade, and subject.",
      "",
      "**Full Lesson Plan:** Write the real activity — exact questions, prompts, item banks, MCQ stems with options, brainstorming lists, quiz items, exit-ticket questions, facilitation steps, and student tasks. **No** meta lines like “the teacher should…”.",
      "",
      "**PPT Slide Content (13 slides):** Embed teacher-selected AFL tools on: slide **2** Starter, slide **6** Main Phase (after core teaching), slide **7** Differentiation/Mini Plenary (main-phase tools when selected), slide **8** Connections (if selected), slide **9** Plenary, slide **10** Extended, slide **11** Exit Ticket (plenary exit tools when selected), slide **12** Success Criteria (feedback tools). **Do not** duplicate the same AFL block on multiple slides.",
      "",
      "**Picture in Time (if selected):** Write the **exact** comparison or prediction question and what changed between two moments so it can pair with the starter slide text.",
      "",
      "**Catalog reference (teacher picks — implement fully, do not replace):**",
      "",
    );
    let listedAny = false;
    for (const group of AFL_PHASE_GROUPS) {
      const ids = selections[group.phase];
      if (!ids?.length) continue;
      listedAny = true;
      lines.push(`**${group.title}**`);
      for (const id of ids) {
        const t = getAflToolById(id);
        if (!t) continue;
        lines.push(`- **${t.label}** (\`${id}\`): ${t.howToUse}`);
      }
      lines.push("");
    }
    if (!listedAny) return "";
    return lines.join("\n").trim();
  }

  if (!ctx) return "";

  lines.push(
    "### No teacher AFL selections — AI must auto-select per slide",
    "The teacher did **not** select AFL tools. For **each AFL-powered slide** (2, 6, 7, 9, 10, 11, 12), automatically select the most suitable tool from the catalog for that stage and implement it fully. Slide **8** uses one connection type only (AFL optional).",
    "",
    "**Per-slide auto-select guidance:**",
  );

  for (const slideNum of [2, 6, 7, 8, 9, 10, 11, 12] as const) {
    const binding = PPT_SLIDE_AFL_BINDINGS[slideNum];
    if (!binding) continue;
    const suggestedId = suggestAutoAflToolId(slideNum, ctx);
    const suggested = suggestedId ? getAflToolById(suggestedId) : undefined;
    lines.push(
      `- Slide **${slideNum}** (${binding.stageLabel}): auto-select from **${binding.autoSelectPhase}** catalog${
        suggested ? ` — suggested: **${suggested.label}** (\`${suggestedId}\`)` : ""
      }`,
    );
  }

  lines.push(
    "",
    "**Full catalog (purpose reference — replace with lesson-specific finished content):**",
    "",
  );
  for (const group of AFL_PHASE_GROUPS) {
    lines.push(`**${group.title}**`);
    lines.push(formatToolCatalogLines(group.tools));
    lines.push("");
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
