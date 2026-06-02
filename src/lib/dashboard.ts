import { invoke } from "@tauri-apps/api/core";

export type CurrencyTotals = {
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

export type AccountTotals = {
  accountId: string;
  accountName: string;
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

export type CategoryTotals = {
  categoryId: string;
  categoryName: string;
  currency: string;
  expenseMinor: number;
};

export type DashboardMonthSummary = {
  month: string;
  start: string;
  end: string;
  totalsByCurrency: CurrencyTotals[];
  totalsByAccount: AccountTotals[];
  topExpenseCategories: CategoryTotals[];
};

export async function dashboardMonthSummary(month?: string) {
  return invoke<DashboardMonthSummary>("dashboard_month_summary", {
    month: month ?? null,
  });
}

