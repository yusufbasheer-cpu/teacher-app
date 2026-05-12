/**
 * Parse DeepSeek chat/completions HTTP response bodies.
 * Handles truncated JSON by extracting partial `message.content` when possible.
 */

type DeepSeekChoiceMessage = { content?: string };
type DeepSeekChoice = { message?: DeepSeekChoiceMessage };
type DeepSeekOkBody = {
  choices?: DeepSeekChoice[];
  error?: { message?: string };
};

export function looksLikeJsonObject(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{");
}

/** Unescape a JSON string value scanned byte-by-byte (supports truncated tail). */
function scanJsonStringContent(s: string, startIndex: number): { text: string; end: number } {
  let i = startIndex;
  let out = "";
  while (i < s.length) {
    const c = s[i]!;
    if (c === "\\") {
      if (i + 1 >= s.length) break;
      const e = s[i + 1]!;
      if (e === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (e === "r") {
        out += "\r";
        i += 2;
        continue;
      }
      if (e === "t") {
        out += "\t";
        i += 2;
        continue;
      }
      if (e === "u" && i + 5 < s.length) {
        const hex = s.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
      }
      out += e;
      i += 2;
      continue;
    }
    if (c === '"') {
      i += 1;
      return { text: out, end: i };
    }
    out += c;
    i += 1;
  }
  return { text: out, end: i };
}

function tryExtractMessageContentFromPartialJson(raw: string): string | undefined {
  const m = raw.match(/"message"\s*:\s*\{\s*"content"\s*:\s*"/);
  if (!m || m.index === undefined) return undefined;
  const start = m.index + m[0].length;
  const { text } = scanJsonStringContent(raw, start);
  return text.trim().length > 0 ? text : undefined;
}

/**
 * Reads DeepSeek JSON body; never throws. On parse failure, attempts partial content extraction.
 */
export function parseDeepSeekCompletionBody(raw: string): {
  content?: string;
  errorMessage?: string;
} {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { errorMessage: "Empty response body from DeepSeek." };
  }

  if (!looksLikeJsonObject(trimmed)) {
    return {
      content: trimmed,
      errorMessage: "DeepSeek returned plain text instead of JSON; using raw text fallback.",
    };
  }

  try {
    const data = JSON.parse(trimmed) as DeepSeekOkBody;
    if (data.error?.message) {
      return { errorMessage: data.error.message };
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return { content };
    }
    return { errorMessage: "DeepSeek JSON had no assistant message content." };
  } catch {
    const partial = tryExtractMessageContentFromPartialJson(trimmed);
    if (partial !== undefined) {
      return {
        content: partial,
        errorMessage:
          "DeepSeek response JSON was incomplete; recovered partial assistant text from the raw body.",
      };
    }
    return {
      content: trimmed,
      errorMessage:
        "Could not parse DeepSeek response as JSON. Falling back to raw response text.",
    };
  }
}
