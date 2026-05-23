"use client";

import { useLayahSounds } from "@/components/effects/sound-provider";

type SoundToggleButtonProps = {
  className?: string;
  /** Use on light backgrounds (e.g. landing is dark — default works there) */
  variant?: "dark-nav" | "light";
};

export function SoundToggleButton({ className = "", variant = "dark-nav" }: SoundToggleButtonProps) {
  const { enabled, toggle } = useLayahSounds();
  const color =
    variant === "dark-nav"
      ? enabled
        ? "#00C6A7"
        : "rgba(255,255,255,0.45)"
      : enabled
        ? "#0A8F7A"
        : "#94a3b8";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/10 ${className}`}
      style={{ color }}
      aria-label="Toggle sounds"
      aria-pressed={enabled}
      title={enabled ? "Sounds on" : "Sounds off"}
    >
      {enabled ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5L6 9H3v6h3l5 4V5zM15.54 8.46a5 5 0 010 7.08M19.07 4.93a10 10 0 010 14.14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5L6 9H3v6h3l5 4V5zM23 9l-6 6M17 9l6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
