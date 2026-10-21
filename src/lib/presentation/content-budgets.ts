import { getLearningObjectiveContentBudget } from "@/lib/presentation/layout-registry";

/**
 * Prompt guidance for the only Phase 3 slide type with approved registered layouts.
 * The objective itself remains teacher-authored and verbatim; this prevents surrounding AI
 * generation from expanding or replacing it and explicitly keeps design selection out of AI.
 */
export function buildRegisteredLayoutContentGuidance(): string {
  const budget = getLearningObjectiveContentBudget();
  return `REGISTERED SLIDE CONTENT BUDGETS:
- Learning Objectives is populated verbatim from the teacher's form. Do not rewrite, shorten, expand, or add objectives.
- A concise objective of up to ${budget.preferredMaximumCharacters} characters can use either approved layout; the approved statement layout supports up to ${budget.absoluteRegisteredMaximumCharacters} characters.
- If the teacher's exact text exceeds those limits, preserve it. The renderer will use its safe legacy or continuation path.
- Never choose, name, or recommend a slide layout. Layout selection happens deterministically after content generation.`;
}
