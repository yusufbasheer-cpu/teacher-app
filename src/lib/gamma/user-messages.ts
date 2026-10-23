import type { GammaErrorCode } from "./config";

/**
 * Teacher-facing copy for every Gamma failure. The technical message stays in server logs only.
 * `resumable` means the same request can simply be sent again: the server resumes the existing
 * generation by its id, so it never starts (or pays for) a second one.
 */
const MESSAGES: Record<GammaErrorCode, { message: string; resumable?: boolean }> = {
  poll_timeout: { message: "Your slides are still being designed. We'll keep going.", resumable: true },
  deadline_exceeded: { message: "Your slides are still being designed. We'll keep going.", resumable: true },
  request_timeout: { message: "The connection was slow. We'll pick up where we left off.", resumable: true },
  generation_in_progress: { message: "Your previous presentation is still being designed. Please try again in a minute." },
  duplicate_in_flight: { message: "Your presentation is already being designed. Please wait a moment and try again." },
  card_limit_exceeded: { message: "This lesson has too many physical slides for Gamma. Shorten a dense section; activity instructions and tasks will not be removed." },
  submission_unknown: { message: "We couldn't confirm your last request went through. Please try again in a few minutes." },
  rate_limited: { message: "Lots of teachers are designing slides right now. Please try again in a minute." },
  user_rate_limited: { message: "You've designed several presentations recently. Please try again a little later." },
  budget_exceeded: { message: "Slide design is paused for today. Please try again tomorrow, or download the standard Layah slides." },
  insufficient_credits: { message: "Slide design is temporarily unavailable. Please download the standard Layah slides for now." },
  invalid_credentials: { message: "Slide design is temporarily unavailable. Please download the standard Layah slides for now." },
  missing_credentials: { message: "Slide design is temporarily unavailable. Please download the standard Layah slides for now." },
  export_host_unconfigured: { message: "Slide design is temporarily unavailable. Please download the standard Layah slides for now." },
  store_unavailable: { message: "Slide design is temporarily unavailable. Please try again shortly." },
  bad_request: { message: "We couldn't design slides for this lesson with the chosen look. Try another theme." },
  generation_failed: { message: "The slide design didn't finish this time. Please try again." },
  api_error: { message: "The slide design service had a hiccup. Please try again." },
  download_rejected: { message: "Your slides are ready but couldn't be downloaded. Please try again." },
  invalid_export: { message: "Your slides came back damaged. Please try again." },
};

export function gammaUserMessage(code: GammaErrorCode): { message: string; resumable: boolean } {
  const m = MESSAGES[code] ?? { message: "Something went wrong while designing your slides. Please try again." };
  return { message: m.message, resumable: m.resumable === true };
}
