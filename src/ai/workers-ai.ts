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

  const response = await ai.run(PRIMARY_MODEL as BaseAiTextGenerationModels, {
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extract text from response
  let responseText: string;
  if (typeof response === "string") {
    responseText = response;
  } else if (response && typeof response === "object" && "response" in response) {
    responseText = (response as { response: string }).response ?? "";
  } else {
    console.error("Unexpected Workers AI response format:", JSON.stringify(response));
    responseText = "";
  }

  if (!responseText) {
    throw new Error("Workers AI returned empty response");
  }

  const result = parseIntentResponse(responseText);
  return { ...result, provider: "workers_ai" };
}
