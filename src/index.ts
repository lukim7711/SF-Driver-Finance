/**
 * SF Driver Finance — Main Entry Point
 * Cloudflare Worker that handles Telegram webhook requests.
 *
 * Flow:
 * 1. Receive POST from Telegram webhook
 * 2. Validate webhook secret
 * 3. Parse update (message or callback_query)
 * 4. Route to user's Durable Object for processing
 * 5. Return 200 OK to Telegram
 *
 * Non-webhook requests get a simple status page.
 */

import { validateWebhookSecret } from "./telegram/webhook";
import type { TelegramUpdate } from "./types/telegram";
import type { DORequest } from "./durable-object/finance-do";

/** Re-export the Durable Object class so Cloudflare can find it */
export { FinanceDurableObject } from "./durable-object/finance-do";

/** Environment bindings (secrets, vars, DO, AI) */
export interface Env {
  // Durable Object binding
  FINANCE_DO: DurableObjectNamespace;

  // Workers AI binding
  AI: Ai;

  // Secrets (set via wrangler secret put)
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  DEEPSEEK_API_KEY: string;
  OCR_SPACE_API_KEY: string;

  // Public vars (set in wrangler.jsonc)
  ENVIRONMENT: string;
  BOT_NAME: string;
  WORKERS_AI_DAILY_LIMIT: string;
  WORKERS_AI_FALLBACK_THRESHOLD: string;
}

export default {
  /**
   * Main fetch handler for all incoming requests.
   * Only POST requests to the root path are treated as Telegram webhook calls.
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", bot: env.BOT_NAME, environment: env.ENVIRONMENT }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Only accept POST for webhook
    if (request.method !== "POST") {
      return new Response(
        `\ud83c\udfcd\ufe0f\ud83d\udcb0 ${env.BOT_NAME} is running!\nEnvironment: ${env.ENVIRONMENT}`,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // Step 1: Validate webhook secret
    if (!validateWebhookSecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
      console.error("Webhook validation failed: invalid secret token");
      return new Response("Unauthorized", { status: 401 });
    }

    // Step 2: Parse the Telegram update
    let update: TelegramUpdate;
    try {
      update = (await request.json()) as TelegramUpdate;
    } catch {
      console.error("Failed to parse webhook JSON body");
      return new Response("Bad Request", { status: 400 });
    }

    // Step 3: Extract user ID for Durable Object routing
    const userId = extractUserId(update);
    if (!userId) {
      // No user ID found — silently acknowledge (e.g., channel posts, edited messages)
      return new Response("OK", { status: 200 });
    }

    // Step 4: Route to the user's Durable Object
    try {
      const doId = env.FINANCE_DO.idFromName(userId);
      const stub = env.FINANCE_DO.get(doId);

      // Build the request for the Durable Object
      const doRequest = buildDORequest(update);
      if (!doRequest) {
        return new Response("OK", { status: 200 });
      }

      // Forward to Durable Object (fire-and-forget pattern with waitUntil)
      ctx.waitUntil(
        stub
          .fetch(new Request("https://do/handle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(doRequest),
          }))
          .catch((err) => {
            console.error(`DO fetch error for user ${userId}: ${err}`);
          })
      );

      // Return 200 immediately to Telegram (don't make them wait)
      return new Response("OK", { status: 200 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Worker error: ${errorMessage}`);
      // Always return 200 to Telegram to prevent retry storms
      return new Response("OK", { status: 200 });
    }
  },
};

/**
 * Extract the Telegram user ID from an update.
 * Used as the key for Durable Object routing (1 DO per user).
 */
function extractUserId(update: TelegramUpdate): string | null {
  if (update.message?.from) {
    return update.message.from.id.toString();
  }
  if (update.callback_query?.from) {
    return update.callback_query.from.id.toString();
  }
  return null;
}

/**
 * Build the DO request payload from a Telegram update.
 * Determines whether this is a message or callback_query.
 */
function buildDORequest(update: TelegramUpdate): DORequest | null {
  if (update.message) {
    return { type: "message", message: update.message };
  }
  if (update.callback_query) {
    return { type: "callback_query", callback_query: update.callback_query };
  }
  return null;
}
