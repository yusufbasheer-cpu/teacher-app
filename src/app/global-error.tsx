"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort error boundary — only triggers if the root layout itself
 * throws. Must render its own <html>/<body> since it replaces the layout.
 */
export default function GlobalError({
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
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ fontSize: "2rem" }}>⚠️</p>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--text)" }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: 420, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Layah ran into an unexpected error. It has been reported — please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: "0.75rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#fff",
              backgroundColor: "var(--brand)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
