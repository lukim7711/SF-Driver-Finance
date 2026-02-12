/**
 * Conversation State Types
 * Used for multi-step interactions (OCR confirmation, loan registration, etc.)
 * State is stored in the user's Durable Object to persist across requests.
 */

/** All possible pending action identifiers */
export type PendingAction =
  | "confirm_ocr"
  | "confirm_income"
  | "confirm_expense"
  | "confirm_loan"
  | "loan_fill_missing"
  | "loan_edit_select"
  | "loan_edit_field"
  | "confirm_payment"
  | "edit_transaction";

/**
 * Conversation state stored in Durable Object.
 * Checked BEFORE AI intent detection to save Neurons.
 */
export interface ConversationState {
  /** The action awaiting user response */
  pending_action: PendingAction;
  /** Data collected so far in this multi-step flow */
  pending_data: Record<string, unknown>;
  /** Auto-expire to prevent stale state (ISO 8601 datetime string) */
  expires_at: string;
}
