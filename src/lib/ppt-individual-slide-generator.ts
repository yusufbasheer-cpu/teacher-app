/**
 * Individual slide content generators — each function makes its own isolated DeepSeek API call
 * for ONE specific slide. No shared lesson-plan context is passed, making it physically
 * impossible for content to bleed from one slide into another.
 */

import {
  sanitizeSlide7DifferentiatedBody,
  sanitizeSlide10ExtendedBody,
  stripSlideTitleEchoFromBody,
} from "@/lib/ppt-slide-by-slide";
import { getTeachingStrategyMechanism, resolveGenerationTopic } from "@/lib/lesson-plan";
import { PPT_AFL_DRIVEN_SYSTEM_RULES, getAflToolById, type AflPhaseId, type AflSelectionsPayload, type MainActivityStructure } from "@/lib/afl-tools";
import { buildPptSlideBodyLanguageHint } from "@/lib/deepseek-lesson-system-prompt";
import {
  DEFAULT_PRESENTATION_LANGUAGE,
  localeTagFor,
  pptString,
  type PresentationLanguage,
} from "@/lib/ppt-language";
import { logDeepSeekUsage } from "@/lib/ai-usage/deepseek";
import {
  parseQuestionSources,
  QUESTION_SOURCE_SELF_CHECK,
  selectedSdgLabel,
  TEACHER_TEXT_SELF_CHECK,
  teachingEvidencePrompt,
  validateSelectedSdg,
  type QuestionSource,
  type SelectedSdg,
  type TeachingEvidence,
} from "@/lib/ppt-educational-quality";
import {
  buildFallbackMainPhaseActivity,
  parseMainPhaseActivities,
  type MainPhaseActivityInstruction,
} from "@/lib/ppt-main-phase-activity";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_ATTEMPTS = 3;
const SLIDE_MAX_TOKENS = 1400;

export type SlideGenParams = {
  topic: string;
  subject: string;
  grade: string;
  chapter?: string;
  curriculumType?: string;
  learningObjectives?: string;
  /** Formatted AFL description for the Starter slide (slide 2). */
  starterAflBlock?: string;
  /** Finished earlier teaching text (starter, main phase) that question slides must draw on. */
  teachingEvidence?: TeachingEvidence[];
  /** The one SDG chosen on slide 3 for the whole deck. */
  selectedSdg?: SelectedSdg;
  /** Formatted AFL description for the Main Phase slide (slide 6). */
  mainAflBlock?: string;
  /** Formatted AFL description for the Plenary slide (slide 9). */
  plenaryAflBlock?: string;
  /** Formatted AFL description for the Differentiated Activity slide (slide 7). */
  differentiationAflBlock?: string;
  /** Formatted AFL description for the Exit Ticket slide (slide 11). */
  exitTicketAflBlock?: string;
  /** Formatted AFL description for the Success Criteria slide (slide 12). */
  successCriteriaAflBlock?: string;
  /**
   * The teacher-selected main-phase activity, resolved to a concrete structure. When present it
   * — not a hardcoded scaffold — determines how slide 6 is organised.
   */
  mainActivity?: MainActivityStructure;
  /** Optional pedagogy selector (see `TEACHING_STRATEGIES`). */
  teachingStrategy?: string;
  /** Validated teacher selections, used to reject label-only model responses. */
  aflSelections?: AflSelectionsPayload;
  /** Language every generated field on the slide must be written in. */
  language?: PresentationLanguage;
  uaeFrameworkEnabled: boolean;
  dateStr?: string;
  /** Observability only; never included in prompts. */
  usageUserId?: string;
};

export type { MainActivityStructure };

export type SlideGenResult = {
  body: string;
  teacherNotes: string;
  notices: string[];
  mainPhaseActivities?: MainPhaseActivityInstruction[];
  /** Question slides only: each question, its expected answer and the earlier element that teaches it. */
  questionSources?: QuestionSource[];
};

/** What the parsed provider response offers to a slide-specific acceptance check. */
type ParsedSlideResponse = { body: string; teacherNotes: string; questionSources: QuestionSource[] };

type DSMessage = { role: "system" | "user"; content: string };

/** Elements whose finished text is given to the question slides as their only source of answerable knowledge. */
export const QUESTION_SOURCE_ELEMENTS = ["starter", "main-phase"] as const;

/**
 * Appended to the plenary, mini-plenary and exit-ticket prompts. The earlier teaching text is the source of truth,
 * and the structured question_sources list makes each question's answer traceable to where it was taught.
 */
function questionSourcingBlock(params: SlideGenParams): string {
  return `
WHAT WAS TAUGHT EARLIER IN THIS LESSON (the ONLY knowledge your questions may require):
${teachingEvidencePrompt(params.teachingEvidence ?? [])}

QUESTIONS MUST COME FROM THE TEACHING ABOVE (MANDATORY):
- Every question must be answerable from the earlier teaching text above. Objectives alone do not prove a concept was taught. Questions may test understanding or application, but never require facts that were not taught.
- Keep the intended difficulty and thinking level.
- Sentence starters scaffold the response without giving the answer away, e.g. "The plant needs ______ because ______." Never write the answer into a question, choice stem or sentence starter.
- Put every expected answer in teacher_notes, never on the slide.
- Add a "question_sources" array to the JSON: one entry per question with "question_id" (q1, q2...), "question_text" (exactly as written on the slide), "expected_answer", "source_element_ids" (one or more of: ${QUESTION_SOURCE_ELEMENTS.join(", ")}), and "learning_objective_ref" (the objective it checks, or "").
- ${QUESTION_SOURCE_SELF_CHECK}`;
}

/** The one SDG chosen on slide 3; every later explicit SDG reference must use exactly this label. */
function selectedSdgRule(params: SlideGenParams): string {
  return params.selectedSdg
    ? `If you refer to a Sustainable Development Goal, use exactly "${selectedSdgLabel(params.selectedSdg)}". Never name or number any other SDG.`
    : "Do not cite a Sustainable Development Goal number on this slide.";
}

