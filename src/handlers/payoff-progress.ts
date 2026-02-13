/**
 * Payoff Progress Tracker Handler — F03g
 *
 * Overall debt reduction tracker showing how much debt has been paid off,
 * remaining obligations, per-loan progress, and projected payoff timeline.
 *
 * Triggered via /progres command (no AI cost).
 */

import type { LoanRow } from "../types/loan";
import { sendText } from "../telegram/api";
import { getLoans, getInstallmentsByLoan } from "../database/loan";
import { formatRupiah } from "./income";

/** Per-loan progress data */
interface LoanProgress {
  platform: string;
  status: string;
  originalAmount: number;
  totalWithInterest: number;
  totalInstallments: number;
  paidInstallments: number;
  monthlyAmount: number;
  totalPaid: number;
  totalLateFees: number;
  remaining: number;
  progressPct: number;
  startDate: string;
  firstPayDate: string | null;
  lastPayDate: string | null;
  nextDueDate: string | null;
}

/**
 * Handle /progres command — show overall payoff progress.
 */
export async function handlePayoffProgress(
  token: string,
  chatId: number,
  db: SqlStorage,
  todayDate: string
): Promise<void> {
  // Get ALL loans (active + paid_off) for full picture
  const allLoans = getLoans(db);

  if (allLoans.length === 0) {
    await sendText(
      token,
      chatId,
      "📋 Belum ada pinjaman terdaftar.\n\n" +
      "Daftar pinjaman dulu dengan mengetik nama platform dan detailnya."
    );
    return;
  }

  const loanProgresses: LoanProgress[] = [];

  for (const loan of allLoans) {
    const installments = getInstallmentsByLoan(db, loan.id);
    const paidInstallments = installments.filter((i) => i.status === "paid");
    const unpaidInstallments = installments.filter((i) => i.status !== "paid");

    const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.paid_amount || i.amount), 0);
    const totalLateFees = paidInstallments.reduce((sum, i) => sum + (i.late_fee || 0), 0);
    const remaining = unpaidInstallments.reduce((sum, i) => sum + i.amount, 0);
    const progressPct = loan.total_installments > 0
      ? Math.round((loan.paid_installments / loan.total_installments) * 100)
      : 0;

    // Find first and last payment dates
    const paidDates = paidInstallments
      .filter((i) => i.paid_date)
      .map((i) => i.paid_date!)
      .sort();
    const firstPayDate = paidDates.length > 0 ? paidDates[0]! : null;
    const lastPayDate = paidDates.length > 0 ? paidDates[paidDates.length - 1]! : null;

    // Find next unpaid due date
    const nextUnpaid = unpaidInstallments
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    const nextDueDate = nextUnpaid ? nextUnpaid.due_date : null;

    loanProgresses.push({
      platform: loan.platform,
      status: loan.status,
      originalAmount: loan.original_amount,
      totalWithInterest: loan.total_with_interest,
      totalInstallments: loan.total_installments,
      paidInstallments: loan.paid_installments,
      monthlyAmount: loan.monthly_amount,
      totalPaid,
      totalLateFees,
      remaining,
      progressPct,
      startDate: loan.start_date,
      firstPayDate,
      lastPayDate,
      nextDueDate,
    });
  }

  const message = buildProgressMessage(loanProgresses, todayDate);
  await sendText(token, chatId, message);
}

/**
 * Build the payoff progress message.
 */
