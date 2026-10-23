/**
 * The "workbench" at the top of the generation overlay: a lesson-plan page being written, a slide being built and
 * dropped into the deck, and a worksheet being ticked. The piece matching the section that is actually generating
 * comes forward and animates; the others dim to a still, finished preview (and start over when they get focus),
 * so the motion reflects real progress rather than decorating.
 *
 * Pure CSS keyframes on transform/opacity: they keep running smoothly while the main thread is busy streaming the
 * generation. Reduced motion shows the finished scene, still. SVG so it scales cleanly down to phone width.
 */

export type SceneFocus = "doc" | "slides" | "sheet";

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Hidden until `start`%, built by `start + 8`%, held until `hold`%, gone by `hold + 4`% (all within one loop). */
function buildKeyframes(name: string, start: number, hold: number, from: string, to = "none"): string {
  return `@keyframes ${name}{0%,${start}%{opacity:0;transform:${from}}${start + 8}%,${hold}%{opacity:1;transform:${to}}${Math.min(100, hold + 4)}%,100%{opacity:0;transform:${from}}}`;
}

const DOC_LINES = [0, 1, 2, 3, 4, 5, 6];
const SHEET_ROWS = [0, 1, 2, 3];
const SLIDE_BULLETS = [0, 1, 2];
const THUMBS = [0, 1, 2, 3, 4, 5];

const KEYFRAMES = [
  ...DOC_LINES.map((i) => buildKeyframes(`lscDoc${i}`, 4 + i * 9, 86, "scaleX(0)")),
  buildKeyframes("lscSlTitle", 4, 82, "scaleX(0)"),
  buildKeyframes("lscSlImg", 14, 82, "scale(0.92)"),
  ...SLIDE_BULLETS.map((i) => buildKeyframes(`lscSlB${i}`, 30 + i * 12, 82, "scaleX(0)")),
  ...SHEET_ROWS.map((i) => buildKeyframes(`lscTick${i}`, 10 + i * 18, 88, "scale(0.6)")),
  // The finished slide leaves to the left (into the deck) and an empty one arrives from the right.
  "@keyframes lscSlide{0%,80%{opacity:1;transform:none}87%{opacity:0;transform:translateX(-10px) scale(0.96)}88%{opacity:0;transform:translateX(10px)}96%,100%{opacity:1;transform:none}}",
  // Deck thumbnails fill one per slide cycle.
  ...THUMBS.map((i) => `@keyframes lscThumb${i}{0%,${Math.round((i / THUMBS.length) * 100)}%{opacity:.25}${Math.round(((i + 0.3) / THUMBS.length) * 100)}%,96%{opacity:1}100%{opacity:.25}}`),
].join("");

const CSS = `
${KEYFRAMES}
.lsc-part{transform-box:fill-box;transition:opacity 300ms ${EASE},transform 300ms ${EASE}}
.lsc-part.lsc-dim{opacity:.45;transform:scale(.94)}
.lsc-part.lsc-focus{opacity:1;transform:none}
.lsc-part.lsc-dim .lsc-a{animation:none;opacity:1;transform:none}
.lsc-a{transform-box:fill-box;animation-timing-function:${EASE};animation-iteration-count:infinite}
.lsc-x{transform-origin:left center}
.lsc-c{transform-origin:center}
@media (prefers-reduced-motion: reduce){
  .lsc-a{animation:none!important;opacity:1!important;transform:none!important}
  .lsc-part{transition:opacity 300ms ease}
  .lsc-part.lsc-dim{transform:none}
}`;

const PAPER = "#ffffff";
const INK = "#cfd6d4";
const INK_STRONG = "#9aa6a3";
const BRAND = "var(--brand)";

const anim = (name: string, seconds: number): React.CSSProperties => ({ animationName: name, animationDuration: `${seconds}s` });

