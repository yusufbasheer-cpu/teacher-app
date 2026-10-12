import {
  DECK_SCHEMA_VERSION,
  parseDeckSpec,
  type DeckSpec,
  type EducationalCompositionId,
  type EducationalContentBlock,
  type SlideSpec,
} from "@/lib/slide-schema";
import { blockText, SLIDE_COMPOSITION_REGISTRY } from "@/lib/slide-composition-registry";

export const MAX_PHYSICAL_SLIDES = 200;

export type CompositionSelection = {
  slideId: string;
  composition: EducationalCompositionId;
  variant: string;
  density: "light" | "moderate" | "dense";
  estimatedCharacters: number;
  usedFallback: boolean;
  rationale: string[];
};

export type LayoutEngineResult =
  | { ok: true; deck: DeckSpec; selections: CompositionSelection[] }
  | { ok: false; issues: { slideId: string; code: string; message: string }[] };

function semanticTextUnits(text: string): string[] {
  const tokens = text.match(/\s*\S+\s*/g) ?? [];
  const units: string[] = [];
  let current = "";
  for (const token of tokens) {
    current += token;
    if (/[.!?؟。][\s\t]*$/.test(token) || /\n/.test(token)) {
      if (current.trim()) units.push(current);
      current = "";
    }
  }
  if (current.trim()) units.push(current);
  return units.length ? units : [text];
}

function blockItemCount(block: EducationalContentBlock): number {
  switch (block.type) {
    case "paragraph": return semanticTextUnits(block.text).length;
    case "keyIdea": return semanticTextUnits(block.text).length;
    case "bulletList": return block.items.length;
    case "orderedSteps": return block.items.length;
    case "workedExample": return 2 + block.steps.length;
    case "diagram": return block.nodes.length + block.connections.length;
    case "comparison": return block.criteria.length + block.items.length;
    case "task": return block.instructions.length + (block.materials?.length ?? 0);
    case "question": return 1 + (block.options?.length ?? 0);
    case "reflection": return block.prompts.length + (block.sentenceStarters?.length ?? 0);
  }
}

const PURPOSE_PREFERENCE: Readonly<Record<string, EducationalCompositionId>> = {
  opening: "concept-focus",
  context: "concept-focus",
  "learning-objectives": "objective-checklist",
  "learning-outcomes": "objective-checklist",
  "concept-explanation": "concept-focus",
  "worked-example": "worked-example-steps",
  diagram: "labeled-diagram",
  process: "process-flow",
  comparison: "comparison-matrix",
  "classroom-activity": "activity-brief",
  differentiation: "activity-brief",
  plenary: "retrieval-practice",
  "formative-assessment": "hinge-question",
  "success-criteria": "objective-checklist",
  "extended-task": "activity-brief",
  summary: "retrieval-practice",
  reflection: "reflection-prompt",
  connection: "concept-focus",
};

export function estimateSlideText(slide: SlideSpec): {
  characters: number;
  items: number;
  longestItem: number;
  density: "light" | "moderate" | "dense";
  score: number;
} {
  const itemTexts = slide.contentBlocks.flatMap((block) => {
    if (block.type === "paragraph" || block.type === "keyIdea") return semanticTextUnits(block.text);
    return blockText(block);
  });
  const takeawayAlreadyInContent = Boolean(slide.centralTakeaway && itemTexts.some((item) => item.trim() === slide.centralTakeaway!.trim()));
  const characters = itemTexts.reduce((sum, item) => sum + item.length, 0) + (takeawayAlreadyInContent ? 0 : (slide.centralTakeaway?.length ?? 0));
  const items = slide.contentBlocks.reduce((sum, block) => sum + blockItemCount(block), 0);
  const longestItem = itemTexts.reduce((longest, item) => Math.max(longest, item.length), 0);
  const score = characters / 190 + items * 0.45 + longestItem / 260;
  return {
    characters,
    items,
    longestItem,
    score,
    density: score < 8 ? "light" : score < 15 ? "moderate" : "dense",
  };
}

function gradeBand(grade: string): "early" | "primary" | "secondary" | "senior" {
  const match = grade.match(/\d{1,2}/);
  const number = match ? Number(match[0]) : null;
  if (number === null) return "secondary";
  if (number <= 3) return "early";
  if (number <= 6) return "primary";
  if (number <= 9) return "secondary";
  return "senior";
}

