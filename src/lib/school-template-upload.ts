/**
 * School PowerPoint template uploads: the rules, and the wording for every way an upload can
 * fail. Shared by the browser (checks the file before sending it) and the upload route (reports
 * what it found), so the limits and the advice cannot drift apart.
 */

export const TEMPLATE_MAX_MB = 15;
export const TEMPLATE_MAX_BYTES = TEMPLATE_MAX_MB * 1024 * 1024;
export const TEMPLATE_ACCEPT_ATTRIBUTE =
  ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** One line to show next to the upload button, before anything goes wrong. */
export const TEMPLATE_REQUIREMENTS_LINE = `Accepted: PowerPoint .pptx files up to ${TEMPLATE_MAX_MB} MB.`;

export const TEMPLATE_SUPPORT_EMAIL = "info@layah.in";

export type TemplateUploadIssueCode =
  | "NO_FILE"
  | "EMPTY_FILE"
  | "TOO_LARGE"
  | "OLD_PPT_FORMAT"
  | "WRONG_FILE_TYPE"
  | "NOT_A_PRESENTATION"
  | "UNREADABLE"
  | "BLOCKED_BY_SCAN"
  | "SESSION_EXPIRED"
  | "RATE_LIMITED"
  | "SAVE_FAILED"
  | "NETWORK"
  | "UNKNOWN";

export type TemplateUploadIssue = {
  code: TemplateUploadIssueCode;
  /** What went wrong, in one sentence. */
  message: string;
  /** What the teacher can do about it, most likely fix first. */
  steps: string[];
};

const SAVE_AS_PPTX = "In PowerPoint choose File → Save As → PowerPoint Presentation (*.pptx), then upload that new copy.";
const OTHER_APPS =
  "Made in Google Slides or Keynote? Google Slides: File → Download → Microsoft PowerPoint (.pptx). Keynote: File → Export To → PowerPoint.";

const ISSUES: Record<TemplateUploadIssueCode, Omit<TemplateUploadIssue, "code">> = {
  NO_FILE: {
    message: "No file was received.",
    steps: ["Choose your school's PowerPoint (.pptx) file and try again."],
  },
  EMPTY_FILE: {
    message: "That file is empty (0 KB).",
    steps: [
      "Open the file on your computer to check it has slides in it.",
      "If it lives in OneDrive, Google Drive or a similar service, make sure it has finished downloading before you upload it.",
    ],
  },
  TOO_LARGE: {
    message: `That file is larger than the ${TEMPLATE_MAX_MB} MB limit.`,
    steps: [
      "In PowerPoint choose File → Info → Compress Pictures (or Picture Format → Compress Pictures), pick \"Web (150 ppi)\", and save a copy.",
      "Delete example slides you don't need — a template only needs a few slides: a title slide and one or two content slides.",
      "Remove large videos and audio, which templates don't need.",
    ],
  },
  OLD_PPT_FORMAT: {
    message: "That is an older PowerPoint file (.ppt), or a password-protected one. Only .pptx is supported.",
    steps: [
      SAVE_AS_PPTX,
      "If the file asks for a password to open, remove it first (File → Info → Protect Presentation → Encrypt with Password, then clear the password and save).",
    ],
  },
  WRONG_FILE_TYPE: {
    message: "That file type can't be used as a template. Only PowerPoint .pptx files are accepted.",
    steps: [SAVE_AS_PPTX, OTHER_APPS, "PDFs, images, Word files and .potx/.ppsx/.key/.odp files can't be used directly."],
  },
  NOT_A_PRESENTATION: {
    message: "That file has a .pptx name, but it doesn't contain a PowerPoint presentation.",
    steps: [
      "Open it in PowerPoint to check it opens normally. If it doesn't, the file may be damaged or not a presentation at all.",
      SAVE_AS_PPTX,
      "Files that were only renamed to .pptx (for example a Word file or a PDF) don't work — export them from the original app instead.",
    ],
  },
  UNREADABLE: {
    message: "We couldn't read this PowerPoint.",
    steps: [
      "Open it in PowerPoint, make sure it opens without a repair prompt, then " + SAVE_AS_PPTX.charAt(0).toLowerCase() + SAVE_AS_PPTX.slice(1),
      OTHER_APPS,
      "If the file is password-protected, remove the password first.",
    ],
  },
  BLOCKED_BY_SCAN: {
    message: "This file was blocked by our security scan.",
    steps: [
      "Export a fresh copy from PowerPoint (File → Save As → .pptx) and upload that.",
      "Remove macros, embedded files and linked content if the deck has any.",
    ],
  },
  SESSION_EXPIRED: {
    message: "Your session has expired.",
    steps: ["Log in again, then re-upload your template. Your lesson will still be here."],
  },
  RATE_LIMITED: {
    message: "You've uploaded several templates in a short time.",
    steps: ["Wait a few minutes, then try again."],
  },
  SAVE_FAILED: {
    message: "Your template was read, but we couldn't save it to your account.",
    steps: ["Try again in a minute.", `If it keeps happening, email ${TEMPLATE_SUPPORT_EMAIL} and mention the file name.`],
  },
  NETWORK: {
    message: "We couldn't reach Layah to upload your PowerPoint.",
    steps: [
      "Check your internet connection and try again.",
      "On a slow connection, a smaller file uploads more reliably — compress its pictures first.",
    ],
  },
  UNKNOWN: {
    message: "Your PowerPoint couldn't be uploaded.",
    steps: [
      `Check that it is a .pptx file under ${TEMPLATE_MAX_MB} MB.`,
      SAVE_AS_PPTX,
      `Still stuck? Email ${TEMPLATE_SUPPORT_EMAIL} with the file name and we'll help.`,
    ],
  },
};

export function templateUploadIssue(code: TemplateUploadIssueCode, overrideMessage?: string): TemplateUploadIssue {
  const base = ISSUES[code] ?? ISSUES.UNKNOWN;
  return { code, message: overrideMessage?.trim() || base.message, steps: base.steps };
}

export function isTemplateUploadIssueCode(value: unknown): value is TemplateUploadIssueCode {
  return typeof value === "string" && value in ISSUES;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Cheap checks on the chosen file, run in the browser before anything is uploaded.
 * Returns null when the file looks acceptable (the server still does the real checks).
 */
export function checkTemplateFile(file: { name: string; size: number }): TemplateUploadIssue | null {
  const name = file.name.toLowerCase();
  if (file.size === 0) return templateUploadIssue("EMPTY_FILE");
  if (name.endsWith(".ppt")) return templateUploadIssue("OLD_PPT_FORMAT");
  if (!name.endsWith(".pptx")) return templateUploadIssue("WRONG_FILE_TYPE");
  if (file.size > TEMPLATE_MAX_BYTES) {
    return templateUploadIssue("TOO_LARGE", `That file is ${formatFileSize(file.size)}, which is over the ${TEMPLATE_MAX_MB} MB limit.`);
  }
  return null;
}
