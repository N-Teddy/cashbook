import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Plus, Trash2, UserRound } from "lucide-react";
import {
  contactCreate,
  contactDelete,
  contactList,
  debtCreate,
  debtDelete,
  debtList,
  debtPaymentAdd,
  debtPaymentList,
  debtSetStatus,
  type ContactRow,
  type DebtCreateInput,
  type DebtKind,
  type DebtPaymentRow,
  type DebtRow,
} from "../../lib/debts";
import { accountList, type Account } from "../../lib/accounts";
import { Modal } from "../../components/Modal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function isOverdue(debt: DebtRow): boolean {
  if (!debt.dueAt || debt.status === "closed") return false;
  return new Date(debt.dueAt) < new Date(new Date().toDateString());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-CM", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// ContactCard — shown on the contacts list
// ---------------------------------------------------------------------------

function ContactCard(props: {
  contact: ContactRow;
  onSelect: (c: ContactRow) => void;
  onDelete: (c: ContactRow) => void;
}) {
  const { contact } = props;
  const net = contact.netBalanceMinor;
  const isPositive = net >= 0;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => props.onSelect(contact)}
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-zinc-500">
            <UserRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{contact.name}</div>
            {contact.openDebtCount > 0 ? (
              <div className="mt-0.5 text-xs text-zinc-500">
                {contact.openDebtCount} open debt
                {contact.openDebtCount !== 1 ? "s" : ""}
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-zinc-400">All settled</div>
            )}
          </div>
          {contact.openDebtCount > 0 ? (
            <div className="shrink-0 text-right">
              <div
                className={[
                  "text-sm font-semibold tabular-nums",
                  isPositive ? "text-emerald-700" : "text-red-700",
                ].join(" ")}
              >
                {isPositive ? "+" : ""}
                {formatMoney(contact.primaryCurrency, net)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">
                {isPositive ? "net they owe" : "net you owe"}
              </div>
            </div>
          ) : null}
        </div>
      </button>
      <div className="mt-3 flex justify-end border-t border-zinc-100 pt-3">
        <button
          type="button"
          onClick={() => props.onDelete(contact)}
          className="rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-400"
          title="Delete contact"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DebtCard — shown in the contact detail
// ---------------------------------------------------------------------------

function DebtCard(props: {
  debt: DebtRow;
  onSelect: (d: DebtRow) => void;
  onPay: (d: DebtRow) => void;
  onSettle: (d: DebtRow) => void;
  onDelete: (d: DebtRow) => void;
}) {
  const { debt } = props;
  const overdue = isOverdue(debt);
  const isOwedByMe = debt.kind === "owed_by_me";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => props.onSelect(debt)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {isOwedByMe ? "You borrowed" : "They borrowed"}
            </div>
            {debt.accountName ? (
              <div className="mt-0.5 text-xs text-zinc-500">
                {isOwedByMe
                  ? `into your ${debt.accountName}`
                  : `from your ${debt.accountName}`}
              </div>
            ) : null}
            {debt.dueAt ? (
              <div
                className={[
                  "mt-1 flex items-center gap-1 text-xs",
                  overdue ? "text-amber-600" : "text-zinc-500",
                ].join(" ")}
              >
                {overdue ? <AlertTriangle className="size-3 shrink-0" /> : null}
                {overdue ? "Overdue · " : "Due "}
                {formatDate(debt.dueAt)}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <div
              className={[
                "text-base font-semibold tabular-nums",
                isOwedByMe ? "text-red-700" : "text-emerald-700",
              ].join(" ")}
            >
              {formatMoney(debt.currency, debt.outstandingBalanceMinor)}
            </div>
            <div className="mt-0.5 text-xs text-zinc-400 tabular-nums">
              of {formatMoney(debt.currency, debt.principalMinor)}
            </div>
            <div
              className={[
                "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                debt.status === "closed"
                  ? "bg-emerald-100 text-emerald-700"
                  : "border border-zinc-200 text-zinc-600",
              ].join(" ")}
            >
              {debt.status === "closed" ? "Settled" : "Open"}
            </div>
          </div>
        </div>
      </button>
      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
        {debt.status === "open" ? (
          <button
            type="button"
            onClick={() => props.onPay(debt)}
            className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Pay
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => props.onSettle(debt)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium"
        >
          {debt.status === "open" ? "Settle" : "Reopen"}
        </button>
        <button
          type="button"
          onClick={() => props.onDelete(debt)}
          className="ml-auto rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-400"
          title="Delete"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactDetailView — debts for one contact
// ---------------------------------------------------------------------------

function ContactDetailView(props: {
  contact: ContactRow;
  accounts: Account[];
  onBack: () => void;
  onRefreshContacts: () => void;
}) {
  const { contact, accounts } = props;

  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add-debt modal
  const [showAdd, setShowAdd] = useState(false);
  const [addKind, setAddKind] = useState<DebtKind>("owed_by_me");
  const [addAmount, setAddAmount] = useState("");
  const [addCurrency, setAddCurrency] = useState("XAF");
  const [addAccountId, setAddAccountId] = useState("");
  const [addDueAt, setAddDueAt] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // detail modal
  const [selectedDebt, setSelectedDebt] = useState<DebtRow | null>(null);
  const [payments, setPayments] = useState<DebtPaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DebtRow | null>(null);

  async function refresh() {
    setError(null);
    try {
      const list = await debtList(contact.id);
      setDebts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [contact.id]);

  async function loadPayments(debtId: string) {
    setPaymentsLoading(true);
    try { setPayments(await debtPaymentList(debtId)); }
    catch { setPayments([]); }
    finally { setPaymentsLoading(false); }
  }

  const iOweTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const d of debts) {
      if (d.kind === "owed_by_me" && d.status === "open")
        acc[d.currency] = (acc[d.currency] ?? 0) + d.outstandingBalanceMinor;
    }
    return acc;
  }, [debts]);

  const theyOweTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const d of debts) {
      if (d.kind === "owed_to_me" && d.status === "open")
        acc[d.currency] = (acc[d.currency] ?? 0) + d.outstandingBalanceMinor;
    }
    return acc;
  }, [debts]);

  const iOweList = useMemo(() => debts.filter(d => d.kind === "owed_by_me"), [debts]);
  const theyOweList = useMemo(() => debts.filter(d => d.kind === "owed_to_me"), [debts]);

  function resetAddForm() {
    setAddKind("owed_by_me"); setAddAmount(""); setAddCurrency("XAF");
    setAddAccountId(""); setAddDueAt(""); setAddNote("");
  }

  async function onAddSave() {
    setError(null);
    const amt = Number(addAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isInteger(amt)) {
      setError("Enter a valid positive integer amount."); return;
    }
    setAddSaving(true);
    try {
      const input: DebtCreateInput = {
        contactId: contact.id,
        kind: addKind,
        principalMinor: Math.trunc(amt),
        currency: addCurrency.trim().toUpperCase() || "XAF",
        accountId: addAccountId || undefined,
        dueAt: addDueAt || undefined,
        note: addNote.trim() || undefined,
      };
      await debtCreate(input);
      resetAddForm(); setShowAdd(false);
      await refresh(); props.onRefreshContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setAddSaving(false); }
  }

  async function onPaySave() {
    if (!selectedDebt) return;
    setError(null);
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isInteger(amt)) {
      setError("Enter a valid positive integer payment amount."); return;
    }
    setPaySaving(true);
    try {
      await debtPaymentAdd({
        debtId: selectedDebt.id,
        amountMinor: Math.trunc(amt),
        accountId: payAccountId || undefined,
        note: payNote.trim() || undefined,
      });
      setPayAmount(""); setPayAccountId(""); setPayNote(""); setShowPayment(false);
      await loadPayments(selectedDebt.id);
      const freshList = await debtList(contact.id);
      setDebts(freshList);
      setSelectedDebt(freshList.find(d => d.id === selectedDebt.id) ?? null);
      props.onRefreshContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setPaySaving(false); }
  }

  async function onSettle(debt: DebtRow) {
    setError(null);
    try {
      await debtSetStatus(debt.id, debt.status === "open" ? "closed" : "open");
      const freshList = await debtList(contact.id);
      setDebts(freshList);
      if (selectedDebt?.id === debt.id)
        setSelectedDebt(freshList.find(d => d.id === debt.id) ?? null);
      props.onRefreshContacts();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function onConfirmDelete(debt: DebtRow) {
    setError(null);
    try {
      await debtDelete(debt.id);
      setConfirmDelete(null);
      if (selectedDebt?.id === debt.id) { setSelectedDebt(null); setShowPayment(false); }
      await refresh(); props.onRefreshContacts();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <h1 className="flex-1 truncate text-lg font-semibold tracking-tight">
          {contact.name}
        </h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {/* Summary cards */}
      {!loading ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">You owe them</div>
            {Object.keys(iOweTotals).length === 0 ? (
              <div className="mt-1 text-sm font-semibold text-zinc-400">{formatMoney("XAF", 0)}</div>
            ) : Object.entries(iOweTotals).map(([cur, total]) => (
              <div key={cur} className="mt-1 text-sm font-semibold text-red-700 tabular-nums">
                {formatMoney(cur, total)}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">They owe you</div>
            {Object.keys(theyOweTotals).length === 0 ? (
              <div className="mt-1 text-sm font-semibold text-zinc-400">{formatMoney("XAF", 0)}</div>
            ) : Object.entries(theyOweTotals).map(([cur, total]) => (
              <div key={cur} className="mt-1 text-sm font-semibold text-emerald-700 tabular-nums">
                {formatMoney(cur, total)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : (
        <>
          {/* You owe section */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-500">You borrowed from them</div>
            {iOweList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                No debts you owe {contact.name}.
              </div>
            ) : iOweList.map(d => (
              <DebtCard key={d.id} debt={d}
                onSelect={debt => { setSelectedDebt(debt); setShowPayment(false); setPayAmount(""); setPayNote(""); void loadPayments(debt.id); }}
                onPay={debt => { setSelectedDebt(debt); setShowPayment(true); void loadPayments(debt.id); }}
                onSettle={onSettle}
                onDelete={debt => setConfirmDelete(debt)}
              />
            ))}
          </div>

          {/* They owe section */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-500">They borrowed from you</div>
            {theyOweList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                {contact.name} owes you nothing.
              </div>
            ) : theyOweList.map(d => (
              <DebtCard key={d.id} debt={d}
                onSelect={debt => { setSelectedDebt(debt); setShowPayment(false); setPayAmount(""); setPayNote(""); void loadPayments(debt.id); }}
                onPay={debt => { setSelectedDebt(debt); setShowPayment(true); void loadPayments(debt.id); }}
                onSettle={onSettle}
                onDelete={debt => setConfirmDelete(debt)}
              />
            ))}
          </div>
        </>
      )}

      {/* Add Debt Modal */}
      <Modal title="Add debt" open={showAdd} onClose={() => { resetAddForm(); setShowAdd(false); }}>
        <div className="grid gap-3">
          <div className="flex gap-2">
            {(["owed_by_me", "owed_to_me"] as DebtKind[]).map(k => (
              <button key={k} type="button" onClick={() => setAddKind(k)}
                className={["flex-1 rounded-xl px-3 py-2 text-sm font-medium",
                  addKind === k ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white"].join(" ")}>
                {k === "owed_by_me" ? "I borrowed" : "They borrowed"}
              </button>
            ))}
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
            {addKind === "owed_by_me"
              ? `You borrowed money from ${contact.name}.`
              : `${contact.name} borrowed money from you.`}
          </div>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Amount</div>
            <input value={addAmount} onChange={e => setAddAmount(e.currentTarget.value)}
              inputMode="numeric" placeholder="e.g. 5000"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Currency</div>
            <input value={addCurrency} onChange={e => setAddCurrency(e.currentTarget.value)}
              placeholder="XAF" autoCapitalize="characters"
              className="mt-1 w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">
              {addKind === "owed_by_me" ? "Money entered into account" : "Money left from account"}
            </div>
            <select value={addAccountId} onChange={e => setAddAccountId(e.currentTarget.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400">
              <option value="">None / not tracked</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Due date (optional)</div>
            <input value={addDueAt} onChange={e => setAddDueAt(e.currentTarget.value)}
              type="date"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Note (optional)</div>
            <input value={addNote} onChange={e => setAddNote(e.currentTarget.value)}
              placeholder="What's this for…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </label>
          <button type="button" disabled={addSaving} onClick={onAddSave}
            className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            {addSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>

      {/* Debt Detail Modal */}
      <Modal title={selectedDebt ? (selectedDebt.kind === "owed_by_me" ? "You borrowed" : "They borrowed") : ""}
        open={!!selectedDebt}
        onClose={() => { setSelectedDebt(null); setShowPayment(false); setPayAmount(""); setPayNote(""); }}>
        {selectedDebt ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div
                className={["mt-1 text-2xl font-bold tabular-nums",
                  selectedDebt.kind === "owed_by_me" ? "text-red-700" : "text-emerald-700"].join(" ")}>
                {formatMoney(selectedDebt.currency, selectedDebt.outstandingBalanceMinor)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-400 tabular-nums">
                of {formatMoney(selectedDebt.currency, selectedDebt.principalMinor)} original
              </div>
              {selectedDebt.accountName ? (
                <div className="mt-1 text-xs text-zinc-500">
                  Account: {selectedDebt.accountName}
                </div>
              ) : null}
              {selectedDebt.dueAt ? (
                <div className={["mt-2 flex items-center gap-1 text-xs",
                  isOverdue(selectedDebt) ? "text-amber-600" : "text-zinc-500"].join(" ")}>
                  {isOverdue(selectedDebt) ? <AlertTriangle className="size-3 shrink-0" /> : null}
                  {isOverdue(selectedDebt) ? "Overdue · " : "Due "}
                  {formatDate(selectedDebt.dueAt)}
                </div>
              ) : null}
              {selectedDebt.note ? (
                <div className="mt-2 text-xs italic text-zinc-500">{selectedDebt.note}</div>
              ) : null}
            </div>

            {selectedDebt.status === "open" && !showPayment ? (
              <button type="button" onClick={() => setShowPayment(true)}
                className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
                Record payment
              </button>
            ) : null}

            {showPayment ? (
              <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-medium">Record payment</div>
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">Amount</div>
                  <input value={payAmount} onChange={e => setPayAmount(e.currentTarget.value)}
                    inputMode="numeric" placeholder="e.g. 2500"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
                </label>
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">
                    {selectedDebt.kind === "owed_by_me"
                      ? "Money leaves account (you're paying back)"
                      : "Money enters account (they're paying you back)"}
                  </div>
                  <select value={payAccountId} onChange={e => setPayAccountId(e.currentTarget.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400">
                    <option value="">None / not tracked</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-medium text-zinc-700">Note (optional)</div>
                  <input value={payNote} onChange={e => setPayNote(e.currentTarget.value)}
                    placeholder="e.g. Cash in person"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={paySaving} onClick={onPaySave}
                    className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                    {paySaving ? "Saving…" : "Save payment"}
                  </button>
                  <button type="button"
                    onClick={() => { setShowPayment(false); setPayAmount(""); setPayNote(""); }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-2 text-xs font-medium text-zinc-500">Payment history</div>
              {paymentsLoading ? (
                <div className="text-sm text-zinc-600">Loading…</div>
              ) : payments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-600">
                  No payments yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-3">
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-500">{formatDate(p.occurredAt)}</div>
                        {p.accountName ? (
                          <div className="mt-0.5 text-xs text-zinc-400">{p.accountName}</div>
                        ) : null}
                        {p.note ? (
                          <div className="mt-0.5 truncate text-xs italic text-zinc-400">{p.note}</div>
                        ) : null}
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-emerald-700">
                        {formatMoney(selectedDebt.currency, p.amountMinor)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={() => void onSettle(selectedDebt)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
              {selectedDebt.status === "open" ? "Mark as settled" : "Reopen debt"}
            </button>

            {confirmDelete?.id === selectedDebt.id ? (
              <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3">
                <div className="text-sm text-red-700">Delete this debt and all its payments?</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void onConfirmDelete(selectedDebt)}
                    className="flex-1 rounded-xl bg-red-700 px-3 py-2 text-sm font-medium text-white">
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(selectedDebt)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700">
                <Trash2 className="size-4" /> Delete debt
              </button>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Standalone delete confirm */}
      {confirmDelete && !selectedDebt ? (
        <Modal title="Delete debt" open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
          <div className="space-y-3">
            <div className="text-sm text-zinc-700">
              Delete this debt with <span className="font-semibold">{contact.name}</span>? All payment history will also be removed.
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void onConfirmDelete(confirmDelete)}
                className="flex-1 rounded-xl bg-red-700 px-3 py-2 text-sm font-medium text-white">
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DebtsScreen — root: contact list + add contact
// ---------------------------------------------------------------------------

export function DebtsScreen() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);

  // add-contact modal
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // delete-contact confirm
  const [confirmDeleteContact, setConfirmDeleteContact] = useState<ContactRow | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [c, a] = await Promise.all([contactList(), accountList()]);
      setContacts(c);
      setAccounts(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function onAddContact() {
    setError(null);
    const name = newName.trim();
    if (!name) { setError("Name is required."); return; }
    setAddSaving(true);
    try {
      const c = await contactCreate({ name, note: newNote.trim() || undefined });
      setNewName(""); setNewNote(""); setShowAddContact(false);
      // Open the new contact immediately
      await refresh();
      setSelectedContact(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setAddSaving(false); }
  }

  async function onDeleteContact(contact: ContactRow) {
    setError(null);
    try {
      await contactDelete(contact.id);
      setConfirmDeleteContact(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // If a contact is selected, show the detail view
  if (selectedContact) {
    // Keep the contact in sync after refreshes
    const live = contacts.find(c => c.id === selectedContact.id) ?? selectedContact;
    return (
      <ContactDetailView
        contact={live}
        accounts={accounts}
        onBack={() => setSelectedContact(null)}
        onRefreshContacts={refresh}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Debts</h1>
        <button
          type="button"
          onClick={() => setShowAddContact(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" /> Add person
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
          <div className="text-sm font-medium text-zinc-600">No people yet</div>
          <div className="mt-1 text-xs text-zinc-400">
            Add a person to start tracking debts with them.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <ContactCard key={c.id} contact={c}
              onSelect={setSelectedContact}
              onDelete={contact => setConfirmDeleteContact(contact)}
            />
          ))}
        </div>
      )}

      {/* Add contact modal */}
      <Modal title="Add person" open={showAddContact} onClose={() => { setNewName(""); setNewNote(""); setShowAddContact(false); }}>
        <div className="grid gap-3">
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Name</div>
            <input value={newName} onChange={e => setNewName(e.currentTarget.value)}
              placeholder="e.g. Mama, Paul, Boss…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Note (optional)</div>
            <input value={newNote} onChange={e => setNewNote(e.currentTarget.value)}
              placeholder="e.g. Sister, neighbour…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </label>
          <button type="button" disabled={addSaving} onClick={onAddContact}
            className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            {addSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>

      {/* Delete contact confirm */}
      <Modal title="Remove person" open={!!confirmDeleteContact} onClose={() => setConfirmDeleteContact(null)}>
        {confirmDeleteContact ? (
          <div className="space-y-3">
            <div className="text-sm text-zinc-700">
              Remove <span className="font-semibold">{confirmDeleteContact.name}</span> from your contacts?
              {confirmDeleteContact.openDebtCount > 0 ? (
                <span className="mt-1 block text-xs text-red-600">
                  This person has open debts — settle them first before removing.
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button type="button"
                disabled={confirmDeleteContact.openDebtCount > 0}
                onClick={() => void onDeleteContact(confirmDeleteContact)}
                className="flex-1 rounded-xl bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
                Remove
              </button>
              <button type="button" onClick={() => setConfirmDeleteContact(null)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