/** Rejects a question slide whose questions are not all traced to earlier teaching, or that prints an answer. */
function questionSourceCheck(parsed: ParsedSlideResponse): string | undefined {
  if (parsed.questionSources.length === 0) return "missing question_sources: list every question with its expected answer and the earlier teaching element it comes from";
  const allowed = new Set<string>(QUESTION_SOURCE_ELEMENTS);
  const bad = parsed.questionSources.filter((q) => q.sourceElementIds.some((id) => !allowed.has(id)));
  if (bad.length) return `question_sources may only cite ${QUESTION_SOURCE_ELEMENTS.join(" or ")}; fix ${bad.map((q) => q.questionId).join(", ")}`;
  const body = parsed.body.toLowerCase();
  const leaked = parsed.questionSources.find((q) => q.expectedAnswer.length >= 12 && body.includes(q.expectedAnswer.toLowerCase()));
  if (leaked) return `the expected answer for ${leaked.questionId} appears on the student slide; move it to teacher_notes`;
  return undefined;
}

/** Rejects a slide that names an SDG other than the one selected for this lesson. */
function sdgCheck(params: SlideGenParams) {
  return (parsed: ParsedSlideResponse): string | undefined => {
    if (!params.selectedSdg) return undefined;
    const mismatches = validateSelectedSdg([{ body: parsed.body }], params.selectedSdg);
    return mismatches.length ? `use only ${selectedSdgLabel(params.selectedSdg)} for any SDG reference` : undefined;
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Arabic decks must come back Arabic in *every* returned field, not just the main body — the
 * previous behaviour produced Arabic slide titles stapled onto English content. The carve-out
 * matters as much as the rule: a teacher's own proper nouns, acronyms and technical terms must
 * survive verbatim rather than being transliterated into Arabic script or translated away.
 */
function buildLanguageDirective(language: PresentationLanguage): string {
  if (language !== "ar") {
    return `OUTPUT LANGUAGE:
- Write every part of this slide in clear English appropriate for the grade.`;
  }
  return `OUTPUT LANGUAGE (ABSOLUTE REQUIREMENT):
- Write **EVERY** textual field you return in Modern Standard Arabic (فصحى) suitable for the classroom. This is not a stylistic preference — an English word anywhere outside the exceptions below is a defect.
- This covers, without exception: headings and sub-headings, instructions, activity names and steps, explanations, questions, examples, teacher instructions, student instructions, assessment and success-criteria text, labels, captions, and any supporting or connecting text.
- Do NOT write an English draft and append an Arabic translation. Do NOT mirror content in both languages. Return Arabic only.
- Do NOT transliterate Arabic into Latin letters under any circumstance.
- ${buildPptSlideBodyLanguageHint("Arabic")}

PERMITTED EXCEPTIONS (keep these in their original script — do not translate or transliterate):
- Proper nouns, personal names, place names and organisation names the teacher supplied.
- Established technical terms, scientific notation, units, acronyms, and programming or mathematical symbols where the Arabic classroom convention is to keep the Latin form.
- Direct quotations the teacher provided in another language.
- Numerals may use either Arabic-Indic (٠١٢) or Western (012) digits — be consistent within the slide.`;
}

function buildIsolatedSystemPrompt(slideName: string, params: SlideGenParams): string {
  const { topic, subject, grade, chapter } = params;
  const focus = resolveGenerationTopic(topic, chapter) || subject;
  const language = params.language ?? DEFAULT_PRESENTATION_LANGUAGE;
  const strategy = params.teachingStrategy?.trim();
  const strategyMechanism = getTeachingStrategyMechanism(strategy);
  return `You are a professional teacher creating a PowerPoint presentation slide. You are generating content for ONE specific slide ONLY.

SLIDE: ${slideName}

LOCKED LESSON CONTEXT (authoritative — do not deviate):
- Subject: ${subject}
- Grade: ${grade}
${chapter?.trim() ? `- Chapter: ${chapter.trim()}\n` : ""}- Topic: ${focus}

STRICT ISOLATION RULES:
1. Generate content ONLY for the slide named above. Do NOT include content for any other slide.
2. Do NOT repeat the slide title "${slideName}" inside the content body.
3. Do NOT use markdown headers (#, ##), bold (**text**), or italic (*text*).
4. Do NOT use bullet symbols (-, *, •) — use numbered lists or plain paragraph lines.
5. Return clean plain text that is classroom-ready and professional.
6. Content must be specific to the actual topic being taught.
7. Do NOT reference what came before or what comes after this slide.

TOPIC LOCK (critical):
- The locked lesson context above is the ONLY subject matter this slide may teach. Treat it as authoritative regardless of what other subjects, chapters, or example topics you may associate with this grade or subject area.
- Do NOT substitute, drift to, or blend in a different or "example" topic (e.g. a common textbook example for this subject) even if it feels like a natural or well-known illustration — every sentence must stay grounded in "${focus}".
- If you are uncertain about a specific fact, stay generically correct and on-topic rather than switching to a different, better-known topic.

${buildLanguageDirective(language)}
${strategy ? `
TEACHING STRATEGY (teacher-selected — shape the delivery around it):
- ${strategy}
- Required classroom mechanism: ${strategyMechanism ?? "Use the named strategy's established sequence with real student actions and topic-specific content."}
- Show the mechanism through an actual problem, evidence, roles, product, or decisions on the slide. The strategy name alone is insufficient. Put facilitation and timing in teacher_notes.` : ""}
${PPT_AFL_DRIVEN_SYSTEM_RULES}
${studentFacingDirective()}`;
}

function studentFacingDirective(): string {
  return `
VISIBLE SLIDE AUDIENCE (MANDATORY):
- The presentation is projected directly to students. Write the visible body FOR students, using "you", "your", and imperative instructions where appropriate.
- Never write narration about the teacher or directions to the teacher in the visible body. Keep phrases such as "ask students", "explain to the class", "give students", "circulate", and "cold call" out of the body.
- Explain concepts directly to students, then give them a clear task. Address activity steps directly: "Think...", "Discuss...", "Write...".
- Timing, AFL delivery, teacher moves, answer reveals, and differentiation support belong only in teacher_notes.
- Never print a tool's catalogue purpose or a heading such as "Selected AFL". Display the actual student task, filled-in items, questions, and response format instead. A tool name may appear only alongside its fully implemented task.
- Return JSON with "body" (student-facing visible text) and "teacher_notes" (short teacher-only note with timing, AFL tool/reminder, and delivery/differentiation tip). The main-phase prompt may require one additional "main_phase_activities" array; do not add it for other slides. Do not use markdown fences.
`;
}

function cleanBody(body: string, slideName: string): string {
  let s = body
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(^|[\s(])_{1,2}([^\s_]+)_{1,2}(?=[\s).,!?:;]|$)/gm, "$1$2")
    .trim();
  s = stripSlideTitleEchoFromBody(s, slideName);
  return s.replace(/\n{4,}/g, "\n\n\n").trim();
}

async function callDeepSeek(messages: DSMessage[], telemetry?: { userId: string; operation: string }): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { content: "", error: "Missing DEEPSEEK_API_KEY" };

  let res: Response;
  const startedAt = Date.now();
  try {
    res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.5,
        max_tokens: SLIDE_MAX_TOKENS,
        messages,
      }),
    });
  } catch (err) {
    if (telemetry) void logDeepSeekUsage({ ...telemetry, requestedModel: "deepseek-chat", status: "failed", durationMs: Date.now() - startedAt });
    return { content: "", error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const raw = await res.text();
  if (telemetry) void logDeepSeekUsage({ ...telemetry, requestedModel: "deepseek-chat", rawBody: raw, status: res.ok ? "success" : "failed", durationMs: Date.now() - startedAt });
  if (!res.ok) return { content: "", error: `HTTP ${res.status}: ${raw.slice(0, 200)}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { content: "", error: "Invalid JSON from DeepSeek" };
  }

  const content =
    (parsed as { choices?: [{ message?: { content?: string } }] })
      ?.choices?.[0]?.message?.content ?? "";
  return { content };
}

async function generateWithRetries(
  slideName: string,
  systemPrompt: string,
  userPrompt: string,
  selectedTools?: { phase: AflPhaseId; ids: string[]; language: PresentationLanguage },
  usageUserId?: string,
  requireMainPhaseActivities = false,
  fallbackActivity?: (body: string, teacherNotes: string) => MainPhaseActivityInstruction,
  extraCheck?: (parsed: ParsedSlideResponse) => string | undefined,
): Promise<SlideGenResult> {
  const notices: string[] = [];
  let body = "";
  let teacherNotes = "";
  let mainPhaseActivities: MainPhaseActivityInstruction[] = [];
  let questionSources: QuestionSource[] = [];
  let lastFailure = "";
  let lastCandidateBody = "";
  let lastCandidateTeacherNotes = "";
  let lastFailureIsQualityOnly = false;
  const maxAttempts = selectedTools?.ids.length ? 4 : MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptHint =
      attempt > 1
        ? `\n\n(Attempt ${attempt}: correct this exact failure from the prior response: ${lastFailure}. Ensure the content is complete, topic-specific, and follows all isolation rules. If timing was on the slide, remove every duration from body and write it in teacher_notes.)`
        : "";
    const slideNumber = ({ "Starter Activity": 2, "Chapter, Topic and SDG Goal": 3, "Learning Outcomes": 5, "Main Phase Core Teaching": 6, "Differentiated Activity and Mini Plenary": 7, "UAE Real Life and Cross Curricular Connection": 8, "Real Life and Cross Curricular Connection": 8, Plenary: 9, "Extended Task": 10, "Exit Ticket": 11, "Success Criteria and Self Evaluation": 12 } as Record<string, number>)[slideName];
    const { content, error } = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: `${userPrompt}${attemptHint}` },
    ], usageUserId && slideNumber ? { userId: usageUserId, operation: `ppt_slide_${slideNumber}` } : undefined);

    if (error) {
      notices.push(`${slideName} attempt ${attempt}: ${error}`);
      continue;
    }

    const parsed = parseStudentSlideResponse(content);
    body = parsed.body;
    teacherNotes = parsed.teacherNotes;
    mainPhaseActivities = parsed.mainPhaseActivities;
    questionSources = parsed.questionSources;
    lastCandidateBody = body;
    lastCandidateTeacherNotes = teacherNotes;
    const coreFailure = validateSelectedAflBody(body, selectedTools) ??
      (requireMainPhaseActivities && mainPhaseActivities.length === 0 ? "missing or invalid structured main-phase activity instructions" : undefined) ??
      (selectedTools?.ids.length && teacherNotes.length < 35 ? "missing teacher guidance in speaker notes" : undefined) ??
      (body.length < 30 ? `response too short (${body.length} chars)` : undefined);
    const extraFailure = coreFailure ? undefined : extraCheck?.({ body, teacherNotes, questionSources });
    const failure = coreFailure ?? extraFailure;
    if (!failure) break;
    lastFailure = failure;
    lastFailureIsQualityOnly = !coreFailure;
    notices.push(`${slideName} attempt ${attempt}: ${failure}`);
    body = "";
  }

  // The question-source / SDG checks improve a complete slide; they never cost the teacher its content. If only
  // they still fail, keep the last complete slide and let validation report its questions as unverified.
  if (!body && lastFailureIsQualityOnly && lastCandidateBody.length >= 30) {
    body = lastCandidateBody;
    teacherNotes = lastCandidateTeacherNotes;
    notices.push(`${slideName}: kept the last complete slide; ${lastFailure} (flagged for review)`);
  }

  if (!body) {
    if (
      requireMainPhaseActivities &&
      fallbackActivity &&
      lastCandidateBody.length >= 30 &&
      lastFailure === "missing or invalid structured main-phase activity instructions"
    ) {
      body = lastCandidateBody;
      teacherNotes = lastCandidateTeacherNotes;
      mainPhaseActivities = [fallbackActivity(body, teacherNotes)];
      notices.push(`${slideName}: used the deterministic activity-instruction fallback after invalid structured metadata`);
    }
  }

  if (!body) {
    if (selectedTools?.ids.length || requireMainPhaseActivities) {
      throw new Error(`${slideName}: activity content or its required student-instruction metadata was not implemented after ${maxAttempts} attempts (${notices.join("; ")})`);
    }
    body = `_(${slideName} could not be generated — please regenerate this slide.)_`;
  }

  return {
    body,
    teacherNotes: teacherNotes || defaultTeacherNotes(slideName),
    notices,
    ...(mainPhaseActivities.length ? { mainPhaseActivities } : {}),
    ...(questionSources.length ? { questionSources } : {}),
  };
}

function selectedToolsFor(params: SlideGenParams, phase: AflPhaseId) {
  const ids = params.aflSelections?.[phase] ?? [];
  return ids.length ? { phase, ids, language: params.language ?? DEFAULT_PRESENTATION_LANGUAGE } : undefined;
}

/** Reject shallow selected-tool responses before they become exportable slides. */
export function validateSelectedAflBody(
  body: string,
  selection: { phase: AflPhaseId; ids: string[]; language: PresentationLanguage } | undefined,
): string | undefined {
  if (!selection?.ids.length) return undefined;
  const lineCount = body.split(/\n/).filter((line) => line.trim()).length;
  if (body.length < 100 || lineCount < 2) return "selected tool needs a complete student task";
  const lineCaps: Record<AflPhaseId, number> = {
    starter: 22, main: 22, differentiation: 22, plenary: 22, exitTicket: 12, successCriteria: 18,
  };
  if (lineCount > lineCaps[selection.phase]) return `too many visible lines (${lineCount}); the exported slide would cut off the activity`;
  const charCaps: Record<AflPhaseId, number> = {
    starter: 3400, main: 4800, differentiation: 3600, plenary: 3400, exitTicket: 1200, successCriteria: 2600,
  };
  if (body.length > charCaps[selection.phase]) return `too much visible text (${body.length} characters); the exported slide would cut off the activity`;
  if (/\[[^\]]*(?:task|question|prompt|example|insert|basic|standard|challenging)[^\]]*\]/i.test(body)) return "unfilled placeholder";
  if (/selected afl|teacher instructions|ask students|tell students|circulate|debrief with/i.test(body)) return "teacher-facing or catalogue text on visible slide";
  if (/\b\d+\s*(?:min|minutes)\b/i.test(body)) return "timing must be in speaker notes";
  if (selection.language !== "en") return undefined;
  if (selection.phase === "differentiation" && !/^\s*Must\s*$[\s\S]*^\s*Should\s*$[\s\S]*^\s*Could\s*$[\s\S]*Mini Plenary/im.test(body)) {
    return "differentiated tiers or mini plenary are missing";
  }
  const concrete = /[?؟]|\b(?:write|solve|compare|explain|discuss|choose|list|predict|identify|create|decide|show|test|draw|read|mark|sort|share|teach|reflect|rate)\b/i.test(body);
  if (!concrete) return "no concrete student action or question";
  for (const id of selection.ids) {
    const tool = getAflToolById(id);
    if (!tool) continue;
    const patterns: Record<string, RegExp[]> = {
      "st-kwl-chart": [/\b(?:k|know)\b/i, /\b(?:w|want)\b/i, /\b(?:l|learn)\b/i],
      "mn-jigsaw": [/\b(?:expert|group a)\b/i, /\bhome group\b/i, /\b(?:teach|share)\b/i],
      "df-must-should-could": [/\bmust\b/i, /\bshould\b/i, /\bcould\b/i],
      "pl-3-2-1-reflection": [/\b3\b/, /\b2\b/, /\b1\b/],
      "sc-traffic-light": [/\bgreen\b/i, /\byellow|amber\b/i, /\bred\b/i],
    };
    if (patterns[id]?.some((pattern) => !pattern.test(body))) return `${tool.label} mechanism is incomplete`;
  }
  return undefined;
}

function parseStudentSlideResponse(content: string): {
  body: string;
  teacherNotes: string;
  mainPhaseActivities: MainPhaseActivityInstruction[];
  questionSources: QuestionSource[];
} {
  const raw = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(raw) as { body?: unknown; teacher_notes?: unknown; main_phase_activities?: unknown; question_sources?: unknown };
    if (typeof parsed.body === "string" && parsed.body.trim()) {
      return {
        body: parsed.body.trim(),
        teacherNotes: typeof parsed.teacher_notes === "string" ? parsed.teacher_notes.trim() : "",
        mainPhaseActivities: parseMainPhaseActivities(parsed.main_phase_activities),
        questionSources: parseQuestionSources(parsed.question_sources),
      };
    }
  } catch {
    // Keep compatibility with older/plain-text provider responses.
  }
  return { body: raw, teacherNotes: "", mainPhaseActivities: [], questionSources: [] };
}

function defaultTeacherNotes(slideName: string): string {
  const timings: Record<string, string> = {
    "Starter Activity": "5–10 minutes",
    "Learning Outcomes": "3 minutes",
    "Main Phase Core Teaching": "25–35 minutes",
    "Differentiated Activity and Mini Plenary": "10–12 minutes",
    "Plenary": "8–10 minutes",
    "Exit Ticket": "3–4 minutes",
  };
  return `Suggested timing: ${timings[slideName] ?? "Adjust to the lesson period"}\nAFL: Use the selected tool for this slide; model the response format, then scan responses before moving on.\nDelivery tip: Keep the visible instructions student-facing and provide verbal support for learners who need it.`;
}

// ── Slide generators ──────────────────────────────────────────────────────────

/** Slide 1: programmatic — subject is in the deck slide title; body is grade + date only. */
export function generateSlide1Body(params: SlideGenParams): SlideGenResult {
  const dateStr =
    params.dateStr ??
    new Date().toLocaleDateString(localeTagFor(params.language ?? DEFAULT_PRESENTATION_LANGUAGE), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const body = [params.grade.trim(), dateStr].filter(Boolean).join("\n");
  return { body, teacherNotes: "Suggested timing: 2 minutes\nAFL: Use a quick visual check that every student can see the lesson context.\nDelivery tip: Welcome students and connect the topic to today's learning.", notices: [] };
}

/** Slide 2: Starter Activity — engaging hook using the selected AFL starter tool. */
export async function generateSlide2(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, starterAflBlock } = params;
  const slideName = "Starter Activity";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate a Starter Activity for a ${grade} ${subject} lesson.
Topic: ${topic}
${starterAflBlock ? `AFL Starter Tool: ${starterAflBlock}` : "Choose an appropriate engaging starter AFL tool."}
${params.aflSelections?.starter?.includes("st-kwl-chart") ? `KWL Chart is selected. The projected slide MUST show three labeled fields K, W, and L. Under K ask a real question about ${topic} that elicits prior knowledge. Under W ask a real curiosity or problem question about ${topic}. Under L give a topic-specific question students will answer after investigating; tell them to leave its answer blank for now. Do not omit L.` : ""}

Requirements:
- Engaging, interactive, and directly relevant to the topic: ${topic}
- Fill in every prompt, item, or response field required by the selected tool; give students clear steps. Put the 5-10 minute timing and teacher delivery in teacher_notes only.
- Hook students through prediction, curiosity, inquiry, or a surprising fact about ${topic}
- Do NOT include learning objectives or outcomes
- Do NOT reveal the full lesson structure
- Do NOT mention differentiation, UAE content, homework, or plenary
- Return only the starter activity content`;

  const result = await generateWithRetries(slideName, system, user, selectedToolsFor(params, "starter"), params.usageUserId);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 3: Chapter, Topic, and SDG Goal — three items only. */
export async function generateSlide3(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, chapter } = params;
  const slideName = "Chapter, Topic and SDG Goal";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate exactly THREE items for a ${grade} ${subject} lesson on: ${topic}

Item 1 — Chapter: ${chapter ? chapter : `The most appropriate chapter or unit that contains "${topic}"`}
Item 2 — Topic: ${topic}
Item 3 — SDG Goal: The single most relevant Sustainable Development Goal for ${topic}, written exactly as "SDG <number> — <full official title>" (for example "SDG 2 — Zero Hunger"). This is the one SDG for the whole lesson.

Rules:
- Write ONLY these three items, each on its own line
- Do NOT add explanations, descriptions, objectives, or activities
- Do NOT add any other content`;

  const result = await generateWithRetries(slideName, system, user, undefined, params.usageUserId);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 4: programmatic — teacher's exact objectives, verbatim. */
export function generateSlide4Body(params: SlideGenParams): SlideGenResult {
  const language = params.language ?? DEFAULT_PRESENTATION_LANGUAGE;
  const raw = (params.learningObjectives ?? "").trim();
  // The teacher's objectives are the source of truth here. The placeholder is reached only when
  // the field is genuinely empty, never as a fallback for text we failed to carry through.
  const body = raw
    ? `By the end of this lesson, you will be able to:\n${stripSlideTitleEchoFromBody(raw, "Learning Objectives")}`
    : pptString(language, "objectivesNotProvided");
  return { body, teacherNotes: "Suggested timing: 3 minutes\nAFL: Use a quick show of hands or confidence check after displaying the objectives.\nDelivery tip: Read the objectives aloud and clarify unfamiliar vocabulary.", notices: [] };
}

/** Slide 5: Learning Outcomes — Bloom's verbs, aligned 1:1 to teacher objectives. */
export async function generateSlide5(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, learningObjectives } = params;
  const slideName = "Learning Outcomes";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const objectiveLines = (learningObjectives ?? "")
    .split("\n")
    .filter((l) => l.trim()).length;
  const count = Math.max(1, objectiveLines);
  const user = `Generate Learning Outcomes for a ${grade} ${subject} lesson on: ${topic}

Teacher's learning objectives (must align to these exactly):
${learningObjectives || "(Write appropriate outcomes for the topic)"}

Requirements:
- Phrase every outcome as a direct promise to the student, beginning with "By the end of this lesson, you will be able to..." or using clear "You will..." statements.
- Write EXACTLY ${count} outcome(s) — one per objective, in the same order
- Use Bloom's Taxonomy action verbs (e.g. identify, describe, explain, compare, evaluate, design)
- Use Must / Should / Could format OR clear numbered list
- Each outcome must be measurable and observable in the classroom
- Do NOT copy objectives verbatim — paraphrase into student learning outcomes
- Do NOT include activities or teaching instructions`;

  const result = await generateWithRetries(slideName, system, user, undefined, params.usageUserId);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/**
 * The activity structure block for slide 6.
 *
 * This used to hardcode "I Do / We Do / You Do" regardless of what the teacher selected, which
 * is why choosing Jigsaw or Learning Stations still produced a gradual-release deck. The
 * structure now comes from the resolved activity: gradual release is emitted only when the
 * teacher actually chose it (or when it is the deterministic recommendation for an unselected
 * main phase), and every other activity supplies its own steps from the AFL catalogue.
 */
function buildMainPhaseStructureBlock(
  activity: MainActivityStructure | undefined,
  topic: string,
  grade: string,
  teachingStrategy?: string,
): string {
  const exploratoryStrategy = /problem-based|inquiry-based|case study|discovery|design thinking|challenge-based|project-based|experiential/i.test(teachingStrategy ?? "");
  const teaching = exploratoryStrategy
    ? `Strategy opening (first): Give students a concrete ${topic} problem, case, observation, or challenge to investigate before revealing the method. Follow with one concise, accurate explanation or worked example that helps them resolve it. Keep one main idea on this slide.`
    : `Core teaching: Explain one key concept and a short worked example specific to ${topic} at ${grade} level, directly to students.`;

  if (!activity) {
    // No selection and no recommendation resolved. Ask for a coherent structure rather than
    // silently imposing one — the documented behaviour for genuinely missing input.
    return `${teaching}

Learning Activity:
Choose one coherent, age-appropriate activity structure for this topic and implement it fully with step-by-step classroom instructions. State the activity's name before its steps.`;
  }

  if (activity.isGradualRelease) {
    return `${teaching}

Structure (I Do / We Do / You Do) — this is the teacher's selected activity${activity.systemRecommended ? " (system-recommended, not explicitly chosen)" : ""}:

I Do — Teacher Explanation:
Model the concept explicitly, using the core teaching content above.

We Do — Guided Practice:
Teacher and students work through examples together, with step-by-step classroom instructions.

You Do — Independent Practice:
Students practise independently. Clear task instructions specific to ${topic}.`;
  }

  return `${teaching}

Learning Activity — "${activity.label}"${activity.systemRecommended ? " (system-recommended, not explicitly chosen)" : " (TEACHER-SELECTED — you MUST use exactly this activity)"}:
How this activity runs: ${activity.howTo}

Implement "${activity.label}" fully for ${topic} at ${grade} level:
- Write the concrete student steps for this activity, in order. Put timings and facilitation in teacher_notes.
- Use this activity's own structure and vocabulary. Do NOT reorganise it into "I Do / We Do / You Do" and do NOT emit those headings — they belong to a different activity that the teacher did not select.
- Every step must be specific to ${topic}, not a generic description of the activity.
- For Jigsaw, specify distinct real ${topic} subtopics for at least three expert groups, what each group must work out, and how students return to teach their home group.`;
}

/** Slide 6: Main Phase Core Teaching — structure driven by the teacher's selected activity. */
export async function generateSlide6(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, curriculumType, mainAflBlock, mainActivity } = params;
  const slideName = "Main Phase Core Teaching";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate the Main Phase Core Teaching content for a ${grade} ${subject} lesson.
Topic: ${topic}
${curriculumType ? `Curriculum: ${curriculumType}` : ""}
${mainAflBlock ? `AFL Main Phase Tool: ${mainAflBlock}` : ""}

${buildMainPhaseStructureBlock(mainActivity, topic, grade, params.teachingStrategy)}

Requirements:
- Write every visible instruction directly to students using "you" and imperative verbs. Put all teacher directions in teacher_notes only.
- Rich, detailed, classroom-ready content throughout
- Keep the visible body within 22 non-empty lines so the exported slide includes the entire activity. For Jigsaw use three concise expert groups, then explicit home-group teaching steps and one short key idea; do not let extra examples displace the home-group exchange.
- All content specific to ${topic}
- Do NOT include differentiation tasks (separate slide)
- Do NOT include plenary or reflection (separate slide)
- Do NOT include UAE-specific real-world links (separate slide)
- Do NOT include homework (separate slide)

STRUCTURED ACTIVITY OUTPUT (MANDATORY):
- Return a "main_phase_activities" array in addition to "body" and "teacher_notes".
- Add one array item for every independently executed main-phase activity, in execution order. Usually there is one item; never split one activity merely because its content may overflow onto continuation slides.
- Each item must use these exact keys: activity_id, activity_name, activity_goal, student_instructions, duration_minutes, group_size, student_role, required_materials, expected_output, teacher_notes, activity_content, activity_type, parent_element_id.
- parent_element_id must be "main-phase". activity_id must use the selected id ${mainActivity?.id ?? "or a stable fallback id"}. activity_name must use ${mainActivity?.label ?? "the actual fallback activity name"}.
- student_instructions must contain 4-6 ordered actions. Each action is one short sentence, at most 15 words, directly addressed to students, and tailored to ${topic} at ${grade} level.
- The steps must tell students what to do, who to work with, what to produce, and how to know they are finished.
- duration_minutes must be a realistic integer for this activity (2-40). group_size and student_role must be concise. required_materials must be a non-empty string array. Do not claim specialist materials unless the task genuinely needs them.
- teacher_notes must cover grouping, preparation, timing, monitoring, learner support, transition, and a check for understanding. None of that teacher-only guidance may appear in student_instructions or body.
- activity_content is the complete visible task that follows its instruction slide. For one activity it must preserve the complete body task. For multiple activities, each activity_content is its exact portion of body, with no dropped questions.
- The top-level body must contain the same activity content in the same order; do not put the separate instruction-slide steps inside body.`;

  const result = await generateWithRetries(
    slideName,
    system,
    user,
    selectedToolsFor(params, "main"),
    params.usageUserId,
    true,
    (body, teacherNotes) => buildFallbackMainPhaseActivity({
      activityId: mainActivity?.id,
      activityName: mainActivity?.label,
      activityType: mainActivity?.id ?? params.teachingStrategy,
      topic,
      grade,
      activityContent: body,
      teacherNotes,
    }),
  );
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 7: Differentiated Activity and Mini Plenary — three tiers + quick check. */
export async function generateSlide7(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, differentiationAflBlock } = params;
  const slideName = "Differentiated Activity and Mini Plenary";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate differentiated activities for a ${grade} ${subject} lesson on: ${topic}
${differentiationAflBlock ? `AFL Differentiation Tool (teacher-selected - implement it): ${differentiationAflBlock}` : ""}

Write EXACTLY FOUR sections in this precise order, each heading on its own line:

Must
Write a concrete scaffolded version of the objective about ${topic}, including a useful first step, example, or sentence starter (blanks, never the answer).

Should
Write a concrete core task about ${topic} that directly practises the main objective.

Could
Write a concrete challenge about ${topic} that requires independent analysis, evaluation, or creation while staying within the SAME objective and procedure. Increase reasoning demand, not syllabus scope (for example, do not switch from one-step to two-step equations).

Mini Plenary
Write ONE filled-in question checking understanding of ${topic}; maximum one sentence.

STRICT RULES:
- Write ONLY the four sections above — nothing else
- Replace every instruction above with finished topic-specific task text; do not copy these descriptions or use square-bracket placeholders.
- The headings are exactly "Must", "Should" and "Could". Never label tasks by ability or achievement group (no "Higher/Middle/Lower Achievers", "High/Low Ability", "weak/strong students"); put any grouping advice in teacher_notes.
- Make reasoning increasingly independent from Must to Could; each tier needs at most two short equations or one short reasoning challenge.
- Keep the whole body under 20 non-empty lines, including the four section headings and mini plenary, so the entire task survives export.
- If another differentiation tool is selected, express its actual choice, tiers, or menu mechanism inside the three sections.
- Do NOT include UAE content, real-world connections, or cross-curricular links
- Do NOT include a full plenary activity
- Do NOT include homework or extended tasks
- ${selectedSdgRule(params)}
${questionSourcingBlock(params)}`;

  const result = await generateWithRetries(slideName, system, user, selectedToolsFor(params, "differentiation"), params.usageUserId, false, undefined, questionSourceCheck);
  const cleaned = cleanBody(result.body, slideName);
  result.body = sanitizeSlide7DifferentiatedBody(
    cleaned,
    topic,
    params.language ?? DEFAULT_PRESENTATION_LANGUAGE,
  );
  return result;
}

