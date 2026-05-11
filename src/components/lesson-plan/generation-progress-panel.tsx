"use client";

export type GenLineStatus = "pending" | "running" | "done" | "error";

export type GenProgressLine = {
  key: string;
  label: string;
  status: GenLineStatus;
  /** e.g. "3 of 8" or error snippet */
  detail?: string;
};

type GenerationProgressPanelProps = {
  lines: GenProgressLine[];
};

function statusIcon(status: GenLineStatus) {
  if (status === "done") return "✅";
  if (status === "error") return "⚠️";
  if (status === "running") return "🔄";
  return "…";
}

export function GenerationProgressPanel({ lines }: GenerationProgressPanelProps) {
  return (
    <div
      className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm md:p-5"
      role="status"
      aria-live="polite"
      aria-label="Generation progress"
    >
      <h3 className="text-sm font-semibold text-slate-900">Generating your package</h3>
      <p className="mt-1 text-xs text-slate-600">
        Each part runs in parallel. Sections appear in the preview as soon as they are ready.
      </p>
      <ul className="mt-4 space-y-2.5">
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
          >
            <span className="font-medium text-slate-800">
              <span className="mr-2" aria-hidden>
                {statusIcon(line.status)}
              </span>
              {line.label}
            </span>
            <span className="text-xs text-slate-600">
              {line.status === "done"
                ? "Done"
                : line.status === "error"
                  ? line.detail ?? "Failed"
                  : line.status === "running"
                    ? line.detail ?? "Generating…"
                    : line.detail ?? "Waiting…"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
