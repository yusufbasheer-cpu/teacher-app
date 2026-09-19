import {
  ClipboardCheck,
  FileText,
  NotebookPen,
  PenLine,
  Presentation,
  StickyNote,
  Users,
} from "lucide-react";
import type { LessonArtifact, LessonArtifactId } from "@/lib/lesson-contents";
import { cn } from "@/lib/utils";

/**
 * The contents of a saved lesson, at a glance.
 *
 * Icons rather than text labels: a lesson can hold seven documents, and seven
 * words do not fit in a library row without wrapping or truncating — at which
 * point the row stops being scannable, which was the whole point. Icons keep
 * every lesson one line tall while making two lessons with different contents
 * look different, which text metadata alone never did.
 *
 * Each icon carries its name for assistive tech and as a native tooltip, so the
 * meaning is never icon-only for someone who cannot infer it.
 */

const ARTIFACT_ICONS: Record<LessonArtifactId, typeof FileText> = {
  plan: FileText,
  slides: Presentation,
  worksheet: PenLine,
  assessment: ClipboardCheck,
  homework: NotebookPen,
  notes: StickyNote,
  activities: Users,
};

export function LessonContentsStrip({
  artifacts,
  className,
}: {
  artifacts: LessonArtifact[];
  className?: string;
}) {
  if (artifacts.length === 0) return null;

  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {artifacts.map((artifact) => {
        const Icon = ARTIFACT_ICONS[artifact.id];
        return (
          <span
            key={artifact.id}
            title={artifact.label}
            className={cn(
              "flex size-[22px] items-center justify-center rounded-[5px]",
              "bg-sunken text-muted transition-colors duration-[140ms]",
              // Lifts with the row on hover so the strip reads as part of the
              // row rather than something pinned on top of it.
              "group-hover:bg-brand-subtle group-hover:text-brand-text",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{artifact.label}</span>
          </span>
        );
      })}
    </span>
  );
}