export function LoadingScene({ focus, showSlides = true }: { focus: SceneFocus; showSlides?: boolean }) {
  const part = (key: SceneFocus) => `lsc-part ${focus === key ? "lsc-focus" : "lsc-dim"}`;
  return (
    <div aria-hidden style={{ width: "100%", marginBottom: 20 }}>
      <style>{CSS}</style>
      <svg viewBox="0 0 300 132" width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* Lesson plan page (moved inward when there is no slide between the two documents) */}
        <g transform={showSlides ? undefined : "translate(50 0)"}>
        <g className={part("doc")} style={{ transformOrigin: "center" }}>
          <rect x="6" y="18" width="78" height="102" rx="6" fill={PAPER} />
          <rect x="14" y="27" width="40" height="6" rx="3" fill={BRAND} />
          {DOC_LINES.map((i) => (
            <rect key={i} className="lsc-a lsc-x" style={anim(`lscDoc${i}`, 6.4)} x="14" y={42 + i * 10} width={i % 3 === 2 ? 40 : 62} height="3.5" rx="1.75" fill={i === 0 ? INK_STRONG : INK} />
          ))}
        </g>
        </g>

        {/* Slide being built, with the deck filling underneath */}
        {showSlides ? (
          <g className={part("slides")} style={{ transformOrigin: "center" }}>
            <rect x="100" y="14" width="100" height="58" rx="5" fill={PAPER} opacity=".35" transform="translate(5 -5)" />
            <rect x="100" y="14" width="100" height="58" rx="5" fill={PAPER} opacity=".6" transform="translate(2.5 -2.5)" />
            <g className="lsc-a lsc-c" style={anim("lscSlide", 5.6)}>
              <rect x="100" y="14" width="100" height="58" rx="5" fill={PAPER} />
              <rect className="lsc-a lsc-x" style={anim("lscSlTitle", 5.6)} x="108" y="22" width="46" height="6" rx="3" fill={BRAND} />
              <g className="lsc-a lsc-c" style={anim("lscSlImg", 5.6)}>
                <rect x="160" y="33" width="32" height="31" rx="3" fill="color-mix(in oklch, var(--brand) 22%, white)" />
                <circle cx="182" cy="41" r="3.5" fill="color-mix(in oklch, var(--brand) 55%, white)" />
                <path d="M162 62 l9 -12 l7 8 l5 -5 l8 9 z" fill="color-mix(in oklch, var(--brand) 70%, white)" />
              </g>
              {SLIDE_BULLETS.map((i) => (
                <g key={i} className="lsc-a lsc-x" style={anim(`lscSlB${i}`, 5.6)}>
                  <circle cx="110" cy={38 + i * 10} r="1.8" fill={BRAND} />
                  <rect x="115" y={36.5 + i * 10} width={i === 2 ? 26 : 38} height="3" rx="1.5" fill={INK_STRONG} />
                </g>
              ))}
            </g>
            {THUMBS.map((i) => (
              <rect key={i} className="lsc-a" style={anim(`lscThumb${i}`, 5.6 * THUMBS.length)} x={102 + i * 16.4} y="84" width="13" height="8" rx="1.5" fill={PAPER} />
            ))}
          </g>
        ) : null}

        {/* Worksheet being answered */}
        {/* The offset lives on a wrapper: the CSS focus/dim transform on the inner group would override it. */}
        <g transform={showSlides ? undefined : "translate(-50 0)"}>
        <g className={part("sheet")} style={{ transformOrigin: "center" }}>
          <rect x="216" y="18" width="78" height="102" rx="6" fill={PAPER} />
          <rect x="224" y="27" width="34" height="6" rx="3" fill={INK_STRONG} />
          {SHEET_ROWS.map((i) => (
            <g key={i}>
              <rect x="224" y={44 + i * 17} width="9" height="9" rx="2" fill="none" stroke={INK_STRONG} strokeWidth="1.4" />
              <path className="lsc-a lsc-c" style={anim(`lscTick${i}`, 6.4)} d={`M225.8 ${48.8 + i * 17} l2.4 2.4 l4.4 -4.8`} fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="238" y={46.5 + i * 17} width={i % 2 ? 36 : 48} height="3.5" rx="1.75" fill={INK} />
            </g>
          ))}
        </g>
        </g>
      </svg>
    </div>
  );
}