function buildProgressMessage(
  loans: LoanProgress[],
  todayDate: string
): string {
  const today = new Date(todayDate);

  // — Overall stats —
  const activeLoans = loans.filter((l) => l.status === "active");
  const paidOffLoans = loans.filter((l) => l.status === "paid_off");

  const grandTotalDebt = loans.reduce((sum, l) => sum + l.totalWithInterest, 0);
  const grandTotalPaid = loans.reduce((sum, l) => sum + l.totalPaid, 0);
  const grandTotalLateFees = loans.reduce((sum, l) => sum + l.totalLateFees, 0);
  const grandRemaining = activeLoans.reduce((sum, l) => sum + l.remaining, 0);
  const grandTotalInstallments = loans.reduce((sum, l) => sum + l.totalInstallments, 0);
  const grandPaidInstallments = loans.reduce((sum, l) => sum + l.paidInstallments, 0);
  const overallPct = grandTotalInstallments > 0
    ? Math.round((grandPaidInstallments / grandTotalInstallments) * 100)
    : 0;

  let text = "📊 <b>Progres Pelunasan Hutang</b>\n";
  text += "══════════════════════════════\n";

  // — Big progress bar —
  const filledBlocks = Math.round(overallPct / 5);
  const emptyBlocks = 20 - filledBlocks;
  text += `\n${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} <b>${overallPct}%</b>\n\n`;

  // — Grand totals —
  text += `💰 Total hutang: ${formatRupiah(grandTotalDebt)}\n`;
  text += `✅ Sudah bayar: ${formatRupiah(grandTotalPaid)}`;
  if (grandTotalLateFees > 0) {
    text += ` (termasuk denda ${formatRupiah(grandTotalLateFees)})`;
  }
  text += "\n";
  text += `📉 Sisa hutang: <b>${formatRupiah(grandRemaining)}</b>\n`;
  text += `🔢 Cicilan: ${grandPaidInstallments}/${grandTotalInstallments} lunas\n`;
  text += `🏦 Pinjaman: ${paidOffLoans.length} lunas, ${activeLoans.length} aktif\n`;

  // — Projected payoff —
  if (activeLoans.length > 0 && grandRemaining > 0) {
    const monthlyObligation = activeLoans.reduce((sum, l) => sum + l.monthlyAmount, 0);
    if (monthlyObligation > 0) {
      const monthsRemaining = Math.ceil(grandRemaining / monthlyObligation);
      const projectedDate = new Date(today);
      projectedDate.setMonth(projectedDate.getMonth() + monthsRemaining);
      text += `\n📅 <b>Perkiraan lunas:</b> ${formatMonthYear(projectedDate)}`;
      text += ` (~${monthsRemaining} bulan lagi)\n`;
    }
  }

  // — Per-loan progress (active first) —
  if (activeLoans.length > 0) {
    text += "\n══════════════════════════════\n";
    text += "🏦 <b>Pinjaman Aktif</b>\n";

    // Sort by progress descending (closest to payoff first)
    const sortedActive = [...activeLoans].sort((a, b) => b.progressPct - a.progressPct);

    for (const loan of sortedActive) {
      text += `\n<b>${loan.platform}</b>\n`;

      // Mini progress bar
      const filled = Math.round(loan.progressPct / 10);
      const empty = 10 - filled;
      text += `  ${'█'.repeat(filled)}${'░'.repeat(empty)} ${loan.progressPct}%`;
      text += ` (${loan.paidInstallments}/${loan.totalInstallments})\n`;

      text += `  💰 Hutang: ${formatRupiah(loan.totalWithInterest)}\n`;
      text += `  ✅ Dibayar: ${formatRupiah(loan.totalPaid)}\n`;
      text += `  📉 Sisa: ${formatRupiah(loan.remaining)}`;

      // Months remaining for this loan
      if (loan.monthlyAmount > 0 && loan.remaining > 0) {
        const monthsLeft = Math.ceil(loan.remaining / loan.monthlyAmount);
        text += ` (~${monthsLeft} bln)`;
      }
      text += "\n";

      // Late fees warning
      if (loan.totalLateFees > 0) {
        text += `  ⚠️ Denda terbayar: ${formatRupiah(loan.totalLateFees)}\n`;
      }

      // Next due date
      if (loan.nextDueDate) {
        const nextDue = new Date(loan.nextDueDate);
        const daysUntil = Math.ceil(
          (nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntil < 0) {
          text += `  🔴 Cicilan berikut: TELAT ${Math.abs(daysUntil)} hari\n`;
        } else if (daysUntil === 0) {
          text += "  ⚠️ Cicilan berikut: HARI INI\n";
        } else {
          text += `  📅 Cicilan berikut: ${daysUntil} hari lagi\n`;
        }
      }
    }
  }

  // — Paid-off loans celebration —
  if (paidOffLoans.length > 0) {
    text += "\n══════════════════════════════\n";
    text += "🎉 <b>Sudah Lunas!</b>\n\n";

    for (const loan of paidOffLoans) {
      text += `  ✅ <b>${loan.platform}</b>`;
      text += ` — ${formatRupiah(loan.totalWithInterest)}`;
      text += ` (${loan.totalInstallments}x cicilan)`;
      if (loan.totalLateFees > 0) {
        text += ` + denda ${formatRupiah(loan.totalLateFees)}`;
      }
      text += "\n";
    }
  }

  // — Motivational footer —
  text += "\n══════════════════════════════\n";
  if (overallPct === 100) {
    text += "🎊 <b>SELAMAT! Semua hutang lunas!</b> 🎊\n";
    text += "Bebas dari hutang — pertahankan! 💪";
  } else if (overallPct >= 75) {
    text += "💪 <b>Hampir lunas!</b> Tinggal sedikit lagi, semangat!";
  } else if (overallPct >= 50) {
    text += "👍 <b>Sudah lewat setengah jalan!</b> Terus konsisten bayar.";
  } else if (overallPct >= 25) {
    text += "🚶 <b>Sudah seperempat jalan.</b> Langkah kecil tapi pasti!";
  } else if (overallPct > 0) {
    text += "🌱 <b>Awal yang bagus!</b> Setiap cicilan mendekatkanmu ke bebas hutang.";
  } else {
    text += "⏳ Belum ada pembayaran. Yuk mulai bayar cicilan pertama!\n";
    text += 'Ketik <i>"bayar cicilan [nama]"</i> untuk mulai.';
  }

  return text;
}

/**
 * Format date as "Februari 2026" style.
 */
function formatMonthYear(date: Date): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}