/** Slide 8: UAE Real Life / Cross Curricular Connection — switches based on UAE framework flag. */
export async function generateSlide8(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, uaeFrameworkEnabled } = params;
  const slideName = uaeFrameworkEnabled
    ? "UAE Real Life and Cross Curricular Connection"
    : "Real Life and Cross Curricular Connection";
  const system = buildIsolatedSystemPrompt(slideName, params);

  const user = uaeFrameworkEnabled
    ? `Generate UAE Real Life and Cross Curricular Connection content for a ${grade} ${subject} lesson on: ${topic}

Include ALL three of the following, written directly to students:
1. UAE Real-Life Connection: A specific UAE example directly related to ${topic}. Choose the most relevant from: UAE national tree (Ghaf), mangroves, desert ecosystems, UAE Vision 2031, Masdar City, EXPO 2020 legacy, UAE sustainability goals, Emirates wildlife — only what genuinely connects to ${topic}. Say clearly how it connects to today's concept.
2. Cross-Curricular Task: A short task students do that links ${topic} to another school subject (for example Mathematics, Arabic, ICT, Social Studies), with a specific example.
3. SDG in UAE Context: ${params.selectedSdg ? `Use exactly "${selectedSdgLabel(params.selectedSdg)}"` : "The most relevant SDG, written as \"SDG <number> — <official title>\""} and how the UAE is working toward it in relation to ${topic}.

Requirements:
- All content must be SPECIFIC to ${topic}, not generic
- ${TEACHER_TEXT_SELF_CHECK} No curriculum-alignment, inspection or quality-standard statements on the slide (e.g. about MOE, KHDA or SPEA); real UAE examples and institutions as learning content are fine.
- ${selectedSdgRule(params)}
- Do NOT include differentiation tasks
- Do NOT include plenary activities
- Do NOT include homework`
    : `Generate Real Life and Cross Curricular Connection content for a ${grade} ${subject} lesson on: ${topic}

Choose ONE connection type that BEST fits ${topic} and develop it fully with specific details:
A) Real-life application: a concrete, specific example of how ${topic} is used in everyday life
B) Cross-curricular link: how ${topic} connects to another school subject with a specific classroom example
C) Career connection: 2-3 specific careers that use knowledge of ${topic} and exactly how they apply it

Requirements:
- Content must be SPECIFIC to ${topic} — not generic
- Do NOT mention UAE, Emirates, Dubai, Abu Dhabi, MOE UAE, KHDA, or SPEA
- ${selectedSdgRule(params)}
- ${TEACHER_TEXT_SELF_CHECK}
- Do NOT include differentiation tasks
- Do NOT include plenary activities
- Do NOT include homework`;

  const result = await generateWithRetries(slideName, system, user, undefined, params.usageUserId, false, undefined, sdgCheck(params));
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 9: Plenary — complete activity using selected AFL plenary tool. */
export async function generateSlide9(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, plenaryAflBlock } = params;
  const slideName = "Plenary";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate a complete Plenary activity for a ${grade} ${subject} lesson on: ${topic}
