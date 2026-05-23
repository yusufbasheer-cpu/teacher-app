/** Layah UI sound effects — Web Audio, max ~20% perceived volume. */

export const LAYAH_SOUNDS_STORAGE_KEY = "layah-sounds-enabled";

export const LAYAH_SOUND_EVENTS = {
  generationComplete: "layah:generation-complete",
  download: "layah:download",
  changed: "layah:sounds-changed",
} as const;

const MASTER_GAIN = 0.2;

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(LAYAH_SOUNDS_STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAYAH_SOUNDS_STORAGE_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent(LAYAH_SOUND_EVENTS.changed, { detail: enabled }),
  );
}

function canPlay(): boolean {
  return isSoundEnabled() && getAudioContext() !== null;
}

function connectGain(ctx: AudioContext, peak = 1): GainNode {
  const gain = ctx.createGain();
  gain.gain.value = MASTER_GAIN * peak;
  gain.connect(ctx.destination);
  return gain;
}

/** Soft click for button presses */
export function playClickSound(): void {
  if (!canPlay()) return;
  const ctx = getAudioContext()!;
  const t = ctx.currentTime;
  const gain = connectGain(ctx, 0.35);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(920, t);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.04);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.0001, t);
  clickGain.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

  osc.connect(clickGain);
  clickGain.connect(gain);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Soft whoosh on page transitions */
export function playWhooshSound(): void {
  if (!canPlay()) return;
  const ctx = getAudioContext()!;
  const t = ctx.currentTime;
  const gain = connectGain(ctx, 0.25);

  const bufferSize = ctx.sampleRate * 0.35;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(2200, t + 0.28);
  filter.Q.value = 0.6;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.4, t + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

  source.connect(filter);
  filter.connect(env);
  env.connect(gain);
  source.start(t);
  source.stop(t + 0.34);
}

/** Satisfying chime when generation completes */
export function playChimeSound(): void {
  if (!canPlay()) return;
  const ctx = getAudioContext()!;
  const t = ctx.currentTime;
  const gain = connectGain(ctx, 0.3);
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const noteGain = ctx.createGain();
    const start = t + i * 0.07;
    noteGain.gain.setValueAtTime(0.0001, start);
    noteGain.gain.exponentialRampToValueAtTime(0.45, start + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    osc.connect(noteGain);
    noteGain.connect(gain);
    osc.start(start);
    osc.stop(start + 0.6);
  });
}

/** Paper rustle when downloading */
export function playPaperRustleSound(): void {
  if (!canPlay()) return;
  const ctx = getAudioContext()!;
  const t = ctx.currentTime;
  const gain = connectGain(ctx, 0.22);

  const bufferSize = Math.floor(ctx.sampleRate * 0.22);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

  source.connect(filter);
  filter.connect(env);
  env.connect(gain);
  source.start(t);
  source.stop(t + 0.22);
}

export function dispatchLayahGenerationComplete(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LAYAH_SOUND_EVENTS.generationComplete));
}

export function dispatchLayahDownloadSound(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LAYAH_SOUND_EVENTS.download));
}

export function primeAudioOnGesture(): void {
  getAudioContext();
}
