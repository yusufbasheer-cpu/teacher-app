/** SessionStorage payload: lesson generator → differentiated pack page. */

export const DIFF_PACK_SESSION_KEY = "eduplan_differentiated_worksheet_pack_v1" as const;

export type DiffPackSessionPayload = {
  topic: string;
  subject: string;
  grade: string;
  learningObjectives: string;
  curriculumType?: string;
  curriculumFramework?: string;
  /** Primary text for differentiation (full lesson plan + optional worksheet). */
  lessonSourceText: string;
};

export function readDiffPackSession(): DiffPackSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DIFF_PACK_SESSION_KEY);
    if (!raw?.trim()) return null;
    const data = JSON.parse(raw) as Partial<DiffPackSessionPayload>;
    if (
      typeof data.topic === "string" &&
      typeof data.subject === "string" &&
      typeof data.grade === "string" &&
      typeof data.learningObjectives === "string" &&
      typeof data.lessonSourceText === "string"
    ) {
      return {
        topic: data.topic.trim(),
        subject: data.subject.trim(),
        grade: data.grade.trim(),
        learningObjectives: data.learningObjectives.trim(),
        curriculumType: typeof data.curriculumType === "string" ? data.curriculumType.trim() : undefined,
        curriculumFramework:
          typeof data.curriculumFramework === "string" ? data.curriculumFramework.trim() : undefined,
        lessonSourceText: data.lessonSourceText.trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeDiffPackSession(payload: DiffPackSessionPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DIFF_PACK_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota or private mode */
  }
}

export function clearDiffPackSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DIFF_PACK_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
