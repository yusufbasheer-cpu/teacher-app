import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";

export const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

export function deepSeekHttpErrorMessage(status: number, rawBody: string): string {
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

export function getDeepSeekApiKey(): string | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey || apiKey.length < 12) return null;
  return apiKey;
}

export async function callDeepSeekChat(params: {
  logLabel: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature: number;
}): Promise<{ content: string } | { error: string }> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    return { error: "Missing or invalid DEEPSEEK_API_KEY in environment variables." };
  }

  let deepseekResponse: Response;
  try {
    deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userMessage },
        ],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `DeepSeek request failed: ${msg}` };
  }

  const rawBody = await deepseekResponse.text();
  logDeepSeekRawResponse(params.logLabel, deepseekResponse, rawBody);

  if (!deepseekResponse.ok) {
    return { error: deepSeekHttpErrorMessage(deepseekResponse.status, rawBody) };
  }

  const completion = parseDeepSeekCompletionBody(rawBody);
  const content = completion.content?.trim();
  if (!content) {
    return { error: completion.errorMessage ?? "DeepSeek returned no content." };
  }

  return { content };
}
