import { AppShell } from "./components/AppShell";
import { AccountSetupGate } from "./features/accounts/AccountSetupGate";
import { useState } from "react";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { TransactionsScreen } from "./features/transactions/TransactionsScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { LockGate } from "./features/security/LockGate";

function App() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  if (!ready) {
    return <AccountSetupGate onReady={() => setReady(true)} />;
  }

  if (!unlocked) {
    return <LockGate onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <AppShell>
      {(tab) => {
        switch (tab) {
          case "dashboard":
            return <DashboardScreen />;

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
