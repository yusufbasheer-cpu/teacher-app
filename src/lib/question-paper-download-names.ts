/** Client-safe download filenames (no Node.js / docx imports). */

export function questionPaperDownloadFileName(
  kind: "paper" | "blueprint" | "zip",
  subject: string,
  grade: string,
): string {
  const sub = subject.trim().replace(/\s+/g, "_").replace(/[^\w-]/gi, "") || "Subject";
  const gr = grade.trim().replace(/\s+/g, "_").replace(/[^\w-]/gi, "") || "Grade";
  if (kind === "paper") return `Question_Paper_${sub}_${gr}.docx`;
  if (kind === "blueprint") return `Blueprint_${sub}_${gr}.docx`;
  return `Complete_Pack_${sub}_${gr}.zip`;
}
