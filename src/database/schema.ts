/**
 * Database Schema Initialization & Migration
 * Manages all SQLite tables within the user's Durable Object.
 * Uses a _schema_meta table for version tracking to handle migrations
 * automatically on first access after each deployment.
 */

/** Current schema version — increment when adding migrations */
const LATEST_SCHEMA_VERSION = 1;

/**
 * Initialize the database: create meta table, check version, run migrations.
 * Called on every Durable Object initialization (alarm or fetch).
 *
 * @param db - The SqlStorage instance from the Durable Object
 */
export function initializeDatabase(db: SqlStorage): void {
  // Step 1: Ensure meta table exists (idempotent)
  db.exec(`CREATE TABLE IF NOT EXISTS _schema_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  // Step 2: Read current schema version
  const row = db.exec(
    "SELECT value FROM _schema_meta WHERE key = 'schema_version'"
  ).one();
  const currentVersion = row ? parseInt(row["value"] as string, 10) : 0;

  // Step 3: Apply migrations or fresh install
  if (currentVersion === 0) {
    // Fresh install — create all tables from scratch
    createAllTablesV1(db);
    db.exec(
      "INSERT INTO _schema_meta (key, value) VALUES ('schema_version', ?)",
      LATEST_SCHEMA_VERSION.toString()
    );
    console.log(`Database initialized at schema version ${LATEST_SCHEMA_VERSION}`);
  } else if (currentVersion < LATEST_SCHEMA_VERSION) {
    // Incremental migrations for future versions
    // if (currentVersion < 2) migrateV1toV2(db);
    // if (currentVersion < 3) migrateV2toV3(db);
    db.exec(
      "UPDATE _schema_meta SET value = ? WHERE key = 'schema_version'",
      LATEST_SCHEMA_VERSION.toString()
    );
    console.log(`Database migrated from v${currentVersion} to v${LATEST_SCHEMA_VERSION}`);
  }
  // else: already up to date, no action needed
}

/**
 * Create all tables for a fresh V1 install.
 * This is the complete schema as defined in docs/DATABASE.md.
 */
function createAllTablesV1(db: SqlStorage): void {
  // Users table
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id     TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    timezone        TEXT DEFAULT 'Asia/Jakarta',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  )`);

  // Income table
  db.exec(`CREATE TABLE IF NOT EXISTS income (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    amount          REAL NOT NULL,
    type            TEXT NOT NULL CHECK(type IN ('food', 'spx')),
    note            TEXT,
    date            TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_income_date ON income(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_income_type ON income(type)`);

  // Expenses table
  db.exec(`CREATE TABLE IF NOT EXISTS expenses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    amount          REAL NOT NULL,
    category        TEXT NOT NULL CHECK(category IN ('fuel', 'parking', 'meals', 'cigarettes', 'data_plan', 'vehicle_service', 'household', 'electricity', 'emergency', 'other')),
    note            TEXT,
    date            TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`);

  // Loans table (online lending platforms)
  db.exec(`CREATE TABLE IF NOT EXISTS loans (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    platform            TEXT NOT NULL,
    original_amount     REAL NOT NULL,
    total_with_interest REAL NOT NULL,
    total_installments  INTEGER NOT NULL,
    paid_installments   INTEGER DEFAULT 0,
    monthly_amount      REAL NOT NULL,
    due_day             INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31),
    late_fee_type       TEXT NOT NULL CHECK(late_fee_type IN ('percent_monthly', 'percent_daily', 'fixed', 'none')),
    late_fee_value      REAL DEFAULT 0,
    status              TEXT DEFAULT 'active' CHECK(status IN ('active', 'paid_off', 'cancelled')),
    note                TEXT,
    start_date          TEXT NOT NULL,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_loans_platform ON loans(platform)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_loans_due_day ON loans(due_day)`);

  // Installments table (per-month payment schedule)
  db.exec(`CREATE TABLE IF NOT EXISTS installments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id         INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    installment_no  INTEGER NOT NULL,
    amount          REAL NOT NULL,
    due_date        TEXT NOT NULL,
    status          TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'late', 'partial')),
    paid_amount     REAL DEFAULT 0,
    paid_date       TEXT,
    late_fee        REAL DEFAULT 0,
    note            TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_installments_loan ON installments(loan_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_installments_due ON installments(due_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status)`);

  // Targets table (income goals)
  db.exec(`CREATE TABLE IF NOT EXISTS targets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    period          TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly')),
    amount          REAL NOT NULL,
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    status          TEXT DEFAULT 'active' CHECK(status IN ('active', 'achieved', 'missed', 'cancelled')),
    created_at      TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_targets_period ON targets(period)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_targets_status ON targets(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_targets_dates ON targets(start_date, end_date)`);
}
