import { invoke } from "@tauri-apps/api/core";

export type AccountType = "cash" | "bank" | "mobile_money" | "card" | "other";

export type Account = {
  id: string;
  name: string;
  type: AccountType | string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AccountCreateInput = {
  name: string;
  type: AccountType;
  currency?: string; // defaults to XAF
};

export async function accountCount(): Promise<number> {
  return invoke<number>("account_count");
}

export async function accountList(): Promise<Account[]> {
  return invoke<Account[]>("account_list");
}

export async function accountCreate(input: AccountCreateInput): Promise<Account> {
  return invoke<Account>("account_create", { input });
}

