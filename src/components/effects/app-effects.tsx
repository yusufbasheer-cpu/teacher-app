"use client";

import { ChalkDustParticles } from "@/components/effects/chalk-dust-particles";
import { CardTiltInit } from "@/components/effects/card-tilt-init";
import { MagneticButtonsInit } from "@/components/effects/magnetic-buttons-init";

/** Global visual effects — lightweight, subtle, performance-conscious. */
export function AppEffects() {
  return (
    <>
      <ChalkDustParticles />
      <CardTiltInit />
      <MagneticButtonsInit />
    </>
  );
}
