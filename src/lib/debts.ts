import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type ContactRow = {
  id: string;
  name: string;
  note: string | null;
  netBalanceMinor: number; // positive = they owe me net, negative = I owe them net
  primaryCurrency: string;
  openDebtCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ContactCreateInput = {
  name: string;
  note?: string;
};

export async function contactList(): Promise<ContactRow[]> {
  return invoke<ContactRow[]>("contact_list");
}

export async function contactCreate(
  input: ContactCreateInput,
): Promise<ContactRow> {
  return invoke<ContactRow>("contact_create", { input });
}

export async function contactDelete(contactId: string): Promise<void> {
  return invoke<void>("contact_delete", { contactId });
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export type DebtKind = "owed_by_me" | "owed_to_me";
export type DebtStatus = "open" | "closed";

export type DebtRow = {
  id: string;
  contactId: string | null;
  kind: DebtKind;
  counterparty: string;
  principalMinor: number;
  currency: string;
  accountId: string | null;
  accountName: string | null;
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
  accountId: string | null;
  accountName: string | null;
  occurredAt: string;
  note: string | null;
  createdAt: string;
};

export type DebtCreateInput = {
  contactId: string;
  kind: DebtKind;
  principalMinor: number;
  currency?: string;
  accountId?: string;
  dueAt?: string;
  note?: string;
};

export type DebtPaymentAddInput = {
  debtId: string;
  amountMinor: number;
  accountId?: string;
  note?: string;
};

export async function debtList(contactId?: string): Promise<DebtRow[]> {
  return invoke<DebtRow[]>("debt_list", {
    contactId: contactId ?? null,
  });
}

export async function debtCreate(input: DebtCreateInput): Promise<DebtRow> {
  return invoke<DebtRow>("debt_create", { input });
}

export async function debtSetStatus(
  debtId: string,
  status: DebtStatus,
): Promise<void> {
  return invoke<void>("debt_set_status", { debtId, status });
}

export async function debtDelete(debtId: string): Promise<void> {
  return invoke<void>("debt_delete", { debtId });
}

export async function debtPaymentAdd(
  input: DebtPaymentAddInput,
): Promise<DebtPaymentRow> {
  return invoke<DebtPaymentRow>("debt_payment_add", { input });
}

export async function debtPaymentList(
  debtId: string,
): Promise<DebtPaymentRow[]> {
  return invoke<DebtPaymentRow[]>("debt_payment_list", { debtId });
}
