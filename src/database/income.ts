/**
 * Income Database Operations
 * Handles recording and querying delivery earnings.
 *
 * Uses .toArray() instead of .one() because .one() throws on empty results
 * in Cloudflare's SqlStorage API.
 */

/** Represents an income row from the database */
export interface IncomeRow {
  id: number;
  amount: number;
  type: string;
  note: string | null;
  date: string;
  created_at: string;
}

/**
 * Record a new income entry.
 */
export function recordIncome(
  db: SqlStorage,
  amount: number,
  type: "food" | "spx",
  date: string,
  note: string | null = null
): IncomeRow {
  db.exec(
    "INSERT INTO income (amount, type, date, note) VALUES (?, ?, ?, ?)",
    amount,
    type,
    date,
    note
  );

  // Get the inserted row using last_insert_rowid()
  const rows = db.exec(
    "SELECT id, amount, type, note, date, created_at FROM income WHERE rowid = last_insert_rowid()"
  ).toArray();

  const row = rows[0]!;
  return {
    id: row["id"] as number,
    amount: row["amount"] as number,
    type: row["type"] as string,
    note: row["note"] as string | null,
    date: row["date"] as string,
    created_at: row["created_at"] as string,
  };
}

/**
 * Get total income for a specific date.
 */
export function getTodayIncome(
  db: SqlStorage,
  date: string
): { total: number; food: number; spx: number; count: number } {
  const rows = db.exec(
    "SELECT type, SUM(amount) as total, COUNT(*) as count FROM income WHERE date = ? GROUP BY type",
    date
  ).toArray();

  let food = 0;
  let spx = 0;
  let count = 0;

  for (const row of rows) {
    const rowTotal = (row["total"] as number) ?? 0;
    const rowCount = (row["count"] as number) ?? 0;
    if (row["type"] === "food") {
      food = rowTotal;
    } else if (row["type"] === "spx") {
      spx = rowTotal;
    }
    count += rowCount;
  }

  return { total: food + spx, food, spx, count };
}
