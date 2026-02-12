/**
 * Intent Detection Types
 * Defines the structure of AI-parsed intent results from user messages.
 */

/** All supported intent identifiers */
export type IntentName =
  | "record_income"
  | "record_expense"
  | "register_loan"
  | "pay_installment"
  | "view_loans"
  | "view_report"
  | "view_target"
  | "set_target"
  | "help"
  | "unknown";

/** Income type: food delivery or SPX package delivery */
export type IncomeType = "food" | "spx";

/** Valid expense categories matching the database CHECK constraint */
export type ExpenseCategory =
  | "fuel"
  | "parking"
  | "meals"
  | "cigarettes"
  | "data_plan"
  | "vehicle_service"
  | "household"
  | "electricity"
  | "emergency"
  | "other";

/** Parameters extracted for income recording */
export interface IncomeParams {
  amount: number;
  type: IncomeType;
  note?: string;
  date?: string;
}

/** Parameters extracted for expense recording */
export interface ExpenseParams {
  amount: number;
  category: ExpenseCategory;
  note?: string;
  date?: string;
}

/** Parameters extracted for loan payment */
export interface PayInstallmentParams {
  platform: string;
}

/** Generic parameters for other intents */
export interface GenericParams {
  [key: string]: unknown;
}

/** The result of AI intent detection */
export interface IntentResult {
  intent: IntentName;
  params: IncomeParams | ExpenseParams | PayInstallmentParams | GenericParams;
  confidence: number;
}

/** Which AI provider was used */
export type AIProvider = "workers_ai" | "deepseek";

/** Extended result including provider info */
export interface IntentResultWithProvider extends IntentResult {
  provider: AIProvider;
}
