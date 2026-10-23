/**
 * Structured metadata for one independently executed activity inside logical lesson element 6.
 * The activity remains part of the 13-element lesson model; renderers expand it into an
 * instruction card followed by one or more activity-content cards.
 */
export type MainPhaseActivityInstruction = {
  activityId: string;
  activityName: string;
  activityGoal?: string;
  studentInstructions: string[];
  durationMinutes?: number;
  groupSize?: string;
  studentRole?: string;
  requiredMaterials: string[];
  expectedOutput: string;
  teacherNotes: string;
  activityContent: string;
  activityType?: string;
  parentElementId: "main-phase";
};

const DIRECT_ACTION = /^(?:you|your group|join|take|read|review|look|observe|inspect|discuss|compare|choose|write|draw|build|sort|match|move|rotate|return|teach|share|listen|record|create|prepare|present|decide|explain|test|investigate|analyse|analyze|evaluate|role-play|debate|visit|give|complete)\b/i;

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function cleanDuration(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 2 && n <= 40 ? n : undefined;
}

export function validateMainPhaseActivity(activity: MainPhaseActivityInstruction): string[] {
  const reasons: string[] = [];
  if (!activity.activityId) reasons.push("activityId is required");
  if (!activity.activityName) reasons.push("activityName is required");
  if (activity.studentInstructions.length < 4 || activity.studentInstructions.length > 6) {
    reasons.push("studentInstructions must contain 4-6 steps");
  }
  activity.studentInstructions.forEach((step, index) => {
    if (words(step) > 15) reasons.push(`step ${index + 1} exceeds 15 words`);
    if (!DIRECT_ACTION.test(step)) reasons.push(`step ${index + 1} is not directly student-facing`);
    if (/[;:]\s+\S/.test(step)) reasons.push(`step ${index + 1} contains more than one instruction`);
  });
  if (!activity.requiredMaterials.length) reasons.push("requiredMaterials is required");
  if (!activity.expectedOutput) reasons.push("expectedOutput is required");
  if (!activity.teacherNotes) reasons.push("teacherNotes is required");
  if (!activity.activityContent) reasons.push("activityContent is required");
  if (activity.parentElementId !== "main-phase") reasons.push("parentElementId must be main-phase");
  return reasons;
}

/** Strictly normalise provider/storage JSON; invalid activities never enter a deck silently. */
export function parseMainPhaseActivities(value: unknown): MainPhaseActivityInstruction[] {
  if (!Array.isArray(value)) return [];
  const parsed: MainPhaseActivityInstruction[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const activity: MainPhaseActivityInstruction = {
      activityId: cleanString(item.activityId ?? item.activity_id),
      activityName: cleanString(item.activityName ?? item.activity_name),
      activityGoal: cleanString(item.activityGoal ?? item.activity_goal) || undefined,
      studentInstructions: cleanLines(item.studentInstructions ?? item.student_instructions),
      durationMinutes: cleanDuration(item.durationMinutes ?? item.duration_minutes),
      groupSize: cleanString(item.groupSize ?? item.group_size) || undefined,
      studentRole: cleanString(item.studentRole ?? item.student_role) || undefined,
      requiredMaterials: cleanLines(item.requiredMaterials ?? item.required_materials),
      expectedOutput: cleanString(item.expectedOutput ?? item.expected_output),
      teacherNotes: cleanString(item.teacherNotes ?? item.teacher_notes),
      activityContent: typeof (item.activityContent ?? item.activity_content) === "string"
        ? String(item.activityContent ?? item.activity_content).replace(/\r\n/g, "\n").trim()
        : "",
      activityType: cleanString(item.activityType ?? item.activity_type) || undefined,
      parentElementId: "main-phase",
    };
    if (validateMainPhaseActivity(activity).length === 0) parsed.push(activity);
  }
  return parsed;
}

export function instructionSlideTitle(activity: MainPhaseActivityInstruction): string {
  return `How to do: ${activity.activityName}`;
}

/** Visible text only. Teacher guidance remains in speaker notes. */
export function instructionSlideLines(activity: MainPhaseActivityInstruction): string[] {
  const lines: string[] = [];
  if (activity.activityGoal) lines.push(`In this activity you will ${activity.activityGoal.replace(/[.]$/, "")}.`);
  activity.studentInstructions.forEach((step, index) => lines.push(`${index + 1}. ${step.replace(/^\d+[.)]\s*/, "")}`));
  const metadata = [
    activity.durationMinutes ? `Time: ${activity.durationMinutes} min` : "",
    activity.groupSize ? `Group size: ${activity.groupSize}` : "",
    activity.studentRole ? `Your role: ${activity.studentRole}` : "",
  ].filter(Boolean).join(" | ");
  if (metadata) lines.push(metadata);
  lines.push(`Materials: ${activity.requiredMaterials.join(", ")}`);
  lines.push(`You are finished when: ${activity.expectedOutput.replace(/[.]$/, "")}.`);
  return lines;
}

export function activityInstructionNotes(activity: MainPhaseActivityInstruction): string {
  return activity.teacherNotes;
}

function shortTopic(topic: string): string {
  return topic.trim().split(/\s+/).slice(0, 3).join(" ") || "this topic";
}

/** Compatibility fallback for an older/plain-text provider response after schema retries. */
export function buildFallbackMainPhaseActivity(params: {
  activityId?: string;
  activityName?: string;
  activityType?: string;
  topic: string;
  grade: string;
  activityContent: string;
  teacherNotes?: string;
}): MainPhaseActivityInstruction {
  const topic = shortTopic(params.topic);
  const activityName = params.activityName?.trim() || params.activityType?.trim() || "Collaborative Task";
  return {
    activityId: params.activityId?.trim() || `fallback-${activityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity"}`,
    activityName,
    activityGoal: `apply your learning about ${topic}`,
    studentInstructions: [
      `Join your group and read the task about ${topic}.`,
      "Choose a role and gather the listed materials.",
      "Complete each task step in the order shown.",
      "Record your evidence and your group's agreed answer.",
      "Check your work, then prepare to share it.",
    ],
    durationMinutes: 10,
    groupSize: "3-4",
    studentRole: "Active contributor",
    requiredMaterials: ["lesson task", "notebook"],
    expectedOutput: `a checked group response about ${topic}`,
    teacherNotes: params.teacherNotes?.trim() || `Prepare groups and task materials for ${activityName}. Allow about 10 minutes. Monitor participation and topic accuracy, support readers with paired prompts, signal the transition clearly, and check each group's recorded response before moving on.`,
    activityContent: params.activityContent.trim(),
    activityType: params.activityType?.trim() || "collaborative",
    parentElementId: "main-phase",
  };
}
