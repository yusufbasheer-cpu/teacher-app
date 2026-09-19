import { TEACHER_PACKAGE_SECTIONS } from "./lesson-plan";

/**
 * What a saved lesson actually contains.
 *
 * A saved lesson is not one document — it is up to seven: the plan, a slide
 * deck, a worksheet, assessment questions, homework, teacher notes and AFL
 * activity sheets. Which ones exist depends on what the teacher ticked at
 * generation time, so two lessons in the library can be very different objects.
 *
 * The library used to draw every lesson as `subject · grade · title · date`,
 * which is identical for all of them and says nothing about what is inside. The
 * information was already being fetched and thrown away — `lesson_content` is
 * selected on every row. This reads it.
 */

export type LessonArtifactId =
  | "plan"
  | "slides"
  | "worksheet"
  | "assessment"
  | "homework"
  | "notes"
  | "activities";

export type LessonArtifact = {
  id: LessonArtifactId;
  /** Short enough to sit in a row without wrapping. */
  label: string;
};

/** Section key as stored in `lesson_content` → how it is named in the UI. */
const SECTION_ARTIFACTS: Record<string, LessonArtifact> = {
  "Full Lesson Plan": { id: "plan", label: "Plan" },
  "PPT Slide Content": { id: "slides", label: "Slides" },
  Worksheet: { id: "worksheet", label: "Worksheet" },
  "Assessment Questions": { id: "assessment", label: "Assessment" },
  "Homework Task": { id: "homework", label: "Homework" },
  "Teacher Notes": { id: "notes", label: "Notes" },
  "AFL Activity Sheets": { id: "activities", label: "Activities" },
};

/**
 * A section that generated but came back essentially empty should not be
 * advertised as a document the teacher can open. A handful of characters is
 * whitespace or a stray heading marker, not content.
 */
const MIN_SECTION_CHARS = 12;

function hasRealContent(value: unknown): boolean {
  return typeof value === "string" && value.trim().length >= MIN_SECTION_CHARS;
}

/**
 * Which artifacts a saved lesson holds, in the package's own canonical order so
 * two lessons with the same contents always read the same way.
 *
 * Deliberately tolerant: `lesson_content` is a JSON string written by several
 * generations of this app, and rows predating the current shape still have to
 * render. Anything unparseable yields an empty list rather than throwing, and
 * the caller falls back to plain metadata.
 *
 * `pptContent` is the separate `saved_lessons.ppt_content` column, which some
 * older rows populated without a matching section inside the JSON.
 */
export function summarizeLessonContents(
  lessonContent: string | null | undefined,
  pptContent?: string | null,
): LessonArtifact[] {
  let parsed: Record<string, unknown> = {};

  if (typeof lessonContent === "string" && lessonContent.trim()) {
    try {
      const value: unknown = JSON.parse(lessonContent);
      // A plain object only — an array or a bare string is not a package.
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      // Legacy or truncated content: fall through to whatever ppt_content says.
    }
  }

  const found: LessonArtifact[] = [];

  // Iterate the canonical section list, not the object's own keys, so stored
  // meta keys (section images, slide image URLs) can never be mistaken for a
  // document and the order never depends on JSON key order.
  for (const section of TEACHER_PACKAGE_SECTIONS) {
    const artifact = SECTION_ARTIFACTS[section];
    if (!artifact) continue;

    const present =
      hasRealContent(parsed[section]) ||
      (artifact.id === "slides" && hasRealContent(pptContent));

    if (present) found.push(artifact);
  }

  return found;
}
