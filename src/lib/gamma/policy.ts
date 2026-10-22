import { GammaError, type GammaConfig } from "./config";
import type { GammaStore, GammaStatus } from "./store";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const UNSETTLED: readonly GammaStatus[] = ["submitting", "pending", "unknown", "abandoned"];

/**
 * Pre-flight admission control, run BEFORE any paid call. Everything reads the persistent ledger, so it holds
 * across serverless instances and restarts. Fails closed: a ledger error rejects the request (GammaError store_unavailable).
 *
 * Budget accounting is conservative: settled spend is the credits Gamma reported; every row whose cost is not
 * known (in-flight, unknown outcome, abandoned, or completed without a credits figure) is charged
 * `estimatedCreditsPerRun`, as is the run being admitted. Concurrent requests from DIFFERENT users can still
 * race past the budget by roughly one run each (the per-user unique index serialises a single user only).
 */
export async function checkAdmission(
  store: GammaStore,
  config: GammaConfig,
  userId: string,
  cards: number,
  now: number,
): Promise<void> {
  if (cards > config.maxCardsPerRun) {
    throw new GammaError("budget_exceeded", `Deck has ${cards} cards; GAMMA_MAX_CARDS_PER_RUN is ${config.maxCardsPerRun}.`);
  }
  const [hour, day] = await Promise.all([store.countStartedSince(userId, now - HOUR), store.countStartedSince(userId, now - DAY)]);
  if (hour >= config.userHourlyLimit) {
    throw new GammaError("user_rate_limited", `Gamma generation limit reached (${config.userHourlyLimit} per hour per user).`);
  }
  if (day >= config.userDailyLimit) {
    throw new GammaError("user_rate_limited", `Gamma generation limit reached (${config.userDailyLimit} per day per user).`);
  }
  const rows = await store.rowsSince(now - 30 * DAY);
  const charged = (since: number) =>
    rows
      .filter((r) => r.createdAt >= since)
      .reduce((sum, r) => {
        if (r.creditsDeducted !== null) return sum + r.creditsDeducted;
        return sum + (UNSETTLED.includes(r.status) || r.status === "completed" ? config.estimatedCreditsPerRun : 0);
      }, 0);
  if (charged(now - DAY) + config.estimatedCreditsPerRun > config.dailyCreditBudget) {
    throw new GammaError("budget_exceeded", `Daily Gamma credit budget (${config.dailyCreditBudget}) would be exceeded.`);
  }
  if (charged(now - 30 * DAY) + config.estimatedCreditsPerRun > config.monthlyCreditBudget) {
    throw new GammaError("budget_exceeded", `Monthly Gamma credit budget (${config.monthlyCreditBudget}) would be exceeded.`);
  }
}
