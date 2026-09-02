"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmation dialog for actions that destroy data.
 *
 * Added because deleting a saved lesson previously fired straight from the
 * card's button with no confirmation and no undo — a single mis-tap on a phone
 * permanently removed a lesson the teacher had generated and might be teaching
 * from. That was the only genuinely destructive action in the product without
 * a guard.
 *
 * Deliberately *not* used for reversible actions. Over-confirming trains people
 * to dismiss dialogs without reading, which is what makes the one that matters
 * ineffective.
 *
 * Accessibility: focus moves to the dialog on open and returns to the trigger
 * on close, Escape and backdrop dismiss, and focus is trapped while open.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = requestAnimationFrame(() => confirmRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      // Trap focus: a dialog you can tab out of is a dialog a keyboard user
      // can lose.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => !busy && onCancel()}
        className="animate-fade-in absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-desc" : undefined}
        className={cn(
          "animate-pop relative w-full max-w-[380px] overflow-hidden rounded-lg",
          "border border-line bg-raised shadow-overlay",
        )}
      >
        <div className="px-4 pb-4 pt-3.5">
          <h2 id="confirm-title" className="text-[13px] font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p id="confirm-desc" className="mt-1.5 text-[12px] leading-relaxed text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line-subtle bg-surface px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef as never}
            variant={tone === "danger" ? "danger" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
