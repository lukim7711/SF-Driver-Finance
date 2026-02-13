/**
 * Installment Payment Handler — F03b
 *
 * Handles recording loan installment payments with natural language.
 * Flow: User says "bayar cicilan Kredivo" → find loan → show next unpaid installment → confirm → mark as paid
 */

import type { PayInstallmentParams } from "../types/intent";
import type { LoanRow, InstallmentRow } from "../types/loan";
import { sendText, sendWithKeyboard, editMessageText } from "../telegram/api";
import { setConversationState, getConversationState, clearConversationState } from "../database/conversation";
import { getLoans, getInstallmentsByLoan, markInstallmentPaid, getLoanById } from "../database/loan";
import { formatRupiah } from "./income";

/**
 * Handle pay_installment intent from AI detection.
 * Find active loans matching the platform name and show confirmation.
 */
export async function handlePaymentFromAI(
  token: string,
  chatId: number,
  db: SqlStorage,
  aiParams: PayInstallmentParams,
  todayDate: string
): Promise<void> {
  const platform = aiParams.platform?.trim();

  if (!platform) {
    await sendText(
      token,
      chatId,
      "🏦 <b>Bayar Cicilan</b>\n\n" +
      "Ketik nama platform pinjamannya, contoh:\n" +
      "• <i>\"bayar cicilan Kredivo\"</i>\n" +
      "• <i>\"sudah bayar Shopee\"</i>\n" +
      "• <i>\"lunas SeaBank bulan ini\"</i>"
    );
    return;
  }

  // Find active loans matching platform (case-insensitive partial match)
  const allLoans = getLoans(db, "active");
  const matchedLoans = allLoans.filter((loan) =>
    loan.platform.toLowerCase().includes(platform.toLowerCase())
  );

  if (matchedLoans.length === 0) {
    await sendText(
      token,
      chatId,
      `❌ Tidak menemukan pinjaman aktif dengan nama <b>${platform}</b>.\n\n` +
      "Ketik \"lihat hutang\" untuk melihat semua pinjaman, atau ketik nama platform yang tepat."
    );
    return;
  }

  if (matchedLoans.length > 1) {
    // Multiple matches — ask user to be more specific
    let text = `🔍 Ditemukan ${matchedLoans.length} pinjaman yang cocok:\n\n`;
    matchedLoans.forEach((loan, idx) => {
      text += `${idx + 1}. <b>${loan.platform}</b> (${loan.paid_installments}/${loan.total_installments} dibayar)\n`;
    });
    text += "\nKetik nama platform yang lebih spesifik.";
    await sendText(token, chatId, text);
    return;
  }

  // Single match found
  const loan = matchedLoans[0]!;
  await showPaymentConfirmation(token, chatId, db, loan, todayDate);
}

/**
 * Show next unpaid installment for confirmation.
 */
async function showPaymentConfirmation(
  token: string,
  chatId: number,
  db: SqlStorage,
  loan: LoanRow,
  todayDate: string
): Promise<void> {
  // Find next unpaid installment
  const installments = getInstallmentsByLoan(db, loan.id);
  const unpaidInstallments = installments.filter(
    (inst) => inst.status === "unpaid" || inst.status === "late"
  );

  if (unpaidInstallments.length === 0) {
    await sendText(
      token,
      chatId,
      `✅ <b>${loan.platform}</b>\n\n` +
      "Semua cicilan sudah lunas! 🎉\n\n" +
      `Total: ${loan.paid_installments}/${loan.total_installments} cicilan dibayar.`
    );
    return;
  }

  const nextInstallment = unpaidInstallments[0]!;
  const today = new Date(todayDate);
  const dueDate = new Date(nextInstallment.due_date);
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0;

  // Calculate late fee if overdue
  let lateFee = 0;
  if (isOverdue && loan.late_fee_type !== "none") {
    const daysLate = Math.abs(daysUntilDue);
    lateFee = calculateLateFee(
      loan.late_fee_type,
      loan.late_fee_value,
      nextInstallment.amount,
      daysLate
    );
  }

  const totalAmount = nextInstallment.amount + lateFee;

  let text = `💳 <b>Konfirmasi Pembayaran Cicilan</b>\n\n`;
  text += `🏦 Platform: <b>${loan.platform}</b>\n`;
  text += `🔢 Cicilan ke-${nextInstallment.installment_no} dari ${loan.total_installments}\n`;
  text += `💰 Jumlah: <b>${formatRupiah(nextInstallment.amount)}</b>\n`;
  text += `📅 Jatuh tempo: <b>${formatDate(nextInstallment.due_date)}</b>`;

  if (isOverdue) {
    text += ` <b>(TELAT ${Math.abs(daysUntilDue)} hari!)</b>\n`;
    if (lateFee > 0) {
      text += `⚠️ Denda: <b>${formatRupiah(lateFee)}</b>\n`;
      text += `💸 <b>Total bayar: ${formatRupiah(totalAmount)}</b>`;
    }
  } else if (daysUntilDue === 0) {
    text += " <b>(HARI INI)</b>";
  } else if (daysUntilDue <= 3) {
    text += ` <b>(${daysUntilDue} hari lagi)</b>`;
  } else {
    text += ` (${daysUntilDue} hari lagi)`;
  }

  text += "\n\nSudah dibayar?";

  // Save to conversation state
  setConversationState(db, "confirm_payment", {
    loan_id: loan.id,
    installment_id: nextInstallment.id,
    installment_no: nextInstallment.installment_no,
    amount: nextInstallment.amount,
    late_fee: lateFee,
    total_amount: totalAmount,
    platform: loan.platform,
  });

  await sendWithKeyboard(token, chatId, text, {
    inline_keyboard: [
      [
        { text: "✅ Sudah Bayar", callback_data: "payment_confirm_yes" },
        { text: "❌ Belum", callback_data: "payment_confirm_no" },
      ],
    ],
  });
}

