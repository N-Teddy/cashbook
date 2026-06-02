import { invoke } from "@tauri-apps/api/core";

// All possible transaction types in the system
export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "lend"           // gave money expecting it back  (account --)
  | "borrow"         // received money expecting to pay back (account ++)
  | "give"           // gave money, no repayment      (account --)
  | "receive_gift"   // received money, no repayment  (account ++)
  | "debt_repayment" // paying back a debt I owe      (account --)
  | "debt_collection"// collecting a debt owed to me  (account ++)
  | string;

export type TransactionRow = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  accountId: string | null;
  accountName: string | null;
  fromAccountId: string | null;
  fromAccountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  contactId: string | null;
  contactName: string | null;
  merchant: string | null;
  note: string | null;
  occurredAt: string;
};

export type ExpenseIncomeCreateInput = {
  type: "expense" | "income";
  amountMinor: number;
  accountId: string;
  categoryId?: string;
  contactId?: string;
  merchant?: string;
  note?: string;
  occurredAt: string;
};

export type TransferCreateInput = {
  amountMinor: number;
  fromAccountId: string;
  toAccountId: string;
  note?: string;
  occurredAt: string;
};

export type GiveReceiveCreateInput = {
  type: "give" | "receive_gift";
  amountMinor: number;
  accountId: string;
  contactId?: string;
  note?: string;
  occurredAt: string;
};

export async function transactionList(params?: {
  limit?: number;
  accountId?: string;
}) {
  return invoke<TransactionRow[]>("transaction_list", {
    limit: params?.limit ?? null,
    accountId: params?.accountId ?? null,
  });
}

export async function transactionCreateExpenseIncome(
  input: ExpenseIncomeCreateInput,
) {
  return invoke<string>("transaction_create_expense_income", { input });
}

export async function transactionCreateTransfer(input: TransferCreateInput) {
  return invoke<string>("transaction_create_transfer", { input });
}

export async function transactionCreateGiveReceive(
  input: GiveReceiveCreateInput,
) {
  return invoke<string>("transaction_create_give_receive", { input });
}

// ---------------------------------------------------------------------------
// Display helpers — used in both Activity and People screens
// ---------------------------------------------------------------------------

/** Human-readable label for each transaction type */
export function txTypeLabel(type: TransactionType): string {
  switch (type) {
    case "expense":          return "Expense";
    case "income":           return "Income";
    case "transfer":         return "Transfer";
    case "lend":             return "Lent";
    case "borrow":           return "Borrowed";
    case "give":             return "Given";
    case "receive_gift":     return "Received";
    case "debt_repayment":   return "Repayment";
    case "debt_collection":  return "Collection";
    default:                 return type;
  }
}

/** Returns true if this type causes money to leave the account (negative flow) */
export function isOutflow(type: TransactionType): boolean {
  return (
    type === "expense" ||
    type === "lend" ||
    type === "give" ||
    type === "debt_repayment"
  );
}

/** Returns true if this type causes money to enter the account (positive flow) */
export function isInflow(type: TransactionType): boolean {
  return (
    type === "income" ||
    type === "borrow" ||
    type === "receive_gift" ||
    type === "debt_collection"
  );
}
