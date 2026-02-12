/**
 * Income Recording Handler
 * Handles the confirmation flow for recording delivery earnings.
 * Uses inline keyboard for Ya/Tidak confirmation.
 */

import type { IncomeParams } from "../types/intent";
import { sendWithKeyboard, sendText } from "../telegram/api";
import { setConversationState } from "../database/conversation";
import { recordIncome, getTodayIncome } from "../database/income";

/**
 * Format amount as Indonesian Rupiah string.
 */
export function formatRupiah(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

/**
 * Start the income recording confirmation flow.
 * Shows parsed data and asks user to confirm via inline keyboard.
 */
export async function handleIncomeConfirmation(
  token: string,
  chatId: number,
  db: SqlStorage,
  params: IncomeParams,
  todayDate: string
): Promise<void> {
  const date = params.date ?? todayDate;
  const typeLabel = params.type === "food" ? "🍔 Food Delivery" : "📦 SPX Express";

  const text = `📝 <b>Catat Pendapatan</b>\n\n` +
    `${typeLabel}\n` +
    `💰 Jumlah: <b>${formatRupiah(params.amount)}</b>\n` +
    `📅 Tanggal: ${date}\n` +
    (params.note ? `📌 Catatan: ${params.note}\n` : "") +
    `\nSudah benar?`;

  // Store pending state for confirmation
  setConversationState(db, "confirm_income", {
    amount: params.amount,
    type: params.type,
    date,
    note: params.note ?? null,
  });

  await sendWithKeyboard(token, chatId, text, {
    inline_keyboard: [
      [
        { text: "✅ Ya, Simpan", callback_data: "confirm_income_yes" },
        { text: "❌ Batal", callback_data: "confirm_income_no" },
      ],
    ],
  });
}

/**
 * Process confirmed income recording.
 * Called when user presses "Ya" on the confirmation keyboard.
 */
export async function processIncomeConfirmed(
  token: string,
  chatId: number,
  db: SqlStorage,
  data: Record<string, unknown>
): Promise<void> {
  const amount = data["amount"] as number;
  const type = data["type"] as "food" | "spx";
  const date = data["date"] as string;
  const note = (data["note"] as string) ?? null;

  // Save to database
  recordIncome(db, amount, type, date, note);

  // Get today's totals
  const today = getTodayIncome(db, date);
  const typeLabel = type === "food" ? "Food" : "SPX";

  const text = `✅ <b>Pendapatan dicatat!</b>\n\n` +
    `${typeLabel}: ${formatRupiah(amount)}\n\n` +
    `📊 <b>Total Hari Ini:</b>\n` +
    `🍔 Food: ${formatRupiah(today.food)}\n` +
    `📦 SPX: ${formatRupiah(today.spx)}\n` +
    `💰 Total: <b>${formatRupiah(today.total)}</b> (${today.count} transaksi)`;

  await sendText(token, chatId, text);
}
