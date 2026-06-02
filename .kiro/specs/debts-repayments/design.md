# Design Document — Debts & Repayments

## Overview

The Debts & Repayments feature adds a fully functional Debts tab to the app. Users can track money they owe to others (`owed_by_me`) and money others owe to them (`owed_to_me`), record partial repayments, and monitor outstanding balances. Everything is offline-only, backed by SQLite.

The SQLite schema (`debts` and `debt_payments` tables) already exists in `0001_init.sql`. No new migration is required. The work is entirely in a new Rust command file and a new React screen.

---

## Architecture

The feature follows the exact same layered pattern used by transactions and accounts:

```
React (DebtsScreen) → src/lib/debts.ts (invoke wrappers) → Tauri commands → SQLite
```

No new dependencies are needed. `rusqlite`, `uuid`, `chrono`, and `serde` are already in `Cargo.toml`.

---

## Database Schema (already exists)

```sql
-- debts table (migration 0001_init.sql)
CREATE TABLE IF NOT EXISTS debts (
  id           TEXT PRIMARY KEY NOT NULL,
  kind         TEXT NOT NULL,            -- 'owed_by_me' | 'owed_to_me'
  counterparty TEXT NOT NULL,
  principal_minor INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  opened_at    TEXT NOT NULL,
  due_at       TEXT,                     -- nullable ISO date
  status       TEXT NOT NULL,            -- 'open' | 'closed'
  note         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT                      -- soft delete
);

-- debt_payments table (migration 0001_init.sql)
CREATE TABLE IF NOT EXISTS debt_payments (
  id           TEXT PRIMARY KEY NOT NULL,
  debt_id      TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  occurred_at  TEXT NOT NULL,
  note         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,                     -- soft delete
  FOREIGN KEY(debt_id) REFERENCES debts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
```

`outstanding_balance_minor` is computed at query time:
```sql
principal_minor - COALESCE(SUM(p.amount_minor FILTER (WHERE p.deleted_at IS NULL)), 0)
```

---

## Rust Backend

### File: `src-tauri/src/commands/debts.rs`

New file following the same structure as `transactions.rs`.

#### Structs

```rust
// Returned by debt_list and debt_create
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtRow {
    pub id: String,
    pub kind: String,               // "owed_by_me" | "owed_to_me"
    pub counterparty: String,
    pub principal_minor: i64,
    pub currency: String,
    pub opened_at: String,
    pub due_at: Option<String>,
    pub status: String,             // "open" | "closed"
    pub note: Option<String>,
    pub outstanding_balance_minor: i64,
    pub created_at: String,
    pub updated_at: String,
}

// Input for debt_create
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtCreateInput {
    pub kind: String,
    pub counterparty: String,
    pub principal_minor: i64,
    pub currency: Option<String>,   // defaults to "XAF"
    pub due_at: Option<String>,     // ISO date string, optional
    pub note: Option<String>,
}

// Returned by debt_payment_list and debt_payment_add
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtPaymentRow {
    pub id: String,
    pub debt_id: String,
    pub amount_minor: i64,
    pub occurred_at: String,
    pub note: Option<String>,
    pub created_at: String,
}

// Input for debt_payment_add
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtPaymentAddInput {
    pub debt_id: String,
    pub amount_minor: i64,
    pub note: Option<String>,
}
```

#### Commands

**`debt_list() -> Result<Vec<DebtRow>, String>`**

Returns all non-deleted debts ordered by `opened_at DESC`. Computes `outstanding_balance_minor` via a LEFT JOIN on `debt_payments` with a subquery sum. No filter parameters in v1 (the screen handles client-side split by kind).

SQL:
```sql
SELECT
  d.id, d.kind, d.counterparty, d.principal_minor, d.currency,
  d.opened_at, d.due_at, d.status, d.note,
  d.created_at, d.updated_at,
  d.principal_minor - COALESCE(
    (SELECT SUM(p.amount_minor)
     FROM debt_payments p
     WHERE p.debt_id = d.id AND p.deleted_at IS NULL),
    0
  ) AS outstanding_balance_minor
FROM debts d
WHERE d.deleted_at IS NULL
ORDER BY d.opened_at DESC;
```

**`debt_create(input: DebtCreateInput) -> Result<DebtRow, String>`**

Validates: kind is `owed_by_me` or `owed_to_me`, counterparty is non-empty, `principal_minor > 0`. Inserts with `status = 'open'`, `opened_at = now()`. Returns the full `DebtRow` (outstanding = principal at creation).

**`debt_set_status(debt_id: String, status: String) -> Result<(), String>`**

Sets status to `'open'` or `'closed'`. Validates the debt exists and is not deleted. Updates `updated_at`.

**`debt_delete(debt_id: String) -> Result<(), String>`**

