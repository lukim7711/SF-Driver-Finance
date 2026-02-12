/**
 * Expense Recording Handler
 * Handles the confirmation flow for recording expenses.
 * Uses inline keyboard for Ya/Tidak confirmation.
 */

import type { ExpenseParams, ExpenseCategory } from "../types/intent";
import { sendWithKeyboard, sendText } from "../telegram/api";
import { setConversationState } from "../database/conversation";
import { recordExpense, getTodayExpenses, CATEGORY_LABELS } from "../database/expense";
import { formatRupiah } from "./income";

/** Emoji mapping for expense categories */
const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  fuel: "⛽",
  parking: "🅿️",
  meals: "🍜",
  cigarettes: "🚬",
  data_plan: "📱",
  vehicle_service: "🔧",
  household: "🏠",
  electricity: "💡",
  emergency: "🚨",
  other: "📋",
};

/**
 * Start the expense recording confirmation flow.
 * Shows parsed data and asks user to confirm via inline keyboard.
 */
export async function handleExpenseConfirmation(
  token: string,
  chatId: number,
  db: SqlStorage,
  params: ExpenseParams,
  todayDate: string
): Promise<void> {
  const date = params.date ?? todayDate;
  const category = params.category;
  const emoji = CATEGORY_EMOJI[category] ?? "📋";
  const label = CATEGORY_LABELS[category] ?? category;

  const text = `📝 <b>Catat Pengeluaran</b>\n\n` +
    `${emoji} Kategori: ${label}\n` +
    `💸 Jumlah: <b>${formatRupiah(params.amount)}</b>\n` +
    `📅 Tanggal: ${date}\n` +
    (params.note ? `📌 Catatan: ${params.note}\n` : "") +
    `\nSudah benar?`;

  // Store pending state for confirmation
  setConversationState(db, "confirm_expense", {
    amount: params.amount,
    category,
    date,
    note: params.note ?? null,
  });

  await sendWithKeyboard(token, chatId, text, {
    inline_keyboard: [
      [
        { text: "✅ Ya, Simpan", callback_data: "confirm_expense_yes" },
        { text: "❌ Batal", callback_data: "confirm_expense_no" },
      ],
    ],
  });
}

/**
 * Process confirmed expense recording.
 * Called when user presses "Ya" on the confirmation keyboard.
 */
export async function processExpenseConfirmed(
  token: string,
  chatId: number,
  db: SqlStorage,
  data: Record<string, unknown>
): Promise<void> {
  const amount = data["amount"] as number;
  const category = data["category"] as ExpenseCategory;
  const date = data["date"] as string;
  const note = (data["note"] as string) ?? null;

  const emoji = CATEGORY_EMOJI[category] ?? "📋";
  const label = CATEGORY_LABELS[category] ?? category;

  // Save to database
  recordExpense(db, amount, category, date, note);

  // Get today's totals
  const today = getTodayExpenses(db, date);

  let categoryBreakdown = "";
  for (const [cat, catTotal] of Object.entries(today.byCategory)) {
    const catEmoji = CATEGORY_EMOJI[cat as ExpenseCategory] ?? "📋";
    const catLabel = CATEGORY_LABELS[cat as ExpenseCategory] ?? cat;
    categoryBreakdown += `${catEmoji} ${catLabel}: ${formatRupiah(catTotal)}\n`;
  }

  const text = `✅ <b>Pengeluaran dicatat!</b>\n\n` +
    `${emoji} ${label}: ${formatRupiah(amount)}\n\n` +
    `📊 <b>Pengeluaran Hari Ini:</b>\n` +
    categoryBreakdown +
    `💸 Total: <b>${formatRupiah(today.total)}</b> (${today.count} transaksi)`;

  await sendText(token, chatId, text);
}
