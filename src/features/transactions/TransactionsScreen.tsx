import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Filter,
  Gift,
  HandCoins,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { accountList, type Account } from "../../lib/accounts";
import { categoryList, type Category } from "../../lib/categories";
import { contactList, type ContactRow } from "../../lib/debts";
import {
  isInflow,
  isOutflow,
  transactionCreateExpenseIncome,
  transactionCreateGiveReceive,
  transactionCreateTransfer,
  transactionList,
  txTypeLabel,
  type GiveReceiveCreateInput,
  type TransactionRow,
  type TransactionType,
} from "../../lib/transactions";
import { Modal } from "../../components/Modal";

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

type Mode = "expense" | "income" | "transfer" | "give" | "receive_gift";

// Types shown in the filter dropdown
const FILTER_TYPES: { value: string; label: string }[] = [
  { value: "all",              label: "All" },
  { value: "expense",          label: "Expense" },
  { value: "income",           label: "Income" },
  { value: "transfer",         label: "Transfer" },
  { value: "lend",             label: "Lent" },
  { value: "borrow",           label: "Borrowed" },
  { value: "give",             label: "Given" },
  { value: "receive_gift",     label: "Received (gift)" },
  { value: "debt_repayment",   label: "Debt repayment" },
  { value: "debt_collection",  label: "Debt collection" },
];