${plenaryAflBlock ? `AFL Plenary Tool: ${plenaryAflBlock}` : "Choose the most appropriate plenary AFL tool."}
${params.aflSelections?.plenary?.includes("pl-3-2-1-reflection") ? `The selected 3-2-1 Reflection needs exactly THREE visible response parts: 3 things learned, 2 interesting or important points, and 1 question still held. Give a ${topic}-specific framing prompt or sentence starter for each part. Put partner sharing, collection, and timing only in teacher_notes. Do not add extra solve, submit, or fourth-step tasks.` : ""}

Include:
1. Activity name (do NOT use "Plenary" as the first word)
2. Clear activity objective linked to today's learning about ${topic}
3. Step-by-step student instructions that implement the selected tool's exact response format
4. The exact topic-specific prompts or response fields students need to reflect on ${topic}

Requirements:
- Address students directly throughout: "Reflect...", "Answer...", "Write...". Do not narrate what the teacher should ask or explain.
- Put the 8-10 minute duration and step timings only in teacher_notes
- The body must contain zero durations: no "minutes", "min", or time counts. Put all duration details in teacher_notes.
- Specific to ${topic} — not generic
- Do NOT start the body with the word "Plenary"
- Do NOT include differentiation tasks (separate slide)
- Do NOT include UAE content (separate slide)
- Do NOT include homework (separate slide)
- Do NOT include new teaching content
- ${selectedSdgRule(params)}
${questionSourcingBlock(params)}`;

  const result = await generateWithRetries(slideName, system, user, selectedToolsFor(params, "plenary"), params.usageUserId, false, undefined, questionSourceCheck);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 10: Extended Task / Homework — goes deeper than the lesson. */
export async function generateSlide10(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade } = params;
  const slideName = "Extended Task";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate a Homework or Extended Task for a ${grade} ${subject} lesson on: ${topic}

Include:
1. Task name (NOT "Extended Task" or "Homework" alone — give it a descriptive title)
2. Numbered step-by-step student instructions (what to do, how, and by when)
3. Expected output (what the finished work should look like)
4. Challenge extension for early finishers
5. How this task connects to future learning about ${topic}

Requirements:
- Task must go DEEPER than the lesson — choose from: research task, investigative task, creative project, or design challenge
- Specific to ${topic}
- Do NOT include success criteria or I can statements (separate slide)
- Do NOT include exit ticket questions (separate slide)
- Do NOT include plenary activities
- Do NOT repeat the slide title inside the content`;

  const result = await generateWithRetries(slideName, system, user, undefined, params.usageUserId);
  const cleaned = cleanBody(result.body, slideName);
  result.body = sanitizeSlide10ExtendedBody(cleaned, slideName);
  return result;
}

