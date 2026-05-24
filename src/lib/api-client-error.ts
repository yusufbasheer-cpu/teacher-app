import { NextResponse } from "next/server";
import { USER_FACING_ERROR } from "@/lib/user-facing-errors";

/** Log technical detail server-side; return a generic message to the client. */
export function apiErrorResponse(
  technicalMessage: string,
  status: number,
  logLabel: string,
): NextResponse {
  console.error(`[${logLabel}]`, technicalMessage);
  return NextResponse.json({ error: USER_FACING_ERROR }, { status });
}
