/**
 * AFL (Assessment for Learning) tool catalog — 31 tools across six lesson phases.
 * Each tool includes how it works, classroom use, and purpose for full AI implementation.
 */

export const AFL_PHASE_IDS = [
  "starter",
  "main",
  "differentiation",
  "plenary",
  "exitTicket",
  "successCriteria",
] as const;

export type AflPhaseId = (typeof AFL_PHASE_IDS)[number];

/** When selected, starter slide may receive a dedicated FLUX image (Picture Prompt). */
export const PICTURE_PROMPT_AFL_TOOL_ID = "st-picture-prompt" as const;

/** @deprecated Use PICTURE_PROMPT_AFL_TOOL_ID */
export const PICTURE_IN_TIME_AFL_TOOL_ID = PICTURE_PROMPT_AFL_TOOL_ID;

export type AflToolDefinition = {
  id: string;
  label: string;
  howItWorks: string;
  classroomUse: string;
  purpose: string;
  /** Combined line for UI subtitles and compact prompts */
  howToUse: string;
};

export type AflPhaseGroup = {
  phase: AflPhaseId;
  title: string;
  tools: readonly AflToolDefinition[];
};

function tool(
  id: string,
  label: string,
  howItWorks: string,
  classroomUse: string,
  purpose: string,
): AflToolDefinition {
  const howToUse = `${howItWorks} ${classroomUse} Purpose: ${purpose}`;
  return { id, label, howItWorks, classroomUse, purpose, howToUse };
}

