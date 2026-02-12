/**
 * Expense Database Operations
 * Handles recording and querying operational and household expenses.
 *
 * Uses .toArray() instead of .one() because .one() throws on empty results
 * in Cloudflare's SqlStorage API.
 */

import type { ExpenseCategory } from "../types/intent";

/** Category labels in Indonesian for display */
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: "Bensin",
  parking: "Parkir",
  meals: "Makan & Minum",
  cigarettes: "Rokok",
  data_plan: "Pulsa/Data",
  vehicle_service: "Servis Motor",
  household: "Kebutuhan Rumah",
  electricity: "Listrik & Air",
  emergency: "Darurat",
  other: "Lainnya",
};

/** Represents an expense row from the database */
export interface ExpenseRow {
  id: number;
  amount: number;
  category: string;
  note: string | null;
  date: string;
  created_at: string;
}

/**
 * Record a new expense entry.
 */
export function recordExpense(
  db: SqlStorage,
  amount: number,
  category: ExpenseCategory,
  date: string,
  note: string | null = null
): ExpenseRow {
  db.exec(
    "INSERT INTO expenses (amount, category, date, note) VALUES (?, ?, ?, ?)",
    amount,
    category,
    date,
    note
  );

  // Get the inserted row using last_insert_rowid()
  const rows = db.exec(
    "SELECT id, amount, category, note, date, created_at FROM expenses WHERE rowid = last_insert_rowid()"
  ).toArray();

  const row = rows[0]!;
  return {
    id: row["id"] as number,
    amount: row["amount"] as number,
    category: row["category"] as string,
    note: row["note"] as string | null,
    date: row["date"] as string,
    created_at: row["created_at"] as string,
  };
}

/**
 * Get total expenses for a specific date.
 */
export function getTodayExpenses(
  db: SqlStorage,
  date: string
): { total: number; count: number; byCategory: Record<string, number> } {
  const rows = db.exec(
    "SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE date = ? GROUP BY category",
    date
  ).toArray();

  let total = 0;
  let count = 0;
  const byCategory: Record<string, number> = {};

  for (const row of rows) {
    const catTotal = (row["total"] as number) ?? 0;
    const catCount = (row["count"] as number) ?? 0;
    const category = row["category"] as string;
    total += catTotal;
    count += catCount;
    byCategory[category] = catTotal;
  }

  return { total, count, byCategory };
}