function variantFor(id: EducationalCompositionId, slide: SlideSpec, imageAvailable: boolean): string {
  const blocks = slide.contentBlocks;
  switch (id) {
    case "concept-focus": return imageAvailable ? "image-right" : "text-only";
    case "definition-and-example": return blocks.some((block) => block.type === "workedExample") ? "example-led" : "paired-definition-example";
    case "worked-example-steps": return blocks.some((block) => block.type === "workedExample") ? "equation-led" : "vertical-reasoning";
    case "labeled-diagram": {
      const diagram = blocks.find((block) => block.type === "diagram");
      if (diagram?.type === "diagram" && diagram.connections.length >= diagram.nodes.length - 1) return "sequence";
      return "cause-and-effect";
    }
    case "process-flow": {
      const ordered = blocks.find((block) => block.type === "orderedSteps");
      const task = blocks.find((block) => block.type === "task");
      const count = ordered?.type === "orderedSteps" ? ordered.items.length : task?.type === "task" ? task.instructions.length : 0;
      return count > 4 ? "two-row-sequence" : "horizontal-four-step";
    }
    case "comparison-matrix": {
      const comparison = blocks.find((block) => block.type === "comparison");
      return comparison?.type === "comparison" && comparison.items.length > 2 ? "three-way-comparison" : "two-item-contrast";
    }
    case "objective-checklist": return slide.pedagogicalPurpose === "success-criteria" ? "self-check" : "learning-targets";
    case "activity-brief": return slide.contentBlocks.some((block) => block.type === "task") ? "task-with-logistics" : "collaborative-challenge";
    case "hinge-question": return slide.contentBlocks.some((block) => block.type === "question" && Boolean(block.options?.length)) ? "multiple-choice" : "think-and-vote";
    case "retrieval-practice": return slide.pedagogicalPurpose === "summary" ? "summary-and-check" : "three-recall-cues";
    case "reflection-prompt": return slide.contentBlocks.some((block) => block.type === "reflection" && Boolean(block.sentenceStarters?.length)) ? "sentence-starters" : "single-deep-question";
    case "summary-map": return "radial-summary";
  }
}

function scoreComposition(
  slide: SlideSpec,
  id: EducationalCompositionId,
  options: { grade: string; imageAvailable: boolean; previous?: EducationalCompositionId; requested?: EducationalCompositionId },
): { score: number; rationale: string[]; density: "light" | "moderate" | "dense"; characters: number } | null {
  const definition = SLIDE_COMPOSITION_REGISTRY[id];
  const blockTypes = new Set(slide.contentBlocks.map((block) => block.type));
  if (slide.layoutIntent.image === "required" && id !== "concept-focus" && id !== "activity-brief") return null;
  if ([...blockTypes].some((type) => !definition.supportedBlocks.includes(type))) return null;
  if (id === "comparison-matrix" && !blockTypes.has("comparison")) return null;
  if (id === "labeled-diagram" && !blockTypes.has("diagram")) return null;
  const density = estimateSlideText(slide);
  const rationale: string[] = [];
  let score = 0;
  const preferred = blockTypes.has("diagram") && slide.pedagogicalPurpose === "summary"
    ? "summary-map"
    : blockTypes.has("diagram")
      ? "labeled-diagram"
      : blockTypes.has("comparison")
        ? "comparison-matrix"
        : blockTypes.has("workedExample")
          ? "worked-example-steps"
          : blockTypes.has("task") && slide.pedagogicalPurpose !== "process"
            ? "activity-brief"
            : blockTypes.has("question") && slide.pedagogicalPurpose === "formative-assessment"
              ? "hinge-question"
              : blockTypes.has("question") && slide.pedagogicalPurpose === "plenary"
                ? "retrieval-practice"
                : blockTypes.has("reflection")
                  ? "reflection-prompt"
                  : slide.pedagogicalPurpose === "diagram" && !blockTypes.has("diagram")
                    ? "concept-focus"
                    : PURPOSE_PREFERENCE[slide.pedagogicalPurpose];
  if (preferred === id) { score += 40; rationale.push("matches the slide's primary teaching purpose"); }
  else if (definition.supportedPurposes.includes(slide.pedagogicalPurpose)) { score += 12; rationale.push("supports the slide's teaching purpose"); }
  if (options.requested === id) { score += 60; rationale.push("honors a compatible composition hint"); }

  const specialized = [...blockTypes].filter((type) => !["paragraph", "keyIdea", "bulletList"].includes(type));
  if (specialized.length > 0) {
    score += specialized.every((type) => definition.supportedBlocks.includes(type)) ? 26 : 0;
    rationale.push(`supports structured ${specialized.join(" and ")} content`);
  }
  if (density.characters <= definition.density.maxCharacters) {
    score += 12;
  } else {
    score -= 18 + Math.ceil((density.characters - definition.density.maxCharacters) / 200) * 6;
    rationale.push("will use semantic continuation for dense content");
  }
  if (density.items > definition.density.maxItems) score -= (density.items - definition.density.maxItems) * 2;
  const band = gradeBand(options.grade);
  if ((band === "early" || band === "primary") && definition.density.preferred === "light") score += 4;
  if ((band === "secondary" || band === "senior") && definition.density.preferred !== "light") score += 3;
  if (options.imageAvailable && definition.imagePolicy === "optional") score += 3;
  if (!options.imageAvailable && definition.imagePolicy === "avoid") score += 2;
  if (options.previous === id) { score -= 14; rationale.push("adjacent-slide repetition penalty applied"); }
  return { score, rationale, density: density.density, characters: density.characters };
}

