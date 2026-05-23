"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  isSoundEnabled,
  LAYAH_SOUND_EVENTS,
  playChimeSound,
  playClickSound,
  playPaperRustleSound,
  playWhooshSound,
  primeAudioOnGesture,
  setSoundEnabled,
} from "@/lib/layah-sounds";

type SoundContextValue = {
  enabled: boolean;
  toggle: () => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function useLayahSounds(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    throw new Error("useLayahSounds must be used within SoundProvider");
  }
  return ctx;
}

function SoundEffectsListener() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest('button, a[href], [role="button"]');
      if (!(el instanceof HTMLElement)) return;
      if (el.getAttribute("aria-label") === "Toggle sounds") return;
      if (el.getAttribute("aria-label") === "Toggle navigation menu") return;
      if (el.closest("[data-layah-sound-skip]")) return;
      primeAudioOnGesture();
      playClickSound();
    };

    const onGeneration = () => playChimeSound();
    const onDownload = () => playPaperRustleSound();

    document.addEventListener("click", onClick, true);
    window.addEventListener(LAYAH_SOUND_EVENTS.generationComplete, onGeneration);
    window.addEventListener(LAYAH_SOUND_EVENTS.download, onDownload);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(LAYAH_SOUND_EVENTS.generationComplete, onGeneration);
      window.removeEventListener(LAYAH_SOUND_EVENTS.download, onDownload);
    };
  }, []);

  return null;
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setEnabled(typeof detail === "boolean" ? detail : isSoundEnabled());
    };
    window.addEventListener(LAYAH_SOUND_EVENTS.changed, onChanged);
    return () => window.removeEventListener(LAYAH_SOUND_EVENTS.changed, onChanged);
  }, []);

  const toggle = useCallback(() => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    setEnabled(next);
    if (next) primeAudioOnGesture();
  }, []);

  return (
    <SoundContext.Provider value={{ enabled, toggle }}>
      <SoundEffectsListener />
      {children}
    </SoundContext.Provider>
  );
}
