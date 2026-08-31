"use client";

/**
 * Design system for the Super Admin console.
 *
 * This used to be a fully parallel palette and component set (raw hex
 * constants, hand-rolled Button/Input/Badge/EmptyState/toast implementations)
 * that happened to be styled to *look* like the rest of the app without
 * actually being built on it — so it silently drifted (e.g. `var(--text)`
 * used as a background, which inverts wrong in dark mode) and never got the
 * benefit of fixes made to the shared primitives.
 *
 * The named exports below are unchanged, so none of the six admin screens
 * that consume this file needed to change — but every constant now points at
 * a real semantic token instead of a hex literal, and every component is a
 * thin wrapper over the shared `ui/` primitive instead of a reimplementation.
 */

import { createContext, useContext, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextInput, TextArea, Select } from "@/components/ui/field";
import { EmptyState as SharedEmptyState } from "@/components/ui/panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Tokens — CSS custom property references, not hex. Same pattern as
// lib/design-tokens.ts's TEAL/NAVY consts: a `var(...)` string works anywhere
// a hex literal would (inline `style`), but stays theme-aware.
// ---------------------------------------------------------------------------

export const INK = "var(--text)";
export const INK_MUTED = "var(--text-secondary)";
export const INK_FAINT = "var(--text-muted)";
export const PAPER = "var(--canvas)";
export const SURFACE = "var(--surface)";
export const BORDER = "var(--border-subtle)";
export const BORDER_STRONG = "var(--border)";

export const ACCENT = "var(--brand)";
export const ACCENT_SOFT = "var(--brand-subtle)";
export const ACCENT_STRONG = "var(--brand-active)";

/** "Positive/success" reuses brand — the one accent color already carries
 * that meaning elsewhere in the app (e.g. a completed step's checkmark). */
export const POSITIVE = "var(--brand-active)";
export const POSITIVE_SOFT = "var(--brand-subtle)";

export const DANGER = "var(--danger-text)";
export const DANGER_SOFT = "var(--danger-subtle)";

export const WARNING = "var(--generated-text)";
export const WARNING_SOFT = "var(--generated-subtle)";

export const FONT_DISPLAY = "[font-family:var(--font-space-grotesk),var(--font-jakarta),sans-serif]";
export const FONT_MONO = "[font-family:var(--font-plex-mono),ui-monospace,monospace]";