export const AFL_PHASE_GROUPS: readonly AflPhaseGroup[] = [
  {
    phase: "starter",
    title: "Starter Activity AFL Tools",
    tools: [
      tool(
        "st-think-pair-share",
        "Think Pair Share",
        "Teacher asks a focused question.",
        "Students think individually, discuss with a partner (1–2 minutes), then selected pairs share answers with the class. Allow silent individual thinking time first.",
        "Builds confidence, activates prior knowledge, and encourages participation.",
      ),
      tool(
        "st-kwl-chart",
        "KWL Chart",
        "Students organise thinking into K (what I already know), W (what I want to know), and L (what I learned — completed later).",
        "Before the lesson, students fill K and W columns; after the lesson, complete L during plenary or closure.",
        "Activates prior knowledge and builds curiosity.",
      ),
      tool(
        "st-brain-dump",
        "Brain Dump",
        "Students write everything they know about the topic.",
        "2–5 minutes silent writing, then share ideas with peers or the class.",
        "Quick assessment of prior knowledge.",
      ),
      tool(
        "st-odd-one-out",
        "Odd One Out",
        "Students are given 3–4 items; one is different.",
        "Students identify the odd item and explain their reasoning to a partner or the class.",
        "Develops critical thinking and comparison skills.",
      ),
      tool(
        "st-picture-prompt",
        "Picture Prompt Image Analysis",
        "Teacher shows an image related to the lesson.",
        "Students observe carefully, describe what they see, and predict the lesson topic before the reveal.",
        "Builds curiosity and visual thinking.",
      ),
      tool(
        "st-true-false-challenge",
        "True or False Challenge",
        "Teacher gives statements about the topic.",
        "Students decide true or false and justify their answers (thumbs, cards, or mini whiteboards).",
        "Reveals misconceptions and activates prior knowledge.",
      ),
      tool(
        "st-predict-reveal",
        "Predict and Reveal",
        "Teacher gives hints step by step.",
        "Students predict the topic after each hint; final reveal of the lesson topic.",
        "Builds curiosity and engagement.",
      ),
      tool(
        "st-kahoot-quizizz-warm-up",
        "Kahoot Quizizz Warm Up",
        "Digital quiz-based starter.",
        "Students answer MCQs on a device with instant feedback shown on screen.",
        "Engages students and checks prior knowledge.",
      ),
      tool(
        "st-entry-ticket",
        "Entry Ticket",
        "Short question before the lesson starts.",
        "Students answer 1–2 quick questions on paper or digitally; teacher reviews responses before teaching.",
        "Checks readiness for learning.",
      ),
    ],
  },
  {
    phase: "main",
    title: "Main Phase AFL Tools",
    tools: [
      tool(
        "mn-i-do-we-do-you-do",
        "I Do We Do You Do",
        "Gradual release teaching model.",
        "I Do: teacher demonstrates. We Do: teacher and students work together. You Do: students work independently on aligned tasks.",
        "Builds understanding step by step.",
      ),
      tool(
        "mn-jigsaw",
        "Jigsaw Activity",
        "Students become experts on one part of the content.",
        "Group A learns part A, Group B learns part B; students then teach each other in mixed expert groups.",
        "Encourages peer teaching and collaboration.",
      ),
      tool(
        "mn-learning-stations",
        "Learning Stations",
        "Different classroom stations with tasks.",
        "Students rotate between stations; each station has a different activity linked to the same learning goal.",
        "Active learning and engagement.",
      ),
      tool(
        "mn-gallery-walk",
        "Gallery Walk",
        "Students display work around the classroom.",
        "Students move around, observe peer work, and give brief feedback or annotations on sticky notes.",
        "Peer learning and reflection.",
      ),
      tool(
        "mn-concept-mapping",
        "Concept Mapping",
        "Students visually connect ideas.",
        "Create diagrams linking concepts and show relationships between ideas on paper or boards.",
        "Improves understanding of connections.",
      ),
      tool(
        "mn-socratic-questioning",
        "Socratic Questioning",
        "Teacher asks deep thinking questions.",
        "Use open-ended questioning; students justify reasoning and build on each other's answers.",
        "Develops critical thinking.",
      ),
    ],
  },
  {
    phase: "differentiation",
    title: "Differentiated Activity AFL Tools",
    tools: [
      tool(
        "df-must-should-could",
        "Must Should Could",
        "Three levels of tasks on the same objective.",
        "Must: basic task all students complete. Should: expected level. Could: challenge task for ready learners.",
        "Differentiation by ability.",
      ),
      tool(
        "df-choice-board",
        "Choice Board",
        "Students choose tasks from a grid.",
        "Provide multiple activity options; students pick based on interest while meeting the same learning goal.",
        "Student autonomy and differentiation.",
      ),
      tool(
        "df-tiered-tasks",
        "Tiered Tasks",
        "Same concept at different difficulty levels.",
        "Level 1 basic, Level 2 medium, Level 3 advanced — all aligned to today's objective.",
        "Supports mixed-ability learners.",
      ),
      tool(
        "df-learning-menus",
        "Learning Menus",
        "Students order learning tasks like a menu.",
        "Starter, main, and dessert tasks; student selects their path through the menu.",
        "Engagement and choice-based learning.",
      ),
    ],
  },
  {
    phase: "plenary",
    title: "Plenary AFL Tools",
    tools: [
      tool(
        "pl-3-2-1-reflection",
        "3-2-1 Reflection",
        "Structured end-of-lesson reflection.",
        "Students record 3 things learned, 2 interesting points, and 1 question they still have.",
        "Structured reflection.",
      ),
      tool(
        "pl-hot-seat",
        "Hot Seat",
        "One student answers class questions.",
        "Class asks quick-fire questions; the student in the hot seat responds — rotate volunteers.",
        "Active recall and engagement.",
      ),
      tool(
        "pl-one-word-summary",
        "One Word Summary",
        "Students summarise the lesson in one word.",
        "Each learner writes one word, then explains their choice in a sentence when called.",
        "Quick reflection.",
      ),
      tool(
        "pl-snowball",
        "Snowball Activity",
        "Students write answers, crumple paper, throw, and discuss.",
        "Write response, crumple, toss to another student, unfold, read, and discuss in pairs.",
        "Fun reflection and participation.",
      ),
    ],
  },
  {
    phase: "exitTicket",
    title: "Exit Ticket AFL Tools",
    tools: [
      tool(
        "et-one-minute-paper",
        "One Minute Paper",
        "Students write a quick response at the end of the lesson.",
        "One minute timed write answering a focused prompt on paper or digitally before leaving.",
        "Fast understanding check.",
      ),
      tool(
        "et-muddiest-point",
        "Muddiest Point",
        "Students write what they did not understand.",
        "Each learner names their muddiest point; teacher collects and addresses top themes next lesson.",
        "Identifies confusion.",
      ),
      tool(
        "et-exit-card",
        "Exit Card",
        "1–2 questions at the end of class.",
        "Printed or digital exit card with 1–2 short questions tied to today's objectives.",
        "Quick formative assessment.",
      ),
      tool(
        "et-emoji-scale",
        "Emoji Scale",
        "Students rate understanding using emojis.",
        "Show emoji scale (e.g. confused → confident); students circle or tap their level and optionally add one line why.",
        "Simple self-assessment.",
      ),
    ],
  },
  {
    phase: "successCriteria",
    title: "Success Criteria AFL Tools",
    tools: [
      tool(
        "sc-traffic-light",
        "Traffic Light System",
        "Green = fully understand, Yellow = partially understand, Red = need help.",
        "Students colour or mark traffic light against each success criterion on a checklist.",
        "Self-assessment.",
      ),
      tool(
        "sc-checklist-can-do",
        "Checklist Can Do Statements",
        "Students tick what they can do.",
        "Provide I-can statements aligned to objectives; students tick achieved criteria honestly.",
        "Tracks learning progress.",
      ),
      tool(
        "sc-two-stars-wish",
        "Two Stars and a Wish",
        "Two strengths and one improvement point.",
        "Students write two things they did well and one wish for improvement against the lesson goal.",
        "Feedback and reflection.",
      ),
      tool(
        "sc-rubric-scale",
        "Rubric Scale",
        "Levels of achievement from basic to advanced.",
        "Share rubric descriptors; students place their work or understanding on the scale with brief evidence.",
        "Clear success measurement.",
      ),
    ],
  },
] as const;

