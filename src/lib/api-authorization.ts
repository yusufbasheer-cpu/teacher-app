import { timingSafeEqual } from "node:crypto";

/**
 * Verify a server-to-server bearer secret without leaking a useful timing
 * signal. A missing server secret always fails closed.
 */
export function hasValidInternalBearer(req: Request, expectedSecret: string | undefined): boolean {
  const secret = expectedSecret?.trim();
  if (!secret) return false;

  const authorization = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
