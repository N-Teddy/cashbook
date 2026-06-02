## Real‑world workflow implementation (accounts + currency + transactions)

### Decisions locked in
- **Per-account currency**: each account has its own `currency` (e.g., `XAF`, `USD`).
- **Default currency**: `XAF` (Cameroon).
- **Transfers supported (account → account)**: v1 supports transfers but requires **same currency** between the two accounts.

---

## Phase 1 — Accounts (foundation)

### Backend (Rust + SQLite)
- Commands:
  - `account_count`: gate first run
  - `account_list`
  - `account_create` (requires `name`, `type`; currency defaults to `XAF`)
  - next: `account_update`, `account_archive`
- Validation:
  - name required
  - currency required (defaulted if missing)

### Frontend workflow
- On launch:
  - if `account_count == 0` show “Set up your first account”
- In Settings:
  - manage accounts (add/edit/archive)

---

## Phase 2 — Categories (lightweight)
- Seed default categories in SQLite (expense + income).
- Commands:
  - `category_list`, `category_create` (optional in v1)
- UI:
  - category picker in transaction form

---

## Phase 3 — Transactions (daily usage)

### Types
- **Expense**: amount, account, category, merchant, note, date
- **Income**: amount, account, category, note, date
- **Transfer**: amount, from account, to account, note, date

### Currency handling
- Expense/Income:
  - transaction currency equals `account.currency`
- Transfer:
  - require `from.currency == to.currency` (v1)

### DB shape
- Existing `transactions` table keeps:
  - `amount_minor` (integer)
  - `currency` (string)
  - `type` (`income|expense|transfer`)
- Transfer support:
  - store `from_account_id` + `to_account_id`
  - for now keep `account_id = from_account_id` so we don’t need a table rebuild in SQLite

### UX flow
- Transactions tab:
  - list transactions grouped by day
  - filter by account
- Quick add:
  - create expense/income quickly
- Transfer:
  - separate action with from/to selection

---

## Phase 4 — Dashboard (high-signal)
- Month summary totals:
  - income, expense, net
- Breakdown:
  - by account
  - by category