const ALL_BY_ID: Map<string, AflToolDefinition> = new Map();
for (const g of AFL_PHASE_GROUPS) {
  for (const t of g.tools) {
    ALL_BY_ID.set(t.id, t);
  }
}

export function getAflToolById(id: string): AflToolDefinition | undefined {
  return ALL_BY_ID.get(id);
}

export function isValidAflPhaseId(v: string): v is AflPhaseId {
  return (AFL_PHASE_IDS as readonly string[]).includes(v);
}

/** One recommended pick per phase for the “Select Recommended” UI action. */
export const AFL_RECOMMENDED_IDS: Record<AflPhaseId, readonly string[]> = {
  starter: ["st-think-pair-share", "st-kwl-chart", "st-entry-ticket"],
  main: ["mn-i-do-we-do-you-do", "mn-socratic-questioning", "mn-concept-mapping"],
  differentiation: ["df-must-should-could", "df-tiered-tasks"],
  plenary: ["pl-3-2-1-reflection", "pl-one-word-summary"],
  exitTicket: ["et-exit-card", "et-one-minute-paper"],
  successCriteria: ["sc-traffic-light", "sc-checklist-can-do", "sc-two-stars-wish"],
};

/**
 * Mandatory AFL-driven PPT generation rules — injected into DeepSeek system prompts for all PPT work.
 */