export function selectCompositionForSlide(
  slide: SlideSpec,
  options: { grade: string; imageAvailable?: boolean; previous?: EducationalCompositionId; rtl?: boolean } = { grade: "" },
): CompositionSelection | { error: { code: string; message: string } } {
  const allIds = Object.keys(SLIDE_COMPOSITION_REGISTRY) as EducationalCompositionId[];
  const imageAvailable = options.imageAvailable ?? (Boolean(slide.image?.url) && slide.layoutIntent.image !== "avoid");
  if (slide.layoutIntent.image === "required" && !imageAvailable) {
    return { error: { code: "required_image_unavailable", message: `Slide "${slide.title}" requires an image, but no rendered image URL is available.` } };
  }
  const requested = slide.composition;
  let compatible = allIds
    .map((id) => ({ id, result: scoreComposition(slide, id, { ...options, imageAvailable, requested }) }))
    .filter((item): item is { id: EducationalCompositionId; result: NonNullable<ReturnType<typeof scoreComposition>> } => Boolean(item.result));

  if (compatible.length === 0) {
    if (slide.layoutIntent.image === "required") {
      return { error: {
        code: "required_image_unsupported",
        message: `Slide "${slide.title}" requires an image, but no compatible educational composition can display an image with all of its content blocks.`,
      } };
    }
    return { error: {
      code: "no_compatible_composition",
      message: `No registered educational composition can represent all blocks on slide "${slide.title}" (${slide.contentBlocks.map((block) => block.type).join(", ")}).`,
    } };
  }

  const metrics = estimateSlideText(slide);
  const fitsWithoutPagination = compatible.filter(({ id }) => {
    const capacity = SLIDE_COMPOSITION_REGISTRY[id].density;
    return metrics.characters <= capacity.maxCharacters && metrics.items <= capacity.maxItems;
  });
  if (fitsWithoutPagination.length > 0) compatible = fitsWithoutPagination;

  // A compatible requested layout is tried first. Its declared fallbacks are considered next,
  // and all other compatible definitions remain available if those fallbacks are too dense.
  const fallbackOrder = requested ? [requested, ...SLIDE_COMPOSITION_REGISTRY[requested].fallbacks] : [];
  compatible.sort((left, right) => {
    const leftFallback = fallbackOrder.indexOf(left.id);
    const rightFallback = fallbackOrder.indexOf(right.id);
    const leftScore = left.result.score + (leftFallback > 0 ? 10 - leftFallback : 0);
    const rightScore = right.result.score + (rightFallback > 0 ? 10 - rightFallback : 0);
    return rightScore - leftScore || left.id.localeCompare(right.id);
  });
  const selected = compatible[0]!;
  const usedFallback = Boolean(requested && requested !== selected.id);
  if (usedFallback) selected.result.rationale.push(`incompatible or less suitable hint fell back to ${selected.id}`);
  if (options.rtl) selected.result.rationale.push("geometry and text alignment will mirror for RTL");
  return {
    slideId: slide.id,
    composition: selected.id,
    variant: variantFor(selected.id, slide, imageAvailable),
    density: selected.result.density,
    estimatedCharacters: selected.result.characters,
    usedFallback,
    rationale: selected.result.rationale,
  };
}

