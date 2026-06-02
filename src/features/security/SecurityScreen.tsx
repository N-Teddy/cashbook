import { useEffect, useState } from "react";
import { ArrowLeft, Fingerprint, Lock } from "lucide-react";
import {
  securitySetBiometricEnabled,
  securitySetLockEnabled,
  securitySetPattern,
  securityState,
  type SecurityState,
} from "../../lib/security";
import { PatternLock } from "./PatternLock";

async function testBiometric(): Promise<boolean> {
  try {
    const mod = await import("@tauri-apps/plugin-biometric");
    await mod.authenticate("Confirm fingerprint to enable biometric unlock");
    return true;
  } catch {
    return false;
  }
}

export function SecurityScreen(props: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SecurityState | null>(null);
  const [mode, setMode] = useState<"idle" | "setPattern" | "setPatternForLock">("idle");
  const [biometricWorking, setBiometricWorking] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const s = await securityState();
      setState(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <h1 className="text-lg font-semibold tracking-tight">Security</h1>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {loading || !state ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : (
        <>
          {/* App lock toggle */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">App lock</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Require fingerprint or pattern to open the app.
                </div>
                {!state.hasPattern && !state.lockEnabled ? (
                  <div className="mt-1 text-xs text-amber-600">
                    Set a pattern below before enabling lock.
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  // Enabling lock requires a pattern as fallback.
                  if (!state.lockEnabled && !state.hasPattern) {
                    setMode("setPatternForLock");
                    return;
                  }
                  try {
                    await securitySetLockEnabled(!state.lockEnabled);
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  state.lockEnabled
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-white",
                ].join(" ")}
              >
                {state.lockEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>

          {/* Fingerprint toggle */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-white">
                  <Fingerprint className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Fingerprint</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {state.biometricEnabled
                      ? biometricWorking
                        ? "Fingerprint confirmed and active."
                        : "Enabled — tap to test or disable."
                      : "Uses the system biometric prompt."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  if (!state.biometricEnabled) {
                    // Enabling: run biometric challenge first to confirm it works.
                    setBiometricWorking(false);
                    const ok = await testBiometric();
                    if (!ok) {
                      setError(
                        "Fingerprint authentication failed or was cancelled. Make sure a fingerprint is enrolled on this device."
                      );
                      return;
                    }
                    try {
                      await securitySetBiometricEnabled(true);
                      setBiometricWorking(true);
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  } else {
                    // Disabling.
                    try {
                      await securitySetBiometricEnabled(false);
                      setBiometricWorking(false);
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }
                }}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  state.biometricEnabled
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-white",
                ].join(" ")}
              >
                {state.biometricEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Pattern */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-white">
                  <Lock className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Pattern</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {state.hasPattern
                      ? "Pattern set — used as fallback when fingerprint fails."
                      : "No pattern set. Required to enable app lock."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode("setPattern")}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
              >
                {state.hasPattern ? "Change" : "Set"}
              </button>
            </div>
          </div>

          {/* Pattern draw UI — either for normal set or triggered by enabling lock */}
          {mode === "setPattern" || mode === "setPatternForLock" ? (
            <PatternLock
              title={state.hasPattern ? "Set new pattern" : "Set a pattern"}
              subtitle="Connect at least 4 dots."
              onComplete={async (pattern) => {
                setError(null);
                try {
                  await securitySetPattern(pattern);
                  const wasEnablingLock = mode === "setPatternForLock";
                  setMode("idle");
                  await refresh();
                  // If this pattern was set as part of enabling lock, turn lock on now.
                  if (wasEnablingLock) {
                    await securitySetLockEnabled(true);
                    await refresh();
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

