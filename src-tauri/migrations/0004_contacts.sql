PRAGMA foreign_keys = ON;

-- ----
-- Contacts — people you regularly lend to or borrow from
-- ----

CREATE TABLE IF NOT EXISTS contacts (
  id         TEXT PRIMARY KEY NOT NULL,
  name       TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Add contact_id to debts (nullable for migration compatibility with existing rows)
ALTER TABLE debts ADD COLUMN contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL;

-- Add account_id to debts (nullable; tracks which account money left/entered)
ALTER TABLE debts ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

-- Add account_id to debt_payments (nullable; tracks which account the repayment came from/went to)
ALTER TABLE debt_payments ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debts_contact_id ON debts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
