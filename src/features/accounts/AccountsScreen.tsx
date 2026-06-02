import { useEffect, useMemo, useState } from "react";
import { Archive, Plus, RotateCcw, Star, Trash2, WalletMinimal } from "lucide-react";
import {
  accountArchive,
  accountCreate,
  accountDelete,
  accountList,
  accountSetDefault,
  accountUnarchive,
  type AccountType,
} from "../../lib/accounts";
import { Modal } from "../../components/Modal";

type AccountTypeOption = {
  value: AccountType;
  label: string;
};

export function AccountsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<
    {
      id: string;
      name: string;
      type: string;
      currency: string;
      isDefault: boolean;
      usageCount: number;
      isArchived: boolean;
    }[]
  >([]);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [currency, setCurrency] = useState("XAF");
  const [saving, setSaving] = useState(false);

  const typeOptions = useMemo<AccountTypeOption[]>(
    () => [
      { value: "cash", label: "Cash (purse)" },
      { value: "mobile_money", label: "Mobile money (MoMo)" },
      { value: "bank", label: "Bank" },
      { value: "card", label: "Card" },
      { value: "other", label: "Other" },
    ],
    [],
  );

  async function refresh() {
    setError(null);
    try {
      const list = await accountList();
      setAccounts(
        list.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          isDefault: a.isDefault,
          usageCount: a.usageCount,
          isArchived: a.isArchived,
        })),
      );
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

  async function onAdd() {
    setError(null);
    const trimmed = name.trim();
    const cur = currency.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter an account name.");
      return;
    }
    if (!cur) {
      setError("Please enter a currency (e.g. XAF).");
      return;
    }

    setSaving(true);
    try {
      await accountCreate({ name: trimmed, type, currency: cur });
      setName("");
      setCurrency("XAF");
      setType("cash");
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
        <h1 className="text-lg font-semibold tracking-tight">Accounts</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <Modal
        title="Add account"
        open={showAdd}
        onClose={() => setShowAdd(false)}
      >
          <div className="grid gap-3">
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="e.g. Purse, MTN MoMo, Bank…"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </label>

            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Type</div>
              <select
                value={type}
                onChange={(e) => setType(e.currentTarget.value as AccountType)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Currency</div>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.currentTarget.value)}
                placeholder="XAF"
                autoCapitalize="characters"
                className="mt-1 w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
              <div className="mt-1 text-xs text-zinc-500">
                Use ISO code (e.g. XAF, USD). Default is XAF.
              </div>
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={onAdd}
              className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save account"}
            </button>
          </div>
      </Modal>

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            No accounts yet.
          </div>
        ) : (
          accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "grid size-10 place-items-center rounded-2xl text-white",
                    a.isArchived ? "bg-zinc-500" : "bg-zinc-900",
                  ].join(" ")}
                >
                  <WalletMinimal className="size-5" />
                </div>
                <div>
                  <div
                    className={[
                      "text-sm font-medium",
                      a.isArchived ? "text-zinc-500" : "text-zinc-950",
                    ].join(" ")}
                  >
                    {a.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {a.type} • {a.currency}
                    {a.isDefault ? " • default" : ""}
                    {a.isArchived ? " • archived" : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!a.isDefault && !a.isArchived ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        await accountSetDefault(a.id);
                        await refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium"
                    title="Set default"
                  >
                    <Star className="size-4" />
                  </button>
                ) : null}

                {a.isArchived ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        await accountUnarchive(a.id);
                        await refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium"
                    title="Unarchive"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        await accountArchive(a.id);
                        await refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium"
                    title="Archive"
                  >
                    <Archive className="size-4" />
                  </button>
                )}

                <button
                  type="button"
                  disabled={a.usageCount > 0}
                  onClick={async () => {
                    setError(null);
                    try {
                      await accountDelete(a.id);
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs font-medium disabled:opacity-40"
                  title={
                    a.usageCount > 0
                      ? "Cannot delete: has transactions"
                      : "Delete"
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

