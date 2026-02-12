/**
 * Telegram Bot API Client
 * Provides typed helper functions for sending messages, editing messages,
 * and answering callback queries via the Telegram Bot API.
 */

import type {
  SendMessageParams,
  AnswerCallbackQueryParams,
  EditMessageTextParams,
  InlineKeyboardMarkup,
} from "../types/telegram";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

/**
 * Send a text message to a Telegram chat.
 * Uses HTML parse mode by default for rich formatting.
 */
export async function sendMessage(
  token: string,
  params: SendMessageParams
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}${token}/sendMessage`;
  const body: SendMessageParams = {
    ...params,
    parse_mode: params.parse_mode ?? "HTML",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Telegram sendMessage failed: ${response.status} — ${errorText}`);
  }
}

/**
 * Send a plain text message (convenience wrapper).
 */
export async function sendText(
  token: string,
  chatId: number,
  text: string
): Promise<void> {
  await sendMessage(token, { chat_id: chatId, text });
}

/**
 * Send a message with inline keyboard buttons.
 */
export async function sendWithKeyboard(
  token: string,
  chatId: number,
  text: string,
  keyboard: InlineKeyboardMarkup
): Promise<void> {
  await sendMessage(token, {
    chat_id: chatId,
    text,
    reply_markup: keyboard,
  });
}

/**
 * Edit an existing message's text (used for updating after button press).
 */
export async function editMessageText(
  token: string,
  params: EditMessageTextParams
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}${token}/editMessageText`;
  const body: EditMessageTextParams = {
    ...params,
    parse_mode: params.parse_mode ?? "HTML",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Telegram editMessageText failed: ${response.status} — ${errorText}`);
  }
}

/**
 * Answer a callback query (acknowledges inline keyboard button press).
 * Must be called to remove the "loading" indicator on the button.
 */
export async function answerCallbackQuery(
  token: string,
  params: AnswerCallbackQueryParams
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}${token}/answerCallbackQuery`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Telegram answerCallbackQuery failed: ${response.status} — ${errorText}`);
  }
}
