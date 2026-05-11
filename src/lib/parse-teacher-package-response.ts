import {
  TEACHER_PACKAGE_BLOCK_MARKERS,
  TEACHER_PACKAGE_SECTIONS,
  type LessonPlanResult,
  type TeacherPackageSectionKey,
} from "@/lib/lesson-plan";

export type ParseTeacherPackageMode =
  | "labeled"
  | "json"
  | "merged"
  | "raw-fallback";

export type ParseTeacherPackageResult = {
  plan: LessonPlanResult;
  mode: ParseTeacherPackageMode;
  /** Soft message for the UI when parsing was lossy. */
  parseNotice?: string;
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function allStartMarkers(): string[] {
  return TEACHER_PACKAGE_SECTIONS.map((k) => TEACHER_PACKAGE_BLOCK_MARKERS[k][0]);
}

/**
 * Extract text between labeled markers; tolerates optional ** / spaces around markers.
 * If END is missing, trims at the next known START line or end of string.
 */
function extractLabeledSection(
  text: string,
  startMarker: string,
  endMarker: string,
): string | null {
  const starts = allStartMarkers().filter((s) => s !== startMarker);
  const sEsc = escapeRe(startMarker);
  const eEsc = escapeRe(endMarker);

  const patterns: RegExp[] = [
    new RegExp(
      `(?:^|[\\r\\n])\\s*\\*{0,2}\\s*${sEsc}\\s*\\*{0,2}\\s*(?::)?\\s*[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+\\s*\\*{0,2}\\s*${eEsc}\\s*\\*{0,2})`,
      "im",
    ),
    new RegExp(`${sEsc}\\s*[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+\\s*${eEsc})`, "im"),
  ];

  for (const re of patterns) {
    const m = text.match(re);
    const inner = m?.[1]?.trim();
    if (inner) return inner;
  }

  const lower = text.toLowerCase();
  const si = lower.indexOf(startMarker.toLowerCase());
  if (si === -1) return null;
  let rest = text.slice(si + startMarker.length).replace(/^\s*\r?\n?/, "");
  const ei = rest.toLowerCase().indexOf(endMarker.toLowerCase());
  if (ei !== -1) {
    const chunk = rest.slice(0, ei).trim();
    return chunk || null;
  }
  let cut = rest.length;
  for (const os of starts) {
    const ni = rest.toLowerCase().indexOf(os.toLowerCase());
    if (ni !== -1 && ni < cut) cut = ni;
  }
  const open = rest.slice(0, cut).trim();
  return open || null;
}

function parseLabeledBlocks(
  text: string,
  sections: readonly TeacherPackageSectionKey[],
): Partial<Record<TeacherPackageSectionKey, string>> {
  const out: Partial<Record<TeacherPackageSectionKey, string>> = {};
  for (const key of sections) {
    const [start, end] = TEACHER_PACKAGE_BLOCK_MARKERS[key];
    const v = extractLabeledSection(text, start, end);
    if (v && v.length > 0) out[key] = v;
  }
  return out;
}

function extractJsonObject(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

function parseJsonPlan(
  content: string,
  sections: readonly TeacherPackageSectionKey[],
): Partial<Record<TeacherPackageSectionKey, string>> {
  const jsonCandidate = extractJsonObject(content);
  if (!jsonCandidate) return {};

  const mergeFromParsed = (parsed: Record<string, unknown>) => {
    const out: Partial<Record<TeacherPackageSectionKey, string>> = {};
    for (const section of sections) {
      const value = parsed[section];
      if (typeof value === "string" && value.trim()) {
        out[section] = value.trim();
        continue;
      }
      if (value === null || value === undefined) continue;
      try {
        const asJson = JSON.stringify(value, null, 2);
        if (asJson?.trim()) out[section] = asJson;
      } catch {
        const asText = String(value);
        if (asText.trim()) out[section] = asText.trim();
      }
    }
    return out;
  };

  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
    return mergeFromParsed(parsed);
  } catch {
    try {
      const out: Partial<Record<TeacherPackageSectionKey, string>> = {};
      for (const section of sections) {
        const escapedKey = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`\"${escapedKey}\"\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\")`);
        const m = jsonCandidate.match(re);
        const rawStringLiteral = m?.[1];
        if (!rawStringLiteral) continue;
        const decoded = JSON.parse(rawStringLiteral) as unknown;
        if (typeof decoded === "string" && decoded.trim()) out[section] = decoded.trim();
      }
      return out;
    } catch {
      return {};
    }
  }
}

