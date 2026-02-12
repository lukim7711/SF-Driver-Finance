/**
 * Neuron Usage Tracker
 * Tracks daily Workers AI Neuron consumption in a SQLite table.
 * Used to decide when to switch from Workers AI to DeepSeek fallback.
 *
 * Uses .toArray() instead of .one() because .one() throws on empty results
 * in Cloudflare's SqlStorage API.
 */

/**
 * Ensure the neuron tracking table exists.
 */
export function ensureNeuronTable(db: SqlStorage): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _neuron_usage (
    date    TEXT PRIMARY KEY,
    count   INTEGER NOT NULL DEFAULT 0
  )`);
}

/**
 * Get the current Neuron count for today.
 */
export function getNeuronCount(db: SqlStorage, todayDate: string): number {
  const rows = db.exec(
    "SELECT count FROM _neuron_usage WHERE date = ?",
    todayDate
  ).toArray();
  return rows.length > 0 ? (rows[0]!["count"] as number) : 0;
}

/**
 * Increment the Neuron count for today.
 * Approximate: ~4.4 Neurons per Qwen3-30B request.
 */
export function incrementNeuronCount(
  db: SqlStorage,
  todayDate: string,
  neurons: number = 5
): void {
  db.exec(
    `INSERT INTO _neuron_usage (date, count) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET count = count + excluded.count`,
    todayDate,
    neurons
  );
}
