"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Theme control.
 *
 * Dark mode earns its place in this product specifically: teachers plan at
 * night, after the school day. The `<html class="dark">` toggle is applied
 * before first paint by an inline script in the root layout — this component
 * only owns the *choice*, never the initial application, so there is no flash.
 */

export type Theme = "light" | "dark" | "system";
const KEY = "layah:theme";

function resolve(theme: Theme): boolean {
  if (theme === "system") {
    return typeof window !== "undefined"
      && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return theme === "dark";
}

function apply(theme: Theme) {
  const dark = resolve(theme);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

const CHANGE_EVENT = "layah:theme-change";
let memoryTheme: Theme = "system";
function currentTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" || value === "system" ? value : memoryTheme;
  } catch { return memoryTheme; }
}
function subscribeTheme(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTheme() {
  const theme = React.useSyncExternalStore(subscribeTheme, currentTheme, () => "system" as Theme);
  React.useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
  const setTheme = React.useCallback((next: Theme) => {
    memoryTheme = next;
    try { localStorage.setItem(KEY, next); } catch { /* selection works without persistence */ }
    apply(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return { theme, setTheme };
}

const OPTIONS: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

/** Segmented three-way control. Shows the actual choice, including "system". */
export function ThemeToggle({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  /**
   * Vertical is for the collapsed sidebar rail, which is 76px wide — a
   * three-option segmented control does not fit across it and used to be
   * dropped from the UI entirely rather than reflowed. The arrow-key handler
   * below already treats Up/Down as equivalent to Left/Right, so stacking
   * costs nothing in keyboard behaviour.
   */
  orientation?: "horizontal" | "vertical";
}) {
  const { theme, setTheme } = useTheme();
  const vertical = orientation === "vertical";

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      aria-orientation={orientation}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-line-subtle bg-sunken p-0.5",
        vertical && "flex-col",
        className,
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            tabIndex={active ? 0 : -1}
            title={label}
            onClick={() => setTheme(value)}
            onKeyDown={(event) => {
              const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
              if (!direction && event.key !== "Home" && event.key !== "End") return;
              event.preventDefault();
              const index = event.key === "Home" ? 0 : event.key === "End" ? OPTIONS.length - 1 : (OPTIONS.findIndex((option) => option.value === value) + direction + OPTIONS.length) % OPTIONS.length;
              setTheme(OPTIONS[index].value);
              (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index])?.focus();
            }}
            className={cn(
              "flex size-8 items-center justify-center rounded-sm transition-colors duration-[140ms]",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
              active
                ? "bg-surface text-brand-text shadow-sm"
                : "text-faint hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
