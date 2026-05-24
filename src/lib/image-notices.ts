/** True if a notice should not be shown to teachers (fal/FLUX/billing — dev console only). */
export function isFalRelatedUserNotice(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("fal.ai") ||
    lower.includes("fal ") ||
    lower.includes("fal/") ||
    lower.includes("flux") ||
    lower.includes("top up") ||
    lower.includes("dashboard/billing") ||
    lower.includes("ai image failed") ||
    lower.includes("image generation failed") ||
    lower.includes("deepseek") ||
    lower.includes("deekseek") ||
    lower.includes("env.local") ||
    lower.includes("could not parse") ||
    lower.includes("recovery notice") ||
    lower.includes("marker fallback")
  );
}

/** Strip fal-related notices before showing parseNotice to users. */
export function filterUserFacingNotices(notices: string[]): string[] {
  return notices.filter((n) => n.trim().length > 0 && !isFalRelatedUserNotice(n));
}
