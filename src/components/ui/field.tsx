"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Form primitives.
 *
 * The product had 40 raw `<input>` and 20 raw `<select>` elements, each
 * carrying its own copy of a border/padding/focus recipe, and two competing
 * label conventions (an uppercase eyebrow *and* a sentence-case label above
 * the same control). This is the replacement.
 *
 * Rules encoded here rather than left to call sites:
 * - Every control is reachable by its label — `Field` wires htmlFor/id itself,
 *   so a label can't drift away from its input.
 * - Optional is marked, required is not. Most fields in this product are
 *   required; marking the exception is less noise than marking the rule.
 * - A hint sits under the control, an error replaces the hint. Both are wired
 *   to `aria-describedby` so a screen reader gets them in the right order.
 */

const CONTROL = [
  "w-full min-w-0 rounded-md border border-line bg-surface text-ink",
  "px-2.5 text-[13px] leading-none",
  "transition-[border-color,box-shadow] duration-[110ms] ease-[cubic-bezier(0.2,0,0,1)]",
  "placeholder:text-disabled",
  "hover:border-line-strong",
  "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/25",
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-disabled",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/20",
].join(" ");

const FieldCtx = React.createContext<{ id: string; describedBy?: string; invalid?: boolean } | null>(
  null,
);

function useField() {
  return React.useContext(FieldCtx);
}

type FieldProps = {
  label: string;
  /** Rendered under the control. Explains *how* to fill it in, not what it is. */
  hint?: React.ReactNode;
  /** Replaces the hint and marks the control invalid. */
  error?: string | null;
  /** Most fields here are required; mark the exceptions instead. */
  optional?: boolean;
  /** Right-aligned affordance in the label row — a "Clear", a counter, a link. */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  id?: string;
};

export function Field({
  label,
  hint,
  error,
  optional,
  action,
  className,
  children,
  id,
}: FieldProps) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  const errId = `${fieldId}-err`;
  const describedBy = error ? errId : hint ? hintId : undefined;

  return (
    <FieldCtx.Provider value={{ id: fieldId, describedBy, invalid: Boolean(error) }}>
      <div className={cn("min-w-0", className)}>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label htmlFor={fieldId} className="text-[12px] font-medium text-ink">
            {label}
            {optional ? <span className="ml-1.5 font-normal text-faint">Optional</span> : null}
          </label>
          {action ? <div className="shrink-0 text-[11px] text-faint">{action}</div> : null}
        </div>
        {children}
        {error ? (
          <p id={errId} className="mt-1.5 text-[12px] text-danger-text">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-[12px] leading-snug text-faint">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldCtx.Provider>
  );
}

export function TextInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  const f = useField();
  return (
    <input
      id={props.id ?? f?.id}
      aria-describedby={props["aria-describedby"] ?? f?.describedBy}
      aria-invalid={props["aria-invalid"] ?? f?.invalid}
      className={cn(CONTROL, "h-8", className)}
      {...props}
    />
  );
}

export function TextArea({
  className,
  rows = 3,
  ...props
}: React.ComponentPropsWithoutRef<"textarea">) {
  const f = useField();
  return (
    <textarea
      id={props.id ?? f?.id}
      rows={rows}
      aria-describedby={props["aria-describedby"] ?? f?.describedBy}
      aria-invalid={props["aria-invalid"] ?? f?.invalid}
      className={cn(CONTROL, "resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

/**
 * Native `<select>`, restyled. Native is deliberate: these lists run to 40+
 * options (curricula, grades, subjects) and a phone's native picker beats any
 * custom listbox for that, which matters because most of this product's
 * traffic is a teacher on a phone.
 */
export function Select({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"select">) {
  const f = useField();
  return (
    <div className="relative">
      <select
        id={props.id ?? f?.id}
        aria-describedby={props["aria-describedby"] ?? f?.describedBy}
        aria-invalid={props["aria-invalid"] ?? f?.invalid}
        className={cn(CONTROL, "h-8 cursor-pointer appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint"
      />
    </div>
  );
}

/** Checkbox + label as one target, sized for touch. */
export function CheckField({
  label,
  description,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input"> & { label: React.ReactNode; description?: React.ReactNode }) {
  const auto = React.useId();
  const id = props.id ?? auto;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 -mx-2",
        "transition-colors duration-[110ms] hover:bg-hover",
        props.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
        className,
      )}
    >
      <input
        type="checkbox"
        id={id}
        className={cn(
          "mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-xs border border-line-strong bg-surface",
          "transition-[background-color,border-color] duration-[110ms]",
          "checked:border-brand checked:bg-brand",
          "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M2.5 6.2l2.2 2.2 4.8-4.8%22 fill=%22none%22 stroke=%22white%22 stroke-width=%221.8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] checked:bg-center checked:bg-no-repeat",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          "disabled:cursor-not-allowed",
        )}
        {...props}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-tight text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-faint">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * A group of mutually exclusive options rendered as pressable cards.
 * Used where the choice deserves explanation (teaching strategies, paper
 * difficulty) and a `<select>` would hide the descriptions.
 */
export function ChoiceCard({
  selected,
  title,
  description,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  selected: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "group flex flex-col rounded-md border p-2.5 text-left",
        "transition-[border-color,background-color] duration-[110ms]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        selected
          ? "border-brand bg-brand-subtle"
          : "border-line bg-surface hover:border-line-strong hover:bg-hover",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "text-[13px] font-medium leading-tight",
          selected ? "text-brand-text" : "text-ink",
        )}
      >
        {title}
      </span>
      {description ? (
        <span className="mt-1 text-[12px] leading-snug text-faint">{description}</span>
      ) : null}
    </button>
  );
}