/** Slide 11: Exit Ticket — format follows the selected tool. */
export async function generateSlide11(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, exitTicketAflBlock } = params;
  const slideName = "Exit Ticket";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate an Exit Ticket for a ${grade} ${subject} lesson on: ${topic}
${exitTicketAflBlock ? `AFL Exit Ticket Tool (teacher-selected - implement it): ${exitTicketAflBlock}` : ""}
${params.aflSelections?.exitTicket?.includes("et-exit-card") ? "The selected Exit Card calls for exactly ONE or TWO short topic-specific questions, with any response space students need. Do not add a third question." : ""}

Requirements:
- Use the selected tool's actual response format and number of prompts. A One Minute Paper needs its brief written response prompt; a Muddiest Point needs one precise confusion prompt; an Exit Card needs a concrete check; an Emoji Scale needs meaningful rating choices plus a topic-specific reason.
- Fill in the exact question(s), choices, example, or sentence stem students need. Do not print a generic tool label or catalogue description.
- Each item checks understanding of a key concept from today's lesson on ${topic}
- Short and clear — answerable in 2-3 minutes total
- If the tool calls for multiple questions, progress from recall to application
- Do NOT include homework instructions
- Do NOT include a separate success-criteria checklist; if the selected exit tool is Emoji Scale, its rating choices and topic-specific reason belong here
- Do NOT include new teaching content
- ${selectedSdgRule(params)}
${questionSourcingBlock(params)}`;

  const result = await generateWithRetries(slideName, system, user, selectedToolsFor(params, "exitTicket"), params.usageUserId, false, undefined, questionSourceCheck);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 12: Success Criteria and Self Evaluation — I can statements + reflection. */
export async function generateSlide12(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, successCriteriaAflBlock } = params;
  const slideName = "Success Criteria and Self Evaluation";
  const system = buildIsolatedSystemPrompt(slideName, params);
  const user = `Generate Success Criteria and Self Evaluation for a ${grade} ${subject} lesson on: ${topic}
