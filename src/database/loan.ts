/**
 * Loan and Installment Database Operations
 * Handles loans and installments tables for F03 feature.
 */

import type { LoanRegistrationData, LoanRow, InstallmentRow, LoanStatus } from "../types/loan";

/**
 * Register a new loan and generate all installment rows.
 * 
 * @param db - SqlStorage instance
 * @param data - Loan registration data
 * @returns The created loan ID
 */
export function registerLoan(db: SqlStorage, data: LoanRegistrationData): number {
  // Insert loan
  const result = db.exec(
    `INSERT INTO loans (
      platform, original_amount, total_with_interest, 
      total_installments, paid_installments, monthly_amount, 
      due_day, late_fee_type, late_fee_value, 
      status, note, start_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id`,
    data.platform,
    data.original_amount,
    data.total_with_interest,
    data.total_installments,
    0, // paid_installments starts at 0
    data.monthly_amount,
    data.due_day,
    data.late_fee_type,
    data.late_fee_value,
    "active",
    data.note ?? null,
    data.start_date
  ).toArray();

  if (result.length === 0) {
    throw new Error("Failed to insert loan");
  }

  const loanId = (result[0] as { id: number }).id;

  // Generate installment rows
  generateInstallments(db, loanId, data);

  return loanId;
}

/**
 * Generate installment rows for a loan.
 * Each installment has its due date calculated based on start_date + due_day.
 * 
 * @param db - SqlStorage instance
 * @param loanId - The loan ID
 * @param data - Loan registration data
 */
function generateInstallments(
  db: SqlStorage,
  loanId: number,
  data: LoanRegistrationData
): void {
  const startDate = new Date(data.start_date);
  const dueDay = data.due_day;

  for (let i = 1; i <= data.total_installments; i++) {
    // Calculate due date: start month + (i-1) months, set to due_day
    const dueDate = new Date(startDate);
    dueDate.setMonth(startDate.getMonth() + i);
    dueDate.setDate(dueDay);

    // Handle month overflow (e.g., due_day=31 in Feb becomes Mar 3)
    // We want to clamp to last day of month instead
    if (dueDate.getDate() !== dueDay) {
      dueDate.setDate(0); // Go back to last day of previous month
    }

    const dueDateStr = dueDate.toISOString().split("T")[0]!;

    // Amount: most installments use monthly_amount, but allow for variation
    // For now, all installments use monthly_amount (UI can adjust later)
    const amount = data.monthly_amount;

    db.exec(
      `INSERT INTO installments (
        loan_id, installment_no, amount, due_date, status
      ) VALUES (?, ?, ?, ?, ?)`,
      loanId,
      i,
      amount,
      dueDateStr,
      "unpaid"
    );
  }
}

/**
 * Get all loans for the user.
 * 
 * @param db - SqlStorage instance
 * @param status - Optional filter by status
 * @returns Array of loan rows
 */
export function getLoans(db: SqlStorage, status?: LoanStatus): LoanRow[] {
  let query = "SELECT * FROM loans";
  const params: (string | number)[] = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }

  query += " ORDER BY due_day ASC, created_at DESC";

  return db.exec(query, ...params).toArray() as LoanRow[];
}

/**
 * Get a single loan by ID.
 * 
 * @param db - SqlStorage instance
 * @param loanId - The loan ID
 * @returns Loan row or null
 */
export function getLoanById(db: SqlStorage, loanId: number): LoanRow | null {
  const result = db.exec("SELECT * FROM loans WHERE id = ?", loanId).toArray();
  return result.length > 0 ? (result[0] as LoanRow) : null;
}

/**
 * Get all installments for a loan.
 * 
 * @param db - SqlStorage instance
 * @param loanId - The loan ID
 * @returns Array of installment rows
 */
export function getInstallments(db: SqlStorage, loanId: number): InstallmentRow[] {
  return db.exec(
    "SELECT * FROM installments WHERE loan_id = ? ORDER BY installment_no ASC",
    loanId
  ).toArray() as InstallmentRow[];
}

/**
 * Get upcoming unpaid installments (next 30 days) across all active loans.
 * 
 * @param db - SqlStorage instance
 * @param todayDate - Today's date in YYYY-MM-DD format
 * @returns Array of installment rows with loan info
 */
export function getUpcomingInstallments(
  db: SqlStorage,
  todayDate: string
): Array<InstallmentRow & { platform: string }> {
  const endDate = new Date(todayDate);
  endDate.setDate(endDate.getDate() + 30);
  const endDateStr = endDate.toISOString().split("T")[0]!;

  return db.exec(
    `SELECT i.*, l.platform
     FROM installments i
     JOIN loans l ON i.loan_id = l.id
     WHERE i.status IN ('unpaid', 'late')
       AND i.due_date BETWEEN ? AND ?
       AND l.status = 'active'
     ORDER BY i.due_date ASC`,
    todayDate,
    endDateStr
  ).toArray() as Array<InstallmentRow & { platform: string }>;
}
