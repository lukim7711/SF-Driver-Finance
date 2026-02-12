/**
 * AI Response Parser
 * Parses the raw AI text response into a typed IntentResult.
 * Handles edge cases like malformed JSON, missing fields, etc.
 */

import type { IntentResult, IntentName } from "../types/intent";

/** Valid intent names for validation */
const VALID_INTENTS: IntentName[] = [
  "record_income",
  "record_expense",
  "register_loan",
  "pay_installment",
  "view_loans",
  "view_report",
  "view_target",
  "set_target",
  "help",
  "unknown",
];

/** Valid expense categories for validation */
const VALID_EXPENSE_CATEGORIES = [
  "fuel", "parking", "meals", "cigarettes", "data_plan",
  "vehicle_service", "household", "electricity", "emergency", "other",
];

/** Valid income types */
const VALID_INCOME_TYPES = ["food", "spx"];

/**
 * Parse raw AI text response into a typed IntentResult.
 * Returns a fallback "unknown" intent if parsing fails.
 */
export function parseIntentResponse(rawResponse: string): IntentResult {
  try {
    // Try to extract JSON from the response (AI might add extra text)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in AI response:", rawResponse);
      return createUnknownIntent();
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Validate intent field
    const intent = parsed["intent"] as string;
    if (!intent || !VALID_INTENTS.includes(intent as IntentName)) {
      console.error("Invalid intent in AI response:", intent);
      return createUnknownIntent();
    }

    // Validate confidence
    const confidence = typeof parsed["confidence"] === "number"
      ? Math.min(1, Math.max(0, parsed["confidence"]))
      : 0.5;

    // Validate and clean params based on intent
    const rawParams = (parsed["params"] as Record<string, unknown>) ?? {};
    const params = validateParams(intent as IntentName, rawParams);

    return {
      intent: intent as IntentName,
      params,
      confidence,
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error, "Raw:", rawResponse);
    return createUnknownIntent();
  }
}

/**
 * Validate and sanitize params based on the detected intent.
 */
function validateParams(
  intent: IntentName,
  raw: Record<string, unknown>
): Record<string, unknown> {
  switch (intent) {
    case "record_income": {
      const amount = parseAmount(raw["amount"]);
      if (!amount || amount <= 0) return {};
      const type = VALID_INCOME_TYPES.includes(raw["type"] as string)
        ? (raw["type"] as string)
        : "food"; // Default to food if unclear
      return {
        amount,
        type,
        note: typeof raw["note"] === "string" ? raw["note"] : null,
        date: typeof raw["date"] === "string" ? raw["date"] : null,
      };
    }

    case "record_expense": {
      const amount = parseAmount(raw["amount"]);
      if (!amount || amount <= 0) return {};
      const category = VALID_EXPENSE_CATEGORIES.includes(raw["category"] as string)
        ? (raw["category"] as string)
        : "other";
      return {
        amount,
        category,
        note: typeof raw["note"] === "string" ? raw["note"] : null,
        date: typeof raw["date"] === "string" ? raw["date"] : null,
      };
    }

    case "pay_installment": {
      return {
        platform: typeof raw["platform"] === "string" ? raw["platform"] : null,
      };
    }

    case "view_report": {
      const validPeriods = ["today", "week", "month"];
      return {
        period: validPeriods.includes(raw["period"] as string)
          ? raw["period"]
          : "today",
      };
    }

    case "set_target": {
      const amount = parseAmount(raw["amount"]);
      const validPeriods = ["daily", "weekly", "monthly"];
      return {
        amount: amount ?? 0,
        period: validPeriods.includes(raw["period"] as string)
          ? raw["period"]
          : "daily",
      };
    }

    default:
      return raw;
  }
}

/**
 * Parse amount from various formats the AI might return.
 * Handles numbers, strings with formatting, etc.
 */
function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

/** Create a fallback unknown intent result */
function createUnknownIntent(): IntentResult {
  return {
    intent: "unknown",
    params: {},
    confidence: 0,
  };
}
