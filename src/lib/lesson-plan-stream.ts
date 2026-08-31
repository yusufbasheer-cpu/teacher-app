export type LessonPlanStreamEvent =
  | { type: "progress"; message: string }
  | { type: "complete"; [key: string]: unknown }
  | { type: "error"; message: string };

export function formatLessonPlanStreamEvent(event: Record<string, unknown>): string {
  return `${JSON.stringify(event)}\n`;
}

export function parseLessonPlanStreamLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
