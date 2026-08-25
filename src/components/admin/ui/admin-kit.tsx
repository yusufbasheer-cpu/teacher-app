"use client";

/**
 * Design system for the Super Admin console — deliberately distinct from the
 * marketing site's warm cream/teal palette (this is an internal ops tool,
 * not a landing page). Cool paper background, hairline borders, color used
 * only to carry meaning (indigo = primary action, green = positive/active,
 * red = destructive/money-out, amber = pending/warning).
 *
 * Fonts reuse what's already loaded globally on <body> in the root layout
 * (Space Grotesk for display, IBM Plex Mono for data/ledger rows) — no new
 * font loading here, so this never touches non-admin routes.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export const INK = "#17161B";
export const INK_MUTED = "#6B6873";
export const INK_FAINT = "#A6A3AC";
export const PAPER = "#F5F4F1";
export const SURFACE = "#FFFFFF";
export const BORDER = "#E4E1DB";
export const BORDER_STRONG = "#D2CEC5";

export const ACCENT = "#3E4C8A";
export const ACCENT_SOFT = "rgba(62,76,138,0.08)";
export const ACCENT_STRONG = "#2E3A6B";

export const POSITIVE = "#1F7A5C";
export const POSITIVE_SOFT = "rgba(31,122,92,0.10)";

export const DANGER = "#B3261E";
export const DANGER_SOFT = "rgba(179,38,30,0.08)";

export const WARNING = "#9A6B14";
export const WARNING_SOFT = "rgba(154,107,20,0.10)";

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
  const toneBorder = tone === "danger" ? "rgba(179,38,30,0.28)" : tone === "warning" ? "rgba(154,107,20,0.3)" : BORDER;
  return (
    <div
      className={cn("rounded-xl bg-white shadow-[0_1px_2px_rgba(23,22,27,0.04)]", padded && "p-5", className)}
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
        <h2 className={cn("text-lg font-semibold tracking-tight", FONT_DISPLAY)} style={{ color: INK }}>
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm" style={{ color: INK_MUTED }}>
            {description}
          </p>
        )}
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
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider", FONT_MONO)} style={{ color: INK_FAINT }}>
        {label}
      </p>
      <p className={cn("mt-2 text-[1.75rem] font-semibold leading-none tracking-tight", FONT_DISPLAY)} style={{ color }}>
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-xs" style={{ color: INK_FAINT }}>
          {hint}
        </p>
      )}
    </AdminCard>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <AdminCard className="text-center">
      <p className="text-sm font-medium" style={{ color: INK_MUTED }}>
        {title}
      </p>
      {description && (
        <p className="mt-1 text-xs" style={{ color: INK_FAINT }}>
          {description}
        </p>
      )}
    </AdminCard>
  );
}

type Tone = "neutral" | "positive" | "danger" | "warning" | "accent";

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "#F0EFEC", fg: INK_MUTED },
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
// Form primitives (styled wrappers, same visual language everywhere)
// ---------------------------------------------------------------------------

const fieldBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-offset-0";

export function AdminInput(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(fieldBase, props.className)}
      style={{ borderColor: BORDER_STRONG, color: INK, ...props.style }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = ACCENT;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = BORDER_STRONG;
        props.onBlur?.(e);
      }}
    />
  );
}

export function AdminTextarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(fieldBase, props.className)}
      style={{ borderColor: BORDER_STRONG, color: INK, ...props.style }}
    />
  );
}

export function AdminSelect(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(fieldBase, "cursor-pointer", props.className)}
      style={{ borderColor: BORDER_STRONG, color: INK, ...props.style }}
    />
  );
}

type ButtonTone = "primary" | "secondary" | "danger" | "ghost" | "positive";

const BUTTON_TONE_CLASS: Record<ButtonTone, string> = {
  primary: "text-white hover:opacity-90",
  secondary: "border hover:bg-black/[0.02]",
  danger: "border hover:bg-[rgba(179,38,30,0.06)]",
  ghost: "hover:bg-black/[0.03]",
  positive: "text-white hover:opacity-90",
};

function buttonToneStyle(tone: ButtonTone): React.CSSProperties {
  switch (tone) {
    case "primary":
      return { background: ACCENT };
    case "positive":
      return { background: POSITIVE };
    case "secondary":
      return { borderColor: BORDER_STRONG, color: INK, background: "white" };
    case "danger":
      return { borderColor: "rgba(179,38,30,0.35)", color: DANGER, background: "white" };
    case "ghost":
      return { color: INK_MUTED };
  }
}

export function AdminButton({
  tone = "secondary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { tone?: ButtonTone; size?: "sm" | "md"; loading?: boolean }) {
  const sizeClass = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        sizeClass,
        BUTTON_TONE_CLASS[tone],
        className,
      )}
      style={buttonToneStyle(tone)}
      {...props}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toasts — replaces window.alert() for success/error feedback
// ---------------------------------------------------------------------------

type ToastItem = { id: number; tone: "success" | "error"; message: string };

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within AdminProviders");
  return ctx;
}

function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2.5 rounded-xl bg-white p-3.5 shadow-lg ring-1 ring-black/5"
          style={{ borderLeft: `3px solid ${t.tone === "success" ? POSITIVE : DANGER}` }}
        >
          {t.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: POSITIVE }} />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" style={{ color: DANGER }} />
          )}
          <p className="flex-1 text-sm leading-snug" style={{ color: INK }}>
            {t.message}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-xs font-medium"
            style={{ color: INK_FAINT }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action dialog — the "ledger" confirmation for destructive / money-moving
// actions. Renders an itemized summary in mono type plus a small declarative
// field set (reason / free text / amount / typed-match), so every admin
// action gets the same deliberate confirm → loading → success/error flow
// instead of window.confirm()/window.prompt().
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
  const toast = useToast();

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
      <DialogContent className="sm:max-w-md" style={{ borderRadius: 14 }}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {tone === "danger" && <AlertTriangle className="size-4 shrink-0" style={{ color: DANGER }} />}
            <DialogTitle className={FONT_DISPLAY} style={{ color: INK }}>
              {config.title}
            </DialogTitle>
          </div>
          {config.description && <DialogDescription>{config.description}</DialogDescription>}
        </DialogHeader>

        {config.summary && config.summary.length > 0 && (
          <div className="rounded-lg" style={{ background: PAPER, border: `1px solid ${BORDER}` }}>
            {config.summary.map((row, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-3 px-3 py-1.5"
                style={{ borderTop: i > 0 ? `1px dashed ${BORDER_STRONG}` : undefined }}
              >
                <span className="text-[11px] uppercase tracking-wide" style={{ color: INK_FAINT }}>
                  {row.label}
                </span>
                <span className={cn("truncate text-right text-xs font-medium", FONT_MONO)} style={{ color: INK }}>
                  {row.value}
                </span>
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
                    <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>
                      {field.label ?? "Reason"}
                    </label>
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
                    <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>
                      {field.label}
                    </label>
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
                    <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>
                      {field.label}
                    </label>
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
                  <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>
                    {field.label}
                  </label>
                  <AdminInput value={values[key] ?? ""} onChange={(e) => setField(key, e.target.value)} />
                </div>
              );
            })}
          </div>
        )}

        {localError && (
          <p className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: DANGER_SOFT, color: DANGER }}>
            {localError}
          </p>
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: "success" | "error", message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, tone, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const toastValue = useMemo<ToastContextValue>(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m) }),
    [push],
  );

  const [pending, setPending] = useState<PendingActionConfig | null>(null);

  const dialogValue = useMemo<ActionDialogContextValue>(() => ({ open: (config) => setPending(config) }), []);

  return (
    <ToastContext.Provider value={toastValue}>
      <ActionDialogContext.Provider value={dialogValue}>
        {children}
        <ToastStack items={toasts} onDismiss={dismiss} />
        {pending && <ActionDialogRenderer config={pending} onClose={() => setPending(null)} />}
      </ActionDialogContext.Provider>
    </ToastContext.Provider>
  );
}
