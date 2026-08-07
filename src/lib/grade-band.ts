/**
 * Grade-band style guidance for AI-generated lesson content.
 *
 * Layah's grade dropdown is a fixed "Grade 1" … "Grade 12" list (see GRADE_YEAR_OPTIONS in
 * lesson-plan.ts) — no Kindergarten or University option exists in this product, so only the
 * three bands that can actually be selected are modeled here.
 *
 * This only ever produces *register/vocabulary* guidance appended to the AI system prompt —
 * it never changes the pedagogical structure, slide order, or curriculum rules.
 */

export type GradeBand = "early" | "middle" | "senior";

/** Parses "Grade 3" (or any string containing a 1-12 number) into a grade band. Defaults to "middle" if unparseable. */
export function classifyGradeBand(grade: string): GradeBand {
  const match = /\d{1,2}/.exec(grade);
  const n = match ? parseInt(match[0], 10) : NaN;
  if (Number.isFinite(n)) {
    if (n <= 3) return "early";
    if (n <= 8) return "middle";
    return "senior";
  }
  return "middle";
}

const GRADE_BAND_STYLE: Record<GradeBand, string> = {
  early:
    "Grades 1–3: use short, simple sentences and everyday vocabulary. Favor concrete, activity-driven, and visual language over abstract explanation. Frame ideas around curiosity and noticing things (\"Have you ever seen...\", \"Let's find out...\") rather than formal definitions.",
  middle:
    "Grades 4–8: use clear, explanatory language that builds understanding step by step. Introduce subject vocabulary but always explain it in context. Use concrete examples and structured reasoning (\"this happens because...\") rather than just stating facts.",
  senior:
    "Grades 9–12: use academic register and correct subject-specific terminology without over-explaining basics. Frame content with exam-style precision — clear definitions, cause-and-effect reasoning, and language a student would need to reproduce in a written answer.",
};

/** Additive system-prompt paragraph — register/vocabulary guidance only, same pattern as the language/curriculum-framework addenda. */
export function buildGradeBandStyleAddendum(grade: string | null | undefined): string | null {
  const g = grade?.trim();
  if (!g) return null;
  const band = classifyGradeBand(g);
  return `### Grade-appropriate language (style only — do not change lesson structure, sections, or rules above)
${GRADE_BAND_STYLE[band]}
This applies to wording and sentence complexity only. Every slide, section, and pedagogical rule defined above still applies exactly as written.`;
}
