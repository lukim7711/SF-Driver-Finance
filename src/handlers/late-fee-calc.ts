/**
 * Late Fee Calculator Handler — F03e
 *
 * Standalone calculator that shows projected penalties for overdue loans.
 * Triggered via /denda command (no AI cost) or natural language.
 *
 * Shows: per-installment breakdown, total projected penalty,
 * and comparison of paying now vs. waiting longer.
 */

import type { LoanRow, InstallmentRow } from "../types/loan";
import { sendText } from "../telegram/api";
import { getLoans, getInstallmentsByLoan } from "../database/loan";
import { formatRupiah } from "./income";

/** Late fee calculation result for one installment */
interface InstallmentPenalty {
  installmentNo: number;
  amount: number;
  dueDate: string;
  daysLate: number;
  lateFee: number;
  total: number;
}

/** Aggregated result for one loan */
interface LoanPenaltySummary {
  platform: string;
  lateFeeType: string;
  lateFeeValue: number;
  installments: InstallmentPenalty[];
  totalLateFees: number;
  totalOwed: number;
}

/**
 * Handle /denda command — show late fee calculations.
 * Usage: /denda (all loans) or /denda Kredivo (specific loan)
 */
export async function handleLateFeeCalculator(
  token: string,
  chatId: number,
  db: SqlStorage,
  todayDate: string,
  platformFilter?: string
): Promise<void> {
  const activeLoans = getLoans(db, "active");

  if (activeLoans.length === 0) {
    await sendText(
      token,
      chatId,
      "📋 Tidak ada pinjaman aktif.\n\nDaftar pinjaman dulu dengan mengetik nama platform dan detailnya."
    );
    return;
  }

  // Filter by platform if specified
  let targetLoans = activeLoans;
  if (platformFilter) {
    targetLoans = activeLoans.filter((loan) =>
      loan.platform.toLowerCase().includes(platformFilter.toLowerCase())
    );

    if (targetLoans.length === 0) {
      await sendText(
        token,
        chatId,
        `❌ Tidak menemukan pinjaman aktif dengan nama <b>${platformFilter}</b>.\n\n` +
        "Ketik /denda tanpa nama untuk melihat semua, atau /hutang untuk cek daftar pinjaman."
      );
      return;
    }
  }

  const today = new Date(todayDate);
  const summaries: LoanPenaltySummary[] = [];

  for (const loan of targetLoans) {
    const installments = getInstallmentsByLoan(db, loan.id);
    const overdueInstallments = installments.filter((inst) => {
      if (inst.status !== "unpaid" && inst.status !== "late") return false;
      const dueDate = new Date(inst.due_date);
      return dueDate < today;
    });

    if (overdueInstallments.length === 0) continue;

    const penalties: InstallmentPenalty[] = overdueInstallments.map((inst) => {
      const dueDate = new Date(inst.due_date);
      const daysLate = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const lateFee = calculateLateFee(
        loan.late_fee_type,
        loan.late_fee_value,
        inst.amount,
        daysLate
      );

      return {
        installmentNo: inst.installment_no,
        amount: inst.amount,
        dueDate: inst.due_date,
        daysLate,
        lateFee,
        total: inst.amount + lateFee,
      };
    });

    const totalLateFees = penalties.reduce((sum, p) => sum + p.lateFee, 0);
    const totalOwed = penalties.reduce((sum, p) => sum + p.total, 0);

    summaries.push({
      platform: loan.platform,
      lateFeeType: loan.late_fee_type,
      lateFeeValue: loan.late_fee_value,
      installments: penalties,
      totalLateFees,
      totalOwed,
    });
  }

  // No overdue installments found
  if (summaries.length === 0) {
    const scope = platformFilter ? `<b>${platformFilter}</b>` : "semua pinjaman";
    await sendText(
      token,
      chatId,
      `✅ <b>Tidak ada cicilan telat!</b>\n\n` +
      `${scope} — semua cicilan terbayar tepat waktu. 👍\n\n` +
      "Ketik /hutang untuk melihat dashboard pinjaman."
    );
    return;
  }

  // Build response message
  const message = buildPenaltyMessage(summaries, todayDate);
  await sendText(token, chatId, message);
}

