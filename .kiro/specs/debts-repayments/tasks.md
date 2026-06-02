# Implementation Plan: Debts & Repayments

## Overview

Implement the full Debts & Repayments feature end-to-end: 6 new Rust Tauri commands, a TypeScript invoke layer, and a complete React `DebtsScreen` replacing the existing nav placeholder. No new SQLite migration is required — the `debts` and `debt_payments` tables already exist in `0001_init.sql`.

## Tasks

- [x] 1. Create `src-tauri/src/commands/debts.rs` with all structs and the `debt_list` command
  - Define `DebtRow` serialise struct with all fields from the design (`id`, `kind`, `counterparty`, `principal_minor`, `currency`, `opened_at`, `due_at`, `status`, `note`, `outstanding_balance_minor`, `created_at`, `updated_at`) using `#[serde(rename_all = "camelCase")]`
  - Define `DebtCreateInput`, `DebtPaymentRow`, `DebtPaymentAddInput` deserialise structs
  - Implement `debt_list()` returning all non-deleted debts ordered by `opened_at DESC` with `outstanding_balance_minor` computed via correlated subquery
  - **Requires:** nothing
  - **Requirement coverage:** 2.1, 2.2

- [x] 2. Add `debt_create` command to `debts.rs`
  - Validate `kind` is `"owed_by_me"` or `"owed_to_me"`, counterparty non-empty after trim, `principal_minor > 0`
  - Default `currency` to `"XAF"` when not provided
  - Insert with `status = "open"`, `opened_at = now()`, UUID generated with `uuid::Uuid::new_v4()`
  - Return full `DebtRow` with `outstanding_balance_minor = principal_minor`
  - **Requires:** Task 1
  - **Requirement coverage:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6

- [x] 3. Add `debt_set_status`, `debt_delete`, `debt_payment_add`, `debt_payment_list` commands to `debts.rs`
  - `debt_set_status(debt_id, status)`: validate debt exists and is not deleted, validate status is `"open"` or `"closed"`, UPDATE with new status and `updated_at = now()`
  - `debt_delete(debt_id)`: validate debt exists, soft-delete all payments first then soft-delete the debt in the same logical operation
  - `debt_payment_add(input)`: validate `amount_minor > 0` and `debt_id` exists, INSERT payment, recompute balance and if ≤ 0 set debt `status = "closed"`, return the new `DebtPaymentRow`
  - `debt_payment_list(debt_id)`: return all non-deleted payments for the debt ordered by `occurred_at DESC`; return empty vec if debt not found
  - **Requires:** Task 1
  - **Requirement coverage:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.4, 7.1, 7.2, 7.3, 7.4

- [x] 4. Register the debts module in `commands/mod.rs` and `lib.rs`
  - Add `pub mod debts;` to `src-tauri/src/commands/mod.rs`
  - Add all 6 commands to the `invoke_handler!` macro in `src-tauri/src/lib.rs`
  - Run `cargo check` in `src-tauri/` and confirm zero compilation errors
  - **Requires:** Tasks 1, 2, 3
  - **Requirement coverage:** 1.1, 2.1, 3.1, 4.1, 5.1, 6.1

- [x] 5. Create `src/lib/debts.ts` with types and invoke wrappers
  - Export types: `DebtKind`, `DebtStatus`, `DebtRow`, `DebtPaymentRow`, `DebtCreateInput`, `DebtPaymentAddInput`
  - Export 6 async functions, one per command, using `invoke` from `@tauri-apps/api/core`
  - All camelCase field names to match Rust's `serde(rename_all = "camelCase")`
  - **Requires:** Task 4
  - **Requirement coverage:** 1.1, 2.1, 3.1, 4.1, 5.1, 6.1

- [x] 6. Create `src/features/debts/DebtsScreen.tsx` — skeleton, state, data loading, and summary cards
  - Declare state: `debts: DebtRow[]`, `loading`, `error`, `showAdd`, `selectedDebt: DebtRow | null`, `showPayment`
  - Implement `refresh()` calling `debtList()` and a `useEffect` on mount
  - Render header with "Debts" title and dark "Add" button (same style as TransactionsScreen)
  - Render red error banner when `error` is set
  - Compute summary totals with `useMemo`: sum of `outstandingBalanceMinor` for open `owed_by_me` debts grouped by currency, and same for `owed_to_me`
  - Render two side-by-side summary cards ("I owe" in red, "They owe me" in green); show zero when no open debts of that kind exist
  - **Requires:** Task 5
  - **Requirement coverage:** 2.3, 2.4, 8.1, 8.2, 8.3

