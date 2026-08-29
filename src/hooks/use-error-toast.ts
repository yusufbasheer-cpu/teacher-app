"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * Drop-in replacement for `useState<string | null>(null)` (or `useState<string>("")`
 * via `useErrorToast<string>("")`) on error-message state. Setting a non-empty
 * message still updates local state as before, but also fires a toast — so
 * every existing `setError(...)` call across the app surfaces a toast
 * automatically, with no call-site changes needed beyond this declaration.
 *
 * Messages are expected to already be teacher-safe by the time they reach
 * here (see src/lib/user-facing-errors.ts) — this hook only handles display.
 */
export function useErrorToast<T extends string | null = string | null>(
  initial: T = null as T,
): readonly [T, (message: T) => void] {
  const [error, setErrorState] = useState<T>(initial);

  const setError = useCallback((message: T) => {
    setErrorState(message);
    if (message) toast.error(message);
  }, []);

  return [error, setError] as const;
}
