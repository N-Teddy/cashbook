import { AppShell } from "./components/AppShell";
import { AccountSetupGate } from "./features/accounts/AccountSetupGate";
import { useState } from "react";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { TransactionsScreen } from "./features/transactions/TransactionsScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { LockGate } from "./features/security/LockGate";
import { DebtsScreen } from "./features/debts/DebtsScreen";

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
            return <DebtsScreen />;

          case "settings":
            return <SettingsScreen />;
        }
      }}
    </AppShell>
  );
}

export default App;
