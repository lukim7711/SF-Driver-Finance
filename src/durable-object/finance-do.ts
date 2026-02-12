/**
 * Finance Durable Object
 * Each user gets their own Durable Object instance (keyed by Telegram user ID).
 * Contains SQLite database for all financial data and conversation state.
 *
 * Phase 2: Added AI intent detection, income/expense recording with
 * confirmation flows via inline keyboard, and Neuron usage tracking.
 */

import type { Env } from "../index";
import type { TelegramMessage, TelegramCallbackQuery } from "../types/telegram";
import type { IncomeParams, ExpenseParams } from "../types/intent";
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
import { handleIncomeConfirmation, processIncomeConfirmed } from "../handlers/income";
import { handleExpenseConfirmation, processExpenseConfirmed } from "../handlers/expense";
import { detectIntent } from "../ai/intent-detector";
import { ensureNeuronTable, getNeuronCount, incrementNeuronCount } from "../ai/neuron-tracker";
import { sendText, answerCallbackQuery, editMessageText } from "../telegram/api";

/** Request body sent from Worker to Durable Object */
export interface DORequest {
  type: "message" | "callback_query";
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * Get today's date in YYYY-MM-DD format using Jakarta timezone.
 */
function getTodayDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

/**
 * FinanceDurableObject — per-user data storage and message handling.
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
    ensureNeuronTable(this.db);
    this.initialized = true;
  }

  /**
   * Main fetch handler — receives routed requests from the Worker.
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
   * Flow: Command → Cancel → Conversation State → AI Intent Detection → Route
   */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text?.trim() ?? "";
    const from = message.from;

    if (!from) return;

    const token = this.env.TELEGRAM_BOT_TOKEN;
    const telegramId = from.id.toString();
    const userName = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Driver";
    const todayDate = getTodayDate();

