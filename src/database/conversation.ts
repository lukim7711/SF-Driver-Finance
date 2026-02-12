/**
 * Conversation State Management
 * Stores and retrieves multi-step conversation state in the Durable Object.
 * State is checked BEFORE AI intent detection to save Neurons.
 *
 * Uses .toArray() instead of .one() because .one() throws on empty results
 * in Cloudflare's SqlStorage API.
 */

import type { ConversationState, PendingAction } from "../types/conversation";

/** Default state expiry time in minutes */
const STATE_EXPIRY_MINUTES = 5;

/**
 * Ensure the conversation state table exists.
 * Called during database initialization.
 */
export function ensureConversationStateTable(db: SqlStorage): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _conversation_state (
    key   TEXT PRIMARY KEY DEFAULT 'current',
    state TEXT NOT NULL
  )`);
}

/**
 * Get the current conversation state. Returns null if no state or if expired.
 */
export function getConversationState(db: SqlStorage): ConversationState | null {
  const rows = db.exec(
    "SELECT state FROM _conversation_state WHERE key = 'current'"
  ).toArray();

  if (rows.length === 0) return null;

  try {
    const state = JSON.parse(rows[0]!["state"] as string) as ConversationState;

    // Check if state has expired
    if (new Date(state.expires_at) < new Date()) {
      // Expired — clear it and return null
      clearConversationState(db);
      return null;
    }

    return state;
  } catch {
    // Corrupted state — clear it
    clearConversationState(db);
    return null;
  }
}

/**
 * Set a new conversation state. Replaces any existing state.
 * Automatically sets expiry time.
 */
export function setConversationState(
  db: SqlStorage,
  pendingAction: PendingAction,
  pendingData: Record<string, unknown> = {}
): void {
  const expiresAt = new Date(
    Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000
  ).toISOString();

  const state: ConversationState = {
    pending_action: pendingAction,
    pending_data: pendingData,
    expires_at: expiresAt,
  };

  const stateJson = JSON.stringify(state);

  db.exec(
    `INSERT INTO _conversation_state (key, state) VALUES ('current', ?)
     ON CONFLICT(key) DO UPDATE SET state = excluded.state`,
    stateJson
  );
}

/**
 * Clear the conversation state (user cancelled or flow completed).
 * Returns true if there was a state to clear, false if already empty.
 */
export function clearConversationState(db: SqlStorage): boolean {
  const rows = db.exec(
    "SELECT key FROM _conversation_state WHERE key = 'current'"
  ).toArray();

  if (rows.length > 0) {
    db.exec("DELETE FROM _conversation_state WHERE key = 'current'");
    return true;
  }
  return false;
}
