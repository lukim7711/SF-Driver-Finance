# Skema Database

Database menggunakan **SQLite** di dalam **Durable Objects**. Setiap user (Telegram user ID) memiliki Durable Object sendiri dengan SQLite database terpisah.

## Arsitektur Data

```
Durable Object (per user)
└── SQLite Database
    ├── users          (profil & preferensi user)
    ├── income         (pemasukan dari orderan)
    ├── expenses       (pengeluaran operasional)
    ├── debts          (hutang piutang)
    └── targets        (target pendapatan)
```

## Tabel: users

Menyimpan profil dan preferensi user.

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

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| telegram_id | TEXT | Telegram user ID (unik) |
| name | TEXT | Nama display user |
| timezone | TEXT | Timezone user (default WIB) |
| created_at | TEXT | Waktu registrasi |
| updated_at | TEXT | Waktu update terakhir |

## Tabel: income

Mencatat pemasukan dari orderan.

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

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| amount | REAL | Jumlah pemasukan (Rupiah) |
| type | TEXT | Tipe orderan: 'food' atau 'spx' |
| note | TEXT | Catatan opsional |
| date | TEXT | Tanggal pemasukan (YYYY-MM-DD) |
| created_at | TEXT | Waktu pencatatan |

## Tabel: expenses

Mencatat pengeluaran operasional.

```sql
CREATE TABLE expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  amount          REAL NOT NULL,
  category        TEXT NOT NULL CHECK(category IN ('bensin', 'parkir', 'makan', 'servis', 'lainnya')),
  note            TEXT,
  date            TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
```

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| amount | REAL | Jumlah pengeluaran (Rupiah) |
| category | TEXT | Kategori: bensin, parkir, makan, servis, lainnya |
| note | TEXT | Catatan opsional |
| date | TEXT | Tanggal pengeluaran (YYYY-MM-DD) |
| created_at | TEXT | Waktu pencatatan |

## Tabel: debts

Mencatat hutang dan piutang.

```sql
CREATE TABLE debts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  person_name     TEXT NOT NULL,
  amount          REAL NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('piutang', 'utang')),
  note            TEXT,
  status          TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'lunas')),
  date            TEXT NOT NULL,
  paid_at         TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_person ON debts(person_name);
```

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| person_name | TEXT | Nama orang yang berhutang/dihutangi |
| amount | REAL | Jumlah hutang (Rupiah) |
| type | TEXT | 'piutang' (orang hutang ke kita) atau 'utang' (kita hutang) |
| note | TEXT | Catatan opsional |
| status | TEXT | 'aktif' atau 'lunas' |
| date | TEXT | Tanggal hutang dimulai |
| paid_at | TEXT | Tanggal lunas (null jika masih aktif) |
| created_at | TEXT | Waktu pencatatan |

## Tabel: targets

Menyimpan target pendapatan per periode.

```sql
CREATE TABLE targets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  period          TEXT NOT NULL CHECK(period IN ('harian', 'mingguan', 'bulanan')),
  amount          REAL NOT NULL,
  start_date      TEXT NOT NULL,
  end_date        TEXT NOT NULL,
  status          TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'tercapai', 'tidak_tercapai', 'dibatalkan')),
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_targets_period ON targets(period);
CREATE INDEX idx_targets_status ON targets(status);
CREATE INDEX idx_targets_dates ON targets(start_date, end_date);
```

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| period | TEXT | Periode: 'harian', 'mingguan', 'bulanan' |
| amount | REAL | Jumlah target (Rupiah) |
| start_date | TEXT | Tanggal mulai periode |
| end_date | TEXT | Tanggal akhir periode |
| status | TEXT | Status target |
| created_at | TEXT | Waktu pencatatan |

## Catatan Penting

1. **Semua tanggal** disimpan dalam format ISO 8601 (`YYYY-MM-DD` atau `datetime`).
2. **Semua jumlah uang** dalam Rupiah (REAL, tanpa desimal untuk penggunaan normal).
3. **Index** dibuat pada kolom yang sering digunakan untuk filter/query (date, category, status).
4. **Karena 1 DO per user**, tidak perlu kolom `user_id` di setiap tabel — semua data di satu DO sudah milik satu user.
5. **Migrasi skema** akan ditangani manual di awal saat Durable Object pertama kali diakses.
