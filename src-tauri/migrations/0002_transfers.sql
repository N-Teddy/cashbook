PRAGMA foreign_keys = ON;

-- Allow transfers between accounts by adding from/to columns and relaxing account_id.
-- We keep `currency` + `amount_minor` on the transaction for now and require same-currency transfers in v1.

ALTER TABLE transactions ADD COLUMN from_account_id TEXT;
ALTER TABLE transactions ADD COLUMN to_account_id TEXT;

-- account_id used to be NOT NULL. SQLite doesn't support dropping NOT NULL easily.
-- We'll keep account_id populated for income/expense and leave it NULL for transfer by creating a new table
-- in a later migration if needed. For now, we support transfer by storing account_id = from_account_id
-- and also setting to_account_id (so UI can render both sides).

CREATE INDEX IF NOT EXISTS idx_transactions_from_account_id ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account_id ON transactions(to_account_id);

