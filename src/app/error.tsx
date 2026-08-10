"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

/**
 * App Router error boundary — catches render errors anywhere under the root
 * layout (except the layout itself; see global-error.tsx for that case).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF6EF] p-8 text-center">
      <p className="text-3xl">⚠️</p>
      <h1 className="text-xl font-semibold" style={{ color: "#241A12" }}>
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-stone-600">
        This page ran into an unexpected error. It has been reported — please try again.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: "#0E9484" }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
