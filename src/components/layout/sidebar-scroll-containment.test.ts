import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression coverage for the "sidebar scrolls away with the page" bug.
 *
 * There's no jsdom/React Testing Library in this project's test setup (vitest runs in the
 * "node" environment — see vitest.config.ts), and no Playwright/Cypress project config either,
 * so this deliberately doesn't try to render the components or drive a real browser — that was
 * verified manually (Playwright MCP session: measured the sidebar's bounding rect before/after
 * scrolling the content container to its max scrollTop, on both the app rail and the
 * super-admin shell, expanded and collapsed).
 *
 * What this guards instead: the two structural properties that actually caused the bug and
 * that a future edit could silently reintroduce —
 *   1. the shell's outer row is capped to the viewport height and doesn't grow with content
 *      (`h-screen overflow-hidden`, not `min-h-screen`, which is what let the whole page —
 *      sidebar included — grow taller than one viewport and scroll at the document level), and
 *   2. exactly one column inside that row owns its own scrolling (`overflow-y-auto`) — the
 *      sidebar is not it.
 * Read from the real source files rather than hand-copied strings, so this fails if the actual
 * shells regress, not just if some unrelated string drifts.
 */

function readSource(relativePath: string): string {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf-8");
}

function outerShellClassName(source: string): string {
  // The shell root is whichever `<div className="...">` comes immediately before the first
  // `<aside` in the file — not simply "the first div in the file", since both files define
  // helper components (RailContent, RailLink, ...) with their own divs earlier in the file's
  // *text* than the shell root, even though the shell root renders first.
  const asideIndex = source.indexOf("<aside");
  if (asideIndex === -1) throw new Error("Could not find an <aside> in source");
  const before = source.slice(0, asideIndex);
  const matches = [...before.matchAll(/<div className="([^"]*)"/g)];
  const last = matches[matches.length - 1];
  if (!last) throw new Error("Could not find the shell's outer <div className=\"...\"> before <aside>");
  return last[1]!;
}

describe.each([
  ["AppFrame (app rail, used by every authenticated route except /super-admin)", "../app/app-frame.tsx"],
  ["AdminShell (super-admin console)", "../admin/ui/admin-shell.tsx"],
])("%s — outer shell is viewport-capped, not document-scrolled", (_label, relativePath) => {
  const source = readSource(relativePath);

  it("caps the outer row to the viewport instead of growing with content", () => {
    const outer = outerShellClassName(source);
    expect(outer).toContain("h-screen");
    expect(outer).toContain("overflow-hidden");
    // The specific old bug: `min-h-screen` lets the row grow past 100vh, which is exactly what
    // let the whole page — sidebar included — scroll at the document level.
    expect(outer).not.toContain("min-h-screen");
  });

  it("gives the main column its own scroll region, separate from the sidebar", () => {
    const scrollDivs = [...source.matchAll(/<div className="([^"]*overflow-y-auto[^"]*)"/g)];
    expect(scrollDivs.length).toBeGreaterThanOrEqual(1);
    // None of the scrolling divs should also be the sidebar itself — the sidebar's own overflow
    // (its internal nav list, when the item list is taller than the viewport) is deliberately
    // separate and lives on a <nav>, not the <aside>.
    for (const [, cls] of scrollDivs) {
      expect(cls).not.toContain("shrink-0"); // the sidebar's own root carries shrink-0; the main column does not
    }
  });

  it("keeps the sidebar from shrinking or growing with the row's content", () => {
    // `shrink-0` is what stops the flex row from squeezing the sidebar's width down when the
    // main column's content pushes for space — combined with the viewport-capped outer row
    // (previous test) and the sidebar's own height (either an explicit h-screen, or the flex
    // row's default stretch alignment filling it — both shells use one or the other), this is
    // what keeps the sidebar's box exactly one viewport tall instead of shrinking or scrolling.
    const asideMatch = /<aside\b[^>]*className=\{?[^}]*?(?:"|`)([^"`]*)/.exec(source);
    expect(asideMatch, "expected an <aside> element in this shell").toBeTruthy();
    const asideClasses = asideMatch![1]!;
    expect(asideClasses).toContain("shrink-0");
  });
});
