import { createHash } from "node:crypto";
import { GammaError, type GammaConfig } from "./config";

// ponytail: per-server-instance memory. On serverless this is best-effort (each cold instance starts at 0),
// so the hard backstop is the Gamma workspace's own credit balance with auto-recharge OFF. Persist to the DB
// if the experiment moves beyond a handful of manual runs.
const inFlight = new Set<string>();
let spentCredits = 0;

export function dedupeKey(userId: string, inputText: string): string {
  return createHash("sha256").update(userId).update("\0").update(inputText).digest("hex");
}

/** Reserves a run. Throws on duplicate in-flight run, oversized deck, or exhausted experiment budget. Returns release(). */
export function acquireGammaRun(key: string, cards: number, config: GammaConfig): () => void {
  if (cards > config.maxCardsPerRun) {
    throw new GammaError("budget_exceeded", `Deck has ${cards} cards; GAMMA_MAX_CARDS_PER_RUN is ${config.maxCardsPerRun}.`);
  }
  if (spentCredits >= config.experimentCreditBudget) {
    throw new GammaError("budget_exceeded", `Experiment credit budget (${config.experimentCreditBudget}) is used up.`);
  }
  if (inFlight.has(key)) {
    throw new GammaError("duplicate_in_flight", "An identical Gamma generation is already running.");
  }
  inFlight.add(key);
  return () => void inFlight.delete(key);
}

export function recordCredits(deducted: number | undefined): void {
  if (typeof deducted === "number" && deducted > 0) spentCredits += deducted;
}

export function getSpentCredits(): number {
  return spentCredits;
}

export function resetGammaBudgetForTests(): void {
  inFlight.clear();
  spentCredits = 0;
}
