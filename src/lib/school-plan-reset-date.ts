/** First day of next calendar month (YYYY-MM-DD) for user_usage.reset_date. */
export function schoolPlanResetDate(): string {
  return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];
}
