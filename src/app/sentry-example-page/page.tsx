"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

/**
 * Sentry test page — /sentry-example-page
 * DELETE or password-protect before public launch if you don't want it visible.
 * Mirrors what the Sentry wizard normally creates.
 */
export default function SentryExamplePage() {
  const [sent, setSent] = useState(false);

  const throwClientError = () => {
    throw new Error(
      "[Sentry Test] Client-side error from /sentry-example-page — you should see this in your Sentry dashboard.",
    );
  };

  const captureManually = () => {
    Sentry.captureException(
      new Error(
        "[Sentry Test] Manual captureException from /sentry-example-page",
      ),
    );
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-16 font-sans">
      <h1 className="text-2xl font-bold text-slate-900">Sentry Test Page</h1>
      <p className="mt-2 text-sm text-slate-600">
        Use the buttons below to verify Sentry is capturing errors correctly.
        Check your{" "}
        <a
          href="https://sentry.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00C6A7] underline"
        >
          Sentry dashboard
        </a>{" "}
        for the events after clicking.
      </p>

      <div className="mt-8 space-y-4">
        {/* Unhandled client error — React error boundary will catch this */}
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">
            Test 1 — Unhandled React error
          </p>
          <p className="mt-1 text-xs text-red-700">
            Throws an unhandled exception. React catches it; Sentry should log
            it automatically.
          </p>
          <button
            type="button"
            onClick={throwClientError}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Throw client error
          </button>
        </div>

        {/* Manual captureException */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Test 2 — Manual captureException
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Calls <code>Sentry.captureException</code> directly. The page
            stays intact; look for the event in Sentry.
          </p>
          <button
            type="button"
            onClick={captureManually}
            className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600"
          >
            Capture exception manually
          </button>
          {sent ? (
            <p className="mt-2 text-xs font-medium text-green-700">
              ✅ Event sent — check your Sentry dashboard
            </p>
          ) : null}
        </div>

        {/* Server-side error via API */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">
            Test 3 — Server-side API error
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Hits <code>/api/sentry-example-api</code> which throws on the
            server. Should appear in Sentry as a server error.
          </p>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch("/api/sentry-example-api");
              alert(
                res.ok
                  ? "API responded OK (no error thrown)"
                  : `API returned ${res.status} — check Sentry for the server error`,
              );
            }}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Trigger server error
          </button>
        </div>
      </div>

      <p className="mt-10 text-xs text-slate-400">
        This page is for internal testing only. Remove it before sharing with
        users.
      </p>
    </div>
  );
}
