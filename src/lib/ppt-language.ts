/**
 * Presentation language — the single source of truth for "is this deck Arabic?".
 *
 * Before this module, Arabic was inferred in a dozen places from
 * `usesArabicPptSlideTitles(subject)`, i.e. literally `subject === "Arabic"`. That made an
 * Arabic-medium Science lesson impossible to express, and left every static template string
 * in the renderer hardcoded in English. Language is now an explicit field on the lesson-plan
 * input, threaded through generation, deck building, and rendering.
 *
 * Backwards compatibility: lessons saved before this field existed have no `language`, so
 * `resolvePresentationLanguage` falls back to the old subject-derived behaviour. An English
 * deck therefore renders exactly as it did.
 */

import { usesArabicPptSlideTitles } from "@/lib/lesson-plan";

export const PRESENTATION_LANGUAGES = ["en", "ar"] as const;
export type PresentationLanguage = (typeof PRESENTATION_LANGUAGES)[number];

export const DEFAULT_PRESENTATION_LANGUAGE: PresentationLanguage = "en";

/** Dropdown labels for the lesson-plan form. */
export const PRESENTATION_LANGUAGE_LABELS: Record<PresentationLanguage, string> = {
  en: "English",
  ar: "العربية (Arabic)",
};

export function isPresentationLanguage(value: unknown): value is PresentationLanguage {
  return typeof value === "string" && (PRESENTATION_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Resolves the deck language.
 *
 * An explicit, valid teacher selection always wins — that is the whole point of the field, and
 * silently overriding it would reproduce the class of bug this change exists to fix. Only when
 * no valid selection is present do we fall back to inferring from the subject, which preserves
 * the pre-existing behaviour for saved lessons and for any caller not yet passing a language.
 */
export function resolvePresentationLanguage(params: {
  language?: unknown;
  subject?: string | null;
}): PresentationLanguage {
  if (isPresentationLanguage(params.language)) return params.language;
  if (usesArabicPptSlideTitles(params.subject?.trim() ?? "")) return "ar";
  return DEFAULT_PRESENTATION_LANGUAGE;
}

/** The language a *newly opened* form should default to for a given subject. */
export function defaultLanguageForSubject(subject: string | null | undefined): PresentationLanguage {
  return usesArabicPptSlideTitles(subject?.trim() ?? "") ? "ar" : "en";
}

export function isRtlLanguage(language: PresentationLanguage): boolean {
  return language === "ar";
}

/** BCP-47 tag used for date formatting and for pptxgenjs's run-level `lang`. */
export function localeTagFor(language: PresentationLanguage): string {
  return language === "ar" ? "ar-AE" : "en-GB";
}

/**
 * Every static, user-visible string the PPT layer inserts itself (as opposed to text the AI
 * generated or the teacher typed). Keeping them in one table is what makes "no English leakage
 * on an Arabic deck" a property we can actually test, rather than a promise.
 */
type PptStringKey =
  | "chipWarmUp"
  | "chipDifferentiatedTasks"
  | "chipReflectShare"
  | "chipTakeItFurther"
  | "chipKeyConcepts"
  | "continued"
  | "continuationNote"
  | "noContentProvided"
  | "objectivesNotProvided"
  | "altTitleIllustration"
  | "altSlideIllustration"
  | "altSchoolLogo"
  | "deckTitlePrefix"
  | "slide7Higher"
  | "slide7Middle"
  | "slide7Lower"
  | "slide7MiniPlenary"
  | "aflSelectedHeading"
  | "suggestedTiming"
  | "teacherFocus";

export const PPT_STRINGS: Record<PresentationLanguage, Record<PptStringKey, string>> = {
  en: {
    chipWarmUp: "Warm-Up",
    chipDifferentiatedTasks: "Differentiated Tasks",
    chipReflectShare: "Reflect & Share",
    chipTakeItFurther: "Take It Further",
    chipKeyConcepts: "Key Concepts",
    continued: "CONTINUED",
    continuationNote: "(Continuation slide — same section.)",
    noContentProvided: "(No content provided)",
    objectivesNotProvided: "(Learning objectives not provided)",
    altTitleIllustration: "Title slide illustration",
    altSlideIllustration: "AI-generated illustration",
    altSchoolLogo: "School logo",
    deckTitlePrefix: "Slides",
    slide7Higher: "Higher Achievers task",
    slide7Middle: "Middle Achievers task",
    slide7Lower: "Lower Achievers task",
    slide7MiniPlenary: "Mini Plenary",
    aflSelectedHeading: "Selected AFL for this part of the lesson",
    suggestedTiming: "Suggested timing",
    teacherFocus: "Teacher focus",
  },
  ar: {
    chipWarmUp: "التمهيد",
    chipDifferentiatedTasks: "مهام متمايزة",
    chipReflectShare: "التأمل والمشاركة",
    chipTakeItFurther: "توسّع أكثر",
    chipKeyConcepts: "المفاهيم الأساسية",
    continued: "تابع",
    continuationNote: "(شريحة تابعة — القسم نفسه.)",
    noContentProvided: "(لا يوجد محتوى)",
    objectivesNotProvided: "(لم تُدخل الأهداف التعليمية)",
    altTitleIllustration: "رسم توضيحي لشريحة العنوان",
    altSlideIllustration: "رسم توضيحي منشأ بالذكاء الاصطناعي",
    altSchoolLogo: "شعار المدرسة",
    deckTitlePrefix: "شرائح",
    slide7Higher: "مهمة للمتفوقين",
    slide7Middle: "مهمة للمستوى المتوسط",
    slide7Lower: "مهمة للمستوى الأساسي",
    slide7MiniPlenary: "تلخيص مصغر",
    aflSelectedHeading: "أداة التقويم المختارة لهذا الجزء من الدرس",
    suggestedTiming: "التوقيت المقترح",
    teacherFocus: "تركيز المعلم",
  },
};

export function pptString(language: PresentationLanguage, key: PptStringKey): string {
  return PPT_STRINGS[language][key];
}

/**
 * Arabic-capable font stack. Calibri (the template default) has no designed Arabic face, so
 * PowerPoint substitutes unpredictably across platforms. "Dubai" ships with Office and is the
 * UAE-standard face; the theme font is kept for English so existing decks are unchanged.
 */
export const ARABIC_FONT_FACE = "Dubai";

export function fontFaceFor(language: PresentationLanguage, themeFace: string): string {
  return language === "ar" ? ARABIC_FONT_FACE : themeFace;
}
