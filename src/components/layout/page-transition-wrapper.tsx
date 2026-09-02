"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Wraps every page in a smooth fade-in entry animation.
 * IMPORTANT: We use opacity-only (no transform/y) so that any
 * position:fixed children (e.g. loading overlays) are still
 * contained by the viewport and not by this element.
 * A transform on a parent element creates a new containing block
 * for fixed descendants — which breaks full-screen overlays.
 *
 * Keyed on pathname so React actually remounts (and thus replays) this
 * animation on every navigation — without the key, `initial` only ever
 * applies once for the whole client session, not per page.
 */
export function PageTransitionWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
