"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { playWhooshSound, primeAudioOnGesture } from "@/lib/layah-sounds";

/**
 * Wraps every page in a smooth fade-in entry animation.
 * IMPORTANT: We use opacity-only (no transform/y) so that any
 * position:fixed children (e.g. loading overlays) are still
 * contained by the viewport and not by this element.
 * A transform on a parent element creates a new containing block
 * for fixed descendants — which breaks full-screen overlays.
 */
export function PageTransitionWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    primeAudioOnGesture();
    playWhooshSound();
  }, [pathname]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