Soft-deletes the debt (`deleted_at = now()`). Also soft-deletes all associated `debt_payments` in the same operation:
```sql
UPDATE debt_payments SET deleted_at = ?now WHERE debt_id = ?id AND deleted_at IS NULL;
UPDATE debts SET deleted_at = ?now, updated_at = ?now WHERE id = ?id AND deleted_at IS NULL;
```

**`debt_payment_add(input: DebtPaymentAddInput) -> Result<DebtPaymentRow, String>`**

Validates: `debt_id` exists and is not deleted, `amount_minor > 0`. Inserts payment. Then recomputes the outstanding balance and if it is ≤ 0, updates debt `status = 'closed'` and `updated_at = now()`. Returns the new payment row.

**`debt_payment_list(debt_id: String) -> Result<Vec<DebtPaymentRow>, String>`**

Returns all non-deleted payments for a given debt ordered by `occurred_at DESC`. Returns an empty list if the debt doesn't exist.

#### Registration in `lib.rs`

Add `commands::debts` to `commands/mod.rs` and register all five commands in the `invoke_handler!` macro in `lib.rs`.

---

## TypeScript Frontend

### File: `src/lib/debts.ts`

Thin invoke wrappers mirroring the pattern in `src/lib/transactions.ts`.

```ts
export type DebtKind = "owed_by_me" | "owed_to_me";
export type DebtStatus = "open" | "closed";

export type DebtRow = {
  id: string;
  kind: DebtKind;
  counterparty: string;
  principalMinor: number;
  currency: string;
  openedAt: string;
  dueAt: string | null;
  status: DebtStatus;
  note: string | null;
  outstandingBalanceMinor: number;
  createdAt: string;
  updatedAt: string;
};

export type DebtPaymentRow = {
  id: string;
  debtId: string;
  amountMinor: number;
  occurredAt: string;
  note: string | null;
  createdAt: string;
};

export type DebtCreateInput = {
  kind: DebtKind;
  counterparty: string;
  principalMinor: number;
  currency?: string;
  dueAt?: string;
  note?: string;
};

export type DebtPaymentAddInput = {
  debtId: string;
  amountMinor: number;
  note?: string;
};

export async function debtList(): Promise<DebtRow[]>
export async function debtCreate(input: DebtCreateInput): Promise<DebtRow>
export async function debtSetStatus(debtId: string, status: DebtStatus): Promise<void>
export async function debtDelete(debtId: string): Promise<void>
export async function debtPaymentAdd(input: DebtPaymentAddInput): Promise<DebtPaymentRow>
export async function debtPaymentList(debtId: string): Promise<DebtPaymentRow[]>
```

### File: `src/features/debts/DebtsScreen.tsx`

Replaces the placeholder in `App.tsx`'s `case "debts"`.

#### State

```
debts: DebtRow[]          — full list from backend
loading: boolean
error: string | null
showAdd: boolean          — Add Debt modal open
selectedDebt: DebtRow | null  — detail/payment modal open
showPayment: boolean      — Add Payment modal open (within detail)
```

#### Layout

```
DebtsScreen
├── Header row: "Debts" title + "Add" button
├── Summary cards (two, side-by-side)
│     ├── "I owe" — total outstanding owed_by_me (by currency)
│     └── "They owe" — total outstanding owed_to_me (by currency)
├── Section: "I owe" (owed_by_me debts, filtered from debts array)
│     └── DebtCard × N
├── Section: "They owe me" (owed_to_me debts)
│     └── DebtCard × N
├── Modal: Add Debt
└── Modal: Debt Detail (with payment history + Add Payment)
```

#### DebtCard component

Displays per debt:
- Counterparty name (bold)
- Outstanding balance (large, coloured: red for owed_by_me, green for owed_to_me)
- Original principal (smaller, muted)
- Due date — if present and debt is open: show date; if overdue, show date in amber/red with a warning indicator
- Status badge — "Open" (zinc) or "Settled" (green)
- Action buttons: "Pay" (only if open), "Settle" / "Reopen" toggle, trash icon (with confirmation)

Tapping the card body opens the Debt Detail modal.

#### Add Debt Modal

Fields:
- Direction toggle: `I owe` / `They owe me` (same segmented-control pattern as Expense/Income/Transfer in TransactionsScreen)
- Counterparty (text input, required)
- Amount (numeric input, required, integer)
- Currency (text input, defaults to XAF — same pattern as account creation)
- Due date (date input, optional)
- Note (text input, optional)
- Save button

#### Debt Detail Modal

Shows:
- Counterparty + kind label
- Principal and outstanding balance
- Due date (with overdue indicator if applicable)
- Note (if any)
- "Add Payment" button (if open)
- Payment history list: each payment shows amount, date, note
- "Settle" / "Reopen" button
- "Delete debt" button (confirmation required)

#### Add Payment Modal (within Debt Detail)