/**
 * Build the penalty breakdown message.
 */
function buildPenaltyMessage(
  summaries: LoanPenaltySummary[],
  todayDate: string
): string {
  let text = "🧮 <b>Kalkulator Denda</b>\n";
  text += `📅 Per tanggal: ${formatDateIndo(todayDate)}\n`;
  text += "────────────────────────\n";

  let grandTotalFees = 0;
  let grandTotalOwed = 0;

  for (const summary of summaries) {
    text += `\n🏦 <b>${summary.platform}</b>\n`;
    text += `📌 Jenis denda: ${formatFeeType(summary.lateFeeType, summary.lateFeeValue)}\n\n`;

    for (const inst of summary.installments) {
      text += `  Cicilan ke-${inst.installmentNo}`;
      text += ` — telat <b>${inst.daysLate} hari</b>\n`;
      text += `  💰 Pokok: ${formatRupiah(inst.amount)}\n`;

      if (inst.lateFee > 0) {
        text += `  ⚠️ Denda: <b>${formatRupiah(inst.lateFee)}</b>\n`;
        text += `  💸 Total: <b>${formatRupiah(inst.total)}</b>\n`;
      } else {
        text += "  ✅ Denda: Rp0 (tidak ada denda)\n";
      }
      text += "\n";
    }

    if (summary.installments.length > 1) {
      text += `  📊 Subtotal ${summary.platform}:\n`;
      text += `  Denda: ${formatRupiah(summary.totalLateFees)}\n`;
      text += `  Total bayar: <b>${formatRupiah(summary.totalOwed)}</b>\n`;
    }

    grandTotalFees += summary.totalLateFees;
    grandTotalOwed += summary.totalOwed;
  }

  // Grand total if multiple loans
  if (summaries.length > 1) {
    text += "────────────────────────\n";
    text += "📊 <b>Total Semua Denda:</b>\n";
    text += `⚠️ Total denda: <b>${formatRupiah(grandTotalFees)}</b>\n`;
    text += `💸 Total harus bayar: <b>${formatRupiah(grandTotalOwed)}</b>\n`;
  }

  // Actionable tips
  text += "\n────────────────────────\n";
  text += "💡 <b>Tips:</b>\n";

  if (grandTotalFees > 0) {
    text += "• Semakin lama telat, denda makin besar\n";
    text += "• Bayar sekarang untuk stop denda bertambah\n";
    text += '• Ketik <i>"bayar cicilan [nama]"</i> untuk bayar';
  } else {
    text += "• Cicilan telat tapi tanpa denda — tetap bayar segera ya!\n";
    text += '• Ketik <i>"bayar cicilan [nama]"</i> untuk bayar';
  }

  return text;
}

/**
 * Format late fee type for display.
 */
function formatFeeType(type: string, value: number): string {
  switch (type) {
    case "percent_monthly":
      return `${value}% per bulan`;
    case "percent_daily":
      return `${value}% per hari`;
    case "fixed":
      return `${formatRupiah(value)} (tetap)`;
    case "none":
      return "Tidak ada denda";
    default:
      return "Tidak diketahui";
  }
}

/**
 * Calculate late fee — same logic as payment.ts but exported for reuse.
 */
export function calculateLateFee(
  lateFeeType: string,
  lateFeeValue: number,
  installmentAmount: number,
  daysLate: number
): number {
  switch (lateFeeType) {
    case "percent_monthly": {
      const monthsLate = Math.ceil(daysLate / 30);
      return installmentAmount * (lateFeeValue / 100) * monthsLate;
    }
    case "percent_daily": {
      return installmentAmount * (lateFeeValue / 100) * daysLate;
    }
    case "fixed": {
      return lateFeeValue;
    }
    case "none":
    default:
      return 0;
  }
}

/**
 * Format date to Indonesian format.
 */
function formatDateIndo(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
