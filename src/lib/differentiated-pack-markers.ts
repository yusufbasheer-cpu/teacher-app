/** Plain-text markers for DeepSeek output (one block per deliverable). */

export const DIFF_PACK_KEYS = [
  "foundation",
  "core",
  "extension",
  "answerKey",
  "rubrics",
  "teacherNotes",
  "selfAssessment",
  "peerAssessment",
] as const;

export type DifferentiatedPackKey = (typeof DIFF_PACK_KEYS)[number];

export const DIFF_PACK_MARKERS: Record<
  DifferentiatedPackKey,
  readonly [start: string, end: string]
> = {
  foundation: ["START FOUNDATION WORKSHEET", "END FOUNDATION WORKSHEET"],
  core: ["START CORE WORKSHEET", "END CORE WORKSHEET"],
  extension: ["START EXTENSION WORKSHEET", "END EXTENSION WORKSHEET"],
  answerKey: ["START ANSWER KEY", "END ANSWER KEY"],
  rubrics: ["START MARKING RUBRICS", "END MARKING RUBRICS"],
  teacherNotes: ["START TEACHER NOTES", "END TEACHER NOTES"],
  selfAssessment: ["START SELF ASSESSMENT CHECKLIST", "END SELF ASSESSMENT CHECKLIST"],
  peerAssessment: ["START PEER ASSESSMENT SHEET", "END PEER ASSESSMENT SHEET"],
} as const;

export type DifferentiatedPackContent = Record<DifferentiatedPackKey, string>;

export function emptyDifferentiatedPack(): DifferentiatedPackContent {
  return {
    foundation: "",
    core: "",
    extension: "",
    answerKey: "",
    rubrics: "",
    teacherNotes: "",
    selfAssessment: "",
    peerAssessment: "",
  };
}
