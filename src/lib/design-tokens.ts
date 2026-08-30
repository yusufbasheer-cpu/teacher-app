/**
 * Colour constants for surfaces that set colour through inline `style` or
 * template literals rather than Tailwind utilities (marketing pages, admin
 * panels, the payment and school flows).
 *
 * These are CSS variable *references*, not hex values. That matters: a frozen
 * hex cannot follow the theme, so every one of these call sites used to be
 * permanently light. Pointing them at the semantic layer in
 * `src/styles/tokens.css` means they flip with light/dark for free and there
 * is exactly one place a colour is defined.
 *
 * New code should prefer the Tailwind utilities (`bg-surface`, `text-muted`,
 * `border-line`) — reach for these only when you are inside a `style` object.
 *
 * Note: because these are `var(...)` strings they cannot be concatenated with
 * an alpha suffix (`${TEAL}33`). Use `withAlpha()` below instead.
 */

/** Brand spruce. The primary action colour and the only saturated hue in the chrome. */
export const TEAL = "var(--brand)";
/** Brand at its active/pressed depth; also the brand used as text on light surfaces. */
export const TEAL_DARK = "var(--brand-active)";
/** Primary ink. Named NAVY for history — it is now a cool near-black, not a brown. */
export const NAVY = "var(--text)";
/** Panel/card background. */
export const BG = "var(--surface)";
/** Recessed background — page canvas behind panels, inset wells. */
export const BG_SOFT = "var(--canvas)";
/** Default hairline. */
export const BORDER = "var(--border)";
/** Body text. */
export const TEXT = "var(--text)";
/** Secondary/supporting text. */
export const TEXT_MUTED = "var(--text-secondary)";

/** Panel corner radius, in px, for the few places that need the number. */
export const RADIUS = 10;

/**
 * Translucent version of any token above.
 *
 * `color-mix` is used rather than string-concatenating an alpha channel onto a
 * hex, which is impossible once a token is a `var()`. Mixing happens in OKLCH
 * so a 10% brand tint stays the same apparent lightness in dark mode as in
 * light, instead of turning muddy.
 *
 * @param token a CSS colour value — normally one of the exports above
 * @param alpha 0–1
 */
export function withAlpha(token: string, alpha: number): string {
  return `color-mix(in oklch, ${token} ${Math.round(alpha * 100)}%, transparent)`;
}
