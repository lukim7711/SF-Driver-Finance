/**
 * Loan and Installment Types
 * Used for F03 (Loan Tracking) feature.
 */

/** Late fee calculation method */
export type LateFeeType = "percent_monthly" | "percent_daily" | "fixed" | "none";

/** Loan status */
export type LoanStatus = "active" | "paid_off" | "cancelled";

/** Installment payment status */
export type InstallmentStatus = "unpaid" | "paid" | "late" | "partial";

/**
 * Loan registration data collected via multi-step flow.
 * Uses index signature to be compatible with Record<string, unknown>
 * required by conversation state storage.
 */
export interface LoanRegistrationData {
  [key: string]: unknown;
  platform: string;
  original_amount: number;
  total_with_interest: number;
  total_installments: number;
  monthly_amount: number;
  due_day: number;
  late_fee_type: LateFeeType;
  late_fee_value: number;
  note?: string;
  start_date: string;
  step?: number;
}

/** Database row for loans table */
export interface LoanRow {
  id: number;
  platform: string;
  original_amount: number;
  total_with_interest: number;
  total_installments: number;
  paid_installments: number;
  monthly_amount: number;
  due_day: number;
  late_fee_type: LateFeeType;
  late_fee_value: number;
  status: LoanStatus;
  note: string | null;
  start_date: string;
  created_at: string;
  updated_at: string;
}

/** Database row for installments table */
export interface InstallmentRow {
  id: number;
  loan_id: number;
  installment_no: number;
  amount: number;
  due_date: string;
  status: InstallmentStatus;
  paid_amount: number;
  paid_date: string | null;
  late_fee: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}
