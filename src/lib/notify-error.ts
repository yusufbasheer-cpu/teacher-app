"use client";

import { toast } from "sonner";
import { sanitizeUserMessage, toUserFacingError } from "@/lib/user-facing-errors";

/**
 * For one-off errors with no local `error` state to piggyback on (e.g. a
 * background action, a button click with no inline error UI). Sanitizes a
 * thrown value, logs the real one, shows a toast, and returns the safe
 * message in case the caller also wants it.
 */
export function notifyError(err: unknown, logContext?: string): string {
  const message = toUserFacingError(err, logContext);
  toast.error(message);
  return message;
}

/** Same as `notifyError`, for an already-string message (e.g. an API `error` field). */
export function notifyErrorMessage(
  message: string | null | undefined,
  logContext?: string,
): string {
  const safe = sanitizeUserMessage(message, logContext);
  toast.error(safe);
  return safe;
}
