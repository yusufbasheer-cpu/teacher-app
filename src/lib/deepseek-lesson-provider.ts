import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";

export const DEEPSEEK_LESSON_API_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_LESSON_MODEL = "deepseek-chat" as const;

export function deepSeekLessonHttpErrorMessage(status: number, rawBody: string): string {
  const trimmed = rawBody.trim();
  if (status === 401) {
    return "DeepSeek API key is invalid or expired. Please update DEEPSEEK_API_KEY.";
  }
  if (status === 402) {
    return "DeepSeek account has insufficient credits. Please top up your DeepSeek balance.";
  }
  if (status === 429) {
    return "DeepSeek rate limit reached. Please retry in a few moments.";
  }
  return `DeepSeek HTTP ${status}: ${trimmed.slice(0, 800) || "No response body."}`;
}

export type DeepSeekLessonMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callDeepSeekLessonChat(params: {
  apiKey: string;
  logLabel: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}): Promise<{ content: string } | { error: string }> {
  let deepseekResponse: Response;
  try {
    deepseekResponse = await fetch(DEEPSEEK_LESSON_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_LESSON_MODEL,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userMessage },
        ],
      }),
      ...(params.signal ? { signal: params.signal } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `DeepSeek request failed: ${msg}` };
  }

  const rawBody = await deepseekResponse.text();
  logDeepSeekRawResponse(params.logLabel, deepseekResponse, rawBody);

  if (!deepseekResponse.ok) {
    return { error: deepSeekLessonHttpErrorMessage(deepseekResponse.status, rawBody) };
  }

  const completion = parseDeepSeekCompletionBody(rawBody);
  const content = completion.content?.trim();
  if (!content) {
    return { error: completion.errorMessage ?? "DeepSeek returned no content." };
  }

  return { content };
}
