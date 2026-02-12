/**
 * Finance Durable Object
 * Each user gets their own Durable Object instance (keyed by Telegram user ID).
 * Contains SQLite database for all financial data and conversation state.
 *
 * This DO handles:
 * - Database initialization & schema migrations on first access
 * - User registration (onboarding)
 * - Conversation state management
 * - Routing messages to appropriate handlers
 */

import type { Env } from "../index";
import type { TelegramMessage, TelegramCallbackQuery } from "../types/telegram";
import { initializeDatabase } from "../database/schema";
import {
  ensureConversationStateTable,
  getConversationState,
  clearConversationState,
} from "../database/conversation";
import { getUserByTelegramId, registerUser } from "../database/user";
import {
  handleStartCommand,
  handleHelpCommand,
  handleCancelCommand,
} from "../handlers/commands";
import { sendText } from "../telegram/api";

/** Request body sent from Worker to Durable Object */
export interface DORequest {
  type: "message" | "callback_query";
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * FinanceDurableObject — per-user data storage and message handling.
 * Uses the new DurableObject base class with SQLite support.
 */
export class FinanceDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private db: SqlStorage;
  private initialized: boolean = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.db = state.storage.sql;
  }

  /** Ensure database is initialized (called once per DO lifetime) */
  private ensureInitialized(): void {
    if (this.initialized) return;
    initializeDatabase(this.db);
    ensureConversationStateTable(this.db);
    this.initialized = true;
  }

  /**
   * Main fetch handler — receives routed requests from the Worker.
   * All requests are POST with a JSON body containing the Telegram update data.
   */
  async fetch(request: Request): Promise<Response> {
    try {
      this.ensureInitialized();

      const body = (await request.json()) as DORequest;

      if (body.type === "message" && body.message) {
        await this.handleMessage(body.message);
      } else if (body.type === "callback_query" && body.callback_query) {
        await this.handleCallbackQuery(body.callback_query);
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`FinanceDO error: ${errorMessage}`);
      return new Response("Internal Error", { status: 500 });
    }
  }

  /**
   * Handle an incoming text/photo message from the user.
   * Flow: Check command → Check conversation state → (future: AI intent detection)
   */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text?.trim() ?? "";
    const from = message.from;

    if (!from) return; // No sender info — skip

    const token = this.env.TELEGRAM_BOT_TOKEN;
    const telegramId = from.id.toString();
    const userName = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Driver";

    // Step 1: Handle bot commands (always processed, regardless of state)
    if (text.startsWith("/")) {
      const command = text.split(/\s+/)[0]!.toLowerCase();

      switch (command) {
        case "/start": {
          // Register user if new (onboarding)
          registerUser(this.db, telegramId, userName);
          await handleStartCommand(token, chatId);
          return;
        }
        case "/help": {
          await handleHelpCommand(token, chatId);
          return;
        }
        case "/batal": {
          const hadState = clearConversationState(this.db);
          await handleCancelCommand(token, chatId, hadState);
          return;
        }
        default: {
          await sendText(token, chatId, "\u2753 Perintah tidak dikenal. Ketik /help untuk panduan.");
          return;
        }
      }
    }

    // Step 2: Check \"batal\" keyword (cancel in any form)
    if (text.toLowerCase() === "batal") {
      const hadState = clearConversationState(this.db);
      await handleCancelCommand(token, chatId, hadState);
      return;
    }

    // Step 3: Check conversation state (multi-step flow)
    const conversationState = getConversationState(this.db);
    if (conversationState) {
      // TODO: Route to appropriate state handler based on pending_action
      // For now, inform user about the pending action
      await sendText(
        token,
        chatId,
        `\u23f3 Kamu sedang dalam proses <b>${conversationState.pending_action}</b>.\n\nKetik /batal untuk membatalkan.`
      );
      return;
    }

    // Step 4: Ensure user is registered before processing free-text messages
    const user = getUserByTelegramId(this.db, telegramId);
    if (!user) {
      // Auto-register on first message (even without /start)
      registerUser(this.db, telegramId, userName);
    }

    // Step 5: Future — send to AI for intent detection
    // For Phase 1, reply with a placeholder message
    await sendText(
      token,
      chatId,
      "\ud83e\udd16 Pesan diterima! Fitur pencatatan via chat sedang dalam pengembangan.\n\nSaat ini kamu bisa gunakan:\n/start \u2014 Mulai ulang\n/help \u2014 Panduan lengkap"
    );
  }

  /**
   * Handle callback query from inline keyboard button press.
   * Currently a placeholder for future features (confirmations, selections).
   */
  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    // TODO: Handle inline keyboard callbacks (confirm_income, confirm_expense, etc.)
    // For Phase 1, this is a placeholder
    console.log(`Callback query received: ${query.data}`);
  }
}
