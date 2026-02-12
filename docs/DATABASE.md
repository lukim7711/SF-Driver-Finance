# Database Schema

Database uses **SQLite** inside **Durable Objects**. Each user (Telegram user ID) has their own Durable Object with a separate SQLite database.

## Data Architecture

```
Durable Object (per user)
└── SQLite Database
    ├── users          (user profile & preferences)
    ├── income         (delivery order earnings)
    ├── expenses       (operational & household costs)
    ├── loans          (online lending platform info)
    ├── installments   (per-month payment schedule)
    └── targets        (income targets per period)
```

## Table: users

Stores user profile and preferences.

```sql
CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id     TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  timezone        TEXT DEFAULT 'Asia/Jakarta',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
```

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| telegram_id | TEXT | Telegram user ID (unique) |
| name | TEXT | Display name |
| timezone | TEXT | User timezone (default WIB) |
| created_at | TEXT | Registration time |
| updated_at | TEXT | Last update time |

## Table: income

Records earnings from delivery orders.

```sql
CREATE TABLE income (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  amount          REAL NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('food', 'spx')),
  note            TEXT,
  date            TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_income_date ON income(date);
CREATE INDEX idx_income_type ON income(type);
```

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| amount | REAL | Income amount (Rupiah) |
| type | TEXT | Order type: 'food' or 'spx' |
| note | TEXT | Optional note |
| date | TEXT | Income date (YYYY-MM-DD) |
| created_at | TEXT | Record creation time |

## Table: expenses

Records operational and household expenses.

```sql
CREATE TABLE expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  amount          REAL NOT NULL,
  category        TEXT NOT NULL CHECK(category IN ('fuel', 'parking', 'meals', 'cigarettes', 'data_plan', 'vehicle_service', 'household', 'electricity', 'emergency', 'other')),
  note            TEXT,
  date            TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
```

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| amount | REAL | Expense amount (Rupiah) |
| category | TEXT | Category (see list below) |
| note | TEXT | Optional note |
| date | TEXT | Expense date (YYYY-MM-DD) |
| created_at | TEXT | Record creation time |

**Expense Categories:**

| Category Value | Indonesian Label | Description |
|---|---|---|
| fuel | Bensin | Gasoline/fuel |
| parking | Parkir | Parking fees |
| meals | Makan & Minum | Food and drinks |
| cigarettes | Rokok | Cigarettes |
| data_plan | Pulsa/Data | Mobile data/credit |
| vehicle_service | Servis Motor | Motorcycle maintenance |
| household | Kebutuhan Rumah | Groceries, household needs |
| electricity | Listrik & Air | Electricity and water bills |
| emergency | Darurat | Emergency/unexpected expenses |
| other | Lainnya | Other expenses |

## Table: loans

Stores online lending platform (pinjol) information. Each row = one loan from one platform.

```sql
CREATE TABLE loans (
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
);

CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_platform ON loans(platform);
CREATE INDEX idx_loans_due_day ON loans(due_day);
```

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| platform | TEXT | Lending platform name (e.g., 'Shopee Pinjam', 'Kredivo') |
| original_amount | REAL | Original loan principal (Rupiah) |
| total_with_interest | REAL | Total amount to pay including interest |
| total_installments | INTEGER | Total number of monthly installments |
| paid_installments | INTEGER | Number of installments already paid |
| monthly_amount | REAL | Regular monthly installment amount |
| due_day | INTEGER | Day of month when payment is due (1-31) |
| late_fee_type | TEXT | How late fees are calculated |
| late_fee_value | REAL | Late fee rate (e.g., 5 = 5% for percent types) |
| status | TEXT | Loan status: active, paid_off, cancelled |
| note | TEXT | Optional note |
| start_date | TEXT | When the loan was taken (YYYY-MM-DD) |
| created_at | TEXT | Record creation time |
| updated_at | TEXT | Last update time |

**Late Fee Types:**

| Type | Calculation | Example |
|---|---|---|
| percent_monthly | X% of installment per month late | Shopee Pinjam: 5%/month |
| percent_daily | X% of installment per day late | SeaBank: 0.25%/day |
| fixed | Fixed amount per late payment | Fixed Rp50,000 per late |
| none | No late fee | — |

## Table: installments

Per-month payment schedule for each loan. Each row = one monthly installment.

```sql
CREATE TABLE installments (
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
);

CREATE INDEX idx_installments_loan ON installments(loan_id);
CREATE INDEX idx_installments_due ON installments(due_date);
CREATE INDEX idx_installments_status ON installments(status);
```

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| loan_id | INTEGER | Foreign key to loans table |
| installment_no | INTEGER | Installment sequence number (1, 2, 3...) |
| amount | REAL | Amount due for this installment (Rupiah) |
| due_date | TEXT | Due date (YYYY-MM-DD) |
| status | TEXT | Payment status |
| paid_amount | REAL | Amount actually paid (for partial payments) |
| paid_date | TEXT | Date when payment was made |
| late_fee | REAL | Late fee charged (Rupiah) |
| note | TEXT | Optional note |
| created_at | TEXT | Record creation time |
| updated_at | TEXT | Last update time |

**Installment Status:**

| Status | Description |
|---|---|
| unpaid | Not yet paid, not yet past due |
| paid | Fully paid |
| late | Past due date, not yet paid |
| partial | Partially paid |

## Table: targets

Stores income targets per period.

```sql
CREATE TABLE targets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  period          TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly')),
  amount          REAL NOT NULL,
  start_date      TEXT NOT NULL,
  end_date        TEXT NOT NULL,
  status          TEXT DEFAULT 'active' CHECK(status IN ('active', 'achieved', 'missed', 'cancelled')),
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_targets_period ON targets(period);
CREATE INDEX idx_targets_status ON targets(status);
CREATE INDEX idx_targets_dates ON targets(start_date, end_date);
```

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| period | TEXT | Period: 'daily', 'weekly', 'monthly' |
| amount | REAL | Target amount (Rupiah) |
| start_date | TEXT | Period start date |
| end_date | TEXT | Period end date |
| status | TEXT | Target status |
| created_at | TEXT | Record creation time |

## Important Notes

1. **All dates** stored in ISO 8601 format (`YYYY-MM-DD` or `datetime`).
2. **All amounts** in Rupiah (REAL type).
3. **Indexes** on frequently queried columns (date, category, status, due_date).
4. **1 DO per user** = no `user_id` column needed — all data in one DO belongs to one user.
5. **Schema migration** handled manually on first Durable Object access.
6. **Loans + Installments** use a parent-child relationship. When a loan is registered, all installment rows are pre-generated.
7. **CASCADE delete** — deleting a loan removes all its installments.