/**
 * Handle payment confirmation — mark installment as paid.
 */
export async function handlePaymentConfirmed(
  token: string,
  chatId: number,
  db: SqlStorage,
  todayDate: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "confirm_payment") {
    await sendText(token, chatId, "⚠️ Sesi konfirmasi tidak ditemukan.");
    return;
  }

  const data = state.pending_data;
  const loanId = data.loan_id as number;
  const installmentId = data.installment_id as number;
  const installmentNo = data.installment_no as number;
  const amount = data.amount as number;
  const lateFee = data.late_fee as number;
  const totalAmount = data.total_amount as number;
  const platform = data.platform as string;

  // Mark installment as paid
  markInstallmentPaid(db, installmentId, totalAmount, lateFee, todayDate);
  clearConversationState(db);

  // Get updated loan info
  const loan = getLoanById(db, loanId);
  if (!loan) {
    await sendText(token, chatId, "✅ Pembayaran tercatat!");
    return;
  }

  const remainingInstallments = loan.total_installments - loan.paid_installments;
  const remainingAmount = remainingInstallments * loan.monthly_amount;

  let text = `✅ <b>Pembayaran Berhasil Dicatat!</b>\n\n`;
  text += `🏦 ${platform}\n`;
  text += `🔢 Cicilan ke-${installmentNo}\n`;
  text += `💰 Dibayar: ${formatRupiah(amount)}`;

  if (lateFee > 0) {
    text += `\n⚠️ Denda: ${formatRupiah(lateFee)}`;
    text += `\n💸 Total: ${formatRupiah(totalAmount)}`;
  }

  text += `\n\n📊 <b>Progress:</b> ${loan.paid_installments}/${loan.total_installments} cicilan lunas`;

  if (remainingInstallments === 0) {
    text += "\n\n🎉 <b>LUNAS!</b> Semua cicilan sudah dibayar!";
  } else {
    text += `\n💳 Sisa: ${remainingInstallments}x × ${formatRupiah(loan.monthly_amount)} = ${formatRupiah(remainingAmount)}`;
  }

  await sendText(token, chatId, text);
}

/**
 * Calculate late fee based on loan late fee type.
 */
function calculateLateFee(
  lateFeeType: string,
  lateFeeValue: number,
  installmentAmount: number,
  daysLate: number
): number {
  switch (lateFeeType) {
    case "percent_monthly": {
      // X% per month late — round up days to months
      const monthsLate = Math.ceil(daysLate / 30);
      return installmentAmount * (lateFeeValue / 100) * monthsLate;
    }
    case "percent_daily": {
      // X% per day late
      return installmentAmount * (lateFeeValue / 100) * daysLate;
    }
    case "fixed": {
      // Fixed amount regardless of days
      return lateFeeValue;
    }
    case "none":
    default:
      return 0;
  }
}

/**
 * Format date from YYYY-MM-DD to Indonesian format.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
