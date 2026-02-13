/**
 * Monthly Obligation Summary Handler — F03f
 *
 * Shows comprehensive monthly overview: all installments due this month,
 * paid vs unpaid status, income vs obligations ratio, and calendar view.
 *
 * Triggered via /ringkasan command (no AI cost).
 */

import type { MonthlyInstallment } from "../database/monthly";
import { getMonthInstallments, getMonthIncome, getMonthExpenses } from "../database/monthly";
import { sendText } from "../telegram/api";
import { formatRupiah } from "./income";

/** Month names in Indonesian */
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Grouped installments by loan */
interface LoanGroup {
  platform: string;
  loanId: number;
  totalInstallments: number;
  installments: MonthlyInstallment[];
}

/**
 * Handle /ringkasan command — show monthly obligation summary.
 * Usage: /ringkasan (current month) or /ringkasan 3 (March) or /ringkasan 2026-03
 */
export async function handleMonthlySummary(
  token: string,
  chatId: number,
  db: SqlStorage,
  todayDate: string,
  monthArg?: string
): Promise<void> {
  const today = new Date(todayDate);
  let year = today.getFullYear();
  let month = today.getMonth() + 1; // 1-indexed

  // Parse optional month argument
  if (monthArg) {
    const parsed = parseMonthArg(monthArg, year);
    if (parsed) {
      year = parsed.year;
      month = parsed.month;
    } else {
      await sendText(
        token,
        chatId,
        "❌ Format bulan tidak valid.\n\n" +
        "Contoh:\n" +
        "• /ringkasan — bulan ini\n" +
        "• /ringkasan 3 — Maret\n" +
        "• /ringkasan 2026-03 — Maret 2026"
      );
      return;
    }
  }

  const installments = getMonthInstallments(db, year, month);
  const monthIncome = getMonthIncome(db, year, month);
  const monthExpenses = getMonthExpenses(db, year, month);

  if (installments.length === 0 && monthIncome === 0 && monthExpenses === 0) {
    await sendText(
      token,
      chatId,
      `📋 <b>Ringkasan ${MONTH_NAMES[month - 1]} ${year}</b>\n\n` +
      "Tidak ada data untuk bulan ini.\n\n" +
      "Daftar pinjaman dulu atau catat pendapatan/pengeluaran."
    );
    return;
  }

  const message = buildMonthlySummary(installments, monthIncome, monthExpenses, year, month, todayDate);
  await sendText(token, chatId, message);
}

/**
 * Parse month argument from user input.
 * Supports: "3", "03", "2026-03"
 */
function parseMonthArg(
  arg: string,
  defaultYear: number
): { year: number; month: number } | null {
  const trimmed = arg.trim();

  // Format: YYYY-MM
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-");
    if (parts.length !== 2) return null;
    const y = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
    return { year: y, month: m };
  }

  // Format: just a number (month)
  const m = parseInt(trimmed, 10);
  if (isNaN(m) || m < 1 || m > 12) return null;
  return { year: defaultYear, month: m };
}

/**
 * Build the comprehensive monthly summary message.
 */
