"use client";

import { Button } from "@/components/ui/button";
import {
  TEMPLATE_MAX_MB,
  TEMPLATE_SUPPORT_EMAIL,
  type TemplateUploadIssue,
} from "@/lib/school-template-upload";

/**
 * Shown directly under the school-template upload buttons when an upload fails: what went
 * wrong, what is accepted, and the steps that fix it. Stays until dismissed or the next
 * attempt, unlike a toast, so the steps can be followed while the teacher fixes the file.
 */
export function TemplateUploadIssuePanel({
  issue,
  onChooseAnother,
  onDismiss,
}: {
  issue: TemplateUploadIssue;
  onChooseAnother: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-3 rounded-md border border-danger-border bg-danger-subtle p-3 text-[12px] leading-relaxed text-danger-text"
    >
      <p className="text-[13px] font-semibold">We couldn&apos;t upload your PowerPoint</p>
      <p className="mt-1">{issue.message}</p>

      <p className="mt-2 font-semibold">What we accept</p>
      <p>PowerPoint .pptx files, up to {TEMPLATE_MAX_MB} MB.</p>

      <p className="mt-2 font-semibold">How to fix it</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {issue.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onChooseAnother}>
          Choose another file
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <p className="mt-2 opacity-80">
        Still stuck? Email{" "}
        <a className="underline underline-offset-2" href={`mailto:${TEMPLATE_SUPPORT_EMAIL}`}>
          {TEMPLATE_SUPPORT_EMAIL}
        </a>{" "}
        and mention the file name.
      </p>
    </div>
  );
}
