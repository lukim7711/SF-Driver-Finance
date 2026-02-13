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
    0,
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

  const loanId = (result[0] as unknown as { id: number }).id;

  generateInstallments(db, loanId, data);

  return loanId;
}

/**
 * Generate installment rows for a loan.
 * Each installment has its due date calculated based on start_date + due_day.
 */
function generateInstallments(
  db: SqlStorage,
  loanId: number,
  data: LoanRegistrationData
): void {
  const startDate = new Date(data.start_date);
  const dueDay = data.due_day;

  for (let i = 1; i <= data.total_installments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(startDate.getMonth() + i);
    dueDate.setDate(dueDay);

    // Clamp to last day of month if due_day overflows (e.g. 31 in Feb)
    if (dueDate.getDate() !== dueDay) {
      dueDate.setDate(0);
    }

    const dueDateStr = dueDate.toISOString().split("T")[0]!;
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
 */
export function getLoans(db: SqlStorage, status?: LoanStatus): LoanRow[] {
  let query = "SELECT * FROM loans";
  const params: (string | number)[] = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }

  query += " ORDER BY due_day ASC, created_at DESC";

  return db.exec(query, ...params).toArray() as unknown as LoanRow[];
}

/**
 * Get a single loan by ID.
 */
export function getLoanById(db: SqlStorage, loanId: number): LoanRow | null {
  const result = db.exec("SELECT * FROM loans WHERE id = ?", loanId).toArray();
  return result.length > 0 ? (result[0] as unknown as LoanRow) : null;
}

/**
 * Get all installments for a loan (ordered by installment_no).
 */
export function getInstallmentsByLoan(db: SqlStorage, loanId: number): InstallmentRow[] {
  return db.exec(
    "SELECT * FROM installments WHERE loan_id = ? ORDER BY installment_no ASC",
    loanId
  ).toArray() as unknown as InstallmentRow[];
}

/**
 * Get all installments for a loan.
 * @deprecated Use getInstallmentsByLoan instead
 */
export function getInstallments(db: SqlStorage, loanId: number): InstallmentRow[] {
  return getInstallmentsByLoan(db, loanId);
}

/**
 * Get upcoming unpaid installments (next 30 days) across all active loans.
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
  ).toArray() as unknown as Array<InstallmentRow & { platform: string }>;
}

/**
 * Mark an installment as paid.
 * Updates installment record and increments loan's paid_installments counter.
 * If all installments are paid, marks the loan as paid_off.
 *
 * @param db - SqlStorage instance
 * @param installmentId - ID of the installment to mark as paid
 * @param paidAmount - Amount paid (including late fees if any)
 * @param lateFee - Late fee charged
 * @param paidDate - Date when payment was made (YYYY-MM-DD)
 */
export function markInstallmentPaid(
  db: SqlStorage,
  installmentId: number,
  paidAmount: number,
  lateFee: number,
  paidDate: string
): void {
  // Get the installment to find its loan_id
  const installmentResult = db.exec(
    "SELECT loan_id, amount FROM installments WHERE id = ?",
    installmentId
  ).toArray();

  if (installmentResult.length === 0) {
    throw new Error("Installment not found");
  }

  const installment = installmentResult[0] as unknown as { loan_id: number; amount: number };
  const loanId = installment.loan_id;

  // Update installment status
  db.exec(
    `UPDATE installments
     SET status = 'paid',
         paid_amount = ?,
         late_fee = ?,
         paid_date = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    paidAmount,
    lateFee,
    paidDate,
    installmentId
  );

  // Increment loan's paid_installments counter
  db.exec(
    `UPDATE loans
     SET paid_installments = paid_installments + 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    loanId
  );

  // Check if all installments are now paid
  const loanResult = db.exec(
    "SELECT total_installments, paid_installments FROM loans WHERE id = ?",
    loanId
  ).toArray();

  if (loanResult.length > 0) {
    const loan = loanResult[0] as unknown as { total_installments: number; paid_installments: number };
    if (loan.paid_installments >= loan.total_installments) {
      // Mark loan as paid off
      db.exec(
        "UPDATE loans SET status = 'paid_off', updated_at = datetime('now') WHERE id = ?",
        loanId
      );
    }
  }
}
