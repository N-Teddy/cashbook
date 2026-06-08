import { useEffect, useMemo, useState } from "react";
import { WalletMinimal } from "lucide-react";
import { accountCount, accountCreate } from "../../lib/accounts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/Select";

type AccountTypeOption = {
  value: "cash" | "bank" | "mobile_money" | "card" | "other";
  label: string;
  hint: string;
};

export function AccountSetupGate(props: { onReady: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountTypeOption["value"]>("cash");
  const [currency, setCurrency] = useState("XAF");

  const options = useMemo<AccountTypeOption[]>(
    () => [
      { value: "cash", label: "Purse (cash)", hint: "Physical cash in hand" },
      { value: "mobile_money", label: "MoMo", hint: "MTN/Orange Money, etc." },
      { value: "bank", label: "Bank", hint: "Bank account" },
      { value: "card", label: "Card", hint: "Debit/credit card" },
      { value: "other", label: "Other", hint: "Any other source" },
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkWithRetry(attempt: number) {
      try {
        const count = await accountCount();
        if (cancelled) return;
        if (count > 0) {
          props.onReady();
          return;
        }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;

        const msg = e instanceof Error ? e.message : String(e);

        // On mobile startup, the JS can run before the native invoke handler is ready.
        // Also, if you open the Vite URL in a normal browser, Tauri commands won't exist.
        const shouldRetry =
          attempt < 8 &&
          (msg.toLowerCase().includes("not found") ||
            msg.toLowerCase().includes("invoke"));

        if (shouldRetry) {
          const delayMs = Math.min(1500, 100 * Math.pow(2, attempt));
          setTimeout(() => {
            void checkWithRetry(attempt + 1);
          }, delayMs);
          return;
        }

        setError(msg);
        setLoading(false);
      }
    }

    void checkWithRetry(0);
    return () => {
      cancelled = true;
    };
  }, [props]);

  async function onSubmit() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter an account name.");
      return;
    }

    const cur = currency.trim().toUpperCase();
    if (!cur) {
      setError("Please enter a currency (e.g. XAF).");
      return;
    }

    setSaving(true);
    try {
      await accountCreate({ name: trimmed, type, currency: cur });
      props.onReady();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid h-full place-items-center px-4">
        <div className="text-sm text-zinc-600">Preparing your database…</div>
      </div>
    );
  }

  return (
    <div className="grid h-full place-items-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-white">
            <WalletMinimal className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight">
              Set up your first account
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Accounts keep expenses separate (bank vs purse vs MoMo).
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Account name</div>
            <input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. Purse, MTN MoMo, BICEC…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Type</div>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-1 text-xs text-zinc-500">
              {options.find((o) => o.value === type)?.hint}
            </div>
          </label>

          <div className="rounded-2xl bg-zinc-50 p-3">
            <div className="text-xs font-medium text-zinc-700">Currency</div>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={currency}
                onChange={(e) => setCurrency(e.currentTarget.value)}
                inputMode="text"
                autoCapitalize="characters"
                placeholder="XAF"
                className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
              <div className="text-xs text-zinc-500">
                Default is XAF (Cameroon)
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}

