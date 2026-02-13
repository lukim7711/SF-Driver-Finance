/**
 * Finance Durable Object
 * Each user gets their own Durable Object instance (keyed by Telegram user ID).
 * Contains SQLite database for all financial data and conversation state.
 *
 * Phase 3 complete: Loan tracking — registration, payment, dashboard, alerts, penalty calculator, monthly summary, payoff progress.
 */

import type { Env } from "../index";
import type { TelegramMessage, TelegramCallbackQuery } from "../types/telegram";
import type { IncomeParams, ExpenseParams, RegisterLoanParams, PayInstallmentParams } from "../types/intent";
import type { LateFeeType } from "../types/loan";
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
import {
  handleLoanFromAI,
  handleMissingFieldInput,
  handleLateFeeTypeCallback,
  handleLoanConfirmSave,
  handleLoanConfirmEdit,
  handleEditSelection,
  handleEditFieldInput,
} from "../handlers/loan";
import { handlePaymentFromAI, handlePaymentConfirmed } from "../handlers/payment";
import { handleLoanDashboard } from "../handlers/dashboard";
import { checkAndSendAlerts, ensureAlertMetaTable } from "../handlers/alerts";
import { handleLateFeeCalculator } from "../handlers/late-fee-calc";
import { handleMonthlySummary } from "../handlers/monthly-summary";
import { handlePayoffProgress } from "../handlers/payoff-progress";
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
 * Keywords that indicate the user is trying to start a NEW intent
 * rather than answering the current wizard question.
 */
const INTENT_KEYWORDS = [
  // loan/debt
  "hutang", "pinjam", "pinjol", "daftar pinjaman", "cicilan", "bayar", "denda", "progres", "lunas",
  // income
  "dapet", "dapat", "income", "penghasilan",
  // expense
  "bensin", "parkir", "makan", "rokok", "pulsa", "servis", "listrik",
  // view/report
  "lihat", "cek", "status", "laporan", "rekap", "report", "ringkasan",
  // other
  "target", "bantuan",
];

/**
 * Detect if user input looks like a new intent rather than a wizard answer.
 * Heuristic: must have 2+ words AND contain a known intent keyword.
 * Single words/numbers pass through to the wizard handler.
 */
function looksLikeNewIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  if (words.length < 2) return false;
  return INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Keyword-based pre-router — catches common natural language patterns
 * and routes them directly WITHOUT using AI. Saves Neurons and provides
 * instant response for common queries.
 *
 * Returns the handler function name or null if no match.
 */
type PreRouteResult =
  | { route: "view_loans" }
  | { route: "view_penalty" }
  | { route: "view_progress" }
  | { route: "view_report" }
  | { route: "help" }
  | null;

