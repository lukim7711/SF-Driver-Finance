/**
 * Telegram Webhook Validation
 * Verifies that incoming requests are genuinely from Telegram
 * using the X-Telegram-Bot-Api-Secret-Token header.
 */

/**
 * Validate the webhook request by comparing the secret token header
 * against the configured TELEGRAM_WEBHOOK_SECRET.
 *
 * Telegram sends this header on every webhook request when a secret
 * token was provided during webhook registration (setWebhook API).
 *
 * @returns true if the request is valid, false otherwise
 */
export function validateWebhookSecret(
  request: Request,
  expectedSecret: string
): boolean {
  const receivedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  return receivedSecret === expectedSecret;
}
