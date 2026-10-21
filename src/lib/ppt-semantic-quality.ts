import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

export type PptQualitySeverity = "warning" | "error";
export type PptSemanticIssue = { slideIndex: number; code: string; severity: PptQualitySeverity; message: string };

const GENERIC_PATTERNS = [
  /^Incomplete\b/i,
  /take a moment to think about what you already know/i,
  /this topic links to the UN Sustainable Development Goals/i,
  /demonstrate a clear, measurable understanding/i,
  /key concepts, terms, and explanations for today's lesson/i,
  /a challenging task extending beyond the objective/i,
  /a short question to check your understanding/i,
  /reflect on what you have learned[\s\S]+rate your own confidence/i,
];
const OBSERVABLE_VERBS = /\b(identify|label|describe|explain|compare|calculate|solve|classify|analyse|analyze|evaluate|justify|design|construct|predict|demonstrate|trace|interpret|apply|write|draw|create)\b/i;
const STUDENT_ACTIONS = /\b(answer|choose|compare|complete|create|discuss|draw|explain|identify|label|observe|predict|record|solve|sort|test|write)\b/i;
const QUESTION_STARTS = /(?:^|\n)\s*(?:\d{1,2}[.)]\s*)?(?:what|why|how|which|where|when|calculate|explain|predict|compare|identify|describe)\b/im;

function meaningfulTopicTokens(topic: string): string[] {
  const stop = new Set(["this", "that", "with", "from", "lesson", "topic"]);
  return topic.toLowerCase().match(/[a-z\u0600-\u06ff]{4,}/g)?.filter((token) => !stop.has(token)) ?? [];
}
function mentionsTopic(body: string, topic: string): boolean {
  const tokens = meaningfulTopicTokens(topic);
  const lower = body.toLowerCase();
  return tokens.length === 0 || tokens.some((token) => lower.includes(token));
}
function questionCount(body: string): number { return (body.match(/[?؟]/g) ?? []).length; }
function numberedPromptCount(body: string): number {
  return body.split(/\r?\n/).filter((line) => /^\s*\d{1,2}[.)]\s+\S/u.test(line)).length;
}

export function validateGeneratedSlideBody(slideName: string, body: string, topic: string): Omit<PptSemanticIssue, "slideIndex">[] {
  const issues: Omit<PptSemanticIssue, "slideIndex">[] = [];
  const add = (code: string, severity: PptQualitySeverity, message: string) => issues.push({ code, severity, message });
  const text = body.trim();
  if (text.length < 30) add("content_too_short", "error", "The section is too short to be complete.");
  if (GENERIC_PATTERNS.some((pattern) => pattern.test(text))) add("generic_placeholder", "error", "The section contains generic placeholder language.");
  // Topic overlap is advisory: legitimate explanations may use examples or equations instead of
  // repeating the topic label verbatim. Structural failures below remain blocking.
  if (!mentionsTopic(text, topic) && !/Chapter, Topic and SDG Goal/i.test(slideName)) add("topic_not_grounded", "warning", "The section may not be grounded in the lesson topic.");
  // The current structural labels and observable-verb lexicon are English-specific. Do not turn
  // them into false blocking failures for Arabic; schema and length checks still apply.
  const arabicCharacters = (text.match(/[\u0600-\u06ff]/g) ?? []).length;
  if (arabicCharacters > text.replace(/\s/g, "").length / 2) return issues;
  if (/Starter Activity/i.test(slideName)) {
    if (!STUDENT_ACTIONS.test(text)) add("starter_missing_action", "error", "The starter has no concrete student action.");
    if (questionCount(text) === 0 && !QUESTION_STARTS.test(text)) add("starter_missing_prompt", "warning", "The starter has no explicit question or prompt.");
  } else if (/Learning Outcomes/i.test(slideName)) {
    if (!OBSERVABLE_VERBS.test(text)) add("outcome_not_measurable", "error", "Learning outcomes lack an observable action.");
  } else if (/Main Phase Core Teaching/i.test(slideName)) {
    if (!/[.:]/.test(text) || text.split(/\s+/).length < 15) add("teaching_explanation_missing", "error", "Core teaching lacks a complete subject explanation.");
  } else if (/Differentiated/i.test(slideName)) {
    for (const tier of ["Higher Achievers", "Middle Achievers", "Lower Achievers"]) if (!new RegExp(tier, "i").test(text)) add("differentiation_structure_invalid", "error", `The ${tier} task is missing.`);
    if (!STUDENT_ACTIONS.test(text)) add("differentiation_not_actionable", "error", "Differentiated tasks lack concrete student actions.");
  } else if (/Exit Ticket/i.test(slideName)) {
    const count = Math.max(questionCount(text), numberedPromptCount(text));
    if (count < 2 || count > 3) add("exit_ticket_question_count", "error", "Exit ticket must contain two or three actual questions.");
  } else if (/Success Criteria/i.test(slideName)) {
    const criteria = text.split(/\r?\n/).filter((line) => /\bi can\b/i.test(line));
    if (criteria.length < 4 || criteria.length > 6) add("success_criteria_structure", "error", "Success criteria must contain four to six I can statements.");
    if (criteria.some((line) => !OBSERVABLE_VERBS.test(line))) add("success_criteria_not_measurable", "error", "A success criterion lacks an observable action.");
  } else if (/Chapter, Topic and SDG Goal/i.test(slideName)) {
    if (!/SDG\s*\d+/i.test(text)) add("sdg_missing_goal", "error", "The SDG section lacks a numbered goal.");
  } else if (/Real Life|Cross Curricular/i.test(slideName)) {
    if (!mentionsTopic(text, topic) || text.split(/\s+/).length < 30) add("connection_not_explained", "error", "The connection is not explained in enough topic-specific detail.");
  } else if (/Plenary/i.test(slideName)) {
    if (!STUDENT_ACTIONS.test(text)) add("afl_activity_not_actionable", "error", "The AfL activity lacks a concrete student action.");
  }
  if (text.split(/\r?\n/).some((line) => /^\s*\d{1,2}[.)]\s*$/u.test(line))) add("fragmented_numbered_item", "error", "A numbered item has no instruction text.");
  return issues;
}

export function validateStructuredLessonQuality(slides: StructuredLessonSlideModel[], topic: string): PptSemanticIssue[] {
  return slides.flatMap((slide, slideIndex) => validateGeneratedSlideBody(slide.slideTitle, slide.body, topic)
    .filter((issue) => slideIndex !== 0 || issue.code !== "content_too_short")
    .map((issue) => ({ ...issue, slideIndex })));
}
