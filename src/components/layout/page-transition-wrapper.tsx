"use client";

import type { ReactNode } from "react";

/**
 * Lightweight pass-through wrapper for app content.
 *
 * Page changes are meant to feel immediate here. The sidebar provides the
 * active-state cue, and each route's `loading.tsx` handles any real loading
 * delay when the next segment needs to fetch before rendering.
 */
export function PageTransitionWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