export function formatAdminDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatAdminDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPlanLabel(plan: string) {
  return plan.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function AdminCard({
  className,
  padded = true,
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & { padded?: boolean; tone?: "default" | "danger" | "warning" }) {
  const toneBorder = tone === "danger" ? "var(--danger-border)" : tone === "warning" ? "var(--gen-border)" : BORDER;
  return (
    <div
      className={cn("rounded-xl bg-surface", padded && "p-5", className)}
      style={{ border: `1px solid ${toneBorder}` }}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={cn("text-lg font-semibold tracking-tight text-ink", FONT_DISPLAY)}>{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "warning" | "danger";
  hint?: string;
}) {
  const color = tone === "positive" ? POSITIVE : tone === "warning" ? WARNING : tone === "danger" ? DANGER : INK;
  return (
    <AdminCard>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider text-faint", FONT_MONO)}>{label}</p>
      <p className={cn("mt-2 text-[1.75rem] font-semibold leading-none tracking-tight", FONT_DISPLAY)} style={{ color }}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </AdminCard>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <SharedEmptyState title={title} description={description} />;
}

type Tone = "neutral" | "positive" | "danger" | "warning" | "accent";

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--surface-sunken)", fg: INK_MUTED },
  positive: { bg: POSITIVE_SOFT, fg: POSITIVE },
  danger: { bg: DANGER_SOFT, fg: DANGER },
  warning: { bg: WARNING_SOFT, fg: WARNING },
  accent: { bg: ACCENT_SOFT, fg: ACCENT },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form primitives — thin wrappers over the shared Field-less controls, so
// admin screens (which pass raw value/onChange, not a Field label) still get
// the real focus/hover/disabled treatment instead of a hand-rolled one.
// ---------------------------------------------------------------------------

export function AdminInput(props: React.ComponentProps<"input">) {
  return <TextInput {...props} />;
}

export function AdminTextarea(props: React.ComponentProps<"textarea">) {
  return <TextArea {...props} />;
}

export function AdminSelect(props: React.ComponentProps<"select">) {
  return <Select {...props} />;
}

type ButtonTone = "primary" | "secondary" | "danger" | "ghost" | "positive";

const TONE_TO_VARIANT: Record<ButtonTone, "default" | "outline" | "danger" | "ghost" | "subtle"> = {
  primary: "default",
  secondary: "outline",
  danger: "danger",
  ghost: "ghost",
  /* Not THE primary action of the view, but still brand-affirmative —
   * `subtle` (tinted, non-solid) reads as "good" without competing with a
   * real primary button for the one-solid-action-per-view rule. */
  positive: "subtle",
};

export function AdminButton({
  tone = "secondary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { tone?: ButtonTone; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <Button
      type="button"
      variant={TONE_TO_VARIANT[tone]}
      size={size === "sm" ? "sm" : "default"}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Action dialog — the "ledger" confirmation for destructive / money-moving
// actions. Renders an itemized summary in mono type plus a small declarative
// field set (reason / free text / amount / typed-match), so every admin
// action gets the same deliberate confirm → loading → success/error flow
// instead of window.confirm()/window.prompt(). Success/error feedback goes
// through the app's own sonner toaster (see ui/toaster.tsx) rather than a
// second, separately-positioned toast stack.
// ---------------------------------------------------------------------------

export type ActionField =
  | { kind: "reason"; key?: string; label?: string; placeholder?: string }
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "amount"; key: string; label: string; maxPaise: number }
  | { kind: "typedMatch"; key: string; mustEqual: string; label: string };

export type PendingActionConfig = {
  title: string;
  description?: string;
  tone?: "default" | "danger";
  summary?: { label: string; value: string }[];
  fields?: ActionField[];
  confirmLabel: string;
  run: (values: Record<string, string>) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>;
};

type ActionDialogContextValue = {
  open: (config: PendingActionConfig) => void;
};

const ActionDialogContext = createContext<ActionDialogContextValue | null>(null);

export function useActionDialog(): ActionDialogContextValue {
  const ctx = useContext(ActionDialogContext);
  if (!ctx) throw new Error("useActionDialog must be used within AdminProviders");
  return ctx;
}

function fieldKey(field: ActionField, idx: number) {
  if (field.kind === "reason") return field.key ?? "reason";
  return field.key ?? `field_${idx}`;
}

function validateFields(fields: ActionField[], values: Record<string, string>): string | null {
  for (const field of fields) {
    if (field.kind === "reason") {
      const v = (values[fieldKey(field, 0)] ?? "").trim();
      if (!v) return "A reason is required.";
    }
    if (field.kind === "typedMatch") {
      const v = values[field.key] ?? "";
      if (v !== field.mustEqual) return `Type "${field.mustEqual}" exactly to confirm.`;
    }
    if (field.kind === "amount") {
      const raw = values[field.key];
      if (raw !== undefined && raw !== "") {
        const rupees = Number(raw);
        if (!rupees || rupees <= 0 || Math.round(rupees * 100) > field.maxPaise) {
          return "Enter a valid amount (or leave blank for a full refund).";
        }
      }
    }
  }
  return null;
}

function ActionDialogRenderer({
  config,
  onClose,
}: {
  config: PendingActionConfig;
  onClose: (result: "confirmed" | "cancelled") => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const setField = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleConfirm = async () => {
    if (config.fields) {
      const err = validateFields(config.fields, values);
      if (err) {
        setLocalError(err);
        return;
      }
    }
    setSubmitting(true);
    setLocalError(null);
    const result = await config.run(values);
    setSubmitting(false);
    if (result.ok) {
      if (result.message) toast.success(result.message);
      onClose("confirmed");
    } else {
      setLocalError(result.error);
      toast.error(result.error);
    }
  };

  const tone = config.tone ?? "default";

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose("cancelled")}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {tone === "danger" && <AlertTriangle className="size-4 shrink-0 text-danger-text" />}
            <DialogTitle className={cn(FONT_DISPLAY, "text-ink")}>{config.title}</DialogTitle>
          </div>
          {config.description && <DialogDescription>{config.description}</DialogDescription>}
        </DialogHeader>

        {config.summary && config.summary.length > 0 && (
          <div className="rounded-lg border border-line-subtle bg-canvas">
            {config.summary.map((row, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-baseline justify-between gap-3 px-3 py-1.5",
                  i > 0 && "border-t border-dashed border-line",
                )}
              >
                <span className="text-[11px] uppercase tracking-wide text-faint">{row.label}</span>
                <span className={cn("truncate text-right text-xs font-medium text-ink", FONT_MONO)}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {config.fields && config.fields.length > 0 && (
          <div className="space-y-3">
            {config.fields.map((field, idx) => {
              const key = fieldKey(field, idx);
              if (field.kind === "reason") {
                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-semibold text-muted">{field.label ?? "Reason"}</label>
                    <AdminTextarea
                      rows={2}
                      placeholder={field.placeholder ?? "Required — kept in the audit log"}
                      value={values[key] ?? ""}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </div>
                );
              }
              if (field.kind === "text") {
                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-semibold text-muted">{field.label}</label>
                    <AdminInput
                      placeholder={field.placeholder}
                      value={values[key] ?? ""}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </div>
                );
              }
              if (field.kind === "amount") {
                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-semibold text-muted">{field.label}</label>
                    <AdminInput
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={`Leave blank for full refund (max ₹${(field.maxPaise / 100).toFixed(2)})`}
                      value={values[key] ?? ""}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </div>
                );
              }
              return (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold text-muted">{field.label}</label>
                  <AdminInput value={values[key] ?? ""} onChange={(e) => setField(key, e.target.value)} />
                </div>
              );
            })}
          </div>
        )}

        {localError && (
          <p className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-medium text-danger-text">{localError}</p>
        )}

        <DialogFooter>
          <AdminButton tone="ghost" onClick={() => onClose("cancelled")} disabled={submitting}>
            Cancel
          </AdminButton>
          <AdminButton
            tone={tone === "danger" ? "danger" : "primary"}
            loading={submitting}
            onClick={() => void handleConfirm()}
          >
            {config.confirmLabel}
          </AdminButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminProviders({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingActionConfig | null>(null);

  const dialogValue = useMemo<ActionDialogContextValue>(() => ({ open: (config) => setPending(config) }), []);

  return (
    <ActionDialogContext.Provider value={dialogValue}>
      {children}
      {pending && <ActionDialogRenderer config={pending} onClose={() => setPending(null)} />}
    </ActionDialogContext.Provider>
  );
}
