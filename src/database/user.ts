/**
 * User Database Operations
 * Handles user registration (onboarding) and lookup within the Durable Object.
 */

/** Represents a user row from the database */
export interface UserRow {
  id: number;
  telegram_id: string;
  name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get user by Telegram ID. Returns null if user is not registered.
 */
export function getUserByTelegramId(
  db: SqlStorage,
  telegramId: string
): UserRow | null {
  const row = db.exec(
    "SELECT id, telegram_id, name, timezone, created_at, updated_at FROM users WHERE telegram_id = ?",
    telegramId
  ).one();

  if (!row) return null;

  return {
    id: row["id"] as number,
    telegram_id: row["telegram_id"] as string,
    name: row["name"] as string,
    timezone: row["timezone"] as string,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

/**
 * Register a new user (onboarding). Called on first /start.
 * If user already exists, updates their name and updated_at timestamp.
 *
 * @returns The user row (existing or newly created)
 */
export function registerUser(
  db: SqlStorage,
  telegramId: string,
  name: string
): UserRow {
  // Try to find existing user first
  const existing = getUserByTelegramId(db, telegramId);
  if (existing) {
    // Update name and timestamp in case it changed
    db.exec(
      "UPDATE users SET name = ?, updated_at = datetime('now') WHERE telegram_id = ?",
      name,
      telegramId
    );
    return { ...existing, name, updated_at: new Date().toISOString() };
  }

  // Insert new user
  db.exec(
    "INSERT INTO users (telegram_id, name) VALUES (?, ?)",
    telegramId,
    name
  );

  // Return the newly created user
  const newUser = getUserByTelegramId(db, telegramId);
  if (!newUser) {
    throw new Error(`Failed to register user with telegram_id: ${telegramId}`);
  }
  return newUser;
}
