# Requirements Document

## Introduction

The Debts & Repayments feature enables the user to track money they owe to others ("I owe") and money others owe to them ("they owe me"), record partial repayments against any debt, monitor the outstanding balance on each debt, mark debts as fully settled, and identify overdue debts by due date.

The feature operates entirely offline against the local SQLite database. The `debts` and `debt_payments` tables already exist in migration `0001_init.sql` — no new migration is required. The Rust backend requires 6 new Tauri commands (`debt_list`, `debt_create`, `debt_set_status`, `debt_delete`, `debt_payment_add`, `debt_payment_list`), and the React frontend requires a full `DebtsScreen` replacing the existing placeholder in `App.tsx`.

All monetary amounts are stored and transmitted as **integer minor units** (e.g., XAF has no subdivisions, so 5 000 XAF is stored as `5000`). The default currency is **XAF**.

---

## Glossary

- **Debt_Manager**: The Tauri/Rust command layer responsible for persisting and querying debts and debt payments in SQLite.
- **Debts_Screen**: The React component rendered when the user navigates to the Debts tab.
- **Debt**: A record representing a sum of money either owed by the user to another party, or owed to the user by another party.
- **Debt_Kind**: The direction of a debt — `owed_by_me` (user owes someone) or `owed_to_me` (someone owes the user).
- **Counterparty**: The name of the person or entity on the other side of a debt.
- **Principal**: The original full amount of the debt in minor units at the time of creation.
- **Outstanding_Balance**: `principal_minor` minus the sum of all non-deleted payment amounts for the debt.
- **Debt_Payment**: A partial or full repayment recorded against a specific debt.
- **Debt_Status**: Either `open` (debt has outstanding balance) or `closed` (debt is fully settled).
- **Due_Date**: An optional calendar date by which a debt is expected to be repaid.
- **Overdue**: An `open` debt whose `due_at` date is earlier than the current date.
- **Minor_Units**: Integer representation of a monetary amount (e.g., 1 000 XAF = `1000` minor units).

---

## Requirements

### Requirement 1: Create a Debt

**User Story:** As a user, I want to record a new debt with a counterparty name, direction, amount, currency, and optional due date, so that I can track money I owe or that is owed to me.

#### Acceptance Criteria

1. WHEN the user submits a new debt form with a non-empty counterparty name, a valid `Debt_Kind`, a positive integer `principal_minor`, and a currency code, THE `Debt_Manager` SHALL persist a new debt record with `status = 'open'` and return the created debt.
2. IF the submitted `principal_minor` is zero or negative, THEN THE `Debt_Manager` SHALL return an error describing that the amount must be greater than zero.
3. IF the submitted counterparty name is empty or whitespace-only, THEN THE `Debt_Manager` SHALL return an error describing that the counterparty name is required.
4. IF the submitted `Debt_Kind` is not `owed_by_me` or `owed_to_me`, THEN THE `Debt_Manager` SHALL return an error describing that the kind is invalid.
5. WHERE a due date is provided, THE `Debt_Manager` SHALL store it; WHERE no due date is provided, THE `Debt_Manager` SHALL store `due_at` as `NULL`.
6. THE `Debt_Manager` SHALL generate a UUID for each new debt and record `created_at` and `updated_at` as the current UTC timestamp.

---

### Requirement 2: List Debts with Outstanding Balances

**User Story:** As a user, I want to see all my debts with their outstanding balances and statuses, so that I know who owes me and what I owe at a glance.

#### Acceptance Criteria

1. WHEN the `Debts_Screen` loads, THE `Debt_Manager` SHALL return all non-deleted debts ordered by `opened_at` descending, each including the `Outstanding_Balance` computed as `principal_minor` minus the sum of non-deleted payment amounts.
2. THE `Debt_Manager` SHALL include each debt's `id`, `kind`, `counterparty`, `principal_minor`, `currency`, `opened_at`, `due_at`, `status`, `note`, and computed `outstanding_balance_minor` in the list response.
3. WHILE a debt has an `Outstanding_Balance` greater than zero and `status = 'open'`, THE `Debts_Screen` SHALL display it as open.
4. WHILE a debt has `status = 'closed'`, THE `Debts_Screen` SHALL display it with a visual indicator distinguishing it from open debts.
5. WHILE an open debt's `due_at` is earlier than the current date, THE `Debts_Screen` SHALL display a visible overdue indicator on that debt row.
6. THE `Debts_Screen` SHALL separate debts into two sections: "I owe" (`owed_by_me`) and "They owe me" (`owed_to_me`).

---

### Requirement 3: Record a Debt Payment

**User Story:** As a user, I want to record a partial or full repayment against a debt, so that the outstanding balance decreases and I can track repayment progress.

#### Acceptance Criteria