- [x] 7. Add `DebtCard` component and the two debt list sections to `DebtsScreen.tsx`
  - Create `isOverdue(debt: DebtRow): boolean` helper — returns `true` when `debt.dueAt` is set, `debt.status === "open"`, and `new Date(debt.dueAt) < today`
  - Create `DebtCard` inner component that renders: counterparty name, outstanding balance (red for `owed_by_me`, green for `owed_to_me`), original principal (muted), due date with amber overdue indicator when applicable, status badge ("Open" / "Settled"), action buttons ("Pay" only when open, "Settle"/"Reopen" toggle, trash icon)
  - Tapping the card body (not the action buttons) opens the Debt Detail modal by setting `selectedDebt`
  - Add "I owe" section (`debts.filter(d => d.kind === "owed_by_me")`) and "They owe me" section (`debts.filter(d => d.kind === "owed_to_me")`) each with an empty-state message
  - **Requires:** Task 6
  - **Requirement coverage:** 2.3, 2.4, 2.5, 2.6, 5.4, 6.3

- [x] 8. Add the Add Debt modal to `DebtsScreen.tsx`
  - Use the existing `Modal` component with `open={showAdd}` and `onClose={() => setShowAdd(false)}`
  - Direction toggle: segmented "I owe" / "They owe me" buttons (same pattern as Expense/Income/Transfer in TransactionsScreen)
  - Counterparty text input (required), amount numeric input (`inputMode="numeric"`, required, integer), currency text input (default `"XAF"`), due date `<input type="date">` (optional), note text input (optional)
  - Save button: validate inputs, call `debtCreate(...)`, reset form, close modal, call `refresh()`
  - Show validation error in the existing error banner if counterparty is empty or amount is not a positive integer
  - Reset all form fields on modal close
  - **Requires:** Task 7
  - **Requirement coverage:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6

- [x] 9. Add the Debt Detail modal and Add Payment sub-form to `DebtsScreen.tsx`
  - Use `Modal` with `open={!!selectedDebt}` and `onClose={() => { setSelectedDebt(null); setShowPayment(false); }}`
  - On modal open, call `debtPaymentList(selectedDebt.id)` and store results in local `payments` state
  - Display kind label ("You owe" / "They owe you"), principal (muted), outstanding balance (large, coloured), due date with overdue indicator, note if any
  - Show "Add Payment" button only when `selectedDebt.status === "open"`; clicking it sets `showPayment = true`
  - When `showPayment`, render amount input (required) and note input (optional) with Save and Cancel buttons; Save calls `debtPaymentAdd(...)`, reloads `debtPaymentList`, calls `refresh()`, and updates `selectedDebt` from the refreshed list
  - Payment history list: show amount (formatted), date, note for each payment; show "No payments yet" when empty
  - "Settle" / "Reopen" button calls `debtSetStatus(...)` then `refresh()` and updates `selectedDebt`
  - "Delete debt" button shows inline confirmation; on confirm calls `debtDelete(...)`, closes modal, calls `refresh()`
  - **Requires:** Tasks 7, 8
  - **Requirement coverage:** 3.1, 3.4, 3.5, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.4, 6.1, 6.3, 6.4

- [x] 10. Wire `DebtsScreen` into `App.tsx` and run final checks
  - Import `DebtsScreen` from `./features/debts/DebtsScreen` in `src/App.tsx`
  - Replace the `case "debts"` placeholder block with `return <DebtsScreen />;`
  - Run TypeScript type check (`pnpm tsc --noEmit`) — zero errors
  - Run `cargo check` — zero errors
  - Manually test: create debts of both kinds, record partial and full payments, verify auto-close, manually settle and reopen, delete a debt, confirm summary card totals update
  - Remove any debug/console.log code
  - **Requires:** Tasks 1–9
  - **Requirement coverage:** 2.1, 2.6

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1] },
    { "wave": 2, "tasks": [2, 3] },
    { "wave": 3, "tasks": [4] },
    { "wave": 4, "tasks": [5] },
    { "wave": 5, "tasks": [6] },
    { "wave": 6, "tasks": [7] },
    { "wave": 7, "tasks": [8] },
    { "wave": 8, "tasks": [9] },
    { "wave": 9, "tasks": [10] }
  ]
}
```

Tasks 2 and 3 are in the same wave — they are in the same file and have no dependency on each other.

## Notes

- No new SQLite migration needed — `debts` and `debt_payments` tables exist in `0001_init.sql`
- `outstanding_balance_minor` is always computed at query time via SQL subquery, never stored as a column
- `formatMoney` utility already exists in `DashboardScreen.tsx` and `TransactionsScreen.tsx` — copy the same `Intl.NumberFormat("fr-CM", ...)` pattern into `DebtsScreen.tsx` for consistent XAF formatting
- The `Modal` component is already built and used by `TransactionsScreen` and `AccountsScreen` — reuse it as-is
- All error strings from Rust commands propagate through Tauri's invoke mechanism and are displayed in the same red banner pattern used across the app
