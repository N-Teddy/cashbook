PRAGMA foreign_keys = ON;

-- ----
-- Link transactions to contacts (for borrow/lend/give/receive and debt repayments)
-- ----
ALTER TABLE transactions ADD COLUMN contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL;

-- New transaction types supported:
--   lend         — you gave money expecting it back     (account balance --)
--   borrow       — you received money expecting to pay back (account balance ++)
--   give         — you gave money, no repayment expected (account balance --)
--   receive_gift — you received money, no repayment     (account balance ++)
-- Existing: expense | income | transfer (unchanged)

-- ----
-- Link debts and debt_payments back to the transaction that created them
-- ----
ALTER TABLE debts ADD COLUMN transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE debt_payments ADD COLUMN transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON transactions(contact_id);
