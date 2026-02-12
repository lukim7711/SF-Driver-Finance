/**
 * Workers AI Provider
 * Handles intent detection using Cloudflare Workers AI with Qwen3-30B-A3B model.
 * This is the PRIMARY (free) AI provider.
 */

import type { IntentResultWithProvider } from "../types/intent";
import { buildIntentPrompt } from "./prompt";
import { parseIntentResponse } from "./parser";

/** The primary AI model — MoE with 30B total params, 3B active (~4.4 Neurons/req) */
const PRIMARY_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

/** OpenAI-compatible chat completion response (used by newer models like Qwen3) */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/** Simple Workers AI text generation response (used by older models) */
interface SimpleAiResponse {
  response?: string;
}

/** Union of possible response formats */
type WorkersAIResponse = ChatCompletionResponse | SimpleAiResponse | string;

/**
 * Extract text content from a Workers AI response.
 * Handles both OpenAI chat completion format and simple response format.
 */
function extractResponseText(response: WorkersAIResponse): string {
  // String response
  if (typeof response === "string") {
    return response;
  }

  if (response && typeof response === "object") {
    // OpenAI chat completion format: { choices: [{ message: { content: "..." } }] }
    if ("choices" in response && Array.isArray(response.choices) && response.choices.length > 0) {
      const content = response.choices[0]?.message?.content;
      if (content) return content;
    }

    // Simple format: { response: "..." }
    if ("response" in response) {
      const simple = response as SimpleAiResponse;
      if (simple.response) return simple.response;
    }
  }

  console.error("Could not extract text from Workers AI response:", JSON.stringify(response).slice(0, 500));
  return "";
}

/**
 * Detect intent using Cloudflare Workers AI (Qwen3 model).
 *
 * @param ai - The Workers AI binding from env.AI
 * @param userMessage - The raw user message in Indonesian
 * @param todayDate - Today's date in YYYY-MM-DD format
 * @returns Parsed intent result with provider info
 * @throws Error if Workers AI call fails
 */
export async function detectIntentWorkersAI(
  ai: Ai,
  userMessage: string,
  todayDate: string
): Promise<IntentResultWithProvider> {
  const prompt = buildIntentPrompt(userMessage, todayDate);

  // The model string may not be in static type defs but works at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (ai as any).run(PRIMARY_MODEL, {
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  }) as WorkersAIResponse;

  const responseText = extractResponseText(response);

  if (!responseText) {
    throw new Error("Workers AI returned empty response");
  }

  const result = parseIntentResponse(responseText);
  return { ...result, provider: "workers_ai" };
}
