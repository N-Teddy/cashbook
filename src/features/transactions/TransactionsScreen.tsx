import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { accountList, type Account } from "../../lib/accounts";
import { categoryList, type Category } from "../../lib/categories";
import {
  transactionCreateExpenseIncome,
  transactionCreateTransfer,
  transactionList,
  type TransactionRow,
} from "../../lib/transactions";

function todayRfc3339(): string {
  return new Date().toISOString();
}

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

type Mode = "expense" | "income" | "transfer";

export function TransactionsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);

  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">(
    "all",
  );

  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<Mode>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const activeCategories = useMemo(() => {
    return mode === "income" ? incomeCategories : expenseCategories;
  }, [expenseCategories, incomeCategories, mode]);

  async function refresh() {
    setError(null);
    try {
      const [a, exp, inc] = await Promise.all([
        accountList(),
        categoryList("expense"),
        categoryList("income"),
      ]);
      setAccounts(a);
      setExpenseCategories(exp);
      setIncomeCategories(inc);

      const list = await transactionList({
        limit: 200,
        accountId: selectedAccountId === "all" ? undefined : selectedAccountId,
      });
      setRows(list);

      if (!accountId && a.length > 0) setAccountId(a[0]!.id);
      if (!fromAccountId && a.length > 0) setFromAccountId(a[0]!.id);
      if (!toAccountId && a.length > 1) setToAccountId(a[1]!.id);
      if (!categoryId && exp.length > 0) setCategoryId(exp[0]!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  async function onSave() {
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount (integer).");
      return;
    }
    const amountMinor = Math.trunc(amt);

    setSaving(true);
    try {
      if (mode === "transfer") {
        if (!fromAccountId || !toAccountId) {
          throw new Error("Pick from/to accounts.");
        }
        await transactionCreateTransfer({
          amountMinor,
          fromAccountId,
          toAccountId,
          note: note.trim() || undefined,
          occurredAt: todayRfc3339(),
        });
      } else {
        if (!accountId) throw new Error("Pick an account.");
        await transactionCreateExpenseIncome({
          type: mode,
          amountMinor,
          accountId,
          categoryId: categoryId || undefined,
          merchant: merchant.trim() || undefined,
          note: note.trim() || undefined,
          occurredAt: todayRfc3339(),
        });
      }

      setAmount("");
      setMerchant("");
      setNote("");
      setShowAdd(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Activity</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selectedAccountId}
          onChange={(e) =>
            setSelectedAccountId(e.currentTarget.value as "all" | string)
          }
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
        >
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {showAdd ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("expense")}
              className={[
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium",
                mode === "expense"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-2">
                <TrendingDown className="size-4" /> Expense
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("income")}
              className={[
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium",
                mode === "income"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-2">
                <TrendingUp className="size-4" /> Income
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("transfer")}
              className={[
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium",
                mode === "transfer"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-2">
                <ArrowRightLeft className="size-4" /> Transfer
              </span>
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Amount</div>
              <input
                value={amount}
                onChange={(e) => setAmount(e.currentTarget.value)}
                inputMode="numeric"
                placeholder="e.g. 500"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
              <div className="mt-1 text-xs text-zinc-500">
                Enter integer amount for now (XAF has no decimals).
              </div>
            </label>

            {mode === "transfer" ? (
              <>
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">From</div>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  >
                    <option value="" disabled>
                      Select account…
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">To</div>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  >
                    <option value="" disabled>
                      Select account…
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-zinc-500">
                    v1 requires same-currency accounts for transfer.
                  </div>
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">Account</div>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  >
                    <option value="" disabled>
                      Select account…
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">
                    Category
                  </div>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                {mode === "expense" ? (
                  <label className="block">
                    <div className="text-xs font-medium text-zinc-700">
                      Merchant (optional)
                    </div>
                    <input
                      value={merchant}
                      onChange={(e) => setMerchant(e.currentTarget.value)}
                      placeholder="e.g. Carrefour"
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                  </label>
                ) : null}
              </>
            )}

            <label className="block">
              <div className="text-xs font-medium text-zinc-700">
                Note (optional)
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
                placeholder="Anything to remember…"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            No transactions yet.
          </div>
        ) : (
          rows.map((r) => {
            const title =
              r.type === "transfer"
                ? `${r.fromAccountName ?? "From"} → ${r.toAccountName ?? "To"}`
                : r.merchant ??
                  r.categoryName ??
                  (r.type === "expense" ? "Expense" : "Income");

            const subtitle =
              r.type === "transfer"
                ? "Transfer"
                : `${r.accountName ?? "Account"} • ${r.categoryName ?? "—"}`;

            const signed =
              r.type === "expense"
                ? -r.amountMinor
                : r.type === "income"
                  ? r.amountMinor
                  : r.amountMinor;

            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{title}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {subtitle}
                  </div>
                </div>
                <div
                  className={[
                    "text-sm font-semibold tabular-nums",
                    r.type === "expense"
                      ? "text-red-700"
                      : r.type === "income"
                        ? "text-emerald-700"
                        : "text-zinc-900",
                  ].join(" ")}
                >
                  {formatMoney(r.currency, signed)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

