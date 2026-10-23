export const CONTACT_LIMITS = { name: 100, email: 254, subject: 120, messageMin: 10, message: 5000 } as const;

export type ContactInput = { name: string; email: string; subject: string; message: string };

export type ContactParseResult =
  | { ok: true; value: ContactInput }
  | { ok: false; field: keyof ContactInput; error: string };

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Server-side validation. Header-bound fields (name/subject/email) must be single-line. */
export function parseContactBody(body: unknown): ContactParseResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const value = { name: clean(b.name), email: clean(b.email), subject: clean(b.subject), message: clean(b.message) };

  if (!value.name) return { ok: false, field: "name", error: "Please enter your name." };
  if (!value.email || !EMAIL_RE.test(value.email) || value.email.length > CONTACT_LIMITS.email)
    return { ok: false, field: "email", error: "Please enter a valid email address." };
  if (!value.subject) return { ok: false, field: "subject", error: "Please choose a subject." };
  if (value.message.length < CONTACT_LIMITS.messageMin)
    return { ok: false, field: "message", error: "Please write at least a few words so we can help." };

  if (value.name.length > CONTACT_LIMITS.name || /[\r\n]/.test(value.name))
    return { ok: false, field: "name", error: "Please shorten your name." };
  if (value.subject.length > CONTACT_LIMITS.subject || /[\r\n]/.test(value.subject))
    return { ok: false, field: "subject", error: "Please choose a valid subject." };
  if (value.message.length > CONTACT_LIMITS.message)
    return { ok: false, field: "message", error: `Messages are limited to ${CONTACT_LIMITS.message} characters.` };

  return { ok: true, value };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
