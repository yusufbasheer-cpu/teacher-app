"use client";

import { ChalkDustParticles } from "@/components/effects/chalk-dust-particles";
import { MagneticButtonsInit } from "@/components/effects/magnetic-buttons-init";

/** Global visual effects — lightweight, subtle, performance-conscious. */
export function AppEffects() {
  return (
    <>
      <ChalkDustParticles />
      <MagneticButtonsInit />
    </>
  );
}