export function selectDeckCompositions(deckValue: unknown): LayoutEngineResult {
  const validation = parseDeckSpec(deckValue);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues.map((issue) => ({ slideId: issue.path, code: issue.code, message: issue.message })) };
  }
  const deck = validation.value;
  const selections: CompositionSelection[] = [];
  const slides: SlideSpec[] = [];
  let previous: EducationalCompositionId | undefined;
  for (const slide of deck.slides) {
    const selection = selectCompositionForSlide(slide, { grade: deck.grade, imageAvailable: Boolean(slide.image?.url) && slide.layoutIntent.image !== "avoid", previous, rtl: deck.textDirection === "rtl" });
    if ("error" in selection) return { ok: false, issues: [{ slideId: slide.id, ...selection.error }] };
    selections.push(selection);
    slides.push({ ...slide, composition: selection.composition, compositionVariant: selection.variant });
    previous = selection.composition;
  }
  const selectedDeck: DeckSpec = { ...deck, schemaVersion: DECK_SCHEMA_VERSION, slides };
  const selectedValidation = parseDeckSpec(selectedDeck);
  if (!selectedValidation.ok) {
    return { ok: false, issues: selectedValidation.issues.map((issue) => ({ slideId: issue.path, code: issue.code, message: issue.message })) };
  }
  return { ok: true, deck: selectedValidation.value, selections };
}