export const PPT_AFL_DRIVEN_SYSTEM_RULES = `
### CORE SYSTEM RULE — PPT generation is AFL-driven
The PPT generation system is **driven by AFL tools** from the **31-tool catalog** (six phases). Each lesson stage — **Starter**, **Main Phase**, **Differentiation**, **Plenary**, **Exit Ticket**, **Success Criteria** — must be **powered by AFL activities** on the matching slide. Understand every tool deeply: **how it works**, **classroom use**, and **purpose**.

### TEACHER CONTROL RULE (mandatory)
- If the teacher **selected** an AFL tool for a phase, you **MUST** use **exactly** that tool — **do NOT** replace it.
- Implement the selected tool as a **full classroom activity** with complete teacher facilitation steps and student tasks.
- If the teacher **did NOT** select a tool, **automatically select** the best tool for that phase based on **subject**, **grade**, **topic**, and **learning objectives** — then implement it fully.

### GENERAL AFL UNDERSTANDING RULE (mandatory)
- **Do NOT** mention a tool name without implementing it.
- Generate **actual classroom instructions**, **student tasks**, **teacher steps**, and **meaningful content** — not labels like “Use Think Pair Share” alone.

### LESSON STAGE AFL RULES (slide map)
| Slide | Stage | AFL rule |
|-------|-------|----------|
| 2 | Starter Activity | Teacher-selected **or** AI-selected **starter** AFL tool. Engaging, interactive, topic-related. **No** objectives, outcomes, or future-slide content. |
| 6 | Main Phase | **First** full core teaching content. **Then** embed **main phase** AFL tool(s) as interactive activities. |
| 7 | Differentiated Activity | **Differentiation** AFL tool — tasks for lower, middle, and higher achievers aligned with lesson content. |
| 8 | UAE / Real Life / Cross-curricular | **Only one** connection type. **No** AFL tool phase on this slide — content link only. |
| 9 | Plenary | **Plenary** AFL tool — real classroom activity, fully implemented. |
| 10 | Extended Task | Homework/extended task content only — **no** AFL tool phase in catalog. |
| 11 | Exit Ticket | **Exit ticket** AFL tool — short focused assessment, immediate understanding check. |
| 12 | Success Criteria | **Success criteria** AFL tool — students assess their own learning. **No** duplication of exit ticket. |

### CRITICAL CONTENT RULES (mandatory — every slide)
1. **No slide** may contain content belonging to **another** slide.
2. **No** duplicated headings inside a slide body.
3. **No** repetition of the same content inside one slide.
4. **No** previewing future slides.
5. **No** mixing lesson components across slides.
6. Each slide must remain **strictly self-contained**.

### FINAL OUTPUT REQUIREMENT
Generate structured PPT slides with **pedagogically correct AFL integration** from the **31-tool catalog only**. Teacher selections override AI picks. Every AFL-powered slide must be **classroom-ready**, not meta-instructions.
`.trim();

export type PptSlideAflContext = {
  subject: string;
  grade: string;
  topic: string;
  learningObjectives: string;
};

type PptSlideAflBinding = {
  selectionPhase: AflPhaseId;
  autoSelectPhase: AflPhaseId;
  autoSelectCandidateIds?: readonly string[];
  stageLabel: string;
};

/** AFL bindings per deck slide (1-based). Slides 8 and 10 have no AFL phase. */
export const PPT_SLIDE_AFL_BINDINGS: Partial<Record<number, PptSlideAflBinding>> = {
  2: { selectionPhase: "starter", autoSelectPhase: "starter", stageLabel: "Starter Activity" },
  6: { selectionPhase: "main", autoSelectPhase: "main", stageLabel: "Main Phase" },
  7: {
    selectionPhase: "differentiation",
    autoSelectPhase: "differentiation",
    stageLabel: "Differentiated Activity",
  },
  9: { selectionPhase: "plenary", autoSelectPhase: "plenary", stageLabel: "Plenary" },
  11: { selectionPhase: "exitTicket", autoSelectPhase: "exitTicket", stageLabel: "Exit Ticket" },
  12: {
    selectionPhase: "successCriteria",
    autoSelectPhase: "successCriteria",
    stageLabel: "Success Criteria and Self Evaluation",
  },
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
  return tools
    .map(
      (t) =>
        `- **${t.label}** (\`${t.id}\`)\n  - How it works: ${t.howItWorks}\n  - Classroom use: ${t.classroomUse}\n  - Purpose: ${t.purpose}`,
    )
    .join("\n");
}

