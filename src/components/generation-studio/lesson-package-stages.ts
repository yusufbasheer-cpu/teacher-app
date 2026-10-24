import type { StudioStage } from "./generation-studio";

/**
 * Turns the signals the lesson generator really receives into Studio stages. Nothing here is time-based:
 *
 * - The server writes the selected sections one after another, in TEACHER_PACKAGE_SECTIONS order.
 * - With PPT selected it streams "Generating Slide N of 13" (slides finish in parallel, so N is a count, not which
 *   slide) and "Generating AFL Activity Sheets". Nothing else is announced.
 * - Without PPT there is no stream at all, so the whole package is one honest "writing" stage.
 * - The download files are real requests too (Word exports, the package ZIP), built once everything is written.
 * - The Gamma deck is a single request: it is in flight (maybe resumed, which is free) and then returns a verdict.
 *   Its design, export and content check happen inside that request, so only the result is shown separately.
 */
export type LessonPackageSignals = {
  /** Selected section keys, in TEACHER_PACKAGE_SECTIONS order. */
  sections: readonly string[];
  /** Latest progress message from the stream (or the generator's own status). */
  progress: string | null;
  contentReady: boolean;
  /** Present only when the teacher chose a Gamma design before generating. */
  gamma: null | {
    phase: "pending" | "designing" | "done" | "error";
    resumes: number;
    verdict?: { tone: "ok" | "warn" | "bad"; title: string } | null;
    errorMessage?: string;
  };
  /** The downloadable files being built after the content (and deck) are ready. */
  files: "pending" | "active" | "done";
};

const SLIDE_COUNT_RE = /slide\s+(\d+)\s+of\s+(\d+)/i;
const OTHER_RESOURCES = ["Worksheet", "Assessment Questions", "Homework Task", "Teacher Notes"];
const SHORT: Record<string, string> = {
  Worksheet: "worksheet",
  "Assessment Questions": "assessment questions",
  "Homework Task": "homework",
  "Teacher Notes": "teacher notes",
};

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function lessonPackageStages(s: LessonPackageSignals): StudioStage[] {
  const has = (k: string) => s.sections.includes(k);
  const streamed = has("PPT Slide Content");
  const content: StudioStage[] = [];

  if (!streamed) {
    const names = s.sections.map((k) => (k === "Full Lesson Plan" ? "lesson plan" : k === "AFL Activity Sheets" ? "AFL activity sheets" : SHORT[k] ?? k));
    content.push({
      id: "resources",
      label: "Writing your teaching resources",
      detail: s.contentReady ? `${joinNames(names)} written` : `Writing your ${joinNames(names)}`,
      status: s.contentReady ? "done" : "active",
    });
  } else {
    const slideMatch = s.progress?.match(SLIDE_COUNT_RE);
    const slidesDone = slideMatch ? Number(slideMatch[1]) : 0;
    const slidesTotal = slideMatch ? Number(slideMatch[2]) : 13;
    const afl = /afl/i.test(s.progress ?? "");
    const others = OTHER_RESOURCES.filter(has);

    if (has("Full Lesson Plan")) content.push({ id: "lesson", label: "Writing the lesson plan", status: "pending" });
    content.push({ id: "slides", label: "Writing the slide content", status: "pending", count: { done: slidesDone, total: slidesTotal } });
    if (others.length) content.push({ id: "resources", label: `Writing the ${joinNames(others.map((k) => SHORT[k]!))}`, status: "pending" });
    if (has("AFL Activity Sheets")) content.push({ id: "afl", label: "Writing the AFL activity sheets", status: "pending" });

    // Which stage the server is on, from the latest message and the fixed section order.
    const idx = (id: string) => content.findIndex((c) => c.id === id);
    let active = 0;
    if (afl) active = idx("afl");
    else if (slideMatch) active = slidesDone >= slidesTotal ? idx("slides") + 1 : idx("slides");

    content.forEach((c, i) => {
      c.status = s.contentReady || i < active ? "done" : i === active ? "active" : "pending";
    });
    // Past the last announced stage the server is still finishing up (pictures, assembly): keep the last one active.
    if (!s.contentReady && active >= content.length) {
      const last = content[content.length - 1]!;
      last.status = "active";
      last.detail = "Finishing your package";
    }

    const slides = content[idx("slides")]!;
    if (slides.status === "active" && !slides.detail) slides.detail = `${slidesDone} of ${slidesTotal} slides written`;
    if (slides.status === "done") slides.detail = `All ${slidesTotal} slides written`;
  }

  const files: StudioStage = {
    id: "files",
    label: "Preparing your downloads",
    status: s.files,
    ...(s.files === "active" ? { detail: "Packing every file so downloads start instantly" } : {}),
  };

  if (!s.gamma) return [...content, files];

  const g = s.gamma;
  const design: StudioStage = {
    id: "design",
    label: "Designing your PowerPoint",
    status: g.phase === "pending" ? "pending" : g.phase === "designing" ? "active" : g.phase === "error" ? "error" : "done",
  };
  if (g.phase === "designing") {
    design.detail = g.resumes > 0
      ? "Still designing — longer lessons take a little more time"
      : "Gamma is laying out your slides and exporting the PowerPoint";
  } else if (g.phase === "error") {
    design.detail = g.errorMessage ?? "The slide design didn't finish";
  }

  const check: StudioStage = { id: "check", label: "Checking your lesson text on every slide", status: "pending" };
  if (g.phase === "done" && g.verdict) {
    check.status = g.verdict.tone === "ok" ? "done" : g.verdict.tone === "warn" ? "warning" : "error";
    check.detail = g.verdict.tone === "ok" ? "Your lesson wording was preserved" : g.verdict.title;
  }

  return [...content, design, check, files];
}

/**
 * The written slide text for the preview: the outline is each canonical title on its own line followed by that
 * slide's body (see assembleFullPptFromSlideBodies). Metadata trailers are dropped. A title that can't be found
 * keeps its slide text-less rather than guessing.
 */
export function slideTextFromOutline(outline: string, titles: readonly string[]): { title: string; lines: string[] }[] {
  const lines = outline.replace(/<!--[\s\S]*?-->/g, "").replace(/\r\n/g, "\n").split("\n");
  const starts = titles.map((t) => lines.findIndex((l) => l.trim() === t.trim()));
  return titles.map((title, i) => {
    const start = starts[i]!;
    if (start < 0) return { title, lines: [] };
    const next = starts.slice(i + 1).find((n) => n > start) ?? lines.length;
    const body = lines
      .slice(start + 1, next)
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").replace(/\*\*|__/g, "").trim())
      .filter(Boolean);
    return { title, lines: body.slice(0, 4) };
  });
}
