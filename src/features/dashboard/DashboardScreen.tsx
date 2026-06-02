import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import {
  dashboardMonthSummary,
  type DashboardMonthSummary,
} from "../../lib/dashboard";

function formatMoney(currency: string, amountMinor: number) {
  try {
    return new Intl.NumberFormat("fr-CM", {
      style: "currency",
      currency,
    }).format(amountMinor);
  } catch {
    return `${currency} ${amountMinor}`;
  }
}

export function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardMonthSummary | null>(null);

  async function refresh() {
    setError(null);
    try {
      const res = await dashboardMonthSummary();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const currencies = useMemo(() => data?.totalsByCurrency ?? [], [data]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
          <div className="mt-0.5 text-xs text-zinc-500">
            {data ? `Month: ${data.month}` : "This month"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : !data ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
          No data.
        </div>
      ) : currencies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
          No income/expense this month yet.
        </div>
      ) : (
        <>
          {currencies.map((t) => (
            <div key={t.currency} className="space-y-3">
              <div className="text-xs font-medium text-zinc-500">
                Totals ({t.currency})
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Income</div>
                  <div className="mt-1 text-base font-semibold text-emerald-700">
                    {formatMoney(t.currency, t.incomeMinor)}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Spent</div>
                  <div className="mt-1 text-base font-semibold text-red-700">
                    {formatMoney(t.currency, t.expenseMinor)}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Net</div>
                  <div className="mt-1 text-base font-semibold">
                    {formatMoney(t.currency, t.netMinor)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-medium">By account</div>
            <div className="mt-3 space-y-2">
              {data.totalsByAccount.map((a) => (
                <div
                  key={a.accountId}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {a.accountName}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {a.currency}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Net</div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatMoney(a.currency, a.netMinor)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-medium">Top spending</div>
            <div className="mt-3 space-y-2">
              {data.topExpenseCategories.length === 0 ? (
                <div className="text-sm text-zinc-600">
                  No categorized expenses yet.
                </div>
              ) : (
                data.topExpenseCategories.map((c) => (
                  <div
                    key={`${c.categoryId}:${c.currency}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {c.categoryName}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {c.currency}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-red-700">
                      {formatMoney(c.currency, c.expenseMinor)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <ArrowDownRight className="size-4 text-red-700" /> Tip
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Use Activity filters to see where money went.
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <ArrowUpRight className="size-4 text-emerald-700" /> Tip
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Add income transactions to improve net accuracy.
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Wallet className="size-4 text-zinc-700" /> Tip
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Separate bank vs purse vs MoMo accounts.
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