Fields:
- Amount (numeric, required, integer)
- Note (optional)
- Save button

On save: calls `debtPaymentAdd`, then reloads debt list. If the debt auto-closes (balance ≤ 0), the UI updates status accordingly.

#### Summary Totals Computation

Computed client-side from the loaded `debts` array. No extra backend call needed:

```ts
// I owe totals by currency
debts
  .filter(d => d.kind === "owed_by_me" && d.status === "open")
  .reduce((acc, d) => {
    acc[d.currency] = (acc[d.currency] ?? 0) + d.outstandingBalanceMinor;
    return acc;
  }, {} as Record<string, number>)

// They owe me totals — same, filter owed_to_me
```

#### Overdue Detection

Computed client-side on render:
```ts
function isOverdue(debt: DebtRow): boolean {
  if (!debt.dueAt || debt.status === "closed") return false;
  return new Date(debt.dueAt) < new Date(new Date().toDateString());
}
```

#### Wiring into App.tsx

Replace the Debts placeholder:
```tsx
case "debts":
  return <DebtsScreen />;
```

---

## Data Flow

```
User taps "Add"
  → showAdd = true → Add Debt Modal
  → onSave → debtCreate(input) → debt_create (Rust) → INSERT debts → DebtRow
  → refresh() → debt_list() → SELECT ... → DebtRow[]
  → UI re-renders

User taps "Pay" on a DebtCard
  → showPayment = true → Add Payment Modal
  → onSave → debtPaymentAdd(input) → debt_payment_add (Rust)
              → INSERT debt_payments
              → recompute balance → if balance ≤ 0: UPDATE debts SET status='closed'
              → DebtPaymentRow
  → refresh() → debt_list() → updated DebtRow[]

User taps "Settle"
  → debtSetStatus(id, "closed") → UPDATE debts SET status='closed' → ()
  → refresh()

User taps trash
  → confirm dialog → debtDelete(id)
              → UPDATE debt_payments SET deleted_at=now WHERE debt_id=id
              → UPDATE debts SET deleted_at=now WHERE id=id
  → refresh()
```

---

## File Checklist

| File | Action |
|---|---|
| `src-tauri/src/commands/debts.rs` | Create — 5 commands |
| `src-tauri/src/commands/mod.rs` | Add `pub mod debts;` |
| `src-tauri/src/lib.rs` | Register 5 new commands in `invoke_handler!` |
| `src/lib/debts.ts` | Create — 6 invoke wrappers + types |
| `src/features/debts/DebtsScreen.tsx` | Create — full screen |
| `src/App.tsx` | Replace debts placeholder with `<DebtsScreen />` |

No migration needed — tables exist in `0001_init.sql`.

---

## Components and Interfaces

### Rust Commands (Backend)

| Command | Signature | Description |
|---|---|---|
| `debt_list` | `() -> Result<Vec<DebtRow>, String>` | Returns all non-deleted debts with computed outstanding balance |
| `debt_create` | `(input: DebtCreateInput) -> Result<DebtRow, String>` | Validates and inserts a new debt |
| `debt_set_status` | `(debt_id: String, status: String) -> Result<(), String>` | Manually opens or closes a debt |
| `debt_delete` | `(debt_id: String) -> Result<(), String>` | Soft-deletes a debt and all its payments |
| `debt_payment_add` | `(input: DebtPaymentAddInput) -> Result<DebtPaymentRow, String>` | Records a payment; auto-closes debt if balance ≤ 0 |
| `debt_payment_list` | `(debt_id: String) -> Result<Vec<DebtPaymentRow>, String>` | Returns all non-deleted payments for a debt |

### TypeScript Invoke Layer (`src/lib/debts.ts`)

One exported async function per command, each returning the typed struct above. All monetary values passed and received as integer minor units.

### React Components (`src/features/debts/`)

| Component | Responsibility |
|---|---|
| `DebtsScreen` | Root screen — owns state, data fetching, section layout |
| `DebtCard` | Single debt row — displays balance, overdue indicator, action buttons |
| Add Debt Modal (inline) | Modal using existing `Modal` component — form for creating a debt |
| Debt Detail Modal (inline) | Modal — shows payment history, add payment form, settle/delete controls |

---

## Data Models

### `DebtRow` (Rust → TypeScript)

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | UUID v4 |
| `kind` | `"owed_by_me" \| "owed_to_me"` | Direction of the debt |
| `counterparty` | `String` | Name of the other party |
| `principal_minor` | `i64` / `number` | Original amount, integer minor units |
| `currency` | `String` | ISO currency code, e.g. `"XAF"` |
| `opened_at` | `String` | RFC3339 timestamp of debt creation |
| `due_at` | `Option<String>` / `string \| null` | Optional ISO date |
| `status` | `"open" \| "closed"` | Current status |
| `note` | `Option<String>` / `string \| null` | Optional freetext |
| `outstanding_balance_minor` | `i64` / `number` | Computed: `principal - sum(payments)` |
| `created_at` | `String` | RFC3339 |
| `updated_at` | `String` | RFC3339 |