1. WHEN the user submits a payment with a valid `debt_id` and a positive integer `amount_minor`, THE `Debt_Manager` SHALL persist a new `Debt_Payment` record linked to the debt and return the created payment row including `id`, `debt_id`, `amount_minor`, `occurred_at`, `note`, and `created_at`.
2. IF the submitted `amount_minor` is zero or negative, THEN THE `Debt_Manager` SHALL return an error describing that the payment amount must be greater than zero and SHALL NOT insert any row.
3. IF the `debt_id` does not correspond to a non-deleted debt, THEN THE `Debt_Manager` SHALL return an error describing that the debt was not found and SHALL NOT insert any row.
4. WHEN a payment is recorded and the resulting `Outstanding_Balance` becomes zero or negative, THE `Debt_Manager` SHALL automatically update the debt's `status` to `'closed'` and set `updated_at` to the current UTC timestamp.
5. WHEN a payment is recorded and the resulting `Outstanding_Balance` remains greater than zero, THE `Debt_Manager` SHALL leave the debt's `status` as `'open'`.
6. THE `Debt_Manager` SHALL generate a UUID for each new payment, set `occurred_at` to the current UTC timestamp, and record `created_at` and `updated_at` as the current UTC timestamp.
7. WHERE a note is provided with the payment, THE `Debt_Manager` SHALL store it; WHERE no note is provided, THE `Debt_Manager` SHALL store `note` as `NULL`.

---

### Requirement 4: View Payment History for a Debt

**User Story:** As a user, I want to see the list of repayments made against a specific debt, so that I can review the repayment history.

#### Acceptance Criteria

1. WHEN the user opens the detail view for a debt, THE `Debt_Manager` SHALL return all non-deleted payments for that `debt_id` ordered by `occurred_at` descending via the `debt_payment_list` command.
2. THE `Debt_Manager` SHALL include each payment's `id`, `debt_id`, `amount_minor`, `occurred_at`, `note`, and `created_at` in the list response.
3. IF the `debt_id` does not correspond to a non-deleted debt, THEN THE `Debt_Manager` SHALL return an empty list (not an error).
4. THE `Debts_Screen` SHALL display the payment history inside the Debt Detail modal, showing amount, date, and note for each payment.
5. WHILE no payments have been recorded for a debt, THE `Debts_Screen` SHALL display an empty-state message in the payment history section.

---

### Requirement 5: Manually Close or Reopen a Debt

**User Story:** As a user, I want to manually mark a debt as closed or reopen a closed debt, so that I can handle off-app settlements and corrections.

#### Acceptance Criteria

1. WHEN the user requests to close an open debt by `debt_id`, THE `Debt_Manager` SHALL set the debt's `status` to `'closed'` and update `updated_at` to the current UTC timestamp.
2. WHEN the user requests to reopen a closed debt by `debt_id`, THE `Debt_Manager` SHALL set the debt's `status` to `'open'` and update `updated_at` to the current UTC timestamp.
3. IF the `debt_id` does not correspond to a non-deleted debt, THEN THE `Debt_Manager` SHALL return an error describing that the debt was not found.
4. THE `Debts_Screen` SHALL provide controls for the user to manually close an open debt and to reopen a closed debt.

---

### Requirement 6: Delete a Debt

**User Story:** As a user, I want to delete a debt I entered by mistake, so that my debt list stays accurate.

#### Acceptance Criteria

1. WHEN the user confirms deletion of a debt by `debt_id`, THE `Debt_Manager` SHALL set the debt's `deleted_at` to the current UTC timestamp (soft delete) and set `deleted_at` on all associated `Debt_Payment` records in the same operation.
2. WHEN the debt list is fetched after a deletion, THE `Debt_Manager` SHALL exclude debts with a non-null `deleted_at` from results, and `debt_payment_list` SHALL exclude payments with a non-null `deleted_at`.
3. THE `Debts_Screen` SHALL require an explicit confirmation step before executing a debt deletion.
4. IF the `debt_id` does not correspond to a non-deleted debt, THEN THE `Debt_Manager` SHALL return an error describing that the debt was not found.

---

### Requirement 7: Outstanding Balance Invariant

**User Story:** As a user, I want the displayed outstanding balance to always accurately reflect the principal minus all recorded payments, so that I can trust the numbers.

#### Acceptance Criteria

1. THE `Debt_Manager` SHALL compute `outstanding_balance_minor` as `principal_minor - SUM(payment.amount_minor)` over all non-deleted payments for the debt, for any sequence of payment additions.
2. WHEN all payments are deleted, THE `Debt_Manager` SHALL return `outstanding_balance_minor` equal to `principal_minor`.
3. WHEN a payment whose `amount_minor` exceeds the current `outstanding_balance_minor` is recorded, THE `Debt_Manager` SHALL still persist the payment and report `outstanding_balance_minor` as a non-positive number, closing the debt automatically.
4. FOR ALL valid debts with one or more payments, `outstanding_balance_minor` SHALL equal `principal_minor` minus the sum of all non-deleted payment amounts (round-trip invariant between creation, payment, and balance query).

---

### Requirement 8: Debt Summary Totals in Debts Screen

**User Story:** As a user, I want to see aggregated totals of what I owe and what is owed to me grouped by currency, so that I understand my net debt position quickly.

#### Acceptance Criteria

1. WHEN the `Debts_Screen` renders, THE `Debts_Screen` SHALL display the total outstanding balance for all open `owed_by_me` debts grouped by currency.
2. WHEN the `Debts_Screen` renders, THE `Debts_Screen` SHALL display the total outstanding balance for all open `owed_to_me` debts grouped by currency.
3. WHILE there are no open debts of a given kind, THE `Debts_Screen` SHALL display zero for that kind's total.
