import { useState } from "react";
import { ChevronRight, CreditCard, Lock, Cloud, ArrowLeft } from "lucide-react";
import { AccountsScreen } from "../accounts/AccountsScreen";

type Route = "root" | "accounts";

export function SettingsScreen() {
  const [route, setRoute] = useState<Route>("root");

  if (route === "accounts") {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRoute("root")}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>

        <AccountsScreen />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => setRoute("accounts")}
          className="flex w-full items-center justify-between gap-3 px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-white">
              <CreditCard className="size-5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium">Accounts</div>
              <div className="text-xs text-zinc-500">
                Add, archive, delete, set default
              </div>
            </div>
          </div>
          <ChevronRight className="size-5 text-zinc-400" />
        </button>

        <div className="h-px bg-zinc-200" />

        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-white">
              <Lock className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium">Security</div>
              <div className="text-xs text-zinc-500">
                Biometric / pattern lock (next)
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-zinc-200" />

        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-white">
              <Cloud className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium">Cloud backup</div>
              <div className="text-xs text-zinc-500">
                MongoDB encrypted snapshot (later)
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

