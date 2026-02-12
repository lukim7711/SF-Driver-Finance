/**
 * Intent Detector — AI Orchestrator with Fallback
 * Manages the dual-provider strategy: Workers AI (free) → DeepSeek (paid fallback).
 * Tracks daily Neuron usage and automatically switches when approaching the limit.
 */

import type { Env } from "../index";
import type { IntentResultWithProvider } from "../types/intent";
import { detectIntentWorkersAI } from "./workers-ai";
import { detectIntentDeepSeek } from "./deepseek";

/**
 * Detect intent from a user message using the dual-provider strategy.
 *
 * Flow:
 * 1. Check if Workers AI is within daily limit
 * 2. If yes → use Workers AI (free)
 * 3. If no (or if Workers AI fails) → use DeepSeek (paid fallback)
 * 4. If both fail → return unknown intent
 *
 * @param env - Worker environment bindings
 * @param userMessage - Raw user message in Indonesian
 * @param todayDate - Today's date in YYYY-MM-DD format
 * @param neuronCount - Current daily Neuron usage count
 * @returns Intent detection result with provider info
 */
export async function detectIntent(
  env: Env,
  userMessage: string,
  todayDate: string,
  neuronCount: number
): Promise<IntentResultWithProvider> {
  const threshold = parseInt(env.WORKERS_AI_FALLBACK_THRESHOLD, 10) || 8000;

  // Try Workers AI first if within threshold
  if (neuronCount < threshold) {
    try {
      const result = await detectIntentWorkersAI(env.AI, userMessage, todayDate);
      console.log(`Intent detected via Workers AI: ${result.intent} (confidence: ${result.confidence})`);
      return result;
    } catch (error) {
      console.error("Workers AI failed, falling back to DeepSeek:", error);
      // Fall through to DeepSeek
    }
  } else {
    console.log(`Neuron count ${neuronCount} >= threshold ${threshold}, using DeepSeek`);
  }

  // Fallback to DeepSeek
  try {
    const result = await detectIntentDeepSeek(env.DEEPSEEK_API_KEY, userMessage, todayDate);
    console.log(`Intent detected via DeepSeek: ${result.intent} (confidence: ${result.confidence})`);
    return result;
  } catch (error) {
    console.error("DeepSeek also failed:", error);
    // Both providers failed — return unknown
    return {
      intent: "unknown",
      params: {},
      confidence: 0,
      provider: "deepseek",
    };
  }
}
