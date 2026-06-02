import { invoke } from "@tauri-apps/api/core";

export type TransactionType = "expense" | "income" | "transfer";

export type TransactionRow = {
  id: string;
  type: TransactionType | string;
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
  merchant: string | null;
  note: string | null;
  occurredAt: string;
};

export type ExpenseIncomeCreateInput = {
  type: "expense" | "income";
  amountMinor: number;
  accountId: string;
  categoryId?: string;
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