function formatToolPromptLine(t: AflToolDefinition): string {
  return `- **${t.label}** (\`${t.id}\`): How it works — ${t.howItWorks} Classroom use — ${t.classroomUse} Purpose — ${t.purpose}`;
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

function formatTeacherSelectedAflBlock(binding: PptSlideAflBinding, ids: string[]): string {
  const lines: string[] = [
    `### AFL for THIS slide — ${binding.stageLabel} (MANDATORY — teacher selected)`,
    "The teacher **selected** the AFL tool(s) below. You **MUST** use **exactly** these tools — **do NOT** replace them. Implement each as a **full classroom activity**: how it works, classroom use steps, student tasks, teacher facilitation, timing, and finished learner-facing prompts — **not** a label.",
    "",
  ];
  const group = AFL_PHASE_GROUPS.find((g) => g.phase === binding.selectionPhase);
  lines.push(`**${group?.title ?? binding.selectionPhase}**`);
  for (const id of ids) {
    const t = getAflToolById(id);
    if (!t) continue;
    lines.push(formatToolPromptLine(t));
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
    "The teacher did **not** select an AFL tool. Pick the **most suitable** tool from the catalog below for **subject**, **topic**, **grade**, and **objectives** — implement it **fully** as classroom-ready content.",
  ];
  if (suggested) {
    lines.push("", `**Suggested default:** ${formatToolPromptLine(suggested)}`);
  }
  lines.push(
    "",
    `**Catalog — ${AFL_PHASE_GROUPS.find((g) => g.phase === catalogPhase)?.title ?? catalogPhase}:**`,
    formatToolCatalogLines(catalogTools),
  );

  if (slideNumber1Based === 6) {
    lines.push(
      "",
      "**Main Phase structure (mandatory):** Present **full core teaching content first**, then embed your chosen main-phase AFL tool as interactive activities.",
    );
  }
  if (slideNumber1Based === 7) {
    lines.push(
      "",
      "**Differentiation structure (mandatory):** Use your chosen differentiation AFL tool to set tasks for **lower**, **middle**, and **higher** achievers aligned with the lesson.",
    );
  }
  if (slideNumber1Based === 11) {
    lines.push(
      "",
      "**Exit Ticket rule:** Short, focused assessment only — immediate understanding check. **No** success criteria.",
    );
  }

  return lines.join("\n").trim();
}

/** AFL instructions for one slide-only DeepSeek call. */
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
      "Use **exactly** the teacher's picks — **do NOT** substitute. Implement each as **full classroom activities** with teacher instructions and student tasks for this topic, grade, and subject.",
      "",
      "**PPT Slide Content:** Embed tools on slide **2** Starter, **6** Main Phase (after teaching), **7** Differentiation, **9** Plenary, **11** Exit Ticket, **12** Success Criteria. Slide **8** = one connection only (no AFL phase). Slide **10** = extended task only (no AFL phase).",
      "",
      "**Picture Prompt Image Analysis (if selected):** Write the exact observation and prediction prompts for the starter image.",
      "",
      "**Teacher selections (implement fully):**",
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
        lines.push(formatToolPromptLine(t));
      }
      lines.push("");
    }
    if (!listedAny) return "";
    return lines.join("\n").trim();
  }

  if (!ctx) return "";

  lines.push(
    "### No teacher AFL selections — AI must auto-select per AFL-powered slide",
    "Auto-select the best tool per phase for slides **2, 6, 7, 9, 11, 12** and implement fully.",
    "",
    "**Per-slide guidance:**",
  );

  for (const slideNum of [2, 6, 7, 9, 11, 12] as const) {
    const binding = PPT_SLIDE_AFL_BINDINGS[slideNum];
    if (!binding) continue;
    const suggestedId = suggestAutoAflToolId(slideNum, ctx);
    const suggested = suggestedId ? getAflToolById(suggestedId) : undefined;
    lines.push(
      `- Slide **${slideNum}** (${binding.stageLabel}): auto-select from **${binding.autoSelectPhase}**${
        suggested ? ` — suggested: **${suggested.label}**` : ""
      }`,
    );
  }

  lines.push("", "**Full 31-tool catalog:**", "");
  for (const group of AFL_PHASE_GROUPS) {
    lines.push(`**${group.title}**`);
    lines.push(formatToolCatalogLines(group.tools));
    lines.push("");
  }

  return lines.join("\n").trim();
}

/** One short classroom line for slide bullets (name + purpose). */
export function briefHowToUseForSlide(howToUse: string, maxLen = 160): string {
  const t = howToUse.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const purposeIdx = t.toLowerCase().indexOf("purpose:");
  const slice = purposeIdx > 0 ? t.slice(purposeIdx) : t;
  return slice.length > maxLen ? `${slice.slice(0, maxLen - 1).trim()}…` : slice;
}

export function formatToolsBlockForSlide(phase: AflPhaseId, selectedIds: string[] | undefined): string {
  if (!selectedIds?.length) return "";
  const parts: string[] = ["\n\nSelected AFL for this part of the lesson\n"];
  for (const id of selectedIds) {
    const t = getAflToolById(id);
    if (!t) continue;
    parts.push(`• ${t.label}: ${t.purpose}`);
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
      const t = getAflToolById(id);
      if (!t) continue;
      lines.push(`• ${t.label}`);
      lines.push(`  How it works: ${t.howItWorks}`);
      lines.push(`  Classroom use: ${t.classroomUse}`);
      lines.push(`  Purpose: ${t.purpose}`);
    }
    lines.push("");
  }
  return any ? lines.join("\n") : "";
}

