/**
 * Monthly Database Operations
 * Queries for monthly obligation summaries — F03f.
 */

import type { InstallmentRow } from "../types/loan";

/** Installment row joined with loan platform name */
export interface MonthlyInstallment {
  id: number;
  loan_id: number;
  installment_no: number;
  amount: number;
  due_date: string;
  status: string;
  paid_amount: number | null;
  late_fee: number | null;
  paid_date: string | null;
  platform: string;
  total_installments: number;
  late_fee_type: string;
  late_fee_value: number;
}

/**
 * Get all installments due in a given month across all active loans.
 * Also includes paid_off loans that had installments in this month.
 *
 * @param db - SqlStorage instance
 * @param year - Year (e.g. 2026)
 * @param month - Month (1-12)
 */
export function getMonthInstallments(
  db: SqlStorage,
  year: number,
  month: number
): MonthlyInstallment[] {
  // Build date range for the month
  const monthStr = month.toString().padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;

  // End date: first day of next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = nextMonth.toString().padStart(2, "0");
  const endDate = `${nextYear}-${nextMonthStr}-01`;

  return db.exec(
    `SELECT i.id, i.loan_id, i.installment_no, i.amount, i.due_date,
            i.status, i.paid_amount, i.late_fee, i.paid_date,
            l.platform, l.total_installments, l.late_fee_type, l.late_fee_value
     FROM installments i
     JOIN loans l ON i.loan_id = l.id
     WHERE i.due_date >= ? AND i.due_date < ?
     ORDER BY i.due_date ASC, l.platform ASC`,
    startDate,
    endDate
  ).toArray() as unknown as MonthlyInstallment[];
}

/**
 * Get income total for a given month.
 */
export function getMonthIncome(db: SqlStorage, year: number, month: number): number {
  const monthStr = month.toString().padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = nextMonth.toString().padStart(2, "0");
  const endDate = `${nextYear}-${nextMonthStr}-01`;

  const result = db.exec(
    `SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE date >= ? AND date < ?`,
    startDate,
    endDate
  ).toArray();

  return result.length > 0 ? (result[0] as unknown as { total: number }).total : 0;
}

/**
 * Get expense total for a given month.
 */
export function getMonthExpenses(db: SqlStorage, year: number, month: number): number {
  const monthStr = month.toString().padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = nextMonth.toString().padStart(2, "0");
  const endDate = `${nextYear}-${nextMonthStr}-01`;

  const result = db.exec(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date < ?`,
    startDate,
    endDate
  ).toArray();

  return result.length > 0 ? (result[0] as unknown as { total: number }).total : 0;
}