/** Split on lines that look like a section title (markdown heading or plain line). */
function parseHeuristicHeadings(
  text: string,
  sections: readonly TeacherPackageSectionKey[],
): Partial<Record<TeacherPackageSectionKey, string>> {
  const out: Partial<Record<TeacherPackageSectionKey, string>> = {};
  const positions: { key: TeacherPackageSectionKey; index: number }[] = [];

  for (const key of TEACHER_PACKAGE_SECTIONS) {
    if (!sections.includes(key)) continue;
    const kEsc = escapeRe(key);
    const patterns = [
      new RegExp(`(?:^|[\\r\\n])\\s*#{1,4}\\s*${kEsc}\\s*(?:[\\r\\n]|$)`, "im"),
      new RegExp(`(?:^|[\\r\\n])\\s*\\*\\*\\s*${kEsc}\\s*\\*\\*\\s*(?:[\\r\\n]|$)`, "im"),
      new RegExp(`(?:^|[\\r\\n])\\s*${kEsc}\\s*(?:[\\r\\n]|:)\\s*`, "im"),
    ];
    for (const re of patterns) {
      const m = re.exec(text);
      if (m && m.index !== undefined) {
        positions.push({ key, index: m.index });
        break;
      }
    }
  }

  positions.sort((a, b) => a.index - b.index);
  const seen = new Set<TeacherPackageSectionKey>();
  const unique = positions.filter((p) => {
    if (seen.has(p.key)) return false;
    seen.add(p.key);
    return true;
  });

  for (let i = 0; i < unique.length; i++) {
    const cur = unique[i]!;
    const next = unique[i + 1];
    const slice = text.slice(cur.index, next ? next.index : text.length);
    const cleaned = slice.replace(/^[^\n]+\n/, "").trim();
    if (cleaned) out[cur.key] = cleaned;
  }

  return out;
}

function mergePartials(
  sections: readonly TeacherPackageSectionKey[],
  ...layers: Partial<Record<TeacherPackageSectionKey, string>>[]
): LessonPlanResult {
  const out: LessonPlanResult = {};
  for (const key of sections) {
    let v = "";
    for (const layer of layers) {
      const t = layer[key];
      if (typeof t === "string" && t.trim()) {
        v = t.trim();
        break;
      }
    }
    out[key] = v;
  }
  return out;
}

function countFilled(plan: LessonPlanResult, sections: readonly TeacherPackageSectionKey[]): number {
  return sections.filter((k) => plan[k]?.trim()).length;
}

const RAW_FALLBACK_INTRO =
  "The AI response could not be split into separate sections automatically. Below is the full raw output so you can still copy or edit it.\n\n---\n\n";

function stripOuterMarkdownFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s
      .replace(/^```[a-zA-Z0-9_-]*\s*\r?\n?/, "")
      .replace(/\r?\n```[\t ]*$/m, "");
  }
  return s.trim();
}

export function parseTeacherPackageResponse(
  raw: string,
  sections: readonly TeacherPackageSectionKey[],
): ParseTeacherPackageResult {
  const trimmed = stripOuterMarkdownFences(raw?.trim() ?? "");
  if (!trimmed) {
    const first = sections[0] ?? "Full Lesson Plan";
    return {
      plan: { [first]: "(Empty response from the model.)" } as LessonPlanResult,
      mode: "raw-fallback",
      parseNotice: "The model returned an empty message.",
    };
  }

  const labeled = parseLabeledBlocks(trimmed, sections);
  const json = parseJsonPlan(trimmed, sections);

  const labeledOnly = mergePartials(sections, labeled);
  if (countFilled(labeledOnly, sections) === sections.length) {
    return { plan: labeledOnly, mode: "labeled" };
  }

  const jsonOnly = mergePartials(sections, json);
  if (countFilled(jsonOnly, sections) === sections.length) {
    return { plan: jsonOnly, mode: "json" };
  }

  const mergedLabeledJson = mergePartials(sections, labeled, json);
  if (countFilled(mergedLabeledJson, sections) === sections.length) {
    return {
      plan: mergedLabeledJson,
      mode: "merged",
      parseNotice:
        "Some sections were recovered by combining labeled blocks with JSON-style parsing.",
    };
  }

  const heuristic = parseHeuristicHeadings(trimmed, sections);
  const triple = mergePartials(sections, labeled, json, heuristic);
  if (countFilled(triple, sections) > 0) {
    const notice =
      countFilled(triple, sections) < sections.length
        ? "Some requested sections could not be detected; those tabs may be empty. You can regenerate or copy from the filled sections."
        : "The response was recovered using flexible parsing (markers, JSON, or headings).";
    return {
      plan: triple,
      mode: "merged",
      parseNotice: notice,
    };
  }

  const firstKey = sections[0] ?? "Full Lesson Plan";
  const plan: LessonPlanResult = {};
  for (const k of sections) {
    plan[k] = k === firstKey ? `${RAW_FALLBACK_INTRO}${trimmed}` : "";
  }
  return {
    plan,
    mode: "raw-fallback",
    parseNotice:
      "Could not match labeled blocks or JSON. Showing the full model response in the first section.",
  };
}