/** Max AFL tools per DeepSeek call (smaller payloads = faster, fewer timeouts). */
export const AFL_ACTIVITY_SHEETS_TOOLS_PER_BATCH = 3;

/** Ordered list of teacher-selected AFL tools (catalog order by phase). */
export function getOrderedSelectedAflTools(selections: AflSelectionsPayload): AflToolDefinition[] {
  const selectedTools: AflToolDefinition[] = [];
  for (const group of AFL_PHASE_GROUPS) {
    const ids = selections[group.phase] ?? [];
    for (const id of ids) {
      const t = getAflToolById(id);
      if (t) selectedTools.push(t);
    }
  }
  return selectedTools;
}

/**
 * User message for one batch of AFL Activity Sheets (≤ {@link AFL_ACTIVITY_SHEETS_TOOLS_PER_BATCH} tools).
 * Keeps output short: brief purpose, ≤5 classroom bullets, ≤4 student tasks — no long paragraphs.
 */
export function buildAflActivitySheetsBatchUserMessage(params: {
  input: { subject: string; grade: string; topic: string; chapter: string; curriculumType: string };
  tools: AflToolDefinition[];
  sourceMaterialBlock?: string;
}): string | null {
  const { input, tools, sourceMaterialBlock } = params;
  if (!tools.length) return null;

  const toolList = tools
    .map((t, i) => `${i + 1}. ${t.label} (ID: ${t.id}) — Purpose (reference): ${t.purpose}`)
    .join("\n");

  const chapterLine = input.chapter.trim()
    ? `Chapter / unit: ${input.chapter.trim()}`
    : "Chapter / unit: not specified";

  return `
Generate **printable student-facing AFL Activity Sheets** for ONLY the tools in THIS batch (below). Do not include tools that are not listed.

### Lesson context
- Curriculum: ${input.curriculumType}
- Grade / Year group: ${input.grade}
- Subject: ${input.subject}
- ${chapterLine}
- Topic: ${input.topic}
${sourceMaterialBlock ?? ""}

### Tools in this batch (one compact sheet per tool, in this order)
${toolList}

### Strict brevity (mandatory — avoid slow oversized outputs)
For **each** tool, use this exact structure. No long paragraphs anywhere.

**=== [Tool name] — ${input.topic} ===**

**Tool name and purpose** (maximum 2 short lines total — no paragraph):
(line 1)
(line 2)

**How to use in classroom** (maximum 5 bullet lines; each bullet one short line starting with "- "):
- ...
(up to 5 bullets)

**Student activity** (exactly 3 or 4 numbered items — questions OR short tasks only):
1. ...
2. ...
3. ...
4. ... (optional fourth)

Between tools, insert one line: ─────────────────────────────────────────────

Rules:
- Plain text only — no markdown code fences.
- Tie every sheet to topic "${input.topic}", subject "${input.subject}", grade "${input.grade}".
- If a tool normally needs a grid/chart, use a minimal ASCII sketch or short labelled lines — still respect the line limits above.

Wrap the **entire** batch output between these lines (exactly):
AFL ACTIVITY SHEETS START
…content…
AFL ACTIVITY SHEETS END
`.trim();
}

/**
 * @deprecated Prefer {@link buildAflActivitySheetsBatchUserMessage} with batched calls from the API route.
 * Builds one message for all selected tools (can be huge — kept for tests/tools only).
 */
export function buildAflActivitySheetsUserMessage(params: {
  input: { subject: string; grade: string; topic: string; chapter: string; curriculumType: string };
  selections: AflSelectionsPayload;
  sourceMaterialBlock?: string;
}): string | null {
  const tools = getOrderedSelectedAflTools(params.selections);
  return buildAflActivitySheetsBatchUserMessage({
    input: params.input,
    tools,
    sourceMaterialBlock: params.sourceMaterialBlock,
  });
}

