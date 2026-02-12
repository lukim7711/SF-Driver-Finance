/**
 * SF Driver Finance — Entry Point
 * Telegram Bot for ShopeeFood Driver financial management
 *
 * This file will contain:
 * - Webhook handler for Telegram Bot API
 * - Router for intent detection
 * - Connection to Durable Objects
 * - Workers AI & DeepSeek fallback integration
 *
 * Status: 📋 Not yet implemented (planning phase)
 */

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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response('SF Driver Finance Bot — Coming Soon! 🏍️💰', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};

/**
 * Durable Object class for financial data storage
 * Will be implemented in the next phase
 */
export class FinanceDurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    return new Response('Durable Object active', { status: 200 });
  }
}
