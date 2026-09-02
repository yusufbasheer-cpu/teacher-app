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

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>("system");

  React.useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "system";
    setThemeState(stored);
  }, []);

  // Follow the OS while the choice is "system" — without this, a user on
  // "system" keeps whatever the OS was at page load until they reload.
  React.useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the theme just won't persist */
    }
    apply(next);
  }, []);

  return { theme, setTheme };
}

const OPTIONS: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

/** Segmented three-way control. Shows the actual choice, including "system". */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-line-subtle bg-sunken p-0.5",
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
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-6 items-center justify-center rounded-sm transition-colors duration-[110ms]",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
              active
                ? "bg-surface text-ink shadow-pop"
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
