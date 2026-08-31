import { afterEach, describe, expect, it, vi } from "vitest";

const logDeepSeekRawResponseImpl = vi.hoisted(() => vi.fn());
const parseDeepSeekCompletionBodyImpl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/deepseek-log-raw", () => ({
  logDeepSeekRawResponse: logDeepSeekRawResponseImpl,
}));

vi.mock("@/lib/deepseek-chat-parse", () => ({
  parseDeepSeekCompletionBody: parseDeepSeekCompletionBodyImpl,
}));

import {
  DEEPSEEK_LESSON_API_URL,
  DEEPSEEK_LESSON_MODEL,
  callDeepSeekLessonChat,
  deepSeekLessonHttpErrorMessage,
} from "./deepseek-lesson-provider";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("deepseek-lesson-provider", () => {
  it("sends the expected DeepSeek lesson request shape", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "  lesson body  " } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    parseDeepSeekCompletionBodyImpl.mockReturnValue({ content: "  lesson body  " });

    const result = await callDeepSeekLessonChat({
      apiKey: "test-api-key-123",
      logLabel: "lesson-plan:Full Lesson Plan",
      systemPrompt: "system prompt",
      userMessage: "user prompt",
      maxTokens: 4321,
      temperature: 0.55,
      signal,
    });

    expect(result).toEqual({ content: "lesson body" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      DEEPSEEK_LESSON_API_URL,
      expect.objectContaining({
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key-123",
        },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      model: string;
      temperature: number;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe(DEEPSEEK_LESSON_MODEL);
    expect(body.temperature).toBe(0.55);
    expect(body.max_tokens).toBe(4321);
    expect(body.messages).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "user prompt" },
    ]);
    expect(logDeepSeekRawResponseImpl).toHaveBeenCalledTimes(1);
    expect(logDeepSeekRawResponseImpl).toHaveBeenCalledWith(
      "lesson-plan:Full Lesson Plan",
      expect.any(Response),
      expect.any(String),
    );
  });

  it("surfaces HTTP errors and parse failures as provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("rate limited", {
        status: 429,
        headers: { "content-type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    parseDeepSeekCompletionBodyImpl.mockReturnValue({ errorMessage: "DeepSeek returned no content." });

    await expect(
      callDeepSeekLessonChat({
        apiKey: "test-api-key-123",
        logLabel: "lesson-plan:AFL-Activity-Sheets",
        systemPrompt: "system prompt",
        userMessage: "user prompt",
        maxTokens: 1234,
        temperature: 0.5,
      }),
    ).resolves.toEqual({
      error: deepSeekLessonHttpErrorMessage(429, "rate limited"),
    });
  });

  it("reports fetch failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(
      callDeepSeekLessonChat({
        apiKey: "test-api-key-123",
        logLabel: "lesson-plan:Full Lesson Plan",
        systemPrompt: "system prompt",
        userMessage: "user prompt",
        maxTokens: 1234,
        temperature: 0.5,
      }),
    ).resolves.toEqual({ error: "DeepSeek request failed: network down" });
  });
});
