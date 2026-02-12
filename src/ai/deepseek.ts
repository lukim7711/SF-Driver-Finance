/**
 * DeepSeek API Provider (Fallback)
 * Used when Workers AI approaches its daily Neuron limit.
 * Costs ~$0.12/month for typical personal use.
 */

import type { IntentResultWithProvider } from "../types/intent";
import { buildIntentPrompt } from "./prompt";
import { parseIntentResponse } from "./parser";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

/** DeepSeek API response structure */
interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Detect intent using DeepSeek API (fallback provider).
 *
 * @param apiKey - DeepSeek API key
 * @param userMessage - The raw user message in Indonesian
 * @param todayDate - Today's date in YYYY-MM-DD format
 * @returns Parsed intent result with provider info
 * @throws Error if DeepSeek API call fails
 */
export async function detectIntentDeepSeek(
  apiKey: string,
  userMessage: string,
  todayDate: string
): Promise<IntentResultWithProvider> {
  const prompt = buildIntentPrompt(userMessage, todayDate);

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as DeepSeekResponse;
  const responseText = data.choices?.[0]?.message?.content ?? "";

  if (!responseText) {
    throw new Error("DeepSeek returned empty response");
  }

  const result = parseIntentResponse(responseText);
  return { ...result, provider: "deepseek" };
}
