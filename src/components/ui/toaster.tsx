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
          error: "!border-[#F0C6C6] !bg-[#FDF2F2] !text-[#7A2020]",
          success: "!border-[#BFE3D8] !bg-[#EEF7F4] !text-[#0E5B4E]",
          warning: "!border-[#EFD9A0] !bg-[#FDF6E9] !text-[#6B4E10]",
          info: "!border-[color-mix(in oklch, var(--brand) 30%, transparent)] !bg-[var(--canvas)] !text-[var(--text)]",
        },
      }}
    />
  );
}
