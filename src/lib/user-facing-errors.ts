/** Shown to teachers when generation or server operations fail — never technical details. */
export const USER_FACING_ERROR =
  "Something went wrong. Please try again.";

/** Embedded in generated lesson text when a section fails (no technical detail). */
export const SECTION_GENERATION_FAILED =
  "_(This section could not be generated. Please try again.)_";

const TECHNICAL_PATTERNS = [
  "deepseek",
  "fal.ai",
  "fal ",
  "fal/",
  "flux",
  "api key",
  "api_key",
  "deekseek-ping",
  "deepseek-ping",
  "/api/",
  "http ",
  "http/",
  "json",
  ".env",
  "env.local",
  "supabase",
  "raw response",
  "network error",
  "top up",
  "billing",
  "pexels",
  "missing deepseek",
  "unauthorized",
  "invalid session",
  "generation allowance",
  "postgrest",
  "rls",
  "eaddrinuse",
  "stack",
  "syntaxerror",
  "unexpected token",
  "---",
  "[http",
];

/** Messages that are safe to show as-is (validation / auth UX). */
const ALLOWED_USER_MESSAGES = new Set([
  "select at least one item to generate.",
  "loading your generation allowance…",
  "please log in.",
  "login required.",
  "checking your account…",
  "authentication failed.",
  "google sign-in failed.",
  "account created. if email confirmation is enabled, check your inbox before logging in.",
  "add lesson source text (from your plan or an uploaded document).",
  "please fill topic, subject, grade, and learning objectives.",
  "upload or paste lesson content first.",
]);

export function isTechnicalUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (ALLOWED_USER_MESSAGES.has(lower)) return false;
  if (trimmed.length > 120) return true;
  return TECHNICAL_PATTERNS.some((p) => lower.includes(p));
}

/** Map any error to a teacher-safe string; log the real message for developers. */
export function toUserFacingError(err: unknown, logContext?: string): string {
  const technical =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  if (logContext) {
    console.error(`[${logContext}]`, technical);
  } else {
    console.error("[user-facing-error]", technical);
  }
  if (!isTechnicalUserMessage(technical)) {
    return technical.trim();
  }
  return USER_FACING_ERROR;
}

/** Sanitize API `error` fields before displaying in the UI. */
export function sanitizeUserMessage(message: string | undefined | null, logContext?: string): string {
  const trimmed = message?.trim() ?? "";
  if (!trimmed) return USER_FACING_ERROR;
  if (!isTechnicalUserMessage(trimmed)) return trimmed;
  if (logContext) {
    console.error(`[${logContext}] suppressed technical UI message:`, trimmed);
  }
  return USER_FACING_ERROR;
}
