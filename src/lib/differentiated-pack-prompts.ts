/** System + user prompts for differentiated worksheet pack (DeepSeek). */

export type DifferentiatedLevel = "foundation" | "core" | "extension";

function levelLabel(level: DifferentiatedLevel): string {
  if (level === "foundation") return "Foundation";
  if (level === "core") return "Core";
  return "Extension";
}

function worksheetStartMarker(level: DifferentiatedLevel): string {
  if (level === "foundation") return "START FOUNDATION WORKSHEET";
  if (level === "core") return "START CORE WORKSHEET";
  return "START EXTENSION WORKSHEET";
}

function worksheetEndMarker(level: DifferentiatedLevel): string {
  if (level === "foundation") return "END FOUNDATION WORKSHEET";
  if (level === "core") return "END CORE WORKSHEET";
  return "END EXTENSION WORKSHEET";
}

function levelRules(level: DifferentiatedLevel): string {
  if (level === "foundation") {
    return "Simple vocabulary/language, include word bank, fill-in-the-blanks, match-the-following, picture-based questions where relevant, step-by-step instructions, SEN/ELL accommodations, Arabic vocabulary support, UAE real-life examples, and maximum 8 questions.";
  }
  if (level === "core") {
    return "Mix question types, include short answer, true/false with explanation, diagram labeling where relevant, real-life application, light scaffolding, and maximum 8 questions.";
  }
  return "Use HOTS analytical/evaluative and creative open-ended tasks, research/problem-solving, no word bank, no scaffolding, UAE and global connections, and maximum 8 questions.";
}

export function buildDiffPackLevelSystemPrompt(level: DifferentiatedLevel): string {
  const worksheetStart = worksheetStartMarker(level);
  const worksheetEnd = worksheetEndMarker(level);
  const label = levelLabel(level);

  return `You are an expert UAE-aligned classroom teacher and assessment designer.

Generate ONLY the ${label} level pack and concise teacher resources.

CRITICAL OUTPUT RULES:
- Output PLAIN TEXT only (no JSON and no markdown code fences).
- Use ONLY these markers and include each exactly once:
${worksheetStart}
${worksheetEnd}
START ANSWER KEY
END ANSWER KEY
START MARKING RUBRICS
END MARKING RUBRICS
START TEACHER NOTES
END TEACHER NOTES
START SELF ASSESSMENT CHECKLIST
END SELF ASSESSMENT CHECKLIST
START PEER ASSESSMENT SHEET
END PEER ASSESSMENT SHEET
- Do NOT output other worksheet markers.
- Worksheet must start with: "Curriculum alignment: UAE MOE / KHDA expectations — [subject], [grade] — differentiated task."
- Keep content short and classroom-ready.
- ${levelRules(level)}

Be specific, practical, and ready to print.`.trim();
}

const MAX_SOURCE_CHARS = 24_000;

export function buildDiffPackUserMessage(params: {
  level: DifferentiatedLevel;
  topic: string;
  subject: string;
  grade: string;
  learningObjectives: string;
  curriculumType?: string;
  curriculumFramework?: string;
  lessonSourceText: string;
}): string {
  const src = params.lessonSourceText.trim().slice(0, MAX_SOURCE_CHARS);
  const fw = params.curriculumFramework?.trim();
  const ct = params.curriculumType?.trim();
  const label = levelLabel(params.level);
  return `
### Class context
- Requested level: ${label}
- Topic: ${params.topic.trim()}
- Subject: ${params.subject.trim()}
- Grade / year: ${params.grade.trim()}
- Learning objectives: ${params.learningObjectives.trim()}
${ct ? `- Curriculum type: ${ct}` : ""}
${fw ? `- Curriculum framework: ${fw}` : ""}

### Lesson source (use as the basis for all differentiated materials)
${src}

Generate only the requested level and its teacher resources, following the marker format exactly.
`.trim();
}
