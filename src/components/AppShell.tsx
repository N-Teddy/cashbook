import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ChartNoAxesCombined,
  CreditCard,
  Settings,
  Tag,
  Users,
} from "lucide-react";

type TabId = "dashboard" | "transactions" | "debts" | "settings";

type Tab = {
  id: TabId;
  label: string;
  icon: ReactNode;
};

export function AppShell(props: { children: (tab: TabId) => ReactNode }) {
  const [tab, setTab] = useState<TabId>("dashboard");

  const tabs = useMemo<Tab[]>(
    () => [
      { id: "dashboard", label: "Overview", icon: <ChartNoAxesCombined /> },
      { id: "transactions", label: "Activity", icon: <CreditCard /> },
      { id: "debts", label: "People", icon: <Users /> },
      { id: "settings", label: "Settings", icon: <Settings /> },
    ],
    [],
  );

  return (
    <div className="h-full">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">
              Expense Tracker
            </div>
            <div className="text-xs text-zinc-500">
              Personal finance, offline-first
            </div>
          </div>
          <div className="text-xs text-zinc-500">Single user</div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-sm px-4 pb-24 pt-4">
        {props.children(tab)}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-screen-sm grid-cols-4 px-2 py-2">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs",
                  active ? "bg-zinc-100 text-zinc-950" : "text-zinc-500",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid size-6 place-items-center",
                    "[&>svg]:size-5 [&>svg]:stroke-[2]",
                  ].join(" ")}
                >
                  {t.icon}
                </span>
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

