/**
 * Intent Detection Types
 * Defines all possible intents, parameters, and result shapes.
 */

/** All possible intents the AI can detect */
export type IntentType =
  | "record_income"
  | "record_expense"
  | "register_loan"
  | "pay_installment"
  | "view_loans"
  | "view_penalty"
  | "view_progress"
  | "view_report"
  | "set_target"
  | "view_target"
  | "help"
  | "unknown";

/** ShopeeFood or SPX Express income */
export type IncomeType = "food" | "spx";

/**
 * Expense categories matching Indonesian spending patterns.
 * Each category has a label and common trigger words.
 */
export type ExpenseCategory =
  | "fuel"            // bensin, BBM
  | "parking"         // parkir
  | "meals"           // makan, minum
  | "cigarettes"      // rokok
  | "data_plan"       // pulsa, data, kuota
  | "vehicle_service" // servis, bengkel, ban
  | "household"       // rumah, belanja
  | "electricity"     // listrik, air, PLN
  | "emergency"       // darurat
  | "other";          // lainnya

/** Params for record_income */
export interface IncomeParams {
  amount: number;
  type: IncomeType;
  note: string | null;
  date: string;
}

/** Params for record_expense */
export interface ExpenseParams {
  amount: number;
  category: ExpenseCategory;
  note: string | null;
  date: string;
}

/**
 * Params for register_loan.
 * All fields optional because the AI extracts what it can,
 * and the conversation flow handles the rest.
 */
export interface RegisterLoanParams {
  platform?: string | null;
  original_amount?: number | null;
  total_with_interest?: number | null;
  total_installments?: number | null;
  monthly_amount?: number | null;
  due_day?: number | null;
  late_fee_type?: string | null;
  late_fee_value?: number | null;
}

/** Params for pay_installment */
export interface PayInstallmentParams {
  platform: string;
}

/** Generic intent result from AI parsing */
export interface IntentResult {
  intent: IntentType;
  params: Record<string, unknown>;
  confidence: number;
}

/** Intent result with provider tracking */
export interface IntentResultWithProvider extends IntentResult {
  provider: "workers_ai" | "deepseek";
}