### `DebtPaymentRow` (Rust → TypeScript)

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | UUID v4 |
| `debt_id` | `String` | FK to debt |
| `amount_minor` | `i64` / `number` | Payment amount, integer minor units |
| `occurred_at` | `String` | RFC3339 timestamp |
| `note` | `Option<String>` / `string \| null` | Optional freetext |
| `created_at` | `String` | RFC3339 |

### `DebtCreateInput` (TypeScript → Rust)

| Field | Type | Notes |
|---|---|---|
| `kind` | `"owed_by_me" \| "owed_to_me"` | Required |
| `counterparty` | `String` | Required, non-empty |
| `principal_minor` | `i64` / `number` | Required, > 0 |
| `currency` | `Option<String>` | Optional, defaults to `"XAF"` |
| `due_at` | `Option<String>` | Optional ISO date |
| `note` | `Option<String>` | Optional |

### `DebtPaymentAddInput` (TypeScript → Rust)

| Field | Type | Notes |
|---|---|---|
| `debt_id` | `String` | Required |
| `amount_minor` | `i64` / `number` | Required, > 0 |
| `note` | `Option<String>` | Optional |

---

## Error Handling

All Rust commands return `Result<T, String>`. Error strings propagate to the frontend via Tauri's invoke mechanism and are displayed in the existing red error banner pattern used throughout the app.

| Scenario | Error message |
|---|---|
| `principal_minor <= 0` | `"amount must be > 0"` |
| Empty `counterparty` | `"counterparty is required"` |
| Invalid `kind` | `"kind must be 'owed_by_me' or 'owed_to_me'"` |
| `debt_id` not found | `"debt not found"` |
| `amount_minor <= 0` on payment | `"payment amount must be > 0"` |
| DB lock poisoned | `"db lock poisoned"` |

The frontend clears the error on each new action attempt (`setError(null)`) and displays it in the same `rounded-2xl border border-red-200 bg-red-50` banner used in every other screen.

---

## Testing Strategy

Property-based tests target the six correctness properties below. Each property is encoded as a Rust `#[test]` using an in-memory SQLite database (`:memory:`), calling the same SQL logic used by the commands.

### Test setup

```rust
fn test_db() -> rusqlite::Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../migrations/0001_init.sql")).unwrap();
    conn
}
```

Tests insert debts and payments directly, then call the query logic to verify invariants hold.

---

## Correctness Properties

### Property 1: Balance Invariant

**Validates: Requirements 7.1, 7.2, 7.4**

For any debt D with payments P₁…Pₙ (all non-deleted):

`outstandingBalanceMinor(D) == D.principalMinor - Σ Pᵢ.amountMinor`

This must hold after any sequence of payment additions and soft-deletions.

### Property 2: Auto-Close on Zero Balance

**Validates: Requirements 3.4, 7.3**

After adding a payment that causes `outstandingBalanceMinor ≤ 0`, the debt's `status` must equal `"closed"`.

### Property 3: Soft-Delete Cascade

**Validates: Requirements 6.1, 6.2**

After calling `debt_delete(id)`, neither the debt nor any of its associated payments shall appear in `debt_list()` or `debt_payment_list(id)`.

### Property 4: Reopen Correctness

**Validates: Requirements 5.2, 5.3**

Calling `debt_set_status(id, "open")` on a closed debt sets `status = "open"` without modifying any payment records.

### Property 5: Create Validation

**Validates: Requirements 1.2, 1.3, 1.4**

Calling `debt_create` with `principal_minor <= 0` or an empty `counterparty` returns an error, and no row is inserted into the `debts` table.

### Property 6: Payment Validation

**Validates: Requirements 3.2, 3.3**

Calling `debt_payment_add` with `amount_minor <= 0` returns an error, and no row is inserted into the `debt_payments` table.


These are the properties the implementation must satisfy, suitable for property-based testing:

1. **Balance invariant** — for any debt, `outstandingBalanceMinor == principalMinor - sum(all non-deleted payments for that debt)`, at all times.
2. **Auto-close** — after adding a payment that brings the outstanding balance to ≤ 0, `debt.status == "closed"`.
3. **Soft-delete cascade** — after `debtDelete(id)`, neither the debt nor any of its payments appear in any list query.
4. **Re-open correctness** — calling `debtSetStatus(id, "open")` on a closed debt sets status back to `"open"` without altering any payments.
5. **Create validation** — `debtCreate` with `principalMinor <= 0` or an empty `counterparty` always returns an error and inserts nothing.
6. **Payment validation** — `debtPaymentAdd` with `amountMinor <= 0` always returns an error and inserts nothing.