function buildMonthlySummary(
  installments: MonthlyInstallment[],
  monthIncome: number,
  monthExpenses: number,
  year: number,
  month: number,
  todayDate: string
): string {
  const today = new Date(todayDate);
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  let text = `📋 <b>Ringkasan ${MONTH_NAMES[month - 1]} ${year}</b>\n`;
  text += "════════════════════════════\n";

  // ── Section 1: Income & Expenses overview ──
  if (monthIncome > 0 || monthExpenses > 0) {
    text += "\n💰 <b>Pendapatan & Pengeluaran</b>\n";
    text += `  📈 Pendapatan: ${formatRupiah(monthIncome)}\n`;
    text += `  📉 Pengeluaran: ${formatRupiah(monthExpenses)}\n`;
    const netIncome = monthIncome - monthExpenses;
    if (netIncome >= 0) {
      text += `  💵 Sisa: ${formatRupiah(netIncome)}\n`;
    } else {
      text += `  ⚠️ Defisit: ${formatRupiah(Math.abs(netIncome))}\n`;
    }
  }

  if (installments.length === 0) {
    text += "\n✅ Tidak ada cicilan jatuh tempo bulan ini.\n";
    return text;
  }

  // ── Categorize installments ──
  const paid = installments.filter((i) => i.status === "paid");
  const unpaid = installments.filter((i) => i.status === "unpaid" || i.status === "late");

  const overdue = unpaid.filter((i) => {
    const dueDate = new Date(i.due_date);
    return dueDate < today;
  });
  const upcoming = unpaid.filter((i) => {
    const dueDate = new Date(i.due_date);
    return dueDate >= today;
  });

  const totalObligations = installments.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = paid.reduce((sum, i) => sum + (i.paid_amount ?? i.amount), 0);
  const totalLateFees = paid.reduce((sum, i) => sum + (i.late_fee ?? 0), 0);
  const totalRemaining = unpaid.reduce((sum, i) => sum + i.amount, 0);

  // ── Section 2: Summary stats ──
  text += "\n📊 <b>Kewajiban Cicilan</b>\n";
  text += `  Total cicilan: ${installments.length}x = ${formatRupiah(totalObligations)}\n`;
  text += `  ✅ Terbayar: ${paid.length}x = ${formatRupiah(totalPaid)}`;
  if (totalLateFees > 0) {
    text += ` (+ denda ${formatRupiah(totalLateFees)})`;
  }
  text += "\n";

  if (overdue.length > 0) {
    const overdueTotal = overdue.reduce((sum, i) => sum + i.amount, 0);
    text += `  🔴 Telat: ${overdue.length}x = ${formatRupiah(overdueTotal)}\n`;
  }
  if (upcoming.length > 0) {
    const upcomingTotal = upcoming.reduce((sum, i) => sum + i.amount, 0);
    text += `  🟡 Belum bayar: ${upcoming.length}x = ${formatRupiah(upcomingTotal)}\n`;
  }

  // Progress bar
  const progressPct = installments.length > 0 ? Math.round((paid.length / installments.length) * 100) : 0;
  const filledBlocks = Math.round(progressPct / 10);
  const emptyBlocks = 10 - filledBlocks;
  text += `  ${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progressPct}%\n`;

  // ── Income vs Obligations comparison ──
  if (monthIncome > 0 && totalObligations > 0) {
    const obligationRatio = Math.round((totalObligations / monthIncome) * 100);
    text += "\n💡 <b>Rasio Hutang</b>\n";
    text += `  Cicilan = ${obligationRatio}% dari pendapatan\n`;
    if (obligationRatio > 50) {
      text += "  ⚠️ Cicilan lebih dari 50% pendapatan — hati-hati!\n";
    } else if (obligationRatio > 30) {
      text += "  🟡 Cicilan 30-50% pendapatan — masih bisa diatur\n";
    } else {
      text += "  ✅ Rasio cicilan sehat (di bawah 30%)\n";
    }
  }

  // ── Section 3: Per-loan breakdown ──
  const loanGroups = groupByLoan(installments);

  text += "\n════════════════════════════\n";
  text += "📝 <b>Detail Per Pinjaman</b>\n";

  for (const group of loanGroups) {
    text += `\n🏦 <b>${group.platform}</b>\n`;

    for (const inst of group.installments) {
      const dueDate = new Date(inst.due_date);
      const dayStr = dueDate.getDate().toString();

      let statusIcon: string;
      let statusText: string;

      if (inst.status === "paid") {
        statusIcon = "✅";
        statusText = `dibayar${inst.paid_date ? " " + formatShortDate(inst.paid_date) : ""}`;
      } else if (dueDate < today) {
        const daysLate = Math.ceil(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        statusIcon = "🔴";
        statusText = `telat ${daysLate} hari`;
      } else if (dueDate.toISOString().split("T")[0] === todayDate) {
        statusIcon = "⚠️";
        statusText = "HARI INI";
      } else {
        const daysUntil = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        statusIcon = daysUntil <= 3 ? "🟡" : "⏳";
        statusText = `${daysUntil} hari lagi`;
      }

      text += `  ${statusIcon} tgl ${dayStr} — ke-${inst.installment_no}/${group.totalInstallments}`;
      text += ` ${formatRupiah(inst.amount)} (${statusText})\n`;
    }
  }

  // ── Actionable footer ──
  if (isCurrentMonth && unpaid.length > 0) {
    text += "\n════════════════════════════\n";
    text += "💡 <b>Aksi</b>\n";
    if (overdue.length > 0) {
      text += "• /denda — lihat total denda keterlambatan\n";
    }
    text += "• Ketik <i>\"bayar cicilan [nama]\"</i> untuk bayar\n";
    text += "• /hutang — lihat dashboard semua pinjaman";
  }

  return text;
}

/**
 * Group installments by loan.
 */
function groupByLoan(installments: MonthlyInstallment[]): LoanGroup[] {
  const map = new Map<number, LoanGroup>();

  for (const inst of installments) {
    const existing = map.get(inst.loan_id);
    if (existing) {
      existing.installments.push(inst);
    } else {
      map.set(inst.loan_id, {
        platform: inst.platform,
        loanId: inst.loan_id,
        totalInstallments: inst.total_installments,
        installments: [inst],
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Format date as short "13 Feb" style.
 */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}