${successCriteriaAflBlock ? `AFL Success Criteria Tool (teacher-selected - implement it): ${successCriteriaAflBlock}` : ""}

Use the selected success-criteria tool's exact structure. For Traffic Light, write exactly THREE short topic-specific "I can" criteria and one Green/Yellow/Red key at the top; students mark one colour beside each criterion. Do not repeat long colour descriptions under every criterion. For a Can-Do Checklist, give actual checkable "I can" statements. For a Rubric Scale, give level descriptors tied to quality of reasoning about ${topic}. Do not force an unrelated list of statements or reflection questions onto the selected format.

Requirements:
- All statements must be specific to ${topic} — not generic
- Keep the complete projected response format under 12 non-empty lines so nothing is cut from the slide.
- Put interpretation, next teaching move, and timing in teacher_notes only.
- Do NOT repeat the slide title inside the content
- Do NOT include exit ticket questions (separate slide)
- Do NOT include new teaching content`;

  const result = await generateWithRetries(slideName, system, user, selectedToolsFor(params, "successCriteria"), params.usageUserId);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 13: topic-specific lesson takeaway. */
export function generateSlide13Body(params: SlideGenParams): SlideGenResult {
  const language = params.language ?? DEFAULT_PRESENTATION_LANGUAGE;
  if (language === "ar") {
    return {
      body: [
        `تذكّر ما تعلمته اليوم عن ${params.topic}.`,
        `اذكر مثالاً واحداً يوضّح فهمك، ثم حدّد سؤالاً تريد استكشافه عن ${params.topic}.`,
      ].join("\n"),
      teacherNotes: "Suggested timing: 1 minute\nAFL: Use the closing response as a final positive check-in.\nDelivery tip: Acknowledge effort and dismiss students calmly.",
      notices: [],
    };
  }
  return {
    body: `Think back to ${params.topic}: which idea helped you most?\nGive one example that supports your answer, then write one question you want to explore next.`,
    teacherNotes: "Suggested timing: 1 minute\nAFL: Use the closing response as a final positive check-in.\nDelivery tip: Acknowledge effort and dismiss students calmly.",
    notices: [],
  };
}
