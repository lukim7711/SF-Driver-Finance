/**
 * Loan Dashboard Handler — F03c
 *
 * Shows all loans with their current status, progress,
 * next due dates, and remaining balances.
 * Triggered by: "lihat hutang", "cek pinjaman", "status cicilan"
 */

import type { LoanRow, InstallmentRow } from "../types/loan";
import { sendText } from "../telegram/api";
import { getLoans, getInstallmentsByLoan } from "../database/loan";
import { formatRupiah } from "./income";

/** Urgency thresholds for due date warnings */
const URGENCY = {
  OVERDUE: -1,
  CRITICAL: 3,
  WARNING: 7,
} as const;

/**
 * Handle view_loans intent — show the full loan dashboard.
 */
export async function handleLoanDashboard(
  token: string,
  chatId: number,
  db: SqlStorage,
  todayDate: string
): Promise<void> {
  const activeLoans = getLoans(db, "active");
  const paidOffLoans = getLoans(db, "paid_off");

  if (activeLoans.length === 0 && paidOffLoans.length === 0) {
    await sendText(
      token,
      chatId,
      "🏦 <b>Daftar Pinjaman</b>\n\n" +
      "Belum ada pinjaman yang terdaftar.\n\n" +
      "Untuk mendaftarkan pinjaman, kirim pesan seperti:\n" +
      '• <i>"kredivo 5jt 12 bulan 500rb/bln"</i>\n' +
      '• <i>"shopee pinjam 3.5jt 10x tanggal 13"</i>'
    );
    return;
  }

  const today = new Date(todayDate);

  // Build info for each active loan with next due date
  const loanInfos = activeLoans.map((loan) => {
    const installments = getInstallmentsByLoan(db, loan.id);
    const nextUnpaid = installments.find(
      (inst) => inst.status === "unpaid" || inst.status === "late"
    );
    const nextDueDate = nextUnpaid ? new Date(nextUnpaid.due_date) : null;
    const daysUntilDue = nextDueDate
      ? Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return { loan, installments, nextUnpaid, nextDueDate, daysUntilDue };
  });

  // Sort by nearest due date (overdue first, then soonest)
  loanInfos.sort((a, b) => {
    if (a.daysUntilDue === null && b.daysUntilDue === null) return 0;
    if (a.daysUntilDue === null) return 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  // Build dashboard text
  let text = "🏦 <b>Dashboard Pinjaman</b>\n";
  text += `📅 ${formatDateIndo(todayDate)}\n`;
  text += "─".repeat(24) + "\n";

  // Active loans section
  for (const info of loanInfos) {
    text += "\n" + buildLoanCard(info.loan, info.nextUnpaid, info.daysUntilDue);
  }

  // Summary totals
  text += "\n" + "─".repeat(24) + "\n";
  text += buildSummary(loanInfos, paidOffLoans);

  // Paid-off loans (compact)
  if (paidOffLoans.length > 0) {
    text += "\n\n✅ <b>Lunas:</b> ";
    text += paidOffLoans.map((l) => l.platform).join(", ");
  }

  await sendText(token, chatId, text);
}

/**
 * Build a single loan card for the dashboard.
 */
function buildLoanCard(
  loan: LoanRow,
  nextUnpaid: InstallmentRow | undefined,
  daysUntilDue: number | null
): string {
  const progress = loan.paid_installments / loan.total_installments;
  const progressBar = buildProgressBar(progress, 10);
  const remainingInstallments = loan.total_installments - loan.paid_installments;
  const remainingAmount = remainingInstallments * loan.monthly_amount;

  let card = `${getDueIcon(daysUntilDue)} <b>${loan.platform}</b>\n`;
  card += `${progressBar} ${loan.paid_installments}/${loan.total_installments}\n`;
  card += `💰 Cicilan: ${formatRupiah(loan.monthly_amount)}/bln\n`;
  card += `💳 Sisa: ${formatRupiah(remainingAmount)} (${remainingInstallments}x)\n`;

  if (nextUnpaid && daysUntilDue !== null) {
    card += `📅 Jatuh tempo: Tgl ${loan.due_day} — ${formatDueCountdown(daysUntilDue)}\n`;
  }

  return card;
}

/**
 * Build visual progress bar using block characters.
 * Example: ██████░░░░ 60%
 */
function buildProgressBar(progress: number, length: number): string {
  const filled = Math.round(progress * length);
  const empty = length - filled;
  const percent = Math.round(progress * 100);
  return "█".repeat(filled) + "░".repeat(empty) + ` ${percent}%`;
}

/**
 * Get icon based on due date urgency.
 */
function getDueIcon(daysUntilDue: number | null): string {
  if (daysUntilDue === null) return "🏦";
  if (daysUntilDue < URGENCY.OVERDUE) return "🔴"; // Overdue
  if (daysUntilDue <= URGENCY.CRITICAL) return "🟠"; // 0-3 days
  if (daysUntilDue <= URGENCY.WARNING) return "🟡"; // 4-7 days
  return "🟢"; // More than 7 days
}

/**
 * Format due date countdown text with urgency level.
 */
function formatDueCountdown(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    return `<b>TELAT ${Math.abs(daysUntilDue)} hari!</b>`;
  }
  if (daysUntilDue === 0) {
    return "<b>HARI INI!</b>";
  }
  if (daysUntilDue <= URGENCY.CRITICAL) {
    return `<b>${daysUntilDue} hari lagi!</b>`;
  }
  if (daysUntilDue <= URGENCY.WARNING) {
    return `${daysUntilDue} hari lagi`;
  }
  return `${daysUntilDue} hari lagi`;
}

/**
 * Build summary totals for the dashboard.
 */
function buildSummary(
  activeLoanInfos: Array<{
    loan: LoanRow;
    daysUntilDue: number | null;
  }>,
  paidOffLoans: LoanRow[]
): string {
  const totalActive = activeLoanInfos.length;
  const totalPaidOff = paidOffLoans.length;

  // Calculate total remaining debt
  let totalRemainingDebt = 0;
  let totalMonthlyObligation = 0;

  for (const info of activeLoanInfos) {
    const remaining = info.loan.total_installments - info.loan.paid_installments;
    totalRemainingDebt += remaining * info.loan.monthly_amount;
    totalMonthlyObligation += info.loan.monthly_amount;
  }

  // Find nearest due date
  const nearestDue = activeLoanInfos.find((info) => info.daysUntilDue !== null);

  let summary = `📊 <b>Ringkasan</b>\n`;
  summary += `💸 Total sisa hutang: <b>${formatRupiah(totalRemainingDebt)}</b>\n`;
  summary += `📆 Cicilan per bulan: <b>${formatRupiah(totalMonthlyObligation)}</b>\n`;
  summary += `🏦 Pinjaman aktif: <b>${totalActive}</b>`;

  if (totalPaidOff > 0) {
    summary += ` | Lunas: <b>${totalPaidOff}</b>`;
  }

  if (nearestDue && nearestDue.daysUntilDue !== null) {
    summary += `\n⏰ Terdekat: <b>${nearestDue.loan.platform}</b> — ${formatDueCountdown(nearestDue.daysUntilDue)}`;
  }

  return summary;
}

/**
 * Format date string (YYYY-MM-DD) to Indonesian display format.
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
