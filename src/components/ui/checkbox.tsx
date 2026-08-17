"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = {
  id?: string;
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Custom-rendered checkbox. Tailwind's `text-{color}` trick for styling a
 * native checkbox relies on `accent-color` support and silently falls back
 * to the OS/browser's native (usually blue) checkbox when it doesn't apply
 * — the real <input type="checkbox"> stays for keyboard/screen-reader
 * semantics, but is visually hidden; a styled box + check icon renders on
 * top, driven by the same `checked` boolean, so it always renders in brand
 * teal.
 */
export function Checkbox({ id, checked, onChange, disabled, className }: CheckboxProps) {
  return (
    <span className={cn("relative inline-flex size-4 shrink-0", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer absolute inset-0 z-10 size-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        className={cn(
          "pointer-events-none flex size-4 items-center justify-center rounded border transition-colors duration-150",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[#0E9484]/40 peer-focus-visible:ring-offset-1",
          checked ? "border-[#0E9484] bg-[#0E9484]" : "border-[#E8DFD1] bg-white",
          disabled && "opacity-50",
        )}
      >
        {checked ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
      </span>
    </span>
  );
}