function preRouteByKeyword(text: string): PreRouteResult {
  const lower = text.toLowerCase().trim();

  // ── View Penalty / Denda ──
  // Matches: "denda", "cek denda", "ada denda ga", "denda gue berapa", "lihat denda", etc.
  if (
    lower === "denda" ||
    (lower.includes("denda") && !lower.includes("daftar") && !lower.includes("tambah"))
  ) {
    return { route: "view_penalty" };
  }

  // ── View Progress ──
  // Matches: "progres", "progress", "progres hutang", "kapan lunas", etc.
  if (
    lower === "progres" ||
    lower === "progress" ||
    lower.includes("progres") ||
    lower.includes("progress") ||
    (lower.includes("kapan") && lower.includes("lunas")) ||
    (lower.includes("berapa persen") && lower.includes("lunas"))
  ) {
    return { route: "view_progress" };
  }

  // ── View Loans / Hutang ──
  // Matches: "hutang", "hutang gue berapa", "cek hutang", "lihat pinjaman", etc.
  // But NOT "daftar hutang" (register), "hutang kredivo 5jt" (register with details)
  if (
    lower === "hutang" ||
    lower === "pinjaman" ||
    lower === "cicilan"
  ) {
    return { route: "view_loans" };
  }

  // Multi-word hutang queries that are clearly VIEW (asking, not registering)
  if (
    (lower.includes("hutang") || lower.includes("pinjaman") || lower.includes("cicilan")) &&
    !lower.includes("daftar") && !lower.includes("tambah") && !lower.includes("baru")
  ) {
    // If it contains question words or view verbs, route to view_loans
    const viewIndicators = [
      "berapa", "berapah", "brp", "apa aja", "apa saja",
      "lihat", "liat", "cek", "kasih tau", "kasih tahu",
      "total", "sisa", "status", "list", "ada",
      "gue", "gw", "gua", "aku", "saya",
    ];
    if (viewIndicators.some((v) => lower.includes(v))) {
      return { route: "view_loans" };
    }
  }

  // ── View Report / Ringkasan ──
  if (
    lower === "ringkasan" ||
    lower === "rekap" ||
    lower === "laporan" ||
    lower === "report" ||
    (lower.includes("ringkasan") && !lower.includes("daftar")) ||
    (lower.includes("rekap") && !lower.includes("daftar")) ||
    (lower.includes("laporan") && !lower.includes("daftar"))
  ) {
    return { route: "view_report" };
  }

  // ── Help ──
  if (
    lower === "bantuan" ||
    lower === "help" ||
    lower === "tolong" ||
    lower.includes("cara pakai") ||
    lower.includes("gimana caranya") ||
    lower.includes("bisa ngapain")
  ) {
    return { route: "help" };
  }

  return null;
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
    ensureAlertMetaTable(this.db);
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
   * Flow: Alerts → Command → Cancel → Conversation State → Pre-Route → AI Intent Detection → Route
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

    // Step 0: Proactive due date alerts (throttled, fires before normal response)
    await checkAndSendAlerts(token, chatId, this.db, todayDate);

    // Step 1: Handle bot commands
    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0]!.toLowerCase();

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
        case "/hutang": {
          await handleLoanDashboard(token, chatId, this.db, todayDate);
          return;
        }
        case "/denda": {
          const platformArg = parts.slice(1).join(" ").trim() || undefined;
          await handleLateFeeCalculator(token, chatId, this.db, todayDate, platformArg);
          return;
        }
        case "/ringkasan": {
          const monthArg = parts.slice(1).join(" ").trim() || undefined;
          await handleMonthlySummary(token, chatId, this.db, todayDate, monthArg);
          return;
        }
        case "/progres": {
          await handlePayoffProgress(token, chatId, this.db, todayDate);
          return;
        }
        default: {
          await sendText(token, chatId, "\u2753 Perintah tidak dikenal. Ketik /help untuk panduan.");
          return;
        }
      }
    }

    // Step 2: Check "batal" keyword
    if (text.toLowerCase() === "batal") {
      const hadState = clearConversationState(this.db);
      await handleCancelCommand(token, chatId, hadState);
      return;
    }

    // Step 3: Check conversation state (multi-step flows)
    const conversationState = getConversationState(this.db);
    if (conversationState) {
      const action = conversationState.pending_action;

      switch (action) {
        case "loan_fill_missing": {
          if (looksLikeNewIntent(text)) {
            const platform = (conversationState.pending_data.platform as string) || "pinjaman";
            await sendText(
              token,
              chatId,
              `\u26a0\ufe0f Kamu masih dalam proses daftar <b>${platform}</b>.\n\n` +
              `Ketik /batal dulu untuk membatalkan, lalu mulai yang baru.`
            );
            return;
          }
          await handleMissingFieldInput(token, chatId, this.db, text, todayDate);
          return;
        }
        case "loan_edit_select": {
          if (looksLikeNewIntent(text)) {
            const platform = (conversationState.pending_data.platform as string) || "pinjaman";
            await sendText(
              token,
              chatId,
              `\u26a0\ufe0f Kamu masih dalam proses edit <b>${platform}</b>.\n\n` +
              `Ketik /batal dulu untuk membatalkan, lalu mulai yang baru.`
            );
            return;
          }
          await handleEditSelection(token, chatId, this.db, text);
          return;
        }
        case "loan_edit_field": {
          if (looksLikeNewIntent(text)) {
            const platform = (conversationState.pending_data.platform as string) || "pinjaman";
            await sendText(
              token,
              chatId,
              `\u26a0\ufe0f Kamu masih dalam proses edit <b>${platform}</b>.\n\n` +
              `Ketik /batal dulu untuk membatalkan, lalu mulai yang baru.`
            );
            return;
          }
          await handleEditFieldInput(token, chatId, this.db, text, todayDate);
          return;
        }
        case "confirm_loan":
        case "confirm_income":
        case "confirm_expense":
        case "confirm_payment": {
          await sendText(
            token,
            chatId,
            "\u23f3 Gunakan tombol di atas untuk konfirmasi, atau ketik /batal untuk membatalkan."
          );
          return;
        }
        default: {
          await sendText(
            token,
            chatId,
            "\u23f3 Ada proses yang belum selesai. Ketik /batal untuk membatalkan."
          );
          return;
        }
      }
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

    // Step 5.5: Keyword pre-router — catch common queries WITHOUT AI
    const preRoute = preRouteByKeyword(text);
    if (preRoute) {
      switch (preRoute.route) {
        case "view_loans":
          await handleLoanDashboard(token, chatId, this.db, todayDate);
          return;
        case "view_penalty":
          await handleLateFeeCalculator(token, chatId, this.db, todayDate);
          return;
        case "view_progress":
          await handlePayoffProgress(token, chatId, this.db, todayDate);
          return;
        case "view_report":
          await handleMonthlySummary(token, chatId, this.db, todayDate);
          return;
        case "help":
          await handleHelpCommand(token, chatId);
          return;
      }
    }

    // Step 6: AI Intent Detection (only for messages that need understanding)
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
        const params = result.params as RegisterLoanParams;
        await handleLoanFromAI(token, chatId, this.db, params);
        return;
      }

      case "pay_installment": {
        const params = result.params as PayInstallmentParams;
        await handlePaymentFromAI(token, chatId, this.db, params, todayDate);
        return;
      }

      case "view_loans": {
        await handleLoanDashboard(token, chatId, this.db, todayDate);
        return;
      }

      case "view_penalty": {
        await handleLateFeeCalculator(token, chatId, this.db, todayDate);
        return;
      }

      case "view_progress": {
        await handlePayoffProgress(token, chatId, this.db, todayDate);
        return;
      }

      case "view_report": {
        await handleMonthlySummary(token, chatId, this.db, todayDate);
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
          "\u2022 <i>\"Dapet 150rb food\"</i> — catat pendapatan\n" +
          "\u2022 <i>\"Bensin 20rb\"</i> — catat pengeluaran\n" +
          "\u2022 <i>\"Kredivo 5jt 12 bulan 500rb/bln\"</i> — daftar pinjaman\n" +
          "\u2022 <i>\"Bayar cicilan Kredivo\"</i> — catat pembayaran\n" +
          "\u2022 <i>\"Hutang gue berapa\"</i> — cek pinjaman\n" +
          "\u2022 <i>\"Ada denda ga\"</i> — hitung denda\n" +
          "\u2022 <i>\"Ringkasan bulan ini\"</i> — ringkasan\n" +
          "\u2022 <i>\"Progres hutang\"</i> — progres pelunasan\n\n" +
          "Ketik /help untuk panduan lengkap."
        );
        return;
      }
    }
  }

  /**
   * Handle callback query from inline keyboard button press.
   */
  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    const data = query.data ?? "";
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const todayDate = getTodayDate();

    if (!chatId || !messageId) {
      await answerCallbackQuery(token, { callback_query_id: query.id });
      return;
    }

    const state = getConversationState(this.db);

    // ── Payment: confirm payment ──
    if (data === "payment_confirm_yes") {
      if (state?.pending_action === "confirm_payment") {
        await answerCallbackQuery(token, { callback_query_id: query.id, text: "Mencatat pembayaran..." });
        await editMessageText(token, {
          chat_id: chatId,
          message_id: messageId,
          text: query.message?.text ?? "Dikonfirmasi",
        });
        await handlePaymentConfirmed(token, chatId, this.db, todayDate);
      } else {
        await answerCallbackQuery(token, { callback_query_id: query.id, text: "Sesi sudah berakhir." });
      }
      return;
    }

    if (data === "payment_confirm_no") {
      clearConversationState(this.db);
      await answerCallbackQuery(token, { callback_query_id: query.id, text: "Dibatalkan" });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId,
        text: "\u274c Pembayaran cicilan dibatalkan.",
      });
      return;
    }

    // ── Loan: late fee type selection ──
    if (data.startsWith("loan_late_fee:")) {
      const lateFeeType = data.replace("loan_late_fee:", "") as LateFeeType;
      await answerCallbackQuery(token, { callback_query_id: query.id });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId,
        text: query.message?.text ?? "Dipilih",
      });
      await handleLateFeeTypeCallback(token, chatId, this.db, lateFeeType, todayDate);
      return;
    }

    // ── Loan: confirm save ──
    if (data === "loan_confirm_yes") {
      await answerCallbackQuery(token, { callback_query_id: query.id, text: "Menyimpan..." });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId,
        text: query.message?.text ?? "Dikonfirmasi",
      });
      await handleLoanConfirmSave(token, chatId, this.db, todayDate);
      return;
    }

    // ── Loan: confirm edit ──
    if (data === "loan_confirm_edit") {
      await answerCallbackQuery(token, { callback_query_id: query.id });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId,
        text: query.message?.text ?? "Edit mode",
      });
      await handleLoanConfirmEdit(token, chatId, this.db);
      return;
    }

    // ── Loan: confirm cancel ──
    if (data === "loan_confirm_no") {
      clearConversationState(this.db);
      await answerCallbackQuery(token, { callback_query_id: query.id, text: "Dibatalkan" });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId,
        text: "\u274c Pendaftaran pinjaman dibatalkan.",
      });
      return;
    }

    // ── Income/Expense confirmations ──
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
