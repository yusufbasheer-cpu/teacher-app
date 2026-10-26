import { describe, expect, it } from "vitest";
import { hasValidInternalBearer } from "./api-authorization";

const request = (authorization?: string) =>
  new Request("https://example.test/api/internal", {
    headers: authorization ? { authorization } : undefined,
  });

describe("hasValidInternalBearer", () => {
  it("accepts the configured bearer secret", () => {
    expect(hasValidInternalBearer(request("Bearer correct-secret"), "correct-secret")).toBe(true);
  });

  it("rejects missing, malformed, and incorrect credentials", () => {
    expect(hasValidInternalBearer(request(), "correct-secret")).toBe(false);
    expect(hasValidInternalBearer(request("correct-secret"), "correct-secret")).toBe(false);
    expect(hasValidInternalBearer(request("Bearer wrong-secret"), "correct-secret")).toBe(false);
  });

  it("fails closed when the server secret is not configured", () => {
    expect(hasValidInternalBearer(request("Bearer undefined"), undefined)).toBe(false);
    expect(hasValidInternalBearer(request("Bearer "), "   ")).toBe(false);
  });
});
