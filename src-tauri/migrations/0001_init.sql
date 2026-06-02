PRAGMA foreign_keys = ON;

-- ----
-- Core reference tables
-- ----

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- cash | bank | mobile_money | card | other
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- income | expense
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ----
-- Transactions
-- ----

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL, -- income | expense | transfer
  amount_minor INTEGER NOT NULL, -- store as minor units (kobo/cents) to avoid float rounding
  currency TEXT NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  merchant TEXT,
  note TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);

-- ----
-- Debts
-- ----

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL, -- owed_by_me | owed_to_me
  counterparty TEXT NOT NULL,
  principal_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL, -- open | closed
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY NOT NULL,
  debt_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(debt_id) REFERENCES debts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);

-- ----
-- Budgets
-- ----

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  period TEXT NOT NULL, -- monthly
  limit_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  start_month TEXT NOT NULL, -- YYYY-MM
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_budgets_category_start_month ON budgets(category_id, start_month);

-- ----
-- Local change log (useful for backup/sync even if you keep it minimal)
-- ----

CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY NOT NULL,
  ts TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL, -- create | update | delete
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_log_ts ON change_log(ts);

