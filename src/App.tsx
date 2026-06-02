import { AppShell } from "./components/AppShell";
import { AccountSetupGate } from "./features/accounts/AccountSetupGate";
import { useState } from "react";
import { TransactionsScreen } from "./features/transactions/TransactionsScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";

function App() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return <AccountSetupGate onReady={() => setReady(true)} />;
  }

  return (
    <AppShell>
      {(tab) => {
        switch (tab) {
          case "dashboard":
            return (
              <section className="space-y-3">
                <h1 className="text-lg font-semibold tracking-tight">
                  Overview
                </h1>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">This month</div>
                    <div className="mt-1 text-xl font-semibold">XAF 0</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Net cashflow (placeholder)
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Spent</div>
                    <div className="mt-1 text-xl font-semibold">XAF 0</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Expenses (placeholder)
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-medium">Quick add</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
                    >
                      + Expense
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
                    >
                      + Income
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Voice + AI will land here later.
                  </div>
                </div>
              </section>
            );

          case "transactions":
            return <TransactionsScreen />;

          case "debts":
            return (
              <section className="space-y-3">
                <h1 className="text-lg font-semibold tracking-tight">Debts</h1>
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                  Debts + repayments UI will go here.
                </div>
              </section>
            );

          case "settings":
            return <SettingsScreen />;
        }
      }}
    </AppShell>
  );
}

export default App;
