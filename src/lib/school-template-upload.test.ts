import { describe, expect, it } from "vitest";
import {
  TEMPLATE_MAX_BYTES,
  checkTemplateFile,
  isTemplateUploadIssueCode,
  templateUploadIssue,
  type TemplateUploadIssueCode,
} from "./school-template-upload";

describe("checkTemplateFile", () => {
  it("accepts a normal .pptx, in any letter case", () => {
    expect(checkTemplateFile({ name: "School Template.pptx", size: 4 * 1024 * 1024 })).toBeNull();
    expect(checkTemplateFile({ name: "SCHOOL.PPTX", size: 1000 })).toBeNull();
  });

  it("accepts a file exactly at the size limit but not one byte over", () => {
    expect(checkTemplateFile({ name: "a.pptx", size: TEMPLATE_MAX_BYTES })).toBeNull();
    const over = checkTemplateFile({ name: "a.pptx", size: TEMPLATE_MAX_BYTES + 1 });
    expect(over?.code).toBe("TOO_LARGE");
  });

  it("names the actual size when a file is too large", () => {
    const issue = checkTemplateFile({ name: "big.pptx", size: 22 * 1024 * 1024 });
    expect(issue?.message).toContain("22.0 MB");
    expect(issue?.message).toContain("15 MB");
  });

  it("explains an old .ppt file separately from other wrong types", () => {
    expect(checkTemplateFile({ name: "old.ppt", size: 1000 })?.code).toBe("OLD_PPT_FORMAT");
    for (const name of ["deck.pdf", "deck.key", "deck.potx", "deck.ppsx", "notes.docx", "logo.png", "noextension"]) {
      expect(checkTemplateFile({ name, size: 1000 })?.code, name).toBe("WRONG_FILE_TYPE");
    }
  });

  it("rejects an empty file", () => {
    expect(checkTemplateFile({ name: "a.pptx", size: 0 })?.code).toBe("EMPTY_FILE");
  });
});

describe("templateUploadIssue", () => {
  const codes: TemplateUploadIssueCode[] = [
    "NO_FILE", "EMPTY_FILE", "TOO_LARGE", "OLD_PPT_FORMAT", "WRONG_FILE_TYPE", "NOT_A_PRESENTATION", "UNREADABLE",
    "BLOCKED_BY_SCAN", "SESSION_EXPIRED", "RATE_LIMITED", "SAVE_FAILED", "NETWORK", "UNKNOWN",
  ];

  it("gives every failure a message and at least one step to fix it", () => {
    for (const code of codes) {
      const issue = templateUploadIssue(code);
      expect(issue.message.length, code).toBeGreaterThan(10);
      expect(issue.steps.length, code).toBeGreaterThan(0);
    }
  });

  it("never leaks technical wording into the advice", () => {
    for (const code of codes) {
      const text = JSON.stringify(templateUploadIssue(code)).toLowerCase();
      for (const bad of ["supabase", "sql", "jszip", "exception", "stack", "undefined", "null"]) {
        expect(text.includes(bad), `${code} mentions "${bad}"`).toBe(false);
      }
    }
  });

  it("lets the server override the headline but keeps the steps", () => {
    const issue = templateUploadIssue("TOO_LARGE", "That file is 22.0 MB.");
    expect(issue.message).toBe("That file is 22.0 MB.");
    expect(issue.steps.length).toBeGreaterThan(0);
  });

  it("recognises only real codes", () => {
    expect(isTemplateUploadIssueCode("TOO_LARGE")).toBe(true);
    expect(isTemplateUploadIssueCode("MADE_UP")).toBe(false);
    expect(isTemplateUploadIssueCode(undefined)).toBe(false);
  });
});
