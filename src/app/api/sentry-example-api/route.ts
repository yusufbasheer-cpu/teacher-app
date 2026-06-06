import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/sentry-example-api
 * Deliberately throws a server-side error so Sentry can be verified.
 * DELETE this route once testing is complete.
 */
export async function GET() {
  try {
    throw new Error(
      "[Sentry Test] Server-side error from /api/sentry-example-api — you should see this in your Sentry dashboard.",
    );
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Deliberate test error — check Sentry dashboard for the event." },
      { status: 500 },
    );
  }
}