    // Step 1: Handle bot commands
    if (text.startsWith("/")) {
      const command = text.split(/\s+/)[0]!.toLowerCase();

      switch (command) {
        case "/start": {
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

    // Step 2: Check \"batal\" keyword
    if (text.toLowerCase() === "batal") {
      const hadState = clearConversationState(this.db);
      await handleCancelCommand(token, chatId, hadState);
      return;
    }

    // Step 3: Check conversation state (multi-step flow, no AI needed)
    const conversationState = getConversationState(this.db);
    if (conversationState) {
      await sendText(
        token,
        chatId,
        "\u23f3 Gunakan tombol di atas untuk konfirmasi, atau ketik /batal untuk membatalkan."
      );
      return;
    }

    // Step 4: Ensure user is registered
    const user = getUserByTelegramId(this.db, telegramId);
    if (!user) {
      registerUser(this.db, telegramId, userName);
    }

    // Step 5: Skip empty messages
    if (!text) {
      await sendText(token, chatId, "\ud83d\udcf7 Fitur baca foto (OCR) akan hadir di update berikutnya!");
      return;
    }

    // Step 6: AI Intent Detection
    const neuronCount = getNeuronCount(this.db, todayDate);
    const result = await detectIntent(this.env, text, todayDate, neuronCount);

    // Track neuron usage if Workers AI was used
    if (result.provider === "workers_ai") {
      incrementNeuronCount(this.db, todayDate, 5);
    }

    // Step 7: Route based on detected intent
    switch (result.intent) {
      case "record_income": {
        const params = result.params as IncomeParams;
        if (!params.amount || params.amount <= 0) {
          await sendText(token, chatId, "\u274c Tidak bisa mendeteksi jumlah pendapatan. Coba lagi, contoh: \"dapet 150rb food\"");
          return;
        }
        await handleIncomeConfirmation(token, chatId, this.db, params, todayDate);
        return;
      }

      case "record_expense": {
        const params = result.params as ExpenseParams;
        if (!params.amount || params.amount <= 0) {
          await sendText(token, chatId, "\u274c Tidak bisa mendeteksi jumlah pengeluaran. Coba lagi, contoh: \"bensin 20rb\"");
          return;
        }
        await handleExpenseConfirmation(token, chatId, this.db, params, todayDate);
        return;
      }

      case "register_loan": {
        await sendText(token, chatId, "\ud83c\udfe6 Fitur daftar pinjaman akan hadir di Phase 3!");
        return;
      }

      case "pay_installment": {
        await sendText(token, chatId, "\ud83c\udfe6 Fitur bayar cicilan akan hadir di Phase 3!");
        return;
      }

      case "view_loans": {
        await sendText(token, chatId, "\ud83c\udfe6 Fitur lihat hutang akan hadir di Phase 3!");
        return;
      }

      case "view_report": {
        await sendText(token, chatId, "\ud83d\udcca Fitur laporan keuangan akan hadir segera!");
        return;
      }

      case "set_target":
      case "view_target": {
        await sendText(token, chatId, "\ud83c\udfaf Fitur target pendapatan akan hadir segera!");
        return;
      }

      case "help": {
        await handleHelpCommand(token, chatId);
        return;
      }

      case "unknown":
      default: {
        await sendText(
          token,
          chatId,
          "\ud83e\udd14 Maaf, aku belum mengerti pesanmu.\n\n" +
          "Coba kirim seperti:\n" +
          "\u2022 <i>\"Dapet 150rb food\"</i> \u2014 catat pendapatan\n" +
          "\u2022 <i>\"Bensin 20rb\"</i> \u2014 catat pengeluaran\n" +
          "\u2022 <i>\"Lihat hutang\"</i> \u2014 cek pinjaman\n\n" +
          "Ketik /help untuk panduan lengkap."
        );
        return;
      }
    }
  }

  /**
   * Handle callback query from inline keyboard button press.
   * Processes confirmation responses for income/expense recording.
   */
  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    const data = query.data ?? "";
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;

    if (!chatId || !messageId) {
      await answerCallbackQuery(token, { callback_query_id: query.id });
      return;
    }

    // Get conversation state
    const state = getConversationState(this.db);

    switch (data) {
      case "confirm_income_yes": {
        if (state?.pending_action === "confirm_income") {
          clearConversationState(this.db);
          await answerCallbackQuery(token, { callback_query_id: query.id, text: "Disimpan! \u2705" });
          await editMessageText(token, {
            chat_id: chatId,
            message_id: messageId,
            text: query.message?.text ?? "Dikonfirmasi",
          });
          await processIncomeConfirmed(token, chatId, this.db, state.pending_data);
        } else {
          await answerCallbackQuery(token, { callback_query_id: query.id, text: "Sesi sudah berakhir." });
        }
        return;
      }

      case "confirm_income_no": {
        clearConversationState(this.db);
        await answerCallbackQuery(token, { callback_query_id: query.id, text: "Dibatalkan" });
        await editMessageText(token, {
          chat_id: chatId,
          message_id: messageId,
          text: "\u274c Pencatatan pendapatan dibatalkan.",
        });
        return;
      }

      case "confirm_expense_yes": {
        if (state?.pending_action === "confirm_expense") {
          clearConversationState(this.db);
          await answerCallbackQuery(token, { callback_query_id: query.id, text: "Disimpan! \u2705" });
          await editMessageText(token, {
            chat_id: chatId,
            message_id: messageId,
            text: query.message?.text ?? "Dikonfirmasi",
          });
          await processExpenseConfirmed(token, chatId, this.db, state.pending_data);
        } else {
          await answerCallbackQuery(token, { callback_query_id: query.id, text: "Sesi sudah berakhir." });
        }
        return;
      }

      case "confirm_expense_no": {
        clearConversationState(this.db);
        await answerCallbackQuery(token, { callback_query_id: query.id, text: "Dibatalkan" });
        await editMessageText(token, {
          chat_id: chatId,
          message_id: messageId,
          text: "\u274c Pencatatan pengeluaran dibatalkan.",
        });
        return;
      }

      default: {
        await answerCallbackQuery(token, { callback_query_id: query.id, text: "Aksi tidak dikenal" });
        return;
      }
    }
  }
}
