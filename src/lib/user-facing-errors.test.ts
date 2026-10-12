import { describe, expect, it } from "vitest";
import { sanitizeUserMessage, USER_FACING_ERROR } from "./user-facing-errors";

describe("sanitizeUserMessage", () => {
  it("passes a short, human message through untouched", () => {
    expect(sanitizeUserMessage("Template file is too large (max 15 MB).", "t")).toBe(
      "Template file is too large (max 15 MB).",
    );
  });

  it("falls back to the generic message by default", () => {
    expect(sanitizeUserMessage("Unexpected token < in JSON", "t")).toBe(USER_FACING_ERROR);
    expect(sanitizeUserMessage("", "t")).toBe(USER_FACING_ERROR);
  });

  it("uses the caller's specific fallback for technical or empty messages", () => {
    const fallback = "We couldn't save your profile. Please try again.";
    expect(sanitizeUserMessage("TypeError: Failed to fetch", "t", fallback)).toBe(fallback);
    expect(sanitizeUserMessage(null, "t", fallback)).toBe(fallback);
  });

  it("does not replace a readable message with the fallback", () => {
    expect(sanitizeUserMessage("Only .pptx files are accepted.", "t", "fallback")).toBe(
      "Only .pptx files are accepted.",
    );
  });
});