export function TransactionsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">("all");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterQuery, setFilterQuery] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<Mode>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const activeCategories = useMemo(
    () => (mode === "income" ? incomeCategories : expenseCategories),
    [expenseCategories, incomeCategories, mode],
  );

  const allCategories = useMemo(
    () =>
      [...expenseCategories, ...incomeCategories].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [expenseCategories, incomeCategories],
  );

  const visibleRows = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const min = filterMinAmount.trim() ? Number(filterMinAmount) : null;
    const max = filterMaxAmount.trim() ? Number(filterMaxAmount) : null;
    const from = filterFromDate ? new Date(`${filterFromDate}T00:00:00Z`) : null;
    const to = filterToDate ? new Date(`${filterToDate}T23:59:59Z`) : null;

    return rows.filter((r) => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (
        filterCategoryId !== "all" &&
        r.categoryId !== filterCategoryId
      )
        return false;

      if (q) {
        const hay = [
          r.merchant ?? "",
          r.note ?? "",
          r.categoryName ?? "",
          r.accountName ?? "",
          r.fromAccountName ?? "",
          r.toAccountName ?? "",
          r.contactName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const absAmount = Math.abs(r.amountMinor);
      if (min != null && Number.isFinite(min) && absAmount < min) return false;
      if (max != null && Number.isFinite(max) && absAmount > max) return false;

      const d = new Date(r.occurredAt);
      if (from && d < from) return false;
      if (to && d > to) return false;

      return true;
    });
  }, [
    filterCategoryId,
    filterFromDate,
    filterMaxAmount,
    filterMinAmount,
    filterQuery,
    filterToDate,
    filterType,
    rows,
  ]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterType !== "all") n++;
    if (filterCategoryId !== "all") n++;
    if (filterQuery.trim()) n++;
    if (filterMinAmount.trim()) n++;
    if (filterMaxAmount.trim()) n++;
    if (filterFromDate) n++;
    if (filterToDate) n++;
    return n;
  }, [
    filterCategoryId,
    filterFromDate,
    filterMaxAmount,
    filterMinAmount,
    filterQuery,
    filterToDate,
    filterType,
  ]);

  async function refresh() {
    setError(null);
    try {
      const [a, exp, inc, co] = await Promise.all([
        accountList(),
        categoryList("expense"),
        categoryList("income"),
        contactList(),
      ]);
      setAccounts(a);
      setExpenseCategories(exp);
      setIncomeCategories(inc);
      setContacts(co);

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

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading) void refresh(); }, [selectedAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setAmount(""); setMerchant(""); setNote(""); setContactId("");
  }

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
        if (!fromAccountId || !toAccountId)
          throw new Error("Pick from/to accounts.");
        await transactionCreateTransfer({
          amountMinor,
          fromAccountId,
          toAccountId,
          note: note.trim() || undefined,
          occurredAt: todayRfc3339(),
        });
      } else if (mode === "give" || mode === "receive_gift") {
        if (!accountId) throw new Error("Pick an account.");
        const input: GiveReceiveCreateInput = {
          type: mode,
          amountMinor,
          accountId,
          contactId: contactId || undefined,
          note: note.trim() || undefined,
          occurredAt: todayRfc3339(),
        };
        await transactionCreateGiveReceive(input);
      } else {
        if (!accountId) throw new Error("Pick an account.");
        await transactionCreateExpenseIncome({
          type: mode,
          amountMinor,
          accountId,
          categoryId: categoryId || undefined,
          contactId: contactId || undefined,
          merchant: merchant.trim() || undefined,
          note: note.trim() || undefined,
          occurredAt: todayRfc3339(),
        });
      }
      resetForm();
      setShowAdd(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Row display helpers ─────────────────────────────────────────────────

  function rowTitle(r: TransactionRow): string {
    if (r.type === "transfer")
      return `${r.fromAccountName ?? "From"} → ${r.toAccountName ?? "To"}`;
    if (r.contactName) return r.contactName;
    if (r.merchant) return r.merchant;
    if (r.categoryName) return r.categoryName;
    return txTypeLabel(r.type as TransactionType);
  }

  function rowSubtitle(r: TransactionRow): string {
    const label = txTypeLabel(r.type as TransactionType);
    if (r.type === "transfer") return "Transfer";
    const parts: string[] = [label];
    if (r.accountName) parts.push(r.accountName);
    if (r.categoryName && r.type !== "give" && r.type !== "receive_gift")
      parts.push(r.categoryName);
    return parts.join(" · ");
  }

  function rowColor(r: TransactionRow): string {
    if (r.type === "transfer") return "text-zinc-900";
    if (isOutflow(r.type as TransactionType)) return "text-red-700";
    if (isInflow(r.type as TransactionType)) return "text-emerald-700";
    return "text-zinc-900";
  }

  function rowSign(r: TransactionRow): number {
    if (r.type === "transfer") return r.amountMinor;
    if (isOutflow(r.type as TransactionType)) return -r.amountMinor;
    return r.amountMinor;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const showContactPicker =
    mode === "give" ||
    mode === "receive_gift" ||
    mode === "expense" ||
    mode === "income";

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Activity</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
          >
            <Filter className="size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="size-4" />
            Add
          </button>
        </div>
      </div>

      {/* Account filter */}
      <div className="flex items-center gap-2">
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.currentTarget.value)}
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

      {/* Filters modal */}
      <Modal title="Filters" open={showFilters} onClose={() => setShowFilters(false)}>
        <div className="grid gap-3">
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Type</div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.currentTarget.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              {FILTER_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Category</div>
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.currentTarget.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="all">All</option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Search</div>
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.currentTarget.value)}
              placeholder="merchant, note, person…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Min amount</div>
              <input value={filterMinAmount}
                onChange={(e) => setFilterMinAmount(e.currentTarget.value)}
                inputMode="numeric" placeholder="0"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Max amount</div>
              <input value={filterMaxAmount}
                onChange={(e) => setFilterMaxAmount(e.currentTarget.value)}
                inputMode="numeric" placeholder="100000"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">From</div>
              <input value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.currentTarget.value)}
                type="date"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">To</div>
              <input value={filterToDate}
                onChange={(e) => setFilterToDate(e.currentTarget.value)}
                type="date"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            </label>
          </div>

          <button type="button"
            onClick={() => {
              setFilterType("all"); setFilterCategoryId("all");
              setFilterQuery(""); setFilterMinAmount(""); setFilterMaxAmount("");
              setFilterFromDate(""); setFilterToDate("");
            }}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
            Reset filters
          </button>
        </div>
      </Modal>

      {/* Add transaction modal */}
      <Modal title="Add transaction" open={showAdd} onClose={() => setShowAdd(false)}>
        {/* Mode tabs — row 1: expense/income/transfer, row 2: give/receive */}
        <div className="grid gap-2">
          <div className="flex gap-2">
            {(["expense", "income", "transfer"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={["flex-1 rounded-xl px-2 py-2 text-sm font-medium",
                  mode === m ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white"].join(" ")}>
                <span className="inline-flex items-center justify-center gap-1.5">
                  {m === "expense" ? <TrendingDown className="size-4" /> :
                   m === "income"  ? <TrendingUp   className="size-4" /> :
                                     <ArrowRightLeft className="size-4" />}
                  {m === "expense" ? "Expense" : m === "income" ? "Income" : "Transfer"}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["give", "receive_gift"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={["flex-1 rounded-xl px-2 py-2 text-sm font-medium",
                  mode === m ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white"].join(" ")}>
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Gift className="size-4" />
                  {m === "give" ? "Give" : "Receive"}
                </span>
              </button>
            ))}
          </div>

          {/* Context hint */}
          {(mode === "give" || mode === "receive_gift") ? (
            <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              {mode === "give"
                ? "Money you give to someone with no expectation of return."
                : "Money you receive from someone with no expectation of return."}
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3">
          {/* Amount */}
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Amount</div>
            <input value={amount} onChange={(e) => setAmount(e.currentTarget.value)}
              inputMode="numeric" placeholder="e.g. 500"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            <div className="mt-1 text-xs text-zinc-500">Integer amount (XAF has no decimals).</div>
          </label>

          {/* Transfer: from/to */}
          {mode === "transfer" ? (
            <>
              <label className="block">
                <div className="text-xs font-medium text-zinc-700">From</div>
                <select value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.currentTarget.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400">
                  <option value="" disabled>Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-medium text-zinc-700">To</div>
                <select value={toAccountId}
                  onChange={(e) => setToAccountId(e.currentTarget.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400">
                  <option value="" disabled>Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-zinc-500">Same-currency accounts only.</div>
              </label>
            </>
          ) : (
            <>
              {/* Account */}
              <label className="block">
                <div className="text-xs font-medium text-zinc-700">
                  {mode === "give"         ? "Money leaves account" :
                   mode === "receive_gift" ? "Money enters account" :
                   mode === "expense"      ? "Account" :
                                             "Account"}
                </div>
                <select value={accountId}
                  onChange={(e) => setAccountId(e.currentTarget.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400">
                  <option value="" disabled>Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
              </label>

              {/* Category — only for expense/income */}
              {(mode === "expense" || mode === "income") ? (
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">Category</div>
                  <select value={categoryId}
                    onChange={(e) => setCategoryId(e.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400">
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {/* Merchant — only for expense */}
              {mode === "expense" ? (
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">Merchant (optional)</div>
                  <input value={merchant}
                    onChange={(e) => setMerchant(e.currentTarget.value)}
                    placeholder="e.g. Carrefour"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
                </label>
              ) : null}

              {/* Contact — for give/receive and optionally expense/income */}
              {showContactPicker ? (
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">
                    {(mode === "give" || mode === "receive_gift")
                      ? "Person (optional)"
                      : "Person — if from/to a contact (optional)"}
                  </div>
                  <select value={contactId}
                    onChange={(e) => setContactId(e.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400">
                    <option value="">No specific person</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          )}

          {/* Note */}
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Note (optional)</div>
            <input value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              placeholder="Anything to remember…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </label>

          <button type="button" disabled={saving} onClick={onSave}
            className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>

      {/* Transaction list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            No transactions yet.
          </div>
        ) : (
          visibleRows.map((r) => (
            <div key={r.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{rowTitle(r)}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">{rowSubtitle(r)}</div>
              </div>
              <div className={["text-sm font-semibold tabular-nums", rowColor(r)].join(" ")}>
                {formatMoney(r.currency, rowSign(r))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
