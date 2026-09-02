"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast container, brand-styled to match the cream/teal card look
 * used across auth, dashboard, and the generator pages (see AuthCard, PageLoader).
 * Fire toasts via `useErrorToast` (src/hooks/use-error-toast.ts) for component
 * error state, or `notifyError`/`notifyErrorMessage` (src/lib/notify-error.ts)
 * for one-off errors with no local state. Success/info: `toast.success(...)` /
 * `toast(...)` from "sonner" directly.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      gap={10}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 font-sans shadow-lg shadow-black/5 backdrop-blur-sm",
          title: "text-sm font-semibold leading-snug",
          description: "text-sm leading-snug opacity-90",
          closeButton:
            "!left-auto !right-1.5 !top-1.5 !border-none !bg-transparent !text-current opacity-50 hover:opacity-100",
          error: "!border-danger-border !bg-danger-subtle !text-danger-text",
          success: "!border-brand-border !bg-brand-subtle !text-brand-text",
          warning: "!border-gen-border !bg-gen-subtle !text-gen-text",
          info: "!border-[color-mix(in oklch, var(--brand) 30%, transparent)] !bg-canvas !text-ink",
        },
      }}
    />
  );
}
