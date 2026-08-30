import { cn } from "@/lib/utils";

/**
 * Hero backdrop.
 *
 * Replaces `/hero-blob.svg` — a pale mint amorphous shape that sat behind the
 * headline without meaning anything, and read as an unfinished placeholder
 * because its edge cut across the content at most viewport widths.
 *
 * This is the same ruled-planner motif the app uses for its composer and
 * package sections, at hero scale: faint horizontal ruling, a single vertical
 * margin rule, and a soft brand wash for depth. It ties the public page to the
 * product's own visual language instead of decorating it with a blob, and
 * because it is drawn in CSS it stays crisp at any width and follows the theme.
 *
 * Purely decorative — `aria-hidden`, no layout cost, no image request.
 */
export function HeroBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {/* Brand wash. Sits behind the headline and falls off well before the
          edges, so nothing about it needs to line up with the content. */}
      <div
        className="absolute left-1/2 top-[-18%] h-[560px] w-[min(1100px,120%)] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 45%, color-mix(in oklch, var(--brand) 13%, transparent) 0%, transparent 70%)",
        }}
      />

      {/* Ruled lines, on the same 8px rhythm as the rest of the system. Masked
          to fade top and bottom so the ruling never terminates in a hard edge —
          which is what made the old blob look cut off. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--rule) 0px, var(--rule) 1px, transparent 1px, transparent 32px)",
          opacity: 0.45,
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 22%, black 62%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 22%, black 62%, transparent 100%)",
        }}
      />

      {/* The margin rule. One vertical line, offset like a planner's margin,
          and only on wide screens where there is room for it to read as
          deliberate rather than as a stray border. */}
      <div
        className="absolute inset-y-0 hidden lg:block"
        style={{
          left: "max(48px, calc(50% - 620px))",
          width: "1px",
          background: "color-mix(in oklch, var(--brand) 22%, transparent)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 70%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 25%, black 70%, transparent 100%)",
        }}
      />
    </div>
  );
}