function splitTextPreservingCharacters(text: string, maximum: number): string[] {
  if (text.length <= maximum) return [text];
  const words = text.match(/\s*\S+\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > maximum) {
      if (current) chunks.push(current);
      current = "";
      for (let index = 0; index < word.length; index += maximum) chunks.push(word.slice(index, index + maximum));
      continue;
    }
    if (current.length + word.length > maximum && current) {
      chunks.push(current);
      current = word;
    } else current += word;
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitParagraphSemantically(text: string, maximum: number): string[] {
  return semanticTextUnits(text).flatMap((unit) => splitTextPreservingCharacters(unit, maximum));
}

function splitBlock(block: EducationalContentBlock, maximum: number): EducationalContentBlock[] | null {
  switch (block.type) {
    case "paragraph":
      return splitParagraphSemantically(block.text, maximum).map((text) => ({ type: "paragraph", text }));
    case "keyIdea":
      return splitParagraphSemantically(block.text, maximum).map((text, index) => ({ type: "keyIdea", text, ...(index === 0 && block.label ? { label: block.label } : {}) }));
    case "bulletList":
      return block.items.flatMap((item) => splitTextPreservingCharacters(item, maximum).map((part) => ({ type: "bulletList" as const, items: [part] })));
    case "orderedSteps":
      return block.items.flatMap((item) => splitTextPreservingCharacters(item, maximum).map((part) => ({ type: "orderedSteps" as const, items: [part] })));
    case "task":
      return block.instructions.flatMap((item, index) => splitTextPreservingCharacters(item, maximum).map((part, partIndex) => ({
        type: "task" as const,
        instructions: [part],
        ...(index === 0 && partIndex === 0 && block.materials ? { materials: block.materials } : {}),
        ...(index === 0 && partIndex === 0 && block.timeMinutes ? { timeMinutes: block.timeMinutes } : {}),
      })));
    case "workedExample":
    case "diagram":
    case "question":
    case "reflection":
      return blockText(block).join(" ").length <= maximum ? [block] : null;
    case "comparison": {
      const rows = block.criteria.map((criterion, row) => ({
        type: "comparison" as const,
        criteria: [criterion],
        items: block.items.map((item) => ({ label: item.label, values: [item.values[row]!] })),
      }));
      return rows.every((row) => blockText(row).join(" ").length <= maximum) ? rows : null;
    }
  }
}

const STRUCTURED_BLOCK_TYPES: ReadonlySet<string> = new Set(["diagram", "workedExample", "question", "reflection", "comparison"]);

export type SlidePaginationResult =
  | { ok: true; slides: SlideSpec[] }
  | { ok: false; code: string; message: string };

function continuationId(slideId: string, part: number): string {
  const suffix = `:cont:${part}`;
  return `${slideId.slice(0, 128 - suffix.length)}${suffix}`;
}

function continuationNotes(slide: SlideSpec, part: number, rtl: boolean): string {
  // Keep the authored notes on the first page; later pages point back without duplicating them.
  if (part === 1 || !slide.speakerNotes) return slide.speakerNotes;
  return rtl
    ? "هذه الصفحة تتابع الشريحة الأصلية. راجع ملاحظات المعلم في صفحتها الأولى."
    : "This page continues the original slide. See the teacher notes on its first page.";
}

/** Splits only at sentence/item/block boundaries; unsupported oversized structures fail clearly. */
export function paginateSlideForComposition(
  slide: SlideSpec,
  rtl = false,
  maximumPages = MAX_PHYSICAL_SLIDES,
): SlidePaginationResult {
  if (!Number.isInteger(maximumPages) || maximumPages < 1) {
    return { ok: false, code: "maximum_slide_count_exceeded", message: `The deck has reached its maximum of ${MAX_PHYSICAL_SLIDES} physical slides.` };
  }
  const composition = slide.composition ?? PURPOSE_PREFERENCE[slide.pedagogicalPurpose];
  const definition = SLIDE_COMPOSITION_REGISTRY[composition];
  if (!definition) return { ok: false, code: "unknown_composition", message: `Slide "${slide.title}" has no registered composition.` };
  const takeawayAlreadyInContent = Boolean(slide.centralTakeaway && slide.contentBlocks.flatMap(blockText).some((text) => text.trim() === slide.centralTakeaway!.trim()));
  const maxCharacters = Math.max(260, definition.density.maxCharacters - (slide.centralTakeaway && !takeawayAlreadyInContent ? slide.centralTakeaway.length : 0));
  const totalCharacters = slide.contentBlocks.flatMap(blockText).reduce((sum, text) => sum + text.length, 0);
  const totalItems = slide.contentBlocks.reduce((sum, block) => sum + blockItemCount(block), 0);
  const exclusiveTypes = new Set(["diagram", "workedExample", "question"]);
  const hasRepeatedExclusiveBlock = slide.contentBlocks.some((block, index, all) =>
    exclusiveTypes.has(block.type) && all.findIndex((candidate) => candidate.type === block.type) !== index,
  );
  if (totalCharacters <= maxCharacters && totalItems <= definition.density.maxItems && !hasRepeatedExclusiveBlock) return { ok: true, slides: [slide] };

  const pieces: EducationalContentBlock[] = [];
  for (const block of slide.contentBlocks) {
    const split = splitBlock(block, maxCharacters);
    if (!split) {
      return {
        ok: false,
        code: "structured_block_exceeds_composition_capacity",
        message: `Slide "${slide.title}" contains an indivisible ${block.type} block that exceeds the selected composition's readable content budget.`,
      };
    }
    pieces.push(...split);
  }
  const pages: SlideSpec[] = [];
  let pageBlocks: EducationalContentBlock[] = [];
  let pageCharacters = 0;
  let pageItems = 0;
  const pushPage = (): boolean => {
    if (pageBlocks.length === 0) return true;
    if (pages.length >= maximumPages) return false;
    const part = pages.length + 1;
    pages.push({
      ...slide,
      id: part === 1 ? slide.id : continuationId(slide.id, part),
      title: part === 1 ? slide.title : `${slide.title} — ${rtl ? "تابع" : "Continued"}`,
      contentBlocks: pageBlocks,
      centralTakeaway: part === 1 ? slide.centralTakeaway : null,
      order: slide.order + pages.length,
      speakerNotes: continuationNotes(slide, part, rtl),
      image: part === 1 ? slide.image : undefined,
      afl: part === 1 ? slide.afl : undefined,
    });
    pageBlocks = [];
    pageCharacters = 0;
    pageItems = 0;
    return true;
  };
  for (const block of pieces) {
    const size = blockText(block).reduce((sum, text) => sum + text.length, 0);
    const items = blockItemCount(block);
    // Structured blocks cannot be split, so their item count is judged by the renderer's geometric fit
    // check (paginateToFit); only an unreadable character volume is rejected here.
    const itemsDivisible = !STRUCTURED_BLOCK_TYPES.has(block.type);
    if (size > maxCharacters || (itemsDivisible && items > definition.density.maxItems)) {
      return {
        ok: false,
        code: "indivisible_block_exceeds_composition_capacity",
        message: `Slide "${slide.title}" contains a structured ${block.type} block that cannot fit without losing its relationships or dropping content.`,
      };
    }
    if (pageBlocks.length > 0 && exclusiveTypes.has(block.type) && pageBlocks.some((existing) => existing.type === block.type) && !pushPage()) {
      return { ok: false, code: "maximum_slide_count_exceeded", message: `Paginating slide "${slide.title}" would exceed the maximum of ${maximumPages} physical slides.` };
    }
    if (pageCharacters > 0 && (pageCharacters + size > maxCharacters || pageItems + items > definition.density.maxItems) && !pushPage()) {
      return { ok: false, code: "maximum_slide_count_exceeded", message: `Paginating slide "${slide.title}" would exceed the maximum of ${maximumPages} physical slides.` };
    }
    pageBlocks.push(block);
    pageCharacters += size;
    pageItems += items;
  }
  if (!pushPage()) {
    return { ok: false, code: "maximum_slide_count_exceeded", message: `Paginating slide "${slide.title}" would exceed the maximum of ${maximumPages} physical slides.` };
  }
  // Comparison headings repeat on each continued matrix page so each table remains interpretable.
  return { ok: true, slides: pages };
}

function chunkCharacters(blocks: readonly EducationalContentBlock[]): number {
  return blocks.flatMap(blockText).reduce((sum, text) => sum + text.length, 0);
}

/** Splits a block list in two at a semantic boundary (item, sentence, or comparison row), or returns null. */
function halveBlocks(blocks: EducationalContentBlock[]): [EducationalContentBlock[], EducationalContentBlock[]] | null {
  const total = chunkCharacters(blocks);
  const cap = Math.max(40, Math.ceil(total / 2));
  const pieces = blocks.flatMap((block) => splitBlock(block, cap) ?? [block]);
  if (pieces.length < 2) return null;
  let cut = 1;
  let running = chunkCharacters([pieces[0]!]);
  while (cut < pieces.length - 1 && running < total / 2) {
    running += chunkCharacters([pieces[cut]!]);
    cut += 1;
  }
  return [pieces.slice(0, cut), pieces.slice(cut)];
}

/**
 * Pagination by actual fit. `fit` renders a candidate page and returns the composition that holds it
 * (the slide's own, else a compatible registry fallback) or null. Pages that fit nowhere are split at
 * semantic boundaries and retried; content is never dropped or shrunk below the minimum font.
 */
export function paginateToFit(
  slide: SlideSpec,
  rtl: boolean,
  fit: (page: SlideSpec, hasImage: boolean) => EducationalCompositionId | null,
  lastFitError: () => string,
  maximumPages = MAX_PHYSICAL_SLIDES,
): SlidePaginationResult {
  const base = paginateSlideForComposition(slide, rtl, maximumPages);
  if (!base.ok) return base;
  type Group = { blocks: EducationalContentBlock[]; composition: EducationalCompositionId };
  let completedPages = 0;
  let pageLimitExceeded = false;
  const settle = (template: SlideSpec, blocks: EducationalContentBlock[], takeaway: string | null, hasImage: boolean): Group[] => {
    const composition = fit({ ...template, contentBlocks: blocks, centralTakeaway: takeaway }, hasImage);
    if (composition) {
      if (completedPages >= maximumPages) {
        pageLimitExceeded = true;
        throw new Error(`Paginating slide "${slide.title}" would exceed the maximum of ${maximumPages} physical slides.`);
      }
      completedPages += 1;
      return [{ blocks, composition }];
    }
    const halves = halveBlocks(blocks);
    if (!halves) throw new Error(`Slide "${slide.title}" cannot be composed legibly: ${lastFitError()}`);
    return [...settle(template, halves[0], takeaway, hasImage), ...settle(template, halves[1], null, false)];
  };
  let groups: Group[];
  try {
    groups = base.slides.flatMap((page, index) => settle(page, page.contentBlocks, page.centralTakeaway, index === 0 && Boolean(slide.image?.url)));
  } catch (error) {
    return {
      ok: false,
      code: pageLimitExceeded ? "maximum_slide_count_exceeded" : "no_fitting_composition",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (groups.length === 1 && groups[0]!.composition === (slide.composition ?? PURPOSE_PREFERENCE[slide.pedagogicalPurpose]) && base.slides.length === 1) {
    return { ok: true, slides: base.slides };
  }
  return {
    ok: true,
    slides: groups.map((group, index) => {
      const part = index + 1;
      return {
        ...slide,
        id: part === 1 ? slide.id : continuationId(slide.id, part),
        title: part === 1 ? slide.title : `${slide.title} — ${rtl ? "تابع" : "Continued"}`,
        contentBlocks: group.blocks,
        centralTakeaway: part === 1 ? slide.centralTakeaway : null,
        composition: group.composition,
        compositionVariant: group.composition === slide.composition ? slide.compositionVariant : undefined,
        order: slide.order + index,
        speakerNotes: continuationNotes(slide, part, rtl),
        image: part === 1 ? slide.image : undefined,
        afl: part === 1 ? slide.afl : undefined,
      };
    }),
  };
}
